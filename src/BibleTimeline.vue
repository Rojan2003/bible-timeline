<!-- Zoomable timeline: more detail appears as you zoom in. Needs timeline.json next to this file, and the pictures in public/img/. -->
<template>
  <div class="app" @keydown="onKey">
    <header class="bar">
      <div class="ttl">
        <h1>Bible Timeline</h1>
        <p class="sub">{{ rangeText }} <span class="sep">·</span> {{ countText }}</p>
        <button v-if="eras.length" id="era-info" type="button" class="eraline" :aria-expanded="infoOpen" @click="toggleInfo">
          <b>About these years</b><span>{{ eraLine }}</span>
        </button>
      </div>
      <div class="ctl">
        <span class="lvl" :data-mode="mode">{{ modeName }}</span>
        <button id="zoom-out" type="button" class="btn" :disabled="scale <= minScale * 1.001" aria-label="Zoom out" @click="zoomBy(1 / 1.8)">−</button>
        <button id="zoom-in" type="button" class="btn" :disabled="scale >= maxScale * 0.999" aria-label="Zoom in" @click="zoomBy(1.8)">+</button>
        <button id="zoom-fit" type="button" class="btn wide" @click="fit(true)">Show all</button>
      </div>
    </header>
  
    <div class="view" ref="view" tabindex="0" :class="{ drag: dragging }"
         aria-label="Timeline. Scroll or pinch to zoom, drag to move, arrow keys to pan."
         @pointerdown="onDown" @dblclick="onDbl">
      <div v-for="t in ticks" :key="'t' + t.v" class="grid" :style="{ transform: 'translateX(' + t.x + 'px)' }"><span>{{ t.label }}</span></div>
      <div v-if="eraX !== null" class="era" :style="{ transform: 'translateX(' + eraX + 'px)' }"><span>B.C.E.</span><span>C.E.</span></div>
      <div class="axis" :style="{ top: axisY + 'px' }"></div>
      <div v-for="r in vis.ranges" :key="'r' + r.id" class="rng" :style="r.style"></div>
      <div v-for="p in vis.placed" :key="'s' + p.id" class="stem" :class="{ key: p.it.importance === 3 }" :style="p.stemStyle"></div>
      <button v-for="p in vis.placed" :key="mode + p.id" type="button" class="card"
              :class="[mode, { key: p.it.importance === 3, sel: p.id === selId }]" :style="p.boxStyle" @click="pick(p.it)">
        <img v-if="mode === 'card' && p.it.thumb" class="th" :src="p.it.thumb" alt="" draggable="false" loading="lazy">
        <span class="tx">
          <span class="yr">{{ p.it.label }}<i v-if="p.it.events.length > (mode === 'card' ? 2 : 1)">+{{ p.it.events.length - (mode === 'card' ? 2 : 1) }} more</i></span>
          <template v-if="mode === 'card'">
            <span v-for="(e, i) in p.it.events.slice(0, 2)" :key="i" class="ev" :class="'n' + Math.min(p.it.events.length, 2)">{{ e.text }}</span>
          </template>
          <span v-else class="tt">{{ p.it.events[0].title }}</span>
        </span>
      </button>
      <button v-for="d in vis.dots" :key="'d' + d.id" type="button" tabindex="-1" class="dot"
              :class="{ on: d.on, key: d.it.importance === 3, sel: d.id === selId }" :style="d.style"
              :title="d.it.label + ': ' + d.it.events[0].title" :aria-label="d.it.label" @click="pick(d.it)"></button>
      <template v-if="jump">
        <button v-if="jump.prev" id="jump-prev" type="button" class="jump l" @click="jumpTo(jump.prev)">← {{ jump.prev.label }}</button>
        <button v-if="jump.next" id="jump-next" type="button" class="jump r" @click="jumpTo(jump.next)">{{ jump.next.label }} →</button>
      </template>
      <p class="hint">Scroll or pinch to zoom · drag to move · tap a dot for details</p>
    </div>
  
    <div class="mini" ref="mini" aria-hidden="true" @pointerdown="miniDown">
      <i v-for="m in miniTicks" :key="m.id" :class="{ key: m.key }" :style="{ left: m.pct + '%' }"></i>
      <div class="win" :style="miniWin"></div>
    </div>
  
    <aside v-if="infoOpen" class="panel" aria-live="polite">
      <div class="phead">
        <div>
          <h2 class="ih">About these years</h2>
          <span class="isub">{{ rangeText }} <span class="sep">·</span> {{ spanText }}</span>
        </div>
        <button id="info-close" type="button" class="btn" aria-label="Close" @click="infoOpen = false">×</button>
      </div>
      <div class="ilist">
        <section v-for="e in eras" :key="e.id" class="era-card">
          <h3>{{ e.title }}</h3>
          <p class="era-when">{{ e.label }} <span class="sep">·</span> {{ e.yearsText }}</p>
          <p>{{ e.text }}</p>
          <p v-if="e.refs" class="src">Scriptures: {{ e.refs }}</p>
          <p class="src">Sources: {{ e.sources }}</p>
