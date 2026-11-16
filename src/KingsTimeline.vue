<!-- Zoomable view of the kings and prophets, built to feel like the main timeline.
     Judah's kings run along the top, Israel's along the bottom, the prophets in between.
     More is written on each reign as you zoom in; tap one to open the full details. -->
<template>
  <div class="kt">
    <div class="kt-view" ref="view" tabindex="0" :class="{ drag: dragging }"
         aria-label="Kings and prophets timeline. Scroll or pinch to zoom, drag to move, arrow keys to pan."
         @pointerdown="onDown" @dblclick="onDbl" @keydown="onKey">
      <div v-for="t in ticks" :key="'t' + t.v" class="grid" :style="{ transform: 'translateX(' + t.x + 'px)' }"><span>{{ t.label }}</span></div>
      <div v-for="m in marks" :key="m.y" class="kt-mark" :style="{ transform: 'translateX(' + m.x + 'px)' }"><span>{{ m.label }}</span></div>

      <div class="kt-track" :style="{ top: rows.yJ + 'px' }"></div>
      <div class="kt-track" :style="{ top: rows.yI + 'px' }"></div>

      <div v-for="c in vis.calls" :key="'s' + c.k.id" class="kt-stem" :class="c.k.kingdom" :style="c.stemStyle"></div>
      <button v-for="c in vis.calls" :key="'c' + c.k.id" type="button" tabindex="-1" class="kt-call" :class="[c.k.kingdom, { sel: isSel('king', c.k.id) }]" :style="c.style" @click="pick('king', c.k.id)">
        <i class="kt-dot" :class="'r-' + c.k.reputation"></i>{{ c.k.name }}
      </button>

      <button v-for="b in vis.bars" :key="b.k.id" type="button" class="kt-bar" :class="[b.k.kingdom, { alt: b.k.alt, sel: isSel('king', b.k.id) }]" :style="b.style"
              :title="b.k.name + ', ' + b.k.dates" :aria-label="b.k.name + ', ' + (b.k.kingdom === 'judah' ? 'Judah' : 'Israel') + ', ' + b.k.dates + ', reputation ' + b.k.reputation" @click="pick('king', b.k.id)">
        <span v-if="b.inside" class="kt-lab" :style="b.padStyle">
          <i class="kt-dot" :class="'r-' + b.k.reputation"></i><b>{{ b.k.name }}</b>
          <span v-if="b.showDates" class="kt-d">{{ b.k.dates }}</span>
          <span v-if="b.showRep" class="kt-r" :class="'r-' + b.k.reputation">{{ repName[b.k.reputation] }}</span>
        </span>
      </button>

      <button v-for="p in vis.prophets" :key="p.p.id" type="button" class="kt-pro" :class="{ sel: isSel('prophet', p.p.id), out: !p.inside }" :style="p.style"
              :title="p.p.name + ', ' + p.p.period" :aria-label="'Prophet ' + p.p.name + ', ' + p.p.period" @click="pick('prophet', p.p.id)">
        <span v-if="p.named" :style="p.padStyle">{{ p.p.name }}</span>
      </button>

      <div class="kt-gutter">
        <span :style="{ top: rows.yJ + 'px', height: BAR + 'px' }" class="judah">Judah</span>
        <span :style="{ top: rows.yP + 'px', height: rows.pH + 'px' }" class="prophet">Prophets</span>
        <span :style="{ top: rows.yI + 'px', height: BAR + 'px' }" class="israel">Israel</span>
      </div>

      <div class="kt-tools" @pointerdown.stop @dblclick.stop>
        <span class="lvl">{{ levelName }}</span>
        <button id="kt-out" type="button" class="btn" :disabled="scale <= minScale * 1.001" aria-label="Zoom out" @click="zoomBy(1 / 1.8)">−</button>
        <button id="kt-in" type="button" class="btn" :disabled="scale >= maxScale * 0.999" aria-label="Zoom in" @click="zoomBy(1.8)">+</button>
        <button id="kt-fit" type="button" class="btn wide" @click="fit(true)">Show all</button>
      </div>
      <p class="hint">Scroll or pinch to zoom · drag to move · tap a reign for details</p>
    </div>

    <aside v-if="item" class="panel kt-panel" aria-live="polite">
      <div class="phead">
        <div>
          <h2>{{ item.name }} <small v-if="item.also">{{ item.also }}</small></h2>
          <p class="kt-when">
            <span class="kp-kd" :class="sel.type === 'king' ? item.kingdom : 'prophet'">{{ sel.type === 'king' ? (item.kingdom === 'judah' ? 'King of Judah' : 'King of Israel') : 'Prophet, sent to ' + item.sentTo }}</span>
            {{ sel.type === 'king' ? item.dates + ' · ' + item.reign : item.period }}
          </p>
        </div>
        <button id="kt-close" type="button" class="btn" aria-label="Close details" @click="sel = null">×</button>
      </div>

      <div v-if="sel.type === 'king'" class="kt-body">
        <p class="kp-rep" :class="'r-' + item.reputation"><b>{{ repName[item.reputation] }}</b><span>{{ item.verdict }}</span></p>
        <h4>What happened</h4>
        <p>{{ item.story }}</p>
        <h4>What {{ item.id === 'athaliah' ? 'she' : 'he' }} faced</h4>
        <ul><li v-for="f in item.faced" :key="f">{{ f }}</li></ul>
        <div class="kp-learn"><h4>What we can learn</h4><p>{{ item.learn }}</p></div>
        <p v-if="item.next" class="kp-next"><span aria-hidden="true">→</span>{{ item.next }}</p>
        <dl class="kp-meta">
          <template v-if="item.prophets"><dt>Prophets at the time</dt><dd>{{ item.prophets }}</dd></template>
          <dt>Sources</dt>
          <dd>{{ item.sources }} <span class="sep">·</span> <a :href="insight + item.slug + '/'" target="_blank" rel="noopener">Read on jw.org</a></dd>
        </dl>
        <button type="button" class="kp-link" @click="$emit('story', item.id)">Read this reign in the story →</button>
      </div>
      <div v-else class="kt-body">
        <p class="kt-kings">{{ item.kings }}</p>
        <div class="kp-learn"><h4>The situation when he began</h4><p>{{ item.situation }}</p></div>
        <h4>How he began</h4>
        <p>{{ item.start }}</p>
        <h4>His message</h4>
        <p>{{ item.message }}</p>
        <dl class="kp-meta">
          <dt>Sources</dt>
          <dd>{{ item.sources }} <span class="sep">·</span> <a :href="insight + item.slug + '/'" target="_blank" rel="noopener">Read on jw.org</a></dd>
        </dl>
      </div>

      <div class="pfoot">
        <button id="kt-prev" type="button" class="btn wide" :disabled="selIndex === 0" @click="step(-1)">← Earlier</button>
        <button id="kt-zoom" type="button" class="btn wide" @click="focusItem(item)">Zoom here</button>
        <button id="kt-next" type="button" class="btn wide" :disabled="selIndex === selList.length - 1" @click="step(1)">Later →</button>
      </div>
    </aside>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import DATA from './kings-prophets.json';

