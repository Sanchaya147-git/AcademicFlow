from functools import lru_cache

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session

from app.config import settings


class Base(DeclarativeBase):
    pass


@lru_cache
def engine():
    if not settings.DATABASE_URL:
        raise RuntimeError("DATABASE_URL is required; see .env.example")
    db = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        **({"connect_args": {"check_same_thread": False}} if settings.DATABASE_URL.startswith("sqlite") else {}),
    )
    if db.dialect.name == "sqlite":

        @event.listens_for(db, "connect")
        def foreign_keys(connection, record):
            connection.execute("PRAGMA foreign_keys=ON")

    return db


def get_db():
    with Session(engine()) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