<div v-if="e.pictures" class="jwpics">
            <b>Pictures on jw.org</b>
            <a v-for="l in e.pictures" :key="l.url" :href="l.url" target="_blank" rel="noopener">{{ l.title }}</a>
          </div>
          <div class="era-act">
            <button type="button" class="btn wide" @click="goEra(e)">Show this period</button>
            <a v-for="t in e.topics" :key="t.id" class="btn wide nav" :href="t.href">{{ t.label }}</a>
          </div>
        </section>
        <p class="src">Dates and periods follow <i>Insight on the Scriptures</i>, “Chronology,” and <i>“All Scripture Is Inspired of God and Beneficial,”</i> Study 3, on jw.org.</p>
      </div>
    </aside>

    <aside v-else-if="sel" class="panel" aria-live="polite">
      <div class="phead">
        <div>
          <h2>{{ sel.label }}</h2>
          <span v-if="sel.importance === 3" class="tag">Key date</span>
        </div>
        <button id="panel-close" type="button" class="btn" aria-label="Close details" @click="selId = null">×</button>
      </div>
      <ol class="plist" :class="{ one: sel.events.length === 1 }">
        <li v-for="(e, i) in sel.events" :key="i">
          <img v-for="src in e.images || []" :key="src" class="pic" :src="src" :alt="'Picture for ' + sel.label" draggable="false">
          <p>{{ e.text }}</p>
          <p v-if="e.sources" class="src">Sources: {{ e.sources }}</p>
        </li>
        <li class="rel-li"><Related :c0="sel.c" :c1="sel.cEnd === null ? sel.c : sel.cEnd" /></li>
      </ol>
      <div class="pfoot">
        <button id="panel-prev" type="button" class="btn wide" :disabled="sel.id === 0" @click="step(-1)">← Earlier</button>
        <button id="panel-zoom" type="button" class="btn wide" @click="focusItem(sel)">Zoom here</button>
        <button id="panel-next" type="button" class="btn wide" :disabled="sel.id === items.length - 1" @click="step(1)">Later →</button>
      </div>
    </aside>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import DATA from './timeline.json';
import PERIODS from './periods.json';
import Related from './Related.vue';
import { topicsFor } from './topics/index.js';

// The calendar has no year zero, so 1 B.C.E. sits at 0 and 1 C.E. at 1 on the number line.
const cont = (y) => (y < 0 ? y + 1 : y);
const fmtCont = (v) => { const r = Math.round(v); return r <= 0 ? (1 - r) + ' B.C.E.' : r + ' C.E.'; };
const labelOf = (d) => {
  const era = d.year < 0 ? 'B.C.E.' : 'C.E.';
  return d.yearEnd ? Math.abs(d.year) + '–' + Math.abs(d.yearEnd) + ' ' + era : Math.abs(d.year) + ' ' + era;
};

const items = DATA.map((d, i) => ({
  ...d, id: i, c: cont(d.year), cEnd: d.yearEnd ? cont(d.yearEnd) : null, label: labelOf(d),
  thumb: (d.events.find((e) => e.images && e.images.length) || { images: [null] }).images[0], // first picture, shown on the card
}));
const minC = items[0].c;
const maxC = items[items.length - 1].c;
const span = maxC - minC;
const fmtYear = (y) => Math.abs(y) + (y < 0 ? ' B.C.E.' : ' C.E.');
// The periods of Bible chronology, used for the "About these years" line and panel.
const periods = PERIODS.map((p) => {
  const c0 = cont(p.from), c1 = cont(p.to), years = c1 - c0;
  return { ...p, c0, c1, topics: topicsFor(c0, c1), label: fmtYear(p.from) + ' – ' + fmtYear(p.to), yearsText: years.toLocaleString('en-US') + ' years' };
});

