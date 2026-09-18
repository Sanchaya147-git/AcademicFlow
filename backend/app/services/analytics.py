from collections import defaultdict
from datetime import date, datetime
from statistics import mean

from sqlalchemy import select

from app.models import Event, ExecutionLink, Match, Report
from app.services.access import activity_query, report_query


def metrics(db, user):
    activities = db.scalars(activity_query(user)).all()
    report_ids = report_query(user).with_only_columns(Report.id)
    events = db.scalars(select(Event).where(Event.report_id.in_(report_ids))).all()
    activity_ids = [a.id for a in activities]
    links = db.scalars(select(ExecutionLink).where(ExecutionLink.academic_activity_id.in_(activity_ids))).all()
    # Faculty/staff analytics must never leak another reporter's execution.
    if user.role in {"FACULTY", "LAB_STAFF"}:
        ids = {e.id for e in events}
        links = [link for link in links if link.execution_event_id in ids]
    durations = []
    for link in links:
        e = link.event
        if e.start_time and e.end_time:
            durations.append(
                (datetime.combine(date.min, e.end_time) - datetime.combine(date.min, e.start_time)).total_seconds() / 60
            )
    grouped = {}
    for field in ["department", "course", "unit"]:
        groups = defaultdict(list)
        for a in activities:
            groups[getattr(a, field)].append(a)
        grouped[field + "s"] = [
            {
                "name": key,
                "planned": len(items),
                "completed": sum(a.status == "COMPLETED" for a in items),
                "progress": round(mean(a.completion_percentage for a in items), 1),
            }
            for key, items in groups.items()
        ]
    variance = [
        {
            "id": str(a.id),
            "name": a.activity_name,
            "planned_end": a.planned_end.isoformat(),
            "actual_end": a.actual_end.isoformat() if a.actual_end else None,
            "variance_days": (a.actual_end - a.planned_end).days if a.actual_end else None,
        }
        for a in activities
    ]
    delayed = sum(a.planned_end < date.today() and a.status not in {"COMPLETED", "CANCELLED"} for a in activities)
    historical = []
    for a in activities:
        sessions = [link for link in links if link.academic_activity_id == a.id]
        historical.append(
            {
                "activity_id": str(a.id),
                "name": a.activity_name,
                "course": a.course,
                "unit": a.unit,
                "actual_sessions": len(sessions),
                "planned_sessions": 1 if a.level == 6 else None,
                "sample_size": len(sessions),
                "historical_average": None,
                "note": "Cross-semester historical averages require repeated comparable cohorts.",
            }
        )
    auto = db.scalars(
        select(Match).where(Match.event_id.in_([e.id for e in events]), Match.decision_type == "AUTO_LINKED")
    ).all()
    reports = db.scalars(report_query(user)).all()
    return {
        "summary": {
            "reports_today": sum(r.submitted_at.date() == date.today() for r in reports),
            "auto_linked": len(auto),
            "needs_review": sum(e.disposition == "HUMAN_REVIEW" for e in events),
            "unmatched": sum(e.disposition == "UNMATCHED" for e in events),
            "activities_completed": sum(a.status == "COMPLETED" for a in activities),
            "delayed_activities": delayed,
            "schedule_health": round(100 * (1 - delayed / len(activities)), 1) if activities else None,
        },
        "planned_sessions": sum(a.level == 6 for a in activities),
        "actual_sessions": len(links),
        "average_actual_duration_minutes": round(mean(durations), 1) if durations else None,
        "duration_sample_size": len(durations),
        "completion_rate": round(mean(a.completion_percentage for a in activities), 1) if activities else None,
        "demonstration_data": any(a.is_demo for a in activities),
        **grouped,
        "schedule_variance": variance,
        "historical_activity": historical,
        "status_distribution": [
            {"name": status, "value": sum(a.status == status for a in activities)}
            for status in ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]
        ],
    }
