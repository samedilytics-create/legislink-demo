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
    "North Wasatch Coalition",
    "Bonneville Reform Council",
    "Cache Valley Voters",
    "Provo Neighborhood Alliance",
    "Iron County Trades Council",
    "Greater Ogden Civic League",
    "Capitol Reef Conservation Group",
    "Utah Small Business Federation",
    "Statewide Renters Association",
    "Park City Open Lands Project",
    "Dixie Ratepayers Coalition",
    "Wasatch Front Transit Riders",
    "Utah Library Defenders",
    "Beehive Tech & Privacy Council",
    "St. George Civic Roundtable",
    "Davis County Parents Network",
    "Utah Rural Health Association",
    "Cottonwood Heights Civic Club",
    "Sevier Valley Farmers Coalition",
    "Greater Logan Workforce Alliance",
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

# Tables whose rows are public legislative metadata. Legislator names appear
# here by design, so we exempt them from the real-user-name scan. Email and
# denylist scans still apply to these tables.
_PUBLIC_RECORD_TABLES = frozenset({
    "legislator",
    "committee",
    "committee_meeting",
    "committee_membership",
})

# Specific fields in otherwise-private tables where legislator names appear
# as published legislative record (bill sponsors are on the public bill itself).
_PUBLIC_RECORD_FIELDS = frozenset({
    ("bill", "sponsor"),
    ("bill", "floor_sponsor"),
})


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


_NAME_RE_CACHE: dict[str, "re.Pattern[str]"] = {}


def _compile_name_re(name: str) -> "re.Pattern[str]":
    """Word-boundary, case-insensitive match for `name`.

    Substring matching false-positives on common short usernames (`hallen`
    matches inside `challenging`); word-boundary is the semantically correct
    threat model — we care about a real identifier appearing as an identifier,
    not as random letters inside a longer word.
    """
    pat = re.compile(rf"\b{re.escape(name)}\b", re.IGNORECASE)
    _NAME_RE_CACHE[name] = pat
    return pat


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
                # Public legislative-record fields contain legislator names by
                # design; skip the name guard there but keep email/denylist scans.
                if table in _PUBLIC_RECORD_TABLES:
                    continue
                if (table, col) in _PUBLIC_RECORD_FIELDS:
                    continue
                for name in real_user_names:
                    if name and _NAME_RE_CACHE.get(name, _compile_name_re(name)).search(val):
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


# --- Bill selection ---------------------------------------------------------

# Bills referenced by seed/demo-accounts.yaml. Always included so the seeded
# tracked-bills lists on the portal home pages aren't broken.
_SEED_BILL_NUMBERS = frozenset({"HB0001", "HB0142", "HB0220", "SB0003", "SB0042"})

# Per-prefix quota; total ~102. Even House/Senate split, with a sprinkling of
# joint, concurrent, and simple resolutions on each side so all bill kinds
# show up in the demo.
_PREFIX_QUOTAS = {
    "HB": 40,
    "SB": 40,
    "HJR": 6,
    "SJR": 6,
    "HCR": 3,
    "SCR": 3,
    "HR": 2,
    "SR": 2,
}


def _bill_prefix(bill_number: str) -> str:
    return re.match(r"^([A-Za-z]+)", bill_number or "").group(1) if bill_number else ""


def _bill_numeric(bill_number: str) -> int:
    m = re.search(r"(\d+)", bill_number or "")
    return int(m.group(1)) if m else 10**9


def select_demo_bills(bills: list[dict]) -> list[dict]:
    """Return a small demo-friendly subset of bills.

    Always includes anything referenced by the seed; otherwise fills each
    prefix's quota with the lowest-numbered bills of that prefix.
    """
    by_number = {b.get("bill_number"): b for b in bills if b.get("bill_number")}
    selected: list[dict] = []
    seen_numbers: set[str] = set()
    for n in _SEED_BILL_NUMBERS:
        b = by_number.get(n)
        if b is not None:
            selected.append(b)
            seen_numbers.add(n)

    from collections import defaultdict
    by_prefix: dict[str, list[dict]] = defaultdict(list)
    for b in bills:
        bn = b.get("bill_number")
        if not bn or bn in seen_numbers:
            continue
        p = _bill_prefix(bn)
        if p in _PREFIX_QUOTAS:
            by_prefix[p].append(b)

    for prefix, quota in _PREFIX_QUOTAS.items():
        seed_in_prefix = sum(1 for n in seen_numbers if _bill_prefix(n) == prefix)
        remaining = max(0, quota - seed_in_prefix)
        candidates = sorted(by_prefix[prefix], key=lambda b: _bill_numeric(b["bill_number"]))
        selected.extend(candidates[:remaining])

    return selected


# --- Opinion synthesis ------------------------------------------------------

_STANCES = [
    "strongly_oppose",
    "oppose_in_concept",
    "neutral",
    "support_in_concept",
    "strongly_support",
]
_ACTIONS = [None, "yea", "nay", "amend", "hold"]
_EMPTY_BILL_COUNT = 10
_MIN_OPINIONS = 1
_MAX_OPINIONS = 15


def _seeded_random(seed_str: str):
    """Return a random.Random seeded deterministically from a string."""
    import random
    return random.Random(seed_str)


def fake_org_records() -> list[dict]:
    """The fake-org list rendered as organization rows (for organizations.json)."""
    return [
        {
            "id": f"fake-{i}",
            "name": name,
            "description": None,
            "address": None,
            "city": None,
            "state": "UT",
            "zip_code": None,
            "phone": None,
            "website": None,
        }
        for i, name in enumerate(_FAKE_ORGS)
    ]


def synthesize_opinions(bills: list[dict], *, seed: str = "legislink-demo-opinions") -> list[dict]:
    """Build a synthetic opinions list so every bill has 1..15 opinions, except
    a deterministic random subset of `_EMPTY_BILL_COUNT` bills that get none.

    Each opinion uses a fake org id of the shape ``fake-N`` (matching
    `fake_org_records()`), unique within a single bill so the legislator
    opinion bar shows distinct organizations per segment.
    """
    import random
    rng = _seeded_random(seed)
    bill_ids = [b["id"] for b in bills if b.get("id") is not None]
    if not bill_ids:
        return []

    empty_count = min(_EMPTY_BILL_COUNT, len(bill_ids))
    empty_set = set(rng.sample(bill_ids, empty_count))

    out: list[dict] = []
    next_id = 1
    org_pool_size = len(_FAKE_ORGS)
    for bill_id in bill_ids:
        if bill_id in empty_set:
            continue
        # Per-bill RNG so adding/removing bills upstream doesn't reshuffle the
        # whole world.
        per_bill_rng = _seeded_random(f"{seed}:{bill_id}")
        target = per_bill_rng.randint(_MIN_OPINIONS, min(_MAX_OPINIONS, org_pool_size))
        org_indices = per_bill_rng.sample(range(org_pool_size), target)
        for oi in org_indices:
            stance = per_bill_rng.choice(_STANCES)
            action = per_bill_rng.choice(_ACTIONS)
            comment_idx = per_bill_rng.randrange(len(_DEMO_COMMENTS))
            out.append({
                "id": str(next_id),
                "bill_id": bill_id,
                "user_id": f"fake-{oi}",
                "user_org_id": f"fake-{oi}",
                "bill_version": "0",
                "opinion": stance,
                "action": action,
                "comments": _DEMO_COMMENTS[comment_idx],
                "scraper_source": None,
                "last_scraped_at": None,
                "is_stale": "f",
                "created_at": None,
                "updated_at": None,
            })
            next_id += 1
    return out
