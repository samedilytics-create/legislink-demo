import { state } from "./demo-state.js";

let _cache = null;

export async function loadData() {
    if (_cache) return _cache;
    const [bills, legislators, opinions, organizations, committees, demoAccounts] = await Promise.all([
        fetch("/data/bills.json").then(r => r.json()),
        fetch("/data/legislators.json").then(r => r.json()),
        fetch("/data/opinions.json").then(r => r.json()),
        fetch("/data/organizations.json").then(r => r.json()).catch(() => []),
        fetch("/data/committees.json").then(r => r.json()).catch(() => []),
        fetch("/data/demo-accounts.json").then(r => r.json()),
    ]);
    _cache = {
        bills,
        legislators,
        opinions,
        organizations,
        committees,
        demoAccounts,
        opinionSummaries: buildOpinionSummaries(bills, opinions, organizations),
    };
    return _cache;
}

// --- Opinion bar aggregation ---
const OPINION_LABELS = {
    strongly_oppose:    "Strongly Oppose",
    oppose_in_concept:  "Oppose in Concept",
    neutral:            "Neutral",
    support_in_concept: "Endorse in Concept",
    strongly_support:   "Strongly Endorse",
};
const OPINION_ORDER = [
    "Strongly Oppose",
    "Oppose in Concept",
    "Neutral",
    "Endorse in Concept",
    "Strongly Endorse",
];
const OPINION_CSS_CLASS = {
    "Strongly Oppose":    "strongly-oppose",
    "Oppose in Concept":  "oppose-in-concept",
    "Neutral":            "neutral",
    "Endorse in Concept": "endorse-in-concept",
    "Strongly Endorse":   "strongly-endorse",
};

function buildOpinionSummaries(bills, opinionsByBillId, organizations) {
    const orgNameById = new Map();
    (organizations || []).forEach(o => {
        if (o && o.id) orgNameById.set(String(o.id), o.name || `Org ${o.id}`);
    });
    const billNumberByDbId = new Map();
    (bills || []).forEach(b => {
        if (b && b.id != null) billNumberByDbId.set(String(b.id), b.bill_number);
    });

    const summaries = {};
    for (const [billDbId, opinionRows] of Object.entries(opinionsByBillId || {})) {
        if (!Array.isArray(opinionRows) || opinionRows.length === 0) continue;
        // Latest opinion per organization wins.
        const latestByOrg = new Map();
        for (const row of opinionRows) {
            const orgId = row.user_org_id != null ? String(row.user_org_id) : null;
            if (!orgId) continue;
            const key = orgId;
            const existing = latestByOrg.get(key);
            if (!existing || (row.updated_at || "") > (existing.updated_at || "")) {
                latestByOrg.set(key, row);
            }
        }
        const counts = Object.fromEntries(OPINION_ORDER.map(k => [k, []]));
        for (const row of latestByOrg.values()) {
            const label = OPINION_LABELS[row.opinion];
            if (!label) continue;
            const orgName = orgNameById.get(String(row.user_org_id)) || `Org ${row.user_org_id}`;
            counts[label].push(orgName);
        }
        const total = OPINION_ORDER.reduce((sum, label) => sum + counts[label].length, 0);
        if (total === 0) continue;
        const segments = OPINION_ORDER
            .filter(label => counts[label].length > 0)
            .map(label => ({
                label,
                cssClass: OPINION_CSS_CLASS[label],
                count: counts[label].length,
                percentage: Math.round((counts[label].length / total) * 1000) / 10,
                organizations: counts[label],
            }));
        const billNumber = billNumberByDbId.get(String(billDbId));
        if (!billNumber) continue;
        summaries[billNumber] = {
            total,
            segments,
            barWidthPct: Math.min(100, 20 + Math.min(80, total * 8)),
        };
    }
    return summaries;
}

export function renderOpinionBar(billId, summaries) {
    const summary = summaries && summaries[billId];
    if (!summary) {
        return `<span class="opinion-bar-empty">—</span>`;
    }
    const segs = summary.segments.map(s => {
        const orgsAttr = escapeAttr(JSON.stringify(s.organizations));
        return `<div class="opinion-segment ${s.cssClass}"
                     style="width:${s.percentage}%;"
                     data-opinion="${escapeAttr(s.label)}"
                     data-orgs="${orgsAttr}"
                     data-count="${s.count}"></div>`;
    }).join("");
    return `<div class="opinion-bar-wrapper">`
        + `<div class="opinion-bar" style="width:${summary.barWidthPct}%;">${segs}</div>`
        + `<div class="opinion-tooltip"></div>`
        + `</div>`;
}

