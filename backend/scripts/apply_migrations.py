#!/usr/bin/env python3
"""Apply all SQL migrations in lexicographic order and verify the learned curriculum baseline."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import sys
from pathlib import Path
from urllib.parse import urlparse

import asyncpg

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.core.config import settings


def get_connection_url() -> str:
    value = settings.DIRECT_URL or settings.DATABASE_URL
    if not value:
        raise ValueError("Neither DIRECT_URL nor DATABASE_URL is configured.")
    value = value.replace("postgresql+asyncpg://", "postgresql://", 1)
    value = value.replace("postgresql+psycopg2://", "postgresql://", 1)
    value = value.replace("postgresql+psycopg://", "postgresql://", 1)
    return value


async def ensure_schema_migrations_table(conn: asyncpg.Connection) -> None:
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )


async def apply_migration_files(conn: asyncpg.Connection, migration_dir: Path) -> None:
    files = sorted(migration_dir.glob("*.sql"), key=lambda p: p.name)
    if not files:
        raise FileNotFoundError(f"No SQL migration files were found in {migration_dir}.")

    for file_path in files:
        sql_text = file_path.read_text(encoding="utf-8")
        checksum = hashlib.sha256(sql_text.encode("utf-8")).hexdigest()
        async with conn.transaction():
            recorded = await conn.fetchval(
                "SELECT checksum FROM schema_migrations WHERE filename = $1",
                file_path.name,
            )
            if recorded is None:
                await conn.execute(sql_text)
                await conn.execute(
                    "INSERT INTO schema_migrations (filename, checksum, applied_at) VALUES ($1, $2, NOW())",
                    file_path.name,
                    checksum,
                )
                print(f"[+] Applied {file_path.name}")
            elif recorded != checksum:
                raise RuntimeError(
                    f"Checksum mismatch for {file_path.name}: recorded={recorded}, current={checksum}"
                )
            else:
                print(f"[=] Already applied {file_path.name}")


async def verify_baseline(conn: asyncpg.Connection) -> None:
    themes = await conn.fetchval("SELECT COUNT(*) FROM themes")
    total_theme_credits = await conn.fetchval("SELECT COALESCE(SUM(total_credit_hours), 0) FROM themes")
    courses = await conn.fetchval("SELECT COUNT(*) FROM courses")
    total_course_credits = await conn.fetchval("SELECT COALESCE(SUM(credit_hours), 0) FROM courses")
    outcomes = await conn.fetchval("SELECT COUNT(*) FROM learning_outcomes")

    if themes != 5 or total_theme_credits != 45:
        raise AssertionError(f"Theme verification failed: count={themes}, credits={total_theme_credits}")
    if courses != 15 or total_course_credits != 45:
        raise AssertionError(f"Course verification failed: count={courses}, credits={total_course_credits}")
    if outcomes < 45:
        raise AssertionError(f"Learning outcome verification failed: found {outcomes}, expected >= 45")

    rls_tables = (
        "tenant_memberships",
        "course_resources",
        "exam_attempts",
        "outcome_mastery",
        "feature_entitlements",
    )
    for table_name in rls_tables:
        relrowsecurity = await conn.fetchval(
            """
            SELECT c.relrowsecurity
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = $1 AND n.nspname = 'public';
            """,
            table_name,
        )
        if relrowsecurity is not True:
            raise AssertionError(f"RLS is not enabled on {table_name}: {relrowsecurity!r}")

    print("[✓] Baseline verification passed: themes/courses/outcomes and RLS checks all satisfied.")


async def run_migrations(verify: bool) -> None:
    url = get_connection_url()
    parsed = urlparse(url)
    masked = f"{parsed.username}:***@{parsed.hostname}:{parsed.port}{parsed.path}"
    print(f"[*] Connecting to {masked}")

    conn = await asyncpg.connect(url, statement_cache_size=0, timeout=30)
    try:
        await ensure_schema_migrations_table(conn)
        await apply_migration_files(conn, PROJECT_ROOT / "supabase" / "migrations")
        if verify:
            await verify_baseline(conn)
    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply all Supabase SQL migrations in order.")
    parser.add_argument("--verify", action="store_true", help="Validate curriculum counts and RLS state after migrations.")
    args = parser.parse_args()
    asyncio.run(run_migrations(verify=args.verify))


if __name__ == "__main__":
    main()
