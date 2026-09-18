import time
from collections import defaultdict, deque
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import check_password, current_user, hash_password, require, token
from app.db import get_db
from app.extraction.extractor import get_extractor
from app.extraction.service import extract_report
from app.matching.embedding_service import activity_text, get_embeddings
from app.matching.service import run_matching
from app.models import Activity, Audit, Event, ExecutionLink, Match, Report, User
from app.schemas import (
    ActivityCreate,
    ActivityOut,
    ActivityPatch,
    AuditOut,
    CandidateOut,
    Classification,
    EventOut,
    Login,
    ManualMap,
    ReportOut,
    ReviewAction,
    TextReport,
    UserCreate,
    UserOut,
)
from app.services import analytics, review, spreadsheet
from app.services.access import accessible_activity, accessible_event, accessible_report, activity_query, report_query
from app.services.audit import record

router = APIRouter(prefix="/api")
Db = Depends(get_db)
Auth = Depends(current_user)
login_attempts = defaultdict(deque)


def candidate_dto(match):
    result = CandidateOut.model_validate(match).model_dump(mode="json")
    result["final_confidence"] = round(match.final_confidence * 100, 2)
    return result


def queue_item(db, event):
    return {
        "event": EventOut.model_validate(event),
        "report": ReportOut.model_validate(event.report),
        "candidates": [
            candidate_dto(m)
            for m in db.scalars(select(Match).where(Match.event_id == event.id).order_by(Match.final_confidence.desc()))
        ],
    }


@router.get("/health")
def health():
    return {"status": "ok", "provider": settings.AI_PROVIDER}


@router.post("/auth/login")
def login(body: Login, request: Request, response: Response, db: Session = Db):
    origin = request.headers.get("origin")
    if origin and origin != settings.FRONTEND_URL:
        raise HTTPException(403, "Invalid origin")
    key = request.client.host if request.client else "local"
    attempts = login_attempts[key]
    current = time.monotonic()
    while attempts and current - attempts[0] > 60:
        attempts.popleft()
    if len(attempts) >= 10:
        raise HTTPException(429, "Too many login attempts; retry in one minute")
    attempts.append(current)
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    # Same expensive password operation for unknown users limits account timing leakage.
    valid = check_password(body.password, user.password_hash) if user else bool(hash_password(body.password)) and False
    if not user or not valid:
        raise HTTPException(401, "Invalid email or password")
    access_token = token(user)
    response.set_cookie(
        "academicflow_session",
        access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        max_age=settings.TOKEN_MINUTES * 60,
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return {"access_token": access_token, "token_type": "bearer", "user": UserOut.model_validate(user)}


@router.post("/auth/logout")
def logout(response: Response, user: User = Auth):
    response.delete_cookie("academicflow_session", path="/")
    return {"status": "logged_out"}


@router.get("/auth/me", response_model=UserOut)
def me(user: User = Auth):
    return user


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, db: Session = Db, user: User = Auth):
    require(user, "ADMIN")
    if body.role != "ADMIN" and not body.department:
        raise HTTPException(422, "Department required for non-admin users")
    item = User(**body.model_dump(exclude={"password"}), password_hash=hash_password(body.password))
    item.email = item.email.strip().lower()
    db.add(item)
    db.flush()
    record(db, user, "USER_CREATED", new={"id": str(item.id), "role": item.role})
    return item


@router.get("/users", response_model=list[UserOut])
def users(db: Session = Db, user: User = Auth):
    require(user, "ADMIN")
    return db.scalars(select(User).order_by(User.email)).all()


@router.post("/reports/text", status_code=201)
def submit_text(body: TextReport, db: Session = Db, user: User = Auth):
    require(user, "FACULTY", "LAB_STAFF", "COORDINATOR", "ADMIN")
    if body.submitted_by and body.submitted_by.lower() != user.email:
        raise HTTPException(403, "submitted_by must identify the authenticated user")
    report = Report(source_type="FREE_TEXT", raw_content=body.content, submitted_by=user.id)
    db.add(report)
    db.flush()
    record(db, user, "REPORT_RECEIVED", report=report, new={"source_type": "FREE_TEXT"})
    return {
        "report_id": report.report_id,
        "id": str(report.id),
        "source_type": report.source_type,
        "status": report.status,
    }


@router.post("/reports/spreadsheet", status_code=201)
def upload(file: UploadFile = File(...), db: Session = Db, user: User = Auth):
    require(user, "FACULTY", "LAB_STAFF", "COORDINATOR", "ADMIN")
    content = file.file.read(settings.MAX_UPLOAD_BYTES + 1)
    report = spreadsheet.ingest(db, user, file.filename, content)
    return {"report_id": report.report_id, "id": str(report.id), **report.file_metadata}