function activeVersion(bill) {
    return bill.versions?.find(v => v.active === "t") ?? bill.versions?.[0] ?? null;
}

const FLAG_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">`
    + `<rect x="3" y="2" width="2" height="20" fill="currentColor"/>`
    + `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/>`
    + `</svg>`;

const FLAG_COLOR_NAMES = {
    1: "Red", 2: "Yellow", 3: "Green", 4: "Blue", 5: "Purple", 6: "Black",
};

export function renderFlagCell(billId, flagColors) {
    if (!flagColors || flagColors.length === 0) {
        return `<button type="button" class="flag-picker-btn" data-action="open-flag-picker"
                        data-bill="${billId}" aria-label="Manage flags">${FLAG_SVG}</button>`;
    }
    const dots = flagColors.map(c => {
        const label = FLAG_COLOR_NAMES[c] || "Flag";
        return `<span class="flag-dot flag-color-${c}" data-action="open-flag-picker"
                       data-bill="${billId}" title="${label}">
                    <span class="flag-icon">${FLAG_SVG}</span>
                </span>`;
    }).join("");
    return `<div class="flag-indicators" data-bill="${billId}">${dots}</div>`;
}

const NOTE_FILLED_SVG = `<svg class="note-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
const NOTE_EMPTY_SVG = `<svg class="note-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;

