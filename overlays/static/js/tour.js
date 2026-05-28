// Interactive product tour — runs on first visit to portal home, then continues on the table page.

const SEEN_PREFIX    = 'll_tour_home_';   // home tour seen flag
const PENDING_PREFIX = 'll_tour_table_';  // table tour pending flag
const PAD = 10;   // spotlight padding around target
const GAP = 16;   // gap between spotlight edge and tooltip

// ─── Step definitions ────────────────────────────────────────────────────────

const HOME_STEPS = {
    lobbyist: [
        {
            selector: '.sidebar',
            title: 'Your Navigation',
            body: 'Use the sidebar to switch between your bill tracking table, search, and account settings.',
            position: 'right',
        },
        {
            selector: '.agenda-card',
            title: 'Committee Agendas',
            body: 'Select any committee to see its full agenda. Bills you\'re tracking are highlighted so you never miss a hearing.',
            position: 'right',
        },
        {
            selector: '.upcoming-card',
            title: 'My Meetings',
            body: 'A 3-day calendar of upcoming committee hearings. Your tracked bills appear inside each event block.',
            position: 'right',
        },
        {
            selector: '.tracked-bills-card',
            title: 'Tracked & Flagged Bills',
            body: 'Bills you flag or manually track will appear here. Next, we\'ll walk you through the full bill table.',
            position: 'top',
        },
    ],
    legislator: [
        {
            selector: '.sidebar',
            title: 'Your Navigation',
            body: 'Use the sidebar to switch between your bill tracking table, search, and account settings.',
            position: 'right',
        },
        {
            selector: '.agenda-card',
            title: 'Committee Agendas',
            body: 'See which bills are scheduled for each committee. Review constituent opinions before walking into the hearing.',
            position: 'right',
        },
        {
            selector: '.upcoming-card',
            title: 'My Meetings',
            body: 'A 3-day calendar of your upcoming committee hearings, with tracked bills listed inside each event.',
            position: 'right',
        },
        {
            selector: '.tracked-bills-card',
            title: 'Tracked Bills',
            body: 'Bills you sponsor, flag, or manually track will appear here. Next, we\'ll walk you through the full bill table.',
            position: 'top',
        },
    ],
};

