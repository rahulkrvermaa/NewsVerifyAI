from functools import lru_cache
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env."""

    model_config = SettingsConfigDict(
        env_file=(str(ROOT_DIR / ".env"), str(Path(__file__).resolve().parent / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    LLM_API_KEY: str = ""
    TAVILY_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    DATABASE_URL: str = f"sqlite:///{(ROOT_DIR / 'newsverify.db').as_posix()}"

    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    CROSS_ENCODER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    NLI_MODEL: str = "facebook/bart-large-mnli"
    SPACY_MODEL: str = "en_core_web_sm"

    MAX_UPLOAD_MB: int = 10
    MAX_URL_BYTES: int = 5 * 1024 * 1024
    REQUEST_TIMEOUT_SECONDS: int = 20
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def llm_configured(self) -> bool:
        return bool(self.LLM_API_KEY and self.LLM_API_KEY.strip())

    @property
    def tavily_configured(self) -> bool:
        return bool(self.TAVILY_API_KEY and self.TAVILY_API_KEY.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
