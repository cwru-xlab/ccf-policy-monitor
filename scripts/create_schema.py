"""Create every table in db/schema.sql on DATABASE_URL (from .env). Safe to re-run.

    uv run python scripts/create_schema.py
"""

import asyncio
from pathlib import Path

import asyncpg

from policy_radar.config import settings

SCHEMA = Path(__file__).resolve().parent.parent / "db" / "schema.sql"


async def main() -> None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        await conn.execute(SCHEMA.read_text())
    finally:
        await conn.close()
    print(f"applied {SCHEMA.name} to the database")


if __name__ == "__main__":
    asyncio.run(main())
