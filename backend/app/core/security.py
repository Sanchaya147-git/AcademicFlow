import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex()
    return f"scrypt${salt}${digest}"


def check_password(password: str, encoded: str) -> bool:
    try:
        _, salt, digest = encoded.split("$")
        check = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex()
        return hmac.compare_digest(check, digest)
    except ValueError:
        return False


def secret():
    if len(settings.JWT_SECRET) < 32:
        raise HTTPException(503, "Set JWT_SECRET to at least 32 random characters")
    return settings.JWT_SECRET


def token(user: User):
    return jwt.encode(
        {
            "sub": str(user.id),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.TOKEN_MINUTES),
            "iat": datetime.now(timezone.utc),
            "iss": "academicflow",
            "aud": "academicflow",
        },
        secret(),
        algorithm="HS256",
    )


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    authorization = request.headers.get("authorization", "")
    bearer = authorization.startswith("Bearer ")
    raw = authorization[7:] if bearer else request.cookies.get("academicflow_session")
    if not raw:
        raise HTTPException(401, "Authentication required")
    if not bearer and request.method not in {"GET", "HEAD", "OPTIONS"}:
        if request.headers.get("origin") != settings.FRONTEND_URL:
            raise HTTPException(403, "Invalid request origin")
    try:
        payload = jwt.decode(raw, secret(), algorithms=["HS256"], issuer="academicflow", audience="academicflow")
        user = db.get(User, UUID(payload["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(401, "Invalid or expired session") from None
    if not user:
        raise HTTPException(401, "Unknown user")
    return user


def require(user: User, *roles):
    if user.role not in roles:
        raise HTTPException(403, "Role is not permitted for this action")


def can_view_activity(user, activity):
    if user.role == "ADMIN":
        return True
    if activity.department != user.department:
        return False
    return user.role != "LAB_STAFF" or activity.activity_type in {"Lab", "Practical"}
