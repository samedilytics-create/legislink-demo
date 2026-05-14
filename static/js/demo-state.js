// localStorage layer for the Legislink demo. Single namespaced key, versioned.

const KEY = "legislink.demo.v1";

const EMPTY = {
    session: null,        // { account: "lobbyist" | "legislator", signedInAt }
    trackedBills: [],
    flags: {},            // { [billId]: [colorNum, ...] }  colorNum 1..6
    opinions: {},         // { [billId]: { stance, action, comments, version } }
    notes: {},            // { [billId]: { text, opinion, savedAt } }
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

    // Wipe all persisted state and seed from a demo-accounts.json profile so the
    // portal lands on a useful page (tracked bills, flags, etc.) right away.
    seedAndSignIn(account, profile) {
        const FLAG_NUM_BY_NAME = { red: 1, yellow: 2, green: 3, blue: 4, purple: 5, black: 6 };
        const fresh = structuredClone(EMPTY);
        fresh.session = { account, signedInAt: new Date().toISOString() };
        fresh.bannerDismissed = load().bannerDismissed; // don't nag again
        if (profile && typeof profile === "object") {
            if (Array.isArray(profile.tracked_bills)) {
                fresh.trackedBills = [...profile.tracked_bills];
            }
            if (profile.flags && typeof profile.flags === "object") {
                for (const [billId, raw] of Object.entries(profile.flags)) {
                    let nums;
                    if (Array.isArray(raw)) {
                        nums = raw.map(v => typeof v === "number" ? v : FLAG_NUM_BY_NAME[String(v).toLowerCase()]);
                    } else if (typeof raw === "string") {
                        nums = [FLAG_NUM_BY_NAME[raw.toLowerCase()]];
                    } else {
                        nums = [];
                    }
                    nums = nums.filter(n => Number.isInteger(n) && n >= 1 && n <= 6);
                    if (nums.length) fresh.flags[billId] = Array.from(new Set(nums)).sort((a,b) => a - b);
                }
            }
            if (profile.opinions && typeof profile.opinions === "object") {
                fresh.opinions = structuredClone(profile.opinions);
            }
            if (profile.notes && typeof profile.notes === "object") {
                for (const [billId, raw] of Object.entries(profile.notes)) {
                    if (!raw) continue;
                    if (Array.isArray(raw) && raw.length) {
                        const last = raw[raw.length - 1];
                        fresh.notes[billId] = {
                            text: last.text || "",
                            opinion: last.opinion || "",
                            savedAt: last.editedAt || last.savedAt || new Date().toISOString(),
                        };
                    } else if (typeof raw === "object" && (raw.text || raw.opinion)) {
                        fresh.notes[billId] = {
                            text: raw.text || "",
                            opinion: raw.opinion || "",
                            savedAt: raw.savedAt || raw.editedAt || new Date().toISOString(),
                        };
                    }
                }
            }
        }
        save(fresh);
        return fresh;
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

    setFlags(billId, colors) {
        return state.mutate(s => {
            const cleaned = (colors || [])
                .map(c => parseInt(c, 10))
                .filter(c => Number.isInteger(c) && c >= 1 && c <= 6);
            const unique = Array.from(new Set(cleaned)).sort((a, b) => a - b);
            if (unique.length) s.flags[billId] = unique;
            else delete s.flags[billId];
        });
    },

    getFlags(billId) {
        const raw = load().flags[billId];
        if (!Array.isArray(raw)) return [];
        return raw;
    },

    setOpinion(billId, opinion) {
        return state.mutate(s => { s.opinions[billId] = opinion; });
    },

    setNote(billId, { text, opinion }) {
        return state.mutate(s => {
            const cleanedText = (text || "").trim();
            const cleanedOpinion = (opinion || "").trim();
            if (!cleanedText && !cleanedOpinion) {
                delete s.notes[billId];
                return;
            }
            s.notes[billId] = {
                text: cleanedText,
                opinion: cleanedOpinion,
                savedAt: new Date().toISOString(),
            };
        });
    },

    getNote(billId) {
        const raw = load().notes[billId];
        if (!raw || typeof raw !== "object") return null;
        // Tolerate the older array shape from any pre-existing localStorage payload.
        if (Array.isArray(raw)) return null;
        return raw;
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
