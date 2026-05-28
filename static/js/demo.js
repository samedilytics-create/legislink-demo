import { state } from "./demo-state.js";
import { attachAuth } from "./demo-auth.js";
import {
    hydrateBillTable, hydrateBillDetail, loadData,
    renderFlagCell, renderNoteCell,
    hydrateAgendaCard, hydrateMeetingsCalendar,
} from "./demo-hydrate.js";
import { attachRouter } from "./demo-router.js";
import { startHomeTour, startTableTour } from "./tour.js";

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

// --- Flag picker popover ---
const FLAG_POPOVER_COLORS = [
    { num: 1, name: "Red",    color: "#ef4444" },
    { num: 2, name: "Yellow", color: "#f59e0b" },
    { num: 3, name: "Green",  color: "#22c55e" },
    { num: 4, name: "Blue",   color: "#3b82f6" },
    { num: 5, name: "Purple", color: "#a855f7" },
    { num: 6, name: "Black",  color: "#374151" },
];

const FLAG_POPOVER_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">`
    + `<rect x="3" y="2" width="2" height="20" fill="currentColor"/>`
    + `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/>`
    + `</svg>`;

let _flagPopover = null;

function getFlagPopover() {
    if (_flagPopover) return _flagPopover;
    const el = document.createElement("div");
    el.id = "flag-popover";
    el.className = "flag-popover";
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Choose flag color");
    el.innerHTML = `<div class="flag-popover-swatches">${
        FLAG_POPOVER_COLORS.map(c =>
            `<button type="button" class="flag-popover-swatch" data-color="${c.num}"
                     style="color:${c.color}" aria-label="${c.name}">${FLAG_POPOVER_SVG}</button>`
        ).join("")
    }</div>`;
    document.body.appendChild(el);
    _flagPopover = el;
    return el;
}

function openFlagPicker(billId, triggerEl) {
    const pop = getFlagPopover();
    pop.dataset.bill = billId;

    // Mark which swatches are currently active
    const current = state.getFlags(billId);
    pop.querySelectorAll(".flag-popover-swatch").forEach(btn => {
        btn.classList.toggle("flag-popover-swatch--active", current.includes(parseInt(btn.dataset.color, 10)));
    });

    // Reveal off-screen first so we can measure dimensions without a one-frame flash at (0,0).
    pop.style.visibility = "hidden";
    pop.hidden = false;
    const tr = triggerEl.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    let top = tr.top + window.scrollY + tr.height / 2 - pr.height / 2;
    let left = tr.right + window.scrollX + 8;
    // Keep within viewport horizontally
    if (left + pr.width > window.innerWidth - 8) left = tr.left + window.scrollX - pr.width - 8;
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
    pop.style.visibility = "";

    // Defer outside-click listener so this same click doesn't immediately close it
    requestAnimationFrame(() => {
        document.addEventListener("click", _flagPopoverOutsideClick, true);
        document.addEventListener("keydown", _flagPopoverKeydown);
    });
}

function closeFlagPicker() {
    if (!_flagPopover) return;
    _flagPopover.hidden = true;
    delete _flagPopover.dataset.bill;
    document.removeEventListener("click", _flagPopoverOutsideClick, true);
    document.removeEventListener("keydown", _flagPopoverKeydown);
}

function _flagPopoverOutsideClick(e) {
    if (_flagPopover && !_flagPopover.contains(e.target)) closeFlagPicker();
}

function _flagPopoverKeydown(e) {
    if (e.key === "Escape") closeFlagPicker();
}

// Swatch click: toggle that colour, save, close
document.addEventListener("click", e => {
    const swatch = e.target.closest(".flag-popover-swatch");
    if (!swatch || !_flagPopover || _flagPopover.hidden) return;
    const billId = _flagPopover.dataset.bill;
    if (!billId) return;
    const colorNum = parseInt(swatch.dataset.color, 10);
    const current = state.getFlags(billId);
    // Single-select: clicking the active flag clears it; clicking any other sets it exclusively.
    const updated = current.length === 1 && current[0] === colorNum ? [] : [colorNum];
    state.setFlags(billId, updated);
    refreshFlagCell(billId);
    closeFlagPicker();
});

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
            openFlagPicker(billId, btn);
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
        if (path === "/lobbyist/table/" || path === "/legislator/table/") {
            startTableTour(account);
        }
    }
    if (path === "/lobbyist/" || path === "/legislator/") {
        await hydrateBillTable("#bill-table-body", {
            account,
            filter: (b, s) => s.trackedBills.includes(b.bill_number),
        });
        wireBillTableSearch();
        // Fire-and-forget; cards live independently of the bill table.
        hydrateAgendaCard({ account });
        hydrateMeetingsCalendar("#meetings-calendar");
        startHomeTour(account);
    }

    attachRouter();
    attachWriteActions();
    attachNoteModal();
}

main().catch(err => console.error("demo.js bootstrap failed", err));

// Move logout to the bottom of the mobile menu (runs after main.js's DOMContentLoaded handler).
// Coupled to the mobile-menu-content structure built by main.js: first <ul> holds top items,
// last <ul> holds bottom items. If main.js restructures the menu, this becomes a no-op.
document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector(".mobile-menu-content nav");
    if (!nav) return;
    const uls = nav.querySelectorAll("ul");
    if (uls.length < 2) return;
    const firstUl = uls[0];
    const lastUl = uls[uls.length - 1];
    const logoutLi = Array.from(firstUl.querySelectorAll("li")).find(
        li => li.textContent.trim().includes("Logout")
    );
    if (logoutLi) lastUl.appendChild(logoutLi);
});
