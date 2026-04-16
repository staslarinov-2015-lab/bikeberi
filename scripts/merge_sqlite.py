#!/usr/bin/env python3
"""
Merge business data from an old SQLite (e.g. Railway app.db) into a target DB (e.g. Render).

Default: delete business rows on TARGET, then INSERT … SELECT from attached SOURCE.
Keeps users on the target (passwords stay as on the new site) unless --copy-users.

Example (local machine, after downloading both app.db files):
  python3 scripts/merge_sqlite.py --from railway-app.db --to render-app.db

Then replace the database file on Render with the merged `render-app.db` (same path as BIKEBERI_DB_PATH).
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path


BUSINESS_TABLES_ORDER_DELETE = (
    "work_order_history",
    "work_order_parts",
    "work_orders",
    "diagnostics",
    "repairs",
    "inventory",
    "bikes",
)

BUSINESS_TABLES_ORDER_INSERT = (
    "bikes",
    "inventory",
    "repairs",
    "diagnostics",
    "work_orders",
    "work_order_parts",
    "work_order_history",
)


def table_columns(conn: sqlite3.Connection, schema: str, table: str) -> list[str]:
    rows = conn.execute(f'PRAGMA {schema}.table_info("{table}")').fetchall()
    return [str(r[1]) for r in rows]


def quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def copy_table(conn: sqlite3.Connection, table: str) -> int:
    main_cols = table_columns(conn, "main", table)
    src_cols = set(table_columns(conn, "src", table))
    common = [c for c in main_cols if c in src_cols]
    if not common:
        print(f"  skip {table}: no overlapping columns", file=sys.stderr)
        return 0
    n = conn.execute(f"SELECT COUNT(*) FROM src.{quote_ident(table)}").fetchone()[0]
    cols_sql = ", ".join(quote_ident(c) for c in common)
    conn.execute(
        f"INSERT INTO main.{quote_ident(table)} ({cols_sql}) SELECT {cols_sql} FROM src.{quote_ident(table)}"
    )
    return int(n)


def bump_sqlite_sequence(conn: sqlite3.Connection, table: str) -> None:
    try:
        row = conn.execute(f"SELECT MAX(id) AS m FROM main.{quote_ident(table)}").fetchone()
    except sqlite3.OperationalError:
        return
    max_id = row["m"] if isinstance(row, sqlite3.Row) else row[0]
    if max_id is None:
        return
    try:
        conn.execute(
            "INSERT OR REPLACE INTO sqlite_sequence(name, seq) VALUES (?, ?)",
            (table, int(max_id)),
        )
    except sqlite3.OperationalError:
        pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge BikeBeri SQLite business data (Railway → Render).")
    parser.add_argument("--from", dest="source", required=True, type=Path, help="Path to source app.db (Railway export)")
    parser.add_argument("--to", dest="target", required=True, type=Path, help="Path to target app.db (Render export)")
    parser.add_argument(
        "--copy-users",
        action="store_true",
        help="Replace users on target with rows from source (copies password hashes from old DB).",
    )
    parser.add_argument(
        "--copy-settings",
        action="store_true",
        help="Replace settings on target with rows from source.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print plan only; target file is not modified")
    args = parser.parse_args()

    if not args.source.is_file():
        print(f"Source not found: {args.source}", file=sys.stderr)
        return 2
    if not args.target.is_file():
        print(f"Target not found: {args.target}", file=sys.stderr)
        return 2

    if args.dry_run:
        print("Dry run: connect to target, list row counts from source (no writes).")
        conn = sqlite3.connect(args.target)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute(f"ATTACH DATABASE ? AS src", (str(args.source.resolve()),))
            for table in BUSINESS_TABLES_ORDER_INSERT:
                try:
                    n = conn.execute(f"SELECT COUNT(*) AS c FROM src.{quote_ident(table)}").fetchone()["c"]
                    print(f"  src.{table}: {n} rows")
                except sqlite3.OperationalError as exc:
                    print(f"  src.{table}: (skip) {exc}", file=sys.stderr)
        finally:
            conn.close()
        return 0

    conn = sqlite3.connect(args.target)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA foreign_keys = OFF")
        conn.execute("ATTACH DATABASE ? AS src", (str(args.source.resolve()),))

        print("Clearing sessions on target…")
        conn.execute("DELETE FROM main.sessions")

        print("Deleting business rows on target…")
        for table in BUSINESS_TABLES_ORDER_DELETE:
            conn.execute(f"DELETE FROM main.{quote_ident(table)}")

        if args.copy_users:
            print("Replacing users on target from source…")
            conn.execute("DELETE FROM main.users")
            n = copy_table(conn, "users")
            print(f"  users: {n} rows")
            bump_sqlite_sequence(conn, "users")

        if args.copy_settings:
            print("Replacing settings on target from source…")
            conn.execute("DELETE FROM main.settings")
            n = copy_table(conn, "settings")
            print(f"  settings: {n} rows")

        print("Copying business tables from source → target…")
        for table in BUSINESS_TABLES_ORDER_INSERT:
            n = copy_table(conn, table)
            print(f"  {table}: {n} rows")
            bump_sqlite_sequence(conn, table)

        conn.commit()
        print("Done. Upload this target file to your server and restart the app if needed.")
        return 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
