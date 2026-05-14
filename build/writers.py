"""JSON writers, one per dataset. Each function takes already-sanitized rows."""
from __future__ import annotations
import json
from pathlib import Path
from collections import defaultdict


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))


def write_bills(path: Path, bills: list[dict], versions: list[dict]) -> None:
    by_bill = defaultdict(list)
    for v in versions:
        by_bill[v["bill_id"]].append(v)
    payload = []
    for b in bills:
        out = dict(b)
        out["versions"] = sorted(
            by_bill.get(b["id"], []),
            key=lambda v: int(v.get("version") or 0),
        )
        payload.append(out)
    _write(path, payload)


def write_legislators(path: Path, legislators: list[dict]) -> None:
    _write(path, legislators)


def write_committees(
    path: Path,
    committees: list[dict],
    meetings: list[dict],
    memberships: list[dict],
) -> None:
    mem_by_c = defaultdict(list)
    for m in memberships:
        mem_by_c[m["committee_id"]].append(m)
    meet_by_c = defaultdict(list)
    for m in meetings:
        meet_by_c[m["committee_id"]].append(m)
    payload = []
    for c in committees:
        out = dict(c)
        # `committee.id` is the PK; meetings/memberships reference the
        # committee's short code in `committee_id`. Join on the code.
        key = c.get("committee_id") or c.get("id")
        out["members"] = mem_by_c.get(key, [])
        out["meetings"] = meet_by_c.get(key, [])
        payload.append(out)
    _write(path, payload)


def write_organizations(path: Path, orgs: list[dict]) -> None:
    _write(path, orgs)


def write_opinions(path: Path, opinions: list[dict]) -> None:
    """Opinions written as { bill_id: [...] } for fast lookup on bill page."""
    by_bill = defaultdict(list)
    for op in opinions:
        by_bill[op["bill_id"]].append(op)
    _write(path, dict(by_bill))


def write_demo_accounts(path: Path, accounts: dict) -> None:
    _write(path, accounts)
