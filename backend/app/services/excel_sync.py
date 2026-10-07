import logging
from datetime import date
from pathlib import Path
from openpyxl import Workbook, load_workbook

from app.config import ROOT, settings

logger = logging.getLogger("academicflow.excel")
EXCEL_PATH = ROOT / "data" / "master_academic_plan.xlsx"


def ensure_master_excel(activities):
    """Generates master academic plan Excel if absent."""
    if EXCEL_PATH.exists():
        return EXCEL_PATH
    EXCEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "Academic Plan"
    headers = [
        "Activity ID",
        "Department",
        "Course",
        "Unit",
        "Activity Name",
        "Class Section",
        "Planned Start",
        "Planned End",
        "Actual End",
        "Status",
        "Completion %",
    ]
    ws.append(headers)
    for a in activities:
        ws.append(
            [
                a.activity_id,
                a.department,
                a.course,
                a.unit,
                a.activity_name,
                a.class_section,
                str(a.planned_start),
                str(a.planned_end),
                str(a.actual_end or ""),
                a.status,
                a.completion_percentage,
            ]
        )
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 20
    wb.save(EXCEL_PATH)
    logger.info("Initialized master academic plan Excel at %s", EXCEL_PATH)
    return EXCEL_PATH


def sync_activity_to_excel(activity):
    """Updates the status and completion in the master Excel file."""
    sync_activities_to_excel([activity])


def sync_activities_to_excel(activities):
    """Synchronizes a list of activities into the master academic plan Excel, adding new ones or updating existing ones."""
    if not EXCEL_PATH.exists():
        return ensure_master_excel(activities)
    try:
        wb = load_workbook(EXCEL_PATH)
        ws = wb.active
        existing_rows = {}
        for row in range(2, ws.max_row + 1):
            cell_val = str(ws.cell(row=row, column=1).value or "").strip()
            if cell_val:
                existing_rows[cell_val] = row

        for a in activities:
            aid = str(a.activity_id).strip()
            if aid in existing_rows:
                r = existing_rows[aid]
                if a.actual_end:
                    ws.cell(row=r, column=9, value=str(a.actual_end))
                ws.cell(row=r, column=10, value=a.status)
                ws.cell(row=r, column=11, value=a.completion_percentage)
            else:
                ws.append(
                    [
                        a.activity_id,
                        a.department,
                        a.course,
                        a.unit,
                        a.activity_name,
                        a.class_section,
                        str(a.planned_start),
                        str(a.planned_end),
                        str(a.actual_end or ""),
                        a.status,
                        a.completion_percentage,
                    ]
                )
                existing_rows[aid] = ws.max_row

        for col in ws.columns:
            ws.column_dimensions[col[0].column_letter].width = 20
        wb.save(EXCEL_PATH)
        logger.info("Synchronized %d activities with master Excel at %s", len(activities), EXCEL_PATH)
    except Exception as exc:
        logger.error("Failed to sync activities to Excel: %s", exc)
    return EXCEL_PATH
