"""PII sanitization. Build-time only, never runs in CI."""
from __future__ import annotations
import re
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

_DEMO_COMMENTS = [
    "Strong support — aligns with our policy priorities.",
    "Concerned about the implementation timeline for smaller districts.",
    "Neutral; would support with amendments to section 3.",
    "Opposed — would create unfunded mandates for local agencies.",
    "Support in concept; the fiscal note needs review.",
    "Would prefer the prior version's language on enforcement.",
    "Strong support, especially provisions in lines 12–28.",
    "Need clarity on how this interacts with last session's reforms.",
]

_FAKE_ORGS = [
    "Mountain West Policy Group",
    "Beehive Civic Forum",
    "Utah Education Alliance",
    "Wasatch Business Council",
    "Salt Lake Civic Trust",
]


class SecretLeak(RuntimeError):
    """Raised when the post-sanitize scan finds something it shouldn't."""


_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

_DENYLIST = (
    "SECRET_KEY",
    "POSTGRES_PASSWORD",
    "RESEND_API_KEY",
    "re_HFAZBHEM",
    "*SnIc62-540-3044",
)


def _fake_org_for(real_id):
    if real_id is None:
        return None
    idx = sum(ord(c) for c in str(real_id)) % len(_FAKE_ORGS)
    return f"demo-{idx}"


def _replace_comment(opinion_id):
    if opinion_id is None:
        return _DEMO_COMMENTS[0]
    idx = sum(ord(c) for c in str(opinion_id)) % len(_DEMO_COMMENTS)
    return _DEMO_COMMENTS[idx]


def _scan(tables: dict[str, list[dict]], real_user_names: set[str]) -> None:
    for table, rows in tables.items():
        for row in rows:
            for col, val in row.items():
                if not isinstance(val, str):
                    continue
                if _EMAIL_RE.search(val):
                    raise SecretLeak(
                        f"email-shaped string in {table}.{col} (id={row.get('id')})"
                    )
                for needle in _DENYLIST:
                    if needle in val:
                        raise SecretLeak(
                            f"denylisted substring '{needle}' in {table}.{col}"
                        )
                for name in real_user_names:
                    if name and name in val:
                        raise SecretLeak(
                            f"real user name '{name}' in {table}.{col} (id={row.get('id')})"
                        )


def sanitize(
    tables: dict[str, list[dict]],
    real_user_names: set[str] | None = None,
) -> dict[str, list[dict]]:
    """Return a sanitized copy of `tables`."""
    tables = deepcopy(tables)
    for t in DROPPED_TABLES:
        tables.pop(t, None)

    for op in tables.get("opinions", []):
        op["comments"] = _replace_comment(op.get("id"))
        op["user_org_id"] = _fake_org_for(op.get("user_org_id"))
        op["user_id"] = _fake_org_for(op.get("user_id"))
        op["scraper_source"] = None
        op["last_scraped_at"] = None

    if "notes" in tables:
        tables["notes"] = []

    _scan(tables, real_user_names or set())
    return tables


def fake_org_names() -> list[str]:
    """Public lookup table for writers/seed to resolve `demo-N` → display name."""
    return list(_FAKE_ORGS)
