"""Entry point: parse the Postgres dump, sanitize, render templates, copy assets."""
from __future__ import annotations
import argparse
import shutil
from pathlib import Path
import yaml

from build.dump_parser import parse_dump
from build.sanitize import (
    sanitize, fake_org_names, fake_org_records,
    synthesize_opinions, select_demo_bills,
)
from build.writers import (
    write_bills, write_legislators, write_committees,
    write_organizations, write_opinions, write_demo_accounts,
)
from build.flask_shim import DemoUser
from build.render import make_env, render_page


def _real_user_names(tables: dict[str, list[dict]]) -> set[str]:
    """Names we must verify never appear in any non-public-record JSON value.

    Legislators are public officials whose identity is part of the public record;
    their `user` rows are excluded from this guardrail. We focus on protecting
    lobbyists/interns/staff users.
    """
    names: set[str] = set()
    for u in tables.get("user", []):
        if u.get("role") == "legislator":
            continue
        if u.get("username"):
            names.add(u["username"])
        if u.get("business_name"):
            names.add(u["business_name"])
        if u.get("first_name") and u.get("last_name"):
            names.add(f"{u['first_name']} {u['last_name']}")
            names.add(f"{u['last_name']}, {u['first_name']}")
    return names


def _load_seed(repo_root: Path) -> dict:
    seed_path = repo_root / "seed" / "demo-accounts.yaml"
    with open(seed_path) as f:
        return yaml.safe_load(f)


def _build_demo_accounts_json(seed: dict) -> dict:
    """Pass seed through unchanged + attach the fake-org lookup table."""
    return {
        **seed,
        "fake_orgs": fake_org_names(),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dump", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=Path("dist"))
    args = ap.parse_args()

    repo_root = Path(__file__).resolve().parent.parent

    print(f"Parsing {args.dump}...")
    tables = dict(parse_dump(args.dump))
    print(f"  Got tables: {sorted(tables)}")

    real_names = _real_user_names(tables)
    print(f"  Real-name guardrail loaded ({len(real_names)} entries)")

    print("Sanitizing...")
    clean = sanitize(tables, real_user_names=real_names)
    print(f"  Sanitized tables: {sorted(clean)}")

    # Trim the bill set to keep the demo snappy. Drop bill_versions for any
    # bills we just removed so writers don't include orphan rows.
    full_bill_count = len(clean.get("bill", []))
    clean["bill"] = select_demo_bills(clean.get("bill", []))
    kept_ids = {b["id"] for b in clean["bill"]}
    clean["bill_version"] = [
        v for v in clean.get("bill_version", []) if v.get("bill_id") in kept_ids
    ]
    print(f"  Selected {len(clean['bill'])} of {full_bill_count} bills for the demo")

    data_dir = args.out / "data"
    print(f"Writing JSON to {data_dir}/...")
    write_bills(data_dir / "bills.json",
                clean.get("bill", []), clean.get("bill_version", []))
    write_legislators(data_dir / "legislators.json", clean.get("legislator", []))
    write_committees(data_dir / "committees.json",
                     clean.get("committee", []),
                     clean.get("committee_meeting", []),
                     clean.get("committee_membership", []))
    # Replace the real organization list with the demo's fake-org pool so the
    # legislator opinion bar resolves `fake-N` ids to readable display names.
    write_organizations(data_dir / "organizations.json", fake_org_records())
    # Synthesize opinions so every bill has 1..15 (10 bills intentionally empty).
    synthetic_opinions = synthesize_opinions(clean.get("bill", []))
    print(f"  Synthesized {len(synthetic_opinions)} opinions across "
          f"{len({op['bill_id'] for op in synthetic_opinions})} bills")
    write_opinions(data_dir / "opinions.json", synthetic_opinions)

    seed = _load_seed(repo_root)
    write_demo_accounts(data_dir / "demo-accounts.json",
                        _build_demo_accounts_json(seed))

    print("Copying static assets...")
    static_dst = args.out / "static"
    if static_dst.exists():
        shutil.rmtree(static_dst)
    shutil.copytree(
        repo_root.parent / "Lobbi" / "app" / "static",
        static_dst,
    )
    overlay_static = repo_root / "overlays" / "static"
    if overlay_static.exists():
        for p in overlay_static.rglob("*"):
            if p.is_file():
                rel = p.relative_to(overlay_static)
                dst = static_dst / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(p, dst)
    print(f"  static/ has {sum(1 for _ in static_dst.rglob('*') if _.is_file())} files")

    print(f"Rendering pages to {args.out}/...")
    env = make_env()

    landing_ctx = {
        "h_count": sum(1 for b in clean.get("bill", []) if (b.get("bill_number") or "").startswith("H")),
        "s_count": sum(1 for b in clean.get("bill", []) if (b.get("bill_number") or "").startswith("S")),
    }
    render_page(env, "index.html", args.out / "index.html",
                endpoint="index", user=None, **landing_ctx)

    for tmpl, out_path in [
        ("auth/login.html",                "auth/login/index.html"),
        ("auth/register.html",             "auth/register/index.html"),
        ("auth/choose_account_type.html",  "auth/choose-account-type/index.html"),
        ("auth/forgot_password.html",      "auth/forgot-password/index.html"),
    ]:
        render_page(env, tmpl, args.out / out_path,
                    endpoint="auth.login", user=None)

    portal_ctx = {
        "bills": [],
        "tracked_bills": [],
        "flags": {},
        "opinions": {},
        "categories": [],
        "bill_flag_colors": [],
        "upcoming_meetings": [],
        "missing_opinions": [],
        "form": None,
    }

    lobbyist_user = DemoUser.lobbyist()
    for tmpl, endpoint, out_path in [
        ("lobbyist/home.html",     "lobbyist_routes.home",     "lobbyist/index.html"),
        ("lobbyist/table.html",    "lobbyist_routes.table",    "lobbyist/table/index.html"),
        ("lobbyist/search.html",   "lobbyist_routes.search",   "lobbyist/search/index.html"),
        ("lobbyist/bill.html",     "lobbyist_routes.bill",     "lobbyist/bill/index.html"),
        ("lobbyist/settings.html", "lobbyist_routes.settings", "lobbyist/settings/index.html"),
    ]:
        render_page(env, tmpl, args.out / out_path,
                    endpoint=endpoint, user=lobbyist_user, **portal_ctx)

    legislator_user = DemoUser.legislator()
    for tmpl, endpoint, out_path in [
        ("legislator/home.html",     "legislator_routes.home",     "legislator/index.html"),
        ("legislator/table.html",    "legislator_routes.table",    "legislator/table/index.html"),
        ("legislator/search.html",   "legislator_routes.search",   "legislator/search/index.html"),
        ("legislator/bill.html",     "legislator_routes.bill",     "legislator/bill/index.html"),
        ("legislator/settings.html", "legislator_routes.settings", "legislator/settings/index.html"),
    ]:
        render_page(env, tmpl, args.out / out_path,
                    endpoint=endpoint, user=legislator_user, **portal_ctx)

    render_page(env, "404.html", args.out / "404.html",
                endpoint="index", user=None)
    (args.out / "CNAME").write_text("legislink.us\n")

    print("Done.")


if __name__ == "__main__":
    main()
