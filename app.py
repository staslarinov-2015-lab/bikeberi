import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
SESSION_COOKIE = "bikeberi_session"
SESSION_TTL_DAYS = 14
PBKDF2_ITERATIONS = 310_000


def load_env_file():
    if not ENV_PATH.exists():
        return
    for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env_file()

SECRET_KEY = os.environ.get("BIKEBERI_SECRET_KEY", "bikeberi-dev-secret")
HOST = os.environ.get("BIKEBERI_HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", os.environ.get("BIKEBERI_PORT", "8000")))
COOKIE_SECURE = os.environ.get("BIKEBERI_COOKIE_SECURE", "false").lower() == "true"
APP_NAME = os.environ.get("BIKEBERI_APP_NAME", "BikeBeri service app")
DB_PATH = Path(
    os.environ.get(
        "BIKEBERI_DB_PATH",
        str(Path(os.environ.get("RAILWAY_VOLUME_MOUNT_PATH", str(BASE_DIR))) / "app.db"),
    )
)


def utc_now():
    return datetime.now(timezone.utc)


def pbkdf2_digest(password: str, salt: bytes, iterations: int = PBKDF2_ITERATIONS) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = pbkdf2_digest(password, salt)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    if stored_hash.startswith("pbkdf2_sha256$"):
        _, iterations_raw, salt_raw, digest_raw = stored_hash.split("$", 3)
        salt = base64.b64decode(salt_raw.encode("ascii"))
        expected = base64.b64decode(digest_raw.encode("ascii"))
        actual = pbkdf2_digest(password, salt, int(iterations_raw))
        return hmac.compare_digest(actual, expected)

    legacy = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy, stored_hash)


def json_response(handler, status, payload, extra_headers=None):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    send_security_headers(handler)
    if extra_headers:
        for name, value in extra_headers:
            handler.send_header(name, value)
    handler.end_headers()
    handler.wfile.write(body)


def text_response(handler, status, body, content_type="text/plain; charset=utf-8", extra_headers=None):
    data = body.encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(data)))
    send_security_headers(handler)
    if extra_headers:
        for name, value in extra_headers:
            handler.send_header(name, value)
    handler.end_headers()
    handler.wfile.write(data)


def send_security_headers(handler):
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.send_header("X-Frame-Options", "DENY")
    handler.send_header("Referrer-Policy", "same-origin")
    handler.send_header("Cache-Control", "no-store")


