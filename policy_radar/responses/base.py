"""Shared base class and date parsing for provider response models."""

import re
from datetime import date, datetime
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, ConfigDict


class ProviderModel(BaseModel):
    """A third-party payload. Fields we depend on are typed; the rest are kept, not rejected.

    ``extra="forbid"`` (used for our own models) would fail on the first field a provider adds.
    """

    model_config = ConfigDict(frozen=True, extra="allow")


_COMPACT = re.compile(r"^(\d{8})(\d{6})?$")  # YYYYMMDD or YYYYMMDDhhmmss


def compact_date(value: Any) -> date:
    """Calendar date from ``YYYYMMDD``, ``YYYYMMDDhhmmss`` or ISO ``YYYY-MM-DD``.

    pydantic would read a digits-only string as a Unix timestamp, so providers' compact
    dates are parsed explicitly. Raises ValueError for anything else, including "" and "N/A".
    """
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not isinstance(value, str):
        raise ValueError(f"not a date string: {value!r}")  # noqa: TRY004 - pydantic needs ValueError
    if m := _COMPACT.match(value):
        d = m.group(1)
        return date(int(d[:4]), int(d[4:6]), int(d[6:]))
    return date.fromisoformat(value)


_MDY = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")


def mdy_date(value: Any) -> date | None:
    """``MM/DD/YYYY`` to a date; anything else to None.

    CMS serves "", "N/A" and, for old NCDs, a sentence ("...the effective date is not
    available") in date fields. The date is informational, so those are not errors.
    """
    if isinstance(value, str) and (m := _MDY.match(value)):
        return date(int(m.group(3)), int(m.group(1)), int(m.group(2)))
    return None


CompactDate = Annotated[date, BeforeValidator(compact_date)]
MdyDate = Annotated[date | None, BeforeValidator(mdy_date)]
