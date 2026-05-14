# Legislink Off-Season Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static GitHub Pages site that demos legislink.us during the Utah legislative off-season, with realistic 2026-session data and convincing client-side interactivity.

**Architecture:** A Python build script parses the Postgres dump at `legislink-2026.db`, sanitizes PII, writes JSON datasets, and renders the existing Flask Jinja templates to static HTML using a Flask-shim. A vanilla-JS client layer hydrates pages from JSON and persists demo write actions in `localStorage`. Deployed to GitHub Pages at `legislink.us`.

**Tech Stack:** Python 3.11+, Jinja2, PyYAML, pytest, vanilla JavaScript (ES modules), GitHub Pages.

**Spec:** [`docs/superpowers/specs/2026-05-13-legislink-demo-design.md`](../specs/2026-05-13-legislink-demo-design.md)

**Repo root:** `/mnt/c/Users/Snic9/Lobbi/legislink-demo/`
**Dump source (never committed):** `/mnt/c/Users/Snic9/Lobbi/legislink-2026.db`
**Flask source (read-only):** `/mnt/c/Users/Snic9/Lobbi/Legislink-2026-backup/`

---

## File Structure

```
legislink-demo/
├── build/
│   ├── __init__.py
│   ├── build.py             entry point, argparse, orchestrates all steps
│   ├── dump_parser.py       parses Postgres COPY blocks → row dicts
│   ├── sanitize.py          PII strip, opinion-text rewriter, secret scan
│   ├── writers.py           JSON output writers (one per dataset)
│   ├── url_map.py           Flask endpoint name → static path map
│   ├── flask_shim.py        Jinja globals: url_for, current_user, request, ...
│   └── render.py            Jinja environment + page rendering helpers
├── tests/
│   ├── __init__.py
│   ├── conftest.py          pytest fixtures
│   ├── fixtures/
│   │   └── sample_dump.sql  small handcrafted dump (~10 rows per table)
│   ├── test_dump_parser.py
│   ├── test_sanitize.py
│   ├── test_writers.py
│   ├── test_url_map.py
│   └── test_flask_shim.py
├── overlays/
│   ├── templates/
│   │   ├── base.html        adds demo banner, disables session-timeout JS
│   │   └── auth/            hand-written static auth pages (no WTForms)
│   │       ├── login.html
│   │       ├── register.html
│   │       ├── choose_account_type.html
│   │       └── forgot_password.html
│   └── static/
│       ├── css/
│       │   └── demo.css     demo banner styles
│       └── js/
│           ├── demo-state.js     localStorage read/write
│           ├── demo-auth.js      sign-in/out
│           ├── demo-hydrate.js   table + detail hydration
│           ├── demo-router.js    hash routing
│           └── demo.js           entry: imports the above, wires it up
├── seed/
│   └── demo-accounts.yaml   hand-authored fake lobbyist + legislator profiles
├── docs/
│   └── superpowers/
│       ├── specs/2026-05-13-legislink-demo-design.md
│       └── plans/2026-05-13-legislink-demo.md
├── requirements.txt
├── Makefile
├── .gitignore               (exists)
└── README.md
```

Each Python module has one clear responsibility, each is independently testable. JS is split into focused ES modules loaded as `<script type="module">` from generated pages.

---

## Task 1: Project skeleton + dependencies

**Files:**
- Create: `legislink-demo/requirements.txt`
- Create: `legislink-demo/Makefile`
- Create: `legislink-demo/README.md`
- Create: `legislink-demo/build/__init__.py` (empty)
- Create: `legislink-demo/tests/__init__.py` (empty)
- Create: `legislink-demo/tests/conftest.py` (empty for now)

- [ ] **Step 1: Write `requirements.txt`**

```
jinja2==3.1.4
pyyaml==6.0.2
pytest==8.3.3
```

- [ ] **Step 2: Write `Makefile`**

```makefile
.PHONY: install build serve clean test deploy

PYTHON ?= python3
DUMP   ?= ../legislink-2026.db
OUT    ?= dist

install:
	$(PYTHON) -m pip install -r requirements.txt

test:
	$(PYTHON) -m pytest tests/ -v

build:
	$(PYTHON) -m build.build --dump $(DUMP) --out $(OUT)

serve: build
	$(PYTHON) -m http.server -d $(OUT) 8080

clean:
	rm -rf $(OUT) build/__pycache__ tests/__pycache__ .pytest_cache

deploy: build
	./scripts/deploy.sh
```

- [ ] **Step 3: Write `README.md`** (place-keeper; full deploy/DNS docs go in Task 30)

```markdown
# legislink-demo

Off-season static demo of legislink.us. See `docs/superpowers/specs/`.

## Quick start

    make install
    make build         # reads ../legislink-2026.db, writes ./dist/
    make serve         # http://localhost:8080

## Tests

    make test
```

- [ ] **Step 4: Create empty package files**

```bash
touch build/__init__.py tests/__init__.py tests/conftest.py
```

- [ ] **Step 5: Install deps and confirm pytest runs**

Run: `cd /mnt/c/Users/Snic9/Lobbi/legislink-demo && make install && python3 -m pytest tests/ -v`
Expected: pytest reports `collected 0 items` (no failure).

- [ ] **Step 6: Commit**

```bash
git add requirements.txt Makefile README.md build/__init__.py tests/__init__.py tests/conftest.py
git commit -m "chore: project skeleton + pytest harness"
```

---

## Task 2: Dump-parser test fixture

**Files:**
- Create: `legislink-demo/tests/fixtures/sample_dump.sql`

The parser is tested against a tiny hand-written dump that exercises every escape and edge case. Keep it small so failures point clearly at the cause.

- [ ] **Step 1: Write the fixture**

```sql
--
-- Tiny Postgres dump used to test dump_parser. Mirrors the shape of
-- legislink-2026.db but contains only synthetic rows.
--

SET client_encoding = 'UTF8';

CREATE TABLE public.bill (
    id integer NOT NULL,
    bill_number character varying(10),
    title text,
    sponsor text,
    detailed_description text
);

COPY public.bill (id, bill_number, title, sponsor, detailed_description) FROM stdin;
1	HB0001	Tab\tin Title	Rep. Test	First line<hr><ltbullet>two\nlines
2	SB0002	NULL Sponsor	\N	plain text
3	HB0003	Backslash \\ test	Rep. Other	end
\.

CREATE TABLE public."user" (
    id integer NOT NULL,
    username character varying(80),
    email character varying(120)
);

COPY public."user" (id, username, email) FROM stdin;
10	alice	alice@example.com
11	bob	bob@example.com
\.

CREATE TABLE public.legislator (
    id integer,
    username character varying(80),
    legislator_id character varying(20),
    district character varying(20),
    house character varying(1),
    party character varying(20)
);

COPY public.legislator (id, username, legislator_id, district, house, party) FROM stdin;
100	test_legi	TL01	1	H	R
\.
```

- [ ] **Step 2: Commit**

```bash
git add tests/fixtures/sample_dump.sql
git commit -m "test: tiny sample Postgres dump fixture"
```

---

## Task 3: Dump parser — basic COPY block extraction

**Files:**
- Create: `legislink-demo/build/dump_parser.py`
- Create: `legislink-demo/tests/test_dump_parser.py`

The parser yields `(table_name, [row_dict, ...])` tuples by scanning for `COPY public.<name> (col, ...) FROM stdin;` lines, reading TSV rows until `\.`, and applying Postgres escapes.

- [ ] **Step 1: Write the failing test**

`tests/test_dump_parser.py`:

```python
from pathlib import Path
from build.dump_parser import parse_dump

FIXTURE = Path(__file__).parent / "fixtures" / "sample_dump.sql"


def test_parse_dump_returns_all_tables():
    tables = dict(parse_dump(FIXTURE))
    assert set(tables) == {"bill", "user", "legislator"}


def test_bill_rows_have_expected_columns():
    tables = dict(parse_dump(FIXTURE))
    bills = tables["bill"]
    assert len(bills) == 3
    assert bills[0]["id"] == "1"
    assert bills[0]["bill_number"] == "HB0001"
    assert bills[0]["sponsor"] == "Rep. Test"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_dump_parser.py -v`
Expected: FAIL (ImportError: `build.dump_parser`)

- [ ] **Step 3: Write minimal `dump_parser.py`**

```python
"""Parse a `pg_dump --inserts=false` plain-text dump into row dicts.

Only handles the COPY ... FROM stdin form. No DB driver needed.
"""

from __future__ import annotations
import re
from pathlib import Path
from typing import Iterator

_COPY_RE = re.compile(
    r'^COPY public\.(?P<table>"?\w+"?) \((?P<cols>[^)]+)\) FROM stdin;\s*$'
)


def _unquote_table(name: str) -> str:
    return name.strip('"')


def parse_dump(path: Path) -> Iterator[tuple[str, list[dict]]]:
    """Yield (table_name, [row_dict, ...]) for every COPY block in the dump."""
    text = Path(path).read_text(encoding="utf-8")
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        m = _COPY_RE.match(lines[i])
        if not m:
            i += 1
            continue
        table = _unquote_table(m.group("table"))
        cols = [c.strip() for c in m.group("cols").split(",")]
        rows: list[dict] = []
        i += 1
        while i < len(lines) and lines[i] != r"\.":
            rows.append(_parse_row(lines[i], cols))
            i += 1
        yield table, rows
        i += 1  # skip the \. terminator


def _parse_row(line: str, cols: list[str]) -> dict:
    values = _split_tsv(line)
    return {col: val for col, val in zip(cols, values)}


def _split_tsv(line: str) -> list[str]:
    """Split a Postgres TSV row on unescaped tabs, applying escape rules."""
    values: list[str] = []
    buf: list[str] = []
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == "\\" and i + 1 < len(line):
            nxt = line[i + 1]
            if nxt == "N":
                # \N → None marker; consume both and finalize this field
                # but only if it's the entire field. Defer to caller via "\N"
                buf.append("\\N")
                i += 2
                continue
            mapping = {"t": "\t", "n": "\n", "r": "\r", "\\": "\\"}
            if nxt in mapping:
                buf.append(mapping[nxt])
                i += 2
                continue
            buf.append(ch)
            i += 1
        elif ch == "\t":
            values.append("".join(buf))
            buf = []
            i += 1
        else:
            buf.append(ch)
            i += 1
    values.append("".join(buf))
    return [None if v == "\\N" else v for v in values]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest tests/test_dump_parser.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add build/dump_parser.py tests/test_dump_parser.py
git commit -m "feat(parser): basic COPY block extraction"
```

