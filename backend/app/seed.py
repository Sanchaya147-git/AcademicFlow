"""Idempotent synthetic plan and administrator bootstrap. Never creates fake historical executions."""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import hash_password
from app.db import engine
from app.matching.embedding_service import Embeddings, activity_text
from app.models import Activity, User
from app.services.audit import record

COURSES = {
    "Data Structures": (
        "Unit III — Linked Lists",
        [
            "Introduction to Linked Lists",
            "Singly Linked List Implementation",
            "Doubly Linked List Implementation",
            "Linked List Insertion",
            "Linked List Deletion",
            "Linked List Practical Session",
            "Singly & Doubly Linked List Implementation",
        ],
    ),
    "DBMS": (
        "Unit II — Relational Databases",
        ["Normalization", "SQL Queries", "Joins", "Transactions", "Database Lab", "SQL Query Practice"],
    ),
    "Operating Systems": (
        "Unit II — Process Management",
        [
            "Process Scheduling",
            "Thread Synchronization",
            "Deadlock Detection",
            "Memory Allocation",
            "Operating Systems Lab",
        ],
    ),
    "Computer Networks": (
        "Unit III — Routing",
        ["IP Addressing", "Subnetting Exercise", "Routing Protocols", "TCP Flow Control", "Network Configuration Lab"],
    ),
    "Machine Learning": (
        "Unit II — Supervised Learning",
        ["Linear Regression", "Decision Trees", "Model Evaluation", "Feature Engineering", "Classification Practical"],
    ),
}


def seed(db, *, index=False):
    if len(settings.SEED_ADMIN_PASSWORD) < 12:
        raise ValueError("Set SEED_ADMIN_PASSWORD to at least 12 characters")
    admin = db.scalar(select(User).where(User.email == settings.SEED_ADMIN_EMAIL.lower()))
    if not admin:
        admin = User(
            name="Demo Administrator",
            email=settings.SEED_ADMIN_EMAIL.lower(),
            role="ADMIN",
            department=None,
            password_hash=hash_password(settings.SEED_ADMIN_PASSWORD),
        )
        db.add(admin)
        db.flush()
    count = 0
    provider = Embeddings()
    for department in ["CSE", "ECE", "EEE", "MECH"]:
        for course, (unit, topics) in COURSES.items():
            for number, topic in enumerate(topics, 1):
                code = "".join(word[0] for word in course.split()) if course != "DBMS" else "DBMS"
                human_id = f"{department}-{code}-L6-{number:04d}"
                if db.scalar(select(Activity).where(Activity.activity_id == human_id)):
                    continue
                start = date(2026, 8, 20) + timedelta(days=number)
                activity = Activity(
                    activity_id=human_id,
                    semester="2026 Odd Semester",
                    department=department,
                    course=course,
                    unit=unit,
                    activity_name=topic,
                    activity_type="Practical"
                    if any(x in topic for x in ["Lab", "Practical", "Implementation", "Exercise"])
                    else "Lecture",
                    faculty=f"{department.lower()}.faculty@example.com",
                    class_section=f"{department}-C",
                    location=f"{department} Block",
                    level=6,
                    planned_start=start,
                    planned_end=start,
                    is_demo=True,
                )
                if index:
                    activity.embedding = provider.embed(activity_text(activity))
                    activity.embedding_model = provider.model
                db.add(activity)
                count += 1
    db.flush()
    record(db, admin, "SYNTHETIC_PLAN_SEEDED", new={"activities_created": count, "demonstration_data": True})
    return count


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--index", action="store_true", help="Generate embeddings (OpenAI mode may incur charges)")
    args = parser.parse_args()
    with Session(engine()) as session:
        print(f"Created {seed(session, index=args.index)} synthetic activities")
        session.commit()
