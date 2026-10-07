import json
import logging
import os
import urllib.request
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.extraction.extractor import get_extractor
from app.extraction.service import extract_report
from app.matching.embedding_service import get_embeddings
from app.matching.service import run_matching
from app.models import Activity, Event, Report, User
from app.services.excel_sync import ensure_master_excel, sync_activity_to_excel

logger = logging.getLogger("academicflow.whatsapp")
router = APIRouter(prefix="/api/webhook")


import base64
import urllib.parse

def send_twilio_reply(to_number: str, text: str):
    """Sends a WhatsApp text message via Twilio REST API."""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.warning("Twilio credentials not configured; skipping Twilio reply")
        return
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    to_formatted = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number
    from_formatted = f"whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}" if not settings.TWILIO_WHATSAPP_NUMBER.startswith("whatsapp:") else settings.TWILIO_WHATSAPP_NUMBER
    
    data = urllib.parse.urlencode({
        "To": to_formatted,
        "From": from_formatted,
        "Body": text,
    }).encode("utf-8")
    
    auth_str = f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}"
    auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Basic {auth_b64}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info("Twilio WhatsApp reply sent to %s: HTTP %s", to_number, resp.status)
    except Exception as exc:
        logger.error("Failed to send Twilio WhatsApp reply to %s: %s", to_number, exc)


def send_whatsapp_reply(to_number: str, text: str):
    """Sends a text message back to WhatsApp via Twilio if configured, or Meta Cloud API."""
    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
        send_twilio_reply(to_number, text)
        return

    if not settings.WHATSAPP_ACCESS_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        logger.warning("WhatsApp credentials not configured; skipping reply")
        return
    url = f"https://graph.facebook.com/v22.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": text},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info("WhatsApp reply sent to %s: HTTP %s", to_number, resp.status)
    except Exception as exc:
        logger.error("Failed to send WhatsApp reply to %s: %s", to_number, exc)


@router.get("/whatsapp")
def verify_whatsapp_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
):
    """Handles Meta's initial Webhook verification handshake."""
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("Meta WhatsApp webhook verified successfully.")
        return Response(content=hub_challenge, media_type="text/plain")
    logger.warning("Webhook verification failed: token=%s, expected=%s", hub_verify_token, settings.WHATSAPP_VERIFY_TOKEN)
    raise HTTPException(status_code=403, detail="Verification token mismatch")


@router.post("/whatsapp")
async def handle_whatsapp_message(request: Request, db: Session = Depends(get_db)):
    """Receives incoming messages from Meta WhatsApp webhook."""
    body = await request.json()
    logger.info("Received WhatsApp webhook payload: %s", json.dumps(body)[:300])

    # Ensure master Excel plan is initialized
    activities = db.scalars(select(Activity)).all()
    ensure_master_excel(activities)

    # Process entry changes
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            val = change.get("value", {})
            messages = val.get("messages", [])
            for msg in messages:
                if msg.get("type") != "text":
                    continue
                sender_phone = msg.get("from")
                text_content = msg.get("text", {}).get("body", "").strip()
                if not text_content:
                    continue

                logger.info("Processing message from %s: %s", sender_phone, text_content)

                # Find Teacher account (or default to CSE faculty)
                teacher = db.scalar(select(User).where(User.role == "FACULTY", User.department == "CSE"))
                if not teacher:
                    teacher = db.scalar(select(User).where(User.role == "FACULTY"))
                if not teacher:
                    logger.error("No teacher user found in database to attribute report to.")
                    continue

                # 1. Create Report
                report = Report(source_type="FREE_TEXT", raw_content=text_content, submitted_by=teacher.id)
                db.add(report)
                db.flush()

                # 2. Extract Event(s) using Claude
                extractor = get_extractor()
                extracted_events = extract_report(db, report, teacher, extractor)

                # 3. Match each event against academic plan
                embeddings_provider = get_embeddings()
                summary_messages = []
                for event in extracted_events:
                    matches = run_matching(db, event, teacher, embeddings_provider)
                    decision = matches[0].decision if matches else event.disposition
                    confidence = round(matches[0].final_confidence * 100, 1) if matches else 0

                    if decision == "AUTO_LINK":
                        act = matches[0].activity
                        act_name = act.activity_name if act else "Planned Activity"
                        act_id = act.activity_id if act else ""
                        if act:
                            sync_activity_to_excel(act)
                        msg_reply = (
                            f"AUTO-LINKED ({confidence}% confidence)\n"
                            f"Activity: {act_name} [{act_id}]\n"
                            f"Excel & Master Plan marked as COMPLETED."
                        )
                    elif decision == "HUMAN_REVIEW":
                        act = matches[0].activity
                        act_name = act.activity_name if act else "Candidate Activity"
                        msg_reply = (
                            f"QUEUED FOR HOD REVIEW ({confidence}% confidence)\n"
                            f"Suggested candidate: {act_name}\n"
                            f"Your HOD has been notified in AcademicFlow."
                        )
                    else:
                        msg_reply = (
                            f"UNMATCHED ({confidence}% confidence)\n"
                            f"Report logged, but no matching syllabus topic found."
                        )
                    summary_messages.append(msg_reply)

                db.commit()

                # Send WhatsApp reply back to sender
                full_reply = "AcademicFlow Update:\n\n" + "\n\n".join(summary_messages)
                send_whatsapp_reply(sender_phone, full_reply)

    return {"status": "ok"}


