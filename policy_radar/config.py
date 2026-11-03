"""Settings read from .env. See example.env for every key."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Required keys have no default, so the app fails at startup if they are missing."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    aws_region: str = "us-east-1"
    bedrock_model: str = "us.anthropic.claude-haiku-5-5"  # criteria extraction
    comparison_model: str = "us.anthropic.claude-opus-5-5"  # guideline-vs-policy conflict check
    bedrock_embedding_model: str = "amazon.titan-embed-text-v2:0"
    storage_root: Path = Path("data/objects")

    # Per-source keys. A source whose key is empty is fetched without one where the
    # API allows it (openFDA, PubMed: lower rate limits) and fails where it does not (USPSTF).
    openfda_api_key: str = ""
    ncbi_api_key: str = ""
    uspstf_api_key: str = ""


settings = Settings()