---

## Task 4: Dump parser — escape edge cases

**Files:**
- Modify: `legislink-demo/tests/test_dump_parser.py`

Add tests for `\t`, `\n`, `\\`, and `\N` to lock in the escape behavior.

- [ ] **Step 1: Add failing tests**

Append to `tests/test_dump_parser.py`:

```python
def test_tab_escape_inside_value():
    tables = dict(parse_dump(FIXTURE))
    assert tables["bill"][0]["title"] == "Tab\tin Title"


def test_null_marker_becomes_none():
    tables = dict(parse_dump(FIXTURE))
    assert tables["bill"][1]["sponsor"] is None


def test_backslash_escape():
    tables = dict(parse_dump(FIXTURE))
    assert tables["bill"][2]["title"] == "Backslash \\ test"


def test_newline_escape_in_value():
    tables = dict(parse_dump(FIXTURE))
    assert "two\nlines" in tables["bill"][0]["detailed_description"]


def test_quoted_table_name():
    tables = dict(parse_dump(FIXTURE))
    assert "user" in tables  # was `public."user"` in dump
```

- [ ] **Step 2: Run tests**

Run: `python3 -m pytest tests/test_dump_parser.py -v`
Expected: All five new tests pass on the first try (the implementation already handles these).

If any fail, fix `dump_parser.py` before continuing.

- [ ] **Step 3: Smoke-test against the real dump**

Run:
```bash
python3 -c "
from build.dump_parser import parse_dump
t = dict(parse_dump('/mnt/c/Users/Snic9/Lobbi/legislink-2026.db'))
print({k: len(v) for k, v in t.items()})
"
```

Expected output contains entries like `'bill': 1016`, `'legislator': 107`, `'committee': 83`, `'organization': 17`. If counts are wrong, the parser is broken on real-world rows.

- [ ] **Step 4: Commit**

```bash
git add tests/test_dump_parser.py
git commit -m "test(parser): cover escape edge cases"
```

---

## Task 5: URL map — Flask endpoint → static path

**Files:**
- Create: `legislink-demo/build/url_map.py`
- Create: `legislink-demo/tests/test_url_map.py`

`url_for(endpoint, **kw)` calls in the templates need a static-site equivalent. The mapping is small and explicit — anything missing should fail loudly so we catch new endpoints.

- [ ] **Step 1: Write the failing test**

`tests/test_url_map.py`:

```python
import pytest
from build.url_map import url_for, UnknownEndpoint


def test_index():
    assert url_for("index") == "/"


def test_auth_login():
    assert url_for("auth.login") == "/auth/login/"


def test_lobbyist_home():
    assert url_for("lobbyist_routes.home") == "/lobbyist/"


def test_static_filename():
    assert url_for("static", filename="css/style.css") == "/static/css/style.css"


def test_static_filename_with_space():
    assert url_for("static", filename="Favicon 32.png") == "/static/Favicon%2032.png"


def test_unknown_endpoint_raises():
    with pytest.raises(UnknownEndpoint):
        url_for("does.not.exist")


def test_legislator_bill_uses_hash():
    # Bill detail is hash-routed: /lobbyist/bill/#/HB0142
    assert url_for("lobbyist_routes.bill", bill_id="HB0142") == "/lobbyist/bill/#/HB0142"


def test_view_bill_alias():
    # The Flask app uses both `bill` and `view_bill` for the same target.
    assert url_for("lobbyist_routes.view_bill", bill_id="HB0142") == "/lobbyist/bill/#/HB0142"
    assert url_for("legislator_routes.view_bill", bill_id="HB0142") == "/legislator/bill/#/HB0142"
```

- [ ] **Step 2: Verify failure**

Run: `python3 -m pytest tests/test_url_map.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement `url_map.py`**

```python
"""Flask endpoint → static-site path map.

The shim's url_for() is just a dict lookup with a few dynamic special cases.
Unknown endpoints raise UnknownEndpoint so the build fails loudly.
"""
from __future__ import annotations
from urllib.parse import quote


class UnknownEndpoint(KeyError):
    pass


_STATIC_PATHS: dict[str, str] = {
    "index": "/",
    "auth.login": "/auth/login/",
    "auth.logout": "/auth/logout/",
    "auth.register": "/auth/register/",
    "auth.choose_account_type": "/auth/choose-account-type/",
    "auth.forgot_password": "/auth/forgot-password/",
    "auth.legislator_sign_in": "/auth/legislator-sign-in/",
    "auth.reset_password": "/auth/reset-password/",
    "lobbyist_routes.home": "/lobbyist/",
    "lobbyist_routes.table": "/lobbyist/table/",
    "lobbyist_routes.search": "/lobbyist/search/",
    "lobbyist_routes.settings": "/lobbyist/settings/",
    "legislator_routes.home": "/legislator/",
    "legislator_routes.table": "/legislator/table/",
    "legislator_routes.search": "/legislator/search/",
    "legislator_routes.settings": "/legislator/settings/",
    "legislator_routes.change_password": "/legislator/change-password/",
}

# Endpoints that take a bill_id and route to a hashed detail page.
# Both `bill` and `view_bill` aliases exist because the Flask routes
# expose them under different names depending on portal.
_BILL_DETAIL_ENDPOINTS = {
    "lobbyist_routes.bill": "/lobbyist/bill/#/{bill_id}",
    "lobbyist_routes.view_bill": "/lobbyist/bill/#/{bill_id}",
    "lobbyist_routes.opinion": "/lobbyist/bill/#/{bill_id}",
    "legislator_routes.bill": "/legislator/bill/#/{bill_id}",
    "legislator_routes.view_bill": "/legislator/bill/#/{bill_id}",
}


def url_for(endpoint: str, **kwargs) -> str:
    if endpoint == "static":
        filename = kwargs["filename"]
        return "/static/" + quote(filename)
    if endpoint in _BILL_DETAIL_ENDPOINTS:
        bill_id = kwargs.get("bill_id", "")
        return _BILL_DETAIL_ENDPOINTS[endpoint].format(bill_id=bill_id)
    try:
        return _STATIC_PATHS[endpoint]
    except KeyError as e:
        raise UnknownEndpoint(endpoint) from e
```

- [ ] **Step 4: Run tests**

Run: `python3 -m pytest tests/test_url_map.py -v`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add build/url_map.py tests/test_url_map.py
git commit -m "feat(url-map): static-path lookup with hash routes for bill detail"
```

---

## Task 6: Sanitization — drop-columns and table-drops

**Files:**
- Create: `legislink-demo/build/sanitize.py`
- Create: `legislink-demo/tests/test_sanitize.py`

The sanitizer takes the dict-of-tables produced by the parser and returns a sanitized copy. This task implements column-drops and full-table drops. Opinion-text rewriting and the secret-scan guardrail come in later tasks.

- [ ] **Step 1: Write the failing test**

`tests/test_sanitize.py`:

```python
from build.sanitize import sanitize


def test_user_table_is_dropped():
    out = sanitize({"user": [{"email": "a@b.com"}], "bill": [{"id": "1"}]})
    assert "user" not in out
    assert out["bill"] == [{"id": "1"}]


def test_token_table_is_dropped():
    out = sanitize({"password_reset_token": [{"token": "secret"}], "bill": []})
    assert "password_reset_token" not in out


def test_dropped_tables_full_list():
    """All ten user-private tables get dropped."""
    full_input = {
        t: [{"x": "y"}] for t in [
            "user", "password_reset_token", "intern", "intern_action_log",
            "active_version_email_sent", "bill_notification", "bill_flag",
            "bill_tracking", "user_flag_preference",
            "legislator_organization_tracking", "opinion_version_dismissal",
            "alembic_version",
        ]
    }
    full_input["bill"] = []
    out = sanitize(full_input)
    assert set(out.keys()) == {"bill"}
```

- [ ] **Step 2: Verify failure**

Run: `python3 -m pytest tests/test_sanitize.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement minimal `sanitize.py`**

```python
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
```

- [ ] **Step 4: Run tests**

Run: `python3 -m pytest tests/test_sanitize.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add build/sanitize.py tests/test_sanitize.py
git commit -m "feat(sanitize): drop user-private tables"
```

---

## Task 7: Sanitization — opinion text + author remapping

**Files:**
- Modify: `legislink-demo/build/sanitize.py`
- Modify: `legislink-demo/tests/test_sanitize.py`

Opinion `comments` and `notes.note` are real lobbyist commentary — we replace them with curated demo text. `opinions.user_id` and `user_org_id` get mapped to fake demo orgs deterministically.

- [ ] **Step 1: Add failing tests**

```python
def test_opinion_comments_replaced():
    opinions = [
        {"id": "1", "bill_id": "100", "user_id": "5", "user_org_id": "9",
         "comments": "Real lobbyist comment", "opinion": "support"},
    ]
    out = sanitize({"opinions": opinions, "bill": []})
    assert out["opinions"][0]["comments"] != "Real lobbyist comment"
    assert out["opinions"][0]["comments"]  # not empty


def test_opinion_user_id_remapped():
    opinions = [
        {"id": "1", "bill_id": "100", "user_id": "5", "user_org_id": "9",
         "comments": "x", "opinion": "support"},
    ]
    out = sanitize({"opinions": opinions, "bill": []})
    # Real numeric IDs are replaced with the synthetic prefix `demo-`
    assert out["opinions"][0]["user_org_id"].startswith("demo-")