@router.api_route("/twilio", methods=["GET", "POST"])
@router.api_route("/twilio/", methods=["GET", "POST"])
@router.api_route(r"/twilio\\", methods=["GET", "POST"])
async def handle_twilio_message(request: Request, db: Session = Depends(get_db)):
    """Receives incoming messages from Twilio WhatsApp Sandbox webhook."""
    form_data = await request.form()
    sender = form_data.get("From", "").replace("whatsapp:", "")
    text_content = form_data.get("Body", "").strip()
    
    logger.info("Received Twilio WhatsApp message from %s: %s", sender, text_content)
    if not text_content:
        return Response(content="<Response></Response>", media_type="text/xml")

    # Handle Sandbox opt-in commands gracefully
    if text_content.lower().startswith("join ") or text_content.lower() == "join":
        welcome_twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>AcademicFlow Connected! 🎓

Welcome Professor. You can now text your daily class execution updates directly in this chat.

Example:
"Taught Quantum Cryptography &amp; Quantum Machine Learning: Advanced Cryptographic Techniques for CSE-C today. It was partially completed."</Message>
</Response>"""
        return Response(content=welcome_twiml, media_type="text/xml")

    # Ensure master Excel plan is initialized
    activities = db.scalars(select(Activity)).all()
    ensure_master_excel(activities)

    # Find Teacher account
    teacher = db.scalar(select(User).where(User.role == "FACULTY", User.department == "CSE"))
    if not teacher:
        teacher = db.scalar(select(User).where(User.role == "FACULTY"))
    if not teacher:
        logger.error("No teacher user found in database.")
        return Response(content="<Response></Response>", media_type="text/xml")

    # 1. Create Report
    report = Report(source_type="FREE_TEXT", raw_content=text_content, submitted_by=teacher.id)
    db.add(report)
    db.flush()

    # 2. Extract Event(s) using Claude
    extractor = get_extractor()
    extracted_events = extract_report(db, report, teacher, extractor)

    # 3. Match each event against academic plan
    embeddings_provider = get_embeddings()
    summary_messages = []
    for event in extracted_events:
        matches = run_matching(db, event, teacher, embeddings_provider)
        decision = matches[0].decision if matches else event.disposition
        confidence = round(matches[0].final_confidence * 100, 1) if matches else 0

        if decision == "AUTO_LINK":
            act = matches[0].activity
            act_name = act.activity_name if act else "Planned Activity"
            act_id = act.activity_id if act else ""
            if act:
                sync_activity_to_excel(act)
            msg_reply = (
                f"AUTO-LINKED ({confidence}% confidence)\n"
                f"Activity: {act_name} [{act_id}]\n"
                f"Excel & Master Plan marked as COMPLETED."
            )
        elif decision == "HUMAN_REVIEW":
            act = matches[0].activity
            act_name = act.activity_name if act else "Candidate Activity"
            msg_reply = (
                f"QUEUED FOR HOD REVIEW ({confidence}% confidence)\n"
                f"Suggested candidate: {act_name}\n"
                f"Your HOD has been notified in AcademicFlow."
            )
        else:
            msg_reply = (
                f"UNMATCHED ({confidence}% confidence)\n"
                f"Report logged, but no matching syllabus topic found."
            )
        summary_messages.append(msg_reply)

    db.commit()

    # Return reply directly inside TwiML XML with text/xml (Twilio requires text/xml to avoid error 12300)
    import html
    full_reply = "AcademicFlow Update:\n\n" + "\n\n".join(summary_messages)
    escaped_reply = html.escape(full_reply)
    twiml = f'<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n    <Message>{escaped_reply}</Message>\n</Response>'
    return Response(content=twiml, media_type="text/xml")


from app.services.voice_agent import process_voice_turn


def _get_public_base_url(request: Request) -> str:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    proto = request.headers.get("x-forwarded-proto") or "https"
    if host and "localhost" not in host and "127.0.0.1" not in host:
        return f"{proto}://{host}"
    return settings.TUNNEL_URL


@router.api_route("/voice/prompt", methods=["GET", "POST"])
@router.api_route("/voice/prompt/", methods=["GET", "POST"])
@router.api_route(r"/voice/prompt\\", methods=["GET", "POST"])
@router.api_route("/voice/incoming", methods=["GET", "POST"])
@router.api_route("/voice/incoming/", methods=["GET", "POST"])
@router.api_route(r"/voice/incoming\\", methods=["GET", "POST"])
async def voice_prompt(request: Request):
    """Returns TwiML asking the faculty to speak their update in English or Tamil."""
    base_url = _get_public_base_url(request)
    action_url = f"{base_url}/api/webhook/voice/conversation"
    hints = (
        "singly linked list, linked list, doubly linked list, circular linked list, "
        "insertion, deletion, traversal, stack, queue, tree, binary search tree, graph, sorting, "
        "data structures, DBMS, SQL, SQL joins, joins, normalization, DDL, DML, "
        "operating systems, process scheduling, memory management, deadlock, CPU scheduling, "
        "computer networks, software engineering, "
        "CSE, CSE-C, CSE C, CSE-A, CSE-B, ECE, EEE, MECH, IT, AIDS, "
        "unit 1, unit 2, unit 3, unit 4, unit 5, chapter 1, chapter 2, "
        "completed, finished, taught, taken, conducted, "
        "இன்னைக்கு, முடிச்சேன், எடுத்தேன், நடத்தினேன், பாடம், வகுப்பு, "
        "inaikku, mudichen, eduthen, nadathinen, solli thanthen, vaguppu, class, session, lecture"
    )
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" language="ta-IN,en-IN" timeout="15" speechTimeout="5" maxSpeechTime="60" speechModel="experimental_conversations" enhanced="true" hints="{hints}" action="{action_url}" method="POST">
        <Say voice="Polly.Aditi" language="en-IN">Vanakkam Professor! Welcome to AcademicFlow. Please say what topic and section you taught in class today.</Say>
    </Gather>
    <Say voice="Polly.Aditi" language="en-IN">We did not receive any response. Nandri, goodbye!</Say>
</Response>"""
    return Response(content=twiml, media_type="text/xml")


