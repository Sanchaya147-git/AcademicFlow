from datetime import date
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models import Classroom, ClassroomMember, User, Report, Event
from app.core.security import hash_password


def test_classroom_daily_digest_and_excel(setup):
    client, engine, _ = setup

    # 1. Setup HOD and Faculty in DB
    with Session(engine) as db:
        hod = User(
            name="Dr. HOD CSE",
            email="hod_cse@example.com",
            password_hash=hash_password("HodSecure123456!"),
            role="HOD",
            department="CSE",
        )
        faculty = User(
            name="Prof. Ramanathan",
            email="prof_ram@example.com",
            password_hash=hash_password("FacultySecure123456!"),
            role="FACULTY",
            department="CSE",
        )
        db.add_all([hod, faculty])
        db.commit()
        hod_id = hod.id
        faculty_id = faculty.id

    # 2. HOD logs in and creates classroom
    client.post("/api/auth/login", json={"email": "hod_cse@example.com", "password": "HodSecure123456!"})
    res_create = client.post(
        "/api/classrooms",
        json={
            "name": "CSE 3rd Year - Odd Sem 2026",
            "department": "CSE",
            "academic_year": "2026-2027",
        },
    )
    assert res_create.status_code == 201
    classroom_data = res_create.json()
    classroom_id = classroom_data["id"]
    join_code = classroom_data["join_code"]

    # 3. Faculty logs in and joins classroom using join code
    client.post("/api/auth/login", json={"email": "prof_ram@example.com", "password": "FacultySecure123456!"})
    res_join = client.post(
        "/api/classrooms/join",
        json={
            "join_code": join_code,
            "assigned_subject": "Data Structures",
            "assigned_section": "CSE-C",
        },
    )
    assert res_join.status_code == 200

    # 4. Check initial daily digest (faculty hasn't reported yet today)
    client.post("/api/auth/login", json={"email": "hod_cse@example.com", "password": "HodSecure123456!"})
    digest_res1 = client.get(f"/api/classrooms/{classroom_id}/daily-digest")
    assert digest_res1.status_code == 200
    d1 = digest_res1.json()
    assert d1["total_faculty"] == 1
    assert d1["reported_today"] == 0
    assert d1["pending_today"] == 1

    # 5. Faculty submits a report
    client.post("/api/auth/login", json={"email": "prof_ram@example.com", "password": "FacultySecure123456!"})
    rep_res = client.post("/api/reports/text", json={"content": "Completed Singly Linked Lists for CSE-C today."})
    assert rep_res.status_code == 201

    # 6. Check updated daily digest (faculty has reported today!)
    client.post("/api/auth/login", json={"email": "hod_cse@example.com", "password": "HodSecure123456!"})
    digest_res2 = client.get(f"/api/classrooms/{classroom_id}/daily-digest")
    assert digest_res2.status_code == 200
    d2 = digest_res2.json()
    assert d2["total_faculty"] == 1
    assert d2["reported_today"] == 1
    assert d2["pending_today"] == 0
    assert d2["faculty_statuses"][0]["compliance"]["reported"] is True

    # 7. HOD exports weekly master Excel sheet
    excel_res = client.get(f"/api/classrooms/{classroom_id}/excel")
    assert excel_res.status_code == 200
    assert "spreadsheetml.sheet" in excel_res.headers["content-type"]
    assert len(excel_res.content) > 1000  # valid binary Excel workbook
