from app.matching.embedding_service import normalize


def equal_signal(source, target):
    if not source or not target:
        return None
    return float(normalize(source) == normalize(target))


def contradictions(event, activity):
    problems = []
    for field in ["course", "department", "class_section"]:
        if equal_signal(getattr(event, field), getattr(activity, field)) == 0:
            problems.append(f"{field} contradicts plan")
    description = normalize(event.activity_description or "")
    if any(term in description for term in ["placement", "aptitude", "sports", "cultural"]):
        if not any(
            term in normalize(activity.activity_name) for term in ["placement", "aptitude", "sports", "cultural"]
        ):
            problems.append("reported activity is outside candidate academic scope")
    return problems
