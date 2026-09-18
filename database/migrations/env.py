from alembic import context
from sqlalchemy import create_engine
from app.config import settings
from app.db import Base
import app.models  # noqa: F401

config = context.config
target_metadata = Base.metadata

if context.is_offline_mode():
    context.configure(url=settings.DATABASE_URL, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    with create_engine(settings.DATABASE_URL).connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
