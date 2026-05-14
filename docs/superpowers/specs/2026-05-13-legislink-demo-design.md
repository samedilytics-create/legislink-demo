# Legislink Off-Season Demo — Design

**Date:** 2026-05-13
**Status:** Approved, ready for implementation planning
**Author:** Snic9 (with Claude)

## Background

Legislink (`legislink.us`) is a Utah bill-tracking platform with lobbyist, legislator, and admin portals. Source lives in `Legislink-2026-backup/` (Flask + Jinja + PicoCSS + custom CSS). The live Flask app is shut down between sessions to avoid year-round hosting costs. The 2026 session data exists as a Postgres dump at `legislink-2026.db` (~1,016 bills, 107 legislators, 83 committees, 17 orgs, 1,547 opinions).

We need a fully static replacement site that:
- Lives at `legislink.us` itself (the live app is already down).
- Demos the product to prospective customers — must feel real, fully interactive.
- Costs nothing to host (GitHub Pages).
- Can be rebuilt next session by re-running one script against next year's dump.

## Goals

1. Prospective customer lands on `legislink.us`, sees a polished landing page indistinguishable from the real product.
2. They can "sign in" as a demo lobbyist or legislator and click through a dashboard pre-populated with realistic state from the 2026 session.
3. Write actions (track, flag, opinion, note) feel real and persist across reloads via `localStorage`.
4. No real PII (user emails, names, password hashes, tokens, real opinion text) reaches the public site.
5. Single-command local build; single-button deploy to GitHub Pages.

## Non-goals

- Real authentication / accounts.
- Server-side state, multi-user collaboration, real notifications.
- Admin panel (out of scope).
- Bill detail pages for legislation outside the 2026 session.
- Mobile-app parity (whatever the existing CSS does on mobile is what we ship).

## Audience

Prospective customers visiting `legislink.us` off-season. Secondary: existing users staying engaged. The product is for lobbyists and legislators in Utah.

## Architecture

```
legislink-2026.db (Postgres dump, local only)
        │
        ▼
   build/build.py            local Python; never runs in CI
        │
        ├── parses COPY blocks → row dicts
        ├── sanitize.py strips PII, fabricates demo state
        ├── seeds demo lobbyist + legislator from seed/demo-accounts.yaml
        └── renders Jinja templates from Legislink-2026-backup/app/templates
             (using flask_shim.py for url_for / current_user)
        │
        ▼
   dist/                     pushed manually to gh-pages branch
   ├── index.html
   ├── auth/{login,register,choose-account-type,forgot-password}/index.html
   ├── lobbyist/{home,table,search,bill,settings}/index.html
   ├── legislator/{home,table,search,bill,settings}/index.html
   ├── data/{bills,legislators,committees,organizations,demo-accounts}.json
   ├── static/...            CSS, JS, images copied from app/static
   ├── static/js/demo.js     client routing + write-action layer
   ├── CNAME                 → legislink.us
   └── 404.html
```

**Why a sibling folder, not inside `Legislink-2026-backup/`:** keeps the Flask repo's git history clean for when the real app comes back next session.

## Project Layout

```
/mnt/c/Users/Snic9/Lobbi/
├── Legislink-2026-backup/   unchanged — source of templates + CSS
├── legislink-2026.db        unchanged — source data (gitignored everywhere)
└── legislink-demo/          NEW
    ├── build/
    │   ├── build.py         entry point
    │   ├── dump_parser.py   parses COPY blocks
    │   ├── sanitize.py      PII strip + secret-scan
    │   ├── flask_shim.py    url_for / current_user stubs for Jinja
    │   └── render.py        Jinja env + page rendering
    ├── overlays/
    │   ├── templates/       per-template overrides (e.g. demo banner)
    │   ├── static/js/demo.js
    │   └── static/css/demo.css
    ├── seed/
    │   └── demo-accounts.yaml
    ├── dist/                build output, gitignored on main
    ├── docs/superpowers/specs/
    │   └── 2026-05-13-legislink-demo-design.md
    ├── requirements.txt     jinja2, pyyaml
    ├── Makefile
    ├── .gitignore
    └── README.md
```

## Data Pipeline

### Source

`legislink-2026.db` is a `pg_dump` plain-text file. Each table appears as:

```
COPY public.<table> (col1, col2, ...) FROM stdin;
<TSV rows...>
\.
```

A small Python parser yields `dict` rows by column name. No DB server, no `psycopg`. The parser handles Postgres TSV escapes (`\N` → None, `\t`, `\n`, `\\`).

### Tables used

| Table | Used for | Notes |
|---|---|---|
| `bill` | bill rows in tables, detail pages | all columns kept |
| `bill_version` | version history on bill detail | all columns kept |
| `legislator` | legislator list + detail | join with `user` to get display name; only the display name is exported |
| `committee` | committee links on bill page | all columns kept |
| `committee_meeting` | upcoming meetings widget | treated as historical archive in demo |
| `committee_membership` | "who's on this committee" | all columns kept |
| `organization` | org list | all columns kept |
| `opinions` | aggregate view on bill page | `user_id` / `user_org_id` remapped to fake orgs; `comments` replaced with curated text |
| `notes` | per-bill notes panel | only fabricated demo notes appear |
| `user` | display name lookup only | never written to JSON |

