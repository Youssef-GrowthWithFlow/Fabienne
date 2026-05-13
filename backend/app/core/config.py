from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change-this-in-production"
    DATABASE_URL: str = "postgresql+asyncpg://fabienne:changeme@db:5432/fabienne_db"
    CORS_ORIGINS: str = "http://localhost:5173"

    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


settings = Settings()
