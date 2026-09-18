"""Workflow structure and API contract tests, not a substitute for n8n execution."""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from tests.test_workflows import workbook

WORKFLOWS = Path(__file__).resolve().parents[2] / "n8n/workflows"


@pytest.mark.parametrize("kind", ["text", "excel"])
def test_workflow_contract(kind):
    workflow = json.loads((WORKFLOWS / f"academicflow_{kind}_ingestion.json").read_text())
    nodes = {n["name"]: n for n in workflow["nodes"]}
    assert not workflow["active"]
    assert workflow["settings"]["saveDataErrorExecution"] == "none"
    assert workflow["settings"]["saveDataSuccessExecution"] == "none"
    assert nodes["Webhook"]["parameters"]["responseMode"] == "responseNode"
    assert nodes["Extract Events"]["parameters"]["options"]["response"]["response"]["fullResponse"]
    assert nodes["Each Event"]["parameters"]["fieldToSplitOut"] == "body"
    for node in nodes.values():
        if node["type"] == "n8n-nodes-base.httpRequest":
            assert "$env.FASTAPI_BASE_URL" in node["parameters"]["url"]
            assert "headers.authorization" in node["parameters"]["headerParameters"]["parameters"][0]["value"]
            assert not node.get("retryOnFail")  # Ingestion has no idempotency key yet.
            assert not node.get("continueOnFail")
    for source, outputs in workflow["connections"].items():
        assert source in nodes
        for branch in outputs["main"]:
            for edge in branch:
                assert edge["node"] in nodes
    if kind == "excel":
        field = nodes["Ingest Report"]["parameters"]["bodyParameters"]["parameters"][0]
        assert field == {"parameterType": "formBinaryData", "name": "file", "inputDataFieldName": "file"}


def run_router(items):
    node = shutil.which("node")
    if not node:
        pytest.skip("Node.js required to execute the exported routing code")
    workflow = json.loads((WORKFLOWS / "academicflow_text_ingestion.json").read_text())
    code = next(n for n in workflow["nodes"] if n["name"] == "Route Backend Decisions")["parameters"]["jsCode"]
    script = "const $ = () => ({first: () => ({json: {report_id: 'test-report'}})});\n"
    script += "const $input = {all: () => " + json.dumps([{"json": item} for item in items]) + "};\n"
    script += "console.log(JSON.stringify((function() {" + code + "})()));"
    return subprocess.run([node, "-e", script], capture_output=True, text=True, timeout=10)


def test_router_uses_decision_not_rounded_confidence():
    result = run_router(
        [
            {"event_id": "1", "decision": "HUMAN_REVIEW", "candidates": [{"final_confidence": 90}]},
            {"event_id": "2", "decision": "AUTO_LINK"},
            {"event_id": "3", "decision": "UNMATCHED"},
            {"event_id": "4", "decision": "UNMATCHED"},
        ]
    )
    assert result.returncode == 0, result.stderr
    body = json.loads(result.stdout)[0]["json"]
    assert body["matched_events"] == 4
    assert len(body["routes"]["UNMATCHED"]) == 2
    assert body["routes"]["HUMAN_REVIEW"][0]["event_id"] == "1"


def test_router_handles_zero_events_and_rejects_unknown_decisions():
    result = run_router([{"body": []}])
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)[0]["json"]["matched_events"] == 0
    assert run_router([{"event_id": "1", "decision": "UNKNOWN"}]).returncode != 0


@pytest.mark.parametrize("kind", ["text", "excel"])
def test_orchestrated_api_sequence(setup, kind):
    client, _, tokens = setup
    # The caller's token is forwarded on every request, not an administrator credential.
    client.headers["Authorization"] = "Bearer " + tokens["FACULTY"]
    if kind == "text":
        result = client.post("/api/reports/text", json={"content": "Conducted placement aptitude training."})
        expected = 1
    else:
        content = workbook([["Topic"], ["Did SQL practice."], ["Conducted placement aptitude training."]])
        result = client.post("/api/reports/spreadsheet", files={"file": ("faculty.xlsx", content)})
        expected = 2
    assert result.status_code == 201
    report_id = result.json()["report_id"]
    extracted = client.post(f"/api/extraction/{report_id}")
    assert extracted.status_code == 200
    assert len(extracted.json()) == expected
    matched = []
    for event in extracted.json():
        response = client.post("/api/matching/" + event["id"])
        assert response.status_code == 200
        matched.append(response.json())
        actions = {a["action"] for a in client.get("/api/audit/" + event["id"]).json()}
        assert "REPORT_RECEIVED" in actions
    routed = run_router(matched)
    assert routed.returncode == 0, routed.stderr
    assert json.loads(routed.stdout)[0]["json"]["matched_events"] == expected
    assert client.get(f"/api/reports/{report_id}").status_code == 200


def test_orchestration_requires_authenticated_caller(setup):
    client, _, _ = setup
    client.headers.clear()
    assert client.post("/api/reports/text", json={"content": "Report"}).status_code == 401
    assert client.post("/api/reports/spreadsheet", files={"file": ("report.xlsx", b"invalid")}).status_code == 401


def test_config_uses_repository_environment_and_upload_directory():
    from app.config import ROOT, Settings

    assert ROOT == Path(__file__).resolve().parents[2]
    assert Settings.model_config["env_file"] == ROOT / ".env"
    assert Settings.model_fields["UPLOAD_DIR"].default == ROOT / "data/uploads"
