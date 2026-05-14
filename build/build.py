"""Entry point: parse the Postgres dump, sanitize, render templates, copy assets."""
from __future__ import annotations
import argparse
import shutil
from pathlib import Path
import yaml

from build.dump_parser import parse_dump
from build.sanitize import sanitize, fake_org_names
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

    data_dir = args.out / "data"
    print(f"Writing JSON to {data_dir}/...")
    write_bills(data_dir / "bills.json",
                clean.get("bill", []), clean.get("bill_version", []))
    write_legislators(data_dir / "legislators.json", clean.get("legislator", []))
    write_committees(data_dir / "committees.json",
                     clean.get("committee", []),
                     clean.get("committee_meeting", []),
                     clean.get("committee_membership", []))
    write_organizations(data_dir / "organizations.json", clean.get("organization", []))
    write_opinions(data_dir / "opinions.json", clean.get("opinions", []))

    seed = _load_seed(repo_root)
    write_demo_accounts(data_dir / "demo-accounts.json",
                        _build_demo_accounts_json(seed))

    print("Copying static assets...")
    static_dst = args.out / "static"
    if static_dst.exists():
        shutil.rmtree(static_dst)
    shutil.copytree(
        repo_root.parent / "Legislink-2026-backup" / "app" / "static",
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

    print("Done.")


if __name__ == "__main__":
    main()