const TABLE_STEPS = {
    lobbyist: [
        {
            selector: '#bill-table-body tr:first-child .flag-cell',
            title: 'Flag Bills',
            body: 'Click the flag icon to color-code a bill by priority or status. One color per bill — click the active flag again to clear it.',
            position: 'right',
        },
        {
            selector: '.bills-table thead tr',
            title: 'Bill Information',
            body: 'Each row shows the bill number, title, sponsor, subjects, and its current location in the legislative process.',
            position: 'bottom',
        },
        {
            selector: '#bill-table-body tr:first-child .note-cell',
            title: 'Internal Notes',
            body: 'Click the note icon to add a private note on any bill. Notes are only visible to you and reset when you clear browser storage.',
            position: 'left',
        },
        {
            selector: '#bill-table-body tr:first-child .track-cell',
            title: 'Track Bills',
            body: 'Check the box to track a bill. Tracked bills appear on your home dashboard so you can monitor them at a glance.',
            position: 'left',
        },
    ],
    legislator: [
        {
            selector: '#bill-table-body tr:first-child .flag-cell',
            title: 'Flag Bills',
            body: 'Click the flag icon to color-code a bill. One color per bill — click the active flag again to clear it.',
            position: 'right',
        },
        {
            selector: '.bills-table thead tr',
            title: 'Bill Information',
            body: 'Each row shows the bill number, title, sponsor, subjects, and its current location in the legislative process.',
            position: 'bottom',
        },
        {
            selector: '#bill-table-body tr:first-child .opinion-cell',
            title: 'Constituent Opinions',
            body: 'Hover over the colored bar to see exactly which interest groups support or oppose this bill and their stated positions.',
            position: 'left',
        },
        {
            selector: '#bill-table-body tr:first-child .note-cell',
            title: 'Internal Notes',
            body: 'Click the note icon to record your personal position on a bill or add a private note. Only visible to you.',
            position: 'left',
        },
    ],
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function startHomeTour(role) {
    if (localStorage.getItem(SEEN_PREFIX + role) === '1') return;
    const steps = HOME_STEPS[role];
    if (!steps) return;
    setTimeout(() => runTour({
        role,
        steps,
        onComplete() {
            // Navigate to the table page to continue
            localStorage.setItem(PENDING_PREFIX + role, '1');
            localStorage.setItem(SEEN_PREFIX + role, '1');
            const base = role === 'legislator' ? '/legislator' : '/lobbyist';
            window.location.href = `${base}/table/`;
        },
        lastBtnLabel: 'See Bill Table →',
    }), 700);
}

export function startTableTour(role) {
    if (localStorage.getItem(PENDING_PREFIX + role) !== '1') return;
    localStorage.removeItem(PENDING_PREFIX + role);
    const steps = TABLE_STEPS[role];
    if (!steps) return;
    setTimeout(() => runTour({
        role,
        steps,
        onComplete() { /* tour fully done */ },
        lastBtnLabel: 'Done',
    }), 700);
}

// ─── Core runner ─────────────────────────────────────────────────────────────

function runTour({ role, steps, onComplete, lastBtnLabel }) {
    let current = 0;
    const svgNS = 'http://www.w3.org/2000/svg';

    // SVG spotlight overlay
    const svg = document.createElementNS(svgNS, 'svg');
    svg.id = 'll-tour-svg';
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:fixed;inset:0;z-index:9000;pointer-events:none;overflow:visible;';

    const defs   = document.createElementNS(svgNS, 'defs');
    const mask   = document.createElementNS(svgNS, 'mask');
    mask.id      = 'll-tour-mask';

    const maskBg = document.createElementNS(svgNS, 'rect');
    maskBg.setAttribute('fill', 'white');

    const hole   = document.createElementNS(svgNS, 'rect');
    hole.setAttribute('fill', 'black');
    hole.setAttribute('rx', '8');

    mask.appendChild(maskBg);
    mask.appendChild(hole);
    defs.appendChild(mask);

    const dim    = document.createElementNS(svgNS, 'rect');
    dim.setAttribute('fill', 'rgba(0,0,0,0.62)');
    dim.setAttribute('mask', 'url(#ll-tour-mask)');

    svg.appendChild(defs);
    svg.appendChild(dim);

    function syncSize() {
        const W = window.innerWidth, H = window.innerHeight;
        for (const el of [svg, maskBg, dim]) {
            el.setAttribute('width',  W);
            el.setAttribute('height', H);
        }
    }
    syncSize();
    window.addEventListener('resize', syncSize);
    document.body.appendChild(svg);

    // Tooltip
    const tip = document.createElement('div');
    tip.className = 'tour-tooltip';
    tip.innerHTML = `
        <div class="tour-header">
            <span class="tour-counter"></span>
            <button type="button" class="tour-skip">Skip tour</button>
        </div>
        <h3 class="tour-title"></h3>
        <p class="tour-body"></p>
        <div class="tour-footer">
            <button type="button" class="tour-next"></button>
        </div>`;
    document.body.appendChild(tip);

    const counterEl = tip.querySelector('.tour-counter');
    const titleEl   = tip.querySelector('.tour-title');
    const bodyEl    = tip.querySelector('.tour-body');
    const nextBtn   = tip.querySelector('.tour-next');
    const skipBtn   = tip.querySelector('.tour-skip');

    function close(runCallback) {
        svg.remove();
        tip.remove();
        window.removeEventListener('resize', syncSize);
        if (runCallback) onComplete();
    }

    function show(index) {
        const step   = steps[index];
        const target = document.querySelector(step.selector);
        if (!target) {
            index + 1 < steps.length ? show(index + 1) : close(true);
            return;
        }

        const isLast = index + 1 === steps.length;
        counterEl.textContent = `${index + 1} of ${steps.length}`;
        titleEl.textContent   = step.title;
        bodyEl.textContent    = step.body;
        nextBtn.textContent   = isLast ? lastBtnLabel : 'Next →';

        const r = target.getBoundingClientRect();
        hole.setAttribute('x',      r.left   - PAD);
        hole.setAttribute('y',      r.top    - PAD);
        hole.setAttribute('width',  r.width  + PAD * 2);
        hole.setAttribute('height', r.height + PAD * 2);

        place(tip, r, step.position);
    }

    function place(el, r, pref) {
        el.style.visibility = 'hidden';
        const W = window.innerWidth, H = window.innerHeight;
        const TW = el.offsetWidth  || 300;
        const TH = el.offsetHeight || 180;
        const EDGE = 12;
        let top, left, arrow;

        if (pref === 'right' && r.right + GAP + TW < W - EDGE) {
            left  = r.right + GAP;
            top   = r.top + r.height / 2 - TH / 2;
            arrow = 'arrow-left';
        } else if (pref === 'top' && r.top - GAP - TH > EDGE) {
            top   = r.top - GAP - TH;
            left  = r.left + r.width / 2 - TW / 2;
            arrow = 'arrow-bottom';
        } else if (pref === 'bottom' && r.bottom + GAP + TH < H - EDGE) {
            top   = r.bottom + GAP;
            left  = r.left + r.width / 2 - TW / 2;
            arrow = 'arrow-top';
        } else if (r.left - GAP - TW > EDGE) {
            left  = r.left - GAP - TW;
            top   = r.top + r.height / 2 - TH / 2;
            arrow = 'arrow-right';
        } else {
            top   = r.bottom + GAP;
            left  = r.left + r.width / 2 - TW / 2;
            arrow = 'arrow-top';
        }

        left = Math.max(EDGE, Math.min(left, W - TW - EDGE));
        top  = Math.max(EDGE, Math.min(top,  H - TH - EDGE));

        el.dataset.arrow    = arrow;
        el.style.left       = `${left}px`;
        el.style.top        = `${top}px`;
        el.style.visibility = '';
    }

    nextBtn.addEventListener('click', () => {
        current++;
        if (current >= steps.length) close(true);
        else show(current);
    });
    skipBtn.addEventListener('click', () => close(false));

    show(0);
}
