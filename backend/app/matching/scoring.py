from rapidfuzz.fuzz import token_set_ratio

from app.config import settings
from app.matching.rules import contradictions, equal_signal


def decide(score):
    if score >= settings.AUTO_LINK_THRESHOLD:
        return "AUTO_LINK"
    if score >= settings.HUMAN_REVIEW_THRESHOLD:
        return "HUMAN_REVIEW"
    return "UNMATCHED"


def score(event, activity, semantic):
    signals = {"semantic_score": max(0.0, min(1.0, semantic))}
    for name, field in [
        ("course", "course"),
        ("department", "department"),
        ("class", "class_section"),
        ("unit", "unit"),
        ("faculty", "faculty"),
    ]:
        signals[f"{name}_score"] = equal_signal(getattr(event, field), getattr(activity, field))
    signals["context_score"] = None
    if event.event_date:
        delta = min(
            abs((event.event_date - activity.planned_start).days), abs((event.event_date - activity.planned_end).days)
        )
        signals["context_score"] = (
            1.0 if activity.planned_start <= event.event_date <= activity.planned_end else max(0.0, 1 - delta / 30)
        )
    signals["fuzzy_score"] = token_set_ratio(event.activity_description or "", activity.activity_name) / 100
    weights = {
        "semantic_score": 0.55,
        "course_score": 0.20,
        "department_score": 0.10,
        "class_score": 0.10,
        "context_score": 0.05,
    }
    # Missing evidence contributes zero: never turn absence into corroboration.
    total = sum(weight * (signals[key] or 0) for key, weight in weights.items())
    problems = contradictions(event, activity)
    if problems:
        total = min(total * 0.4, 0.49)
    missing = [key.removesuffix("_score") for key in weights if signals[key] is None]
    reason = f"Semantic similarity {semantic:.1%}; weighted evidence score {total:.1%}."
    if missing:
        reason += " Missing evidence: " + ", ".join(missing) + "."
    if problems:
        reason += " Contradictions: " + "; ".join(problems) + "."
    return {
        **signals,
        "final_confidence": total,
        "match_reason": reason,
        "evidence": {
            "weights": weights,
            "missing": missing,
            "contradictions": problems,
            "auto_threshold": settings.AUTO_LINK_THRESHOLD,
            "review_threshold": settings.HUMAN_REVIEW_THRESHOLD,
        },
    }
