"""Required settings get dummy values so modules import without a .env; no test touches them."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql://unused")
