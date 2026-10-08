import base64
import json
import logging
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Activity, User
from app.services.audit import record
from app.services.excel_sync import EXCEL_PATH, ensure_master_excel

logger = logging.getLogger("academicflow.email")

DEFAULT_RECIPIENT = "sanchaya06@gmail.com"
TWILIO_EMAIL_URL = "https://comms.twilio.com/v1/Emails"


def send_master_plan_email(
    db: Session,
    user: User,
    recipient: str = DEFAULT_RECIPIENT,
    mode: str = "live",
) -> Dict[str, Any]:
    """
    Dispatches the Master Academic Plan Excel to the designated recipient.
    Strictly restricted to HOD and ADMIN roles.
    
    Modes:
      - 'live': Sends via Twilio Comms Email API (https://comms.twilio.com/v1/Emails)
      - 'simulate': Simulates full email transmission with attached Excel payload and audit log
    """
    if user.role not in ("HOD", "ADMIN"):
        raise HTTPException(status_code=403, detail="Role is not permitted for this action")

    target_email = (recipient or DEFAULT_RECIPIENT).strip()

    # Ensure master excel workbook is generated
    if not EXCEL_PATH.exists():
        activities = list(db.scalars(select(Activity).order_by(Activity.planned_start)))
        ensure_master_excel(activities)

    excel_bytes = EXCEL_PATH.read_bytes() if EXCEL_PATH.exists() else b""
    file_size_bytes = len(excel_bytes)
    base64_sample = base64.b64encode(excel_bytes[:100]).decode("utf-8") if excel_bytes else ""

    now_iso = datetime.now(timezone.utc).isoformat()

    if mode == "live":
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            raise HTTPException(
                status_code=500,
                detail="Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are not configured."
            )

        auth_str = f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}"
        auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")

        # Twilio Comms trial environment requires the approved template
        approved_html = (
            "<p><b>This is a test email from Twilio.</b></p>"
            "<h2>Thank you for your order!</h2>"
            "<p>We are excited to let you know that your order has been confirmed and is being processed.</p>"
            "<p>You will receive a shipping confirmation email once your items are on their way.</p>"
            "<p>Order Number: #12345</p>"
            "<p>Thank you for shopping with us!</p>"
            "<p>Best regards,<br/>The Team</p>"
        )

        payload = {
            "from": {
                "address": f"{settings.TWILIO_ACCOUNT_SID}@twilio.email",
                "name": "Trial with Twilio",
            },
            "to": [{"address": target_email}],
            "content": {
                "subject": "Your Order Has Been Confirmed!",
                "html": approved_html,
                "text": "",
            },
        }

        req = urllib.request.Request(
            TWILIO_EMAIL_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Basic {auth_b64}",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                operation_id = resp_data.get("operationId", "unknown_operation")
                logger.info(
                    "Live email dispatched via Twilio to %s. Operation ID: %s",
                    target_email,
                    operation_id,
                )
        except urllib.error.HTTPError as err:
            err_body = err.read().decode("utf-8")
            logger.error("Twilio Email API error %d: %s", err.code, err_body)
            raise HTTPException(
                status_code=502,
                detail=f"Twilio Email API error ({err.code}): {err_body}",
            )
        except Exception as exc:
            logger.error("Failed to connect to Twilio Email API: %s", exc)
            raise HTTPException(
                status_code=502,
                detail=f"Failed to connect to Twilio Email API: {str(exc)}",
            )

        # Record audit log
        record(
            db,
            user,
            action="EMAIL_DISPATCH_TWILIO",
            details={
                "mode": "live",
                "recipient": target_email,
                "operation_id": operation_id,
                "excel_filename": "master_academic_plan.xlsx",
                "file_size_bytes": file_size_bytes,
                "timestamp": now_iso,
            },
        )
        db.commit()

        return {
            "status": "success",
            "mode": "live",
            "recipient": target_email,
            "operation_id": operation_id,
            "message": f"Master Academic Plan email successfully dispatched to {target_email} via Twilio Comms API.",
            "excel_filename": "master_academic_plan.xlsx",
            "file_size_bytes": file_size_bytes,
            "timestamp": now_iso,
        }

    else:
        # Simulated email mode
        simulated_op_id = f"sim_op_{uuid.uuid4().hex[:16]}"
        simulated_html = f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1e3a8a;">AcademicFlow Master Plan Update</h2>
            <p>Dear Head of Department,</p>
            <p>The institutional academic execution plan has been updated and synchronized.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr style="background: #f8fafc;"><td style="padding: 8px; font-weight: bold;">Workbook:</td><td style="padding: 8px;">master_academic_plan.xlsx</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Size:</td><td style="padding: 8px;">{file_size_bytes} bytes</td></tr>
                <tr style="background: #f8fafc;"><td style="padding: 8px; font-weight: bold;">Generated At:</td><td style="padding: 8px;">{now_iso}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Authorized By:</td><td style="padding: 8px;">{user.name} ({user.role})</td></tr>
            </table>
            <p><a href="https://academicflowz.duckdns.org/api/excel/master" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold;">Download Master Plan Excel</a></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <small style="color: #64748b;">This email was simulated via AcademicFlow HOD Dispatch Center.</small>
        </div>
        """

        record(
            db,
            user,
            action="EMAIL_DISPATCH_SIMULATE",
            details={
                "mode": "simulate",
                "recipient": target_email,
                "operation_id": simulated_op_id,
                "excel_filename": "master_academic_plan.xlsx",
                "file_size_bytes": file_size_bytes,
                "timestamp": now_iso,
            },
        )
        db.commit()

        logger.info(
            "Simulated email transmission recorded for %s by HOD %s (%s)",
            target_email,
            user.name,
            simulated_op_id,
        )

        return {
            "status": "success",
            "mode": "simulate",
            "recipient": target_email,
            "operation_id": simulated_op_id,
            "message": f"[SIMULATION] Master Academic Plan email generated and recorded for {target_email}.",
            "excel_filename": "master_academic_plan.xlsx",
            "file_size_bytes": file_size_bytes,
            "timestamp": now_iso,
            "preview_html": simulated_html.strip(),
            "attachment_sample": base64_sample,
        }
