from sqlalchemy import select

from app.config import settings
from app.matching.candidate_retrieval import retrieve
from app.matching.embedding_service import normalize
from app.matching.scoring import decide, score
from app.models import Match
from app.services.audit import record
from app.services.review import lock_event, synchronize


def run_matching(db, event, user, provider):
    event = lock_event(db, event.id)
    existing = db.scalars(select(Match).where(Match.event_id == event.id).order_by(Match.final_confidence.desc())).all()
    if existing or event.disposition not in {"PENDING", "UNMATCHED"}:
        return existing
    event.normalized_concept = normalize(event.activity_description or event.source_excerpt or "")
    text = " | ".join(
        str(v) for v in [event.normalized_concept, event.course, event.department, event.class_section, event.unit] if v
    )
    candidates = retrieve(db, provider.embed(text), provider, None if user.role == "ADMIN" else user.department)
    scored = sorted(
        [(a, score(event, a, sim)) for a, sim in candidates], key=lambda pair: pair[1]["final_confidence"], reverse=True
    )
    if len(scored) > 1 and scored[0][1]["final_confidence"] - scored[1][1]["final_confidence"] < 0.05:
        for _, result in scored:
            if result["final_confidence"] >= settings.AUTO_LINK_THRESHOLD:
                result["final_confidence"] = max(settings.HUMAN_REVIEW_THRESHOLD, settings.AUTO_LINK_THRESHOLD - 0.001)
                result["match_reason"] += " Auto-link blocked: competing candidates within 5 percentage points."
    decision = decide(scored[0][1]["final_confidence"]) if scored else "UNMATCHED"
    event.disposition = decision
    results = []
    for activity, result in scored:
        match = Match(
            event_id=event.id,
            activity_id=activity.id,
            decision=decision,
            decision_type="PENDING" if decision == "HUMAN_REVIEW" else "UNMATCHED",
            **result,
        )
        match.evidence = {**match.evidence, "provider": provider.model, "source_excerpt": event.source_excerpt}
        db.add(match)
        results.append(match)
    if not results:
        match = Match(
            event_id=event.id,
            activity_id=None,
            final_confidence=0,
            decision="UNMATCHED",
            decision_type="UNMATCHED",
            match_reason="No indexed candidate in accessible plan. Event preserved.",
            evidence={"provider": provider.model},
        )
        db.add(match)
        results.append(match)
    db.flush()
    record(
        db,
        user,
        "MATCH_CREATED",
        event=event,
        new={
            "decision": decision,
            "candidates": [
                {
                    "id": str(m.id),
                    "activity_id": str(m.activity_id),
                    "confidence": m.final_confidence,
                    "reason": m.match_reason,
                }
                for m in results
            ],
        },
    )
    if decision == "AUTO_LINK":
        top = results[0]
        top.decision_type = "AUTO_LINKED"
        for other in results[1:]:
            other.decision_type = "SUPERSEDED"
        synchronize(db, event, scored[0][0], user, "AUTO_LINKED")
    else:
        record(db, user, "REVIEW_CREATED" if decision == "HUMAN_REVIEW" else "UNMATCHED", event=event)
    return results
