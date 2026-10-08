from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, token
from app.db import engine
from app.main import app
from app.models import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_email_test_users():
    from app.db import Base
    Base.metadata.create_all(engine())
    with Session(engine()) as db:
        hod = db.scalar(select(User).where(User.email == "hod_email_test@academicflow.edu"))
        if not hod:
            hod = User(
                name="Prof HOD Email",
                email="hod_email_test@academicflow.edu",
                password_hash=hash_password("hodpass123456"),
                role="HOD",
                department="CSE",
            )
            db.add(hod)

        faculty = db.scalar(select(User).where(User.email == "faculty_email_test@academicflow.edu"))
        if not faculty:
            faculty = User(
                name="Prof Faculty Email",
                email="faculty_email_test@academicflow.edu",
                password_hash=hash_password("facpass123456"),
                role="FACULTY",
                department="CSE",
            )
            db.add(faculty)

        db.commit()


def test_email_dispatch_unauthenticated():
    resp = client.post("/api/email/send-master-plan", json={"mode": "simulate"})
    assert resp.status_code == 401


def test_email_dispatch_forbidden_for_faculty():
    with Session(engine()) as db:
        faculty = db.scalar(select(User).where(User.email == "faculty_email_test@academicflow.edu"))
        faculty_token = token(faculty)

    resp = client.post(
        "/api/email/send-master-plan",
        headers={"Authorization": f"Bearer {faculty_token}"},
        json={"mode": "simulate", "recipient": "roxyzinc07@gmail.com"}
    )
    assert resp.status_code == 403
    assert "Role is not permitted" in resp.json()["detail"]


def test_email_dispatch_simulate_for_hod():
    with Session(engine()) as db:
        hod = db.scalar(select(User).where(User.email == "hod_email_test@academicflow.edu"))
        hod_token = token(hod)

    resp = client.post(
        "/api/email/send-master-plan",
        headers={"Authorization": f"Bearer {hod_token}"},
        json={"mode": "simulate", "recipient": "roxyzinc07@gmail.com"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["mode"] == "simulate"
    assert data["recipient"] == "roxyzinc07@gmail.com"
    assert data["excel_filename"] == "master_academic_plan.xlsx"
    assert data["operation_id"].startswith("sim_op_")


def test_email_dispatch_live_mocked_for_hod():
    with Session(engine()) as db:
        hod = db.scalar(select(User).where(User.email == "hod_email_test@academicflow.edu"))
        hod_token = token(hod)

    mock_resp = MagicMock()
    mock_resp.read.return_value = b'{"operationId": "comms_op_mocked_123"}'
    mock_resp.__enter__.return_value = mock_resp

    with patch("urllib.request.urlopen", return_value=mock_resp):
        resp = client.post(
            "/api/email/send-master-plan",
            headers={"Authorization": f"Bearer {hod_token}"},
            json={"mode": "live", "recipient": "roxyzinc07@gmail.com"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["mode"] == "live"
        assert data["operation_id"] == "comms_op_mocked_123"
