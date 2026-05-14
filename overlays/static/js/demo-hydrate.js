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