function escapeAttr(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Utah bill descriptions use a non-standard `<ltbullet>` marker plus `<hr>`
// separators. Convert them into a real <ul>/<li> list so the page reads as a
// bulleted summary instead of dumping the raw tags. Anything before the first
// bullet becomes a lead-in paragraph; everything is HTML-escaped first so the
// only HTML this function emits is what it constructs itself.
export function formatBillDescription(raw) {
    const text = String(raw || "").trim();
    if (!text) return `<p class="bill-detail-description-empty">No description available.</p>`;
    // Strip the separator tags and split on the bullet marker (case-insensitive).
    const cleaned = text.replace(/<hr\s*\/?>/gi, "");
    const parts = cleaned.split(/<ltbullet\s*\/?>/i);
    if (parts.length <= 1) {
        // No bullets — preserve newlines and escape everything.
        return `<p>${escapeAttr(cleaned).replace(/\n+/g, "</p><p>")}</p>`;
    }
    const lead = parts.shift().trim();
    const items = parts.map(p => p.trim()).filter(Boolean);
    const leadHtml = lead ? `<p>${escapeAttr(lead)}</p>` : "";
    const listHtml = items.length
        ? `<ul class="bill-description-list">${items.map(i => `<li>${escapeAttr(i)}</li>`).join("")}</ul>`
        : "";
    return leadHtml + listHtml;
}

export function renderNoteCell(billId, note) {
    const has = !!(note && (note.text || note.opinion));
    const svg = has ? NOTE_FILLED_SVG : NOTE_EMPTY_SVG;
    const opinionSlug = has && note.opinion
        ? note.opinion.toLowerCase().replace(/\s+/g, "-")
        : "";
    const cls = ["note-btn"];
    if (has) {
        cls.push("note-btn-has-note");
        if (opinionSlug) cls.push(`note-icon-${opinionSlug}`);
    }
    const tooltip = has
        ? (note.opinion ? `${note.opinion}: ` : "") + (note.text || "")
        : "Add note";
    return `<button type="button" class="${cls.join(" ")}" data-action="open-note"
                    data-bill="${escapeAttr(billId)}" aria-label="${has ? "Edit note" : "Add note"}"
                    title="${escapeAttr(tooltip.slice(0, 140))}">${svg}</button>`;
}

function renderTableRow(bill, s, opts) {
    const tracked = s.trackedBills.includes(bill.bill_number);
    const flagColors = Array.isArray(s.flags[bill.bill_number]) ? s.flags[bill.bill_number] : [];
    const av = activeVersion(bill);
    const note = s.notes[bill.bill_number] || null;
    const billHref = `/${opts.account}/bill/#/${bill.bill_number}`;
    const opinionCell = opts.account === "legislator"
        ? `<td class="opinion-cell">${renderOpinionBar(bill.bill_number, opts.opinionSummaries)}</td>`
        : "";
    const searchKey = [
        bill.bill_number,
        bill.title,
        bill.sponsor,
        av?.subjects,
        bill.location,
    ].filter(Boolean).join(" ").toLowerCase();
    const subjects = av?.subjects || "";
    return `
        <tr data-bill="${bill.bill_number}" data-search="${escapeAttr(searchKey)}">
            <td class="flag-cell">${renderFlagCell(bill.bill_number, flagColors)}</td>
            <td><a href="${billHref}">${bill.bill_number}</a></td>
            <td>${bill.title || ""}</td>
            <td>${bill.sponsor || ""}</td>
            <td class="subjects-cell" title="${escapeAttr(subjects)}">${escapeAttr(subjects)}</td>
            <td>${bill.location || ""}</td>
            <td class="note-cell">${renderNoteCell(bill.bill_number, note)}</td>
            ${opinionCell}
            <td class="track-cell">
                <label class="track-checkbox-label" title="${tracked ? "Untrack" : "Track"} this bill">
                    <input type="checkbox" data-action="toggle-track" ${tracked ? "checked" : ""}>
                </label>
            </td>
        </tr>`;
}

export async function hydrateBillTable(rootSelector, opts = {}) {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const { bills, opinionSummaries } = await loadData();
    const s = state.get();
    const filter = opts.filter || (() => true);
    const seeded = (opts.includeSeedTracked && s.session)
        ? new Set(s.trackedBills.concat(opts.seedTracked || []))
        : new Set(s.trackedBills);
    const account = opts.account || (s.session?.account === "legislator" ? "legislator" : "lobbyist");
    const renderOpts = { account, opinionSummaries };
    const rows = bills
        .filter(b => filter(b, s, seeded))
        .map(b => renderTableRow(b, s, renderOpts))
        .join("");
    root.innerHTML = rows;
    attachOpinionTooltips(root);
}

function attachOpinionTooltips(root) {
    root.querySelectorAll(".opinion-bar-wrapper").forEach(wrapper => {
        const bar = wrapper.querySelector(".opinion-bar");
        const tooltip = wrapper.querySelector(".opinion-tooltip");
        if (!bar || !tooltip) return;
        bar.querySelectorAll(".opinion-segment").forEach(segment => {
            segment.addEventListener("mouseenter", e => {
                const label = segment.dataset.opinion;
                const count = segment.dataset.count;
                let orgs = [];
                try { orgs = JSON.parse(segment.dataset.orgs || "[]"); } catch (_) {}
                const shown = orgs.slice(0, 8);
                const remaining = orgs.length - shown.length;
                tooltip.innerHTML = `<div class="tooltip-title">${label}</div>`
                    + `<div class="tooltip-count">${count} organization${count == 1 ? "" : "s"}</div>`
                    + (shown.length
                        ? `<div class="tooltip-orgs">${shown.map(o => `• ${escapeAttr(o)}`).join("<br>")}</div>`
                        : "")
                    + (remaining > 0 ? `<div class="tooltip-more">… and ${remaining} more</div>` : "");
                positionTooltip(tooltip, e);
                tooltip.classList.add("show");
            });
            segment.addEventListener("mousemove", e => positionTooltip(tooltip, e));
            segment.addEventListener("mouseleave", () => tooltip.classList.remove("show"));
        });
    });
}

function positionTooltip(tooltip, e) {
    const offset = 12;
    const rect = tooltip.getBoundingClientRect();
    let left = e.clientX + offset;
    let top = e.clientY + offset;
    if (left + rect.width > window.innerWidth - 10) left = e.clientX - rect.width - offset;
    if (left < 10) left = 10;
    if (top + rect.height > window.innerHeight - 10) top = e.clientY - rect.height - offset;
    if (top < 10) top = 10;
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
}

// --- Agenda + Upcoming meetings cards ---

function parseBillIdsField(raw) {
    if (!raw || raw === "null") return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function normalizeBillNumber(bn) {
    // Meetings reference bills like "SB48" / "HJR002"; bills.json uses
    // four-digit padding ("SB0048"). Normalize so we can cross-reference.
    if (!bn) return "";
    const m = /^([A-Za-z]+)0*(\d+)([A-Za-z]*)$/.exec(bn);
    if (!m) return bn;
    return `${m[1]}${m[2].padStart(4, "0")}${m[3]}`;
}

function meetingTimestamp(m) {
    if (!m || !m.meeting_time) return 0;
    // Stored as "YYYY-MM-DD HH:MM:SS" without TZ; just parse as local.
    const t = Date.parse(m.meeting_time.replace(" ", "T"));
    return Number.isFinite(t) ? t : 0;
}

function formatMeetingTime(s) {
    if (!s) return "";
    const t = Date.parse(s.replace(" ", "T"));
    if (!Number.isFinite(t)) return s;
    const d = new Date(t);
    return d.toLocaleString(undefined, {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
    });
}

function meetingsWithBills(committees) {
    const out = [];
    for (const c of committees || []) {
        for (const m of c.meetings || []) {
            out.push({
                ...m,
                committeeName: c.description || c.committee_id || "",
            });
        }
    }
    return out;
}

export async function hydrateUpcomingMeetings(rootSelector, opts = {}) {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const limit = opts.limit || 6;
    const { committees, bills } = await loadData();
    const billNumbers = new Set((bills || []).map(b => b.bill_number));
    const all = meetingsWithBills(committees);
    if (!all.length) {
        root.innerHTML = `<p style="color:#666;font-size:14px;margin:0;">No meeting data available.</p>`;
        return;
    }
    // Prefer future meetings; if all are in the past (likely for sanitized
    // historical data), fall back to the most recent ones so the card isn't
    // empty in the demo.
    const now = Date.now();
    const sortedByTime = [...all].sort((a, b) => meetingTimestamp(a) - meetingTimestamp(b));
    let upcoming = sortedByTime.filter(m => meetingTimestamp(m) >= now).slice(0, limit);
    if (!upcoming.length) {
        upcoming = sortedByTime.slice(-limit).reverse();
    }
    const escape = (s) => escapeAttr(s);
    root.innerHTML = upcoming.map(m => {
        const bills = parseBillIdsField(m.bill_ids).map(normalizeBillNumber);
        const billLinks = bills.map(bn => billNumbers.has(bn)
            ? `<a href="/lobbyist/bill/#/${escape(bn)}">${escape(bn)}</a>`
            : `<span>${escape(bn)}</span>`
        ).join(", ");
        const agenda = m.agenda_url
            ? ` · <a href="https://le.utah.gov${escape(m.agenda_url)}" target="_blank" rel="noopener">Agenda</a>`
            : "";
        return `<div class="upcoming-item" style="padding:0.55rem 0;border-top:1px solid #ececec;">
            <div style="font-size:13px;color:#272727;">
                <strong>${escape(formatMeetingTime(m.meeting_time))}</strong>
                <span style="color:#555;"> – ${escape(m.meeting_place || "—")}</span>
                ${billLinks ? `<span> · ${billLinks}</span>` : ""}
                ${agenda}
            </div>
            <div style="font-size:12px;color:#666;margin-top:2px;">${escape(m.committeeName)}</div>
        </div>`;
    }).join("");
    // Strip the first border-top so the list doesn't have a stray rule on top.
    const first = root.querySelector(".upcoming-item");
    if (first) first.style.borderTop = "0";
}

export async function hydrateAgendaCard(opts = {}) {
    const select = document.getElementById("agenda-select");
    const list = document.querySelector(".agenda-bills-list");
    if (!select || !list) return;
    const account = opts.account || "lobbyist";
    const { committees, bills } = await loadData();
    const billNumbers = new Set((bills || []).map(b => b.bill_number));
    // Build "agenda" entries: one per (committee, meeting), filtered to those
    // that actually list bills (otherwise the picker has nothing to show).
    const agendas = [];
    for (const c of committees || []) {
        for (const m of c.meetings || []) {
            const bn = parseBillIdsField(m.bill_ids);
            if (!bn.length) continue;
            agendas.push({
                key: `${c.committee_id || c.id}|${m.id}`,
                committeeName: c.description || c.committee_id || "",
                meetingTime: m.meeting_time,
                meetingPlace: m.meeting_place || "",
                bills: bn.map(normalizeBillNumber),
            });
        }
    }
    if (!agendas.length) {
        list.innerHTML = `<p style="color:#666;font-size:14px;margin:0;">No agendas available.</p>`;
        return;
    }
    agendas.sort((a, b) =>
        Date.parse((a.meetingTime || "").replace(" ", "T")) -
        Date.parse((b.meetingTime || "").replace(" ", "T"))
    );
    select.innerHTML = `<option value="">Select an agenda</option>`
        + agendas.map(a => {
            const date = formatMeetingTime(a.meetingTime);
            const labelParts = [date, a.committeeName].filter(Boolean);
            return `<option value="${escapeAttr(a.key)}">${escapeAttr(labelParts.join(" — "))}</option>`;
        }).join("");

    const billByNumber = new Map(bills.map(b => [b.bill_number, b]));
    select.addEventListener("change", () => {
        const a = agendas.find(x => x.key === select.value);
        if (!a) {
            list.innerHTML = `<p class="agenda-placeholder" style="color:#666;font-size:14px;margin:0;min-height:180px;display:flex;align-items:center;justify-content:center;">Select an agenda</p>`;
            return;
        }
        const rows = a.bills.map(bn => {
            const inDemo = billNumbers.has(bn);
            const b = billByNumber.get(bn);
            const titleText = inDemo && b ? (b.title || "") : "(not in demo dataset)";
            const bnCell = inDemo
                ? `<a href="/${account}/bill/#/${escapeAttr(bn)}">${escapeAttr(bn)}</a>`
                : escapeAttr(bn);
            return `<tr>
                <td style="padding:0.35rem 0.5rem;font-size:13px;font-weight:600;color:#3d52d5;">${bnCell}</td>
                <td style="padding:0.35rem 0.5rem;font-size:13px;color:${inDemo ? "#272727" : "#888"};">${escapeAttr(titleText)}</td>
            </tr>`;
        }).join("");
        list.innerHTML = `<table style="width:100%;border-collapse:collapse;">
            <tbody>${rows}</tbody>
        </table>`;
    });
}

export async function hydrateBillDetail(rootSelector) {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const billId = (window.location.hash || "").replace(/^#\//, "");
    if (!billId) {
        root.innerHTML = `<p class="bill-detail-empty">Select a bill from the table.</p>`;
        return;
    }
    const { bills, opinions, organizations, opinionSummaries } = await loadData();
    const bill = bills.find(b => b.bill_number === billId);
    if (!bill) {
        root.innerHTML = `<p class="bill-detail-empty">Bill ${billId} not found.</p>`;
        return;
    }
    const orgNameById = new Map((organizations || []).map(o => [String(o.id), o.name]));
    const av = activeVersion(bill);
    const billOpinions = opinions[bill.id] || [];
    const s = state.get();
    const ownOpinion = s.opinions[billId];

    // Group opinions by stance so we can render one collapsible per category.
    const grouped = Object.fromEntries(OPINION_ORDER.map(label => [label, []]));
    for (const o of billOpinions) {
        const label = OPINION_LABELS[o.opinion];
        if (!label) continue;
        const orgName = orgNameById.get(String(o.user_org_id)) || (o.user_org_id || "Anonymous");
        grouped[label].push({ ...o, orgName, label });
    }
    // Per-stance inner dropdowns, all collapsed by default.
    const innerGroupsHtml = OPINION_ORDER.map(label => {
        const items = grouped[label];
        const cssClass = OPINION_CSS_CLASS[label];
        const summary = `<summary class="bill-opinion-group-summary">
            <span class="bill-opinion-dot ${cssClass}"></span>
            <span class="bill-opinion-group-label">${label}</span>
            <span class="bill-opinion-group-count">${items.length}</span>
        </summary>`;
        const body = items.length === 0
            ? `<p class="bill-opinion-empty">No organizations.</p>`
            : `<ul class="bill-opinion-list">${items.map(o => {
                const action = o.action ? `<span class="bill-opinion-action">${escapeAttr(o.action)}</span>` : "";
                return `<li class="bill-opinion-row">
                    <div class="bill-opinion-row-head">
                        <span class="bill-opinion-org">${escapeAttr(o.orgName)}</span>
                        ${action}
                    </div>
                    ${o.comments ? `<p class="bill-opinion-comment">${escapeAttr(o.comments)}</p>` : ""}
                </li>`;
            }).join("")}</ul>`;
        return `<details class="bill-opinion-group">${summary}${body}</details>`;
    }).join("");
    // Wrap everything in one outer dropdown so the section is collapsed by default.
    const opinionGroupsHtml = billOpinions.length
        ? `<details class="bill-opinion-outer">
                <summary class="bill-opinion-outer-summary">
                    View opinions by category
                    <span class="bill-opinion-outer-count">${billOpinions.length}</span>
                </summary>
                <div class="bill-opinion-groups">${innerGroupsHtml}</div>
           </details>`
        : `<p class="bill-opinion-empty">No opinions submitted on this bill yet.</p>`;

    const summary = opinionSummaries && opinionSummaries[billId];
    const summaryBarHtml = summary
        ? `<div class="bill-detail-bar-row">
                ${renderOpinionBar(billId, opinionSummaries)}
                <span class="bill-detail-bar-count">${summary.total} ${summary.total === 1 ? "organization" : "organizations"}</span>
           </div>`
        : "";

    const stanceOptions = ["Strongly Oppose", "Oppose in Concept", "Neutral", "Endorse in Concept", "Strongly Endorse"];
    const actionOptions = ["", "Yea", "Nay", "Amend", "Hold"];

    root.innerHTML = `
        <article class="bill-detail">
            <header class="bill-detail-header">
                <h1 class="bill-detail-title">
                    <span class="bill-detail-number">${escapeAttr(bill.bill_number)}</span>
                    ${escapeAttr(bill.title || "")}
                </h1>
                <p class="bill-detail-meta">
                    <strong>Sponsor:</strong> ${escapeAttr(bill.sponsor || "—")}
                    &nbsp;·&nbsp;
                    <strong>Floor sponsor:</strong> ${escapeAttr(bill.floor_sponsor || "—")}
                    ${bill.location ? `&nbsp;·&nbsp;<strong>Location:</strong> ${escapeAttr(bill.location)}` : ""}
                </p>
                ${bill.link ? `<p class="bill-detail-link"><a href="${escapeAttr(bill.link)}" target="_blank" rel="noopener">View on le.utah.gov →</a></p>` : ""}
            </header>

            <section class="bill-detail-section">
                <h2>Active Version ${av?.version ?? bill.version ?? ""}</h2>
                <div class="bill-detail-description">${formatBillDescription(bill.detailed_description || bill.short_description)}</div>
            </section>

            <section class="bill-detail-section">
                <h2>Opinions (${billOpinions.length})</h2>
                ${summaryBarHtml}
                <div class="bill-opinion-groups">${opinionGroupsHtml}</div>
            </section>

            <section class="bill-detail-section">
                <h2>Your Opinion</h2>
                <form id="demo-opinion-form" class="bill-opinion-form" data-bill="${escapeAttr(billId)}">
                    <label class="bill-opinion-form-row">
                        <span>Stance</span>
                        <select name="stance">
                            ${stanceOptions.map(o => `<option ${ownOpinion?.stance === o ? "selected" : ""}>${o}</option>`).join("")}
                        </select>
                    </label>
                    <label class="bill-opinion-form-row">
                        <span>Preferred Action</span>
                        <select name="action">
                            ${actionOptions.map(o => `<option value="${escapeAttr(o)}" ${ownOpinion?.action === o ? "selected" : ""}>${o || "—"}</option>`).join("")}
                        </select>
                    </label>
                    <label class="bill-opinion-form-row">
                        <span>Comments</span>
                        <textarea name="comments" rows="4">${escapeAttr(ownOpinion?.comments || "")}</textarea>
                    </label>
                    <button type="submit" class="btn-primary">Save Opinion</button>
                </form>
            </section>
        </article>`;
    attachOpinionTooltips(root);
}