const INSIGHT = 'https://www.jw.org/en/library/books/Insight-on-the-Scriptures/';
// Years are negative for B.C.E. The whole view is B.C.E., so there is no year zero to step over.
const MINY = -1005, MAXY = -525;
const RULER = 26;   // year ruler at the bottom
const BAR = 36;     // height of a king's bar
const PLH = 24;     // height of one row of prophets
const PLANES = 5;   // rows of prophets
const CLH = 26;     // height of one row of name tags for reigns too short to write on
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500];
const MARKS = [{ y: -740, short: '740', label: '740 · Samaria falls' }, { y: -607, short: '607', label: '607 · Jerusalem destroyed' }];

const count = { judah: 0, israel: 0 };
const kings = DATA.kings.map((k) => ({ ...k, alt: count[k.kingdom]++ % 2 === 1 }));
const prophets = DATA.prophets.slice().sort((a, b) => a.from - b.from);
const repName = { good: 'Good', mixed: 'Mixed', bad: 'Bad' };
const rank = (k) => (k.reputation === 'bad' ? 0 : 1000) + (k.to - k.from);

export default {
  emits: ['story'],
  setup() {
    const view = ref(null);
    const W = ref(1000);
    const H = ref(520);
    const scale = ref(2);      // px per year
    const left = ref(MINY);    // year at the left edge of the view
    const sel = ref(null);     // { type: 'king' | 'prophet', id }
    const dragging = ref(false);
    let moved = false;
    let raf = 0;

    const gut = computed(() => (W.value < 560 ? 58 : 76)); // width of the strip with the row names
    const maxScale = 70;
    const minScale = computed(() => Math.max(0.3, (W.value - gut.value - 40) / (MAXY - MINY)));
    const levelName = computed(() => (scale.value < minScale.value * 1.5 ? 'Overview' : scale.value < 9 ? 'Reigns' : 'Full detail'));

    // Where each row sits, centred in the space above the ruler.
    const rows = computed(() => {
      const callLanes = H.value < 440 ? 1 : 2;
      const pH = PLANES * PLH;
      const total = callLanes * CLH + 8 + BAR + 14 + pH + 14 + BAR + 8 + callLanes * CLH;
      const top0 = Math.max(40, Math.round((H.value - RULER - total) / 2));
      const yJ = top0 + callLanes * CLH + 8;
      const yP = yJ + BAR + 14;
      const yI = yP + pH + 14;
      return { callLanes, pH, yJ, yP, yI };
    });

    const vis = computed(() => {
      const s = scale.value, l = left.value, g = gut.value, r = rows.value;
      const bars = [], cands = [], calls = [];
      for (const k of kings) {
        const x1 = (k.from - l) * s, x2 = (k.to - l) * s;
        if (x2 < -60 || x1 > W.value + 60) continue;
        const w = Math.max(x2 - x1 - 1, 3);
        const vx1 = Math.max(x1, g + 2), vx2 = Math.min(x1 + w, W.value);
        const avail = vx2 - vx1 - 12;
        const nameW = k.name.length * 7.8 + 22;
        const datesW = k.dates.length * 6.3 + 12;
        const inside = avail >= nameW;
        bars.push({
          k, inside,
          showDates: inside && avail >= nameW + datesW,
          showRep: inside && avail >= nameW + datesW + 64,
          style: { transform: 'translate(' + x1 + 'px,' + (k.kingdom === 'judah' ? r.yJ : r.yI) + 'px)', width: w + 'px' },
          padStyle: { paddingLeft: Math.max(0, vx1 - x1) + 7 + 'px' },
        });
        const cx = x1 + w / 2;
        if (!inside && cx > g + 6 && cx < W.value - 6) cands.push({ k, cx, cw: nameW + 6 });
      }
      // Reigns too short to write on get a name tag outside the bar, if there is room for it.
      const lanes = { judah: [], israel: [] };
      for (const c of cands.sort((p, q) => rank(q.k) - rank(p.k))) {
        const a = Math.max(g + 4, c.cx - c.cw / 2), b = a + c.cw;
        for (let i = 0; i < r.callLanes; i++) {
          const L = lanes[c.k.kingdom][i] || (lanes[c.k.kingdom][i] = []);
          if (L.some((o) => a < o.b + 6 && b > o.a - 6)) continue;
          L.push({ a, b });
          const up = c.k.kingdom === 'judah';
          const top = up ? r.yJ - 8 - 22 - i * CLH : r.yI + BAR + 8 + i * CLH;
          calls.push({
            k: c.k,
            style: { transform: 'translate(' + a + 'px,' + top + 'px)', width: c.cw + 'px' },
            stemStyle: { transform: 'translate(' + c.cx + 'px,' + (up ? top + 22 : r.yI + BAR) + 'px)', height: (up ? r.yJ - top - 22 : top - r.yI - BAR) + 'px' },
          });
          break;
        }
      }
      // Prophets: packed into rows so that bars and their names do not overlap. If the names written
      // beside short bars do not all fit, they are left off until you zoom in.
      const pack = (outsideNames) => {
        const ends = [], list = [];
        for (const p of prophets) {
          const x1 = (p.from - l) * s, w = Math.max((p.to - p.from) * s, 8);
          const lw = p.name.length * 7.2 + 14;
          const vx1 = Math.max(x1, g + 2);
          const inside = Math.min(x1 + w, W.value) - vx1 >= lw;
          const named = inside || outsideNames;
          const end = inside || !named ? x1 + w : x1 + w + lw + 2;
          let lane = ends.findIndex((e) => e <= x1 - 6);
          if (lane < 0) {
            if (ends.length >= PLANES) return null;
            lane = ends.length;
          }
          ends[lane] = end;
          if (end < -20 || x1 > W.value + 20) continue;
          list.push({
            p, inside, named,
            style: { transform: 'translate(' + x1 + 'px,' + (r.yP + lane * PLH + 2) + 'px)', width: w + 'px' },
            padStyle: inside ? { paddingLeft: Math.max(0, vx1 - x1) + 6 + 'px' } : null,
          });
        }
        return list;
      };
      const pro = pack(true) || pack(false) || [];
      return { bars, calls, prophets: pro };
    });

    const ticks = computed(() => {
      const s = scale.value, l = left.value, r = l + W.value / s;
      const step = STEPS.find((k) => k * s >= 84) || 500;
      const out = [];
      for (let n = Math.ceil(-r / step) * step; -n >= l; n += step) {
        const x = (-n - l) * s;
        if (n > 0 && x > gut.value + 4) out.push({ v: -n, x, label: n + ' B.C.E.' });
      }
      return out;
    });
    const marks = computed(() => MARKS.map((m) => ({ y: m.y, label: scale.value < 1.6 ? m.short : m.label, x: (m.y - left.value) * scale.value })).filter((m) => m.x > gut.value && m.x < W.value));

    const selList = computed(() => (sel.value && sel.value.type === 'prophet' ? prophets : kings));
    const selIndex = computed(() => (sel.value ? selList.value.findIndex((d) => d.id === sel.value.id) : -1));
    const item = computed(() => (selIndex.value < 0 ? null : selList.value[selIndex.value]));
    const isSel = (type, id) => !!sel.value && sel.value.type === type && sel.value.id === id;

    // ---- moving around ----
    const clampScale = (s) => Math.min(maxScale, Math.max(minScale.value, s));
    const clampLeft = (l, s) => { const half = W.value / 2 / s; return Math.min(MAXY - half, Math.max(MINY - half, l)); };
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
      const s = minScale.value, l = MINY - (gut.value + 16) / s;
      animate ? glide(s, l) : (scale.value = s, left.value = l);
    }
    const mid = (d) => (d.from + d.to) / 2;
    function pick(type, id) { if (!moved) sel.value = { type, id }; }
    function step(d) {
      const it = selList.value[Math.min(selList.value.length - 1, Math.max(0, selIndex.value + d))];
      sel.value = { type: sel.value.type, id: it.id };
      glide(scale.value, mid(it) - W.value / 2 / scale.value);
    }
    function focusItem(it) {
      const s = clampScale(Math.max(scale.value, Math.min(40, (W.value * 0.35) / Math.max(it.to - it.from, 1))));
      glide(s, mid(it) - W.value / 2 / s);
    }

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
      if (e.target.closest('.kt-bar, .kt-pro, .kt-call')) return;
      const box = view.value.getBoundingClientRect(), sx = e.clientX - box.left;
      const c = left.value + sx / scale.value, s = clampScale(scale.value * 2.2);
      glide(s, c - W.value / 2 / s);
    }
    function onKey(e) {
      const k = e.key;
      if (k === 'Escape') { sel.value = null; return; }
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
      const centre = left.value + W.value / 2 / scale.value;
      const wasFit = first || scale.value <= minScale.value * 1.001;
      W.value = box.width; H.value = box.height;
      if (wasFit) fit(false); else set(scale.value, centre - W.value / 2 / scale.value);
    }
    onMounted(() => {
      measure(true);
      view.value.addEventListener('wheel', onWheel, { passive: false });
      if (window.ResizeObserver) { ro = new ResizeObserver(() => measure(false)); ro.observe(view.value); }
    });
    onBeforeUnmount(() => { if (ro) ro.disconnect(); cancelAnimationFrame(raf); });

    return {
      view, BAR, insight: INSIGHT, repName, scale, minScale, maxScale, levelName, rows, vis, ticks, marks, dragging,
      sel, item, selList, selIndex, isSel, zoomBy, fit, pick, step, focusItem, onDown, onDbl, onKey,
    };
  },
};
</script>

