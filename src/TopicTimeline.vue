<!-- One zoomable timeline for a topic (life of Jesus, Paul, Bible books, world powers, patriarchs, judges).
     Everything it shows comes from the topic's file in src/topics/. Items with an end year are drawn
     as bars, the rest as dots; names appear as there is room, so more shows as you zoom in. -->
<template>
  <div class="app kp tpc">
    <header class="bar">
      <div class="ttl">
        <h1>{{ topic.title }}</h1>
        <p class="sub">{{ topic.span }} <span class="sep">·</span> {{ countText }}</p>
        <p class="tt-intro">{{ topic.intro }}</p>
      </div>
      <div class="ctl">
        <span class="lvl">{{ levelName }}</span>
        <button id="tt-out" type="button" class="btn" :disabled="scale <= minScale * 1.001" aria-label="Zoom out" @click="zoomBy(1 / 1.8)">−</button>
        <button id="tt-in" type="button" class="btn" :disabled="scale >= maxScale * 0.999" aria-label="Zoom in" @click="zoomBy(1.8)">+</button>
        <button id="tt-fit" type="button" class="btn wide" @click="fit(true)">Show all</button>
      </div>
    </header>

    <div class="kt">
      <div class="kt-view" ref="view" tabindex="0" :class="{ drag: dragging }"
           :aria-label="topic.title + '. Scroll or pinch to zoom, drag to move, arrow keys to pan.'"
           @pointerdown="onDown" @dblclick="onDbl" @keydown="onKey">
        <div v-for="t in ticks" :key="'t' + t.v" class="grid" :style="{ transform: 'translateX(' + t.x + 'px)' }"><span>{{ t.label }}</span></div>
        <div v-for="m in marks" :key="m.label" class="kt-mark tt-mark" :style="{ transform: 'translateX(' + m.x + 'px)' }"><span>{{ m.label }}</span></div>
        <div v-for="l in layout.lanes" :key="'l' + l.id" class="kt-track" :style="{ top: l.top + 'px', height: l.height + 'px' }"></div>

        <button v-for="p in vis" :key="p.d.id" type="button" class="tt-item" :class="[p.d.bar ? 'is-bar' : 'is-dot', 'tone-' + p.tone, { 'is-sel': p.d.id === selId, 'is-key': p.d.rank === 3, named: p.named, inside: p.inside }]"
                :style="p.style" :title="p.d.name + ', ' + p.d.when" :aria-label="p.d.name + ', ' + p.d.when" @click="pick(p.d)">
          <span v-if="p.named" class="tt-name" :style="p.padStyle">{{ p.d.name }}</span>
        </button>

        <div class="kt-gutter tt-gutter">
          <span v-for="l in layout.lanes" :key="l.id" :class="'tone-' + l.tone" :style="{ top: l.top + 'px', height: l.height + 'px' }">{{ l.label }}</span>
        </div>
        <p class="hint">Scroll or pinch to zoom · drag to move · tap an item for details</p>
        <p v-if="topic.note" class="tt-note">{{ topic.note }}</p>
      </div>

      <aside v-if="item" class="panel kt-panel" aria-live="polite">
        <div class="phead">
          <div>
            <h2>{{ item.name }}</h2>
            <p class="kt-when"><span class="kp-kd" :class="'tone-' + laneTone(item)">{{ item.laneLabel }}</span>{{ item.when }}</p>
          </div>
          <button id="tt-close" type="button" class="btn" aria-label="Close details" @click="selId = null">×</button>
        </div>
        <div class="kt-body">
          <p v-if="item.text">{{ item.text }}</p>
          <dl v-if="item.facts" class="tt-facts">
            <template v-for="f in item.facts" :key="f[0]"><dt>{{ f[0] }}</dt><dd>{{ f[1] }}</dd></template>
          </dl>
          <p v-if="item.approx" class="tt-approx">{{ item.approx }}</p>
          <div v-if="item.pictures" class="jwpics">
            <b>Pictures on jw.org</b>
            <a v-for="l in item.pictures" :key="l.url" :href="l.url" target="_blank" rel="noopener">{{ l.title }}</a>
          </div>
          <dl class="kp-meta">
            <template v-if="item.refs"><dt>Scriptures</dt><dd>{{ item.refs }}</dd></template>
            <template v-if="item.sources"><dt>Sources</dt><dd>{{ item.sources }}</dd></template>
          </dl>
          <Related v-if="!item.noCross" :c0="item.c0" :c1="item.c1" :self-key="topic.id + ':' + item.id" :self-topic="topic.id" />
          <div class="tt-refs">
            <b>Where this comes from</b>
            <a v-for="r in topic.references" :key="r.url" :href="r.url" target="_blank" rel="noopener">{{ r.label }}</a>
          </div>
        </div>
        <div class="pfoot">
          <button id="tt-prev" type="button" class="btn wide" :disabled="selIndex === 0" @click="step(-1)">← Earlier</button>
          <button id="tt-zoom" type="button" class="btn wide" @click="focusItem(item)">Zoom here</button>
          <button id="tt-next" type="button" class="btn wide" :disabled="selIndex === ordered.length - 1" @click="step(1)">Later →</button>
        </div>
      </aside>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import Related from './Related.vue';

