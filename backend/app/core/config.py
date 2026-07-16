from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change-this-in-production"
    DATABASE_URL: str = "postgresql+asyncpg://fabienne:changeme@db:5432/fabienne_db"
    CORS_ORIGINS: str = "http://localhost:5173"

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.1-flash-lite-preview"
    # Sourcing needs grounding_chunks in the response. The flash-lite tier
    # strips them; flash (non-lite) returns them.
    GEMINI_SOURCING_MODEL: str = "gemini-3.5-flash"
    # Conversational chat agent (function calling). Uses the preview variant
    # of Gemini 3.1 Flash — more reliable on tool calls than flash-lite.
    # If empty, falls back to GEMINI_MODEL.
    GEMINI_CHAT_MODEL: str = "gemini-3.1-flash-lite-preview"

    # API gouv (recherche-entreprises.api.gouv.fr) — public, no auth.
    API_GOUV_BASE_URL: str = "https://recherche-entreprises.api.gouv.fr"
    API_GOUV_MAX_CONCURRENCY: int = 6
    API_GOUV_TIMEOUT: float = 10.0
    API_GOUV_MATCH_THRESHOLD: float = 0.75

    # Google Places API (New) — enrichment with phone, hours, GPS coords,
    # website, Google Maps rating + review count. Empty key disables the
    # service entirely (calls become no-ops, no error).
    GOOGLE_PLACES_API_KEY: str = ""
    GOOGLE_PLACES_BASE_URL: str = "https://places.googleapis.com/v1"
    GOOGLE_PLACES_MAX_CONCURRENCY: int = 6
    GOOGLE_PLACES_TIMEOUT: float = 10.0

    # DropContact (B2B contact enrichment) — email, phone, LinkedIn, job
    # title for a (first_name, last_name, company) triple. Async API: POST
    # returns a request_id, polled by GET until ready (typically 30 s+).
    # Empty key disables enrichment (no HTTP call).
    DROPCONTACT_API_KEY: str = ""
    DROPCONTACT_BASE_URL: str = "https://api.dropcontact.com/v1"
    DROPCONTACT_TIMEOUT: float = 15.0
    # Max wall-clock seconds to spend polling for a result. DropContact
    # usually answers in 20–60 s; cap at 90 to bound validation latency.
    DROPCONTACT_POLL_TIMEOUT: float = 90.0
    DROPCONTACT_POLL_INTERVAL: float = 5.0

    # SMTP (transactional email — Gmail/Workspace via app password). An
    # empty SMTP_HOST disables sending: the mailer logs the message instead
    # of shipping it, so local dev needs no credentials.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    # Gmail rewrites this to SMTP_USER unless the address is a verified
    # "Send mail as" alias on that account.
    SMTP_FROM: str = "Youssef @ Growth With Flow <youssef@growthwithflow.com>"
    # Port 465 speaks TLS from the first byte; 587 starts plain and upgrades.
    SMTP_USE_SSL: bool = True
    SMTP_TIMEOUT: float = 15.0

    # JWT auth.
    JWT_SECRET_KEY: str = "change-me-in-prod"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    PASSWORD_RESET_EXPIRE_MINUTES: int = 60
    # Where the user lands after clicking a reset link in an email.
    FRONTEND_URL: str = "http://localhost:5173"

    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


settings = Settings()
