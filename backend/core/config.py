"""
Core configuration management using Pydantic Settings.
Loads all environment variables with validation and type safety.
"""

from pydantic_settings import BaseSettings
from pydantic import Field, AnyHttpUrl
from functools import lru_cache
from typing import List, Optional


class Settings(BaseSettings):
    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "AI Meeting Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development | staging | production

    # ── Security / JWT ────────────────────────────────────────────────────────
    SECRET_KEY: str = Field(..., description="JWT signing secret – min 32 chars")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ─────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ]

    # ── MongoDB ───────────────────────────────────────────────────────────────
    MONGODB_URL: str = Field(..., description="MongoDB connection string")
    MONGODB_DB_NAME: str = "ai_meeting_platform"

    # ── LiveKit ───────────────────────────────────────────────────────────────
    LIVEKIT_API_KEY: str = Field(default="", description="LiveKit API key")
    LIVEKIT_API_SECRET: str = Field(default="", description="LiveKit API secret")
    LIVEKIT_URL: str = Field(default="", description="wss://your-livekit-server.livekit.cloud")

    @property
    def livekit_configured(self) -> bool:
        return bool(self.LIVEKIT_API_KEY and self.LIVEKIT_API_SECRET and self.LIVEKIT_URL)

    # ── Groq ──────────────────────────────────────────────────────────────────
    GROQ_API_KEY: str = Field(default="", description="Groq API key")
    GROQ_TRANSCRIPTION_MODEL: str = "whisper-large-v3"
    GROQ_LLM_MODEL: str = "llama3-70b-8192"
    GROQ_LLM_FAST_MODEL: str = "llama3-8b-8192"

    @property
    def groq_configured(self) -> bool:
        return bool(self.GROQ_API_KEY)

    # ── Google Calendar OAuth2 ────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/calendar/oauth2callback"
    GOOGLE_SCOPES: List[str] = [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.email",
    ]

    # ── Storage / Encryption ──────────────────────────────────────────────────
    ENCRYPTION_KEY: str = Field(
        "", description="32-byte AES-256 key (base64-encoded) for at-rest encryption"
    )

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore"
    }


def _load_dotenv_override() -> None:
    """
    Force ALL values from .env to override system environment variables.

    Pydantic-settings gives system env vars higher priority than the .env file.
    If a stale/old key is set in the Windows system environment it would silently
    override whatever is in .env — this function fixes that by pre-injecting
    .env values into os.environ before pydantic reads them.
    """
    import os
    from pathlib import Path

    # Resolve .env relative to this file's grandparent (backend root)
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return

    with open(env_path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            # Skip blank lines, comments, and lines without '='
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and value:
                os.environ[key] = value


@lru_cache()
def get_settings() -> Settings:
    """Return cached Settings singleton with .env values always taking priority."""
    _load_dotenv_override()
    return Settings()


settings = get_settings()