def test_opinion_remapping_is_deterministic():
    opinions = [
        {"id": "1", "user_org_id": "9", "comments": "x", "opinion": "s"},
        {"id": "2", "user_org_id": "9", "comments": "x", "opinion": "s"},
        {"id": "3", "user_org_id": "12", "comments": "x", "opinion": "s"},
    ]
    out = sanitize({"opinions": opinions, "bill": []})
    # Same real org → same fake org. Different real org → different fake org.
    assert out["opinions"][0]["user_org_id"] == out["opinions"][1]["user_org_id"]
    assert out["opinions"][0]["user_org_id"] != out["opinions"][2]["user_org_id"]


def test_notes_table_is_replaced_with_empty_list():
    """Real notes are dropped; fabricated demo notes are injected later from seed."""
    notes = [{"id": "1", "user_id": "5", "note": "real note", "bill_id": "100"}]
    out = sanitize({"notes": notes, "bill": []})
    assert out["notes"] == []
```

- [ ] **Step 2: Verify failures**

Run: `python3 -m pytest tests/test_sanitize.py -v`
Expected: 4 new failures.

- [ ] **Step 3: Extend `sanitize.py`**

Add to `sanitize.py`:

```python
# Curated commentary used to replace real opinion comments. Cycled
# deterministically by opinion id so a given bill's discussion stays
# coherent across reloads.
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


def _fake_org_for(real_id: str | None) -> str | None:
    if real_id is None:
        return None
    # Stable hash → index, so reruns produce the same mapping.
    idx = sum(ord(c) for c in str(real_id)) % len(_FAKE_ORGS)
    return f"demo-{idx}"


def _replace_comment(opinion_id: str | None) -> str:
    if opinion_id is None:
        return _DEMO_COMMENTS[0]
    idx = sum(ord(c) for c in str(opinion_id)) % len(_DEMO_COMMENTS)
    return _DEMO_COMMENTS[idx]


def sanitize(tables: dict[str, list[dict]]) -> dict[str, list[dict]]:
    tables = deepcopy(tables)
    for t in DROPPED_TABLES:
        tables.pop(t, None)

    # Replace opinion text + remap author ids.
    for op in tables.get("opinions", []):
        op["comments"] = _replace_comment(op.get("id"))
        op["user_org_id"] = _fake_org_for(op.get("user_org_id"))
        op["user_id"] = _fake_org_for(op.get("user_id"))
        op["scraper_source"] = None
        op["last_scraped_at"] = None

    # Real notes contain real text; drop them. Demo notes are injected
    # later from seed/demo-accounts.yaml at build time.
    if "notes" in tables:
        tables["notes"] = []

    return tables


def fake_org_names() -> list[str]:
    """Public lookup table for writers/seed to resolve `demo-N` → display name."""
    return list(_FAKE_ORGS)
```

- [ ] **Step 4: Run tests**

Run: `python3 -m pytest tests/test_sanitize.py -v`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add build/sanitize.py tests/test_sanitize.py
git commit -m "feat(sanitize): scrub opinion text + remap authors to fake orgs"
```

---

## Task 8: Sanitization — secret-scan guardrail

**Files:**
- Modify: `legislink-demo/build/sanitize.py`
- Modify: `legislink-demo/tests/test_sanitize.py`

A final defensive pass walks all sanitized values for leaked emails / secrets / real-user names and raises if any are found.

- [ ] **Step 1: Add failing tests**

```python
import pytest
from build.sanitize import sanitize, SecretLeak


def test_email_in_sanitized_output_raises():
    # `user` table is dropped, but defense in depth: any leaked email aborts.
    tables = {"bill": [{"id": "1", "sponsor": "Rep. someone@example.com"}]}
    with pytest.raises(SecretLeak, match="email"):
        sanitize(tables, real_user_names=set())


def test_password_substring_raises():
    tables = {"bill": [{"id": "1", "sponsor": "SECRET_KEY value"}]}
    with pytest.raises(SecretLeak):
        sanitize(tables, real_user_names=set())


def test_real_user_name_raises():
    tables = {"bill": [{"id": "1", "title": "Bill about Alice Stevens"}]}
    with pytest.raises(SecretLeak, match="user name"):
        sanitize(tables, real_user_names={"Alice Stevens"})


def test_clean_input_passes():
    tables = {"bill": [{"id": "1", "title": "School Funding Amendments"}]}
    out = sanitize(tables, real_user_names={"Alice Stevens"})
    assert out["bill"][0]["title"] == "School Funding Amendments"
```

Also update existing `sanitize()` test calls to pass `real_user_names=set()`.

- [ ] **Step 2: Verify failures**

Run: `python3 -m pytest tests/test_sanitize.py -v`
Expected: 4 new failures.

- [ ] **Step 3: Add the guardrail**

Add to `sanitize.py`:

```python
import re

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
```

Update `sanitize()` to take and use the new arg:

```python
def sanitize(
    tables: dict[str, list[dict]],
    real_user_names: set[str] | None = None,
) -> dict[str, list[dict]]:
    tables = deepcopy(tables)
    for t in DROPPED_TABLES:
        tables.pop(t, None)

    for op in tables.get("opinions", []):
        # ... (unchanged)

    if "notes" in tables:
        tables["notes"] = []

    _scan(tables, real_user_names or set())
    return tables
```

- [ ] **Step 4: Run tests**

Run: `python3 -m pytest tests/test_sanitize.py -v`
Expected: All sanitize tests pass.

- [ ] **Step 5: Commit**

```bash
git add build/sanitize.py tests/test_sanitize.py
git commit -m "feat(sanitize): secret-scan guardrail (email / denylist / real names)"
```

---

## Task 9: JSON writers

**Files:**
- Create: `legislink-demo/build/writers.py`
- Create: `legislink-demo/tests/test_writers.py`

Each writer takes sanitized rows and produces a single JSON file at the right `dist/data/` path. Writers also do light shaping (e.g., grouping versions under bills).

- [ ] **Step 1: Write the failing test**

`tests/test_writers.py`:

```python
import json
from pathlib import Path
from build.writers import write_bills, write_legislators


def test_write_bills_emits_array(tmp_path: Path):
    bills = [
        {"id": "1", "bill_number": "HB0001", "title": "Test",
         "sponsor": "Rep. X", "detailed_description": "desc",
         "ongoing_cost": "$0", "one_time_cost": "$0", "total_cost": "$0",
         "version": "1", "location": "House"},
    ]
    versions = [
        {"id": "1", "bill_id": "1", "version": "1", "active": "t",
         "subjects": "Education", "fiscal_note_url": ""},
    ]
    out = tmp_path / "bills.json"
    write_bills(out, bills, versions)
    payload = json.loads(out.read_text())
    assert payload[0]["bill_number"] == "HB0001"
    assert payload[0]["versions"][0]["version"] == "1"


def test_write_legislators(tmp_path: Path):
    legs = [
        {"id": "100", "legislator_id": "TL01", "district": "1",
         "house": "H", "party": "R", "username": "test_legi",
         "counties": "Salt Lake", "legislator_url": "https://...",
         "photo_url": "https://..."},
    ]
    out = tmp_path / "legislators.json"
    write_legislators(out, legs)
    payload = json.loads(out.read_text())
    assert payload[0]["legislator_id"] == "TL01"
```

- [ ] **Step 2: Verify failure**

Run: `python3 -m pytest tests/test_writers.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement `writers.py`**

```python
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
        out["members"] = mem_by_c.get(c["id"], [])
        out["meetings"] = meet_by_c.get(c["id"], [])
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
```

- [ ] **Step 4: Run tests**

Run: `python3 -m pytest tests/test_writers.py -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add build/writers.py tests/test_writers.py
git commit -m "feat(writers): JSON output per dataset"
```

---

## Task 10: Flask shim

**Files:**
- Create: `legislink-demo/build/flask_shim.py`
- Create: `legislink-demo/tests/test_flask_shim.py`

The shim provides everything the existing templates reference: `url_for`, `current_user`, `request`, `get_flashed_messages`, `config`.

- [ ] **Step 1: Write the failing test**

`tests/test_flask_shim.py`:

```python
from build.flask_shim import make_globals, DemoUser


def test_unauthenticated_user_defaults():
    g = make_globals(endpoint="index", user=None)
    user = g["current_user"]
    assert user.is_authenticated is False
    assert user.is_admin is False


def test_authenticated_lobbyist():
    g = make_globals(endpoint="lobbyist_routes.home", user=DemoUser.lobbyist())
    user = g["current_user"]
    assert user.is_authenticated is True
    assert user.role == "lobbyist"
    assert user.is_lobbyist is True
    assert user.is_legislator is False


def test_authenticated_legislator():
    g = make_globals(endpoint="legislator_routes.home", user=DemoUser.legislator())
    assert g["current_user"].role == "legislator"
    assert g["current_user"].is_legislator is True


def test_request_endpoint_is_set():
    g = make_globals(endpoint="lobbyist_routes.bill", user=None)
    assert g["request"].endpoint == "lobbyist_routes.bill"


def test_get_flashed_messages_returns_empty():
    g = make_globals(endpoint="index", user=None)
    assert g["get_flashed_messages"](with_categories=True) == []


def test_config_session_timeout_is_huge():
    """We disable the timeout-redirect script by making the timeout effectively infinite."""
    g = make_globals(endpoint="lobbyist_routes.home", user=DemoUser.lobbyist())
    seconds = g["config"].PERMANENT_SESSION_LIFETIME.total_seconds()
    assert seconds >= 365 * 24 * 3600  # at least a year
```

- [ ] **Step 2: Verify failure**

Run: `python3 -m pytest tests/test_flask_shim.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement `flask_shim.py`**