@router.get("/reports", response_model=list[ReportOut])
def reports(db: Session = Db, user: User = Auth, offset: int = 0, limit: int = 100):
    if offset < 0 or not 1 <= limit <= 500:
        raise HTTPException(422, "Invalid pagination")
    return db.scalars(report_query(user).order_by(Report.submitted_at.desc()).offset(offset).limit(limit)).all()


@router.get("/reports/{report_id}", response_model=ReportOut)
def report_detail(report_id: str, db: Session = Db, user: User = Auth):
    return accessible_report(db, user, report_id)


@router.get("/extraction/events", response_model=list[EventOut])
def events(db: Session = Db, user: User = Auth):
    ids = report_query(user).with_only_columns(Report.id)
    return db.scalars(select(Event).where(Event.report_id.in_(ids)).order_by(Event.created_at.desc())).all()


@router.get("/extraction/events/{event_id}", response_model=EventOut)
def event_detail(event_id: UUID, db: Session = Db, user: User = Auth):
    return accessible_event(db, user, event_id)


@router.post("/extraction/{report_id}", response_model=list[EventOut])
def extraction(report_id: str, db: Session = Db, user: User = Auth, provider=Depends(get_extractor)):
    require(user, "FACULTY", "LAB_STAFF", "COORDINATOR", "ADMIN")
    report = accessible_report(db, user, report_id)
    return extract_report(db, report, user, provider)


@router.post("/matching/{event_id}")
def matching(event_id: UUID, db: Session = Db, user: User = Auth, provider=Depends(get_embeddings)):
    require(user, "FACULTY", "LAB_STAFF", "COORDINATOR", "ADMIN")
    event = accessible_event(db, user, event_id)
    candidates = run_matching(db, event, user, provider)
    return {
        "event_id": str(event.id),
        "decision": candidates[0].decision if candidates else event.disposition,
        "disposition": event.disposition,
        "provider": provider.model,
        "candidates": [candidate_dto(m) for m in candidates],
    }


@router.post("/activities/reindex")
def reindex(db: Session = Db, user: User = Auth, provider=Depends(get_embeddings)):
    require(user, "ADMIN")
    activities = db.scalars(select(Activity)).all()
    for activity in activities:
        activity.embedding = provider.embed(activity_text(activity))
        activity.embedding_model = provider.model
    record(db, user, "PLAN_REINDEXED", new={"count": len(activities), "model": provider.model})
    return {"indexed": len(activities), "model": provider.model}


@router.get("/activities", response_model=list[ActivityOut])
def activities(
    department: str | None = None,
    course: str | None = None,
    class_section: str | None = None,
    status: str | None = None,
    date: date | None = None,
    db: Session = Db,
    user: User = Auth,
):
    query = activity_query(user)
    for field, value in [
        ("department", department),
        ("course", course),
        ("class_section", class_section),
        ("status", status),
    ]:
        if value:
            query = query.where(getattr(Activity, field) == value)
    if date:
        query = query.where(Activity.planned_start <= date, Activity.planned_end >= date)
    return db.scalars(query.order_by(Activity.planned_start, Activity.activity_id)).all()


@router.post("/activities", response_model=ActivityOut, status_code=201)
def create_activity(body: ActivityCreate, db: Session = Db, user: User = Auth):
    require(user, "ADMIN")
    if body.parent_id:
        parent = accessible_activity(db, user, body.parent_id)
        if parent.level >= body.level:
            raise HTTPException(422, "Parent level must precede child level")
    activity = Activity(**body.model_dump())
    db.add(activity)
    db.flush()
    record(db, user, "ACTIVITY_CREATED", activity=activity, new=body.model_dump())
    return activity


@router.patch("/activities/{activity_id}", response_model=ActivityOut)
def update_activity(activity_id: str, body: ActivityPatch, db: Session = Db, user: User = Auth):
    require(user, "ADMIN")
    activity = accessible_activity(db, user, activity_id)
    activity = db.scalar(select(Activity).where(Activity.id == activity.id).with_for_update())
    previous = ActivityOut.model_validate(activity).model_dump(mode="json")
    updates = body.model_dump(exclude_unset=True)
    if any(updates.get(key, "absent") is None for key in ["status", "completion_percentage"]):
        raise HTTPException(422, "Status and completion cannot be null")
    for key, value in updates.items():
        setattr(activity, key, value)
    if activity.actual_start and activity.actual_end and activity.actual_end < activity.actual_start:
        raise HTTPException(422, "Actual end precedes start")
    if activity.status == "COMPLETED":
        activity.completion_percentage = 100
    record(
        db,
        user,
        "ACTIVITY_UPDATED",
        activity=activity,
        previous=previous,
        new=ActivityOut.model_validate(activity).model_dump(mode="json"),
    )
    return activity


