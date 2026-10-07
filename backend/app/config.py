from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    APP_ENV: str = "development"
    DATABASE_URL: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    JWT_SECRET: str = ""
    TOKEN_MINUTES: int = 60
    AI_PROVIDER: str = "openai"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: Literal[1536] = 1536
    AUTO_LINK_THRESHOLD: float = 0.90
    HUMAN_REVIEW_THRESHOLD: float = 0.50
    UPLOAD_DIR: Path = ROOT / "data/uploads"
    MAX_UPLOAD_BYTES: int = 5 * 1024 * 1024
    COOKIE_SECURE: bool = False
    SEED_ADMIN_EMAIL: str = "admin@example.com"
    SEED_ADMIN_PASSWORD: str = ""

    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-haiku-4-5-20251001"
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_VERIFY_TOKEN: str = "academicflow_whatsapp_verify_2026"
    TEACHER_PHONE: str = "916380221196"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_NUMBER: str = "+14155238886"
    TUNNEL_URL: str = "https://broadway-shell-subcommittee-sitting.trycloudflare.com"

    @model_validator(mode="after")
    def validate_policy(self):
        if not 0 <= self.HUMAN_REVIEW_THRESHOLD < self.AUTO_LINK_THRESHOLD <= 1:
            raise ValueError("Confidence thresholds must satisfy 0 <= review < auto <= 1")
        if self.AI_PROVIDER not in {"openai", "demo", "claude"}:
            raise ValueError("AI_PROVIDER must be openai, demo, or claude")
        if self.APP_ENV == "production" and (not self.COOKIE_SECURE or self.AI_PROVIDER == "demo"):
            raise ValueError("Production requires secure cookies and real AI provider")
        return self

    @property
    def CORS_ORIGINS(self):
        origins = [self.FRONTEND_URL, "https://academicflowz.duckdns.org", "http://academicflowz.duckdns.org", "http://localhost:3000"]
        return list(set(origins))


settings = Settings()
