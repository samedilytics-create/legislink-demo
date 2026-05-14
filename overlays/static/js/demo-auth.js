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