@router.get("/activities/{activity_id}")
def activity_detail(activity_id: str, db: Session = Db, user: User = Auth):
    activity = accessible_activity(db, user, activity_id)
    allowed_report_ids = report_query(user).with_only_columns(Report.id)
    links = db.scalars(
        select(ExecutionLink)
        .join(Event, ExecutionLink.execution_event_id == Event.id)
        .where(ExecutionLink.academic_activity_id == activity.id, Event.report_id.in_(allowed_report_ids))
    ).all()
    audit_query = select(Audit).where(Audit.activity_id == activity.id)
    if user.role in {"FACULTY", "LAB_STAFF"}:
        audit_query = audit_query.where(Audit.report_id.in_(allowed_report_ids))
    return {
        "activity": ActivityOut.model_validate(activity),
        "executions": [queue_item(db, link.event) for link in links],
        "audit": [AuditOut.model_validate(a) for a in db.scalars(audit_query.order_by(Audit.timestamp))],
    }


@router.get("/review/queue")
def review_queue(db: Session = Db, user: User = Auth):
    require(user, "COORDINATOR", "HOD", "ADMIN")
    report_ids = report_query(user).with_only_columns(Report.id)
    return [
        queue_item(db, e)
        for e in db.scalars(select(Event).where(Event.report_id.in_(report_ids), Event.disposition == "HUMAN_REVIEW"))
    ]


@router.get("/review/unmatched")
def unmatched(db: Session = Db, user: User = Auth):
    require(user, "COORDINATOR", "HOD", "ADMIN")
    report_ids = report_query(user).with_only_columns(Report.id)
    return [
        queue_item(db, e)
        for e in db.scalars(
            select(Event).where(
                Event.report_id.in_(report_ids),
                Event.disposition.in_(["UNMATCHED", "EXTRA_ACTIVITY", "OUTSIDE_ACADEMIC_SCOPE", "REJECTED"]),
            )
        )
    ]


def accessible_match(db, user, match_id):
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(404, "Match not found")
    accessible_event(db, user, match.event_id)
    if match.activity_id:
        accessible_activity(db, user, match.activity_id)
    return match


@router.post("/review/{match_id}/approve", response_model=EventOut)
def approve(match_id: UUID, body: ReviewAction, db: Session = Db, user: User = Auth):
    require(user, "COORDINATOR", "ADMIN")
    return review.resolve(db, accessible_match(db, user, match_id), user, body.reason, True)


@router.post("/review/{match_id}/reject", response_model=EventOut)
def reject(match_id: UUID, body: ReviewAction, db: Session = Db, user: User = Auth):
    require(user, "COORDINATOR", "ADMIN")
    return review.resolve(db, accessible_match(db, user, match_id), user, body.reason, False)


@router.post("/review/{event_id}/manual-map", response_model=EventOut)
def map_event(event_id: UUID, body: ManualMap, db: Session = Db, user: User = Auth):
    require(user, "COORDINATOR", "ADMIN")
    return review.manual_map(
        db, accessible_event(db, user, event_id), accessible_activity(db, user, body.activity_id), user, body.reason
    )


@router.post("/review/{event_id}/classify", response_model=EventOut)
def classify(event_id: UUID, body: Classification, db: Session = Db, user: User = Auth):
    require(user, "COORDINATOR", "ADMIN")
    event = review.lock_event(db, accessible_event(db, user, event_id).id)
    if event.disposition not in {"UNMATCHED", "EXTRA_ACTIVITY", "OUTSIDE_ACADEMIC_SCOPE", "REJECTED"}:
        raise HTTPException(409, "Only unmatched events can be classified")
    previous = event.disposition
    event.disposition = body.classification
    record(
        db,
        user,
        "MARKED_" + body.classification,
        event=event,
        previous={"disposition": previous},
        new={"disposition": event.disposition},
        details={"reason": body.reason},
    )
    return event


@router.get("/dashboard/summary")
def summary(db: Session = Db, user: User = Auth):
    return analytics.metrics(db, user)["summary"]


@router.get("/analytics/{section}")
def analytics_data(section: str, db: Session = Db, user: User = Auth):
    values = analytics.metrics(db, user)
    if section == "overview":
        return values
    key = section.replace("-", "_")
    if key not in {"departments", "courses", "units", "schedule_variance", "historical_activity"}:
        raise HTTPException(404, "Unknown analytics section")
    return values[key]


@router.get("/audit", response_model=list[AuditOut])
def audit_list(db: Session = Db, user: User = Auth):
    query = select(Audit)
    if user.role != "ADMIN":
        query = query.where(Audit.report_id.in_(report_query(user).with_only_columns(Report.id)))
    return db.scalars(query.order_by(Audit.timestamp.desc()).limit(500)).all()


@router.get("/audit/{event_id}", response_model=list[AuditOut])
def audit_event(event_id: UUID, db: Session = Db, user: User = Auth):
    event = accessible_event(db, user, event_id)
    return db.scalars(
        select(Audit)
        .where((Audit.event_id == event_id) | ((Audit.report_id == event.report_id) & Audit.event_id.is_(None)))
        .order_by(Audit.timestamp)
    ).all()
