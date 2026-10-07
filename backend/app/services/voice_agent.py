import json
import logging
import urllib.request
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.extraction.extractor import get_extractor
from app.extraction.service import extract_report
from app.matching.embedding_service import get_embeddings
from app.matching.service import run_matching
from app.models import Activity, Event, Report, User
from app.services.excel_sync import ensure_master_excel, sync_activity_to_excel

logger = logging.getLogger("academicflow.voice_agent")

VOICE_CONVERSATION_SYSTEM = """You are the AcademicFlow Conversational Voice AI assistant speaking with a university professor on a phone call.
Your goal is to politely verify and record their academic teaching progress for today.
Language: You support English, Tamil (தமிழ்), and Tanglish.

Target Information to Gather:
1. Topic / Syllabus unit (e.g., Singly Linked List, Normalization, SQL Joins, CPU Scheduling).
2. Class Section (e.g., CSE-A, CSE-B, CSE-C).
3. Status (COMPLETED or IN_PROGRESS).

Conversation Principles:
- Tone: Respectful, polite, professional ("Professor", "Vanakkam").
- Call Responses: Keep spoken replies very short (1 to 2 spoken sentences maximum).
- Clarification: If essential fields (Topic, Section, or Completion Status) are missing or unclear, ask a friendly clarifying question.
- Completion: If the professor provides clear information or confirms, mark "is_complete": true and give a warm closing statement.
- Bilingual: Provide the spoken reply in both Tamil and English.

Output strictly valid JSON with this schema:
{
  "speech_reply_tamil": "நன்றி புரொபசர். நீங்கள் எந்த வகுப்பிற்கு நடத்தினீர்கள் — CSE-A அல்லது CSE-C?",
  "speech_reply_english": "Thank you Professor. Which section did you take this for — CSE-A or CSE-C?",
  "is_complete": false,
  "extracted_event": {
    "activity_description": "Singly Linked List Implementation",
    "department": "CSE",
    "course": "Data Structures",
    "class_section": "CSE-C",
    "status": "COMPLETED"
  }
}
Note: Set "extracted_event" to null if is_complete is false, or populate with best extracted fields when is_complete is true.
"""

# In-memory storage for active call/chat sessions
ACTIVE_SESSIONS: Dict[str, Dict[str, Any]] = {}


def call_claude_agent(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """Invokes Claude Haiku with conversational history."""
    if not settings.ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    payload = {
        "model": settings.CLAUDE_MODEL,
        "max_tokens": 450,
        "system": VOICE_CONVERSATION_SYSTEM,
        "messages": messages,
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "x-api-key": settings.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        raw_text = data["content"][0]["text"].strip()
        if "```json" in raw_text:
            raw_text = raw_text.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_text:
            raw_text = raw_text.split("```")[1].split("```")[0].strip()
        try:
            return json.loads(raw_text)
        except Exception as exc:
            import re
            logger.warning("JSON parse failed, attempting regex fallback on: %s", raw_text)
            t_match = re.search(r'"speech_reply_tamil":\s*"([^"]+)"', raw_text)
            e_match = re.search(r'"speech_reply_english":\s*"([^"]+)"', raw_text)
            is_comp = '"is_complete": true' in raw_text.lower() or '"is_complete":true' in raw_text.lower()
            return {
                "speech_reply_tamil": t_match.group(1) if t_match else "நன்றி புரொபசர்.",
                "speech_reply_english": e_match.group(1) if e_match else "Thank you Professor.",
                "is_complete": is_comp,
            }


def finalize_session_report(full_raw_text: str, teacher_id: Optional[str] = None):
    """Executes the extraction, matching, and Excel sync pipeline in background."""
    from app.db import engine
    from sqlalchemy.orm import Session
    try:
        with Session(engine()) as db:
            teacher = db.get(User, teacher_id) if teacher_id else None
            if not teacher:
                teacher = db.scalar(select(User).where(User.role == "FACULTY", User.department == "CSE"))
            if not teacher:
                teacher = db.scalar(select(User).where(User.role == "FACULTY"))

            report = Report(source_type="VOICE_TRANSCRIPT", raw_content=full_raw_text, submitted_by=teacher.id if teacher else None)
            db.add(report)
            db.flush()

            extractor = get_extractor()
            extracted_events = extract_report(db, report, teacher, extractor)

            embeddings_provider = get_embeddings()
            for event in extracted_events:
                matches = run_matching(db, event, teacher, embeddings_provider)
                decision = matches[0].decision if matches else event.disposition
                act = matches[0].activity if matches else None
                if decision == "AUTO_LINK" and act:
                    sync_activity_to_excel(act)
            db.commit()
            logger.info("Background voice report successfully processed: %s", full_raw_text)
    except Exception as exc:
        logger.error("Error finalizing background voice report: %s", exc)


def process_voice_turn(session_id: str, user_speech: str, db: Session, user: Optional[User] = None, background_tasks: Any = None) -> Dict[str, Any]:
    """Processes a conversational voice turn with Claude, handling clarifications and fast finalization."""
    session = ACTIVE_SESSIONS.setdefault(session_id, {
        "turns": [],
        "accumulated_transcript": [],
        "is_complete": False,
        "turn_count": 0,
    })

    session["turn_count"] += 1
    session["accumulated_transcript"].append(user_speech)
    session["turns"].append({"role": "user", "content": user_speech})

    # Call conversational AI agent
    try:
        agent_resp = call_claude_agent(session["turns"])
    except Exception as exc:
        logger.error("Claude voice agent error: %s", exc)
        agent_resp = {
            "speech_reply_tamil": "நன்றி புரொபசர். உங்கள் அறிக்கை பதிவு செய்யப்பட்டது.",
            "speech_reply_english": "Thank you Professor. Your report has been noted.",
            "is_complete": True,
            "extracted_event": {
                "activity_description": user_speech,
                "department": "CSE",
                "class_section": "CSE-C",
                "status": "COMPLETED",
            },
        }

    tamil_reply = agent_resp.get("speech_reply_tamil", "நன்றி புரொபசர்.")
    english_reply = agent_resp.get("speech_reply_english", "Thank you Professor.")
    is_complete = agent_resp.get("is_complete", False)

    # Record assistant reply in turn history
    assistant_record = f"{english_reply} ({tamil_reply})"
    session["turns"].append({"role": "assistant", "content": assistant_record})

    # If turn count reaches 6, force complete to avoid endless loops
    if session["turn_count"] >= 6:
        is_complete = True

    match_result = None
    if is_complete:
        session["is_complete"] = True
        full_raw_text = " | ".join(session["accumulated_transcript"])
        
        teacher = user or db.scalar(select(User).where(User.role == "FACULTY", User.department == "CSE"))
        if not teacher:
            teacher = db.scalar(select(User).where(User.role == "FACULTY"))
        teacher_id = str(teacher.id) if teacher else None

        if background_tasks:
            # Dispatch to background task so TwiML returns to Twilio in under 1.5s!
            background_tasks.add_task(finalize_session_report, full_raw_text, teacher_id)
        else:
            # Inline processing for web simulation
            finalize_session_report(full_raw_text, teacher_id)

    return {
        "session_id": session_id,
        "is_complete": is_complete,
        "turn_count": session["turn_count"],
        "speech_reply_tamil": tamil_reply,
        "speech_reply_english": english_reply,
        "match_result": match_result,
        "accumulated_transcript": session["accumulated_transcript"],
    }
