import io
import uuid
from datetime import date

import pytest
from openpyxl import Workbook
from sqlalchemy import func, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.extraction.extractor import DemoExtractor, ProviderError, get_extractor
from app.matching.embedding_service import get_embeddings
from app.matching.scoring import decide, score
from app.models import Activity, Audit, Event, ExecutionLink, Match, Report
from app.seed import seed


def plan(client, **overrides):
    payload = dict(
        activity_id="CSE-DSA-L6-0001",
        semester="2026 Odd Semester",
        department="CSE",
        course="Data Structures",
        unit="Unit III — Linked Lists",
        activity_name="Singly Linked List Implementation",
        activity_type="Practical",
        class_section="CSE-C",
        planned_start=date.today().isoformat(),
        planned_end=date.today().isoformat(),
    )
    response = client.post("/api/activities", json={**payload, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def report(client, text="Finished linked lists today for CSE-C."):
    response = client.post("/api/reports/text", json={"content": text})
    assert response.status_code == 201, response.text
    return response.json()


def event(client, report_id):
    response = client.post("/api/extraction/" + report_id)
    assert response.status_code == 200, response.text
    return response.json()[0]


def test_tables_seed_constraints(setup, monkeypatch):
    client, engine, _ = setup
    assert set(inspect(engine).get_table_names()) == {
        "users",
        "academic_activities",
        "execution_reports",
        "extracted_events",
        "activity_matches",
        "execution_activity_links",
        "audit_logs",
    }
    monkeypatch.setattr(settings, "SEED_ADMIN_PASSWORD", "safe-test-password")
    with Session(engine) as db:
        assert seed(db, index=True) == 112
        db.commit()
        assert seed(db, index=True) == 0
        db.commit()
        assert db.scalar(select(func.count(Activity.id))) == 112
        activity = db.scalar(select(Activity))
        assert len(activity.embedding) == 1536
        activity.completion_percentage = 101
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def test_auth_roles_and_scope(setup):
    client, _, tokens = setup
    client.headers.clear()
    assert client.get("/api/reports").status_code == 401
    bad = client.post("/api/auth/login", json={"email": "bad@example.com", "password": "incorrect"})
    assert bad.status_code == 401
    result = client.post("/api/auth/login", json={"email": "faculty@test.edu", "password": "test-password-123"})
    assert result.status_code == 200
    assert "HttpOnly" in result.headers["set-cookie"]
    assert client.post("/api/reports/text", json={"content": "test report"}).status_code == 403  # CSRF origin
    client.headers["Authorization"] = "Bearer " + tokens["FACULTY"]
    assert client.get("/api/review/queue").status_code == 403
    assert (
        client.post("/api/reports/text", json={"content": "report", "submitted_by": "someone@test.edu"}).status_code
        == 403
    )
    r = report(client)
    client.headers["Authorization"] = "Bearer " + tokens["OUTSIDER"]
    assert client.get("/api/reports/" + r["report_id"]).status_code == 404
    assert client.get("/api/reports").json() == []


def test_extraction_preserves_missing_fields_and_idempotence(setup):
    client, engine, _ = setup
    r = report(client)
    e = event(client, r["report_id"])
    assert e["course"] is None and e["department"] is None
    assert e["source_excerpt"] == "Finished linked lists today for CSE-C."
    assert e["event_date"] == date.today().isoformat()
    assert event(client, r["report_id"])["id"] == e["id"]
    with Session(engine) as db:
        assert db.scalar(select(func.count(Event.id))) == 1
        assert db.scalar(select(Report)).raw_content == "Finished linked lists today for CSE-C."
    history = client.get("/api/audit/" + e["id"]).json()
    assert {a["action"] for a in history} >= {"REPORT_RECEIVED", "EXTRACTION_COMPLETED"}


def test_provider_failure_keeps_source(setup):
    from app.main import app

    client, _, _ = setup

    class Broken:
        def extract(self, *args):
            raise ProviderError("temporary API failure")

    app.dependency_overrides[get_extractor] = lambda: Broken()
    r = report(client)
    assert client.post("/api/extraction/" + r["report_id"]).status_code == 502
    assert client.get("/api/reports/" + r["report_id"]).json()["raw_content"]


@pytest.mark.parametrize(
    "value,expected",
    [
        (0, "UNMATCHED"),
        (0.4999, "UNMATCHED"),
        (0.5, "HUMAN_REVIEW"),
        (0.89999, "HUMAN_REVIEW"),
        (0.9, "AUTO_LINK"),
        (1, "AUTO_LINK"),
    ],
)
def test_boundaries(value, expected):
    assert decide(value) == expected


def test_scoring_contradictions_and_missing():
    a = Activity(
        activity_name="Linked List Implementation",
        course="Data Structures",
        department="CSE",
        class_section="CSE-C",
        planned_start=date.today(),
        planned_end=date.today(),
    )
    e = Event(activity_description="Finished linked lists", class_section="CSE-C", event_date=date.today())
    assert score(e, a, 1)["final_confidence"] == pytest.approx(0.7)
    e.course = "DBMS"
    assert score(e, a, 1)["final_confidence"] < 0.5
    e.course = None
    e.activity_description = "Conducted placement aptitude training"
    assert score(e, a, 1)["final_confidence"] < 0.5


class PerfectEmbedding:
    model = "test-fixed-v1"

    def embed(self, text):
        return [1.0] + [0.0] * 1535


def configure_matching(setup, *, context=True):
    from app.main import app

    client, engine, _ = setup
    a = plan(client)
    with Session(engine) as db:
        activity = db.get(Activity, uuid.UUID(a["id"]))
        activity.embedding = PerfectEmbedding().embed("")
        activity.embedding_model = PerfectEmbedding.model
        db.commit()
    app.dependency_overrides[get_embeddings] = PerfectEmbedding
    r = report(client)
    e = event(client, r["report_id"])
    # Inject fully specified test evidence into an event. This is a scoring unit fixture, not a fabricated demo extraction.
    if context:
        with Session(engine) as db:
            item = db.get(Event, uuid.UUID(e["id"]))
            item.course = "Data Structures"
            item.department = "CSE"
            db.commit()
    return a, e


def test_auto_link_audit_and_many_to_one(setup):
    client, engine, _ = setup
    a, e = configure_matching(setup)
    result = client.post("/api/matching/" + e["id"])
    assert result.status_code == 200, result.text
    assert result.json()["decision"] == "AUTO_LINK"
    assert result.json()["candidates"][0]["final_confidence"] == 100
    assert client.post("/api/matching/" + e["id"]).status_code == 200
    r2 = report(client, "Completed Data Structures linked lists today for CSE-C.")
    e2 = event(client, r2["report_id"])
    with Session(engine) as db:
        item = db.get(Event, uuid.UUID(e2["id"]))
        item.department = "CSE"
        db.commit()
    client.post("/api/matching/" + e2["id"])
    with Session(engine) as db:
        assert db.scalar(select(func.count(ExecutionLink.id))) == 2
        assert db.scalar(select(Activity)).completion_percentage == 100
        assert db.scalar(select(func.count(Audit.id)).where(Audit.action == "AUTO_LINKED")) == 2
    assert len(client.get("/api/activities/" + a["id"]).json()["executions"]) == 2
    assert client.get("/api/analytics/overview").json()["actual_sessions"] == 2


def test_review_approval_and_conflict(setup):
    client, engine, _ = setup
    a, e = configure_matching(setup, context=False)
    result = client.post("/api/matching/" + e["id"]).json()
    assert result["decision"] == "HUMAN_REVIEW"
    assert len(client.get("/api/review/queue").json()) == 1
    with Session(engine) as db:
        assert db.scalar(select(Activity)).status == "PLANNED"
    match_id = result["candidates"][0]["id"]
    assert (
        client.post("/api/review/" + match_id + "/approve", json={"reason": "Confirmed by coordinator"}).status_code
        == 200
    )
    assert client.post("/api/review/" + match_id + "/approve", json={"reason": "Duplicate attempt"}).status_code == 409
    assert client.get("/api/review/queue").json() == []
    assert any(a["action"] == "MATCH_APPROVED" for a in client.get("/api/audit/" + e["id"]).json())


def test_reject_classify_manual_map(setup):
    client, engine, _ = setup
    a, e = configure_matching(setup, context=False)
    result = client.post("/api/matching/" + e["id"]).json()
    match_id = result["candidates"][0]["id"]
    assert client.post("/api/review/" + match_id + "/reject", json={"reason": " "}).status_code == 422
    assert client.post("/api/review/" + match_id + "/reject", json={"reason": "Wrong candidate"}).status_code == 200
    assert len(client.get("/api/review/unmatched").json()) == 1
    assert (
        client.post(
            "/api/review/" + e["id"] + "/classify",
            json={"classification": "EXTRA_ACTIVITY", "reason": "Additional session"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/review/" + e["id"] + "/manual-map",
            json={"activity_id": a["id"], "reason": "Verified correct plan entry"},
        ).status_code
        == 200
    )
    with Session(engine) as db:
        assert db.scalar(select(Match)).decision_type == "MANUALLY_MAPPED"
        assert db.scalar(select(func.count(ExecutionLink.id))) == 1


def test_no_candidates_preserved(setup):
    client, engine, _ = setup
    e = event(client, report(client, "Conducted placement aptitude training.")["report_id"])
    result = client.post("/api/matching/" + e["id"]).json()
    assert result["decision"] == "UNMATCHED"
    assert result["candidates"][0]["activity_id"] is None
    assert len(client.get("/api/review/unmatched").json()) == 1
    with Session(engine) as db:
        assert db.scalar(select(func.count(Event.id))) == 1


def workbook(rows):
    book = Workbook()
    sheet = book.active
    for row in rows:
        sheet.append(row)
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


def test_excel_rows_errors_and_metadata(setup):
    client, engine, _ = setup
    content = workbook(
        [
            ["Topic", "Section", "Execution Date", "Subject", "Extra"],
            ["Finished LL implementation", "CSE-C", "25/08/2026", "Data Structures", "preserve me"],
            ["Finished LL implementation", "CSE-C", "25/08/2026", "Data Structures", "preserve me"],
            ["SQL practice", "CSE-C", "bad date", "DBMS", None],
            ["Placement training", None, None, None, "unrelated"],
            [None, None, None, None, None],
        ]
    )
    response = client.post("/api/reports/spreadsheet", files={"file": ("../../reports.xlsx", content)})
    assert response.status_code == 201, response.text
    payload = response.json()
    assert (payload["total_rows"], payload["processed_rows"], payload["failed_rows"]) == (4, 2, 2)
    result = client.get("/api/reports/" + payload["report_id"]).json()
    assert "preserve me" in result["raw_content"]
    assert len(result["events"]) == 2
    assert result["file_metadata"]["original_name"] == "reports.xlsx"
    assert client.post("/api/reports/spreadsheet", files={"file": ("bad.xls", content)}).status_code == 415
    assert client.post("/api/reports/spreadsheet", files={"file": ("bad.xlsx", b"not an excel")}).status_code == 422
    assert client.post("/api/extraction/" + payload["report_id"]).json() == result["events"]


def test_api_validation_and_analytics(setup):
    client, _, _ = setup
    a = plan(client)
    assert client.post("/api/activities", json=a).status_code == 422
    assert client.patch("/api/activities/" + a["id"], json={"completion_percentage": 101}).status_code == 422
    assert client.get("/api/activities?department=ECE").json() == []
    assert client.get("/api/extraction/events/not-a-uuid").status_code == 422
    assert client.get("/api/activities/missing").status_code == 404
    values = client.get("/api/analytics/overview").json()
    assert values["average_actual_duration_minutes"] is None
    assert values["historical_activity"][0]["historical_average"] is None
    for path in ["departments", "courses", "schedule-variance", "historical-activity"]:
        assert client.get("/api/analytics/" + path).status_code == 200
    assert client.get("/api/dashboard/summary").status_code == 200
    assert client.get("/api/audit").status_code == 200


def test_demo_extractor_incomplete_reports():
    extractor = DemoExtractor()
    for text in ["Did SQL practice.", "Ambiguous session.", "Conducted placement aptitude training."]:
        e = extractor.extract(text, date(2026, 8, 25))[0]
        assert e.course is None and e.event_date is None
        assert e.source_excerpt == text
