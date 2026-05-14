import { hydrateBillDetail } from "./demo-hydrate.js";

export function attachRouter() {
    const path = window.location.pathname;
    if (path === "/lobbyist/bill/" || path === "/legislator/bill/") {
        const onChange = () => hydrateBillDetail("#bill-detail-root");
        window.addEventListener("hashchange", onChange);
        onChange();
    }
}
