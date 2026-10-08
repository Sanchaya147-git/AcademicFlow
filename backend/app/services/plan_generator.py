import base64
import json
import logging
import re
import urllib.request
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from app.config import settings

logger = logging.getLogger("academicflow.plan_generator")

PLAN_GENERATOR_SYSTEM = """You are an expert Academic Dean and Curriculum Planner for engineering institutions.
Your job is to generate a realistic, sequential academic course plan based on a timetable image/PDF or natural language request.

OCR INSTRUCTIONS:
- If a timetable image or PDF is attached, perform optical character recognition (OCR) on all rows, columns, days, periods, and subject codes.
- Identify the courses, faculty, and weekly class slots from the visual timetable.
- Generate distinct sequentially dated academic activities for each slot.
- Provide clear, descriptive topic names for each lecture/practical session.

OUTPUT RULES:
- Return ONLY a raw JSON array of objects. Do not write any conversational text before or after the JSON.
- Output schema per item:
[
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
]
"""


def _generate_dynamic_fallback(
    department: str = "CSE",
    course: str = "Computer Science",
    class_section: str = "CSE-A",
    faculty: Optional[str] = "Faculty In-Charge",
    start_date: Optional[date] = None,
    semester: str = "2026 Odd Semester",
    count: int = 8,
) -> List[Dict[str, Any]]:
    """Generates a dynamic, course-relevant curriculum schedule when offline or without API key."""
    base_date = start_date or (date.today() + timedelta(days=1))
    is_all_courses = course.strip().upper() in ["ALL", "ALL COURSES", "AUTO", "*"] or not course.strip()

    if is_all_courses:
        # Generate multi-course timetable schedule covering core department subjects
        all_modules = [
            ("Data Structures", "Unit I — Linked Structures", "Singly Linked List Implementation & Pointer Manipulation", "Lecture", "Dr. Ramanathan"),
            ("Data Structures", "Unit I — Linked Structures", "Doubly Linked List Deletion & Traversal Lab", "Practical", "Dr. Ramanathan"),
            ("Database Systems", "Unit I — Relational Models", "Relational Algebra & Entity Relationship Modeling", "Lecture", "Prof. Anitha"),
            ("Database Systems", "Unit II — SQL & Normalization", "SQL Joins, Group By Queries & BCNF Decomposition", "Lecture", "Prof. Anitha"),
            ("Operating Systems", "Unit I — Process Management", "Process Lifecycle, Forking & CPU Scheduling Algorithms", "Lecture", "Dr. Suresh"),
            ("Operating Systems", "Unit II — Concurrency", "Semaphores, Mutex Locks & Producer-Consumer Problem", "Lecture", "Dr. Suresh"),
            ("Computer Networks", "Unit I — OSI & TCP/IP", "Transport Layer Protocols, TCP Handshake & Congestion Control", "Lecture", "Prof. Priya"),
            ("Data Structures", "Unit II — Stacks & Queues", "Array-based Stack Evaluation & Infix to Postfix Conversion", "Lecture", "Dr. Ramanathan"),
        ]
        results = []
        for idx, (crs_name, unit, topic, act_type, default_fac) in enumerate(all_modules[:count]):
            day_offset = idx * 2
            p_date = base_date + timedelta(days=day_offset)
            if p_date.weekday() == 5:
                p_date += timedelta(days=2)
            elif p_date.weekday() == 6:
                p_date += timedelta(days=1)
            code_prefix = "".join([w[0] for w in crs_name.split() if w]).upper() or "SUB"
            sec = class_section.replace("-", "").upper()
            act_id = f"{department}-{code_prefix}-{sec}-{idx+1:03d}"
            results.append({
                "activity_id": act_id,
                "semester": semester,
                "department": department,
                "course": crs_name,
                "unit": unit,
                "activity_name": topic,
                "activity_type": act_type,
                "faculty": faculty if faculty and ":" not in faculty else default_fac,
                "class_section": class_section,
                "planned_start": p_date.isoformat(),
                "planned_end": p_date.isoformat(),
                "level": 5,
            })
        return results

    # Standard single course progression template
    modules = [
        ("Unit I — Foundations & Overview", f"Introduction and Core Principles of {course}", "Lecture"),
        ("Unit I — Foundations & Overview", f"Theoretical Architecture and Formal Models in {course}", "Lecture"),
        ("Unit II — Core Techniques", f"Primary Algorithms and Implementations for {course}", "Lecture"),
        ("Unit II — Core Techniques", f"Hands-on Lab Implementation Session 1", "Practical"),
        ("Unit III — Advanced Concepts", f"Advanced Optimization and Case Studies in {course}", "Lecture"),
        ("Unit III — Advanced Concepts", f"Hands-on Lab Implementation Session 2", "Practical"),
        ("Unit IV — System Applications", f"Integration, Scalability, and Industry Patterns", "Lecture"),
        ("Unit V — Review & Evaluation", f"Comprehensive Project Review and Technical Seminar", "Tutorial"),
    ]

    results = []
    for idx, (unit, topic, act_type) in enumerate(modules[:count]):
        day_offset = idx * 2
        p_date = base_date + timedelta(days=day_offset)
        if p_date.weekday() == 5:
            p_date += timedelta(days=2)
        elif p_date.weekday() == 6:
            p_date += timedelta(days=1)

        code_prefix = "".join([w[0] for w in course.split() if w]).upper() or "SUB"
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


