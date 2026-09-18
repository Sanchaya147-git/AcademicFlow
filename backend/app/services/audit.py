from fastapi.encoders import jsonable_encoder

from app.models import Audit


def record(db, user, action, *, event=None, activity=None, report=None, previous=None, new=None, details=None):
    db.add(
        Audit(
            performed_by=user.id,
            action=action,
            event_id=event.id if event else None,
            activity_id=activity.id if activity else None,
            report_id=report.id if report else (event.report_id if event else None),
            previous_value=jsonable_encoder(previous),
            new_value=jsonable_encoder(new),
            details=jsonable_encoder(details or {}),
        )
    )
