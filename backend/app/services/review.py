from fastapi import HTTPException
from sqlalchemy import select

from app.models import Activity, Event, ExecutionLink, Match, now
from app.schemas import ActivityOut
from app.services.audit import record


def lock_event(db, event_id):
    event = db.scalar(
        select(Event).where(Event.id == event_id).with_for_update().execution_options(populate_existing=True)
    )
    if not event:
        raise HTTPException(404, "Event not found")
    return event


def synchronize(db, event, activity, user, action):
    # All callers hold event lock; activity lock serializes concurrent executions.
    activity = db.scalar(
        select(Activity).where(Activity.id == activity.id).with_for_update().execution_options(populate_existing=True)
    )
    existing = db.scalar(
        select(ExecutionLink).where(
            ExecutionLink.execution_event_id == event.id, ExecutionLink.academic_activity_id == activity.id
        )
    )
    if existing:
        return
    previous = ActivityOut.model_validate(activity).model_dump(mode="json")
    db.add(
        ExecutionLink(
            execution_event_id=event.id,
            academic_activity_id=activity.id,
            relationship_type="EXECUTED_FOR" if event.status == "COMPLETED" else "PARTIAL_EXECUTION",
        )
    )
    if event.event_date:
        activity.actual_start = (
            min(activity.actual_start, event.event_date) if activity.actual_start else event.event_date
        )
        if event.status == "COMPLETED":
            activity.actual_end = (
                max(activity.actual_end, event.event_date) if activity.actual_end else event.event_date
            )
    # Conservative cumulative interpretation, not additive per-session percentages.
    if event.completion_percentage is not None:
        activity.completion_percentage = max(activity.completion_percentage, event.completion_percentage)
    if event.status == "COMPLETED":
        activity.completion_percentage = 100
        activity.status = "COMPLETED"
    elif event.status == "IN_PROGRESS" and activity.status != "COMPLETED":
        activity.status = "IN_PROGRESS"
    record(
        db,
        user,
        action,
        event=event,
        activity=activity,
        previous=previous,
        new=ActivityOut.model_validate(activity).model_dump(mode="json"),
    )
    event.disposition = "LINKED"


def resolve(db, match, user, reason, approve):
    event = lock_event(db, match.event_id)
    db.refresh(match)
    if event.disposition != "HUMAN_REVIEW" or match.decision_type != "PENDING":
        raise HTTPException(409, "Event has already been resolved or is not awaiting review")
    previous = {"decision_type": match.decision_type}
    match.reviewer_id, match.reviewed_at = user.id, now()
    match.decision_type = "HUMAN_CONFIRMED" if approve else "HUMAN_REJECTED"
    if approve:
        synchronize(db, event, match.activity, user, "SCHEDULE_SYNCHRONIZED")
        for other in event.matches:
            if other.id != match.id and other.decision_type == "PENDING":
                other.decision_type = "SUPERSEDED"
    else:
        pending = [m for m in event.matches if m.id != match.id and m.decision_type == "PENDING"]
        if not pending:
            event.disposition = "UNMATCHED"
    record(
        db,
        user,
        "MATCH_APPROVED" if approve else "MATCH_REJECTED",
        event=event,
        activity=match.activity,
        previous=previous,
        new={"decision_type": match.decision_type},
        details={"reason": reason, "match_id": str(match.id)},
    )
    return event


def manual_map(db, event, activity, user, reason):
    event = lock_event(db, event.id)
    if event.disposition == "LINKED":
        raise HTTPException(
            409, "Already linked; remapping a confirmed execution requires an explicit reversal workflow"
        )
    original = [
        {"id": str(m.id), "activity_id": str(m.activity_id), "decision_type": m.decision_type} for m in event.matches
    ]
    selected = next((m for m in event.matches if m.activity_id == activity.id), None)
    if selected is None:
        selected = Match(
            event_id=event.id,
            activity_id=activity.id,
            semantic_score=0,
            fuzzy_score=0,
            final_confidence=0,
            decision="HUMAN_REVIEW",
            decision_type="MANUALLY_MAPPED",
            match_reason="Human-selected activity; confidence is not an AI assessment.",
            evidence={},
        )
        db.add(selected)
    for match in event.matches:
        if match.decision_type == "PENDING":
            match.decision_type = "SUPERSEDED"
    selected.decision_type = "MANUALLY_MAPPED"
    selected.reviewer_id, selected.reviewed_at = user.id, now()
    synchronize(db, event, activity, user, "SCHEDULE_SYNCHRONIZED")
    record(
        db,
        user,
        "MANUALLY_MAPPED",
        event=event,
        activity=activity,
        previous={"candidates": original},
        new={"selected_activity": str(activity.id)},
        details={"reason": reason},
    )
    return event
