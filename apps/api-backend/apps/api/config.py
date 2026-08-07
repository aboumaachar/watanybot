import os
from pathlib import Path
from typing import List, Optional

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    app_env: str = Field(default="dev", validation_alias=AliasChoices("APP_ENV"))

    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5433
    postgres_db: str = "watanbot"
    postgres_user: str = "watanbot"
    postgres_password: str = Field(
        ...,
        validation_alias=AliasChoices("POSTGRES_PASSWORD"),
    )

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_base_url: str = "http://localhost:8000"

    # JWT
    jwt_secret: str = Field(
        ...,
        validation_alias=AliasChoices("JWT_SECRET"),
    )
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 120

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Superadmin
    superadmin_email: str = "admin@example.com"
    superadmin_password: str = Field(
        ...,
        validation_alias=AliasChoices("SUPERADMIN_PASSWORD"),
    )

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # WhatsApp
    whatsapp_app_secret: str = ""
    whatsapp_verify_signature: bool = False
    whatsapp_simulation_enabled: Optional[bool] = None
    whatsapp_outbound_mode: Optional[str] = None
    whatsapp_interactive_enabled: Optional[bool] = None
    guided_mode_default: bool = True
    arabizi_enabled: bool = True
    keyboard_garble_fix_enabled: bool = True

    # SQLite KB v3
    kb_sqlite_path: str = "/data/kb.sqlite"
    use_sqlite_v3_kb: bool = True
    _kb_path_resolved: bool = False
    legacy_postgres_kb_fallback: bool = False
    sqlite_confidence_threshold: float = 0.25
    sqlite_ambiguity_delta: float = 0.05
    public_show_pending: bool = False

    # Operations
    auto_create_kb: bool = False
    auto_approve: bool = False
    retention_days_chat: int = 180
    backup_dir: str = "./backups"
    max_backups: int = 30
    worker_schedule_maintenance: str = "0 2 * * *"
    worker_schedule_metrics: str = "0 * * * *"

    # Rate limiting
    rate_limit_per_minute: int = 60
    rate_limit_backend: str = "memory"
    rate_limit_redis_url: str = Field(
        default="",
        validation_alias=AliasChoices("RATE_LIMIT_REDIS_URL", "REDIS_URL"),
    )

    # Logging
    log_level: str = "INFO"
    log_json: bool = True

    # Speech-to-text / text-to-speech
    stt_enabled: Optional[bool] = None
    stt_provider: str = "dummy"
    stt_confidence_threshold: float = 0.6
    tts_enabled: bool = False
    tts_provider: str = "dummy"
    ocr_enabled: Optional[bool] = None

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    def model_post_init(self, __context: object) -> None:
        if self.whatsapp_simulation_enabled is None:
            self.whatsapp_simulation_enabled = self.app_env == "dev"
        if self.whatsapp_outbound_mode is None:
            self.whatsapp_outbound_mode = "simulate" if self.app_env == "dev" else "live"
        if self.whatsapp_interactive_enabled is None:
            self.whatsapp_interactive_enabled = self.app_env == "dev"
        if self.stt_enabled is None:
            self.stt_enabled = self.app_env == "dev"
        if self.ocr_enabled is None:
            self.ocr_enabled = False

        self.validate_secrets()

    def _is_production_like(self) -> bool:
        values = {
            (self.environment or "").strip().lower(),
            (self.app_env or "").strip().lower(),
        }
        return bool(values & {"production", "prod", "server", "live"})

    def validate_secrets(self) -> None:
        if self._is_production_like():
            if len(self.jwt_secret or "") < 32:
                raise ValueError(
                    "JWT_SECRET must be at least 32 characters in production-like environments"
                )

            if self.superadmin_password in {
                "",
                "changeme",
                "changeme_admin_password",
                "Admin12345",
            }:
                raise ValueError(
                    "SUPERADMIN_PASSWORD must not be default in production-like environments"
                )

            if self.postgres_password in {
                "",
                "changeme",
                "changeme_secure_password",
            }:
                raise ValueError(
                    "POSTGRES_PASSWORD must not be default in production-like environments"
                )

    def resolve_kb_path(self) -> str:
        """Resolve KB path with dev-safe fallback to ./data/kb.sqlite."""
        if self._kb_path_resolved:
            return self.kb_sqlite_path

        configured_path = Path(self.kb_sqlite_path)

        # If absolute path exists, use it.
        if configured_path.is_absolute() and configured_path.exists():
            self._kb_path_resolved = True
            return str(configured_path)

        # If relative path exists, use it.
        if not configured_path.is_absolute():
            resolved = Path.cwd() / configured_path
            if resolved.exists():
                self.kb_sqlite_path = str(resolved)
                self._kb_path_resolved = True
                return str(resolved)

        # Dev-only fallback: if ./data/kb.sqlite exists, use it.
        if self.app_env == "dev":
            fallback = Path.cwd() / "data" / "kb.sqlite"
            if fallback.exists():
                print(
                    "WARNING: "
                    f"KB_SQLITE_PATH={self.kb_sqlite_path} not found, "
                    f"using dev fallback: {fallback}"
                )
                self.kb_sqlite_path = str(fallback)
                self._kb_path_resolved = True
                return str(fallback)

        # Return configured path even if it does not exist.
        # The caller/runtime will fail if the path is required and unavailable.
        self._kb_path_resolved = True
        return self.kb_sqlite_path


settings = Settings()

# Resolve KB path once at import time so all callers get an absolute path.
settings.kb_sqlite_path = settings.resolve_kb_path()
