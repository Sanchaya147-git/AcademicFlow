import time
from collections import defaultdict, deque
from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import check_password, current_user, hash_password, require, token
from app.db import get_db
from app.extraction.extractor import get_extractor
from app.extraction.service import extract_report
from app.matching.embedding_service import activity_text, get_embeddings
from app.services.weekly_excel import generate_classroom_excel
from app.services.plan_generator import generate_plan_from_prompt_or_file
from app.matching.service import run_matching
from app.models import Activity, Audit, Classroom, ClassroomMember, Event, ExecutionLink, Match, Report, User, generate_join_code
from app.schemas import (
    ActivityCreate,
    ActivityOut,
    ActivityPatch,
    AuditOut,
    CandidateOut,
    Classification,
    ClassroomCreate,
    ClassroomJoin,
    ClassroomMemberOut,
    ClassroomOut,
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
    require(user, "HOD", "COORDINATOR", "ADMIN")
    return review.resolve(db, accessible_match(db, user, match_id), user, body.reason, True)


@router.post("/review/{match_id}/reject", response_model=EventOut)
def reject(match_id: UUID, body: ReviewAction, db: Session = Db, user: User = Auth):
    require(user, "HOD", "COORDINATOR", "ADMIN")
    return review.resolve(db, accessible_match(db, user, match_id), user, body.reason, False)


@router.post("/review/{event_id}/manual-map", response_model=EventOut)
def map_event(event_id: UUID, body: ManualMap, db: Session = Db, user: User = Auth):
    require(user, "HOD", "COORDINATOR", "ADMIN")
    return review.manual_map(
        db, accessible_event(db, user, event_id), accessible_activity(db, user, body.activity_id), user, body.reason
    )


@router.post("/review/{event_id}/classify", response_model=EventOut)
def classify(event_id: UUID, body: Classification, db: Session = Db, user: User = Auth):
    require(user, "HOD", "COORDINATOR", "ADMIN")
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


# --- Classroom & Collaboration Hub Endpoints ---


@router.post("/classrooms", response_model=ClassroomOut, status_code=201)
def create_classroom(payload: ClassroomCreate, db: Session = Db, user: User = Auth):
    """HOD or Admin creates a new Classroom with an auto-generated unique join code."""
    require(user, "HOD", "ADMIN")
    
    # Generate unique join code
    code = generate_join_code(payload.department)
    while db.scalar(select(Classroom).where(Classroom.join_code == code)):
        code = generate_join_code(payload.department)

    classroom = Classroom(
        name=payload.name,
        department=payload.department,
        academic_year=payload.academic_year,
        join_code=code,
        hod_id=user.id,
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)

    # Automatically link existing department activities if unlinked
    unlinked_acts = db.scalars(
        select(Activity).where(
            Activity.department == payload.department,
            Activity.classroom_id.is_(None),
        )
    ).all()
    for act in unlinked_acts:
        act.classroom_id = classroom.id
    if unlinked_acts:
        db.commit()

    return ClassroomOut(
        id=classroom.id,
        name=classroom.name,
        department=classroom.department,
        academic_year=classroom.academic_year,
        join_code=classroom.join_code,
        hod_id=classroom.hod_id,
        created_at=classroom.created_at,
        member_count=0,
        activity_count=len(unlinked_acts),
    )


@router.get("/classrooms", response_model=list[ClassroomOut])
def list_classrooms(db: Session = Db, user: User = Auth):
    """Lists classrooms accessible to the current user (created by HOD or joined by teacher)."""
    if user.role in {"HOD", "ADMIN"}:
        stmt = select(Classroom)
        if user.role == "HOD":
            stmt = stmt.where(Classroom.hod_id == user.id)
        classrooms = db.scalars(stmt.order_by(Classroom.created_at.desc())).all()
    else:
        # Faculty sees classrooms they have enrolled in
        joined_ids = db.scalars(
            select(ClassroomMember.classroom_id).where(ClassroomMember.teacher_id == user.id)
        ).all()
        classrooms = db.scalars(
            select(Classroom).where(Classroom.id.in_(joined_ids)).order_by(Classroom.created_at.desc())
        ).all()

    result = []
    for c in classrooms:
        m_count = db.scalar(select(ClassroomMember).where(ClassroomMember.classroom_id == c.id))
        member_count = len(c.members)
        activity_count = len(c.activities)
        result.append(
            ClassroomOut(
                id=c.id,
                name=c.name,
                department=c.department,
                academic_year=c.academic_year,
                join_code=c.join_code,
                hod_id=c.hod_id,
                created_at=c.created_at,
                member_count=member_count,
                activity_count=activity_count,
            )
        )
    return result


@router.get("/classrooms/my-schedule")
def my_schedule(db: Session = Db, user: User = Auth):
    """Returns the teacher's personalized academic plan across all joined classrooms."""
    joined_classroom_ids = db.scalars(
        select(ClassroomMember.classroom_id).where(ClassroomMember.teacher_id == user.id)
    ).all()

    # Find activities in joined classrooms or matching user name/department
    query = select(Activity).where(
        (Activity.classroom_id.in_(joined_classroom_ids))
        | (Activity.department == user.department)
    ).order_by(Activity.planned_start)

    activities = db.scalars(query).all()
    return [
        {
            "id": str(a.id),
            "activity_id": a.activity_id,
            "course": a.course,
            "unit": a.unit,
            "activity_name": a.activity_name,
            "class_section": a.class_section,
            "planned_start": str(a.planned_start),
            "planned_end": str(a.planned_end),
            "actual_end": str(a.actual_end) if a.actual_end else None,
            "status": a.status,
            "completion_percentage": a.completion_percentage,
        }
        for a in activities
    ]


@router.get("/classrooms/{classroom_id}")
def get_classroom_details(classroom_id: UUID, db: Session = Db, user: User = Auth):
    """Gets detailed classroom view including enrolled members and curriculum plan."""
    c = db.get(Classroom, classroom_id)
    if not c:
        raise HTTPException(404, "Classroom not found")

    members = [
        {
            "id": str(m.id),
            "teacher_id": str(m.teacher_id),
            "teacher_name": m.teacher.name,
            "teacher_email": m.teacher.email,
            "assigned_subject": m.assigned_subject,
            "assigned_section": m.assigned_section,
            "joined_at": m.joined_at.isoformat(),
        }
        for m in c.members
    ]

    activities = [
        {
            "id": str(a.id),
            "activity_id": a.activity_id,
            "course": a.course,
            "unit": a.unit,
            "activity_name": a.activity_name,
            "class_section": a.class_section,
            "faculty": a.faculty,
            "status": a.status,
            "completion_percentage": a.completion_percentage,
            "planned_start": str(a.planned_start),
            "planned_end": str(a.planned_end),
            "actual_end": str(a.actual_end) if a.actual_end else None,
        }
        for a in c.activities
    ]

    return {
        "id": str(c.id),
        "name": c.name,
        "department": c.department,
        "academic_year": c.academic_year,
        "join_code": c.join_code,
        "created_at": c.created_at.isoformat(),
        "members": members,
        "activities": activities,
    }


@router.post("/classrooms/join")
def join_classroom(payload: ClassroomJoin, db: Session = Db, user: User = Auth):
    """Allows a teacher to enroll in a classroom using the HOD's join code."""
    clean_code = payload.join_code.strip().upper()
    classroom = db.scalar(select(Classroom).where(Classroom.join_code == clean_code))
    if not classroom:
        raise HTTPException(404, f"Invalid join code '{clean_code}'. Please verify with your HOD.")

    # Check if already a member
    existing = db.scalar(
        select(ClassroomMember).where(
            ClassroomMember.classroom_id == classroom.id,
            ClassroomMember.teacher_id == user.id,
        )
    )
    if existing:
        raise HTTPException(400, f"You have already joined '{classroom.name}'.")

    member = ClassroomMember(
        classroom_id=classroom.id,
        teacher_id=user.id,
        assigned_subject=payload.assigned_subject,
        assigned_section=payload.assigned_section,
    )
    db.add(member)
    db.commit()

    return {
        "status": "ok",
        "message": f"Successfully joined {classroom.name}!",
        "classroom_id": str(classroom.id),
        "classroom_name": classroom.name,
        "department": classroom.department,
    }


@router.get("/classrooms/{classroom_id}/daily-digest")
def get_classroom_daily_digest(classroom_id: UUID, db: Session = Db, user: User = Auth):
    """Provides daily compliance digest for all faculty enrolled in the classroom."""
    classroom = db.get(Classroom, classroom_id)
    if not classroom:
        raise HTTPException(404, "Classroom not found")

    today = date.today()
    members = db.scalars(
        select(ClassroomMember).where(ClassroomMember.classroom_id == classroom.id)
    ).all()

    statuses = []
    reported_count = 0

    for m in members:
        # Check if teacher reported today
        reports = db.scalars(
            select(Report).where(
                Report.submitted_by == m.teacher_id,
                Report.submitted_at >= datetime.combine(today, datetime.min.time()),
            ).order_by(Report.submitted_at.desc())
        ).all()

        has_reported = len(reports) > 0
        if has_reported:
            reported_count += 1
            latest_rep = reports[0]
            latest_event = latest_rep.events[0] if latest_rep.events else None
            rep_info = {
                "reported": True,
                "report_id": latest_rep.report_id,
                "source_type": latest_rep.source_type,
                "submitted_at": latest_rep.submitted_at.isoformat(),
                "topic": latest_event.activity_description if latest_event else latest_rep.raw_content[:80],
                "status": latest_event.status if latest_event else "REPORTED",
            }
        else:
            rep_info = {
                "reported": False,
                "report_id": None,
                "source_type": None,
                "submitted_at": None,
                "topic": None,
                "status": "PENDING",
            }

        statuses.append({
            "teacher_id": str(m.teacher_id),
            "teacher_name": m.teacher.name if m.teacher else "Faculty",
            "teacher_email": m.teacher.email if m.teacher else "—",
            "assigned_subject": m.assigned_subject or "General",
            "assigned_section": m.assigned_section or "All Sections",
            "compliance": rep_info,
        })

    return {
        "classroom_id": str(classroom.id),
        "classroom_name": classroom.name,
        "date": today.isoformat(),
        "total_faculty": len(members),
        "reported_today": reported_count,
        "pending_today": len(members) - reported_count,
        "faculty_statuses": statuses,
    }


@router.get("/classrooms/{classroom_id}/excel")
def download_classroom_excel(classroom_id: UUID, db: Session = Db, user: User = Auth):
    """Exports weekly master academic plan Excel workbook with formatted styling."""
    classroom = db.get(Classroom, classroom_id)
    if not classroom:
        raise HTTPException(404, "Classroom not found")

    activities = db.scalars(
        select(Activity).where(Activity.classroom_id == classroom.id).order_by(Activity.planned_start, Activity.activity_id)
    ).all()
    # If no activities explicitly tied to classroom_id yet, fallback to department activities
    if not activities:
        activities = db.scalars(
            select(Activity).where(Activity.department == classroom.department).order_by(Activity.planned_start, Activity.activity_id)
        ).all()

    members = db.scalars(
        select(ClassroomMember).where(ClassroomMember.classroom_id == classroom.id)
    ).all()

    excel_bytes = generate_classroom_excel(classroom, activities, members)
    filename = f"master_academic_plan_{classroom.join_code}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/plan/extract-or-prompt")
