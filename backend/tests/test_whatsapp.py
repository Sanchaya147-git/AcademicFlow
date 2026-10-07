from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_whatsapp_webhook_verification():
    resp = client.get(
        "/api/webhook/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.challenge": "1158201444",
            "hub.verify_token": "academicflow_whatsapp_verify_2026",
        },
    )
    assert resp.status_code == 200
    assert resp.text == "1158201444"


def test_whatsapp_webhook_bad_token():
    resp = client.get(
        "/api/webhook/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.challenge": "1158201444",
            "hub.verify_token": "wrong_token",
        },
    )
    assert resp.status_code == 403
