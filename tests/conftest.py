"""Required settings get dummy values so modules import without a .env; no test touches them."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql://unused")
os.environ.setdefault("OPENAI_API_KEY", "unused")
