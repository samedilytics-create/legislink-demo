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