<style>
/* Uses the tokens from BibleTimeline.vue and the .kp colours from KingsProphets.vue. */
.kt { position: relative; flex: 1 1 auto; min-height: 0; display: flex; }
.kt-view { position: relative; flex: 1 1 auto; min-width: 0; overflow: hidden; background: var(--surface); border-top: 1px solid var(--line); cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.kt-view.drag { cursor: grabbing; }
.kt-view:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

.kt-mark { position: absolute; top: 0; bottom: 0; left: 0; width: 0; border-left: 1px dashed var(--key); opacity: .9; }
.kt-mark span { position: absolute; bottom: 30px; left: 6px; font-size: 11px; font-weight: 600; color: var(--key); white-space: nowrap; font-variant-numeric: tabular-nums; background: var(--surface); padding: 1px 4px; border-radius: 4px; }
.kt-track { position: absolute; left: 0; right: 0; height: 36px; background: var(--grid); opacity: .6; }

.kt-bar { position: absolute; left: 0; top: 0; height: 36px; box-sizing: border-box; padding: 0; overflow: hidden; text-align: left; cursor: pointer;
  border: 0; border-left: 2px solid var(--judah); border-radius: 3px; background: var(--judah-soft); color: var(--ink); }
.kt-bar.alt { background: color-mix(in srgb, var(--judah) 30%, var(--surface)); }
.kt-bar.israel { border-left-color: var(--israel); background: var(--israel-soft); }
.kt-bar.israel.alt { background: color-mix(in srgb, var(--israel) 30%, var(--surface)); }
.kt-bar:hover { filter: brightness(.96); }
.kt-bar.sel, .kt-pro.sel, .kt-call.sel { outline: 2px solid var(--ink); outline-offset: 1px; z-index: 3; }
.kt-lab { display: flex; align-items: center; gap: 7px; height: 100%; white-space: nowrap; font-size: 13px; }
.kt-lab b { font-family: var(--font-head); font-weight: 600; }
.kt-d { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.kt-r { font-size: 10px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; }
.kt-r.r-good { color: var(--good); } .kt-r.r-mixed { color: var(--key); } .kt-r.r-bad { color: var(--bad); }
.kt-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--bad); }
.kt-dot.r-good { background: var(--good); } .kt-dot.r-mixed { background: var(--key); }