// What a label looks like at each zoom level: [width, height] in px.
const SIZES = {
  chip: { wide: [200, 26], narrow: [150, 26] },   // zoomed out: year + a few words
  label: { wide: [204, 68], narrow: [170, 68] },  // middle: year + two-line title
  card: { wide: [310, 120], narrow: [250, 120] }, // zoomed in: the entry text
};
const GAP = 8;       // space between neighbouring labels
const LANE_GAP = 8;  // space between stacked rows of labels
// Zoom levels (px per year). Change these to tune when detail appears.
const TITLES_FROM = 0.6;   // below this: overview, only importance 2 and 3 get a label
const DETAIL_FROM = 8;     // from this: full entry text
const MAX_ROWS = { chip: 3, label: 3, card: 3 }; // rows of labels on each side of the line
const RULER = 26;    // year ruler at the bottom of the view
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];

function setup(props) {
  const view = ref(null);
  const mini = ref(null);
  const W = ref(1000);
  const H = ref(520);
  const scale = ref(0.15);   // px per year
  const left = ref(minC);    // year at the left edge of the view
  const selId = ref(null);
  const infoOpen = ref(false);
  const dragging = ref(false);
  let moved = false;
  let raf = 0;

  const maxScale = 40;
  const minScale = computed(() => Math.max(0.02, (W.value - 96) / span));
  const mode = computed(() => (scale.value < TITLES_FROM ? 'chip' : scale.value < DETAIL_FROM ? 'label' : 'card'));
  const modeName = computed(() => ({ chip: 'Overview', label: 'Titles', card: 'Full detail' }[mode.value]));
  const size = computed(() => SIZES[mode.value][W.value < 560 ? 'narrow' : 'wide']);
  const axisY = computed(() => Math.round((H.value - RULER) * 0.5));

  // Which dates get a label at this zoom level. Like map labels: the most important
  // dates claim space first; a date that would overlap another stays a dot.
  const layout = computed(() => {
    const [w, h] = size.value;
    const s = scale.value;
    const rows = MAX_ROWS[mode.value];
    const minImportance = mode.value === 'chip' ? 2 : 1;
    const up = Math.min(rows, Math.max(1, Math.floor((axisY.value - 14) / (h + LANE_GAP))));
    const down = Math.min(rows, Math.max(1, Math.floor((H.value - RULER - axisY.value - 18) / (h + LANE_GAP))));
    const lanes = [];
    for (let i = 0; i < Math.max(up, down); i++) {
      if (i < up) lanes.push({ side: 'a', lane: i, boxes: [] });
      if (i < down) lanes.push({ side: 'b', lane: i, boxes: [] });
    }
    const order = items.slice().sort((p, q) =>
      q.importance - p.importance || q.events.length - p.events.length || p.id - q.id);
    const out = new Map();
    for (const it of order) {
      if (it.importance < minImportance) break;
      const x = (it.c - minC) * s;
      const a = x - 14, b = a + w;
      for (const L of lanes) {
        if (L.boxes.some((o) => a < o.b + GAP && b > o.a - GAP)) continue;
        L.boxes.push({ a, b });
        out.set(it.id, { side: L.side, lane: L.lane });
        break;
      }
    }
    return out;
  });

  const vis = computed(() => {
    const [w, h] = size.value;
    const s = scale.value, l = left.value, ay = axisY.value;
    const placed = [], dots = [], ranges = [];
    for (const it of items) {
      const x = (it.c - l) * s;
      const xe = it.cEnd !== null ? (it.cEnd - l) * s : x;
      if (xe < -w - 20 || x > W.value + 20) continue;
      const pos = layout.value.get(it.id);
      if (it.cEnd !== null && xe - x > 3) {
        ranges.push({ id: it.id, style: { transform: 'translate(' + x + 'px,' + (ay - 2) + 'px)', width: (xe - x) + 'px' } });
      }
      dots.push({ id: it.id, it, on: !!pos, style: { transform: 'translate(' + x + 'px,' + ay + 'px)' } });
      if (!pos) continue;
      const top = pos.side === 'a' ? ay - 14 - pos.lane * (h + LANE_GAP) - h : ay + 14 + pos.lane * (h + LANE_GAP);
      const sTop = pos.side === 'a' ? top + h : ay;
      const sH = pos.side === 'a' ? ay - top - h : top - ay;
      placed.push({
        id: it.id, it,
        boxStyle: { transform: 'translate(' + (x - 14) + 'px,' + top + 'px)', width: w + 'px', height: h + 'px' },
        stemStyle: { transform: 'translate(' + x + 'px,' + sTop + 'px)', height: sH + 'px' },
      });
    }
    return { placed, dots, ranges };
  });

  const ticks = computed(() => {
    const s = scale.value, l = left.value, r = l + W.value / s;
    const step = STEPS.find((k) => k * s >= 84) || 2000;
    const out = [];
    const add = (v) => out.push({ v, x: (v - l) * s, label: fmtCont(v) });
    // B.C.E. years n = step, 2·step, ... sit at 1 − n
    for (let n = Math.max(step, Math.ceil((1 - r) / step) * step); 1 - n >= l - step; n += step) if (1 - n <= r) add(1 - n);
    for (let n = Math.max(step, Math.ceil(l / step) * step); n <= r; n += step) add(n);
    if (step === 1 && l <= 1 && r >= 1) add(1);
    return out;
  });
  const eraX = computed(() => {
    const x = (0.5 - left.value) * scale.value;
    return x > -40 && x < W.value + 40 ? x : null;
  });

  const rangeText = computed(() => fmtCont(Math.max(minC, left.value)) + ' – ' + fmtCont(Math.min(maxC, left.value + W.value / scale.value)));
  const countText = computed(() => {
    const inView = (d) => { const x = (d.it.c - left.value) * scale.value; return x >= 0 && x <= W.value; };
    const n = vis.value.dots.filter(inView).length;
    const p = vis.value.placed.filter(inView).length;
    if (n === 0) return 'no dates in view';
    return p >= n ? n + (n === 1 ? ' date' : ' dates') + ' in view, all labelled' : p + ' of ' + n + ' dates labelled';
  });

  // The periods in view. A period counts once a fair part of it, or of the screen, shows it.
  const eras = computed(() => {
    const s = scale.value, l = Math.max(minC, left.value), r = Math.min(maxC, left.value + W.value / s);
    const seen = periods.map((p) => ({ p, px: (Math.min(p.c1, r) - Math.max(p.c0, l)) * s })).filter((o) => o.px > 0);
    const keep = seen.filter((o) => o.px >= Math.min((o.p.c1 - o.p.c0) * s * 0.5, W.value * 0.12));
    if (keep.length) return keep.map((o) => o.p);
    return seen.length ? [seen.reduce((a, b) => (b.px > a.px ? b : a)).p] : [];
  });
  const eraLine = computed(() => {
    const e = eras.value;
    return e.length === 1 ? e[0].title + ' · ' + e[0].yearsText : e.map((p) => p.short).join(' → ');
  });
  const spanText = computed(() => {
    const l = Math.max(minC, left.value), r = Math.min(maxC, left.value + W.value / scale.value);
    return Math.max(1, Math.round(r) - Math.round(l)).toLocaleString('en-US') + ' years in view';
  });
  function toggleInfo() { infoOpen.value = !infoOpen.value; }
  function goEra(p) {
    const s = clampScale((W.value - 96) / Math.max(1, p.c1 - p.c0));
    glide(s, p.c0 - (W.value - (p.c1 - p.c0) * s) / 2 / s);
  }

  // When the view is empty, offer a jump to the nearest date on each side.
  const jump = computed(() => {
    const l = left.value, r = l + W.value / scale.value;
    if (items.some((it) => it.c >= l && it.c <= r)) return null;
    const next = items.find((it) => it.c > r) || null;
    const prev = items.slice().reverse().find((it) => it.c < l) || null;
    return { prev, next };
  });
  function jumpTo(it) { selId.value = it.id; centreOn(it, scale.value); }

  const miniTicks = items.map((it) => ({ id: it.id, pct: 1 + ((it.c - minC) / span) * 98, key: it.importance === 3 }));
  const miniWin = computed(() => {
    const a = Math.max(0, (left.value - minC) / span);
    const b = Math.min(1, (left.value + W.value / scale.value - minC) / span);
    return { left: 1 + a * 98 + '%', width: Math.max(0.6, (b - a) * 98) + '%' };
  });

  const sel = computed(() => (selId.value === null ? null : items[selId.value]));

  // ---- moving around ----
  const clampScale = (s) => Math.min(maxScale, Math.max(minScale.value, s));
  const clampLeft = (l, s) => { const half = W.value / 2 / s; return Math.min(maxC - half, Math.max(minC - half, l)); };
  function set(s, l) { scale.value = clampScale(s); left.value = clampLeft(l, scale.value); }
  function zoomAt(factor, sx) {
    const c = left.value + sx / scale.value;
    const s = clampScale(scale.value * factor);
    set(s, c - sx / s);
  }
  const still = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function glide(s1, l1) {
    cancelAnimationFrame(raf);
    s1 = clampScale(s1); l1 = clampLeft(l1, s1);
    if (still()) return set(s1, l1);
    const s0 = scale.value, c0 = left.value + W.value / 2 / s0, c1 = l1 + W.value / 2 / s1, t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 320), e = 1 - Math.pow(1 - k, 3);
      const s = s0 * Math.pow(s1 / s0, e), c = c0 + (c1 - c0) * e;
      set(s, c - W.value / 2 / s);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function zoomBy(f) { const s = clampScale(scale.value * f), c = left.value + W.value / 2 / scale.value; glide(s, c - W.value / 2 / s); }
  function fit(animate) {
    const s = minScale.value, l = minC - 48 / s;
    animate ? glide(s, l) : (scale.value = s, left.value = l);
  }
  function centreOn(it, s) { glide(s, it.c - W.value / 2 / s); }
  function pick(it) { if (!moved) { selId.value = it.id; infoOpen.value = false; } }
  function step(d) {
    const it = items[Math.min(items.length - 1, Math.max(0, selId.value + d))];
    selId.value = it.id; centreOn(it, scale.value);
  }
  function focusItem(it) { centreOn(it, Math.max(scale.value, 14)); }

  // ---- pointer, wheel, keys ----
  const pts = new Map();
  let pinch = 0;
  function onDown(e) {
    if (e.button) return;
    cancelAnimationFrame(raf);
    if (pts.size === 0) moved = false;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch = Math.hypot(p.x - q.x, p.y - q.y); }
    if (pts.size === 1) {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    }
  }
  function onMove(e) {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    if (pts.size === 1) {
      if (!moved && Math.abs(dx) < 5) return;
      moved = true; dragging.value = true;
      p.x = e.clientX;
      left.value = clampLeft(left.value - dx / scale.value, scale.value);
    } else if (pts.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const box = view.value.getBoundingClientRect();
      if (pinch > 0 && d > 0) zoomAt(d / pinch, (a.x + b.x) / 2 - box.left);
      pinch = d; moved = true;
    }
  }
  function onUp(e) {
    pts.delete(e.pointerId);
    if (pts.size === 0) {
      dragging.value = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }
  }
  function onWheel(e) {
    e.preventDefault();
    cancelAnimationFrame(raf);
    const box = view.value.getBoundingClientRect();
    if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      left.value = clampLeft(left.value + e.deltaX / scale.value, scale.value);
    } else {
      const d = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      zoomAt(Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX - box.left);
    }
  }
  function onDbl(e) {
    if (e.target.closest('.card, .dot')) return;
    const box = view.value.getBoundingClientRect(), sx = e.clientX - box.left;
    const c = left.value + sx / scale.value, s = clampScale(scale.value * 2.2);
    glide(s, c - W.value / 2 / s);
  }
  function onKey(e) {
    if (e.key === 'Escape') { if (infoOpen.value) infoOpen.value = false; else selId.value = null; return; }
    if (e.target.closest && e.target.closest('.panel')) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      glide(scale.value, left.value + (k === 'ArrowLeft' ? -1 : 1) * W.value * 0.25 / scale.value);
    } else if (k === '+' || k === '=') zoomBy(1.8);
    else if (k === '-' || k === '_') zoomBy(1 / 1.8);
    else if (k === '0') fit(true);
    else return;
    e.preventDefault();
  }
  function miniDown(e) {
    const go = (ev) => {
      const box = mini.value.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, ((ev.clientX - box.left) / box.width - 0.01) / 0.98));
      left.value = clampLeft(minC + pct * span - W.value / 2 / scale.value, scale.value);
    };
    const end = () => { window.removeEventListener('pointermove', go); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
    cancelAnimationFrame(raf);
    go(e);
    window.addEventListener('pointermove', go);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  let ro = null;
  function measure(first) {
    const box = view.value.getBoundingClientRect();
    if (!box.width) return;
    const centre = left.value + W.value / 2 / scale.value;
    const wasFit = first || scale.value <= minScale.value * 1.001;
    W.value = box.width; H.value = box.height;
    if (wasFit) fit(false); else set(scale.value, centre - W.value / 2 / scale.value);
  }
  onMounted(() => {
    measure(true);
    // Opened from the Kings and Prophets page with a year: go to the nearest date and select it.
    if (props.focusYear !== null && props.focusYear !== undefined) {
      const target = cont(props.focusYear);
      const it = items.reduce((best, d) => (Math.abs(d.c - target) < Math.abs(best.c - target) ? d : best), items[0]);
      const s = clampScale(3);
      selId.value = it.id;
      set(s, it.c - W.value / 2 / s);
      if (props.openInfo) { selId.value = null; infoOpen.value = true; }
    }
    view.value.addEventListener('wheel', onWheel, { passive: false });
    if (window.ResizeObserver) { ro = new ResizeObserver(() => measure(false)); ro.observe(view.value); }
    else window.addEventListener('resize', () => measure(false));
  });
  onBeforeUnmount(() => { if (ro) ro.disconnect(); cancelAnimationFrame(raf); });

  return {
    view, mini, items, scale, minScale, maxScale, mode, modeName, axisY, vis, ticks, eraX, rangeText, countText,
    miniTicks, miniWin, sel, selId, dragging, jump, jumpTo, infoOpen, eras, eraLine, spanText, toggleInfo, goEra,
    zoomBy, fit, pick, step, focusItem, onDown, onDbl, onKey, miniDown,
  };
}

