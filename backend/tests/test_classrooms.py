import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, token
from app.db import engine
from app.main import app
from app.models import Activity, Classroom, ClassroomMember, User

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_users():
    from app.db import Base
    Base.metadata.create_all(engine())
    with Session(engine()) as db:
        # Create HOD user
        hod = db.scalar(select(User).where(User.email == "hod_test@academicflow.edu"))
        if not hod:
            hod = User(
                name="Prof HOD",
                email="hod_test@academicflow.edu",
                password_hash=hash_password("hodpass123456"),
                role="HOD",
                department="CSE",
            )
            db.add(hod)

        # Create Teacher user
        teacher = db.scalar(select(User).where(User.email == "faculty_test@academicflow.edu"))
        if not teacher:
            teacher = User(
                name="Prof Teacher",
                email="faculty_test@academicflow.edu",
                password_hash=hash_password("teacherpass123456"),
                role="FACULTY",
                department="CSE",
            )
            db.add(teacher)

        db.commit()


def test_classroom_creation_and_join_flow():
    with Session(engine()) as db:
        hod = db.scalar(select(User).where(User.email == "hod_test@academicflow.edu"))
        teacher = db.scalar(select(User).where(User.email == "faculty_test@academicflow.edu"))
        hod_token = token(hod)
        teacher_token = token(teacher)

    # 1. HOD logs in and creates classroom
    resp = client.post(
        "/api/classrooms",
        headers={"Authorization": f"Bearer {hod_token}"},
        json={
            "name": "CSE 3rd Year - Section C",
            "department": "CSE",
            "academic_year": "2026-2027",
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["name"] == "CSE 3rd Year - Section C"
    assert "CSE-" in data["join_code"]
    join_code = data["join_code"]
    classroom_id = data["id"]

    # 2. Teacher joins classroom using the join code
    resp_join = client.post(
        "/api/classrooms/join",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={
            "join_code": join_code,
            "assigned_subject": "Data Structures",
            "assigned_section": "CSE-C",
        },
    )
    assert resp_join.status_code == 200, resp_join.text
    join_data = resp_join.json()
    assert join_data["status"] == "ok"
    assert join_data["classroom_id"] == classroom_id

    # 3. Duplicate join should fail with 400
    resp_dup = client.post(
        "/api/classrooms/join",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={"join_code": join_code},
    )
    assert resp_dup.status_code == 400

    # 4. Bad join code should return 404
    resp_bad = client.post(
        "/api/classrooms/join",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={"join_code": "INVALID-CODE"},
    )
    assert resp_bad.status_code == 404

    # 5. Teacher fetches my-schedule
    resp_sched = client.get(
        "/api/classrooms/my-schedule",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert resp_sched.status_code == 200
    assert isinstance(resp_sched.json(), list)

    # 6. HOD lists classrooms and sees member_count >= 1
    resp_list = client.get(
        "/api/classrooms",
        headers={"Authorization": f"Bearer {hod_token}"},
    )
    assert resp_list.status_code == 200
    items = resp_list.json()
    target = next((c for c in items if c["id"] == classroom_id), None)
    assert target is not None
    assert target["member_count"] >= 1
