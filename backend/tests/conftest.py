"""
Pytest uses a dedicated Postgres database so teardown never wipes development data.

The session `db` fixture runs `TRUNCATE TABLE item, account CASCADE` after all tests.
If that pointed at your dev `POSTGRES_DB`, every pytest run would delete all accounts.

We set `POSTGRES_DB` to `POSTGRES_TEST_DB` (default `logistics_hub_test`) before any
`app` import, create that database if missing, then run `alembic upgrade head`.
"""
# ruff: noqa: E402
from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Generator
from pathlib import Path

# --- Bootstrap: must run before `from app...` (Settings + engine bind once) ---


def _load_root_env_file() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.is_file():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def _ensure_test_postgres_database() -> str:
    import psycopg
    from psycopg import sql

    dev_db = os.environ.get("POSTGRES_DB", "").strip()
    test_db = os.environ.get("POSTGRES_TEST_DB", "logistics_hub_test")
    if dev_db and dev_db == test_db:
        raise RuntimeError(
            "Unsafe test configuration: POSTGRES_TEST_DB must be different from POSTGRES_DB. "
            "Using the same database lets pytest TRUNCATE your development data."
        )
    os.environ["POSTGRES_DB"] = test_db

    host = os.environ.get("POSTGRES_SERVER", "localhost")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    user = os.environ.get("POSTGRES_USER", "postgres")
    password = os.environ.get("POSTGRES_PASSWORD", "")

    conn = psycopg.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        dbname="postgres",
        autocommit=True,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s",
                (test_db,),
            )
            if cur.fetchone() is None:
                cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(test_db)))
    finally:
        conn.close()

    return test_db


def _run_alembic_upgrade(backend_root: Path) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=backend_root,
        env={**os.environ},
        check=True,
    )


_load_root_env_file()
_ensure_test_postgres_database()
_run_alembic_upgrade(Path(__file__).resolve().parents[1])

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session

from app.core.config import settings
from app.core.db import engine, init_db
from app.main import app
from tests.utils.account import authentication_token_from_email
from tests.utils.utils import get_superuser_token_headers


@pytest.fixture(scope="session", autouse=True)
def db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        init_db(session)
        yield session
        session.execute(text("TRUNCATE TABLE category, item, account CASCADE"))
        session.commit()


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    return get_superuser_token_headers(client)


@pytest.fixture(scope="module")
def normal_user_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    return authentication_token_from_email(
        client=client, email=settings.EMAIL_TEST_USER, db=db
    )