@router.api_route("/voice/conversation", methods=["GET", "POST"])
@router.api_route("/voice/conversation/", methods=["GET", "POST"])
@router.api_route(r"/voice/conversation\\", methods=["GET", "POST"])
async def voice_conversation(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Handles multi-turn conversational voice interaction with Claude, asking clarifying questions."""
    base_url = _get_public_base_url(request)
    action_url = f"{base_url}/api/webhook/voice/conversation"
    form_data = await request.form()
    speech_text = form_data.get("SpeechResult", "").strip()
    call_sid = form_data.get("CallSid", "voice_default_call")
    caller = form_data.get("From", "")
    logger.info("Conversational turn from %s (%s): %s", caller, call_sid, speech_text)

    hints = (
        "singly linked list, linked list, doubly linked list, circular linked list, "
        "insertion, deletion, traversal, stack, queue, tree, binary search tree, graph, sorting, "
        "data structures, DBMS, SQL, SQL joins, joins, normalization, DDL, DML, "
        "operating systems, process scheduling, memory management, deadlock, CPU scheduling, "
        "computer networks, software engineering, "
        "CSE, CSE-C, CSE C, CSE-A, CSE-B, ECE, EEE, MECH, IT, AIDS, "
        "unit 1, unit 2, unit 3, unit 4, unit 5, chapter 1, chapter 2, "
        "completed, finished, taught, taken, conducted, "
        "இன்னைக்கு, முடிச்சேன், எடுத்தேன், நடத்தினேன், பாடம், வகுப்பு, "
        "inaikku, mudichen, eduthen, nadathinen, solli thanthen, vaguppu, class, session, lecture"
    )

    if not speech_text:
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" language="ta-IN,en-IN" timeout="15" speechTimeout="5" maxSpeechTime="60" speechModel="experimental_conversations" enhanced="true" hints="{hints}" action="{action_url}" method="POST">
        <Say voice="Polly.Aditi" language="en-IN">We could not hear your response. Please say what you taught today.</Say>
    </Gather>
    <Say voice="Polly.Aditi" language="en-IN">No response detected. Nandri, goodbye!</Say>
</Response>"""
        return Response(content=twiml, media_type="text/xml")

    # Ensure master Excel plan is initialized
    activities = db.scalars(select(Activity)).all()
    ensure_master_excel(activities)

    # Process turn with Claude conversational agent
    turn_res = process_voice_turn(call_sid, speech_text, db, background_tasks=background_tasks)
    tamil_reply = turn_res["speech_reply_tamil"]
    english_reply = turn_res["speech_reply_english"]
    is_complete = turn_res["is_complete"]

    import html
    escaped_english = html.escape(english_reply)

    if is_complete:
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Aditi" language="en-IN">{escaped_english}</Say>
    <Hangup />
</Response>"""
    else:
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather input="speech" language="ta-IN,en-IN" timeout="15" speechTimeout="5" maxSpeechTime="60" speechModel="experimental_conversations" enhanced="true" hints="{hints}" action="{action_url}" method="POST">
        <Say voice="Polly.Aditi" language="en-IN">{escaped_english}</Say>
    </Gather>
    <Say voice="Polly.Aditi" language="en-IN">Thank you Professor. Have a great day!</Say>
</Response>"""

    return Response(content=twiml, media_type="text/xml")


@router.post("/voice/chat")
async def voice_chat_turn(request: Request, db: Session = Depends(get_db)):
    """Conversational voice chat endpoint for web frontend simulation."""
    data = await request.json()
    session_id = data.get("session_id", "web_sim_default")
    speech_text = data.get("speech_text", "").strip()
    if not speech_text:
        raise HTTPException(status_code=400, detail="Speech text cannot be empty")

    activities = db.scalars(select(Activity)).all()
    ensure_master_excel(activities)

    teacher = db.scalar(select(User).where(User.role == "FACULTY", User.department == "CSE"))
    if not teacher:
        teacher = db.scalar(select(User).where(User.role == "FACULTY"))

    res = process_voice_turn(session_id, speech_text, db, user=teacher)
    return res


@router.api_route("/voice/process", methods=["GET", "POST"])
async def voice_process(request: Request, db: Session = Depends(get_db)):
    """Processes speech input from Twilio voice call using Claude and matching."""
    form_data = await request.form()
    speech_text = form_data.get("SpeechResult", "").strip()
    caller = form_data.get("From", "")
    logger.info("Received Twilio Voice speech from %s: %s", caller, speech_text)

    if not speech_text:
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Aditi">No speech detected. Goodbye!</Say>
</Response>"""
        return Response(content=twiml, media_type="text/xml")

    # Ensure master Excel plan is initialized
    activities = db.scalars(select(Activity)).all()
    ensure_master_excel(activities)

    # Find Teacher account
    teacher = db.scalar(select(User).where(User.role == "FACULTY", User.department == "CSE"))
    if not teacher:
        teacher = db.scalar(select(User).where(User.role == "FACULTY"))

    # 1. Create Report
    report = Report(source_type="VOICE_TRANSCRIPT", raw_content=speech_text, submitted_by=teacher.id if teacher else None)
    db.add(report)
    db.flush()

    # 2. Extract Event(s) using Claude
    extractor = get_extractor()
    extracted_events = extract_report(db, report, teacher, extractor)

    # 3. Match each event against academic plan
    embeddings_provider = get_embeddings()
    verbal_confirmations = []
    for event in extracted_events:
        matches = run_matching(db, event, teacher, embeddings_provider)
        decision = matches[0].decision if matches else event.disposition

        if decision == "AUTO_LINK":
            act = matches[0].activity
            act_name = act.activity_name if act else "Planned Activity"
            if act:
                sync_activity_to_excel(act)
            verbal_confirmations.append(f"Linked {act_name} to the plan and marked complete.")
        elif decision == "HUMAN_REVIEW":
            act = matches[0].activity
            act_name = act.activity_name if act else "Activity"
            verbal_confirmations.append(f"Queued {act_name} for HOD review.")
        else:
            verbal_confirmations.append("Logged your report for HOD verification.")

    db.commit()

    confirm_text = " ".join(verbal_confirmations) if verbal_confirmations else "Your update has been recorded."
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Google.ta-IN-Standard-A" language="ta-IN">நன்றி புரொபசர். உங்கள் அறிக்கை பதிவு செய்யப்பட்டது.</Say>
    <Say voice="Polly.Aditi" language="en-IN">Thank you Professor. {confirm_text} Have a great day!</Say>
</Response>"""
    return Response(content=twiml, media_type="text/xml")


@router.post("/voice/simulate")
async def simulate_voice_call(request: Request, db: Session = Depends(get_db)):
    """Simulates voice input directly from the frontend UI without placing an actual phone call."""
    data = await request.json()
    speech_text = data.get("speech_text", "").strip()
    if not speech_text:
        raise HTTPException(status_code=400, detail="Speech text cannot be empty")

    # Ensure master Excel plan is initialized
    activities = db.scalars(select(Activity)).all()
    ensure_master_excel(activities)

    # Find Teacher account
    teacher = db.scalar(select(User).where(User.role == "FACULTY", User.department == "CSE"))
    if not teacher:
        teacher = db.scalar(select(User).where(User.role == "FACULTY"))

    # 1. Create Report
    report = Report(source_type="VOICE_TRANSCRIPT", raw_content=speech_text, submitted_by=teacher.id if teacher else None)
    db.add(report)
    db.flush()

    # 2. Extract Event(s) using Claude
    extractor = get_extractor()
    extracted_events = extract_report(db, report, teacher, extractor)

    # 3. Match each event against academic plan
    embeddings_provider = get_embeddings()
    outcomes = []
    verbal_confirmations = []
    for event in extracted_events:
        matches = run_matching(db, event, teacher, embeddings_provider)
        decision = matches[0].decision if matches else event.disposition
        confidence = round(matches[0].final_confidence * 100, 1) if matches else 0
        act = matches[0].activity if matches else None

        if decision == "AUTO_LINK" and act:
            sync_activity_to_excel(act)
            verbal_confirmations.append(f"Linked {act.activity_name} to the plan and marked complete.")
        elif decision == "HUMAN_REVIEW" and act:
            verbal_confirmations.append(f"Queued {act.activity_name} for HOD review.")
        else:
            verbal_confirmations.append("Logged report for HOD review.")

        outcomes.append({
            "event_id": str(event.id),
            "topic": event.activity_description,
            "department": event.department,
            "section": event.class_section,
            "status": event.status,
            "decision": decision,
            "confidence": confidence,
            "matched_activity": act.activity_name if act else None,
            "activity_id": act.activity_id if act else None,
        })

    db.commit()
    confirm_text = " ".join(verbal_confirmations) if verbal_confirmations else "Your update has been recorded."

    return {
        "status": "success",
        "report_id": str(report.id),
        "raw_speech": speech_text,
        "events": outcomes,
        "tamil_confirmation": "நன்றி புரொபசர். உங்கள் அறிக்கை பதிவு செய்யப்பட்டது.",
        "english_confirmation": f"Thank you Professor. {confirm_text}",
    }


@router.post("/voice/call")
async def trigger_outbound_call(request: Request, to_phone: str = Query(None, description="Phone number to call")):
    """Initiates an outbound phone call to the teacher via Twilio."""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        raise HTTPException(status_code=500, detail="Twilio credentials not configured")

    target_phone = to_phone or f"+{settings.TEACHER_PHONE}"
    if not target_phone.startswith("+"):
        target_phone = f"+{target_phone}"

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Calls.json"
    base_url = _get_public_base_url(request)
    callback_url = f"{base_url}/api/webhook/voice/prompt"

    data = urllib.parse.urlencode({
        "To": target_phone,
        "From": settings.TWILIO_WHATSAPP_NUMBER,
        "Url": callback_url,
    }).encode("utf-8")

    auth_str = f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}"
    auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Basic {auth_b64}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = json.loads(resp.read().decode("utf-8"))
            return {"status": "call_initiated", "call_sid": resp_body.get("sid"), "to": target_phone}
    except urllib.error.HTTPError as e:
        error_detail = e.read().decode("utf-8")
        logger.error("Twilio call failed: %s %s", e.code, error_detail)
        raise HTTPException(status_code=e.code, detail=error_detail)
    except Exception as exc:
        logger.error("Call error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
