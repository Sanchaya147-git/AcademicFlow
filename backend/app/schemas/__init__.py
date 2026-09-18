from datetime import date, datetime, time
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Role = Literal["FACULTY", "LAB_STAFF", "COORDINATOR", "HOD", "ADMIN"]


class DTO(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")


class Login(DTO):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class UserCreate(Login):
    password: str = Field(min_length=12, max_length=256)
    name: str = Field(min_length=1, max_length=120)
    role: Role
    department: str | None = None


class UserOut(DTO):
    id: UUID
    name: str
    email: str
    role: Role
    department: str | None


class TextReport(DTO):
    content: str = Field(min_length=3, max_length=20000)
    submitted_by: str | None = None

    @field_validator("content")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("Report cannot be blank")
        return value


class Extracted(DTO):
    activity_description: str | None = None
    department: str | None = None
    course: str | None = None
    unit: str | None = None
    class_section: str | None = None
    faculty: str | None = None
    location: str | None = None
    event_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    status: Literal["COMPLETED", "IN_PROGRESS", "CANCELLED", "PLANNED"] | None = None
    completion_percentage: float | None = Field(default=None, ge=0, le=100)
    source_excerpt: str | None = None

    @model_validator(mode="after")
    def times(self):
        if self.start_time and self.end_time and self.end_time < self.start_time:
            raise ValueError("End time precedes start time; overnight sessions require explicit dates")
        return self


class EventOut(Extracted):
    id: UUID
    report_id: UUID
    source_row: int
    normalized_concept: str | None
    disposition: str


class ReportOut(DTO):
    id: UUID
    report_id: str
    source_type: str
    raw_content: str
    source_file: str | None
    file_metadata: dict | None
    submitted_by: UUID
    submitted_at: datetime
    status: str
    events: list[EventOut]


class ActivityCreate(DTO):
    activity_id: str = Field(min_length=3, max_length=80)
    parent_id: UUID | None = None
    semester: str = Field(min_length=1, max_length=100)
    department: str = Field(min_length=1, max_length=80)
    course: str = Field(min_length=1, max_length=160)
    unit: str = Field(min_length=1, max_length=160)
    activity_name: str = Field(min_length=1, max_length=300)
    activity_type: str = Field(min_length=1, max_length=80)
    faculty: str | None = None
    class_section: str = Field(min_length=1, max_length=80)
    location: str | None = None
    level: int = Field(default=5, ge=1, le=6)
    planned_start: date
    planned_end: date

    @model_validator(mode="after")
    def dates(self):
        if self.planned_end < self.planned_start:
            raise ValueError("Planned end must not precede start")
        return self


class ActivityPatch(DTO):
    actual_start: date | None = None
    actual_end: date | None = None
    completion_percentage: float | None = Field(default=None, ge=0, le=100)
    status: Literal["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] | None = None


class ActivityOut(ActivityCreate):
    id: UUID
    actual_start: date | None
    actual_end: date | None
    completion_percentage: float
    status: str
    is_demo: bool


class ReviewAction(DTO):
    reason: str = Field(min_length=3, max_length=2000)

    @field_validator("reason")
    @classmethod
    def meaningful(cls, v):
        if len(v.strip()) < 3:
            raise ValueError("A meaningful reason is required")
        return v


class ManualMap(ReviewAction):
    activity_id: UUID


class Classification(ReviewAction):
    classification: Literal["EXTRA_ACTIVITY", "OUTSIDE_ACADEMIC_SCOPE", "REJECTED"]


class CandidateOut(DTO):
    id: UUID
    event_id: UUID
    activity_id: UUID | None
    activity: ActivityOut | None
    semantic_score: float
    course_score: float | None
    class_score: float | None
    department_score: float | None
    unit_score: float | None
    faculty_score: float | None
    context_score: float | None
    fuzzy_score: float
    final_confidence: float
    decision: str
    decision_type: str
    match_reason: str
    evidence: dict


class AuditOut(DTO):
    id: UUID
    event_id: UUID | None
    activity_id: UUID | None
    report_id: UUID | None
    action: str
    performed_by: UUID
    timestamp: datetime
    previous_value: dict | None
    new_value: dict | None
    details: dict
