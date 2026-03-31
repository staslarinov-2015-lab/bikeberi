import base64
import hashlib
import hmac
import json
import os
import re
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

BIKE_STATUSES = {
    "в аренде",
    "на диагностике",
    "принят",
    "ждет запчасти",
    "в ремонте",
    "проверка",
    "готов",
}

WORK_ORDER_STATUSES = {
    "принят",
    "диагностика",
    "ждет запчасти",
    "в ремонте",
    "проверка",
    "готов",
}

FAULT_CATALOG = {
    "Трещина пластика": {"minutes": 30, "parts": [("Крепеж пластика", 2)]},
    "Сломано крепление": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Повреждена крышка батареи": {"minutes": 35, "parts": [("Крышка батареи", 1)]},
    "Люфт рулевой": {"minutes": 40, "parts": [("Подшипник рулевой", 1)]},
    "Поврежден рычаг тормоза": {"minutes": 20, "parts": [("Рычаг тормоза", 1)]},
    "Не работает ручка газа": {"minutes": 25, "parts": [("Ручка газа", 1)]},
    "Скрип тормоза": {"minutes": 20, "parts": [("Колодки", 1)]},
    "Стерты колодки": {"minutes": 20, "parts": [("Колодки", 1)]},
    "Кривой тормозной диск": {"minutes": 35, "parts": [("Тормозной диск", 1)]},
    "Не тормозит передний тормоз": {"minutes": 35, "parts": [("Колодки", 1)]},
    "Не тормозит задний тормоз": {"minutes": 35, "parts": [("Колодки", 1)]},
    "Прокол": {"minutes": 25, "parts": [("Камера", 1)]},
    "Спускает колесо": {"minutes": 25, "parts": [("Камера", 1)]},
    "Изношена покрышка": {"minutes": 30, "parts": [("Покрышка", 1)]},
    "Покрышка требует замены": {"minutes": 30, "parts": [("Покрышка", 1)]},
    "Не тянет мотор": {"minutes": 90, "parts": [("Контроллер", 1)]},
    "Ошибка по мотору": {"minutes": 90, "parts": [("Контроллер", 1)]},
    "Мотор не включается": {"minutes": 75, "parts": [("Контроллер", 1)]},
    "Батарея не заряжается": {"minutes": 45, "parts": [("Зарядный порт", 1)]},
    "Поврежден зарядный порт": {"minutes": 45, "parts": [("Зарядный порт", 1)]},
    "Не включается байк": {"minutes": 60, "parts": [("Контроллер", 1)]},
    "Ошибка контроллера": {"minutes": 75, "parts": [("Контроллер", 1)]},
    "Повреждена проводка": {"minutes": 55, "parts": [("Комплект проводки", 1)]},
    "Не работает передняя фара": {"minutes": 20, "parts": [("Передняя фара", 1)]},
    "Не работает задний фонарь": {"minutes": 20, "parts": [("Задний фонарь", 1)]},
    "Не работает стоп-сигнал": {"minutes": 20, "parts": [("Задний фонарь", 1)]},
    "Не работает сигнал": {"minutes": 15, "parts": [("Сигнал", 1)]},
}

BIKE_CODE_RE = re.compile(r"^[PEY]{2}\d{3}[PEY]$")
LEGACY_BIKE_CODE_RE = re.compile(r"^U2-(\d{3})$")
BIKE_CODE_NORMALIZE_MAP = {
    "Р": "P",
    "P": "P",
    "Е": "E",
    "E": "E",
    "У": "Y",
    "Y": "Y",
}


def utc_now():
    return datetime.now(timezone.utc)


def normalize_bike_code(raw_value: str) -> str:
    source = str(raw_value or "").strip().upper()
    return "".join(BIKE_CODE_NORMALIZE_MAP.get(char, char) for char in source)


def migrate_legacy_bike_code(raw_value: str) -> str:
    source = str(raw_value or "").strip().upper()
    match = LEGACY_BIKE_CODE_RE.fullmatch(source)
    if match:
        return f"PE{match.group(1)}Y"
    return source


def validate_bike_code(raw_value: str) -> str:
    bike_code = normalize_bike_code(migrate_legacy_bike_code(raw_value))
    if not BIKE_CODE_RE.fullmatch(bike_code):
        raise ValueError("Номер байка должен быть в формате РЕ123У. Допустимы буквы Р, Е, У и цифры 0-9")
    return bike_code


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


