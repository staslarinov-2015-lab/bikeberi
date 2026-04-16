BEGIN TRANSACTION;
CREATE TABLE bikes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            model TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            last_service_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
INSERT INTO "bikes" VALUES(1,'PE001Y','Wenbox U2','в аренде','',NULL,'2026-03-31T19:47:00.475642+00:00','2026-04-01T08:03:05.200466+00:00');
INSERT INTO "bikes" VALUES(2,'PE014Y','Wenbox U2','в аренде','',NULL,'2026-03-31T19:47:00.475642+00:00','2026-04-01T08:03:05.200466+00:00');
INSERT INTO "bikes" VALUES(3,'PE017Y','Wenbox U2','готов','',NULL,'2026-03-31T19:47:00.475642+00:00','2026-04-01T08:03:05.200466+00:00');
INSERT INTO "bikes" VALUES(4,'PE022Y','Wenbox U2','готов','',NULL,'2026-03-31T19:47:00.475642+00:00','2026-04-01T08:03:05.200466+00:00');
CREATE TABLE diagnostics (
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
CREATE TABLE inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            stock INTEGER NOT NULL,
            min INTEGER NOT NULL
        , updated_at TEXT, reserved INTEGER NOT NULL DEFAULT 0);
INSERT INTO "inventory" VALUES(1,'Колодки',10,5,'2026-04-01T08:03:05.200466+00:00',0);
INSERT INTO "inventory" VALUES(2,'Камеры',2,5,'2026-04-01T08:03:05.200466+00:00',0);
INSERT INTO "inventory" VALUES(3,'Покрышки',6,4,'2026-04-01T08:03:05.200466+00:00',0);
INSERT INTO "inventory" VALUES(4,'Контроллер',1,2,'2026-04-01T08:03:05.200466+00:00',0);
CREATE TABLE repairs (
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
CREATE TABLE sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
INSERT INTO "sessions" VALUES(1,1,'Fia_csWxg0L0wA3io5E5O6mfBDg3QPzt_lG8Ju9JDf0','2026-04-14T13:40:34.212057+00:00','2026-03-31T13:40:34.212143+00:00');
INSERT INTO "sessions" VALUES(2,1,'dBPEaP0u5hK7gZ6S0Qv7VkE5ivj78ZyI3_L5Z3wA5Go','2026-04-14T13:41:19.634543+00:00','2026-03-31T13:41:19.634780+00:00');
CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
INSERT INTO "settings" VALUES('total_bikes','40');
INSERT INTO "settings" VALUES('target_rate','95');
INSERT INTO "settings" VALUES('service_history_reset_v1','2026-04-01T08:03:05.200466+00:00');
CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('mechanic', 'owner')),
            full_name TEXT NOT NULL
        , created_at TEXT, phone TEXT, telegram TEXT, position TEXT, notes TEXT);
INSERT INTO "users" VALUES(1,'mechanic','pbkdf2_sha256$310000$ruMiN2RWCB1RNYT0DMUW/A==$zK8CBLrxxVJAKTDXEa9Xg6Ukemim5JyyhcCEI1JYTYA=','mechanic','Механик BikeBeri',NULL,NULL,NULL,NULL,NULL);
INSERT INTO "users" VALUES(2,'owner','pbkdf2_sha256$310000$AtiViyfeaXCr7B9wLI86oQ==$ACEUEoQEsVPt7htzNmHlP2bc4s46NlPHghofrgvNnRE=','owner','Собственник BikeBeri',NULL,NULL,NULL,NULL,NULL);
INSERT INTO "users" VALUES(3,'Mech','pbkdf2_sha256$310000$8PCXp2soeAHCWKobyPknvw==$kaQ7ADPLyXekgvbhN4wty5mOOu6GjdxUi8aJ5KhaxfM=','mechanic','Вяткин Даниил Антонович','2026-04-03T10:27:29.996294+00:00','','','Механик','');
CREATE TABLE work_order_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            work_order_id INTEGER NOT NULL,
            actor_name TEXT NOT NULL,
            event_type TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
        );
CREATE TABLE work_order_parts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            work_order_id INTEGER NOT NULL,
            part_name TEXT NOT NULL,
            qty_required INTEGER NOT NULL DEFAULT 1,
            qty_reserved INTEGER NOT NULL DEFAULT 0,
            qty_used INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
        );
CREATE TABLE work_orders (
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
            completed_at TEXT, started_at TEXT,
            FOREIGN KEY (bike_id) REFERENCES bikes(id),
            FOREIGN KEY (diagnostic_id) REFERENCES diagnostics(id)
        );
DELETE FROM "sqlite_sequence";
INSERT INTO "sqlite_sequence" VALUES('users',3);
INSERT INTO "sqlite_sequence" VALUES('repairs',5);
INSERT INTO "sqlite_sequence" VALUES('inventory',4);
INSERT INTO "sqlite_sequence" VALUES('sessions',2);
INSERT INTO "sqlite_sequence" VALUES('diagnostics',2);
INSERT INTO "sqlite_sequence" VALUES('bikes',4);
INSERT INTO "sqlite_sequence" VALUES('work_orders',2);
INSERT INTO "sqlite_sequence" VALUES('work_order_parts',2);
INSERT INTO "sqlite_sequence" VALUES('work_order_history',2);
COMMIT;