### Tables dropped entirely

`password_reset_token`, `intern`, `intern_action_log`, `active_version_email_sent`, `bill_notification`, `bill_flag`, `bill_tracking`, `user_flag_preference`, `legislator_organization_tracking`, `opinion_version_dismissal`, `alembic_version`.

### Demo accounts (seeded, not from dump)

`seed/demo-accounts.yaml` contains:

```yaml
lobbyist:
  display_name: "Alex Chen"
  organization: "Mountain West Policy Group"
  email_display: "alex@mountainwestpolicy.example"
  tracked_bills: [HB0142, SB0003, ...]
  flags: { HB0142: red, ... }
  opinions: [...]
  notes: [...]
  flag_prefs:
    - { color: red, label: Critical }
    - { color: yellow, label: Watch }
    - { color: green, label: Support }

legislator:
  display_name: "Rep. Jordan Smith"
  district: Demo-1
  party: D
  house: H
  ...
```

These are baked into `data/demo-accounts.json` at build time. "Signing in" loads this account's pre-seeded state on first visit; subsequent user actions merge into localStorage.

### Output

`dist/data/*.json`, served gzipped by GitHub Pages. Estimated total payload 600 KB–1 MB uncompressed.

## Pages and Routing

### Static HTML files (rendered once at build)

```
/                              landing
/auth/login/                   demo sign-in form
/auth/register/                demo register form
/auth/choose-account-type/
/auth/forgot-password/         no-op submit + toast
/lobbyist/                     dashboard shell, hydrated from JSON
/lobbyist/table/               bill table shell
/lobbyist/search/
/lobbyist/bill/                detail template — bill ID from URL hash
/lobbyist/settings/
/legislator/                   dashboard shell
/legislator/table/
/legislator/search/
/legislator/bill/              detail template
/legislator/settings/
/404.html
```

Pages live under `path/index.html` so URLs are clean without a server-side rewriter.

### Hash routes (handled in `demo.js`)

```
/lobbyist/bill/#/HB0142          loads bill HB0142 into bill.html template
/legislator/bill/#/HB0142
/lobbyist/table/#?filter=tracked
```

Detail pages use the hash because GitHub Pages cannot rewrite `/lobbyist/bill/HB0142` to `/lobbyist/bill.html`, and we don't want to emit 1,000+ HTML files.

### Template reuse

Templates come from `Legislink-2026-backup/app/templates/` unmodified by default. Three mechanisms make this work without rewriting:

1. **`flask_shim.py`** provides `url_for(endpoint, **kw)`, `current_user`, `request`, and `get_flashed_messages` as Jinja globals so existing template expressions resolve. `url_for` maps Flask endpoint names to static paths via a hardcoded table; unknown endpoints log a build-time warning.
2. **Overlay layer:** templates in `overlays/templates/<same-path>` shadow the originals. Used only when a page needs demo-specific markup (the demo banner, the off-season footer note).
3. **Login state at render time:** the shim's `current_user` is set per page render. `index.html` is rendered with `current_user.is_authenticated = False` so visitors land on the public marketing view. Portal pages (`/lobbyist/`, `/legislator/`, etc.) are rendered with `is_authenticated = True` and a stub user matching the page's role, so existing Jinja conditionals resolve correctly.

## Demo Auth and Write Layer

### Sign-in flow

```
visitor → /auth/login/ → submits form
                       │
                       ▼
              demo.js intercepts submit:
                - email containing "legislator" → demoAccount = "legislator"
                - otherwise                     → demoAccount = "lobbyist"
                - writes session to localStorage
                       │
                       ▼
              redirect to /lobbyist/ or /legislator/
```

Password field is ignored. Register and forgot-password forms behave the same way (drop a session, redirect). Each auth form shows a small note: *"Demo mode — any email signs you in. Data resets when you clear browser storage."*

### Storage shape

Single namespaced key, version-stamped:

```js
localStorage.setItem('legislink.demo.v1', JSON.stringify({
  session: { account: 'lobbyist' | 'legislator', signedInAt: '...' },
  trackedBills: ['HB0142', ...],
  flags: { 'HB0142': 'red', ... },
  opinions: { 'HB0142': { stance, action, comments, version } },
  notes: { 'HB0142': [{ text, editedAt, version }] },
  dismissedVersions: { 'HB0142': [1] },
  flagPrefs: [{ color: 'red', label: 'Critical' }, ...],
  bannerDismissed: false
}))
```

Bumping `v1` → `v2` on shape changes forces a one-time clear on next visit.

### Hydration

On each portal page, `demo.js`:
1. Reads `legislink.demo.v1` from localStorage (if present).
2. Fetches `data/demo-accounts.json`.
3. Merges localStorage state on top of the seeded account state.
4. Renders the dashboard/table/bill view from this merged state plus `bills.json` etc.

This way the demo lobbyist starts with a realistic pre-populated dashboard, and any new action by the visitor sticks.

### Write actions