def get_asset_version(filename: str) -> str:
    path = BASE_DIR / filename
    if not path.exists():
        return "0"
    return str(int(path.stat().st_mtime))


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
            phone TEXT,
            telegram TEXT,
            position TEXT,
            notes TEXT,
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
            category TEXT,
            fault TEXT,
            symptoms TEXT NOT NULL,
            conclusion TEXT NOT NULL,
            severity TEXT,
            recommendation TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            stock INTEGER NOT NULL,
            min INTEGER NOT NULL,
            reserved INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS bikes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            model TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            last_service_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS work_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bike_id INTEGER NOT NULL,
            diagnostic_id INTEGER,
            status TEXT NOT NULL,
            issue TEXT NOT NULL,
            category TEXT NOT NULL,
            fault TEXT NOT NULL,
            mechanic_name TEXT NOT NULL,
            intake_date TEXT NOT NULL,
            estimated_minutes INTEGER NOT NULL DEFAULT 0,
            estimated_ready_at TEXT,
            required_parts_text TEXT NOT NULL DEFAULT '-',
            planned_work TEXT NOT NULL DEFAULT '-',
            priority TEXT NOT NULL DEFAULT 'обычный',
            parts_ready INTEGER NOT NULL DEFAULT 0,
            completed_repair_id INTEGER,
            created_at TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY (bike_id) REFERENCES bikes(id),
            FOREIGN KEY (diagnostic_id) REFERENCES diagnostics(id)
        );

        CREATE TABLE IF NOT EXISTS work_order_parts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            work_order_id INTEGER NOT NULL,
            part_name TEXT NOT NULL,
            qty_required INTEGER NOT NULL DEFAULT 1,
            qty_reserved INTEGER NOT NULL DEFAULT 0,
            qty_used INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
        );

        CREATE TABLE IF NOT EXISTS work_order_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            work_order_id INTEGER NOT NULL,
            actor_name TEXT NOT NULL,
            event_type TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """
    )

    ensure_column(cur, "users", "created_at", "TEXT")
    ensure_column(cur, "users", "phone", "TEXT")
    ensure_column(cur, "users", "telegram", "TEXT")
    ensure_column(cur, "users", "position", "TEXT")
    ensure_column(cur, "users", "notes", "TEXT")
    ensure_column(cur, "inventory", "updated_at", "TEXT")
    ensure_column(cur, "inventory", "reserved", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(cur, "diagnostics", "category", "TEXT")
    ensure_column(cur, "diagnostics", "fault", "TEXT")
    ensure_column(cur, "diagnostics", "severity", "TEXT")
    ensure_column(cur, "bikes", "notes", "TEXT")
    ensure_column(cur, "bikes", "last_service_at", "TEXT")
    ensure_column(cur, "work_orders", "required_parts_text", "TEXT NOT NULL DEFAULT '-'")
    ensure_column(cur, "work_orders", "planned_work", "TEXT NOT NULL DEFAULT '-'")
    ensure_column(cur, "work_orders", "priority", "TEXT NOT NULL DEFAULT 'обычный'")
    ensure_column(cur, "work_orders", "parts_ready", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(cur, "work_orders", "completed_repair_id", "INTEGER")
    ensure_column(cur, "work_orders", "completed_at", "TEXT")

    now = utc_now().isoformat()

    users_count = cur.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if users_count == 0:
        cur.executemany(
            "INSERT INTO users (username, password_hash, role, full_name, phone, telegram, position, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                ("mechanic", hash_password("mechanic123"), "mechanic", "Механик BikeBeri", "", "", "Механик", "", now),
                ("owner", hash_password("owner123"), "owner", "Собственник BikeBeri", "", "", "Собственник", "", now),
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
                ("2026-04-01", "PE001Y", "Скрип тормоза", "Замена колодок", "Колодки (1 комплект)", "-", "Готов", now),
                ("2026-03-31", "PE014Y", "Прокол заднего колеса", "Замена камеры и покрышки", "Камера, покрышка", "-", "Готов", now),
                ("2026-03-31", "PE022Y", "Не тянет мотор", "Диагностика цепи питания и контроллера", "-", "Контроллер", "Ожидает запчасти", now),
                ("2026-03-30", "PE017Y", "Люфт рулевой", "Разборка, протяжка, проверка рулевой", "Смазка", "-", "В ремонте", now),
            ],
        )

    diagnostics_count = cur.execute("SELECT COUNT(*) FROM diagnostics").fetchone()[0]
    if diagnostics_count == 0:
        cur.executemany(
            """
            INSERT INTO diagnostics (date, bike, mechanic_name, category, fault, symptoms, conclusion, severity, recommendation, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("2026-03-31", "PE022Y", "Механик BikeBeri", "Мотор", "Не тянет мотор", "Слабая тяга мотора, рывки при старте", "Нужна углубленная проверка контроллера и цепи питания", "Критичная", "Срочный ремонт", now),
                ("2026-03-30", "PE017Y", "Механик BikeBeri", "Руль и управление", "Люфт рулевой", "Чувствуется люфт в рулевой колонке", "Можно пустить в плановый ремонт в ближайшее окно", "Средняя", "Плановый ремонт", now),
            ],
        )

    inventory_count = cur.execute("SELECT COUNT(*) FROM inventory").fetchone()[0]
    if inventory_count == 0:
        cur.executemany(
            "INSERT INTO inventory (name, stock, min, reserved, updated_at) VALUES (?, ?, ?, ?, ?)",
            [
                ("Колодки", 10, 5, 0, now),
                ("Камеры", 2, 5, 0, now),
                ("Покрышки", 6, 4, 0, now),
                ("Контроллер", 1, 2, 0, now),
                ("Крепеж пластика", 12, 4, 0, now),
                ("Крышка батареи", 2, 1, 0, now),
                ("Подшипник рулевой", 3, 1, 0, now),
                ("Рычаг тормоза", 4, 1, 0, now),
                ("Ручка газа", 3, 1, 0, now),
                ("Тормозной диск", 2, 1, 0, now),
                ("Зарядный порт", 3, 1, 0, now),
                ("Комплект проводки", 2, 1, 0, now),
                ("Передняя фара", 3, 1, 0, now),
                ("Задний фонарь", 3, 1, 0, now),
                ("Сигнал", 4, 1, 0, now),
            ],
        )

    for table_name in ("repairs", "diagnostics"):
        rows = cur.execute(f"SELECT id, bike FROM {table_name}").fetchall()
        for row in rows:
            migrated_code = migrate_legacy_bike_code(row["bike"])
            if migrated_code != str(row["bike"]).strip():
                cur.execute(
                    f"UPDATE {table_name} SET bike = ? WHERE id = ?",
                    (migrated_code, row["id"]),
                )

    bike_rows = cur.execute("SELECT id, code FROM bikes ORDER BY id ASC").fetchall()
    existing_bike_codes = {str(row["code"]).strip() for row in bike_rows}
    for row in bike_rows:
        migrated_code = migrate_legacy_bike_code(row["code"])
        current_code = str(row["code"]).strip()
        if migrated_code == current_code:
            continue
        if migrated_code in existing_bike_codes:
            target_row = cur.execute("SELECT id FROM bikes WHERE code = ?", (migrated_code,)).fetchone()
            if target_row:
                cur.execute(
                    "UPDATE work_orders SET bike_id = ? WHERE bike_id = ?",
                    (target_row["id"], row["id"]),
                )
            cur.execute("DELETE FROM bikes WHERE id = ?", (row["id"],))
            continue
        cur.execute(
            "UPDATE bikes SET code = ?, updated_at = ? WHERE id = ?",
            (migrated_code, now, row["id"]),
        )
        existing_bike_codes.discard(current_code)
        existing_bike_codes.add(migrated_code)

    bike_count = cur.execute("SELECT COUNT(*) FROM bikes").fetchone()[0]
    if bike_count == 0:
        known_codes = {"PE001Y", "PE014Y", "PE022Y", "PE017Y"}
        for row in cur.execute("SELECT DISTINCT bike FROM diagnostics").fetchall():
            known_codes.add(str(row["bike"]))
        for row in cur.execute("SELECT DISTINCT bike FROM repairs").fetchall():
            known_codes.add(str(row["bike"]))
        cur.executemany(
            "INSERT INTO bikes (code, model, status, notes, last_service_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                (code, "Wenbox U2", "в аренде", "", None, now, now)
                for code in sorted(known_codes)
            ],
        )

    work_orders_count = cur.execute("SELECT COUNT(*) FROM work_orders").fetchone()[0]
    if work_orders_count == 0:
        diagnostics_rows = cur.execute(
            "SELECT id, date, bike, mechanic_name, category, fault, conclusion, recommendation FROM diagnostics ORDER BY id ASC"
        ).fetchall()
        for diagnostic in diagnostics_rows:
            bike_id = cur.execute("SELECT id FROM bikes WHERE code = ?", (diagnostic["bike"],)).fetchone()["id"]
            category = str(diagnostic["category"] or "").strip() or "Общее"
            fault = str(diagnostic["fault"] or "").strip() or "Не указана"
            recommendation = str(diagnostic["recommendation"] or "").strip() or "Наблюдать"
            conclusion = str(diagnostic["conclusion"] or "").strip() or "-"
            catalog = catalog_entry_for_fault(fault)
            required_parts = merge_parts_lists(catalog["parts"])
            cursor = cur.execute(
                """
                INSERT INTO work_orders (
                    bike_id, diagnostic_id, status, issue, category, fault, mechanic_name,
                    intake_date, estimated_minutes, estimated_ready_at, required_parts_text,
                    planned_work, priority, parts_ready, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    bike_id,
                    diagnostic["id"],
                    "ждет запчасти" if required_parts else "принят",
                    fault,
                    category,
                    fault,
                    diagnostic["mechanic_name"],
                    diagnostic["date"],
                    int(catalog["minutes"]),
                    None,
                    ", ".join(f"{name}:{qty}" for name, qty in required_parts) or "-",
                    conclusion,
                    "высокий" if recommendation == "Срочный ремонт" else "обычный",
                    0,
                    now,
                ),
            )
            work_order_id = cursor.lastrowid
            for name, qty in required_parts:
                cur.execute(
                    "INSERT INTO work_order_parts (work_order_id, part_name, qty_required, qty_reserved, qty_used) VALUES (?, ?, ?, 0, 0)",
                    (work_order_id, name, qty),
                )
            result = refresh_work_order_parts(conn, work_order_id)
            status = "принят" if result["all_reserved"] else "ждет запчасти"
            eta = (utc_now() + timedelta(minutes=int(catalog["minutes"]))).isoformat() if result["all_reserved"] else None
            cur.execute(
                "UPDATE work_orders SET status = ?, parts_ready = ?, estimated_ready_at = ? WHERE id = ?",
                (status, 1 if result["all_reserved"] else 0, eta, work_order_id),
            )
            set_bike_status(conn, bike_id, "принят" if result["all_reserved"] else "ждет запчасти")
            add_work_order_history(
                conn,
                work_order_id,
                diagnostic["mechanic_name"],
                "created",
                "Заявка создана автоматически из диагностики",
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
        "phone": row["phone"] or "",
        "telegram": row["telegram"] or "",
        "position": row["position"] or "",
        "notes": row["notes"] or "",
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


def normalize_inventory_name(name: str) -> str:
    normalized = str(name).strip()
    aliases = {
        "Камера": "Камеры",
        "Покрышка": "Покрышки",
        "Колодка": "Колодки",
        "Контроллер": "Контроллер",
    }
    return aliases.get(normalized, normalized)


def catalog_entry_for_fault(fault: str):
    return FAULT_CATALOG.get(str(fault).strip(), {"minutes": 45, "parts": []})


def parse_required_parts_text(raw_value: str):
    parts = []
    if not raw_value:
        return parts
    for chunk in str(raw_value).split(","):
        item = chunk.strip()
        if not item:
            continue
        if ":" in item:
            name, qty_raw = item.split(":", 1)
            try:
                qty = max(int(qty_raw.strip()), 1)
            except ValueError:
                qty = 1
        else:
            name = item
            qty = 1
        parts.append((normalize_inventory_name(name), qty))
    return parts


def merge_parts_lists(*part_lists):
    merged = {}
    for part_list in part_lists:
        for name, qty in part_list:
            normalized = normalize_inventory_name(name)
            merged[normalized] = merged.get(normalized, 0) + max(int(qty), 1)
    return [(name, qty) for name, qty in merged.items()]


def ensure_bike(conn, bike_code: str):
    bike_code = validate_bike_code(bike_code)
    row = conn.execute("SELECT id FROM bikes WHERE code = ?", (bike_code,)).fetchone()
    if row:
        return row["id"]
    cursor = conn.execute(
        "INSERT INTO bikes (code, model, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (bike_code, "Wenbox U2", "на диагностике", utc_now().isoformat(), utc_now().isoformat()),
    )
    return cursor.lastrowid


def set_bike_status(conn, bike_id: int, status: str):
    if status not in BIKE_STATUSES:
        return
    conn.execute(
        "UPDATE bikes SET status = ?, updated_at = ? WHERE id = ?",
        (status, utc_now().isoformat(), bike_id),
    )


def add_work_order_history(conn, work_order_id: int, actor_name: str, event_type: str, message: str):
    conn.execute(
        """
        INSERT INTO work_order_history (work_order_id, actor_name, event_type, message, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (work_order_id, actor_name, event_type, message, utc_now().isoformat()),
    )


def refresh_work_order_parts(conn, work_order_id: int):
    parts_rows = conn.execute(
        """
        SELECT id, part_name, qty_required, qty_reserved
        FROM work_order_parts
        WHERE work_order_id = ?
        ORDER BY id ASC
        """,
        (work_order_id,),
    ).fetchall()
    missing = []
    all_reserved = True

    for row in parts_rows:
        item = conn.execute(
            "SELECT stock, reserved FROM inventory WHERE name = ?",
            (row["part_name"],),
        ).fetchone()
        stock = int(item["stock"]) if item else 0
        reserved_total = int(item["reserved"]) if item and item["reserved"] is not None else 0
        available_for_new = max(stock - reserved_total, 0)
        reserved_for_order = int(row["qty_reserved"] or 0)
        need = max(int(row["qty_required"]) - reserved_for_order, 0)

        if need > 0 and available_for_new >= need and item:
            conn.execute(
                "UPDATE inventory SET reserved = reserved + ?, updated_at = ? WHERE name = ?",
                (need, utc_now().isoformat(), row["part_name"]),
            )
            conn.execute(
                "UPDATE work_order_parts SET qty_reserved = qty_reserved + ? WHERE id = ?",
                (need, row["id"]),
            )
            reserved_for_order += need
            available_for_new -= need

        if reserved_for_order < int(row["qty_required"]):
            all_reserved = False
            missing.append(
                {
                    "name": row["part_name"],
                    "required": int(row["qty_required"]),
                    "reserved": reserved_for_order,
                    "missing": int(row["qty_required"]) - reserved_for_order,
                }
            )

    return {"all_reserved": all_reserved, "missing": missing}


def hydrate_work_orders(conn):
    orders = []
    raw_orders = conn.execute(
        """
        SELECT
            work_orders.id,
            work_orders.bike_id,
            bikes.code AS bike_code,
            bikes.model AS bike_model,
            bikes.status AS bike_status,
            work_orders.diagnostic_id,
            work_orders.status,
            work_orders.issue,
            work_orders.category,
            work_orders.fault,
            work_orders.mechanic_name,
            work_orders.intake_date,
            work_orders.estimated_minutes,
            work_orders.estimated_ready_at,
            work_orders.required_parts_text,
            work_orders.planned_work,
            work_orders.priority,
            work_orders.parts_ready,
            work_orders.created_at,
            work_orders.completed_at
        FROM work_orders
        JOIN bikes ON bikes.id = work_orders.bike_id
        ORDER BY
            CASE work_orders.status
                WHEN 'ждет запчасти' THEN 0
                WHEN 'диагностика' THEN 1
                WHEN 'принят' THEN 2
                WHEN 'в ремонте' THEN 3
                WHEN 'проверка' THEN 4
                WHEN 'готов' THEN 5
                ELSE 6
            END,
            work_orders.intake_date DESC,
            work_orders.id DESC
        """
    ).fetchall()

    for row in raw_orders:
        order = dict(row)
        parts = [
            dict(part_row)
            for part_row in conn.execute(
                """
                SELECT part_name, qty_required, qty_reserved, qty_used
                FROM work_order_parts
                WHERE work_order_id = ?
                ORDER BY id ASC
                """,
                (order["id"],),
            ).fetchall()
        ]
        history = [
            dict(history_row)
            for history_row in conn.execute(
                """
                SELECT actor_name, event_type, message, created_at
                FROM work_order_history
                WHERE work_order_id = ?
                ORDER BY id DESC
                LIMIT 5
                """,
                (order["id"],),
            ).fetchall()
        ]
        missing_parts = [
            {
                "name": part["part_name"],
                "required": int(part["qty_required"]),
                "reserved": int(part["qty_reserved"] or 0),
                "missing": int(part["qty_required"]) - int(part["qty_reserved"] or 0),
            }
            for part in parts
            if int(part["qty_reserved"] or 0) < int(part["qty_required"])
        ]
        order["parts"] = parts
        order["history"] = history
        order["missing_parts"] = missing_parts
        order["parts_ready"] = bool(order["parts_ready"])
        order["can_start"] = order["status"] in {"принят", "диагностика"} and not missing_parts
        order["can_send_to_check"] = order["status"] == "в ремонте"
        order["can_mark_ready"] = order["status"] == "проверка"
        order["can_reserve"] = order["status"] == "ждет запчасти"
        orders.append(order)

    return orders


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
        "SELECT id, name, stock, min, reserved FROM inventory ORDER BY name COLLATE NOCASE ASC"
    ).fetchall():
        item = dict(row)
        item["available"] = max(int(item["stock"]) - int(item["reserved"] or 0), 0)
        item["need_to_order"] = item["available"] <= item["min"]
        inventory.append(item)
    bikes = [
        dict(row)
        for row in conn.execute(
            """
            SELECT id, code, model, status, notes, last_service_at
            FROM bikes
            ORDER BY code COLLATE NOCASE ASC
            """
        ).fetchall()
    ]
    diagnostics = [
        dict(row)
        for row in conn.execute(
            """
            SELECT id, date, bike, mechanic_name, category, fault, symptoms, conclusion, severity, recommendation
            FROM diagnostics
            ORDER BY date DESC, id DESC
            """
        ).fetchall()
    ]
    settings = {
        row["key"]: row["value"]
        for row in conn.execute("SELECT key, value FROM settings").fetchall()
    }
    work_orders = hydrate_work_orders(conn)
    conn.close()

    return {
        "user": user,
        "kpi": {
            "totalBikes": int(settings.get("total_bikes", "40")),
            "targetRate": int(settings.get("target_rate", "95")),
        },
        "bikes": bikes,
        "repairs": repairs,
        "inventory": inventory,
        "diagnostics": diagnostics,
        "workOrders": work_orders,
    }


class AppHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            return self.serve_index()
        if parsed.path == "/styles.css":
            return self.serve_file("styles.css", "text/css; charset=utf-8", cache_control="public, max-age=31536000, immutable")
        if parsed.path == "/script.js":
            return self.serve_file("script.js", "application/javascript; charset=utf-8", cache_control="public, max-age=31536000, immutable")
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
            try:
                bike_code = validate_bike_code(payload.get("bike", ""))
            except ValueError as error:
                return json_response(self, 400, {"error": str(error)})

            conn = get_db()
            conn.execute(
                """
                INSERT INTO repairs (date, bike, issue, work, parts_used, needed_parts, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(payload["date"]).strip(),
                    bike_code,
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
            required = ["date", "bike", "mechanicName", "category", "fault", "symptoms", "conclusion", "recommendation", "severity"]
            if any(not str(payload.get(key, "")).strip() for key in required):
                return json_response(self, 400, {"error": "Заполни обязательные поля диагностики"})
            try:
                bike_code = validate_bike_code(payload.get("bike", ""))
            except ValueError as error:
                return json_response(self, 400, {"error": str(error)})

            conn = get_db()
            cursor = conn.execute(
                """
                INSERT INTO diagnostics (date, bike, mechanic_name, category, fault, symptoms, conclusion, severity, recommendation, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(payload["date"]).strip(),
                    bike_code,
                    str(payload["mechanicName"]).strip(),
                    str(payload["category"]).strip(),
                    str(payload["fault"]).strip(),
                    str(payload["symptoms"]).strip(),
                    str(payload["conclusion"]).strip(),
                    str(payload["severity"]).strip(),
                    str(payload["recommendation"]).strip(),
                    utc_now().isoformat(),
                ),
            )
            diagnostic_id = cursor.lastrowid
            bike_id = ensure_bike(conn, bike_code)
            set_bike_status(conn, bike_id, "на диагностике")

            catalog = catalog_entry_for_fault(payload["fault"])
            manual_parts = parse_required_parts_text(payload.get("required_parts_text", ""))
            required_parts = merge_parts_lists(catalog["parts"], manual_parts)
            intake_date = str(payload["date"]).strip()
            estimated_minutes = int(catalog["minutes"])
            priority = "высокий" if str(payload["severity"]).strip() == "Критичная" else "обычный"
            work_cursor = conn.execute(
                """
                INSERT INTO work_orders (
                    bike_id, diagnostic_id, status, issue, category, fault, mechanic_name,
                    intake_date, estimated_minutes, estimated_ready_at, required_parts_text,
                    planned_work, priority, parts_ready, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    bike_id,
                    diagnostic_id,
                    "диагностика",
                    str(payload["fault"]).strip(),
                    str(payload["category"]).strip(),
                    str(payload["fault"]).strip(),
                    str(payload["mechanicName"]).strip(),
                    intake_date,
                    estimated_minutes,
                    None,
                    ", ".join(f"{name}:{qty}" for name, qty in required_parts) or "-",
                    str(payload.get("conclusion", "")).strip() or "-",
                    priority,
                    0,
                    utc_now().isoformat(),
                ),
            )
            work_order_id = work_cursor.lastrowid
            for part_name, qty in required_parts:
                conn.execute(
                    """
                    INSERT INTO work_order_parts (work_order_id, part_name, qty_required, qty_reserved, qty_used)
                    VALUES (?, ?, ?, 0, 0)
                    """,
                    (work_order_id, part_name, qty),
                )
            reservation = refresh_work_order_parts(conn, work_order_id)
            next_status = "принят" if reservation["all_reserved"] else "ждет запчасти"
            estimated_ready_at = (
                (utc_now() + timedelta(minutes=estimated_minutes)).isoformat()
                if reservation["all_reserved"]
                else None
            )
            conn.execute(
                "UPDATE work_orders SET status = ?, parts_ready = ?, estimated_ready_at = ? WHERE id = ?",
                (next_status, 1 if reservation["all_reserved"] else 0, estimated_ready_at, work_order_id),
            )
            set_bike_status(conn, bike_id, next_status)
            add_work_order_history(
                conn,
                work_order_id,
                str(payload["mechanicName"]).strip(),
                "created",
                "Байк принят после аренды и переведен в сервисную заявку",
            )
            add_work_order_history(
                conn,
                work_order_id,
                str(payload["mechanicName"]).strip(),
                "inventory_check",
                "Запчасти проверены автоматически по складу",
            )
            conn.commit()
            conn.close()
            return json_response(self, 201, {"ok": True, "workOrderId": work_order_id})

        if parsed.path.startswith("/api/work-orders/") and parsed.path.endswith("/transition"):
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            work_order_id = parsed.path.split("/")[3]
            payload = read_json(self)
            action = str(payload.get("action", "")).strip()
            conn = get_db()
            order = conn.execute(
                """
                SELECT id, bike_id, status, issue, category, fault, mechanic_name, intake_date,
                       estimated_minutes, required_parts_text, planned_work, completed_repair_id
                FROM work_orders
                WHERE id = ?
                """,
                (work_order_id,),
            ).fetchone()
            if not order:
                conn.close()
                return json_response(self, 404, {"error": "Заявка не найдена"})

            reservation = refresh_work_order_parts(conn, int(work_order_id))
            next_status = order["status"]

            if action == "reserve":
                next_status = "принят" if reservation["all_reserved"] else "ждет запчасти"
                eta = (
                    (utc_now() + timedelta(minutes=int(order["estimated_minutes"] or 0))).isoformat()
                    if reservation["all_reserved"]
                    else None
                )
                conn.execute(
                    "UPDATE work_orders SET status = ?, parts_ready = ?, estimated_ready_at = ? WHERE id = ?",
                    (next_status, 1 if reservation["all_reserved"] else 0, eta, work_order_id),
                )
                set_bike_status(conn, order["bike_id"], next_status)
                add_work_order_history(
                    conn,
                    int(work_order_id),
                    user["full_name"],
                    "inventory_check",
                    "Повторная проверка и резервирование запчастей",
                )

            elif action == "start_repair":
                if order["status"] not in {"принят", "диагностика"}:
                    conn.close()
                    return json_response(self, 400, {"error": "Эту заявку сейчас нельзя запустить в ремонт"})
                if not reservation["all_reserved"]:
                    conn.close()
                    return json_response(self, 400, {"error": "Не все запчасти в наличии"})
                next_status = "в ремонте"
                conn.execute(
                    "UPDATE work_orders SET status = ?, parts_ready = 1 WHERE id = ?",
                    (next_status, work_order_id),
                )
                set_bike_status(conn, order["bike_id"], next_status)
                add_work_order_history(conn, int(work_order_id), user["full_name"], "status", "Механик начал ремонт")

            elif action == "send_to_check":
                if order["status"] != "в ремонте":
                    conn.close()
                    return json_response(self, 400, {"error": "Сначала нужно выполнить ремонт"})
                next_status = "проверка"
                conn.execute("UPDATE work_orders SET status = ? WHERE id = ?", (next_status, work_order_id))
                set_bike_status(conn, order["bike_id"], next_status)
                add_work_order_history(conn, int(work_order_id), user["full_name"], "status", "Ремонт завершен, байк отправлен на проверку")

            elif action == "return_to_repair":
                if order["status"] != "проверка":
                    conn.close()
                    return json_response(self, 400, {"error": "Возврат доступен только из проверки"})
                next_status = "в ремонте"
                conn.execute("UPDATE work_orders SET status = ? WHERE id = ?", (next_status, work_order_id))
                set_bike_status(conn, order["bike_id"], next_status)
                add_work_order_history(conn, int(work_order_id), user["full_name"], "status", "Байк возвращен из проверки в ремонт")

            elif action == "mark_ready":
                if order["status"] != "проверка":
                    conn.close()
                    return json_response(self, 400, {"error": "Готовность можно поставить только после проверки"})
                parts = conn.execute(
                    """
                    SELECT part_name, qty_required, qty_reserved
                    FROM work_order_parts
                    WHERE work_order_id = ?
                    """,
                    (work_order_id,),
                ).fetchall()
                for part in parts:
                    conn.execute(
                        """
                        UPDATE inventory
                        SET stock = stock - ?, reserved = CASE WHEN reserved >= ? THEN reserved - ? ELSE 0 END, updated_at = ?
                        WHERE name = ?
                        """,
                        (
                            int(part["qty_required"]),
                            int(part["qty_reserved"]),
                            int(part["qty_reserved"]),
                            utc_now().isoformat(),
                            part["part_name"],
                        ),
                    )
                    conn.execute(
                        "UPDATE work_order_parts SET qty_used = qty_required WHERE work_order_id = ? AND part_name = ?",
                        (work_order_id, part["part_name"]),
                    )
                repair_id = order["completed_repair_id"]
                if repair_id is None:
                    repair_cursor = conn.execute(
                        """
                        INSERT INTO repairs (date, bike, issue, work, parts_used, needed_parts, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            utc_now().date().isoformat(),
                            conn.execute("SELECT code FROM bikes WHERE id = ?", (order["bike_id"],)).fetchone()["code"],
                            order["issue"],
                            order["planned_work"] or f"Ремонт по заявке: {order['fault']}",
                            order["required_parts_text"] or "-",
                            "-",
                            "Готов",
                            utc_now().isoformat(),
                        ),
                    )
                    repair_id = repair_cursor.lastrowid
                next_status = "готов"
                conn.execute(
                    "UPDATE work_orders SET status = ?, completed_repair_id = ?, completed_at = ?, parts_ready = 1 WHERE id = ?",
                    (next_status, repair_id, utc_now().isoformat(), work_order_id),
                )
                conn.execute(
                    "UPDATE bikes SET status = ?, last_service_at = ?, updated_at = ? WHERE id = ?",
                    ("готов", utc_now().date().isoformat(), utc_now().isoformat(), order["bike_id"]),
                )
                add_work_order_history(conn, int(work_order_id), user["full_name"], "status", "Байк готов и может быть снова выдан в аренду")
            else:
                conn.close()
                return json_response(self, 400, {"error": "Неизвестное действие"})

            conn.commit()
            conn.close()
            return json_response(self, 200, {"ok": True, "status": next_status})

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
            try:
                bike_code = validate_bike_code(payload.get("bike", ""))
            except ValueError as error:
                return json_response(self, 400, {"error": str(error)})

            conn = get_db()
            conn.execute(
                """
                UPDATE repairs
                SET date = ?, bike = ?, issue = ?, work = ?, parts_used = ?, needed_parts = ?, status = ?
                WHERE id = ?
                """,
                (
                    str(payload["date"]).strip(),
                    bike_code,
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
            required = ["date", "bike", "mechanicName", "category", "fault", "symptoms", "conclusion", "recommendation", "severity"]
            if any(not str(payload.get(key, "")).strip() for key in required):
                return json_response(self, 400, {"error": "Заполни обязательные поля диагностики"})
            try:
                bike_code = validate_bike_code(payload.get("bike", ""))
            except ValueError as error:
                return json_response(self, 400, {"error": str(error)})

            conn = get_db()
            conn.execute(
                """
                UPDATE diagnostics
                SET date = ?, bike = ?, mechanic_name = ?, category = ?, fault = ?, symptoms = ?, conclusion = ?, severity = ?, recommendation = ?
                WHERE id = ?
                """,
                (
                    str(payload["date"]).strip(),
                    bike_code,
                    str(payload["mechanicName"]).strip(),
                    str(payload["category"]).strip(),
                    str(payload["fault"]).strip(),
                    str(payload["symptoms"]).strip(),
                    str(payload["conclusion"]).strip(),
                    str(payload["severity"]).strip(),
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

        if parsed.path == "/api/profile":
            user = require_auth(self)
            if not user:
                return
            payload = read_json(self)
            full_name = str(payload.get("fullName", "")).strip()
            if not full_name:
                return json_response(self, 400, {"error": "ФИО обязательно"})

            conn = get_db()
            conn.execute(
                """
                UPDATE users
                SET full_name = ?, phone = ?, telegram = ?, position = ?, notes = ?
                WHERE id = ?
                """,
                (
                    full_name,
                    str(payload.get("phone", "")).strip(),
                    str(payload.get("telegram", "")).strip(),
                    str(payload.get("position", "")).strip(),
                    str(payload.get("notes", "")).strip(),
                    user["id"],
                ),
            )
            conn.commit()
            conn.close()
            return json_response(self, 200, {"message": "Профиль обновлен"})

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

    def serve_index(self):
        path = BASE_DIR / "index.html"
        if not path.exists():
            return text_response(self, 404, "Not found")
        data = (
            path.read_text(encoding="utf-8")
            .replace("./styles.css", f"./styles.css?v={get_asset_version('styles.css')}")
            .replace("./script.js", f"./script.js?v={get_asset_version('script.js')}")
            .encode("utf-8")
        )
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        send_security_headers(self)
        self.end_headers()
        self.wfile.write(data)

    def serve_file(self, filename, content_type, cache_control="no-store"):
        path = BASE_DIR / filename
        if not path.exists():
            return text_response(self, 404, "Not found")
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", cache_control)
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