def _parse_claude_json_response(raw_text: str) -> List[Dict[str, Any]]:
    """Robustly extracts JSON array or nested structure from Claude response."""
    text = raw_text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()

    parsed = None
    # 1. Try direct parse
    try:
        parsed = json.loads(text)
    except Exception:
        pass

    # 2. Try JSONDecoder raw_decode starting from first [ or {
    if parsed is None:
        decoder = json.JSONDecoder()
        for start_char in ("[", "{"):
            idx = text.find(start_char)
            if idx != -1:
                try:
                    obj, _ = decoder.raw_decode(text[idx:])
                    parsed = obj
                    break
                except Exception:
                    pass

    # 3. Fallback to regex finding array
    if parsed is None:
        array_match = re.search(r"\[\s*\{.*\}\s*\]", text, re.DOTALL)
        if array_match:
            try:
                parsed = json.loads(array_match.group(0))
            except Exception:
                pass

    # 4. Fallback to extracting all JSON object blocks if NDJSON or stream
    if parsed is None:
        items = []
        for block in re.findall(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", text, re.DOTALL):
            try:
                item = json.loads(block)
                if isinstance(item, dict) and any(k in item for k in ("activity_id", "activity_name", "topic", "course")):
                    items.append(item)
            except Exception:
                pass
        if items:
            return items

    if parsed is None:
        raise ValueError("No valid JSON found in Claude response")

    # If top-level object, find any contained list
    if isinstance(parsed, dict):
        for candidate_key in [
            "activities",
            "lectures",
            "sessions",
            "timetable",
            "schedule",
            "classes",
            "items",
            "syllabus",
            "curriculum",
            "data",
        ]:
            if candidate_key in parsed and isinstance(parsed[candidate_key], list):
                return parsed[candidate_key]
        return [parsed]

    if isinstance(parsed, list):
        return parsed

    return []


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
        logger.warning("ANTHROPIC_API_KEY not configured, using dynamic plan fallback")
        return _generate_dynamic_fallback(
            department=department,
            course=course,
            class_section=class_section,
            faculty=faculty,
            start_date=start_date,
            semester=semester,
        )

    base_date = start_date or (date.today() + timedelta(days=1))
    content_blocks: List[Dict[str, Any]] = []

    # Detect & normalize media type from file extension and header
    if file_bytes:
        ext = (filename or "").lower().split(".")[-1]
        resolved_media = content_type or "application/octet-stream"

        if ext in ["png", "jpg", "jpeg", "webp", "gif"] or "image" in resolved_media:
            img_format = "jpeg" if ext in ["jpg", "jpeg"] else (ext if ext in ["png", "webp", "gif"] else "png")
            b64_data = base64.b64encode(file_bytes).decode("utf-8")
            content_blocks.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": f"image/{img_format}",
                        "data": b64_data,
                    },
                }
            )
            logger.info("Attached image for OCR parsing (%s, %d bytes)", img_format, len(file_bytes))
        elif ext == "pdf" or "pdf" in resolved_media:
            b64_data = base64.b64encode(file_bytes).decode("utf-8")
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
            logger.info("Attached PDF document for syllabus extraction (%d bytes)", len(file_bytes))

    # Construct user prompt
    is_all_courses = course.strip().upper() in ["ALL", "ALL COURSES", "AUTO", "*"] or not course.strip()
    if is_all_courses:
        user_instruction = (
            f"Generate a comprehensive, sequential curriculum plan for ALL COURSES found in the timetable or prompt:\n"
            f"Department: {department}\n"
            f"Target Scope: ALL COURSES (extract every individual subject code and course name from the timetable or instructions)\n"
            f"Class Section: {class_section}\n"
            f"Curriculum Start Date: {base_date.isoformat()}\n"
            f"Semester: {semester}\n"
        )
        if faculty:
            user_instruction += (
                f"\nTeacher / Subject Handlers specified by HOD: {faculty}\n"
                "Assign each course/activity to its designated teacher based on this mapping or the timetable legend.\n"
            )
        else:
            user_instruction += "\nExtract the teacher/faculty name assigned to each subject directly from the timetable rows, columns, or legend.\n"
        if file_bytes:
            user_instruction += (
                "\nOCR MULTI-COURSE INSTRUCTIONS: Perform OCR on the attached timetable image/PDF. "
                "Scan all rows, columns, and days. Extract every distinct course, its subject code, "
                "its assigned faculty instructor, and its weekly time slots. "
                "Generate sequentially scheduled sessions covering each course."
            )
    else:
        user_instruction = (
            f"Generate a sequence of academic activities for:\n"
            f"Department: {department}\n"
            f"Course: {course}\n"
            f"Class Section: {class_section}\n"
            f"Faculty: {faculty or 'Course In-Charge'}\n"
            f"Starting date: {base_date.isoformat()}\n"
            f"Semester: {semester}\n"
        )
        if file_bytes:
            user_instruction += (
                f"\nExtract the timetable slots for {course} from the attached file. "
                "For each class slot found, construct a scheduled lecture with sequential dates."
            )

    if prompt:
        user_instruction += f"\nHOD Specific Instructions & Curriculum Topics: {prompt}\n"

    user_instruction += (
        "\nProvide 8 to 12 sequential scheduled sessions. "
        "Return strictly a raw JSON array of objects without commentary or conversational prelude."
    )
    content_blocks.append({"type": "text", "text": user_instruction})

    payload = {
        "model": settings.CLAUDE_MODEL,
        "max_tokens": 2500,
        "system": PLAN_GENERATOR_SYSTEM,
        "messages": [{"role": "user", "content": content_blocks}],
    }

    try:
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "anthropic-beta": "pdfs-2024-09-25",
                "content-type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw_text = data["content"][0]["text"].strip()
            items = _parse_claude_json_response(raw_text)

            normalized = []
            for idx, item in enumerate(items):
                dept = item.get("department") or department
                crs = item.get("course") or item.get("subject") or item.get("course_name") or course
                sec = (item.get("class_section") or item.get("section") or class_section).replace("-", "").upper()

                # Flexible topic/activity name extraction
                topic_name = (
                    item.get("activity_name")
                    or item.get("topic")
                    or item.get("title")
                    or item.get("subject_name")
                    or item.get("name")
                    or f"Session {idx + 1}"
                )

                unit_name = (
                    item.get("unit")
                    or item.get("module")
                    or item.get("chapter")
                    or f"Unit {idx // 3 + 1}"
                )

                act_type = (
                    item.get("activity_type")
                    or item.get("type")
                    or item.get("session_type")
                    or "Lecture"
                )

                # Date calculation
                day_offset = idx * 2
                p_date = base_date + timedelta(days=day_offset)
                if p_date.weekday() == 5:
                    p_date += timedelta(days=2)
                elif p_date.weekday() == 6:
                    p_date += timedelta(days=1)

                p_start = item.get("planned_start") or p_date.isoformat()
                p_end = item.get("planned_end") or p_start

                code_prefix = "".join([w[0] for w in crs.split() if w]).upper() or "SUB"
                act_id = f"{dept}-{code_prefix}-{sec}-{idx+1:03d}"

                normalized.append(
                    {
                        "activity_id": act_id,
                        "semester": semester,
                        "department": dept,
                        "course": crs,
                        "unit": unit_name,
                        "activity_name": str(topic_name),
                        "activity_type": act_type,
                        "faculty": item.get("faculty") or item.get("teacher") or faculty,
                        "class_section": item.get("class_section") or class_section,
                        "planned_start": str(p_start)[:10],
                        "planned_end": str(p_end)[:10],
                        "level": 5,
                    }
                )

            logger.info("Successfully parsed %d activities via Claude for %s", len(normalized), course)
            return normalized

    except Exception as exc:
        logger.warning("Claude plan generation failed (%s), using dynamic fallback generator", exc)
        return _generate_dynamic_fallback(
            department=department,
            course=course,
            class_section=class_section,
            faculty=faculty,
            start_date=start_date,
            semester=semester,
        )