```python
"""Jinja globals matching what the Flask app's templates reference."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import timedelta
from build.url_map import url_for


@dataclass(frozen=True)
class DemoUser:
    is_authenticated: bool = False
    role: str = ""
    username: str = ""

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_lobbyist(self) -> bool:
        return self.role == "lobbyist"

    @property
    def is_legislator(self) -> bool:
        return self.role == "legislator"

    @classmethod
    def anonymous(cls) -> "DemoUser":
        return cls()

    @classmethod
    def lobbyist(cls) -> "DemoUser":
        return cls(is_authenticated=True, role="lobbyist", username="Alex Chen")

    @classmethod
    def legislator(cls) -> "DemoUser":
        return cls(is_authenticated=True, role="legislator", username="Rep. Jordan Smith")


@dataclass(frozen=True)
class _Request:
    endpoint: str


@dataclass
class _SessionTimeout:
    # ~10 years, so the in-template auto-logout script is effectively a no-op.
    seconds: int = 10 * 365 * 24 * 3600

    def total_seconds(self) -> float:
        return float(self.seconds)


@dataclass
class _Config:
    PERMANENT_SESSION_LIFETIME: _SessionTimeout = field(default_factory=_SessionTimeout)

    def get(self, key, default=None):
        return getattr(self, key, default)


def make_globals(*, endpoint: str, user: DemoUser | None) -> dict:
    return {
        "url_for": url_for,
        "current_user": user or DemoUser.anonymous(),
        "request": _Request(endpoint=endpoint),
        "get_flashed_messages": lambda **kw: [],
        "config": _Config(),
    }
```

- [ ] **Step 4: Run tests**

Run: `python3 -m pytest tests/test_flask_shim.py -v`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add build/flask_shim.py tests/test_flask_shim.py
git commit -m "feat(shim): Flask globals for static template rendering"
```

---

## Task 11: Render module

**Files:**
- Create: `legislink-demo/build/render.py`

Wraps Jinja with the overlay-shadow file system loader and a single `render_page(template, output_path, endpoint, user, **ctx)` helper.

- [ ] **Step 1: Implement `render.py`**

```python
"""Render Jinja templates from the Flask app, with overlays for demo-specific tweaks."""
from __future__ import annotations
from pathlib import Path
from jinja2 import Environment, ChoiceLoader, FileSystemLoader, select_autoescape

from build.flask_shim import DemoUser, make_globals

# Resolved relative to the legislink-demo repo root.
REPO_ROOT = Path(__file__).resolve().parent.parent
FLASK_TEMPLATES = REPO_ROOT.parent / "Legislink-2026-backup" / "app" / "templates"
OVERLAY_TEMPLATES = REPO_ROOT / "overlays" / "templates"


def make_env() -> Environment:
    return Environment(
        loader=ChoiceLoader([
            FileSystemLoader(str(OVERLAY_TEMPLATES)),  # overlays win
            FileSystemLoader(str(FLASK_TEMPLATES)),
        ]),
        autoescape=select_autoescape(["html"]),
        trim_blocks=False,
        lstrip_blocks=False,
    )


def render_page(
    env: Environment,
    template_name: str,
    output_path: Path,
    *,
    endpoint: str,
    user: DemoUser | None,
    **context,
) -> None:
    """Render `template_name` to `output_path`, injecting shim globals."""
    template = env.get_template(template_name)
    globals_ = make_globals(endpoint=endpoint, user=user)
    rendered = template.render(**globals_, **context)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(rendered, encoding="utf-8")
```

- [ ] **Step 2: Sanity check**

Run a one-liner to confirm the env loads:

```bash
python3 -c "from build.render import make_env; e = make_env(); print(e.loader)"
```

Expected: prints a `ChoiceLoader` repr without error.

- [ ] **Step 3: Commit**

```bash
git add build/render.py
git commit -m "feat(render): Jinja env with overlay-then-app template lookup"
```

---

## Task 12: Demo CSS overlay (banner)

**Files:**
- Create: `legislink-demo/overlays/static/css/demo.css`

- [ ] **Step 1: Write the stylesheet**

```css
/* Demo banner — shown on every page until dismissed. */
.demo-banner {
    position: sticky;
    top: 0;
    z-index: 1000;
    background: #0a3a82;
    color: #fff;
    text-align: center;
    padding: 0.4rem 2.5rem 0.4rem 0.75rem;
    font-size: 0.85rem;
    font-family: "Public Sans", system-ui, sans-serif;
    line-height: 1.4;
}

.demo-banner a {
    color: #fff;
    text-decoration: underline;
}

.demo-banner-close {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: 0;
    color: #fff;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0 0.5rem;
    line-height: 1;
}

.demo-banner[hidden] {
    display: none;
}

/* Auth-page demo helper text */
.auth-form .demo-note {
    background: #f4f7fd;
    border-left: 3px solid #0a3a82;
    padding: 0.5rem 0.75rem;
    margin: 0.5rem 0 1rem;
    font-size: 0.8rem;
    color: #345;
}
```

- [ ] **Step 2: Commit**

```bash
git add overlays/static/css/demo.css
git commit -m "feat(overlay): demo banner CSS"
```

---

## Task 13: Overlay `base.html`

**Files:**
- Create: `legislink-demo/overlays/templates/base.html`

We need to (a) inject the demo banner, (b) link `demo.css`, and (c) load `demo.js` as a module. Everything else is copied verbatim from `Legislink-2026-backup/app/templates/base.html`.

- [ ] **Step 1: Create overlay `base.html`**

Start by copying the original:

```bash
cp ../Legislink-2026-backup/app/templates/base.html overlays/templates/base.html
```

- [ ] **Step 2: Edit the overlay**

Make three changes to `overlays/templates/base.html`:

1. After the existing `<link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">` line, add:

```html
    <link rel="stylesheet" href="{{ url_for('static', filename='css/demo.css') }}">
```

2. Right after the opening `<body>` tag (before the `<nav>`), insert the demo banner:

```html
<div class="demo-banner" id="demo-banner">
    Demo — Utah's 2027 session begins January. Live data returns then.
    <a href="mailto:support@legislink.us">Contact us</a>.
    <button class="demo-banner-close" id="demo-banner-close" aria-label="Dismiss">&times;</button>
</div>
```

3. Right before the closing `</body>` tag (after `{% block scripts %}{% endblock %}`), add:

```html
<script type="module" src="{{ url_for('static', filename='js/demo.js') }}"></script>
```

- [ ] **Step 3: Commit**

```bash
git add overlays/templates/base.html
git commit -m "feat(overlay): base.html with demo banner + module script"
```

---

## Task 14: Overlay auth pages (login, register, etc.)

**Files:**
- Create: `legislink-demo/overlays/templates/auth/login.html`
- Create: `legislink-demo/overlays/templates/auth/register.html`
- Create: `legislink-demo/overlays/templates/auth/choose_account_type.html`
- Create: `legislink-demo/overlays/templates/auth/forgot_password.html`

The originals depend on Flask-WTF form objects. We replace them with plain HTML, marked up to match the existing CSS classes so they look identical.

- [ ] **Step 1: Write `overlays/templates/auth/login.html`**

```html
{% extends "base.html" %}

{% block title %}Sign In - Legislink{% endblock %}

{% block content %}
<div class="auth-page">
    <div class="auth-container">
        <div class="auth-header">
            <h1>Welcome Back</h1>
            <p>Sign in to your Legislink account</p>
        </div>

        <article class="auth-card">
            <form id="demo-login-form" class="auth-form" autocomplete="off">
                <p class="demo-note">
                    Demo mode — any email signs you in. Use any email containing
                    "legislator" to view the legislator portal; anything else
                    drops you into the lobbyist portal. Data resets when you
                    clear browser storage.
                </p>

                <div class="form-group">
                    <label for="demo-email">Email</label>
                    <input type="email" id="demo-email" name="email" required placeholder="Enter your email">
                </div>

                <div class="form-group">
                    <label for="demo-password">Password</label>
                    <input type="password" id="demo-password" name="password" placeholder="Anything works in demo mode">
                </div>

                <button type="submit" class="btn-primary btn-full">Sign In</button>
            </form>

            <div class="auth-footer">
                <p><a href="{{ url_for('auth.forgot_password') }}">Forgot your password?</a></p>
                <p>Don't have an account? <a href="{{ url_for('auth.register') }}">Register here</a></p>
            </div>
        </article>
    </div>
</div>
{% endblock %}
```

- [ ] **Step 2: Write `overlays/templates/auth/register.html`**

```html
{% extends "base.html" %}

{% block title %}Register - Legislink{% endblock %}

{% block content %}
<div class="auth-page">
    <div class="auth-container">
        <div class="auth-header">
            <h1>Create Account</h1>
            <p>Join Legislink today</p>
        </div>

        <article class="auth-card">
            <form id="demo-register-form" class="auth-form" autocomplete="off">
                <p class="demo-note">
                    Demo mode — registration is simulated. Submitting this form
                    signs you in as a demo lobbyist.
                </p>

                <div class="form-group">
                    <label for="demo-reg-name">Full Name</label>
                    <input type="text" id="demo-reg-name" name="name" required>
                </div>

                <div class="form-group">
                    <label for="demo-reg-email">Email</label>
                    <input type="email" id="demo-reg-email" name="email" required>
                </div>

                <div class="form-group">
                    <label for="demo-reg-password">Password</label>
                    <input type="password" id="demo-reg-password" name="password">
                </div>

                <button type="submit" class="btn-primary btn-full">Create Account</button>
            </form>

            <div class="auth-footer">
                <p>Already have an account? <a href="{{ url_for('auth.login') }}">Sign in</a></p>
            </div>
        </article>
    </div>
</div>
{% endblock %}
```

- [ ] **Step 3: Write `overlays/templates/auth/choose_account_type.html`**

```html
{% extends "base.html" %}

{% block title %}Choose Account Type - Legislink{% endblock %}

{% block content %}
<div class="auth-page">
    <div class="auth-container">
        <div class="auth-header">
            <h1>Get Started</h1>
            <p>Choose how you'll use Legislink</p>
        </div>

        <article class="auth-card">
            <p class="demo-note">Demo mode — both options drop you into a pre-seeded account.</p>
            <div class="account-type-options">
                <a href="{{ url_for('auth.register') }}?as=lobbyist" class="btn-primary btn-full" style="margin-bottom: 0.75rem;">
                    I'm a lobbyist or interest group
                </a>
                <a href="{{ url_for('auth.register') }}?as=legislator" class="btn-secondary btn-full">
                    I'm a legislator or staffer
                </a>
            </div>
        </article>
    </div>
</div>
{% endblock %}
```

