import uuid
from datetime import date, datetime, time, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import settings
from app.db import Base


def now():
    return datetime.now(timezone.utc)


class Identity:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class User(Identity, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('FACULTY','LAB_STAFF','COORDINATOR','HOD','ADMIN')"),)
    name: Mapped[str]
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str]
    role: Mapped[str]
    department: Mapped[str | None]


class Activity(Identity, Base):
    __tablename__ = "academic_activities"
    __table_args__ = (
        CheckConstraint("completion_percentage >= 0 AND completion_percentage <= 100"),
        CheckConstraint("level >= 1 AND level <= 6"),
        CheckConstraint("planned_end >= planned_start"),
        CheckConstraint("actual_end IS NULL OR actual_start IS NULL OR actual_end >= actual_start"),
    )
    activity_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("academic_activities.id", ondelete="RESTRICT"))
    semester: Mapped[str]
    department: Mapped[str] = mapped_column(index=True)
    course: Mapped[str] = mapped_column(index=True)
    unit: Mapped[str]
    activity_name: Mapped[str]
    activity_type: Mapped[str]
    faculty: Mapped[str | None]
    class_section: Mapped[str] = mapped_column(index=True)
    location: Mapped[str | None]
    level: Mapped[int] = mapped_column(default=5)
    planned_start: Mapped[date]
    planned_end: Mapped[date]
    actual_start: Mapped[date | None]
    actual_end: Mapped[date | None]
    completion_percentage: Mapped[float] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(default="PLANNED")
    embedding: Mapped[list | None] = mapped_column(Vector(settings.EMBEDDING_DIMENSIONS).with_variant(JSON(), "sqlite"))
    embedding_model: Mapped[str | None]
    is_demo: Mapped[bool] = mapped_column(default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    links: Mapped[list["ExecutionLink"]] = relationship(back_populates="activity")


class Report(Identity, Base):
    __tablename__ = "execution_reports"
    __table_args__ = (CheckConstraint("source_type IN ('FREE_TEXT','SPREADSHEET','VOICE_TRANSCRIPT')"),)
    report_id: Mapped[str] = mapped_column(unique=True, default=lambda: f"RPT-{uuid.uuid4().hex[:12].upper()}")
    source_type: Mapped[str]
    source_file: Mapped[str | None]
    file_metadata: Mapped[dict | None] = mapped_column(JSON)
    raw_content: Mapped[str]
    submitted_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    status: Mapped[str] = mapped_column(default="RECEIVED")
    events: Mapped[list["Event"]] = relationship(back_populates="report")


class Event(Identity, Base):
    __tablename__ = "extracted_events"
    __table_args__ = (
        UniqueConstraint("report_id", "source_row"),
        CheckConstraint(
            "completion_percentage IS NULL OR (completion_percentage >= 0 AND completion_percentage <= 100)"
        ),
    )
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("execution_reports.id", ondelete="RESTRICT"), index=True)
    source_row: Mapped[int]
    activity_description: Mapped[str | None]
    department: Mapped[str | None] = mapped_column(index=True)
    course: Mapped[str | None] = mapped_column(index=True)
    unit: Mapped[str | None]
    class_section: Mapped[str | None] = mapped_column(index=True)
    faculty: Mapped[str | None]
    location: Mapped[str | None]
    event_date: Mapped[date | None] = mapped_column(index=True)
    start_time: Mapped[time | None]
    end_time: Mapped[time | None]
    status: Mapped[str | None]
    completion_percentage: Mapped[float | None]
    source_excerpt: Mapped[str | None]
    normalized_concept: Mapped[str | None]
    disposition: Mapped[str] = mapped_column(default="PENDING")
    report: Mapped[Report] = relationship(back_populates="events")
    matches: Mapped[list["Match"]] = relationship(back_populates="event")


class Match(Identity, Base):
    __tablename__ = "activity_matches"
    __table_args__ = (
        UniqueConstraint("event_id", "activity_id"),
        CheckConstraint("final_confidence >= 0 AND final_confidence <= 1"),
        CheckConstraint("decision IN ('AUTO_LINK','HUMAN_REVIEW','UNMATCHED')"),
    )
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("extracted_events.id", ondelete="RESTRICT"), index=True)
    activity_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("academic_activities.id", ondelete="RESTRICT"), index=True
    )
    semantic_score: Mapped[float] = mapped_column(default=0)
    course_score: Mapped[float | None]
    class_score: Mapped[float | None]
    department_score: Mapped[float | None]
    unit_score: Mapped[float | None]
    faculty_score: Mapped[float | None]
    context_score: Mapped[float | None]
    fuzzy_score: Mapped[float] = mapped_column(default=0)
    final_confidence: Mapped[float]
    decision: Mapped[str]
    decision_type: Mapped[str]
    match_reason: Mapped[str]
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    event: Mapped[Event] = relationship(back_populates="matches")
    activity: Mapped[Activity | None] = relationship()


class ExecutionLink(Identity, Base):
    __tablename__ = "execution_activity_links"
    __table_args__ = (UniqueConstraint("execution_event_id", "academic_activity_id"),)
    execution_event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("extracted_events.id", ondelete="RESTRICT"))
    academic_activity_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academic_activities.id", ondelete="RESTRICT"), index=True
    )
    relationship_type: Mapped[str] = mapped_column(default="EXECUTED_FOR")
    activity: Mapped[Activity] = relationship(back_populates="links")
    event: Mapped[Event] = relationship()


class Audit(Identity, Base):
    __tablename__ = "audit_logs"
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("extracted_events.id", ondelete="RESTRICT"), index=True
    )
    activity_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("academic_activities.id", ondelete="RESTRICT"), index=True
    )
    report_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("execution_reports.id", ondelete="RESTRICT"))
    action: Mapped[str]
    performed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    previous_value: Mapped[dict | None] = mapped_column(JSON)
    new_value: Mapped[dict | None] = mapped_column(JSON)
    details: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
