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
