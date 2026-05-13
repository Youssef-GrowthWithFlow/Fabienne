from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change-this-in-production"
    DATABASE_URL: str = "postgresql+asyncpg://fabienne:changeme@db:5432/fabienne_db"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]


settings = Settings()
