"""PII sanitization. Build-time only, never runs in CI."""
from __future__ import annotations
from copy import deepcopy

# Tables that contain user-private data and are dropped wholesale.
DROPPED_TABLES = frozenset({
    "user",
    "password_reset_token",
    "intern",
    "intern_action_log",
    "active_version_email_sent",
    "bill_notification",
    "bill_flag",
    "bill_tracking",
    "user_flag_preference",
    "legislator_organization_tracking",
    "opinion_version_dismissal",
    "alembic_version",
})


def sanitize(tables: dict[str, list[dict]]) -> dict[str, list[dict]]:
    """Return a sanitized copy of `tables`."""
    tables = deepcopy(tables)
    for t in DROPPED_TABLES:
        tables.pop(t, None)
    return tables
