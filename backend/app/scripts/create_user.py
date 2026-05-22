"""Create or reset a user (admin bootstrap).

Run inside the backend container::

    docker compose exec backend uv run python -m app.scripts.create_user \\
        --email youssef@growthwithflow.com --password 'secret12345' --admin

If a user with the same email already exists, the password is reset and
``--admin`` toggles ``is_admin``. This is the only "out-of-band" way to
provision the first user — there is no public sign-up endpoint.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.models.user import User
from app.services.auth import hash_password

logger = logging.getLogger("create_user")


async def upsert_user(email: str, password: str, full_name: str, is_admin: bool) -> None:
    engine = create_async_engine(settings.DATABASE_URL, future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with session_factory() as db:
            existing = (
                await db.execute(select(User).where(User.email == email.lower()))
            ).scalar_one_or_none()
            if existing is None:
                user = User(
                    email=email.lower(),
                    full_name=full_name,
                    password_hash=hash_password(password),
                    is_admin=is_admin,
                    is_active=True,
                )
                db.add(user)
                action = "created"
            else:
                existing.password_hash = hash_password(password)
                if full_name:
                    existing.full_name = full_name
                existing.is_admin = is_admin
                existing.is_active = True
                user = existing
                action = "updated"
            await db.commit()
            await db.refresh(user)
            logger.info(
                "User %s : %s (id=%s, admin=%s)",
                action, user.email, user.id, user.is_admin,
            )
    finally:
        await engine.dispose()


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--full-name", default="")
    parser.add_argument("--admin", action="store_true", help="Set is_admin=True")
    args = parser.parse_args(argv)
    asyncio.run(
        upsert_user(args.email, args.password, args.full_name, args.admin)
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
