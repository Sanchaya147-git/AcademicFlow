import secrets

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.core.security import hash_password, token
from app.db import Base, get_db
from app.main import app
from app.models import User


@pytest.fixture
def setup(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "JWT_SECRET", secrets.token_hex(32))
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")
    monkeypatch.setattr(settings, "UPLOAD_DIR", tmp_path)
    db_engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(db_engine, "connect")
    def foreign_keys(connection, record):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(db_engine)
    with Session(db_engine) as db:
        admin = User(
            name="Admin", email="admin@test.edu", password_hash=hash_password("test-password-123"), role="ADMIN"
        )
        faculty = User(
            name="Faculty",
            email="faculty@test.edu",
            password_hash=hash_password("test-password-123"),
            role="FACULTY",
            department="CSE",
        )
        coordinator = User(
            name="Coordinator",
            email="coord@test.edu",
            password_hash=hash_password("test-password-123"),
            role="COORDINATOR",
            department="CSE",
        )
        outsider = User(
            name="Other department",
            email="other@test.edu",
            password_hash=hash_password("test-password-123"),
            role="COORDINATOR",
            department="ECE",
        )
        db.add_all([admin, faculty, coordinator, outsider])
        db.commit()
        tokens = {u.role if u != outsider else "OUTSIDER": token(u) for u in [admin, faculty, coordinator, outsider]}

    def override_db():
        with Session(db_engine) as db:
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as client:
        client.headers["Authorization"] = "Bearer " + tokens["ADMIN"]
        yield client, db_engine, tokens
    app.dependency_overrides.clear()
    db_engine.dispose()
