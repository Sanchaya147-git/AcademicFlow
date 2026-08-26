from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve the repository root so the backend always loads the root .env file.
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: str = "development"
    APP_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/academicflow"

    @property
    def CORS_ORIGINS(self) -> list[str]:
        return [self.FRONTEND_URL, "http://localhost:3000"]


settings = Settings()
