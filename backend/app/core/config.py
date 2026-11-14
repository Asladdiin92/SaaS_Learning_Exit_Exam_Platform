import os
from typing import List, Optional, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    APP_NAME: str = "SaaS Learning & Exit Exam Platform Backend"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    API_V1_PREFIX: str = "/api/v1"

    # CORS
    ALLOWED_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:8081",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8081",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    # Supabase & Database (Project: sbvyjbipchglzmttkowy)
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres",
        description="Asyncpg database URL (port 6543 for Supabase Transaction Pooler, or port 54322 for local Docker)",
    )
    DIRECT_URL: Optional[str] = Field(
        default=None,
        description="Direct / Session Pooler URL (port 5432) for running migrations",
    )
    SUPABASE_URL: str = "https://sbvyjbipchglzmttkowy.supabase.co"
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None

    # Authentication & Security
    JWT_SECRET_KEY: str = "insecure-development-secret-key-change-in-production-minimum-32-chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Content Storage (ADR-009)
    STORAGE_DRIVER: str = "local"  # "local" or "supabase"
    STORAGE_BUCKET: str = "course-packages"
    LOCAL_STORAGE_PATH: str = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../dev_storage/course-packages")
    )


settings = Settings()