.kt-call { position: absolute; left: 0; top: 0; height: 22px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 6px; white-space: nowrap; cursor: pointer;
  font-family: var(--font-head); font-size: 12.5px; font-weight: 600; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; box-shadow: var(--shadow); }
.kt-call:hover { border-color: var(--accent); }
.kt-stem { position: absolute; left: 0; top: 0; width: 1px; background: var(--judah); opacity: .6; }
.kt-stem.israel { background: var(--israel); }

.kt-pro { position: absolute; left: 0; top: 0; height: 20px; box-sizing: border-box; padding: 0; border: 0; border-radius: 10px; cursor: pointer; text-align: left;
  background: linear-gradient(90deg, transparent, var(--key-soft) 10px, var(--key-soft) calc(100% - 10px), transparent), color-mix(in srgb, var(--key) 45%, var(--surface)); color: var(--ink); font-size: 12px; font-weight: 500; white-space: nowrap; }
.kt-pro span { display: block; line-height: 20px; overflow: hidden; }
.kt-pro.out span { position: absolute; left: 100%; top: 0; padding-left: 6px; overflow: visible; color: var(--key); font-weight: 600; }
.kt-pro:hover { filter: brightness(.96); }

.kt-gutter { position: absolute; left: 0; top: 0; bottom: 0; width: 76px; background: var(--surface); border-right: 1px solid var(--line); z-index: 4; pointer-events: none; }
.kt-gutter span { position: absolute; left: 0; right: 0; display: flex; align-items: center; justify-content: center; font-size: 10.5px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; }
.kt-gutter .judah { color: var(--judah); } .kt-gutter .israel { color: var(--israel); } .kt-gutter .prophet { color: var(--key); }

