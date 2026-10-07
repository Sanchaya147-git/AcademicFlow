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
    # Highest percentage candidate approves automatically; remaining candidates queued for review
    min_auto = min(settings.AUTO_LINK_THRESHOLD, 0.40)
    has_match = bool(scored and scored[0][1]["final_confidence"] >= min_auto)
    top_decision = "AUTO_LINK" if has_match else ("HUMAN_REVIEW" if scored and scored[0][1]["final_confidence"] >= 0.20 else "UNMATCHED")
    event.disposition = top_decision
    results = []
    for idx, (activity, result) in enumerate(scored):
        if idx == 0 and top_decision == "AUTO_LINK":
            m_decision = "AUTO_LINK"
            m_decision_type = "AUTO_LINKED"
            result["match_reason"] = f"Top-ranked candidate ({result['final_confidence']:.1%}) automatically approved. " + result["match_reason"]
        elif idx > 0 and top_decision == "AUTO_LINK":
            m_decision = "HUMAN_REVIEW"
            m_decision_type = "PENDING"
            result["match_reason"] = f"Alternative candidate ({result['final_confidence']:.1%}) queued for review. " + result["match_reason"]
        else:
            m_decision = top_decision
            m_decision_type = "PENDING" if top_decision == "HUMAN_REVIEW" else "UNMATCHED"

        match = Match(
            event_id=event.id,
            activity_id=activity.id,
            decision=m_decision,
            decision_type=m_decision_type,
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
            "decision": top_decision,
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
    if top_decision == "AUTO_LINK":
        synchronize(db, event, scored[0][0], user, "AUTO_LINKED")
    else:
        record(db, user, "REVIEW_CREATED" if top_decision == "HUMAN_REVIEW" else "UNMATCHED", event=event)
    return results