const RULER = 26;
const LANE_GAP = 12;
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

export default {
  components: { Related },
  props: { topic: { type: Object, required: true }, sel: { type: String, default: null } },
  setup(props) {
    const topic = props.topic;
    const MINC = topic.c0, MAXC = topic.c1;
    const ordered = topic.items.slice().sort((a, b) => a.c0 - b.c0 || (b.bar ? 1 : 0) - (a.bar ? 1 : 0));
    const laneOf = Object.fromEntries(topic.lanes.map((l) => [l.id, l]));

    const view = ref(null);
    const W = ref(1000);
    const H = ref(520);
    const scale = ref(1);
    const left = ref(MINC);
    const selId = ref(null);
    const dragging = ref(false);
    let moved = false;
    let raf = 0;

    const gut = computed(() => (W.value < 560 ? 62 : 92));
    const maxScale = topic.maxScale || 60;
    const minScale = computed(() => (W.value - gut.value - 40) / (MAXC - MINC));
    const levelName = computed(() => {
      const k = Math.log(scale.value / minScale.value) / Math.log(maxScale / minScale.value);
      return k < 0.12 ? 'Overview' : k < 0.6 ? 'Closer' : 'Full detail';
    });

    // Where each lane sits. Row height shrinks a little when there are many rows.
    const layout = computed(() => {
      const total = topic.lanes.reduce((n, l) => n + l.rows, 0);
      const space = H.value - RULER - 50 - (topic.note ? 26 : 8) - LANE_GAP * (topic.lanes.length - 1);
      const rowH = Math.max(18, Math.min(30, Math.floor(space / total)));
      const used = total * rowH + LANE_GAP * (topic.lanes.length - 1);
      let y = Math.max(46, Math.round((H.value - RULER - used) / 2));
      const lanes = topic.lanes.map((l) => { const o = { ...l, top: y, height: l.rows * rowH }; y += o.height + LANE_GAP; return o; });
      return { rowH, lanes, byId: Object.fromEntries(lanes.map((l) => [l.id, l])) };
    });

    // Which row each item sits on and whether its name fits. Like map labels: the most important
    // items claim space first. This depends on the zoom only, so nothing jumps while you pan.
    const packed = computed(() => {
      const s = scale.value;
      const out = [];
      for (const lane of topic.lanes) {
        const rows = Array.from({ length: lane.rows }, () => []);
        const free = (r, a, b) => !rows[r].some((o) => a < o.b + 1 && b > o.a - 1);
        const list = topic.items.filter((d) => d.lane === lane.id).sort((p, q) => (q.rank || 1) - (p.rank || 1) || p.c0 - q.c0);
        for (const d of list) {
          const x = (d.c0 - MINC) * s;
          const w = d.bar ? Math.max((d.c1 - d.c0) * s, 6) : 10;
          const lw = d.name.length * 7.1 + 16;
          const inside = d.bar && w >= lw + 6;
          let named = true, ext = inside ? w : w + lw + 8, row = -1;
          for (let r = 0; r < lane.rows && row < 0; r++) if (free(r, x, x + ext)) row = r;
          if (row < 0) {
            named = inside; ext = w;
            for (let r = 0; r < lane.rows && row < 0; r++) if (free(r, x, x + ext)) row = r;
          }
          if (row < 0) { out.push({ d, x, w, lw, row: -1 }); continue; } // no room at this zoom: it appears as you zoom in
          rows[row].push({ a: x, b: x + ext });
          out.push({ d, x, w, lw, row, named, inside, tone: lane.tone });
        }
      }
      return out;
    });

    const vis = computed(() => {
      const s = scale.value, off = (left.value - MINC) * s, g = gut.value, L = layout.value, bh = L.rowH - 4;
      const out = [];
      for (const p of packed.value) {
        if (p.row < 0 && p.d.id !== selId.value) continue;
        const x = p.x - off;
        if (x + p.w + (p.named && !p.inside ? p.lw : 0) < 0 || x > W.value + 20) continue;
        const top = L.byId[p.d.lane].top + Math.max(0, p.row) * L.rowH + 2;
        const pad = p.inside ? Math.min(Math.max(0, g + 2 - x), p.w - p.lw) : 0;
        out.push({
          d: p.d, named: p.named, inside: p.inside, tone: p.tone,
          style: { transform: 'translate(' + x + 'px,' + top + 'px)', width: p.w + 'px', height: bh + 'px', lineHeight: bh + 'px' },
          padStyle: p.inside ? { paddingLeft: pad + 7 + 'px' } : null,
        });
      }
      return out;
    });

    const ticks = computed(() => {
      const s = scale.value, l = left.value, r = l + W.value / s;
      const step = STEPS.find((k) => k * s >= 84) || 1000;
      const out = [];
      const add = (v, label) => { const x = (v - l) * s; if (x > gut.value + 4 && x < W.value) out.push({ v, x, label }); };
      for (let n = Math.max(step, Math.ceil((1 - r) / step) * step); 1 - n >= l - step; n += step) add(1 - n, n + ' B.C.E.');
      for (let n = Math.max(step, Math.ceil(l / step) * step); n <= r; n += step) add(n, n + ' C.E.');
      if (step === 1 && l <= 1 && r >= 1) add(1, '1 C.E.');
      return out.filter((t, i, a) => a.findIndex((o) => o.v === t.v) === i);
    });
    const marks = computed(() => (topic.marks || []).filter((m) => scale.value >= m.min)
      .map((m) => ({ label: m.label, x: ((m.y < 0 ? m.y + 1 : m.y) + m.f - left.value) * scale.value }))
      .filter((m) => m.x > gut.value && m.x < W.value));

    const countText = computed(() => {
      const off = (left.value - MINC) * scale.value;
      const inView = packed.value.filter((p) => p.x + p.w - off > gut.value && p.x - off < W.value);
      const shown = inView.filter((p) => p.row >= 0).length;
      return shown >= inView.length ? shown + ' items in view' : shown + ' of ' + inView.length + ' shown, zoom in for more';
    });

    const selIndex = computed(() => (selId.value === null ? -1 : ordered.findIndex((d) => d.id === selId.value)));
    const item = computed(() => (selIndex.value < 0 ? null : ordered[selIndex.value]));
    const laneTone = (d) => laneOf[d.lane].tone;

    // ---- moving around ----
    const clampScale = (s) => Math.min(maxScale, Math.max(minScale.value, s));
    const clampLeft = (l, s) => { const half = W.value / 2 / s; return Math.min(MAXC - half, Math.max(MINC - half, l)); };
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
      const s = minScale.value, l = MINC - (gut.value + 16) / s;
      animate ? glide(s, l) : (scale.value = s, left.value = l);
    }
    const mid = (d) => (d.c0 + d.c1) / 2;
    // Zoom far enough that this item and its nearest neighbours in time are spread out.
    function scaleFor(d) {
      if (d.bar) return clampScale(Math.max(scale.value, (W.value * 0.35) / Math.max(d.c1 - d.c0, 1e-4)));
      const i = ordered.indexOf(d);
      const near = ordered.filter((o, j) => !o.bar && j !== i).map((o) => Math.abs(o.c0 - d.c0)).filter((g) => g > 0).sort((a, b) => a - b);
      const gap = near.length ? near[Math.min(1, near.length - 1)] : (MAXC - MINC) / 10;
      return clampScale(Math.max(scale.value, 170 / gap));
    }
    function centre(d, s) { glide(s, mid(d) - W.value / 2 / s); }
    function pick(d) { if (!moved) selId.value = d.id; }
    function step(n) {
      const d = ordered[Math.min(ordered.length - 1, Math.max(0, selIndex.value + n))];
      selId.value = d.id; centre(d, scale.value);
    }
    function focusItem(d) { centre(d, scaleFor(d)); }
    function open(id, animate) {
      const d = ordered.find((o) => o.id === id);
      if (!d) return;
      selId.value = d.id;
      const s = clampScale(Math.max(minScale.value * 1.4, Math.min(scaleFor(d), d.bar ? (W.value * 0.3) / Math.max(d.c1 - d.c0, 1e-4) : scaleFor(d))));
      animate ? centre(d, s) : set(s, mid(d) - W.value / 2 / s);
    }
    watch(() => props.sel, (id) => { if (id) open(id, true); });

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
      if (e.target.closest('.tt-item')) return;
      const box = view.value.getBoundingClientRect(), sx = e.clientX - box.left;
      const c = left.value + sx / scale.value, s = clampScale(scale.value * 2.2);
      glide(s, c - W.value / 2 / s);
    }
    function onKey(e) {
      const k = e.key;
      if (k === 'Escape') { selId.value = null; return; }
      if (k === 'ArrowLeft' || k === 'ArrowRight') glide(scale.value, left.value + (k === 'ArrowLeft' ? -1 : 1) * W.value * 0.25 / scale.value);
      else if (k === '+' || k === '=') zoomBy(1.8);
      else if (k === '-' || k === '_') zoomBy(1 / 1.8);
      else if (k === '0') fit(true);
      else return;
      e.preventDefault();
    }

    let ro = null;
    function measure(first) {
      const box = view.value.getBoundingClientRect();
      if (!box.width) return;
      const c = left.value + W.value / 2 / scale.value;
      const wasFit = first || scale.value <= minScale.value * 1.001;
      W.value = box.width; H.value = box.height;
      if (wasFit) fit(false); else set(scale.value, c - W.value / 2 / scale.value);
    }
    onMounted(() => {
      measure(true);
      if (props.sel) open(props.sel, false);
      view.value.addEventListener('wheel', onWheel, { passive: false });
      if (window.ResizeObserver) { ro = new ResizeObserver(() => measure(false)); ro.observe(view.value); }
    });
    onBeforeUnmount(() => { if (ro) ro.disconnect(); cancelAnimationFrame(raf); });

    return {
      view, topic, ordered, scale, minScale, maxScale, levelName, layout, vis, ticks, marks, countText, dragging,
      selId, selIndex, item, laneTone, zoomBy, fit, pick, step, focusItem, onDown, onDbl, onKey,
    };
  },
};
</script>

