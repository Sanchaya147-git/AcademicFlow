from uuid import uuid4
from sqlalchemy.orm import Session
from app.models import User, Classroom, Activity
from app.core.security import hash_password


def test_plan_extract_prompt_and_publish(setup):
    client, engine, _ = setup

    # 1. Setup HOD in DB
    with Session(engine) as db:
        hod = User(
            name="Dr. HOD CSE",
            email="hod_plan@example.com",
            password_hash=hash_password("HodSecure123456!"),
            role="HOD",
            department="CSE",
        )
        db.add(hod)
        db.commit()

    # 2. HOD logs in and creates classroom
    client.post("/api/auth/login", json={"email": "hod_plan@example.com", "password": "HodSecure123456!"})
    c_res = client.post(
        "/api/classrooms",
        json={"name": "DBMS Advanced 2026", "department": "CSE", "academic_year": "2026-2027"},
    )
    assert c_res.status_code == 201
    classroom_id = c_res.json()["id"]

    # 3. Prompt plan generation
    extract_res = client.post(
        "/api/plan/extract-or-prompt",
        data={
            "prompt": "Create a 6-session syllabus on Database Normalization and SQL Transactions for CSE-B",
            "department": "CSE",
            "course": "Database Management Systems",
            "class_section": "CSE-B",
            "faculty": "Prof. Ramanathan",
            "classroom_id": classroom_id,
        },
    )
    assert extract_res.status_code == 200
    plan_data = extract_res.json()
    assert plan_data["status"] == "success"
    assert len(plan_data["activities"]) >= 6

    # 4. Publish plan to classroom
    publish_res = client.post(
        "/api/plan/publish",
        json={
            "classroom_id": classroom_id,
            "activities": plan_data["activities"],
        },
    )
    assert publish_res.status_code == 201
    assert publish_res.json()["published_count"] == len(plan_data["activities"])

    # 5. Verify classroom details returns activities
    classroom_details = client.get(f"/api/classrooms/{classroom_id}")
    assert classroom_details.status_code == 200
    c_json = classroom_details.json()
    assert len(c_json["activities"]) == len(plan_data["activities"])
    assert c_json["activities"][0]["course"] == "Database Management Systems"
