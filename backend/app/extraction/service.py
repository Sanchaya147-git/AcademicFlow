from sqlalchemy import select

from app.models import Event, Report
from app.services.audit import record


def extract_report(db, report, user, provider):
    # Report row lock makes extraction idempotent under concurrent PostgreSQL workers.
    db.execute(select(Report).where(Report.id == report.id).with_for_update()).scalar_one()
    existing = db.scalars(select(Event).where(Event.report_id == report.id).order_by(Event.source_row)).all()
    if existing or report.source_type == "SPREADSHEET":
        return existing
    extracted = provider.extract(report.raw_content, report.submitted_at.date())
    events = []
    for index, item in enumerate(extracted, 1):
        event = Event(report_id=report.id, source_row=index, **item.model_dump())
        db.add(event)
        db.flush()
        record(
            db,
            user,
            "EXTRACTION_COMPLETED",
            event=event,
            new=item.model_dump(),
            details={"provider": provider.__class__.__name__},
        )
        events.append(event)
    report.status = "EXTRACTED"
    return events
