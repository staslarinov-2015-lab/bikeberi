import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, urlparse
from urllib.error import HTTPError
from urllib.request import Request, urlopen


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
APP_NAME = os.environ.get("BIKEBERI_APP_NAME", "Байк Сервис")


def resolve_db_path() -> Path:
    explicit = os.environ.get("BIKEBERI_DB_PATH")
    if explicit:
        return Path(explicit)
    railway_mount = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH")
    if railway_mount:
        return Path(railway_mount) / "app.db"
    # Prefer mounted persistent disk on PaaS providers (Render/Fly).
    if Path("/data").exists():
        return Path("/data/app.db")
    return BASE_DIR / "app.db"


DB_PATH = resolve_db_path()
SEED_SQL_PATH = BASE_DIR / "seed_dump.sql"
SUPABASE_URL = os.environ.get("BIKEBERI_SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("BIKEBERI_SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_BUCKET = os.environ.get("BIKEBERI_SUPABASE_BUCKET", "bikeberi-data").strip() or "bikeberi-data"
SUPABASE_DB_OBJECT = os.environ.get("BIKEBERI_SUPABASE_DB_OBJECT", "app.db").strip() or "app.db"
SUPABASE_DB_SYNC_ENABLED = bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
SUPABASE_ALLOW_EMPTY_BOOTSTRAP = os.environ.get("BIKEBERI_SUPABASE_ALLOW_EMPTY_BOOTSTRAP", "false").strip().lower() == "true"
_SUPABASE_SYNC_LOCK = threading.Lock()
_SUPABASE_UPLOAD_ALLOWED = not SUPABASE_DB_SYNC_ENABLED
_SUPABASE_LAST_ERROR = ""
_SUPABASE_LAST_SYNC_AT = ""
_SUPABASE_LAST_DOWNLOAD_NOT_FOUND = False
# Bucket that successfully downloaded/uploaded (may differ from SUPABASE_BUCKET if env is stale).
_SUPABASE_ACTIVE_BUCKET = ""
ALLOW_DEMO_SEED = os.environ.get("BIKEBERI_ALLOW_DEMO_SEED", "false").strip().lower() == "true"

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

BIKE_STATUS_OPTIONS = (
    "в аренде",
    "на диагностике",
    "ждет запчасти",
    "в ремонте",
    "проверка",
    "готов",
    "принят",
)

MECHANIC_BIKE_STATUS_OPTIONS = (
    "принят",
    "ждет запчасти",
    "в ремонте",
    "проверка",
)

FAULT_CATALOG = {
    "Дека для ног · Трещина": {"minutes": 30, "parts": [("Крепеж пластика", 2)]},
    "Дека для ног · Скол": {"minutes": 15, "parts": []},
    "Дека для ног · Полностью сломано": {"minutes": 40, "parts": [("Крепеж пластика", 2)]},
    "Дека для ног · Отсутствует деталь": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Корпус слева · Трещина": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Корпус слева · Скол": {"minutes": 15, "parts": []},
    "Корпус слева · Полностью сломано": {"minutes": 35, "parts": [("Крепеж пластика", 2)]},
    "Корпус слева · Отсутствует деталь": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Корпус справа · Трещина": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Корпус справа · Скол": {"minutes": 15, "parts": []},
    "Корпус справа · Полностью сломано": {"minutes": 35, "parts": [("Крепеж пластика", 2)]},
    "Корпус справа · Отсутствует деталь": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Рулевая колонка · Трещина": {"minutes": 30, "parts": [("Крепеж пластика", 2)]},
    "Рулевая колонка · Скол": {"minutes": 15, "parts": []},
    "Рулевая колонка · Полностью сломано": {"minutes": 35, "parts": [("Крепеж пластика", 2)]},
    "Рулевая колонка · Отсутствует деталь": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Сиденье · Трещина": {"minutes": 20, "parts": []},
    "Сиденье · Скол": {"minutes": 15, "parts": []},
    "Сиденье · Полностью сломано": {"minutes": 30, "parts": []},
    "Сиденье · Отсутствует деталь": {"minutes": 20, "parts": []},
    "Место под АКБ · Трещина": {"minutes": 25, "parts": [("Крышка батареи", 1)]},
    "Место под АКБ · Скол": {"minutes": 15, "parts": []},
    "Место под АКБ · Полностью сломано": {"minutes": 35, "parts": [("Крышка батареи", 1)]},
    "Место под АКБ · Отсутствует деталь": {"minutes": 20, "parts": [("Крышка батареи", 1)]},
    "Сабля левая · Трещина": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Сабля левая · Скол": {"minutes": 15, "parts": []},
    "Сабля левая · Полностью сломано": {"minutes": 35, "parts": [("Крепеж пластика", 2)]},
    "Сабля левая · Отсутствует деталь": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Сабля правая · Трещина": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Сабля правая · Скол": {"minutes": 15, "parts": []},
    "Сабля правая · Полностью сломано": {"minutes": 35, "parts": [("Крепеж пластика", 2)]},
    "Сабля правая · Отсутствует деталь": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Передний щиток · Трещина": {"minutes": 30, "parts": [("Крепеж пластика", 2)]},
    "Передний щиток · Скол": {"minutes": 15, "parts": []},
    "Передний щиток · Полностью сломано": {"minutes": 40, "parts": [("Крепеж пластика", 2)]},
    "Передний щиток · Отсутствует деталь": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Порог левый · Трещина": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Порог левый · Скол": {"minutes": 15, "parts": []},
    "Порог левый · Полностью сломано": {"minutes": 35, "parts": [("Крепеж пластика", 2)]},
    "Порог левый · Отсутствует деталь": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Порог правый · Трещина": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Порог правый · Скол": {"minutes": 15, "parts": []},
    "Порог правый · Полностью сломано": {"minutes": 35, "parts": [("Крепеж пластика", 2)]},
    "Порог правый · Отсутствует деталь": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Корпус центр · Трещина": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Корпус центр · Скол": {"minutes": 15, "parts": []},
    "Корпус центр · Полностью сломано": {"minutes": 35, "parts": [("Крепеж пластика", 2)]},
    "Корпус центр · Отсутствует деталь": {"minutes": 25, "parts": [("Крепеж пластика", 2)]},
    "Люфт рулевой": {"minutes": 40, "parts": [("Подшипник рулевой", 1)]},
    "Руль стоит криво": {"minutes": 15, "parts": []},
    "Тугой поворот руля": {"minutes": 30, "parts": [("Подшипник рулевой", 1)]},
    "Поврежден рычаг тормоза": {"minutes": 20, "parts": [("Рычаг тормоза", 1)]},
    "Не работает ручка газа": {"minutes": 25, "parts": [("Ручка газа", 1)]},
    "Заедает ручка газа": {"minutes": 20, "parts": [("Ручка газа", 1)]},
    "Не работает кнопка включения": {"minutes": 25, "parts": []},
    "Люфт ручек": {"minutes": 15, "parts": [("Ручка руля", 1)]},
    "Повреждена ручка": {"minutes": 20, "parts": [("Ручка руля", 1)]},
    "Скрип тормоза": {"minutes": 20, "parts": [("Колодки", 1)]},
    "Стерты колодки": {"minutes": 20, "parts": [("Колодки", 1)]},
    "Кривой тормозной диск": {"minutes": 35, "parts": [("Тормозной диск", 1)]},
    "Не тормозит передний тормоз": {"minutes": 35, "parts": [("Колодки", 1)]},
    "Не тормозит задний тормоз": {"minutes": 35, "parts": [("Колодки", 1)]},
    "Закис суппорт": {"minutes": 40, "parts": []},
    "Диск трет": {"minutes": 25, "parts": []},
    "Не возвращается ручка тормоза": {"minutes": 20, "parts": [("Рычаг тормоза", 1)]},
    "Прокол": {"minutes": 25, "parts": [("Камера", 1)]},
    "Спускает колесо": {"minutes": 25, "parts": [("Камера", 1)]},
    "Изношена покрышка": {"minutes": 30, "parts": [("Покрышка", 1)]},
    "Боковой порез": {"minutes": 30, "parts": [("Покрышка", 1)]},
    "Деформация диска": {"minutes": 40, "parts": []},
    "Люфт колеса": {"minutes": 30, "parts": [("Подшипник колеса", 1)]},
    "Биение колеса": {"minutes": 30, "parts": []},
    "Поврежден ниппель": {"minutes": 15, "parts": [("Ниппель", 1)]},
    "Проблема с подшипником": {"minutes": 40, "parts": []},
    "Амортизатор не прожимается": {"minutes": 45, "parts": [("Амортизатор", 1)]},
    "Пробой амортизатора (болтается)": {"minutes": 50, "parts": [("Амортизатор", 1)]},
    "Люфт подвески": {"minutes": 40, "parts": [("Втулки подвески", 1)]},
    "Вилка кривая (повело)": {"minutes": 60, "parts": [("Вилка", 1)]},
    "Подтек масла": {"minutes": 45, "parts": [("Сальники вилки", 1)]},
    "Не тянет мотор": {"minutes": 90, "parts": [("Контроллер", 1)]},
    "Рывки при разгоне": {"minutes": 60, "parts": [("Контроллер", 1)]},
    "Посторонний шум мотора": {"minutes": 50, "parts": []},
    "Мотор не включается": {"minutes": 75, "parts": [("Контроллер", 1)]},
    "Перегрев мотора": {"minutes": 55, "parts": []},
    "Ошибка по мотору": {"minutes": 70, "parts": [("Контроллер", 1)]},
    "Повышенная вибрация": {"minutes": 45, "parts": []},
    "Батарея не заряжается": {"minutes": 45, "parts": [("Зарядный порт", 1)]},
    "Быстро теряет заряд": {"minutes": 35, "parts": []},
    "Батарея не фиксируется": {"minutes": 25, "parts": [("Крышка батареи", 1)]},
    "Батарея не определяется": {"minutes": 35, "parts": []},
    "Ошибка BMS": {"minutes": 45, "parts": []},
    "Перегрев батареи": {"minutes": 30, "parts": []},
    "Зарядный порт поврежден": {"minutes": 30, "parts": [("Зарядный порт", 1)]},
    "Не работает зарядное устройство": {"minutes": 20, "parts": [("Зарядное устройство", 1)]},
    "Окисление контактов батареи": {"minutes": 20, "parts": []},
    "Просадка напряжения": {"minutes": 35, "parts": []},
    "Не включается байк": {"minutes": 60, "parts": [("Контроллер", 1)]},
    "Ошибка контроллера": {"minutes": 75, "parts": [("Контроллер", 1)]},
    "Пропадает питание": {"minutes": 45, "parts": [("Комплект проводки", 1)]},
    "Повреждена проводка": {"minutes": 55, "parts": [("Комплект проводки", 1)]},
    "Окисление разъемов": {"minutes": 25, "parts": []},
    "Замыкание": {"minutes": 55, "parts": [("Комплект проводки", 1)]},
    "Нестабильная работа": {"minutes": 40, "parts": []},
    "Ошибка датчиков": {"minutes": 35, "parts": []},
    "Не работает панель управления": {"minutes": 35, "parts": [("Панель управления", 1)]},
    "Не работает передняя фара": {"minutes": 20, "parts": [("Передняя фара", 1)]},
    "Не работает задний фонарь": {"minutes": 20, "parts": [("Задний фонарь", 1)]},
    "Не работает стоп-сигнал": {"minutes": 20, "parts": [("Задний фонарь", 1)]},
    "Не работает сигнал": {"minutes": 15, "parts": [("Сигнал", 1)]},
    "Мигает свет": {"minutes": 20, "parts": []},
    "Плохой контакт по освещению": {"minutes": 20, "parts": []},
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
    try:
        return json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def get_telegram_config() -> dict:
    config = {
        "token": os.environ.get("BIKEBERI_TELEGRAM_BOT_TOKEN", "").strip(),
        "secret": os.environ.get("BIKEBERI_TELEGRAM_WEBHOOK_SECRET", "").strip(),
        "owner_chat_id": os.environ.get("BIKEBERI_TELEGRAM_OWNER_CHAT_ID", "").strip(),
        "mechanic_chat_id": os.environ.get("BIKEBERI_TELEGRAM_MECHANIC_CHAT_ID", "").strip(),
    }
    if all(config.values()):
        return config
    try:
        conn = get_db()
        rows = {
            row["key"]: str(row["value"] or "").strip()
            for row in conn.execute(
                "SELECT key, value FROM settings WHERE key IN ('telegram_bot_token', 'telegram_webhook_secret', 'telegram_owner_chat_id', 'telegram_mechanic_chat_id')"
            ).fetchall()
        }
        conn.close()
    except Exception:
        rows = {}
    if not config["token"]:
        config["token"] = rows.get("telegram_bot_token", "")
    if not config["secret"]:
        config["secret"] = rows.get("telegram_webhook_secret", "")
    if not config["owner_chat_id"]:
        config["owner_chat_id"] = rows.get("telegram_owner_chat_id", "")
    if not config["mechanic_chat_id"]:
        config["mechanic_chat_id"] = rows.get("telegram_mechanic_chat_id", "")
    return config


def telegram_is_enabled(config: dict | None = None) -> bool:
    cfg = config or get_telegram_config()
    return bool(cfg["token"] and cfg["secret"] and cfg["owner_chat_id"] and cfg["mechanic_chat_id"])


def telegram_chat_role(chat_id_raw: str, config: dict | None = None) -> str:
    cfg = config or get_telegram_config()
    chat_id = str(chat_id_raw).strip()
    if chat_id == cfg["owner_chat_id"]:
        return "owner"
    if chat_id == cfg["mechanic_chat_id"]:
        return "mechanic"
    return ""


def telegram_target_chat_for_sender(sender_role: str, config: dict | None = None) -> str:
    cfg = config or get_telegram_config()
    if sender_role == "owner":
        return cfg["mechanic_chat_id"]
    if sender_role == "mechanic":
        return cfg["owner_chat_id"]
    return ""


def telegram_send_message(chat_id_raw: str, text: str, config: dict | None = None):
    cfg = config or get_telegram_config()
    chat_id = str(chat_id_raw or "").strip()
    message = str(text or "").strip()
    if not chat_id or not message or not cfg["token"]:
        return
    payload = json.dumps({"chat_id": chat_id, "text": message}).encode("utf-8")
    request = Request(
        f"https://api.telegram.org/bot{cfg['token']}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=8):
            pass
    except Exception:
        # Telegram transport is best-effort and must not break core app flow.
        return


def mirror_internal_chat_to_telegram(sender_role: str, sender_name: str, message: str):
    config = get_telegram_config()
    if not telegram_is_enabled(config):
        return
    target_chat_id = telegram_target_chat_for_sender(sender_role, config)
    if not target_chat_id:
        return
    role_label = "Управляющий" if sender_role == "owner" else "Механик"
    text = f"Байк Сервис · {role_label}\n{sender_name}\n\n{message}"
    telegram_send_message(target_chat_id, text, config)


def store_chat_message(sender_role: str, sender_name: str, message: str):
    role = str(sender_role or "").strip()
    if role not in {"owner", "mechanic"}:
        return False
    name = str(sender_name or "").strip() or ("Управляющий" if role == "owner" else "Механик")
    text = str(message or "").strip()
    if not text:
        return False
    text = text[:400]
    conn = get_db()
    conn.execute(
        """
        INSERT INTO team_chat_messages (sender_role, sender_name, message, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (role, name, text, utc_now().isoformat()),
    )
    conn.commit()
    conn.close()
    return True


def telegram_chat_id_for_role(role: str, config: dict | None = None) -> str:
    cfg = config or get_telegram_config()
    if role == "owner":
        return cfg["owner_chat_id"]
    if role == "mechanic":
        return cfg["mechanic_chat_id"]
    return ""


def telegram_notify_role(role: str, text: str, config: dict | None = None):
    cfg = config or get_telegram_config()
    if not telegram_is_enabled(cfg):
        return
    chat_id = telegram_chat_id_for_role(role, cfg)
    if not chat_id:
        return
    telegram_send_message(chat_id, text, cfg)


def get_setting_value(conn, key: str, default: str = "") -> str:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    if not row:
        return default
    return str(row["value"] or default)


def set_setting_value(conn, key: str, value: str):
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))


def inventory_alert_level(stock_value: int) -> int:
    stock = int(stock_value or 0)
    if stock <= 0:
        return 2
    if stock == 1:
        return 1
    return 0


def normalize_inventory_category(raw_value) -> str:
    category = str(raw_value or "").strip().lower()
    allowed = {"plastic", "brakes", "electrics", "motor", "suspension", "other"}
    return category if category in allowed else ""


def notify_inventory_critical_if_needed(conn, part_name: str, stock_value: int):
    part = normalize_inventory_name(part_name)
    level = inventory_alert_level(stock_value)
    setting_key = f"inventory_alert_level::{part}"
    previous_level = int(get_setting_value(conn, setting_key, "0") or "0")
    if previous_level == level:
        return
    set_setting_value(conn, setting_key, str(level))
    if level == 0:
        return
    if level == 2:
        message = f"Критичный остаток: {part} = 0. Нужна срочная закупка."
    else:
        message = f"Низкий остаток: {part} = 1. Запланируйте закупку."
    telegram_notify_role("owner", f"Байк Сервис · Склад\n\n{message}")


def is_difficult_repair(fault: str, issue: str, estimated_minutes: int, required_parts_text: str) -> bool:
    fault_text = str(fault or "").strip()
    issue_text = str(issue or "").strip()
    if not fault_text and not issue_text:
        return True
    haystack = f"{fault_text.lower()} {issue_text.lower()}"
    return bool(
        re.search(
            r"неизвестн|не\s*понятн|не\s*ясн|не\s*указ|не\s*определ|уточнит|unknown|not\s*specified",
            haystack,
        )
    )


def notify_difficult_repair_if_needed(conn, work_order_id: int, bike_code: str, fault: str, issue: str, estimated_minutes: int, required_parts_text: str):
    if not is_difficult_repair(fault, issue, estimated_minutes, required_parts_text):
        return
    setting_key = f"difficult_repair_notified::{work_order_id}"
    if get_setting_value(conn, setting_key, "0") == "1":
        return
    set_setting_value(conn, setting_key, "1")
    details = fault or issue or "сложная неисправность"
    message = (
        "Байк Сервис · Сложный ремонт\n\n"
        f"Байк: {bike_code}\n"
        f"Задача: {details}\n"
        f"План: {int(estimated_minutes or 0)} мин\n"
        "Рекомендуется контроль владельца."
    )
    telegram_notify_role("owner", message)


def supabase_bucket_candidates() -> list[str]:
    """Unique bucket names to try (env can be stale in PaaS UI; keep safe fallbacks)."""
    raw = os.environ.get("BIKEBERI_SUPABASE_BUCKET", "").strip()
    extra = os.environ.get("BIKEBERI_SUPABASE_BUCKET_FALLBACKS", "").strip()
    seen: set[str] = set()
    ordered: list[str] = []
    for part in [raw, *[x.strip() for x in extra.split(",") if x.strip()]]:
        if not part or part in seen:
            continue
        seen.add(part)
        ordered.append(part)
    for fallback in ("bikeberi-data", "bikservice-data", "bikservice - data"):
        if fallback not in seen:
            seen.add(fallback)
            ordered.append(fallback)
    return ordered


def supabase_storage_object_url_for(bucket: str, object_key: str) -> str:
    bucket_q = quote(bucket, safe="")
    obj_q = quote(object_key, safe="/")
    return f"{SUPABASE_URL}/storage/v1/object/{bucket_q}/{obj_q}"


def supabase_storage_object_url() -> str:
    bucket = _SUPABASE_ACTIVE_BUCKET or SUPABASE_BUCKET
    return supabase_storage_object_url_for(bucket, SUPABASE_DB_OBJECT)


def supabase_storage_headers(content_type: str | None = None, upsert: bool = False) -> dict:
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    if content_type:
        headers["Content-Type"] = content_type
    if upsert:
        headers["x-upsert"] = "true"
    return headers


def supabase_download_db_if_any() -> bool:
    global _SUPABASE_UPLOAD_ALLOWED, _SUPABASE_LAST_ERROR, _SUPABASE_LAST_SYNC_AT, _SUPABASE_LAST_DOWNLOAD_NOT_FOUND, _SUPABASE_ACTIVE_BUCKET
    if not SUPABASE_DB_SYNC_ENABLED:
        return False
    _SUPABASE_LAST_DOWNLOAD_NOT_FOUND = False
    _SUPABASE_ACTIVE_BUCKET = ""
    errors: list[str] = []
    saw_404 = False
    saw_non404 = False
    for bucket in supabase_bucket_candidates():
        url = supabase_storage_object_url_for(bucket, SUPABASE_DB_OBJECT)
        request = Request(url, headers=supabase_storage_headers(), method="GET")
        try:
            with urlopen(request, timeout=12) as response:
                payload = response.read()
        except HTTPError as error:
            if error.code == 404:
                saw_404 = True
                errors.append(f"{bucket}:404")
                continue
            saw_non404 = True
            errors.append(f"{bucket}:HTTP{error.code}")
            continue
        except Exception:
            saw_non404 = True
            errors.append(f"{bucket}:network")
            continue
        if not payload:
            errors.append(f"{bucket}:empty")
            saw_non404 = True
            continue
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        DB_PATH.write_bytes(payload)
        _SUPABASE_UPLOAD_ALLOWED = True
        _SUPABASE_LAST_ERROR = ""
        _SUPABASE_LAST_SYNC_AT = utc_now().isoformat()
        _SUPABASE_ACTIVE_BUCKET = bucket
        return True
    # Nothing downloaded
    # If at least one bucket returned 404 for the DB object, we can treat this as first bootstrap
    # when explicitly allowed, even if some other bucket probes returned non-404 errors.
    if saw_404:
        _SUPABASE_LAST_DOWNLOAD_NOT_FOUND = True
        if saw_non404:
            _SUPABASE_LAST_ERROR = (
                f"Supabase DB object not found in some buckets for {SUPABASE_DB_OBJECT}; "
                + "; ".join(errors[-6:])
            )
        else:
            _SUPABASE_LAST_ERROR = f"Supabase DB object not found in any bucket for {SUPABASE_DB_OBJECT}"
        if SUPABASE_ALLOW_EMPTY_BOOTSTRAP:
            _SUPABASE_UPLOAD_ALLOWED = True
    else:
        _SUPABASE_LAST_ERROR = "Supabase download failed: " + "; ".join(errors[-6:]) if errors else "Supabase download failed"
        if SUPABASE_ALLOW_EMPTY_BOOTSTRAP:
            # Recovery mode: allow service start and first upload even when all probes failed.
            _SUPABASE_UPLOAD_ALLOWED = True
    return False


def supabase_upload_db_snapshot():
    global _SUPABASE_LAST_ERROR, _SUPABASE_LAST_SYNC_AT, _SUPABASE_ACTIVE_BUCKET
    if not SUPABASE_DB_SYNC_ENABLED or not _SUPABASE_UPLOAD_ALLOWED or not DB_PATH.exists():
        return
    with _SUPABASE_SYNC_LOCK:
        payload = DB_PATH.read_bytes()
        if not payload:
            return
        # Prefer bucket that already worked; otherwise try every candidate.
        upload_buckets: list[str] = []
        for b in (_SUPABASE_ACTIVE_BUCKET, SUPABASE_BUCKET, *supabase_bucket_candidates()):
            if b and b not in upload_buckets:
                upload_buckets.append(b)
        for bucket in upload_buckets:
            url = supabase_storage_object_url_for(bucket, SUPABASE_DB_OBJECT)
            for _ in range(3):
                request = Request(
                    url,
                    data=payload,
                    headers=supabase_storage_headers(content_type="application/octet-stream", upsert=True),
                    method="POST",
                )
                try:
                    with urlopen(request, timeout=12):
                        _SUPABASE_LAST_ERROR = ""
                        _SUPABASE_LAST_SYNC_AT = utc_now().isoformat()
                        _SUPABASE_ACTIVE_BUCKET = bucket
                        return
                except Exception:
                    continue
        _SUPABASE_LAST_ERROR = "Supabase upload failed after retries"


class SyncedConnection:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def commit(self):
        self._conn.commit()
        # Never block API response on external storage sync.
        # If Supabase is slow/unavailable, requests must still succeed.
        try:
            threading.Thread(target=supabase_upload_db_snapshot, daemon=True).start()
        except Exception:
            pass

    def close(self):
        return self._conn.close()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return SyncedConnection(conn)


def ensure_db_file():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if SUPABASE_DB_SYNC_ENABLED:
        if supabase_download_db_if_any():
            return
        allow_empty_bootstrap_now = SUPABASE_ALLOW_EMPTY_BOOTSTRAP and (
            _SUPABASE_LAST_DOWNLOAD_NOT_FOUND or _SUPABASE_UPLOAD_ALLOWED
        )
        if not allow_empty_bootstrap_now:
            raise RuntimeError(
                "Supabase DB download failed. Refusing to start with empty local DB to avoid data reset. "
                "Check BIKEBERI_SUPABASE_* env and Storage object path."
            )
    if DB_PATH.exists():
        return
    # Create a clean empty DB file instead of injecting demo snapshot.
    conn = sqlite3.connect(DB_PATH)
    conn.close()


def ensure_column(cur, table: str, column: str, definition: str):
    columns = {row[1] for row in cur.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db():
    ensure_db_file()
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
            owner_note TEXT NOT NULL DEFAULT '',
            parts_ready INTEGER NOT NULL DEFAULT 0,
            completed_repair_id INTEGER,
            started_at TEXT,
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

        CREATE TABLE IF NOT EXISTS team_chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_role TEXT NOT NULL CHECK (sender_role IN ('mechanic', 'owner')),
            sender_name TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
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
    ensure_column(cur, "inventory", "category", "TEXT NOT NULL DEFAULT ''")
    ensure_column(cur, "diagnostics", "category", "TEXT")
    ensure_column(cur, "diagnostics", "fault", "TEXT")
    ensure_column(cur, "diagnostics", "severity", "TEXT")
    ensure_column(cur, "bikes", "notes", "TEXT")
    ensure_column(cur, "bikes", "last_service_at", "TEXT")
    ensure_column(cur, "work_orders", "required_parts_text", "TEXT NOT NULL DEFAULT '-'")
    ensure_column(cur, "work_orders", "planned_work", "TEXT NOT NULL DEFAULT '-'")
    ensure_column(cur, "work_orders", "priority", "TEXT NOT NULL DEFAULT 'обычный'")
    ensure_column(cur, "work_orders", "owner_note", "TEXT NOT NULL DEFAULT ''")
    ensure_column(cur, "work_orders", "parts_ready", "INTEGER NOT NULL DEFAULT 0")
    ensure_column(cur, "work_orders", "completed_repair_id", "INTEGER")
    ensure_column(cur, "work_orders", "started_at", "TEXT")
    ensure_column(cur, "work_orders", "completed_at", "TEXT")

    now = utc_now().isoformat()

    # Remove demo/test users and enforce production accounts.
    demo_usernames = ("mechanic", "owner", "Mech", "guest")
    demo_user_ids = [
        row["id"]
        for row in cur.execute(
            f"SELECT id FROM users WHERE lower(username) IN ({','.join('?' for _ in demo_usernames)})",
            tuple(name.lower() for name in demo_usernames),
        ).fetchall()
    ]
    for user_id in demo_user_ids:
        cur.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    cur.execute(
        f"DELETE FROM users WHERE lower(username) IN ({','.join('?' for _ in demo_usernames)})",
        tuple(name.lower() for name in demo_usernames),
    )

    core_users = [
        ("larionov", "Larionov2026!", "owner", "Ларионов Станислав", "Управляющий"),
        ("mesrop", "Mesrop2026!", "mechanic", "Месроп", "Механик"),
    ]
    for username, plain_password, role, full_name, position in core_users:
        row = cur.execute("SELECT id FROM users WHERE lower(username) = lower(?)", (username,)).fetchone()
        password_hash = hash_password(plain_password)
        if row:
            cur.execute(
                """
                UPDATE users
                SET password_hash = ?, role = ?, full_name = ?, position = ?, notes = COALESCE(notes, '')
                WHERE id = ?
                """,
                (password_hash, role, full_name, position, row["id"]),
            )
        else:
            cur.execute(
                """
                INSERT INTO users (username, password_hash, role, full_name, phone, telegram, position, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (username, password_hash, role, full_name, "", "", position, "", now),
            )

    if ALLOW_DEMO_SEED:
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
                    ("2026-03-31", "PE022Y", "Механик Байк Сервис", "Мотор", "Не тянет мотор", "Слабая тяга мотора, рывки при старте", "Нужна углубленная проверка контроллера и цепи питания", "Критичная", "Срочный ремонт", now),
                    ("2026-03-30", "PE017Y", "Механик Байк Сервис", "Руль и управление", "Люфт рулевой", "Чувствуется люфт в рулевой колонке", "Можно пустить в плановый ремонт в ближайшее окно", "Средняя", "Плановый ремонт", now),
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
            [
                ("total_bikes", "40"),
                ("target_rate", "95"),
                ("mechanic_focus", "оперативка"),
                ("telegram_bot_token", ""),
                ("telegram_webhook_secret", ""),
                ("telegram_owner_chat_id", ""),
                ("telegram_mechanic_chat_id", ""),
            ],
        )
    else:
        for key, value in [
            ("mechanic_focus", "оперативка"),
            ("telegram_bot_token", ""),
            ("telegram_webhook_secret", ""),
            ("telegram_owner_chat_id", ""),
            ("telegram_mechanic_chat_id", ""),
        ]:
            cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (key, value))

    # Keep historical/service/chat data intact across application updates.
    # Never run destructive startup cleanup here.

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
    if raw_cookie:
        jar = cookies.SimpleCookie()
        jar.load(raw_cookie)
        morsel = jar.get(SESSION_COOKIE)
        if morsel:
            token = unsign_token(morsel.value)
            if token:
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
                if session_row:
                    expires_at = datetime.fromisoformat(session_row["expires_at"])
                    if expires_at >= utc_now():
                        user = serialize_user(session_row)
                        conn.close()
                        return user
                    conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
                    conn.commit()
                conn.close()

    return None


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


def validate_bike_status(raw_value: str, role: str = "mechanic") -> str:
    status = str(raw_value or "").strip()
    allowed = MECHANIC_BIKE_STATUS_OPTIONS if role == "mechanic" else BIKE_STATUS_OPTIONS
    if status not in allowed:
        raise ValueError("Указан недопустимый статус байка")
    return status


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
    source = str(raw_value).strip()
    normalized_source = re.sub(r"[\s\.\,\!\?\-_:;]+", " ", source.lower()).strip()
    no_parts_phrases = (
        "не нужны",
        "запчасти не нужны",
        "не требуется",
        "не требуются",
        "запчасти не требуются",
        "без запчастей",
        "запчасти не нужны для ремонта",
    )
    if any(phrase in normalized_source for phrase in no_parts_phrases):
        return parts
    for chunk in source.split(","):
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
            work_orders.owner_note,
            work_orders.parts_ready,
            work_orders.started_at,
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
        order["can_start"] = order["status"] in {"принят", "диагностика", "ждет запчасти"} and not missing_parts
        order["can_mark_ready"] = order["status"] == "в ремонте"
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
        "SELECT id, name, stock, min, reserved, category FROM inventory ORDER BY name COLLATE NOCASE ASC"
    ).fetchall():
        item = dict(row)
        item["available"] = max(int(item["stock"]) - int(item["reserved"] or 0), 0)
        item["need_to_order"] = item["available"] <= item["min"]
        inventory.append(item)
    bikes = [
        dict(row)
        for row in conn.execute(
            """
            SELECT
                bikes.id,
                bikes.code,
                bikes.model,
                bikes.status,
                bikes.notes,
                bikes.last_service_at,
                (
                    SELECT repairs.date
                    FROM repairs
                    WHERE repairs.bike = bikes.code
                    ORDER BY repairs.date DESC, repairs.id DESC
                    LIMIT 1
                ) AS latest_repair_date,
                (
                    SELECT repairs.issue
                    FROM repairs
                    WHERE repairs.bike = bikes.code
                    ORDER BY repairs.date DESC, repairs.id DESC
                    LIMIT 1
                ) AS latest_repair_issue
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
    team_chat = [
        dict(row)
        for row in conn.execute(
            """
            SELECT id, sender_role, sender_name, message, created_at
            FROM team_chat_messages
            ORDER BY id DESC
            LIMIT 60
            """
        ).fetchall()
    ]
    team_chat.reverse()
    owner_notifications = []
    for order in work_orders:
        for missing in order.get("missing_parts", []):
            owner_notifications.append(
                {
                    "type": "work_order",
                    "severity": "high",
                    "text": f"{order['bike_code']}: не хватает {missing['name']} x{missing['missing']}",
                    "created_at": order.get("intake_date") or order.get("created_at") or utc_now().isoformat(),
                }
            )
    for item in inventory:
        if item["need_to_order"]:
            owner_notifications.append(
                {
                    "type": "inventory",
                    "severity": "medium",
                    "text": f"{item['name']}: остаток {item['stock']} (мин. {item['min']})",
                    "created_at": utc_now().isoformat(),
                }
            )
    conn.close()

    return {
        "user": user,
        "kpi": {
            "totalBikes": int(settings.get("total_bikes", "40")),
            "targetRate": int(settings.get("target_rate", "95")),
            "mechanicFocus": str(settings.get("mechanic_focus", "оперативка")),
        },
        "bikes": bikes,
        "repairs": repairs,
        "inventory": inventory,
        "diagnostics": diagnostics,
        "workOrders": work_orders,
        "teamChat": team_chat,
        "ownerNotifications": owner_notifications[:80],
    }


def build_storage_health_payload() -> dict:
    db_exists = DB_PATH.exists()
    db_size = DB_PATH.stat().st_size if db_exists else 0
    return {
        "dbPath": str(DB_PATH),
        "dbExists": db_exists,
        "dbSizeBytes": db_size,
        "supabaseSyncEnabled": SUPABASE_DB_SYNC_ENABLED,
        "supabaseBucket": SUPABASE_BUCKET,
        "supabaseObject": SUPABASE_DB_OBJECT,
        "allowEmptyBootstrap": SUPABASE_ALLOW_EMPTY_BOOTSTRAP,
        "uploadAllowed": _SUPABASE_UPLOAD_ALLOWED,
        "activeBucket": _SUPABASE_ACTIVE_BUCKET,
        "bucketCandidates": supabase_bucket_candidates(),
        "lastDownloadNotFound": _SUPABASE_LAST_DOWNLOAD_NOT_FOUND,
        "lastSyncAt": _SUPABASE_LAST_SYNC_AT,
        "lastError": _SUPABASE_LAST_ERROR,
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
        if parsed.path == "/logo_blue.svg":
            return self.serve_file("logo_blue.svg", "image/svg+xml; charset=utf-8", cache_control="public, max-age=31536000, immutable")
        if parsed.path == "/logo_orange.png":
            return self.serve_file("logo_orange.png", "image/png", cache_control="public, max-age=31536000, immutable")
        if parsed.path == "/2F25FE4D-B350-43A7-BFFF-71027B2F4466.PNG":
            return self.serve_file(
                "2F25FE4D-B350-43A7-BFFF-71027B2F4466.PNG",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
            )
        if parsed.path == "/icon-192.png":
            return self.serve_file("icon-192.png", "image/png", cache_control="public, max-age=31536000, immutable")
        if parsed.path == "/icon-192-v2.png":
            return self.serve_file("icon-192-v2.png", "image/png", cache_control="public, max-age=31536000, immutable")
        if parsed.path == "/icon-192-v3.png":
            return self.serve_file("icon-192-v3.png", "image/png", cache_control="public, max-age=31536000, immutable")
        if parsed.path == "/icon-512.png":
            return self.serve_file("icon-512.png", "image/png", cache_control="public, max-age=31536000, immutable")
        if parsed.path == "/icon-512-v2.png":
            return self.serve_file("icon-512-v2.png", "image/png", cache_control="public, max-age=31536000, immutable")
        if parsed.path == "/icon-512-v3.png":
            return self.serve_file("icon-512-v3.png", "image/png", cache_control="public, max-age=31536000, immutable")
        if parsed.path == "/apple-touch-icon.png":
            return self.serve_file("apple-touch-icon.png", "image/png", cache_control="public, max-age=31536000, immutable")
        if parsed.path == "/apple-touch-icon-v2.png":
            return self.serve_file("apple-touch-icon-v2.png", "image/png", cache_control="public, max-age=31536000, immutable")
        if parsed.path == "/apple-touch-icon-v3.png":
            return self.serve_file("apple-touch-icon-v3.png", "image/png", cache_control="public, max-age=31536000, immutable")
        if parsed.path == "/bike-scooter.svg":
            return self.serve_file("bike-scooter.svg", "image/svg+xml; charset=utf-8", cache_control="public, max-age=31536000, immutable")
        if parsed.path == "/favicon.ico":
            return self.serve_file(
                "icon-192-v3.png",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
            )
        if parsed.path == "/site.webmanifest":
            return self.serve_file(
                "site.webmanifest",
                "application/manifest+json; charset=utf-8",
                cache_control="public, max-age=86400",
            )
        if parsed.path == "/api/bootstrap":
            user = require_auth(self)
            if not user:
                return
            return json_response(self, 200, fetch_bootstrap_payload(user))
        if parsed.path == "/api/system/storage-health":
            user = require_role(self, {"owner"})
            if not user:
                return
            return json_response(self, 200, build_storage_health_payload())

        return text_response(self, 404, "Not found")

    def do_HEAD(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            return self.serve_index(send_body=False)
        if parsed.path == "/styles.css":
            return self.serve_file(
                "styles.css",
                "text/css; charset=utf-8",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/script.js":
            return self.serve_file(
                "script.js",
                "application/javascript; charset=utf-8",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/logo_blue.svg":
            return self.serve_file(
                "logo_blue.svg",
                "image/svg+xml; charset=utf-8",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/logo_orange.png":
            return self.serve_file(
                "logo_orange.png",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/2F25FE4D-B350-43A7-BFFF-71027B2F4466.PNG":
            return self.serve_file(
                "2F25FE4D-B350-43A7-BFFF-71027B2F4466.PNG",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/icon-192.png":
            return self.serve_file(
                "icon-192.png",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/icon-192-v2.png":
            return self.serve_file(
                "icon-192-v2.png",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/icon-192-v3.png":
            return self.serve_file(
                "icon-192-v3.png",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/icon-512.png":
            return self.serve_file(
                "icon-512.png",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/icon-512-v2.png":
            return self.serve_file(
                "icon-512-v2.png",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/icon-512-v3.png":
            return self.serve_file(
                "icon-512-v3.png",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/apple-touch-icon.png":
            return self.serve_file(
                "apple-touch-icon.png",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/apple-touch-icon-v2.png":
            return self.serve_file(
                "apple-touch-icon-v2.png",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/apple-touch-icon-v3.png":
            return self.serve_file(
                "apple-touch-icon-v3.png",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/bike-scooter.svg":
            return self.serve_file(
                "bike-scooter.svg",
                "image/svg+xml; charset=utf-8",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/favicon.ico":
            return self.serve_file(
                "icon-192-v3.png",
                "image/png",
                cache_control="public, max-age=31536000, immutable",
                send_body=False,
            )
        if parsed.path == "/site.webmanifest":
            return self.serve_file(
                "site.webmanifest",
                "application/manifest+json; charset=utf-8",
                cache_control="public, max-age=86400",
                send_body=False,
            )
        if parsed.path == "/api/bootstrap":
            user = require_auth(self)
            if not user:
                return
            payload = json.dumps(fetch_bootstrap_payload(user), ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            send_security_headers(self)
            self.end_headers()
            return

        self.send_response(404)
        self.send_header("Content-Length", "0")
        send_security_headers(self)
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path.startswith("/api/telegram/webhook/"):
            config = get_telegram_config()
            if not telegram_is_enabled(config):
                return text_response(self, 404, "Not found")
            provided_secret = parsed.path.rsplit("/", 1)[-1].strip()
            if not provided_secret or provided_secret != config["secret"]:
                return text_response(self, 403, "Forbidden")
            payload = read_json(self)
            message_obj = payload.get("message") or payload.get("edited_message") or {}
            text = str(message_obj.get("text", "")).strip()
            chat_id = str((message_obj.get("chat") or {}).get("id", "")).strip()
            if not text or not chat_id:
                return json_response(self, 200, {"ok": True})
            sender_role = telegram_chat_role(chat_id, config)
            if not sender_role:
                return json_response(self, 200, {"ok": True})
            sender_name = "Управляющий" if sender_role == "owner" else "Механик"
            if store_chat_message(sender_role, sender_name, text):
                return json_response(self, 200, {"ok": True})
            return json_response(self, 400, {"error": "Сообщение не сохранено"})

        if parsed.path == "/api/telegram/webhook/register":
            user = require_role(self, {"owner"})
            if not user:
                return
            config = get_telegram_config()
            if not telegram_is_enabled(config):
                return json_response(self, 400, {"error": "Сначала заполните Telegram настройки"})
            host = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or ""
            if not host:
                return json_response(self, 400, {"error": "Не удалось определить хост для webhook"})
            webhook_url = f"https://{host}/api/telegram/webhook/{config['secret']}"
            payload = json.dumps({"url": webhook_url}).encode("utf-8")
            request = Request(
                f"https://api.telegram.org/bot{config['token']}/setWebhook",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urlopen(request, timeout=10) as response:
                    telegram_result = json.loads(response.read().decode("utf-8"))
            except Exception:
                return json_response(self, 502, {"error": "Не удалось зарегистрировать webhook в Telegram"})
            return json_response(self, 200, {"ok": True, "webhookUrl": webhook_url, "telegram": telegram_result})

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
            if not name:
                return json_response(self, 400, {"error": "Название запчасти обязательно"})

            try:
                stock = int(stock)
            except (TypeError, ValueError):
                return json_response(self, 400, {"error": "Остаток должен быть числом"})
            minimum = 1
            category = normalize_inventory_category(payload.get("category"))

            conn = get_db()
            existing = conn.execute(
                "SELECT id, stock, category FROM inventory WHERE name = ?",
                (name,),
            ).fetchone()
            if existing:
                next_category = category or str(existing["category"] or "")
                conn.execute(
                    "UPDATE inventory SET stock = ?, min = ?, category = ?, updated_at = ? WHERE id = ?",
                    (stock, minimum, next_category, utc_now().isoformat(), existing["id"]),
                )
                notify_inventory_critical_if_needed(conn, name, stock)
            else:
                conn.execute(
                    "INSERT INTO inventory (name, stock, min, category, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (name, stock, minimum, category, utc_now().isoformat()),
                )
                notify_inventory_critical_if_needed(conn, name, stock)
            conn.commit()
            conn.close()
            return json_response(self, 201, {"ok": True})

        if parsed.path == "/api/bikes":
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            payload = read_json(self)
            try:
                code = validate_bike_code(payload.get("code", ""))
                status = validate_bike_status(payload.get("status", ""), user["role"])
            except ValueError as error:
                return json_response(self, 400, {"error": str(error)})

            model = str(payload.get("model", "")).strip() or "Wenbox U2"
            notes = str(payload.get("notes", "")).strip()
            conn = get_db()
            exists = conn.execute("SELECT id FROM bikes WHERE code = ?", (code,)).fetchone()
            if exists:
                conn.close()
                return json_response(self, 400, {"error": "Байк с таким номером уже существует"})
            conn.execute(
                """
                INSERT INTO bikes (code, model, status, notes, last_service_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (code, model, status, notes, None, utc_now().isoformat(), utc_now().isoformat()),
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
            required_parts_text = ", ".join(f"{name}:{qty}" for name, qty in required_parts) or "-"
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
            notify_difficult_repair_if_needed(
                conn,
                int(work_order_id),
                bike_code,
                str(payload.get("fault", "")).strip(),
                str(payload.get("symptoms", "")).strip(),
                estimated_minutes,
                required_parts_text,
            )
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

        if parsed.path == "/api/team-chat":
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            payload = read_json(self)
            message = str(payload.get("message", "")).strip()
            if not message:
                return json_response(self, 400, {"error": "Сообщение пустое"})
            if len(message) > 400:
                return json_response(self, 400, {"error": "Сообщение должно быть до 400 символов"})
            if not store_chat_message(user["role"], user["full_name"], message):
                return json_response(self, 400, {"error": "Сообщение не сохранено"})
            mirror_internal_chat_to_telegram(user["role"], user["full_name"], message)
            return json_response(self, 201, {"ok": True})

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
                       estimated_minutes, required_parts_text, planned_work, completed_repair_id, started_at
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
                if order["status"] not in {"принят", "диагностика", "ждет запчасти"}:
                    conn.close()
                    return json_response(self, 400, {"error": "Эту заявку сейчас нельзя запустить в ремонт"})
                if not reservation["all_reserved"]:
                    conn.close()
                    return json_response(self, 400, {"error": "Не все запчасти в наличии"})
                next_status = "в ремонте"
                started_at = utc_now().isoformat()
                eta = (utc_now() + timedelta(minutes=int(order["estimated_minutes"] or 0))).isoformat()
                conn.execute(
                    "UPDATE work_orders SET status = ?, parts_ready = 1, started_at = ?, estimated_ready_at = ? WHERE id = ?",
                    (next_status, started_at, eta, work_order_id),
                )
                set_bike_status(conn, order["bike_id"], next_status)
                add_work_order_history(
                    conn,
                    int(work_order_id),
                    user["full_name"],
                    "status",
                    f"Механик начал ремонт, таймер запущен на {int(order['estimated_minutes'] or 0)} мин",
                )

            elif action == "mark_ready":
                if order["status"] != "в ремонте":
                    conn.close()
                    return json_response(self, 400, {"error": "Сначала нужно начать ремонт"})
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
                    updated_item = conn.execute(
                        "SELECT stock FROM inventory WHERE name = ?",
                        (part["part_name"],),
                    ).fetchone()
                    current_stock = int(updated_item["stock"] or 0) if updated_item else 0
                    notify_inventory_critical_if_needed(conn, part["part_name"], current_stock)
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
                next_status = "проверка"
                conn.execute(
                    "UPDATE work_orders SET status = ?, completed_repair_id = ?, completed_at = ?, parts_ready = 1 WHERE id = ?",
                    (next_status, repair_id, utc_now().isoformat(), work_order_id),
                )
                conn.execute(
                    "UPDATE bikes SET status = ?, last_service_at = ?, updated_at = ? WHERE id = ?",
                    ("проверка", utc_now().date().isoformat(), utc_now().isoformat(), order["bike_id"]),
                )
                add_work_order_history(
                    conn,
                    int(work_order_id),
                    user["full_name"],
                    "status",
                    "Ремонт завершен, требуется пройти чек-лист выдачи",
                )

            elif action == "complete_checklist":
                if order["status"] != "проверка":
                    conn.close()
                    return json_response(self, 400, {"error": "Сначала завершите ремонт и переведите байк на выдачу"})
                next_status = "готов"
                conn.execute(
                    "UPDATE work_orders SET status = ?, completed_at = ?, parts_ready = 1 WHERE id = ?",
                    (next_status, utc_now().isoformat(), work_order_id),
                )
                conn.execute(
                    "UPDATE bikes SET status = ?, last_service_at = ?, updated_at = ? WHERE id = ?",
                    ("готов", utc_now().date().isoformat(), utc_now().isoformat(), order["bike_id"]),
                )
                add_work_order_history(
                    conn,
                    int(work_order_id),
                    user["full_name"],
                    "issue_checklist",
                    "Чек-лист выдачи пройден, байк готов к выдаче",
                )
            else:
                conn.close()
                return json_response(self, 400, {"error": "Неизвестное действие"})

            conn.commit()
            conn.close()
            return json_response(self, 200, {"ok": True, "status": next_status})

        if parsed.path == "/api/owner/assign-priority":
            user = require_role(self, {"owner"})
            if not user:
                return
            payload = read_json(self)
            try:
                bike_code = validate_bike_code(payload.get("bikeCode", ""))
            except ValueError as error:
                return json_response(self, 400, {"error": str(error)})
            priority = str(payload.get("priority", "")).strip().lower()
            if priority not in {"высокий", "обычный", "низкий"}:
                return json_response(self, 400, {"error": "Приоритет должен быть: высокий, обычный или низкий"})
            owner_note = str(payload.get("ownerNote", "")).strip()
            if len(owner_note) > 220:
                return json_response(self, 400, {"error": "Комментарий владельца должен быть до 220 символов"})
            conn = get_db()
            row = conn.execute(
                """
                SELECT work_orders.id
                FROM work_orders
                JOIN bikes ON bikes.id = work_orders.bike_id
                WHERE bikes.code = ? AND work_orders.status != 'готов'
                ORDER BY work_orders.id DESC
                LIMIT 1
                """,
                (bike_code,),
            ).fetchone()
            if not row:
                conn.close()
                return json_response(self, 404, {"error": "Активная сервисная заявка для этого байка не найдена"})
            conn.execute(
                "UPDATE work_orders SET priority = ?, owner_note = ? WHERE id = ?",
                (priority, owner_note, row["id"]),
            )
            note = f"Владелец поставил приоритет: {priority}"
            if owner_note:
                note += f". Комментарий: {owner_note}"
            add_work_order_history(conn, int(row["id"]), user["full_name"], "owner_priority", note)
            conn.commit()
            conn.close()
            return json_response(self, 200, {"ok": True})

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
            except ValueError as error:
                return json_response(self, 400, {"error": str(error)})
            minimum = 1
            category = normalize_inventory_category(payload.get("category"))

            conn = get_db()
            conn.execute(
                "UPDATE inventory SET name = ?, stock = ?, min = ?, category = ?, updated_at = ? WHERE id = ?",
                (name, stock, minimum, category, utc_now().isoformat(), inventory_id),
            )
            notify_inventory_critical_if_needed(conn, name, stock)
            conn.commit()
            conn.close()
            return json_response(self, 200, {"ok": True})

        if parsed.path.startswith("/api/bikes/"):
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            bike_id = parsed.path.rsplit("/", 1)[-1]
            payload = read_json(self)
            try:
                code = validate_bike_code(payload.get("code", ""))
                status = validate_bike_status(payload.get("status", ""), user["role"])
            except ValueError as error:
                return json_response(self, 400, {"error": str(error)})

            model = str(payload.get("model", "")).strip() or "Wenbox U2"
            notes = str(payload.get("notes", "")).strip()

            conn = get_db()
            duplicate = conn.execute(
                "SELECT id FROM bikes WHERE code = ? AND id != ?",
                (code, bike_id),
            ).fetchone()
            if duplicate:
                conn.close()
                return json_response(self, 400, {"error": "Байк с таким номером уже существует"})

            conn.execute(
                """
                UPDATE bikes
                SET code = ?, model = ?, status = ?, notes = ?, updated_at = ?
                WHERE id = ?
                """,
                (code, model, status, notes, utc_now().isoformat(), bike_id),
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
            mechanic_focus = str(payload.get("mechanicFocus", "оперативка")).strip() or "оперативка"
            if len(mechanic_focus) > 80:
                return json_response(self, 400, {"error": "Фокус механика должен быть до 80 символов"})

            conn = get_db()
            conn.execute("UPDATE settings SET value = ? WHERE key = 'total_bikes'", (str(total_bikes),))
            conn.execute("UPDATE settings SET value = ? WHERE key = 'target_rate'", (str(target_rate),))
            conn.execute("UPDATE settings SET value = ? WHERE key = 'mechanic_focus'", (mechanic_focus,))
            conn.commit()
            conn.close()
            return json_response(self, 200, {"ok": True})

        if parsed.path == "/api/telegram/settings":
            user = require_role(self, {"owner"})
            if not user:
                return
            payload = read_json(self)
            token = str(payload.get("botToken", "")).strip()
            webhook_secret = str(payload.get("webhookSecret", "")).strip()
            owner_chat_id = str(payload.get("ownerChatId", "")).strip()
            mechanic_chat_id = str(payload.get("mechanicChatId", "")).strip()
            if not token or ":" not in token:
                return json_response(self, 400, {"error": "Некорректный BOT token"})
            if len(webhook_secret) < 12:
                return json_response(self, 400, {"error": "Webhook secret должен быть не короче 12 символов"})
            if not owner_chat_id or not owner_chat_id.lstrip("-").isdigit():
                return json_response(self, 400, {"error": "ownerChatId должен быть числом"})
            if not mechanic_chat_id or not mechanic_chat_id.lstrip("-").isdigit():
                return json_response(self, 400, {"error": "mechanicChatId должен быть числом"})
            conn = get_db()
            for key, value in [
                ("telegram_bot_token", token),
                ("telegram_webhook_secret", webhook_secret),
                ("telegram_owner_chat_id", owner_chat_id),
                ("telegram_mechanic_chat_id", mechanic_chat_id),
            ]:
                conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
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

        if parsed.path.startswith("/api/bikes/"):
            user = require_role(self, {"mechanic", "owner"})
            if not user:
                return
            bike_id = parsed.path.rsplit("/", 1)[-1]
            conn = get_db()
            order_ids = [
                row["id"]
                for row in conn.execute(
                    "SELECT id FROM work_orders WHERE bike_id = ?",
                    (bike_id,),
                ).fetchall()
            ]
            for work_order_id in order_ids:
                conn.execute("DELETE FROM work_order_history WHERE work_order_id = ?", (work_order_id,))
                conn.execute("DELETE FROM work_order_parts WHERE work_order_id = ?", (work_order_id,))
            conn.execute("DELETE FROM work_orders WHERE bike_id = ?", (bike_id,))
            conn.execute("DELETE FROM bikes WHERE id = ?", (bike_id,))
            conn.commit()
            conn.close()
            return json_response(self, 200, {"ok": True})

        return text_response(self, 404, "Not found")

    def serve_index(self, send_body: bool = True):
        path = BASE_DIR / "index.html"
        if not path.exists():
            return text_response(self, 404, "Not found")
        data = (
            path.read_text(encoding="utf-8")
            .replace("./styles.css", f"./styles.css?v={get_asset_version('styles.css')}")
            .replace("./script.js", f"./script.js?v={get_asset_version('script.js')}")
            .replace("./logo_orange.png", f"./logo_orange.png?v={get_asset_version('logo_orange.png')}")
            .replace(
                "./2F25FE4D-B350-43A7-BFFF-71027B2F4466.PNG",
                f"./2F25FE4D-B350-43A7-BFFF-71027B2F4466.PNG?v={get_asset_version('2F25FE4D-B350-43A7-BFFF-71027B2F4466.PNG')}",
            )
            .replace("/icon-192.png", f"/icon-192.png?v={get_asset_version('icon-192.png')}")
            .replace("/icon-512.png", f"/icon-512.png?v={get_asset_version('icon-512.png')}")
            .replace("/apple-touch-icon.png", f"/apple-touch-icon.png?v={get_asset_version('apple-touch-icon.png')}")
            .replace("/icon-192-v2.png", f"/icon-192-v2.png?v={get_asset_version('icon-192-v2.png')}")
            .replace("/icon-512-v2.png", f"/icon-512-v2.png?v={get_asset_version('icon-512-v2.png')}")
            .replace("/apple-touch-icon-v2.png", f"/apple-touch-icon-v2.png?v={get_asset_version('apple-touch-icon-v2.png')}")
            .replace("/icon-192-v3.png", f"/icon-192-v3.png?v={get_asset_version('icon-192-v3.png')}")
            .replace("/icon-512-v3.png", f"/icon-512-v3.png?v={get_asset_version('icon-512-v3.png')}")
            .replace("/apple-touch-icon-v3.png", f"/apple-touch-icon-v3.png?v={get_asset_version('apple-touch-icon-v3.png')}")
            .replace(
                "/2F25FE4D-B350-43A7-BFFF-71027B2F4466.PNG",
                f"/2F25FE4D-B350-43A7-BFFF-71027B2F4466.PNG?v={get_asset_version('2F25FE4D-B350-43A7-BFFF-71027B2F4466.PNG')}",
            )
            .encode("utf-8")
        )
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        send_security_headers(self)
        self.end_headers()
        if send_body:
            self.wfile.write(data)

    def serve_file(self, filename, content_type, cache_control="no-store", send_body: bool = True):
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
        if send_body:
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