- [ ] **Step 4: Write `overlays/templates/auth/forgot_password.html`**

```html
{% extends "base.html" %}

{% block title %}Forgot Password - Legislink{% endblock %}

{% block content %}
<div class="auth-page">
    <div class="auth-container">
        <div class="auth-header">
            <h1>Reset Password</h1>
            <p>We'll send you a reset link</p>
        </div>

        <article class="auth-card">
            <form id="demo-forgot-form" class="auth-form" autocomplete="off">
                <p class="demo-note">Demo mode — no real email is sent.</p>
                <div class="form-group">
                    <label for="demo-forgot-email">Email</label>
                    <input type="email" id="demo-forgot-email" name="email" required>
                </div>
                <button type="submit" class="btn-primary btn-full">Send Reset Link</button>
            </form>
            <div class="auth-footer">
                <p><a href="{{ url_for('auth.login') }}">Back to sign in</a></p>
            </div>
        </article>
    </div>
</div>
{% endblock %}
```

- [ ] **Step 5: Commit**

```bash
git add overlays/templates/auth/
git commit -m "feat(overlay): static auth pages (no Flask-WTF dependency)"
```

---

## Task 15: Client JS — `demo-state.js`

**Files:**
- Create: `legislink-demo/overlays/static/js/demo-state.js`

Single source of truth for the `legislink.demo.v1` localStorage object.

- [ ] **Step 1: Write `demo-state.js`**

```javascript
// localStorage layer for the Legislink demo. Single namespaced key, versioned.

const KEY = "legislink.demo.v1";

const EMPTY = {
    session: null,        // { account: "lobbyist" | "legislator", signedInAt }
    trackedBills: [],
    flags: {},            // { [billId]: "red" | "yellow" | "green" | ... }
    opinions: {},         // { [billId]: { stance, action, comments, version } }
    notes: {},            // { [billId]: [{ text, editedAt, version }] }
    dismissedVersions: {},// { [billId]: [versionInt, ...] }
    flagPrefs: [],
    bannerDismissed: false,
};


function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return structuredClone(EMPTY);
        return { ...structuredClone(EMPTY), ...JSON.parse(raw) };
    } catch (e) {
        console.warn("demo-state: load failed, resetting", e);
        return structuredClone(EMPTY);
    }
}

function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
}

export const state = {
    get() { return load(); },

    mutate(fn) {
        const s = load();
        fn(s);
        save(s);
        return s;
    },

    reset() {
        localStorage.removeItem(KEY);
    },

    signIn(account) {
        return state.mutate(s => {
            s.session = { account, signedInAt: new Date().toISOString() };
        });
    },

    signOut() {
        return state.mutate(s => { s.session = null; });
    },

    toggleTracked(billId) {
        return state.mutate(s => {
            const i = s.trackedBills.indexOf(billId);
            if (i >= 0) s.trackedBills.splice(i, 1);
            else s.trackedBills.push(billId);
        });
    },

    setFlag(billId, color) {
        return state.mutate(s => {
            if (color) s.flags[billId] = color;
            else delete s.flags[billId];
        });
    },

    setOpinion(billId, opinion) {
        return state.mutate(s => { s.opinions[billId] = opinion; });
    },

    addNote(billId, note) {
        return state.mutate(s => {
            if (!s.notes[billId]) s.notes[billId] = [];
            s.notes[billId].push(note);
        });
    },

    deleteNote(billId, idx) {
        return state.mutate(s => {
            if (s.notes[billId]) s.notes[billId].splice(idx, 1);
        });
    },

    dismissBanner() {
        return state.mutate(s => { s.bannerDismissed = true; });
    },

    dismissVersion(billId, version) {
        return state.mutate(s => {
            if (!s.dismissedVersions[billId]) s.dismissedVersions[billId] = [];
            if (!s.dismissedVersions[billId].includes(version)) {
                s.dismissedVersions[billId].push(version);
            }
        });
    },
};
```

- [ ] **Step 2: Commit**

```bash
git add overlays/static/js/demo-state.js
git commit -m "feat(js): localStorage state layer"
```

---

## Task 16: Client JS — `demo-auth.js`

**Files:**
- Create: `legislink-demo/overlays/static/js/demo-auth.js`

Intercepts the login/register/forgot forms, stamps a session, redirects.

- [ ] **Step 1: Write `demo-auth.js`**

```javascript
import { state } from "./demo-state.js";

function detectAccountFromEmail(email) {
    const lower = (email || "").toLowerCase();
    if (lower.includes("legislator") || lower.includes("@utah.gov")) {
        return "legislator";
    }
    return "lobbyist";
}

function go(account) {
    state.signIn(account);
    window.location.href = account === "legislator" ? "/legislator/" : "/lobbyist/";
}

export function attachAuth() {
    const login = document.getElementById("demo-login-form");
    if (login) {
        login.addEventListener("submit", e => {
            e.preventDefault();
            const email = login.querySelector("input[type=email]").value;
            go(detectAccountFromEmail(email));
        });
    }

    const register = document.getElementById("demo-register-form");
    if (register) {
        register.addEventListener("submit", e => {
            e.preventDefault();
            const params = new URLSearchParams(window.location.search);
            const role = params.get("as") === "legislator" ? "legislator" : "lobbyist";
            go(role);
        });
    }

    const forgot = document.getElementById("demo-forgot-form");
    if (forgot) {
        forgot.addEventListener("submit", e => {
            e.preventDefault();
            forgot.innerHTML = `
                <p class="demo-note">
                    In the real product, a reset link would be on its way.
                    <a href="/auth/login/">Back to sign in</a>.
                </p>`;
        });
    }

    // Logout link (works on any page that renders the authenticated nav)
    document.querySelectorAll('a[href="/auth/logout/"]').forEach(a => {
        a.addEventListener("click", e => {
            e.preventDefault();
            state.signOut();
            window.location.href = "/";
        });
    });
}
```

- [ ] **Step 2: Commit**

```bash
git add overlays/static/js/demo-auth.js
git commit -m "feat(js): demo auth — sign in/out via localStorage"
```

---

## Task 17: Client JS — `demo-hydrate.js`

**Files:**
- Create: `legislink-demo/overlays/static/js/demo-hydrate.js`

Fetches data JSON, renders bill table rows and bill detail panels. Read-side only — write actions are in Task 19.

- [ ] **Step 1: Write `demo-hydrate.js`**

```javascript
import { state } from "./demo-state.js";

let _cache = null;

export async function loadData() {
    if (_cache) return _cache;
    const [bills, legislators, opinions, demoAccounts] = await Promise.all([
        fetch("/data/bills.json").then(r => r.json()),
        fetch("/data/legislators.json").then(r => r.json()),
        fetch("/data/opinions.json").then(r => r.json()),
        fetch("/data/demo-accounts.json").then(r => r.json()),
    ]);
    _cache = { bills, legislators, opinions, demoAccounts };
    return _cache;
}

function activeVersion(bill) {
    return bill.versions?.find(v => v.active === "t") ?? bill.versions?.[0] ?? null;
}

function renderTableRow(bill, s) {
    const tracked = s.trackedBills.includes(bill.bill_number);
    const flag = s.flags[bill.bill_number] || "";
    const av = activeVersion(bill);
    return `
        <tr data-bill="${bill.bill_number}">
            <td><span class="flag-swatch flag-${flag || "none"}" data-action="cycle-flag"></span></td>
            <td><a href="/lobbyist/bill/#/${bill.bill_number}">${bill.bill_number}</a></td>
            <td>${bill.title || ""}</td>
            <td>${bill.sponsor || ""}</td>
            <td>${av?.subjects || ""}</td>
            <td>${bill.location || ""}</td>
            <td>
                <button data-action="toggle-track" class="btn-tiny ${tracked ? "tracked" : ""}">
                    ${tracked ? "Tracked" : "Track"}
                </button>
            </td>
        </tr>`;
}

export async function hydrateBillTable(rootSelector, opts = {}) {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const { bills } = await loadData();
    const s = state.get();
    const filter = opts.filter || (() => true);
    const seeded = (opts.includeSeedTracked && s.session)
        ? new Set(s.trackedBills.concat(opts.seedTracked || []))
        : new Set(s.trackedBills);
    const rows = bills
        .filter(b => filter(b, s, seeded))
        .map(b => renderTableRow(b, s))
        .join("");
    root.innerHTML = rows;
}

export async function hydrateBillDetail(rootSelector) {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const billId = (window.location.hash || "").replace(/^#\//, "");
    if (!billId) {
        root.innerHTML = "<p>Select a bill from the table.</p>";
        return;
    }
    const { bills, opinions } = await loadData();
    const bill = bills.find(b => b.bill_number === billId);
    if (!bill) {
        root.innerHTML = `<p>Bill ${billId} not found.</p>`;
        return;
    }
    const av = activeVersion(bill);
    const billOpinions = opinions[bill.id] || [];
    const s = state.get();
    const ownOpinion = s.opinions[billId];

    root.innerHTML = `
        <header>
            <h1>${bill.bill_number} — ${bill.title}</h1>
            <p>Sponsor: ${bill.sponsor || "—"} · Floor sponsor: ${bill.floor_sponsor || "—"}</p>
            <p><a href="${bill.link}" target="_blank" rel="noopener">View on le.utah.gov →</a></p>
        </header>
        <section>
            <h3>Active Version ${av?.version ?? bill.version ?? ""}</h3>
            <p>${bill.detailed_description || bill.short_description || ""}</p>
        </section>
        <section>
            <h3>Opinions (${billOpinions.length})</h3>
            <ul>
                ${billOpinions.map(o => `
                    <li><strong>${o.user_org_id || "Anonymous"}</strong>:
                        ${o.opinion} — ${o.action || ""}<br>
                        <small>${o.comments || ""}</small></li>
                `).join("")}
            </ul>
        </section>
        <section>
            <h3>Your Opinion</h3>
            <form id="demo-opinion-form" data-bill="${billId}">
                <label>Stance:
                    <select name="stance">
                        ${["Strongly Oppose", "Oppose in Concept", "Neutral", "Support in Concept", "Strongly Support"]
                            .map(o => `<option ${ownOpinion?.stance === o ? "selected" : ""}>${o}</option>`).join("")}
                    </select>
                </label>
                <label>Preferred Action:
                    <select name="action">
                        ${["Amend", "Hold", "Yay", "Nay"]
                            .map(o => `<option ${ownOpinion?.action === o ? "selected" : ""}>${o}</option>`).join("")}
                    </select>
                </label>
                <label>Comments:
                    <textarea name="comments">${ownOpinion?.comments || ""}</textarea>
                </label>
                <button type="submit" class="btn-primary">Save Opinion</button>
            </form>
        </section>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add overlays/static/js/demo-hydrate.js