async def extract_or_prompt_plan(
    prompt: str | None = Form(None),
    department: str = Form("CSE"),
    course: str = Form("Data Structures"),
    class_section: str = Form("CSE-C"),
    faculty: str | None = Form(None),
    start_date: date | None = Form(None),
    classroom_id: UUID | None = Form(None),
    file: UploadFile | None = File(None),
    user: User = Auth,
):
    """HOD generates or extracts an academic plan from a timetable image/PDF or natural prompt."""
    file_bytes = None
    filename = None
    content_type = None
    if file:
        file_bytes = await file.read()
        filename = file.filename
        content_type = file.content_type

    activities = generate_plan_from_prompt_or_file(
        prompt=prompt,
        file_bytes=file_bytes,
        filename=filename,
        content_type=content_type,
        department=department,
        course=course,
        class_section=class_section,
        faculty=faculty,
        start_date=start_date,
    )

    if classroom_id:
        for a in activities:
            a["classroom_id"] = str(classroom_id)

    return {
        "status": "success",
        "total_activities": len(activities),
        "classroom_id": str(classroom_id) if classroom_id else None,
        "activities": activities,
    }


@router.post("/plan/publish", status_code=201)
def publish_plan(
    payload: dict,
    db: Session = Db,
    user: User = Auth,
    provider=Depends(get_embeddings),
):
    """Publishes reviewed plan activities to the database, linking to a classroom."""
    activities_data = payload.get("activities", [])
    classroom_id = payload.get("classroom_id")
    if not activities_data:
        raise HTTPException(400, "No activities to publish")

    created = []
    for item in activities_data:
        act_id = item.get("activity_id")
        existing = db.scalar(select(Activity).where(Activity.activity_id == act_id))
        if existing:
            act_id = f"{act_id}-{int(time.time() * 1000) % 10000}"

        p_start = item.get("planned_start")
        if isinstance(p_start, str):
            try:
                p_start = date.fromisoformat(p_start[:10])
            except ValueError:
                p_start = date.today()
        elif not isinstance(p_start, date):
            p_start = date.today()

        p_end = item.get("planned_end")
        if isinstance(p_end, str):
            try:
                p_end = date.fromisoformat(p_end[:10])
            except ValueError:
                p_end = p_start
        elif not isinstance(p_end, date):
            p_end = p_start

        act = Activity(
            activity_id=act_id,
            semester=item.get("semester", "2026 Odd Semester"),
            department=item.get("department", "CSE"),
            course=item.get("course", "Data Structures"),
            unit=item.get("unit", "Unit I"),
            activity_name=item.get("activity_name", "Lecture"),
            activity_type=item.get("activity_type", "Lecture"),
            faculty=item.get("faculty"),
            class_section=item.get("class_section", "CSE-C"),
            location=item.get("location"),
            level=item.get("level", 5),
            planned_start=p_start,
            planned_end=p_end,
            classroom_id=UUID(classroom_id) if classroom_id else None,
            status="PLANNED",
            completion_percentage=0.0,
            is_demo=False,
        )
        act.embedding = provider.embed(activity_text(act))
        act.embedding_model = provider.model
        db.add(act)
        created.append(act)

    db.commit()
    record(db, user, "PLAN_PUBLISHED", new={"count": len(created), "classroom_id": str(classroom_id) if classroom_id else None})
    return {
        "status": "ok",
        "published_count": len(created),
        "classroom_id": classroom_id,
    }



