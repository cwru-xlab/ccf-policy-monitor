"""Settings read from .env. See example.env for every key."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Required keys have no default, so the app fails at startup if they are missing."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    openai_api_key: str
    openai_model: str = "gpt-6-luna"
    openai_embedding_model: str = "text-embedding-3-small"
    storage_root: Path = Path("data/objects")

    # Per-source keys. A source whose key is empty is fetched without one where the
    # API allows it (openFDA, PubMed: lower rate limits) and fails where it does not (USPSTF).
    openfda_api_key: str = ""
    ncbi_api_key: str = ""
    uspstf_api_key: str = ""


settings = Settings()