export default { components: { Related }, props: { focusYear: { type: Number, default: null }, openInfo: { type: Boolean, default: false } }, setup };
</script>

<style>
/* Layout: one screen. Header, the zoomable view (axis through the middle, labels in lanes above and below), overview strip, details panel. */
:root {
  --bg: #f3f5f8; --surface: #ffffff; --ink: #172033; --muted: #5a6577; --line: #d3d9e3; --grid: #e4e8ef;
  --accent: #0d6e7a; --accent-soft: #dff0f2; --key: #b4530a; --key-soft: #fbead7; --shadow: 0 1px 2px rgba(23, 32, 51, .08), 0 4px 14px rgba(23, 32, 51, .06);
  --font-head: "Space Grotesk", "Segoe UI", system-ui, sans-serif;
  --font-body: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0f131b; --surface: #182030; --ink: #e7ebf3; --muted: #9ba6b9; --line: #2c3649; --grid: #1c2433;
    --accent: #56c7d2; --accent-soft: #143840; --key: #f2ad55; --key-soft: #40290f; --shadow: 0 1px 2px rgba(0, 0, 0, .4), 0 4px 14px rgba(0, 0, 0, .3);
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #0f131b; --surface: #182030; --ink: #e7ebf3; --muted: #9ba6b9; --line: #2c3649; --grid: #1c2433;
  --accent: #56c7d2; --accent-soft: #143840; --key: #f2ad55; --key-soft: #40290f; --shadow: 0 1px 2px rgba(0, 0, 0, .4), 0 4px 14px rgba(0, 0, 0, .3);
  color-scheme: dark;
}
html, body { height: 100%; }
body { background: var(--bg); color: var(--ink); font-family: var(--font-body); font-size: 14px; line-height: 1.45; overflow: hidden; }
#app { height: 100%; }
.app { height: 100%; display: flex; flex-direction: column; position: relative; }
button { font: inherit; color: inherit; }

.bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding-block: 12px 10px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.ttl { min-width: 0; flex: 1 1 240px; }
.eraline { display: flex; align-items: baseline; gap: 8px; max-width: 100%; margin: 5px 0 0; padding: 3px 9px 3px 8px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); font-size: 12.5px; cursor: pointer; text-align: left; }
.eraline:hover, .eraline[aria-expanded="true"] { border-color: var(--accent); }
.eraline:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.eraline b { flex: none; font-weight: 600; color: var(--accent); }
.eraline b::before { content: "i"; display: inline-grid; place-items: center; width: 14px; height: 14px; margin-right: 6px; border-radius: 50%; background: var(--accent); color: var(--surface); font-family: var(--font-head); font-size: 10px; font-weight: 600; vertical-align: 1px; }
.eraline span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
h1 { font-family: var(--font-head); font-size: 20px; font-weight: 600; letter-spacing: -.01em; margin: 0; text-wrap: balance; }
.sub { margin: 2px 0 0; color: var(--muted); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.sep { margin: 0 4px; }
.ctl { display: flex; align-items: center; gap: 6px; }
.lvl { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); background: var(--accent-soft); padding: 4px 9px; border-radius: 999px; margin-right: 4px; white-space: nowrap; }
.btn { min-width: 34px; height: 34px; padding: 0 8px; border: 1px solid var(--line); background: var(--surface); border-radius: 8px; font-size: 17px; line-height: 1; cursor: pointer; }
.btn.wide { font-size: 13px; padding: 0 12px; font-weight: 500; }
.btn.nav { display: inline-flex; align-items: center; box-sizing: border-box; color: inherit; text-decoration: none; white-space: nowrap; }
.btn:hover:not(:disabled) { border-color: var(--accent); }
.btn:disabled { opacity: .4; cursor: default; }
.btn:focus-visible, .card:focus-visible, .view:focus-visible, .dot:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.view { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; background: var(--surface); border-block: 1px solid var(--line); cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.view.drag { cursor: grabbing; }
.grid { position: absolute; top: 0; bottom: 0; left: 0; width: 0; border-left: 1px solid var(--grid); }
.grid span { position: absolute; bottom: 5px; left: 6px; font-size: 11px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.era { position: absolute; top: 0; bottom: 0; left: 0; width: 0; border-left: 1px dashed var(--muted); }
.era span { position: absolute; top: 8px; font-size: 10.5px; font-weight: 600; letter-spacing: .08em; color: var(--muted); white-space: nowrap; }
.era span:first-child { right: 7px; }
.era span:last-child { left: 6px; }
.axis { position: absolute; left: 0; right: 0; height: 2px; margin-top: -1px; background: var(--ink); opacity: .55; }
.rng { position: absolute; left: 0; top: 0; height: 4px; border-radius: 2px; background: var(--accent); opacity: .7; }
.stem { position: absolute; left: 0; top: 0; width: 1px; background: var(--accent); opacity: .55; }
.stem.key { background: var(--key); }

.dot { position: absolute; left: 0; top: 0; width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px; padding: 0; border: 1.5px solid var(--surface); border-radius: 50%; background: var(--muted); cursor: pointer; box-sizing: border-box; }
.dot::after { content: ""; position: absolute; inset: -8px; }
.dot.on { width: 11px; height: 11px; margin: -5.5px 0 0 -5.5px; background: var(--accent); z-index: 2; }
.dot.key { background: var(--key); }
.dot.sel { box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px var(--ink); z-index: 3; }

.card { position: absolute; left: 0; top: 0; box-sizing: border-box; display: flex; text-align: left; padding: 0; overflow: hidden;
  background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 6px; box-shadow: var(--shadow); cursor: pointer; animation: appear .18s ease-out; }
.tx { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: 6px 9px; }
.th { flex: none; width: 100px; height: 100%; max-width: 38%; object-fit: cover; pointer-events: none; background: var(--grid); }
.card.key { border-left-color: var(--key); }
.card.sel { border-color: var(--ink); border-left-color: var(--ink); }
.card:hover { border-color: var(--accent); }
.card.key:hover { border-color: var(--key); }
.yr { font-family: var(--font-head); font-weight: 600; font-size: 13px; white-space: nowrap; font-variant-numeric: tabular-nums; flex: none; }
.yr i { font-style: normal; font-family: var(--font-body); font-weight: 500; font-size: 10.5px; color: var(--muted); margin-left: 6px; }
.key .yr { color: var(--key); }
.tt, .ev { font-size: 12px; line-height: 1.35; color: var(--ink); display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; min-width: 0; }
.card.chip .tx { flex-direction: row; align-items: center; gap: 7px; padding: 0 8px; }
.card.chip .yr { font-size: 12px; }
.card.chip .yr i { display: none; }
.card.chip .tt { display: block; white-space: nowrap; text-overflow: ellipsis; font-size: 11.5px; color: var(--muted); }
.card.label .tt { -webkit-line-clamp: 2; line-clamp: 2; }
.card.card .tx { gap: 3px; padding: 7px 10px; }
.ev { flex: none; }
.ev.n1 { -webkit-line-clamp: 5; line-clamp: 5; }
.ev.n2 { -webkit-line-clamp: 2; line-clamp: 2; }
.ev + .ev { border-top: 1px solid var(--grid); padding-top: 3px; }
.jump { position: absolute; top: 50%; margin-top: -52px; height: 32px; padding: 0 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); box-shadow: var(--shadow); font-size: 12.5px; font-weight: 500; cursor: pointer; white-space: nowrap; font-variant-numeric: tabular-nums; }
.jump.l { left: max(16px, env(safe-area-inset-left, 0px)); }
.jump.r { right: max(16px, env(safe-area-inset-right, 0px)); }
.jump:hover { border-color: var(--accent); }
.jump:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@keyframes appear { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .card { animation: none; } }

.hint { position: absolute; top: 8px; left: max(16px, env(safe-area-inset-left, 0px)); margin: 0; font-size: 11.5px; color: var(--muted); pointer-events: none; background: var(--surface); padding: 2px 6px; border-radius: 4px; }

.mini { position: relative; flex: none; height: 30px; margin-block: 10px calc(10px + env(safe-area-inset-bottom, 0px)); margin-left: max(16px, env(safe-area-inset-left, 0px)); margin-right: max(16px, env(safe-area-inset-right, 0px));
  background: var(--surface); border: 1px solid var(--line); border-radius: 6px; cursor: pointer; touch-action: none; overflow: hidden; }
.mini i { position: absolute; bottom: 0; width: 1px; height: 9px; background: var(--muted); opacity: .6; }
.mini i.key { height: 17px; background: var(--key); opacity: 1; }
.mini .win { position: absolute; top: 0; bottom: 0; background: var(--accent-soft); border: 1.5px solid var(--accent); border-radius: 4px; box-sizing: border-box; mix-blend-mode: multiply; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .mini .win { mix-blend-mode: screen; } }
:root[data-theme="dark"] .mini .win { mix-blend-mode: screen; }

.panel { position: absolute; z-index: 5; top: 64px; right: max(16px, env(safe-area-inset-right, 0px)); bottom: 62px; width: 340px; max-width: calc(100% - 32px); display: flex; flex-direction: column;
  background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }
.phead { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 14px 10px 16px; border-bottom: 1px solid var(--grid); }
h2 { font-family: var(--font-head); font-size: 22px; font-weight: 600; margin: 0; font-variant-numeric: tabular-nums; }
.tag { display: inline-block; margin-top: 4px; font-size: 10.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--key); background: var(--key-soft); padding: 2px 8px; border-radius: 999px; }
.plist { flex: 1 1 auto; min-height: 0; overflow-y: auto; margin: 0; padding: 12px 16px 12px 34px; display: flex; flex-direction: column; gap: 12px; }
.plist.one { list-style: none; padding-left: 16px; }
.plist li::marker { color: var(--muted); font-variant-numeric: tabular-nums; }
.plist p { margin: 0; max-width: 65ch; }
.pic { display: block; width: 100%; max-height: 220px; object-fit: contain; object-position: left; border-radius: 6px; margin-bottom: 8px; pointer-events: none; }
.plist .src { margin-top: 4px; font-size: 12px; color: var(--muted); }
.ih { font-size: 19px; }
.isub { display: block; margin-top: 3px; font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.ilist { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px 16px 14px; }
.ilist p { margin: 0; max-width: 65ch; }
.ilist .src { margin-top: 4px; font-size: 12px; color: var(--muted); }
.era-card { padding: 12px 0 14px; border-bottom: 1px solid var(--grid); }
.era-card h3 { font-family: var(--font-head); font-size: 16px; font-weight: 600; margin: 0; }
.era-when { font-size: 12.5px; color: var(--key); font-weight: 500; font-variant-numeric: tabular-nums; margin: 1px 0 6px !important; }
.era-act { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.era-act .btn { height: 30px; font-size: 12.5px; }
.ilist > .src { margin-top: 12px; }
.jwpics { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; font-size: 12.5px; }
.jwpics b { flex: 0 0 100%; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.jwpics a { display: inline-block; padding: 3px 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--accent); text-decoration: none; }
.jwpics a::after { content: " ↗"; }
.jwpics a:hover { border-color: var(--accent); }
.jwpics a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.plist .rel-li { list-style: none; margin-left: -18px; }
.plist.one .rel-li { margin-left: 0; }
.plist .rel-li .rel { margin-top: 0; }
.pfoot { display: flex; gap: 6px; padding: 10px 12px; border-top: 1px solid var(--grid); }
.pfoot .btn { flex: 1 1 0; padding: 0 6px; white-space: nowrap; }

@media (max-width: 640px) {
  h1 { font-size: 17px; }
  .lvl { display: none; }
  .hint { display: none; }
  .panel { top: auto; left: 0; right: 0; bottom: 0; width: auto; max-width: none; max-height: 56%; border-radius: 14px 14px 0 0; border-width: 1px 0 0; padding-bottom: env(safe-area-inset-bottom, 0px); }
}
</style>