git commit -m "feat(js): hydrate bill table + bill detail from JSON"
```

---

## Task 18: Client JS — `demo-router.js`

**Files:**
- Create: `legislink-demo/overlays/static/js/demo-router.js`

Hash routing for `/lobbyist/bill/#/<id>` and `/legislator/bill/#/<id>`. Detail page re-renders on `hashchange`.

- [ ] **Step 1: Write `demo-router.js`**

```javascript
import { hydrateBillDetail } from "./demo-hydrate.js";

export function attachRouter() {
    const path = window.location.pathname;
    if (path === "/lobbyist/bill/" || path === "/legislator/bill/") {
        const onChange = () => hydrateBillDetail("#bill-detail-root");
        window.addEventListener("hashchange", onChange);
        onChange();
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add overlays/static/js/demo-router.js
git commit -m "feat(js): hash router for bill detail"
```

---

## Task 19: Client JS — `demo.js` entry + write actions

**Files:**
- Create: `legislink-demo/overlays/static/js/demo.js`

Top-level module that wires everything together and handles write-action click delegation.

- [ ] **Step 1: Write `demo.js`**

```javascript
import { state } from "./demo-state.js";
import { attachAuth } from "./demo-auth.js";
import { hydrateBillTable, hydrateBillDetail, loadData } from "./demo-hydrate.js";
import { attachRouter } from "./demo-router.js";

// --- Demo banner ---
function attachBanner() {
    const banner = document.getElementById("demo-banner");
    const close = document.getElementById("demo-banner-close");
    if (!banner || !close) return;
    if (state.get().bannerDismissed) {
        banner.hidden = true;
        return;
    }
    close.addEventListener("click", () => {
        state.dismissBanner();
        banner.hidden = true;
    });
}

// --- Sign-in gate for portal pages ---
function requireSignIn(expectedAccount) {
    const s = state.get();
    if (!s.session || (expectedAccount && s.session.account !== expectedAccount)) {
        window.location.href = "/auth/login/";
        return false;
    }
    return true;
}

// --- Write-action click delegation ---
const FLAG_CYCLE = ["", "red", "yellow", "green"];

function attachWriteActions() {
    document.body.addEventListener("click", e => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const row = btn.closest("[data-bill]");
        const billId = row?.dataset.bill;
        if (!billId) return;

        if (btn.dataset.action === "toggle-track") {
            const s = state.toggleTracked(billId);
            const tracked = s.trackedBills.includes(billId);
            btn.classList.toggle("tracked", tracked);
            btn.textContent = tracked ? "Tracked" : "Track";
        }
        if (btn.dataset.action === "cycle-flag") {
            const s = state.get();
            const cur = s.flags[billId] || "";
            const next = FLAG_CYCLE[(FLAG_CYCLE.indexOf(cur) + 1) % FLAG_CYCLE.length];
            state.setFlag(billId, next);
            btn.className = "flag-swatch flag-" + (next || "none");
        }
    });

    document.body.addEventListener("submit", e => {
        if (e.target.id === "demo-opinion-form") {
            e.preventDefault();
            const billId = e.target.dataset.bill;
            const fd = new FormData(e.target);
            state.setOpinion(billId, {
                stance: fd.get("stance"),
                action: fd.get("action"),
                comments: fd.get("comments"),
                savedAt: new Date().toISOString(),
            });
            e.target.querySelector("button[type=submit]").textContent = "Saved";
        }
    });
}

// --- Page dispatch ---
async function main() {
    attachBanner();
    attachAuth();

    const path = window.location.pathname;
    if (path.startsWith("/lobbyist/")) {
        if (!requireSignIn("lobbyist")) return;
    } else if (path.startsWith("/legislator/")) {
        if (!requireSignIn("legislator")) return;
    }

    await loadData();

    if (path === "/lobbyist/table/" || path === "/legislator/table/") {
        await hydrateBillTable("#bill-table-body");
    }
    if (path === "/lobbyist/" || path === "/legislator/") {
        await hydrateBillTable("#bill-table-body", {
            filter: (b, s) => s.trackedBills.includes(b.bill_number),
        });
    }

    attachRouter();
    attachWriteActions();
}

main().catch(err => console.error("demo.js bootstrap failed", err));
```

- [ ] **Step 2: Commit**

```bash
git add overlays/static/js/demo.js
git commit -m "feat(js): entry point, banner, write-action delegation"
```

---

## Task 20: Seed accounts YAML

**Files:**
- Create: `legislink-demo/seed/demo-accounts.yaml`

- [ ] **Step 1: Write the seed file**

```yaml
# Demo lobbyist + legislator profiles. Used by the build script to populate
# data/demo-accounts.json, which is loaded on portal pages to give the
# demo a non-empty initial state.

lobbyist:
  display_name: "Alex Chen"
  organization: "Mountain West Policy Group"
  email_display: "alex@mountainwestpolicy.example"
  tracked_bills:
    - HB0001
    - HB0142
    - SB0003
    - SB0042
  flags:
    HB0142: red
    SB0042: yellow
  opinions:
    HB0142:
      stance: "Support in Concept"
      action: "Amend"
      comments: "Generally supportive — we'd like to see the cap raised in section 3."
      savedAt: "2026-02-12T10:14:00Z"
  notes:
    HB0142:
      - text: "Talked with Rep. Welton's office; open to amendment language."
        editedAt: "2026-02-13T16:02:00Z"
        version: 2
  flag_prefs:
    - { color: red,    label: Critical }
    - { color: yellow, label: Watch }
    - { color: green,  label: Support }

legislator:
  display_name: "Rep. Jordan Smith"
  district: "Demo-1"
  party: "D"
  house: "H"
  counties: "Demo County"
  tracked_bills:
    - HB0142
    - HB0220
  flags: {}
  opinions: {}
  notes: {}
  flag_prefs:
    - { color: red,    label: "Constituent priority" }
    - { color: yellow, label: "Open question" }
```

- [ ] **Step 2: Commit**

```bash
git add seed/demo-accounts.yaml
git commit -m "feat(seed): demo lobbyist + legislator profiles"
```

---

## Task 21: Build entry point — data pipeline only

**Files:**
- Create: `legislink-demo/build/build.py`

First version of `build.py` does: parse dump → sanitize → write JSON (no rendering yet). Renders come in the next task.

- [ ] **Step 1: Write `build.py`** (data pipeline portion)

