from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select

from app.core.security import can_view_activity
from app.models import Activity, Event, Report, User


def report_query(user):
    statement = select(Report)
    if user.role == "ADMIN":
        return statement
    if user.role in {"FACULTY", "LAB_STAFF"}:
        return statement.where(Report.submitted_by == user.id)
    return statement.join(User, Report.submitted_by == User.id).where(User.department == user.department)


def accessible_report(db, user, report_id):
    try:
        uid = UUID(str(report_id))
        condition = Report.id == uid
    except ValueError:
        condition = Report.report_id == str(report_id)
    report = db.scalar(report_query(user).where(condition))
    if not report:
        raise HTTPException(404, "Report not found")
    return report


def accessible_event(db, user, event_id):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    accessible_report(db, user, event.report_id)
    return event


def activity_query(user):
    statement = select(Activity)
    if user.role != "ADMIN":
        statement = statement.where(Activity.department == user.department)
        if user.role == "LAB_STAFF":
            statement = statement.where(Activity.activity_type.in_(["Lab", "Practical"]))
    return statement


def accessible_activity(db, user, activity_id):
    try:
        uid = UUID(str(activity_id))
        activity = db.get(Activity, uid)
    except ValueError:
        activity = db.scalar(select(Activity).where(Activity.activity_id == str(activity_id)))
    if not activity or not can_view_activity(user, activity):
        raise HTTPException(404, "Activity not found")
    return activity
