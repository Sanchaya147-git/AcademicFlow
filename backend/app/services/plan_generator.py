import base64
import json
import logging
import urllib.request
from datetime import date, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.config import settings

logger = logging.getLogger("academicflow.plan_generator")

PLAN_GENERATOR_SYSTEM = """You are an expert Academic Dean and Curriculum Planner for engineering institutions.
Your job is to generate a realistic, sequential academic course plan based on a timetable image/PDF or natural language request.

Rules:
1. Each item must represent a distinct lecture or laboratory session.
2. Group sessions logically into Units (e.g., "Unit I — ...", "Unit II — ...").
3. Assign progressive planned start and end dates (spaced on class days, e.g. 2-3 days apart).
4. Strictly return valid JSON: a JSON array of objects.

JSON schema per item:
{
  "activity_name": "Singly Linked List Traversal and Insertion",
  "unit": "Unit II — Linked Structures",
  "activity_type": "Lecture",
  "course": "Data Structures and Algorithms",
  "department": "CSE",
  "class_section": "CSE-C",
  "faculty": "Dr. Ramanathan",
  "planned_start": "2026-10-12",
  "planned_end": "2026-10-12"
}
"""


def _generate_fallback_plan(
    department: str = "CSE",
    course: str = "Data Structures",
    class_section: str = "CSE-C",
    faculty: Optional[str] = "Faculty In-Charge",
    start_date: Optional[date] = None,
    semester: str = "2026 Odd Semester",
    count: int = 8,
) -> List[Dict[str, Any]]:
    """Deterministic fallback generator for offline or demo use."""
    base_date = start_date or (date.today() + timedelta(days=1))
    topics = [
        ("Unit I — Linear Structures", "Introduction to Asymptotic Notation and Space-Time Tradeoffs", "Lecture"),
        ("Unit I — Linear Structures", "One-Dimensional and Multi-Dimensional Arrays", "Lecture"),
        ("Unit I — Linear Structures", "Array Operations and Benchmark Analysis", "Practical"),
        ("Unit II — Linked Structures", "Singly Linked List Node Creation and Traversal", "Lecture"),
        ("Unit II — Linked Structures", "Insertion and Deletion Operations in Singly Linked List", "Lecture"),
        ("Unit II — Linked Structures", "Doubly Linked List and Circular Linked List Implementation", "Practical"),
        ("Unit III — Stacks & Queues", "Stack Operations: Push, Pop, Peek and Expression Evaluation", "Lecture"),
        ("Unit III — Stacks & Queues", "Queue Implementation using Arrays and Linked Lists", "Lecture"),
    ]

    results = []
    for idx, (unit, topic, act_type) in enumerate(topics[:count]):
        day_offset = idx * 2  # spaced every 2 days
        p_date = base_date + timedelta(days=day_offset)
        # Avoid weekends
        if p_date.weekday() == 5:  # Saturday
            p_date += timedelta(days=2)
        elif p_date.weekday() == 6:  # Sunday
            p_date += timedelta(days=1)

        code_prefix = "".join([w[0] for w in course.split()]).upper() or "SUB"
        sec = class_section.replace("-", "").upper()
        act_id = f"{department}-{code_prefix}-{sec}-{idx+1:03d}"

        results.append(
            {
                "activity_id": act_id,
                "semester": semester,
                "department": department,
                "course": course,
                "unit": unit,
                "activity_name": topic,
                "activity_type": act_type,
                "faculty": faculty,
                "class_section": class_section,
                "planned_start": p_date.isoformat(),
                "planned_end": p_date.isoformat(),
                "level": 5,
            }
        )
    return results


def generate_plan_from_prompt_or_file(
    prompt: Optional[str] = None,
    file_bytes: Optional[bytes] = None,
    filename: Optional[str] = None,
    content_type: Optional[str] = None,
    department: str = "CSE",
    course: str = "Data Structures",
    class_section: str = "CSE-C",
    faculty: Optional[str] = None,
    start_date: Optional[date] = None,
    semester: str = "2026 Odd Semester",
) -> List[Dict[str, Any]]:
    """Extracts or prompts an academic plan from image/PDF/prompt using Claude Haiku."""
    if not settings.ANTHROPIC_API_KEY:
        logger.info("ANTHROPIC_API_KEY not configured, using fallback academic plan generator")
        return _generate_fallback_plan(
            department=department,
            course=course,
            class_section=class_section,
            faculty=faculty,
            start_date=start_date,
            semester=semester,
        )

    base_date = start_date or (date.today() + timedelta(days=1))
    messages = []
    content_blocks: List[Dict[str, Any]] = []

    if file_bytes and content_type:
        b64_data = base64.b64encode(file_bytes).decode("utf-8")
        if content_type in ["image/png", "image/jpeg", "image/webp", "image/gif"]:
            content_blocks.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": content_type,
                        "data": b64_data,
                    },
                }
            )
        elif content_type == "application/pdf":
            content_blocks.append(
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": b64_data,
                    },
                }
            )

    user_instruction = (
        f"Generate a sequence of academic activities for:\n"
        f"Department: {department}\n"
        f"Course: {course}\n"
        f"Class Section: {class_section}\n"
        f"Faculty: {faculty or 'Course In-Charge'}\n"
        f"Starting date: {base_date.isoformat()}\n"
        f"Semester: {semester}\n"
    )
    if prompt:
        user_instruction += f"\nHOD Specific Instructions: {prompt}\n"
    if file_bytes:
        user_instruction += "\nExtract the class timetable slots, subjects, and topics from the attached file."

    user_instruction += "\nProvide 6 to 8 sequential scheduled sessions. Keep each activity_name concise (under 8 words). Return strictly a JSON array of objects without commentary."
    content_blocks.append({"type": "text", "text": user_instruction})

    messages.append({"role": "user", "content": content_blocks})

    payload = {
        "model": settings.CLAUDE_MODEL,
        "max_tokens": 2500,
        "system": PLAN_GENERATOR_SYSTEM,
        "messages": messages,
    }

    try:
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw_text = data["content"][0]["text"].strip()
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0].strip()

            parsed = json.loads(raw_text)
            if not isinstance(parsed, list):
                if isinstance(parsed, dict) and "activities" in parsed:
                    parsed = parsed["activities"]
                else:
                    parsed = [parsed]

            # Normalize and augment IDs
            normalized = []
            for idx, item in enumerate(parsed):
                dept = item.get("department") or department
                crs = item.get("course") or course
                sec = (item.get("class_section") or class_section).replace("-", "").upper()
                code_prefix = "".join([w[0] for w in crs.split()]).upper() or "SUB"
                act_id = f"{dept}-{code_prefix}-{sec}-{idx+1:03d}"

                normalized.append(
                    {
                        "activity_id": act_id,
                        "semester": semester,
                        "department": dept,
                        "course": crs,
                        "unit": item.get("unit") or f"Unit {idx // 3 + 1}",
                        "activity_name": item.get("activity_name") or f"Lecture {idx + 1}",
                        "activity_type": item.get("activity_type") or "Lecture",
                        "faculty": item.get("faculty") or faculty,
                        "class_section": item.get("class_section") or class_section,
                        "planned_start": item.get("planned_start") or base_date.isoformat(),
                        "planned_end": item.get("planned_end") or item.get("planned_start") or base_date.isoformat(),
                        "level": 5,
                    }
                )
            return normalized

    except Exception as exc:
        logger.warning("Claude plan generation failed (%s), using fallback generator", exc)
        return _generate_fallback_plan(
            department=department,
            course=course,
            class_section=class_section,
            faculty=faculty,
            start_date=start_date,
            semester=semester,
        )