<style>
/* Shares the view, gutter and panel styles of KingsTimeline.vue (.kt-*) and the tokens of .kp. */
.tt-intro { margin: 4px 0 0; font-size: 12.5px; color: var(--muted); max-width: 70ch; }
.tpc .kt-gutter { width: 92px; }
.tt-gutter span { padding: 0 6px; text-align: center; line-height: 1.25; box-sizing: border-box; }
.tpc .hint { left: 104px; }
.tt-note { position: absolute; left: 104px; right: 12px; bottom: 30px; margin: 0; font-size: 11.5px; color: var(--muted); pointer-events: none; z-index: 5; }
.tt-mark span { bottom: auto; top: 30px; }

.tone-accent { --tone: var(--judah); --tone-soft: var(--judah-soft); }
.tone-israel { --tone: var(--israel); --tone-soft: var(--israel-soft); }
.tone-key { --tone: var(--key); --tone-soft: var(--key-soft); }
.tt-gutter span, .kt-when .kp-kd[class*="tone-"] { color: var(--tone); }
.kt-when .kp-kd[class*="tone-"] { background: var(--tone-soft); }

.tt-item { position: absolute; left: 0; top: 0; box-sizing: border-box; padding: 0; border: 0; background: none; color: var(--ink); cursor: pointer; text-align: left; font-size: 12.5px; white-space: nowrap; }
.tt-item.is-bar { border-left: 2px solid var(--tone); border-radius: 3px; background: color-mix(in srgb, var(--tone) 22%, var(--surface)); }
.tt-item.is-bar.is-key { background: color-mix(in srgb, var(--tone) 38%, var(--surface)); }
.tt-item.is-bar.inside { overflow: hidden; }
.tt-item.is-dot::before { content: ""; position: absolute; left: 0; top: 50%; width: 9px; height: 9px; margin-top: -4.5px; box-sizing: border-box; border-radius: 50%; background: var(--tone); border: 1.5px solid var(--surface); }
.tt-item.is-dot.is-key::before { width: 11px; height: 11px; margin-top: -5.5px; box-shadow: 0 0 0 2px var(--tone-soft); }
.tt-name { display: block; }
.tt-item.inside .tt-name { font-weight: 600; overflow: hidden; }
.tt-item:not(.inside) .tt-name { position: absolute; left: 100%; top: 0; padding-left: 5px; }
.tt-item.is-dot .tt-name { left: 9px; }
.tt-item.is-key .tt-name { font-weight: 600; }
.tt-item:hover { filter: brightness(.95); }
.tt-item:hover .tt-name { color: var(--tone); }
.tt-item.is-sel { z-index: 3; }
.tt-item.is-bar.is-sel { outline: 2px solid var(--ink); outline-offset: 1px; }
.tt-item.is-dot.is-sel::before { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--ink); }
.tt-item.is-sel .tt-name { font-weight: 600; }
.tt-item:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.tt-facts { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; margin: 10px 0 0; font-size: 13.5px; }
.tt-facts dt { color: var(--muted); }
.tt-facts dd { margin: 0; }
.tt-approx { margin-top: 10px !important; padding: 8px 10px; border-radius: 8px; background: var(--key-soft); font-size: 13px; }
.tt-refs { display: flex; flex-direction: column; gap: 3px; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--grid); font-size: 12.5px; }
.tt-refs b { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
@media (max-width: 640px) {
  .tpc .kt-gutter { width: 62px; }
  .tt-gutter span { font-size: 9px; padding: 0 3px; }
  .tt-note { left: 68px; font-size: 10.5px; }
  .tt-intro { display: none; }
}
</style>