.kt-tools { position: absolute; top: 8px; right: max(12px, env(safe-area-inset-right, 0px)); z-index: 5; display: flex; align-items: center; gap: 6px; cursor: default; }
.kt .hint { left: 88px; z-index: 5; }

.kt-panel h2 { font-size: 21px; }
.kt-panel h2 small { font-family: var(--font-body); font-size: 12.5px; font-weight: 400; color: var(--muted); }
.kt-when { margin: 6px 0 0; font-size: 12.5px; color: var(--muted); display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-variant-numeric: tabular-nums; }
.kt-when .kp-kd.israel { color: var(--israel); background: var(--israel-soft); }
.kt-when .kp-kd.prophet { color: var(--key); background: var(--key-soft); }
.kt-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 12px 16px 14px; font-size: 14px; line-height: 1.5; }
.kt-body p { margin: 0; }
.kt-body ul { margin: 0; padding-left: 18px; }
.kt-body .kp-rep { margin-top: 0; flex-direction: column; gap: 2px; }
.kt-body .kp-next { margin: 12px 0 0; }
.kt-body .kp-link { margin-top: 10px; font-size: 13px; font-weight: 500; }
.kt-kings { font-size: 13px; color: var(--muted); margin-bottom: 12px !important; }
@media (min-width: 641px) {
  .kt-panel { top: 52px; bottom: 12px; width: 360px; }
}
@media (max-width: 640px) {
  .kt-gutter { width: 58px; }
  .kt-gutter span { font-size: 9.5px; letter-spacing: .04em; }
  .kt .hint { display: none; }
  .kt .lvl { display: none; }
  .kt-panel { max-height: 62%; }
}
</style>
