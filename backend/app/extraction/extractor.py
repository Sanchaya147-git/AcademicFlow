import re
from datetime import date
from typing import Protocol

from openai import OpenAI, OpenAIError
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.extraction.prompts import SYSTEM_PROMPT
from app.schemas import Extracted


class ProviderError(Exception):
    pass


class ExtractionBatch(BaseModel):
    events: list[Extracted]


class Extractor(Protocol):
    def extract(self, text: str, report_date: date) -> list[Extracted]: ...


class OpenAIExtractor:
    def extract(self, text, report_date):
        if not settings.OPENAI_API_KEY:
            raise ProviderError("OPENAI_API_KEY is not configured")
        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=30, max_retries=2)
            response = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT + f"\nreport_date={report_date.isoformat()}"},
                    {"role": "user", "content": text},
                ],
            )
            batch = ExtractionBatch.model_validate_json(response.choices[0].message.content or "")
            if not 1 <= len(batch.events) <= 50:
                raise ValueError("Expected 1–50 events")
            for event in batch.events:
                if not event.source_excerpt or event.source_excerpt not in text:
                    raise ValueError("Source excerpt must be exact source evidence")
            return batch.events
        except (OpenAIError, ValidationError, ValueError) as exc:
            raise ProviderError("Extraction provider failed or returned invalid evidence") from exc


class DemoExtractor:
    """Explicit offline demonstration provider, NOT an LLM or production extractor."""

    def extract(self, text, report_date):
        lower = text.lower()
        section = re.search(r"\b(?:CSE|ECE|EEE|MECH)-[A-Z]\b", text, re.I)
        course = next(
            (
                c
                for c in ["Data Structures", "DBMS", "Operating Systems", "Computer Networks", "Machine Learning"]
                if c.lower() in lower
            ),
            None,
        )
        pct = re.search(r"\b(100|[0-9]{1,2})\s*%", text)
        explicit_date = re.search(r"\b\d{4}-\d{2}-\d{2}\b", text)
        event_date = (
            date.fromisoformat(explicit_date[0]) if explicit_date else (report_date if "today" in lower else None)
        )
        return [
            Extracted(
                activity_description=text,
                course=course,
                class_section=section[0].upper() if section else None,
                event_date=event_date,
                source_excerpt=text,
                status="COMPLETED" if re.search(r"\b(finished|completed)\b", lower) else None,
                completion_percentage=float(pct[1]) if pct else None,
            )
        ]


class ClaudeExtractor:
    def extract(self, text: str, report_date: date) -> list[Extracted]:
        if not settings.ANTHROPIC_API_KEY:
            raise ProviderError("ANTHROPIC_API_KEY is not configured")
        import json
        import urllib.request

        payload = {
            "model": settings.CLAUDE_MODEL,
            "max_tokens": 1024,
            "system": SYSTEM_PROMPT + f"\nreport_date={report_date.isoformat()}\nReturn strictly valid JSON only.",
            "messages": [{"role": "user", "content": text}],
        }
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps(payload).encode(),
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
                content = data["content"][0]["text"].strip()
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                batch = ExtractionBatch.model_validate_json(content)
                if not 1 <= len(batch.events) <= 50:
                    raise ValueError("Expected 1–50 events")
                for event in batch.events:
                    if not event.source_excerpt or event.source_excerpt not in text:
                        event.source_excerpt = text
                return batch.events
        except Exception as exc:
            raise ProviderError(f"Claude extraction failed: {exc}") from exc


def get_extractor() -> Extractor:
    if settings.AI_PROVIDER == "claude":
        return ClaudeExtractor()
    return DemoExtractor() if settings.AI_PROVIDER == "demo" else OpenAIExtractor()