def read_json(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    raw = handler.rfile.read(length) if length else b"{}"
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_column(cur, table: str, column: str, definition: str):
    columns = {row[1] for row in cur.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('mechanic', 'owner')),
            full_name TEXT NOT NULL,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS repairs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            bike TEXT NOT NULL,
            issue TEXT NOT NULL,
            work TEXT NOT NULL,
            parts_used TEXT NOT NULL,
            needed_parts TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('Готов', 'В ремонте', 'Ожидает запчасти')),
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS diagnostics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            bike TEXT NOT NULL,
            mechanic_name TEXT NOT NULL,
            symptoms TEXT NOT NULL,
            conclusion TEXT NOT NULL,
            recommendation TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            stock INTEGER NOT NULL,
            min INTEGER NOT NULL,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """
    )

    ensure_column(cur, "users", "created_at", "TEXT")
    ensure_column(cur, "inventory", "updated_at", "TEXT")

    now = utc_now().isoformat()

    users_count = cur.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if users_count == 0:
        cur.executemany(
            "INSERT INTO users (username, password_hash, role, full_name, created_at) VALUES (?, ?, ?, ?, ?)",
            [
                ("mechanic", hash_password("mechanic123"), "mechanic", "Механик BikeBeri", now),
                ("owner", hash_password("owner123"), "owner", "Собственник BikeBeri", now),
            ],
        )

    # Upgrade legacy password hashes in place.
    for user in cur.execute("SELECT id, password_hash FROM users").fetchall():
        if not str(user["password_hash"]).startswith("pbkdf2_sha256$"):
            defaults = {1: "mechanic123", 2: "owner123"}
            password = defaults.get(user["id"])
            if password:
                cur.execute(
                    "UPDATE users SET password_hash = ? WHERE id = ?",
                    (hash_password(password), user["id"]),
                )

    repairs_count = cur.execute("SELECT COUNT(*) FROM repairs").fetchone()[0]
    if repairs_count == 0:
        cur.executemany(
            """
            INSERT INTO repairs (date, bike, issue, work, parts_used, needed_parts, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("2026-04-01", "U2-001", "Скрип тормоза", "Замена колодок", "Колодки (1 комплект)", "-", "Готов", now),
                ("2026-03-31", "U2-014", "Прокол заднего колеса", "Замена камеры и покрышки", "Камера, покрышка", "-", "Готов", now),
                ("2026-03-31", "U2-022", "Не тянет мотор", "Диагностика цепи питания и контроллера", "-", "Контроллер", "Ожидает запчасти", now),
                ("2026-03-30", "U2-017", "Люфт рулевой", "Разборка, протяжка, проверка рулевой", "Смазка", "-", "В ремонте", now),
            ],
        )

    diagnostics_count = cur.execute("SELECT COUNT(*) FROM diagnostics").fetchone()[0]
    if diagnostics_count == 0:
        cur.executemany(
            """
            INSERT INTO diagnostics (date, bike, mechanic_name, symptoms, conclusion, recommendation, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("2026-03-31", "U2-022", "Механик BikeBeri", "Слабая тяга мотора, рывки при старте", "Нужна углубленная проверка контроллера и цепи питания", "Срочный ремонт", now),
                ("2026-03-30", "U2-017", "Механик BikeBeri", "Чувствуется люфт в рулевой колонке", "Можно пустить в плановый ремонт в ближайшее окно", "Плановый ремонт", now),
            ],
        )

    inventory_count = cur.execute("SELECT COUNT(*) FROM inventory").fetchone()[0]
    if inventory_count == 0:
        cur.executemany(
            "INSERT INTO inventory (name, stock, min, updated_at) VALUES (?, ?, ?, ?)",
            [
                ("Колодки", 10, 5, now),
                ("Камеры", 2, 5, now),
                ("Покрышки", 6, 4, now),
                ("Контроллер", 1, 2, now),
            ],
        )

    settings_count = cur.execute("SELECT COUNT(*) FROM settings").fetchone()[0]
    if settings_count == 0:
        cur.executemany(
            "INSERT INTO settings (key, value) VALUES (?, ?)",
            [("total_bikes", "40"), ("target_rate", "95")],
        )

    conn.commit()
    conn.close()


def serialize_user(row):
    return {
        "id": row["id"],
        "username": row["username"],
        "role": row["role"],
        "full_name": row["full_name"],
    }


def sign_token(raw_token: str) -> str:
    signature = hmac.new(SECRET_KEY.encode("utf-8"), raw_token.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{raw_token}.{signature}"


def unsign_token(signed_token: str):
    if "." not in signed_token:
        return None
    raw_token, signature = signed_token.rsplit(".", 1)
    expected = hmac.new(SECRET_KEY.encode("utf-8"), raw_token.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    return raw_token


def get_current_user(handler):
    raw_cookie = handler.headers.get("Cookie")
    if not raw_cookie:
        return None

    jar = cookies.SimpleCookie()
    jar.load(raw_cookie)
    morsel = jar.get(SESSION_COOKIE)
    if not morsel:
        return None

    token = unsign_token(morsel.value)
    if not token:
        return None

    conn = get_db()
    session_row = conn.execute(
        """
        SELECT sessions.expires_at, users.*
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
        """,
        (token,),
    ).fetchone()

    if not session_row:
        conn.close()
        return None

    expires_at = datetime.fromisoformat(session_row["expires_at"])
    if expires_at < utc_now():
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        return None

    user = serialize_user(session_row)
    conn.close()
    return user


def create_session(user_id):
    raw_token = secrets.token_urlsafe(32)
    expires_at = (utc_now() + timedelta(days=SESSION_TTL_DAYS)).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)",
        (user_id, raw_token, expires_at, utc_now().isoformat()),
    )
    conn.commit()
    conn.close()
    return sign_token(raw_token), expires_at


def build_cookie(token="", expires_at=None, delete=False):
    cookie = cookies.SimpleCookie()
    cookie[SESSION_COOKIE] = token
    cookie[SESSION_COOKIE]["path"] = "/"
    cookie[SESSION_COOKIE]["httponly"] = True
    cookie[SESSION_COOKIE]["samesite"] = "Lax"
    if COOKIE_SECURE:
        cookie[SESSION_COOKIE]["secure"] = True
    if delete:
        cookie[SESSION_COOKIE]["max-age"] = 0
    elif expires_at:
        max_age = int((datetime.fromisoformat(expires_at) - utc_now()).total_seconds())
        cookie[SESSION_COOKIE]["max-age"] = max(max_age, 0)
    return ("Set-Cookie", cookie.output(header="").strip())


def require_auth(handler):
    user = get_current_user(handler)
    if not user:
        json_response(handler, 401, {"error": "Авторизация требуется"})
        return None
    return user


def require_role(handler, allowed_roles):
    user = require_auth(handler)
    if not user:
        return None
    if user["role"] not in allowed_roles:
        json_response(handler, 403, {"error": "Недостаточно прав"})
        return None
    return user


def parse_positive_int(value, field_name):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} должно быть числом")
    if parsed < 0:
        raise ValueError(f"{field_name} не может быть отрицательным")
    return parsed


def fetch_bootstrap_payload(user):
    conn = get_db()
    repairs = [
        dict(row)
        for row in conn.execute(
            """
            SELECT id, date, bike, issue, work, parts_used, needed_parts, status
            FROM repairs
            ORDER BY date DESC, id DESC
            """
        ).fetchall()
    ]
    inventory = []
    for row in conn.execute(
        "SELECT id, name, stock, min FROM inventory ORDER BY name COLLATE NOCASE ASC"
    ).fetchall():
        item = dict(row)
        item["need_to_order"] = item["stock"] <= item["min"]
        inventory.append(item)
    diagnostics = [
        dict(row)
        for row in conn.execute(
            """
            SELECT id, date, bike, mechanic_name, symptoms, conclusion, recommendation
            FROM diagnostics
            ORDER BY date DESC, id DESC
            """
        ).fetchall()
    ]
    settings = {
        row["key"]: row["value"]
        for row in conn.execute("SELECT key, value FROM settings").fetchall()
    }
    conn.close()

    return {
        "user": user,
        "kpi": {
            "totalBikes": int(settings.get("total_bikes", "40")),
            "targetRate": int(settings.get("target_rate", "95")),
        },
        "repairs": repairs,
        "inventory": inventory,
        "diagnostics": diagnostics,
    }


class AppHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            return self.serve_file("index.html", "text/html; charset=utf-8")
        if parsed.path == "/styles.css":
            return self.serve_file("styles.css", "text/css; charset=utf-8")
        if parsed.path == "/script.js":
            return self.serve_file("script.js", "application/javascript; charset=utf-8")
        if parsed.path == "/api/bootstrap":
            user = require_auth(self)
            if not user:
                return
            return json_response(self, 200, fetch_bootstrap_payload(user))

        return text_response(self, 404, "Not found")

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/login":
            payload = read_json(self)
            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", ""))
            conn = get_db()
            user_row = conn.execute(
                "SELECT * FROM users WHERE username = ?",
                (username,),
            ).fetchone()

            if not user_row or not verify_password(password, user_row["password_hash"]):
                conn.close()
                return json_response(self, 401, {"error": "Неверный логин или пароль"})

            if not str(user_row["password_hash"]).startswith("pbkdf2_sha256$"):
                conn.execute(
                    "UPDATE users SET password_hash = ? WHERE id = ?",
                    (hash_password(password), user_row["id"]),
                )
                conn.commit()
                user_row = conn.execute(
                    "SELECT * FROM users WHERE id = ?",
                    (user_row["id"],),
                ).fetchone()
            conn.close()

            token, expires_at = create_session(user_row["id"])
            return json_response(
                self,
                200,
                {"user": serialize_user(user_row)},
                extra_headers=[build_cookie(token, expires_at)],
            )

        if parsed.path == "/api/logout":
            raw_cookie = self.headers.get("Cookie", "")
            jar = cookies.SimpleCookie()
            jar.load(raw_cookie)
            morsel = jar.get(SESSION_COOKIE)
            token = unsign_token(morsel.value) if morsel else None
            if token:
                conn = get_db()
                conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
                conn.commit()
                conn.close()
            return json_response(
                self,
                200,
                {"ok": True},
                extra_headers=[build_cookie(delete=True)],
            )

        if parsed.path == "/api/repairs":
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            payload = read_json(self)
            required = ["date", "bike", "issue", "work", "status"]
            if any(not str(payload.get(key, "")).strip() for key in required):
                return json_response(self, 400, {"error": "Заполни обязательные поля ремонта"})

            conn = get_db()
            conn.execute(
                """
                INSERT INTO repairs (date, bike, issue, work, parts_used, needed_parts, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(payload["date"]).strip(),
                    str(payload["bike"]).strip(),
                    str(payload["issue"]).strip(),
                    str(payload["work"]).strip(),
                    str(payload.get("parts_used", "-")).strip() or "-",
                    str(payload.get("needed_parts", "-")).strip() or "-",
                    str(payload["status"]).strip(),
                    utc_now().isoformat(),
                ),
            )
            conn.commit()
            conn.close()
            return json_response(self, 201, {"ok": True})

        if parsed.path == "/api/inventory":
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            payload = read_json(self)
            name = str(payload.get("name", "")).strip()
            stock = payload.get("stock")
            minimum = payload.get("min")
            if not name:
                return json_response(self, 400, {"error": "Название запчасти обязательно"})

            try:
                stock = int(stock)
                minimum = int(minimum)
            except (TypeError, ValueError):
                return json_response(self, 400, {"error": "Остаток и минимум должны быть числами"})

            conn = get_db()
            existing = conn.execute(
                "SELECT id FROM inventory WHERE name = ?",
                (name,),
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE inventory SET stock = ?, min = ?, updated_at = ? WHERE id = ?",
                    (stock, minimum, utc_now().isoformat(), existing["id"]),
                )
            else:
                conn.execute(
                    "INSERT INTO inventory (name, stock, min, updated_at) VALUES (?, ?, ?, ?)",
                    (name, stock, minimum, utc_now().isoformat()),
                )
            conn.commit()
            conn.close()
            return json_response(self, 201, {"ok": True})

        if parsed.path == "/api/diagnostics":
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            payload = read_json(self)
            required = ["date", "bike", "mechanicName", "symptoms", "conclusion", "recommendation"]
            if any(not str(payload.get(key, "")).strip() for key in required):
                return json_response(self, 400, {"error": "Заполни обязательные поля диагностики"})

            conn = get_db()
            conn.execute(
                """
                INSERT INTO diagnostics (date, bike, mechanic_name, symptoms, conclusion, recommendation, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(payload["date"]).strip(),
                    str(payload["bike"]).strip(),
                    str(payload["mechanicName"]).strip(),
                    str(payload["symptoms"]).strip(),
                    str(payload["conclusion"]).strip(),
                    str(payload["recommendation"]).strip(),
                    utc_now().isoformat(),
                ),
            )
            conn.commit()
            conn.close()
            return json_response(self, 201, {"ok": True})

        if parsed.path == "/api/account/password":
            user = require_auth(self)
            if not user:
                return
            payload = read_json(self)
            current_password = str(payload.get("currentPassword", ""))
            new_password = str(payload.get("newPassword", ""))
            if len(new_password) < 8:
                return json_response(self, 400, {"error": "Новый пароль должен быть не короче 8 символов"})

            conn = get_db()
            user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
            if not user_row or not verify_password(current_password, user_row["password_hash"]):
                conn.close()
                return json_response(self, 400, {"error": "Текущий пароль введен неверно"})

            conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (hash_password(new_password), user["id"]),
            )
            conn.commit()
            conn.close()
            return json_response(self, 200, {"message": "Пароль успешно обновлен"})

        return text_response(self, 404, "Not found")

    def do_PUT(self):
        parsed = urlparse(self.path)

        if parsed.path.startswith("/api/repairs/"):
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            repair_id = parsed.path.rsplit("/", 1)[-1]
            payload = read_json(self)
            required = ["date", "bike", "issue", "work", "status"]
            if any(not str(payload.get(key, "")).strip() for key in required):
                return json_response(self, 400, {"error": "Заполни обязательные поля ремонта"})

            conn = get_db()
            conn.execute(
                """
                UPDATE repairs
                SET date = ?, bike = ?, issue = ?, work = ?, parts_used = ?, needed_parts = ?, status = ?
                WHERE id = ?
                """,
                (
                    str(payload["date"]).strip(),
                    str(payload["bike"]).strip(),
                    str(payload["issue"]).strip(),
                    str(payload["work"]).strip(),
                    str(payload.get("parts_used", "-")).strip() or "-",
                    str(payload.get("needed_parts", "-")).strip() or "-",
                    str(payload["status"]).strip(),
                    repair_id,
                ),
            )
            conn.commit()
            conn.close()
            return json_response(self, 200, {"ok": True})

        if parsed.path.startswith("/api/inventory/"):
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            inventory_id = parsed.path.rsplit("/", 1)[-1]
            payload = read_json(self)
            name = str(payload.get("name", "")).strip()
            if not name:
                return json_response(self, 400, {"error": "Название запчасти обязательно"})
            try:
                stock = parse_positive_int(payload.get("stock"), "Остаток")
                minimum = parse_positive_int(payload.get("min"), "Минимум")
            except ValueError as error:
                return json_response(self, 400, {"error": str(error)})

            conn = get_db()
            conn.execute(
                "UPDATE inventory SET name = ?, stock = ?, min = ?, updated_at = ? WHERE id = ?",
                (name, stock, minimum, utc_now().isoformat(), inventory_id),
            )
            conn.commit()
            conn.close()
            return json_response(self, 200, {"ok": True})

        if parsed.path.startswith("/api/diagnostics/"):
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            diagnostic_id = parsed.path.rsplit("/", 1)[-1]
            payload = read_json(self)
            required = ["date", "bike", "mechanicName", "symptoms", "conclusion", "recommendation"]
            if any(not str(payload.get(key, "")).strip() for key in required):
                return json_response(self, 400, {"error": "Заполни обязательные поля диагностики"})

            conn = get_db()
            conn.execute(
                """
                UPDATE diagnostics
                SET date = ?, bike = ?, mechanic_name = ?, symptoms = ?, conclusion = ?, recommendation = ?
                WHERE id = ?
                """,
                (
                    str(payload["date"]).strip(),
                    str(payload["bike"]).strip(),
                    str(payload["mechanicName"]).strip(),
                    str(payload["symptoms"]).strip(),
                    str(payload["conclusion"]).strip(),
                    str(payload["recommendation"]).strip(),
                    diagnostic_id,
                ),
            )
            conn.commit()
            conn.close()
            return json_response(self, 200, {"ok": True})

        if parsed.path == "/api/settings":
            user = require_role(self, {"owner"})
            if not user:
                return
            payload = read_json(self)
            try:
                total_bikes = parse_positive_int(payload.get("totalBikes"), "Количество байков")
                target_rate = parse_positive_int(payload.get("targetRate"), "Цель KPI")
            except ValueError as error:
                return json_response(self, 400, {"error": str(error)})

            if total_bikes < 1:
                return json_response(self, 400, {"error": "Количество байков должно быть больше нуля"})
            if not 1 <= target_rate <= 100:
                return json_response(self, 400, {"error": "Цель KPI должна быть от 1 до 100"})

            conn = get_db()
            conn.execute("UPDATE settings SET value = ? WHERE key = 'total_bikes'", (str(total_bikes),))
            conn.execute("UPDATE settings SET value = ? WHERE key = 'target_rate'", (str(target_rate),))
            conn.commit()
            conn.close()
            return json_response(self, 200, {"ok": True})

        return text_response(self, 404, "Not found")

    def do_DELETE(self):
        parsed = urlparse(self.path)

        if parsed.path.startswith("/api/repairs/"):
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            repair_id = parsed.path.rsplit("/", 1)[-1]
            conn = get_db()
            conn.execute("DELETE FROM repairs WHERE id = ?", (repair_id,))
            conn.commit()
            conn.close()
            return json_response(self, 200, {"ok": True})

        if parsed.path.startswith("/api/inventory/"):
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            inventory_id = parsed.path.rsplit("/", 1)[-1]
            conn = get_db()
            conn.execute("DELETE FROM inventory WHERE id = ?", (inventory_id,))
            conn.commit()
            conn.close()
            return json_response(self, 200, {"ok": True})

        if parsed.path.startswith("/api/diagnostics/"):
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            diagnostic_id = parsed.path.rsplit("/", 1)[-1]
            conn = get_db()
            conn.execute("DELETE FROM diagnostics WHERE id = ?", (diagnostic_id,))
            conn.commit()
            conn.close()
            return json_response(self, 200, {"ok": True})

        return text_response(self, 404, "Not found")

    def serve_file(self, filename, content_type):
        path = BASE_DIR / filename
        if not path.exists():
            return text_response(self, 404, "Not found")
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        send_security_headers(self)
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        return


def main():
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), AppHandler)
    print(f"{APP_NAME} is running on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
