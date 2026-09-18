import math

from sqlalchemy import select

from app.models import Activity


def retrieve(db, vector, provider, department=None, limit=5):
    statement = select(Activity).where(Activity.embedding_model == provider.model, Activity.embedding.is_not(None))
    if department:
        statement = statement.where(Activity.department == department)
    if db.bind.dialect.name == "postgresql":
        distance = Activity.embedding.cosine_distance(vector)
        statement = statement.add_columns(distance).order_by(distance).limit(limit)
        return [(a, max(0.0, min(1.0, 1 - float(d)))) for a, d in db.execute(statement)]
    # Explicit portable development fallback. Production retrieval uses pgvector.
    candidates = []
    for a in db.scalars(statement):
        denominator = math.sqrt(sum(x * x for x in vector) * sum(x * x for x in a.embedding))
        similarity = sum(x * y for x, y in zip(vector, a.embedding, strict=True)) / denominator if denominator else 0
        candidates.append((a, max(0.0, min(1.0, similarity))))
    return sorted(candidates, key=lambda pair: pair[1], reverse=True)[:limit]