| Action | Demo behavior |
|---|---|
| Track / untrack bill | toggle in `trackedBills`; re-render row + toast |
| Set / clear flag | update `flags[billId]`; re-render swatch |
| Submit opinion | write to `opinions[billId]`; re-render bill page panel |
| Add / edit / delete note | mutate `notes[billId]`; re-render notes list |
| Dismiss version banner | append to `dismissedVersions[billId]` |
| Settings (flag labels) | update `flagPrefs`; re-render |
| Sign out | clear `session`; redirect to `/` |

### Demo-mode banner

Thin bar at the top of every page: *"Demo — Utah's 2027 session begins January. Live data returns then."* Dismissable; dismissal stored in localStorage.

## Sanitization

A single `sanitize.py` pass runs before any JSON is written. Build fails loudly on any violation.

### Hard drops (column never reaches JSON)

- `user.email`, `user.phone`, `user.password_hash`, `user.temporary_password`, `user.business_name`, `user.first_name`, `user.last_name`
- All columns of: `password_reset_token`, `intern`, `intern_action_log`, `bill_flag`, `bill_tracking`, `user_flag_preference`, `legislator_organization_tracking`, `opinion_version_dismissal`, `bill_notification`, `active_version_email_sent`
- `notes.note` (notes JSON carries only fabricated demo notes)
- `opinions.comments` (replaced with curated demo commentary)

### Replace, don't drop

- `opinions.user_id` / `user_org_id` → mapped deterministically to a small pool of fake orgs (Mountain West Policy Group, Beehive Civic Forum, Utah Education Alliance, Wasatch Business Council). This preserves opinion clustering by org while anonymizing.
- `notes.user_id` → attributed to the demo lobbyist.

### Kept as-is (public record)

- `bill.*` (sponsor name, floor sponsor included)
- `legislator.*` (names, districts, parties, photo URLs)
- `committee.*`, `committee_meeting.*`, `committee_membership.*`
- `organization.*`
- `bill_version.*`

### Build-time guardrails

After sanitize and before write, scan every JSON value for:

1. `@` followed by a TLD-shaped suffix → fail (no email addresses).
2. Substring matches against a hardcoded denylist: `password`, `token`, `SECRET_KEY`, `re_HFAZBHEM`, the `.env` DB password — fail.
3. Any first or last name from the `user` table (built dynamically) appearing in any JSON value — fail.

Failure prints the offending table, row id, and field, then exits non-zero.

### Repo hygiene

`.gitignore` includes:

```
*.db
legislink-2026.db
dist/data/*.json
dist/
.env
.envrc
*secret*
*credentials*
__pycache__/
```

A pre-commit shell hook greps staged files for the secret denylist above and blocks the commit on any match.

## Build and Deploy

### Local build

```
make build   → python build/build.py --dump ../legislink-2026.db --out dist/
make serve   → python -m http.server -d dist/ 8080
make clean   → rm -rf dist/
```

### Deploy

**Chosen approach: local build, manual push to `gh-pages` branch.**

```
make deploy  → builds dist/, force-pushes its contents to gh-pages
```

The unsanitized dump never leaves the local machine. Off-season deploys happen a handful of times max — manual is fine. No CI/Actions workflow ships with v1; we can add one later if the manual cadence becomes annoying.

### DNS

- `dist/CNAME` contains `legislink.us`.
- Apex A records → GitHub Pages IPs (`185.199.108.153`, `.154`, `.155`, `.156`).
- `www` CNAME → `<github-user>.github.io`.
- GitHub Pages → "Enforce HTTPS" enabled after cert provisions.

The real Flask app is currently offline, so no traffic cutover risk.

## Open Questions

1. Photo URLs on `legislator` rows currently point at `le.utah.gov`. Hotlinking is fine for a demo but creates an external dependency. **Decision:** hotlink for now; revisit if le.utah.gov breaks them or it becomes a hot path.
2. `bill.detailed_description` contains custom HTML markup (`<hr>`, `<ltbullet>`). We must reproduce whatever rendering the existing template does. **Decision:** preserve markup verbatim; rendering already lives in the existing bill template.
3. Should the demo include a "Contact us" or "Request a real account" CTA, given the audience is prospective customers? **Decision:** yes — add a small `mailto:support@legislink.us` button in the landing page hero CTA. (No backend form; the existing email account already exists.)

## Implementation Order (preview — handed off to writing-plans)

1. Project skeleton: directory layout, `requirements.txt`, `Makefile`, `.gitignore`.
2. Dump parser + golden tests against the actual file.
3. Sanitization + secret-scan guard.
4. JSON output (one writer per table).
5. Flask shim + URL map.
6. Render landing page; serve locally and visually compare to the real template.
7. Render auth pages.
8. Render lobbyist portal shells; wire `demo.js` table hydration.
9. Render bill detail template; wire hash routing.
10. Wire each write action (track, flag, opinion, note) end-to-end with localStorage.
11. Render legislator portal shells + bill detail.
12. Demo banner, footer note, sign-out.
13. Deploy script + `gh-pages` setup + DNS instructions in `README.md`.
14. Final end-to-end pass: visit every page, exercise every write action.