```python
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


def _real_user_names(tables: dict[str, list[dict]]) -> set[str]:
    """Names we must verify never appear in any sanitized JSON value."""
    names: set[str] = set()
    for u in tables.get("user", []):
        for key in ("first_name", "last_name", "business_name", "username"):
            val = u.get(key)
            if val:
                names.add(val)
        if u.get("first_name") and u.get("last_name"):
            names.add(f"{u['first_name']} {u['last_name']}")
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
    print("Done.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run against the real dump**

Run:
```bash
cd /mnt/c/Users/Snic9/Lobbi/legislink-demo
python3 -m build.build --dump ../legislink-2026.db --out dist
```

Expected output ends with `Done.` and creates:
```
dist/data/bills.json
dist/data/legislators.json
dist/data/committees.json
dist/data/organizations.json
dist/data/opinions.json
dist/data/demo-accounts.json
```

- [ ] **Step 3: Spot-check the JSON**

```bash
python3 -c "
import json
b = json.load(open('dist/data/bills.json'))
print(f'{len(b)} bills, sample:', b[0]['bill_number'], b[0]['title'])
print(f'first bill has {len(b[0][\"versions\"])} versions')
"
```

Expected: `1016 bills` (give or take), a real bill number, ≥1 version.

- [ ] **Step 4: Verify no email leaked**

```bash
grep -c '@' dist/data/*.json
```

Expected: 0 in `bills.json`, `legislators.json`, `committees.json`, `opinions.json`. (Non-zero only acceptable in `demo-accounts.json` where the `email_display: alex@mountainwestpolicy.example` is intentional.)

- [ ] **Step 5: Commit**

```bash
git add build/build.py
git commit -m "feat(build): data pipeline — dump → sanitize → JSON"
```

---

## Task 22: Render landing page

**Files:**
- Modify: `legislink-demo/build/build.py`

Add page rendering. Start with the landing page (`/`) since it's the simplest unauthenticated render.

- [ ] **Step 1: Extend `build.py`**

At the top of `build.py`, add:

```python
from build.flask_shim import DemoUser
from build.render import make_env, render_page
```

In `main()`, after the `print("Done.")` of the data phase but before the function exit, add a new rendering phase:

```python
    print(f"Rendering pages to {args.out}/...")
    env = make_env()

    landing_ctx = {
        "h_count": sum(1 for b in clean.get("bill", []) if (b.get("bill_number") or "").startswith("H")),
        "s_count": sum(1 for b in clean.get("bill", []) if (b.get("bill_number") or "").startswith("S")),
    }
    render_page(env, "index.html", args.out / "index.html",
                endpoint="index", user=None, **landing_ctx)

    print("Done.")
```

- [ ] **Step 2: Rebuild and inspect**

```bash
make build
ls dist/
```

Expected: `dist/index.html` exists, ~10–30 KB.

- [ ] **Step 3: Smoke-test in a browser**

```bash
make serve
```

Open `http://localhost:8080/`. Expected:
- Demo banner across the top with the dismiss `×`.
- Hero "Break Through The Noise" heading.
- Features section, Stats section showing real bill counts, CTA.
- No Jinja errors, no missing-file 404s in the network tab (CSS / fonts may 404 — Task 24 fixes static assets).

- [ ] **Step 4: Commit**

```bash
git add build/build.py
git commit -m "feat(build): render landing page"
```

---

## Task 23: Copy static assets

**Files:**
- Modify: `legislink-demo/build/build.py`

CSS, JS, images, fonts from `Legislink-2026-backup/app/static/` get copied to `dist/static/`. Demo overlay CSS and JS get layered on top.

- [ ] **Step 1: Extend `build.py`**

Add to the top:

```python
import shutil
```

(if not already imported)

Before the rendering phase, add an asset-copy phase:

```python
    print("Copying static assets...")
    static_dst = args.out / "static"
    if static_dst.exists():
        shutil.rmtree(static_dst)
    # Copy from Flask app first ...
    shutil.copytree(
        repo_root.parent / "Legislink-2026-backup" / "app" / "static",
        static_dst,
    )
    # ... then layer overlays on top.
    overlay_static = repo_root / "overlays" / "static"
    if overlay_static.exists():
        for p in overlay_static.rglob("*"):
            if p.is_file():
                rel = p.relative_to(overlay_static)
                dst = static_dst / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(p, dst)
    print(f"  static/ has {sum(1 for _ in static_dst.rglob('*') if _.is_file())} files")
```

- [ ] **Step 2: Rebuild and recheck the landing page**

```bash
make build
make serve
```

Open `http://localhost:8080/`. Expected:
- CSS now loads; page is styled to match the real product.
- Hero capitol photo background visible.
- Logo loads.
- Demo banner visible at top, dismiss works (refresh confirms it stays dismissed).

- [ ] **Step 3: Commit**

```bash
git add build/build.py
git commit -m "feat(build): copy static assets with overlay layered on top"
```

---

## Task 24: Render auth pages

**Files:**
- Modify: `legislink-demo/build/build.py`

- [ ] **Step 1: Add auth page renders to `build.py` `main()`**

After the landing-page render call:

```python
    for tmpl, out_path in [
        ("auth/login.html",                "auth/login/index.html"),
        ("auth/register.html",             "auth/register/index.html"),
        ("auth/choose_account_type.html",  "auth/choose-account-type/index.html"),
        ("auth/forgot_password.html",      "auth/forgot-password/index.html"),
    ]:
        render_page(env, tmpl, args.out / out_path,
                    endpoint="auth.login", user=None)
```

- [ ] **Step 2: Rebuild and smoke-test**

```bash
make build && make serve
```

Visit:
- `http://localhost:8080/auth/login/` — form renders, "Demo note" panel visible.
- Submit with email `test@example.com` → redirects to `/lobbyist/` (will 404 until Task 26).
- Submit with email `someone@legislator.example` → redirects to `/legislator/` (also 404 until Task 26).
- `http://localhost:8080/auth/register/` and `/auth/forgot-password/` render.

- [ ] **Step 3: Commit**

```bash
git add build/build.py
git commit -m "feat(build): render auth pages"
```

---

## Task 25: Render lobbyist portal pages

**Files:**
- Modify: `legislink-demo/build/build.py`
- Modify: `legislink-demo/overlays/templates/` (only if a portal template breaks rendering)

Render the four lobbyist portal pages: `home`, `table`, `search`, `settings`. The `bill` template renders to a shell page hydrated via hash routing (no per-bill HTML).

- [ ] **Step 1: Add lobbyist renders**

In `build.py`, after auth renders:

```python
    lobbyist_user = DemoUser.lobbyist()
    for tmpl, endpoint, out_path in [
        ("lobbyist/home.html",     "lobbyist_routes.home",     "lobbyist/index.html"),
        ("lobbyist/table.html",    "lobbyist_routes.table",    "lobbyist/table/index.html"),
        ("lobbyist/search.html",   "lobbyist_routes.search",   "lobbyist/search/index.html"),
        ("lobbyist/bill.html",     "lobbyist_routes.bill",     "lobbyist/bill/index.html"),
        ("lobbyist/settings.html", "lobbyist_routes.settings", "lobbyist/settings/index.html"),
    ]:
        render_page(env, tmpl, args.out / out_path,
                    endpoint=endpoint, user=lobbyist_user)
```

- [ ] **Step 2: Build**

```bash
make build
```

The original portal templates (`lobbyist/home.html`, `table.html`, `bill.html`, `search.html`) reference rich server-side context (`tracked_bills`, `missing_opinions`, `upcoming_meetings`, etc.) plus inline scripts that call API endpoints we don't have. We replace them in **Task 26** with lean hydration overlays.

Expected behavior for this step:
- `settings.html` likely renders without context (it's simpler).
- The other four templates will probably raise `UndefinedError` or `UnknownEndpoint`. That's expected — do not try to satisfy them with placeholder context here. Proceed to Task 26 which adds overlays that replace `{% block content %}` entirely.

If `UnknownEndpoint` is raised for an endpoint not yet in `url_map.py` (e.g. `lobbyist_routes.something_new`), add it to the map and rerun. If a non-portal template (e.g. `settings.html`) fails on a missing context variable, pass a minimal placeholder via `portal_ctx`:

```python
    portal_ctx = {
        "bills": [],
        "tracked_bills": [],
        "flags": {},
        "opinions": {},
        "categories": [],
        "bill_flag_colors": [],
        "upcoming_meetings": [],
    }
    for tmpl, endpoint, out_path in [...]:
        render_page(env, tmpl, args.out / out_path,
                    endpoint=endpoint, user=lobbyist_user, **portal_ctx)
```

- [ ] **Step 3: Commit (build script changes only — verification happens in Task 26)**

```bash
git add build/build.py
git commit -m "feat(build): render lobbyist portal pages"
```

---

## Task 26: Lobbyist portal hydration overlays

**Files:**
- Create: `legislink-demo/overlays/templates/lobbyist/home.html`
- Create: `legislink-demo/overlays/templates/lobbyist/table.html`
- Create: `legislink-demo/overlays/templates/lobbyist/bill.html`
- Create: `legislink-demo/overlays/templates/lobbyist/search.html`

The originals contain dense server-side logic (`tracked_bills`, `missing_opinions`, `upcoming_meetings`, opinion aggregation, inline `<script>` calls to `/lobbyist/agenda-bills?...`). Trying to patch around them is fragile. The cleaner approach: write small overlays that `extend "base.html"` and replace `{% block content %}` with a hydration mount point. The CSS classes from the originals keep the visual identity intact, and `demo-hydrate.js` produces matching markup at runtime.

- [ ] **Step 1: Write `overlays/templates/lobbyist/home.html`**

```html
{% extends "base.html" %}

{% block title %}Home - Legislink{% endblock %}

{% block sidebar %}
    {% include "includes/lobbyist_sidebar.html" %}
{% endblock %}

{% block content %}
<section class="dashboard-row" style="display: flex; flex-direction: column; gap: 1.5rem;">
    <div class="dashboard-card dashboard-card-full tracked-bills-card"
         style="flex-direction: column; align-items: stretch;">
        <h2 style="margin-top: 0;">Tracked & Flagged Bills</h2>
        <div class="tracked-bills-list" style="overflow-y: auto;">
            <table class="tracked-bills-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="text-align:left;">Flag</th>
                        <th style="text-align:left;">Bill</th>
                        <th style="text-align:left;">Title</th>
                        <th style="text-align:left;">Sponsor</th>
                        <th style="text-align:left;">Subjects</th>
                        <th style="text-align:left;">Location</th>
                        <th style="text-align:left;">Actions</th>
                    </tr>
                </thead>
                <tbody id="bill-table-body">
                    {# Hydrated by demo-hydrate.js — filtered to tracked bills #}
                </tbody>
            </table>
            <p id="bill-table-empty" hidden>No tracked or flagged bills yet. Use the
                <a href="/lobbyist/table/">Bills</a> page to track some.</p>
        </div>
    </div>
</section>
{% endblock %}
```

If `includes/lobbyist_sidebar.html` raises during render (e.g. it references things we don't provide), copy it to `overlays/templates/includes/lobbyist_sidebar.html` and strip the problem markup.

- [ ] **Step 2: Write `overlays/templates/lobbyist/table.html`**

```html
{% extends "base.html" %}

{% block title %}All Bills - Legislink{% endblock %}

{% block sidebar %}
    {% include "includes/lobbyist_sidebar.html" %}
{% endblock %}

{% block content %}
<header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
    <h1 style="margin: 0;">All Bills</h1>
    <input type="search" id="bill-table-search" placeholder="Search by number, title, sponsor..."
           style="max-width: 360px;">
</header>

<table class="bills-table" style="width: 100%; border-collapse: collapse;">
    <thead>
        <tr>
            <th>Flag</th>
            <th>Bill</th>
            <th>Title</th>
            <th>Sponsor</th>
            <th>Subjects</th>
            <th>Location</th>
            <th>Actions</th>
        </tr>
    </thead>
    <tbody id="bill-table-body">
        {# Hydrated by demo-hydrate.js #}
    </tbody>
</table>
{% endblock %}
```

- [ ] **Step 3: Write `overlays/templates/lobbyist/bill.html`**

```html
{% extends "base.html" %}

{% block title %}Bill - Legislink{% endblock %}

{% block sidebar %}
    {% include "includes/lobbyist_sidebar.html" %}
{% endblock %}

{% block content %}
<div id="bill-detail-root">
    <p>Loading…</p>
</div>
{% endblock %}
```

- [ ] **Step 4: Write `overlays/templates/lobbyist/search.html`**

```html
{% extends "base.html" %}

{% block title %}Search - Legislink{% endblock %}

{% block sidebar %}
    {% include "includes/lobbyist_sidebar.html" %}
{% endblock %}

{% block content %}
<header style="margin-bottom: 1rem;"><h1>Search Bills</h1></header>
<input type="search" id="bill-table-search" placeholder="Search by number, title, sponsor..."
       style="width: 100%; max-width: 480px;">
<table class="bills-table" style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
    <thead>
        <tr>
            <th>Bill</th><th>Title</th><th>Sponsor</th><th>Location</th>
        </tr>
    </thead>
    <tbody id="bill-table-body"></tbody>
</table>
{% endblock %}
```

- [ ] **Step 5: Rebuild and verify**

```bash
make build && make serve
```

- Sign in as lobbyist (`alex@example.com`).
- `/lobbyist/` — tracked-bills table populated from seed (`HB0001`, `HB0142`, `SB0003`, `SB0042`).
- `/lobbyist/table/` — full table renders with ~1,016 rows.
- Click a bill number → `/lobbyist/bill/#/HB0142` loads detail.

If `includes/lobbyist_sidebar.html` raises during render, overlay it minimally in `overlays/templates/includes/lobbyist_sidebar.html` (a hand-trimmed copy of the original, stripping any Flask-only pieces).

- [ ] **Step 6: Commit**

```bash
git add overlays/templates/lobbyist/ overlays/templates/includes/
git commit -m "feat(overlay): lobbyist portal pages with hydration mount points"
```

---

## Task 27: Smoke-test lobbyist write actions

This task is verification-only — no new code. Confirm every write action works end-to-end in a real browser.

- [ ] **Step 1: Build and serve**

```bash
make build && make serve
```

- [ ] **Step 2: Run through the checklist in a browser**

Open `http://localhost:8080/`, sign in as a lobbyist (`alex@example.com`):

- [ ] Demo banner shows, dismiss persists across reload.
- [ ] `/lobbyist/` shows tracked bills from seed.
- [ ] `/lobbyist/table/` shows all bills, paginates if necessary.
- [ ] Click "Track" on a row → button becomes "Tracked" → reload → still tracked.
- [ ] Click flag swatch → cycles colors → reload → flag persists.
- [ ] Click a bill number → detail loads.
- [ ] Submit "Your Opinion" form → button text becomes "Saved" → reload page → form pre-fills with saved values.
- [ ] Click any "Logout" link → drops session → redirects to `/`.
- [ ] Visit `/lobbyist/` while logged out → redirects to `/auth/login/`.

For each item that fails, fix the underlying code, rebuild, retest. Do not move on until all items pass.

- [ ] **Step 3: Commit any fixes**

```bash
git commit -am "fix: <whatever was broken in the smoke test>"
```

(If nothing broke, no commit needed.)

---

## Task 28: Render legislator portal pages + overlays

**Files:**
- Modify: `legislink-demo/build/build.py`
- Create: `legislink-demo/overlays/templates/legislator/home.html`
- Create: `legislink-demo/overlays/templates/legislator/table.html`
- Create: `legislink-demo/overlays/templates/legislator/bill.html`
- Create: `legislink-demo/overlays/templates/legislator/search.html`

Mirror of Tasks 25 + 26 for the legislator portal.

- [ ] **Step 1: Add legislator renders to `build.py`**

```python
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
```

- [ ] **Step 2: Write `overlays/templates/legislator/home.html`**

```html
{% extends "base.html" %}

{% block title %}Home - Legislink{% endblock %}

{% block sidebar %}
    {% include "includes/legislator_sidebar.html" %}
{% endblock %}

{% block content %}
<section class="dashboard-row" style="display: flex; flex-direction: column; gap: 1.5rem;">
    <div class="dashboard-card dashboard-card-full tracked-bills-card">
        <h2 style="margin-top: 0;">My Bills</h2>
        <p style="font-size:0.85rem;color:#666;">Bills you sponsor, co-sponsor, or have tracked.</p>
        <table class="tracked-bills-table" style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="text-align:left;">Flag</th>
                    <th style="text-align:left;">Bill</th>
                    <th style="text-align:left;">Title</th>
                    <th style="text-align:left;">Sponsor</th>
                    <th style="text-align:left;">Subjects</th>
                    <th style="text-align:left;">Location</th>
                    <th style="text-align:left;">Actions</th>
                </tr>
            </thead>
            <tbody id="bill-table-body"></tbody>
        </table>
    </div>
</section>
{% endblock %}
```

- [ ] **Step 3: Write `overlays/templates/legislator/table.html`, `bill.html`, `search.html`**

Same shape as the lobbyist overlays from Task 26 — only the path and the `{% include %}` for the sidebar differ. Copy each from Task 26 and:

- Change `lobbyist_sidebar.html` → `legislator_sidebar.html`
- Change page titles as appropriate (`All Bills`, `Bill`, `Search Bills`)

- [ ] **Step 4: Build and smoke-test**

```bash
make build && make serve
```

Sign in with `legislator@example.com`:
- [ ] Banner shows, dismissable.
- [ ] `/legislator/` shows seeded bills (`HB0142`, `HB0220`).
- [ ] `/legislator/table/` shows all bills.
- [ ] Bill detail loads via hash.
- [ ] Submit opinion → saves and persists across reload.
- [ ] Sidebar shows legislator-appropriate navigation.
- [ ] Sign-out works.

If `includes/legislator_sidebar.html` raises, overlay it minimally in `overlays/templates/includes/`.

- [ ] **Step 5: Commit**

```bash
git add build/build.py overlays/templates/legislator/ overlays/templates/includes/
git commit -m "feat(build): render legislator portal + hydration overlays"
```

---

## Task 29: 404 page + CNAME

**Files:**
- Create: `legislink-demo/overlays/templates/404.html`
- Modify: `legislink-demo/build/build.py`

- [ ] **Step 1: Write `overlays/templates/404.html`**

```html
{% extends "base.html" %}
{% block title %}Not Found - Legislink{% endblock %}
{% block content %}
<section style="text-align:center; padding: 3rem 1rem;">
    <img src="{{ url_for('static', filename='404-graphic.svg') }}" alt="" style="max-width:300px;">
    <h1>That page took the wrong exit.</h1>
    <p>The page you're looking for doesn't exist in the demo.</p>
    <p><a href="/">← Back to home</a></p>
</section>
{% endblock %}
```

- [ ] **Step 2: Add to `build.py`**

```python
    render_page(env, "404.html", args.out / "404.html",
                endpoint="index", user=None)
```

Also write the `CNAME` file:

```python
    (args.out / "CNAME").write_text("legislink.us\n")
```

- [ ] **Step 3: Rebuild + verify**

```bash
make build
cat dist/CNAME
test -f dist/404.html && echo OK
```

- [ ] **Step 4: Commit**

```bash
git add overlays/templates/404.html build/build.py
git commit -m "feat(build): 404 page + CNAME"
```

---

## Task 30: Deploy script + README + DNS docs

**Files:**
- Create: `legislink-demo/scripts/deploy.sh`
- Modify: `legislink-demo/README.md`

Manual deploy: build `dist/`, push its contents to a `gh-pages` branch with `force-with-lease`.

- [ ] **Step 1: Write `scripts/deploy.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Force a fresh build.
make clean
make build

# Confirm sensitive files are absent.
for f in dist/data/*.json; do
    if grep -q "@example.com\|SECRET_KEY\|password_hash" "$f"; then
        echo "Aborting deploy: $f contains a denylisted substring."
        exit 1
    fi
done

# Push dist/ to gh-pages via a temporary worktree.
TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT

git fetch origin gh-pages || true
git worktree add --force "$TMP" gh-pages 2>/dev/null || git worktree add --force -b gh-pages "$TMP"

rsync -a --delete --exclude='.git' dist/ "$TMP/"

cd "$TMP"
git add -A
git commit -m "deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)" || echo "(no changes to deploy)"
git push origin gh-pages
cd -
git worktree remove --force "$TMP"

echo "Deployed. https://legislink.us should update within a minute."
```

Make it executable:

```bash
chmod +x scripts/deploy.sh
```

- [ ] **Step 2: Rewrite `README.md`**

```markdown
# legislink-demo

Off-season static demo of legislink.us, served from GitHub Pages.

## Build locally

    make install
    make build         # reads ../legislink-2026.db, writes ./dist/
    make serve         # http://localhost:8080
    make test

## Deploy

Manual, from your local machine (the dump never leaves it):

    make deploy        # runs build, pushes dist/ to gh-pages

Then check https://legislink.us within ~1 minute.

## DNS setup (one time)

In the domain registrar:
- Apex A records: `185.199.108.153`, `185.199.108.154`, `185.199.108.155`, `185.199.108.156`
- `www` CNAME: `<github-user>.github.io`

In the GitHub repo settings:
- Pages source: `gh-pages` branch, `/` (root)
- Custom domain: `legislink.us`
- Enforce HTTPS: enable once Pages provisions the cert (~10 minutes)

## Refreshing data for next year

    cp <next-year-dump>.db ../legislink-2026.db   # or update Makefile DUMP var
    make deploy
```

- [ ] **Step 3: Final pre-deploy verification**

Run:

```bash
make clean
make test
make build
make serve  # last manual check
```

Visit every page listed in Task 27 and Task 28 once more. Confirm:
- Demo banner present and dismissable.
- Auth flow works.
- Both portals fully clickable.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/deploy.sh README.md
git commit -m "feat(deploy): manual gh-pages deploy script + DNS docs"
```

**Stop here.** Do not run `make deploy` from the plan — the DNS setup is a manual step the user must complete first.

---

## Done

When all 30 tasks are checked off, you have:
- A reproducible build that turns `legislink-2026.db` into a sanitized static site in `dist/`.
- A test suite that locks in parser, sanitizer, writer, URL-map, and shim behavior.
- A demo experience that mirrors the real product visually, with persistent client-side state.
- A one-command deploy and clear DNS instructions for the user to point `legislink.us` at GitHub Pages.

Hand back to the user to (a) buy a coffee, (b) point DNS, (c) run `make deploy`.
