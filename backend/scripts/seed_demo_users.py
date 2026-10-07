from sqlalchemy import select
from app.db import engine
from app.models import User
from app.core.security import hash_password
from sqlalchemy.orm import Session

def seed_demo():
    db = Session(engine())
    users = [
        ("Teacher CSE", "teacher@academicflow.edu", "FACULTY", "CSE", "teacher123456"),
        ("HOD CSE", "hod@academicflow.edu", "HOD", "CSE", "hod123456789"),
    ]
    for name, email, role, dept, pwd in users:
        u = db.scalar(select(User).where(User.email == email))
        if not u:
            u = User(
                name=name,
                email=email,
                role=role,
                department=dept,
                password_hash=hash_password(pwd),
            )
            db.add(u)
            print(f"Created {role} user: {email}")
        else:
            u.password_hash = hash_password(pwd)
            u.department = dept
            u.role = role
            print(f"Updated {role} user: {email}")
    db.commit()
    db.close()

if __name__ == "__main__":
    seed_demo()
