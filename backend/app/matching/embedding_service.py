import hashlib
import math
import re

from openai import OpenAI, OpenAIError

from app.config import settings
from app.extraction.extractor import ProviderError


def normalize(text):
    value = text.lower().replace("dsa", "data structures")
    value = re.sub(r"\bll\b", "linked list", value)
    value = re.sub(r"\blists\b", "list", value)
    return " ".join(re.findall(r"[a-z0-9]+", value))


def activity_text(activity):
    return " | ".join(
        str(getattr(activity, key) or "")
        for key in ["department", "course", "unit", "activity_type", "activity_name", "class_section"]
    )


class Embeddings:
    @property
    def model(self):
        return "demo-hash-v1" if settings.AI_PROVIDER == "demo" else settings.EMBEDDING_MODEL

    def embed(self, text):
        if settings.AI_PROVIDER == "demo":
            # Deterministic lexical vectors for offline plumbing demos, not semantic AI.
            vector = [0.0] * settings.EMBEDDING_DIMENSIONS
            for word in normalize(text).split():
                if word in {"the", "and", "today", "finished", "completed", "for", "did", "covered"}:
                    continue
                index = int(hashlib.sha256(word.encode()).hexdigest()[:8], 16) % len(vector)
                vector[index] += 1
            norm = math.sqrt(sum(v * v for v in vector)) or 1
            return [v / norm for v in vector]
        if not settings.OPENAI_API_KEY:
            raise ProviderError("OPENAI_API_KEY is not configured")
        try:
            response = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=30, max_retries=2).embeddings.create(
                model=settings.EMBEDDING_MODEL, input=text, dimensions=settings.EMBEDDING_DIMENSIONS
            )
            vector = response.data[0].embedding
            if len(vector) != settings.EMBEDDING_DIMENSIONS or not all(math.isfinite(v) for v in vector):
                raise ValueError("Invalid embedding dimensions")
            return vector
        except (OpenAIError, ValueError) as exc:
            raise ProviderError("Embedding provider failed") from exc


def get_embeddings():
    return Embeddings()
