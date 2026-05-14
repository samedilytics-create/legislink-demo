import { state } from "./demo-state.js";
import { attachAuth } from "./demo-auth.js";
import {
    hydrateBillTable, hydrateBillDetail, loadData,
    renderFlagCell, renderNoteCell,
    hydrateAgendaCard, hydrateUpcomingMeetings,
} from "./demo-hydrate.js";
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
        // Send the visitor back to the landing page so they pick a role.
        window.location.href = "/";
        return false;
    }
    return true;
}

// --- Flag picker modal ---
function openFlagPicker(billId) {
    const overlay = document.getElementById("flag-picker-modal");
    if (!overlay) return;
    overlay.dataset.bill = billId;
    overlay.querySelector("#flag-modal-bill-number").textContent = billId;
    const current = state.getFlags(billId);
    overlay.querySelectorAll('input[type="checkbox"][data-flag-color]').forEach(cb => {
        const c = parseInt(cb.dataset.flagColor, 10);
        cb.checked = current.includes(c);
    });
    overlay.dataset.open = "true";
}

function closeFlagPicker() {
    const overlay = document.getElementById("flag-picker-modal");
    if (!overlay) return;
    overlay.dataset.open = "false";
    delete overlay.dataset.bill;
}

function saveFlagPicker() {
    const overlay = document.getElementById("flag-picker-modal");
    if (!overlay) return;
    const billId = overlay.dataset.bill;
    if (!billId) return;
    const selected = Array.from(overlay.querySelectorAll('input[type="checkbox"][data-flag-color]:checked'))
        .map(cb => parseInt(cb.dataset.flagColor, 10));
    state.setFlags(billId, selected);
    refreshFlagCell(billId);
    closeFlagPicker();
}

function refreshFlagCell(billId) {
    const colors = state.getFlags(billId);
    const html = renderFlagCell(billId, colors);
    document.querySelectorAll(`tr[data-bill="${CSS.escape(billId)}"] .flag-cell`).forEach(cell => {
        cell.innerHTML = html;
    });
}

// --- Note modal ---
function openNoteModal(billId) {
    const overlay = document.getElementById("note-modal");
    if (!overlay) return;
    overlay.dataset.bill = billId;
    overlay.querySelector("#note-modal-bill-number").textContent = billId;
    const note = state.getNote(billId) || { text: "", opinion: "" };
    overlay.querySelector("#note-modal-text").value = note.text || "";
    const opinionSelect = overlay.querySelector("#note-modal-opinion");
    if (opinionSelect) opinionSelect.value = note.opinion || "";
    // Hide opinion field for lobbyists; only legislators classify with an opinion.
    const account = state.get().session?.account;
    overlay.querySelector("#note-modal-opinion-row")
        ?.toggleAttribute("hidden", account !== "legislator");
    overlay.dataset.open = "true";
    setTimeout(() => overlay.querySelector("#note-modal-text")?.focus(), 0);
}

function closeNoteModal() {
    const overlay = document.getElementById("note-modal");
    if (!overlay) return;
    overlay.dataset.open = "false";
    delete overlay.dataset.bill;
}

function saveNoteModal() {
    const overlay = document.getElementById("note-modal");
    if (!overlay) return;
    const billId = overlay.dataset.bill;
    if (!billId) return;
    const text = overlay.querySelector("#note-modal-text").value;
    const opinion = overlay.querySelector("#note-modal-opinion")?.value || "";
    state.setNote(billId, { text, opinion });
    refreshNoteCell(billId);
    closeNoteModal();
}

function refreshNoteCell(billId) {
    const note = state.getNote(billId);
    const html = renderNoteCell(billId, note);
    document.querySelectorAll(`tr[data-bill="${CSS.escape(billId)}"] .note-cell`).forEach(cell => {
        cell.innerHTML = html;
    });
}

function attachNoteModal() {
    const overlay = document.getElementById("note-modal");
    if (!overlay) return;
    overlay.addEventListener("click", e => { if (e.target === overlay) closeNoteModal(); });
    overlay.querySelector("#note-modal-close-btn")?.addEventListener("click", closeNoteModal);
    overlay.querySelector("#note-modal-cancel-btn")?.addEventListener("click", closeNoteModal);
    overlay.querySelector("#note-modal-save-btn")?.addEventListener("click", saveNoteModal);
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && overlay.dataset.open === "true") closeNoteModal();
    });
}

// --- Bill table live search ---
function wireBillTableSearch() {
    const input = document.getElementById("bill-table-search");
    const tbody = document.getElementById("bill-table-body");
    if (!input || !tbody) return;
    const status = document.getElementById("bill-table-search-status");
    const update = () => {
        const q = input.value.trim().toLowerCase();
        const rows = tbody.querySelectorAll("tr[data-search]");
        let visible = 0;
        rows.forEach(row => {
            const match = !q || row.dataset.search.includes(q);
            row.hidden = !match;
            if (match) visible++;
        });
        if (status) {
            status.textContent = q
                ? `${visible} of ${rows.length} bills match "${input.value.trim()}"`
                : `${rows.length} bills`;
        }
    };
    input.addEventListener("input", update);
    update();
}

function attachFlagPickerModal() {
    const overlay = document.getElementById("flag-picker-modal");
    if (!overlay) return;
    overlay.addEventListener("click", e => {
        if (e.target === overlay) closeFlagPicker();
    });
    overlay.querySelector("#flag-modal-close-btn")?.addEventListener("click", closeFlagPicker);
    overlay.querySelector("#flag-modal-cancel-btn")?.addEventListener("click", closeFlagPicker);
    overlay.querySelector("#flag-modal-save-btn")?.addEventListener("click", saveFlagPicker);
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && overlay.dataset.open === "true") closeFlagPicker();
    });
}

// --- Write-action click delegation ---
function attachWriteActions() {
    document.body.addEventListener("click", e => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const billId = btn.dataset.bill || btn.closest("[data-bill]")?.dataset.bill;
        if (!billId) return;

        if (btn.dataset.action === "toggle-track") {
            // The browser already flipped the checkbox; reconcile state to match.
            const s = state.get();
            const isTracked = s.trackedBills.includes(billId);
            const wantTracked = btn instanceof HTMLInputElement ? btn.checked : !isTracked;
            if (isTracked !== wantTracked) state.toggleTracked(billId);
            const label = btn.closest("label.track-checkbox-label");
            if (label) label.title = `${wantTracked ? "Untrack" : "Track"} this bill`;
        }
        if (btn.dataset.action === "open-flag-picker") {
            e.preventDefault();
            e.stopPropagation();
            openFlagPicker(billId);
        }
        if (btn.dataset.action === "open-note") {
            e.preventDefault();
            e.stopPropagation();
            openNoteModal(billId);
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

    const account = path.startsWith("/legislator/") ? "legislator" : "lobbyist";
    if (
        path === "/lobbyist/table/" || path === "/legislator/table/" ||
        path === "/lobbyist/search/" || path === "/legislator/search/"
    ) {
        await hydrateBillTable("#bill-table-body", { account });
        wireBillTableSearch();
    }
    if (path === "/lobbyist/" || path === "/legislator/") {
        await hydrateBillTable("#bill-table-body", {
            account,
            filter: (b, s) => s.trackedBills.includes(b.bill_number),
        });
        // Fire-and-forget; cards live independently of the bill table.
        hydrateAgendaCard({ account });
        hydrateUpcomingMeetings("#upcoming-items-list");
    }

    attachRouter();
    attachWriteActions();
    attachFlagPickerModal();
    attachNoteModal();
}

main().catch(err => console.error("demo.js bootstrap failed", err));
