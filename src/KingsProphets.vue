<!-- Kings and Prophets page. All the text comes from kings-prophets.json next to this file.
     Every king has the same parts (reputation, what happened, what he faced, what we can learn, what came next)
     and every prophet has the same parts (the situation when he began, how he began, his message). -->
<template>
  <div class="app kp">
    <header class="bar">
      <div class="ttl">
        <h1>Kings and Prophets</h1>
        <p class="sub">Judah and Israel <span class="sep">·</span> 997–607 B.C.E.</p>
      </div>
      <div class="ctl">
        <a id="nav-timeline" class="btn wide nav" href="#/">← Timeline</a>
      </div>
    </header>

    <div class="kp-tabrow">
      <div class="kp-tabs" role="tablist" aria-label="View">
        <button id="tab-timeline" type="button" role="tab" :aria-selected="tab === 'timeline'" :class="{ on: tab === 'timeline' }" @click="tab = 'timeline'">Timeline</button>
        <button id="tab-kings" type="button" role="tab" :aria-selected="tab === 'kings'" :class="{ on: tab === 'kings' }" @click="tab = 'kings'">Kings’ story <span>{{ data.kings.length }}</span></button>
        <button id="tab-prophets" type="button" role="tab" :aria-selected="tab === 'prophets'" :class="{ on: tab === 'prophets' }" @click="tab = 'prophets'">Prophets <span>{{ data.prophets.length }}</span></button>
      </div>
    </div>

    <KingsTimeline v-if="tab === 'timeline'" @story="openStory" />

    <div v-else class="kp-scroll" ref="scroller">
      <div class="kp-wrap">

        <!-- ================= KINGS ================= -->
        <template v-if="tab === 'kings'">
          <p class="kp-lead">Read from top to bottom and the reigns follow one another as one story. Each king has the same four parts, and a line at the end of each card leads to the next.</p>

          <div class="kp-filters">
            <div class="kp-group" role="group" aria-label="Kingdom">
              <button v-for="o in kingdomOpts" :key="o.v" type="button" class="kp-chip" :class="[{ on: kingdom === o.v }, o.v]" :aria-pressed="kingdom === o.v" @click="kingdom = o.v">{{ o.label }}</button>
            </div>
            <div class="kp-group" role="group" aria-label="Reputation">
              <button v-for="o in repOpts" :key="o.v" type="button" class="kp-chip" :class="[{ on: rep === o.v }, 'r-' + o.v]" :aria-pressed="rep === o.v" @click="rep = o.v">{{ o.label }}</button>
            </div>
          </div>
          <p class="kp-count">{{ shownText }}</p>

          <nav class="kp-jump" aria-label="Chapters">
            <button v-for="c in chapters" :key="c.id" type="button" :disabled="!c.kings.length" @click="go('ch-' + c.id)"><b>{{ c.id }}</b>{{ c.title }}</button>
          </nav>

          <section v-for="c in chapters" v-show="c.kings.length" :id="'ch-' + c.id" :key="c.id" class="kp-chapter">
            <header class="kp-chead">
              <span class="kp-num">Part {{ c.id }}</span>
              <h2>{{ c.title }}</h2>
              <p class="kp-span">{{ c.span }}</p>
              <p class="kp-intro">{{ c.intro }}</p>
            </header>

            <ol class="kp-list">
              <li v-for="k in c.kings" :id="'k-' + k.id" :key="k.id" class="kp-item" :class="k.kingdom">
                <article class="kp-card">
                  <div class="kp-top">
                    <span class="kp-kd">{{ k.kingdom === 'judah' ? 'Judah' : 'Israel' }}</span>
                    <span class="kp-dates">{{ k.dates }} <span class="sep">·</span> {{ k.reign }}</span>
                  </div>
                  <h3>{{ k.name }} <small v-if="k.also">{{ k.also }}</small></h3>
                  <p class="kp-rep" :class="'r-' + k.reputation"><b>{{ repName[k.reputation] }}</b><span>{{ k.verdict }}</span></p>

                  <h4>What happened</h4>
                  <p>{{ k.story }}</p>

                  <h4>What {{ k.id === 'athaliah' ? 'she' : 'he' }} faced</h4>
                  <ul><li v-for="f in k.faced" :key="f">{{ f }}</li></ul>

                  <div class="kp-learn">
                    <h4>What we can learn</h4>
                    <p>{{ k.learn }}</p>
                  </div>

                  <dl class="kp-meta">
                    <template v-if="k.prophets"><dt>Prophets at the time</dt><dd>{{ k.prophets }}</dd></template>
                    <dt>Sources</dt>
                    <dd>{{ k.sources }} <span class="sep">·</span> <a :href="insight + k.slug + '/'" target="_blank" rel="noopener">Read on jw.org</a></dd>
                  </dl>
                  <a class="kp-tl" :href="'#/timeline?y=' + k.year">See {{ Math.abs(k.year) }} B.C.E. on the timeline →</a>
                </article>
                <p v-if="k.next && !filtered" class="kp-next"><span aria-hidden="true">↓</span>{{ k.next }}</p>
              </li>
            </ol>
          </section>

          <p v-if="!filtered" class="kp-end">{{ data.ending }} <a href="#/timeline?y=-607">Open the timeline at 607 B.C.E. →</a></p>
          <p v-if="!shown" class="kp-empty">No kings match both filters. <button type="button" class="kp-link" @click="kingdom = 'all'; rep = 'all'">Show all kings</button></p>
        </template>

        <!-- ================= PROPHETS ================= -->
        <template v-else>
          <p class="kp-lead">The prophets shown on the chart, in the order they began. Each one has the same three parts, starting with what was going on when he took up the work.</p>

          <ol class="kp-list plain">
            <li v-for="p in data.prophets" :id="'p-' + p.id" :key="p.id" class="kp-item prophet">
              <article class="kp-card">
                <div class="kp-top">
                  <span class="kp-kd">Sent to {{ p.sentTo }}</span>
                  <span class="kp-dates">{{ p.period }}</span>
                </div>
                <h3>{{ p.name }}</h3>
                <p class="kp-kings">{{ p.kings }}</p>

                <div class="kp-learn">
                  <h4>The situation when he began</h4>
                  <p>{{ p.situation }}</p>
                </div>

                <h4>How he began</h4>
                <p>{{ p.start }}</p>

                <h4>His message</h4>
                <p>{{ p.message }}</p>

                <dl class="kp-meta">
                  <dt>Sources</dt>
                  <dd>{{ p.sources }} <span class="sep">·</span> <a :href="insight + p.slug + '/'" target="_blank" rel="noopener">Read on jw.org</a></dd>
                </dl>
              </article>
            </li>
          </ol>
        </template>

        <footer class="kp-refs">
          <h2>Where this comes from</h2>
          <p>Everything on this page was taken from jw.org and wol.jw.org only. Dates follow chart A6, so a few differ by a year from entries on the timeline. The verdict on each king is the Bible’s own. Where a Watchtower article draws a lesson from a king, that lesson is used; for the rest, the lesson is a short summary of the account in <i>Insight on the Scriptures</i>.</p>
          <ul>
            <li v-for="r in data.references" :key="r.label">
              <a v-if="r.url" :href="r.url" target="_blank" rel="noopener">{{ r.label }}</a><template v-else>{{ r.label }}</template>
              <span v-if="r.note" class="kp-note"> ({{ r.note }})</span>
            </li>
          </ul>
        </footer>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue';
import DATA from './kings-prophets.json';
import KingsTimeline from './KingsTimeline.vue';

const INSIGHT = 'https://www.jw.org/en/library/books/Insight-on-the-Scriptures/';

export default {
  components: { KingsTimeline },
  setup() {
    const scroller = ref(null);
    const tab = ref('timeline');
    const kingdom = ref('all');
    const rep = ref('all');

    const kingdomOpts = [{ v: 'all', label: 'Both kingdoms' }, { v: 'judah', label: 'Judah' }, { v: 'israel', label: 'Israel' }];
    const repOpts = [{ v: 'all', label: 'Any reputation' }, { v: 'good', label: 'Good' }, { v: 'mixed', label: 'Mixed' }, { v: 'bad', label: 'Bad' }];
    const repName = { good: 'Good', mixed: 'Mixed', bad: 'Bad' };

    const filtered = computed(() => kingdom.value !== 'all' || rep.value !== 'all');
    const match = (k) => (kingdom.value === 'all' || k.kingdom === kingdom.value) && (rep.value === 'all' || k.reputation === rep.value);
    const chapters = computed(() => DATA.chapters.map((c) => ({ ...c, kings: DATA.kings.filter((k) => k.chapter === c.id && match(k)) })));
    const shown = computed(() => chapters.value.reduce((n, c) => n + c.kings.length, 0));
    const shownText = computed(() => (filtered.value ? 'Showing ' + shown.value + ' of ' + DATA.kings.length + ' rulers' : DATA.kings.length + ' rulers in ' + DATA.chapters.length + ' parts'));

    function go(id) {
      const el = document.getElementById(id);
      const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (el) el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    }
    let jumping = false;
    watch(tab, () => nextTick(() => { if (scroller.value && !jumping) scroller.value.scrollTop = 0; }));
    // From the timeline view: open the story at one king's card.
    function openStory(id) {
      jumping = true;
      kingdom.value = 'all'; rep.value = 'all'; tab.value = 'kings';
      nextTick(() => {
        const el = document.getElementById('k-' + id);
        if (el) el.scrollIntoView({ block: 'start' });
        jumping = false;
      });
    }

    return { data: DATA, insight: INSIGHT, scroller, tab, kingdom, rep, kingdomOpts, repOpts, repName, filtered, chapters, shown, shownText, go, openStory };
  },
};
</script>

<style>
/* Uses the colour and font tokens defined in BibleTimeline.vue, plus a few of its own below. */
.kp { --good: #1b7445; --good-soft: #e1f2e8; --bad: #b0352b; --bad-soft: #fae6e3; --israel: #6a4bb3; --israel-soft: #ece7f8; --judah: var(--accent); --judah-soft: var(--accent-soft); }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .kp { --good: #74d39c; --good-soft: #143521; --bad: #f28f85; --bad-soft: #40201d; --israel: #b9a5f2; --israel-soft: #2a2246; }
}
:root[data-theme="dark"] .kp { --good: #74d39c; --good-soft: #143521; --bad: #f28f85; --bad-soft: #40201d; --israel: #b9a5f2; --israel-soft: #2a2246; }

.kp-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; border-top: 1px solid var(--line); -webkit-overflow-scrolling: touch; }
.kp-wrap { max-width: 760px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right, 0px)) calc(40px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); font-size: 15px; line-height: 1.55; }
.kp a { color: var(--accent); text-underline-offset: 2px; }
.kp .btn.nav { color: inherit; }
.kp button:focus-visible, .kp a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.kp-tabrow { flex: none; padding: 0 max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px)); overflow-x: auto; }
.kp-tabs { display: inline-flex; padding: 3px; gap: 3px; background: var(--grid); border-radius: 10px; }
.kp-tabs button { border: 0; background: none; white-space: nowrap; padding: 7px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; color: var(--muted); }
.kp-tabs button.on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow); }
.kp-tabs span { font-weight: 500; font-size: 12px; color: var(--muted); margin-left: 4px; font-variant-numeric: tabular-nums; }

.kp-lead { margin: 0 0 14px; color: var(--muted); max-width: 62ch; }
.kp-filters { display: flex; flex-wrap: wrap; gap: 8px 18px; }
.kp-group { display: flex; flex-wrap: wrap; gap: 6px; }
.kp-chip { border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 5px 12px; font-size: 13px; font-weight: 500; cursor: pointer; }
.kp-chip:hover { border-color: var(--accent); }
.kp-chip.on { background: var(--ink); border-color: var(--ink); color: var(--surface); }
.kp-count { margin: 10px 0 0; font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }

.kp-jump { display: flex; gap: 6px; margin: 14px -16px 0; padding: 0 16px 6px; overflow-x: auto; scrollbar-width: thin; }
.kp-jump button { flex: none; display: flex; align-items: center; gap: 7px; border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 6px 11px 6px 7px; font-size: 12.5px; cursor: pointer; white-space: nowrap; }
.kp-jump button:hover:not(:disabled) { border-color: var(--accent); }
.kp-jump button:disabled { opacity: .4; cursor: default; }
.kp-jump b { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--key-soft); color: var(--key); font-family: var(--font-head); font-size: 11.5px; }

.kp-chapter { margin-top: 34px; scroll-margin-top: 12px; }
.kp-chead { margin-bottom: 16px; }
.kp-num { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--key); }
.kp h2 { font-family: var(--font-head); font-size: 23px; font-weight: 600; letter-spacing: -.01em; margin: 2px 0 0; text-wrap: balance; }
.kp-span { margin: 2px 0 0; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.kp-intro { margin: 8px 0 0; max-width: 62ch; }

/* The story line: a spine down the left with a dot for each ruler. */
.kp-list { list-style: none; margin: 0; padding: 0 0 0 22px; position: relative; }
.kp-list::before { content: ""; position: absolute; left: 5px; top: 6px; bottom: 6px; width: 2px; background: var(--line); border-radius: 1px; }
.kp-item { position: relative; padding-bottom: 14px; scroll-margin-top: 12px; }
.kp-item::before { content: ""; position: absolute; left: -22px; top: 20px; width: 12px; height: 12px; box-sizing: border-box; border-radius: 50%; background: var(--surface); border: 3px solid var(--judah); }
.kp-item.israel::before { border-color: var(--israel); }
.kp-item.prophet::before { border-color: var(--key); }

.kp-card { background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--judah); border-radius: 10px; padding: 14px 16px 14px; box-shadow: var(--shadow); }
.israel .kp-card { border-left-color: var(--israel); }
.prophet .kp-card { border-left-color: var(--key); }
.kp-top { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
.kp-kd { font-size: 10.5px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--judah); background: var(--judah-soft); padding: 2px 8px; border-radius: 999px; }
.israel .kp-kd { color: var(--israel); background: var(--israel-soft); }
.prophet .kp-kd { color: var(--key); background: var(--key-soft); }
.kp-dates { font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.kp h3 { font-family: var(--font-head); font-size: 20px; font-weight: 600; margin: 6px 0 0; }
.kp h3 small { font-family: var(--font-body); font-size: 13px; font-weight: 400; color: var(--muted); margin-left: 4px; }
.kp-kings { margin: 2px 0 0; font-size: 13px; color: var(--muted); }

.kp-rep { display: flex; align-items: baseline; gap: 10px; margin: 10px 0 0; padding: 8px 10px; border-radius: 8px; font-size: 13.5px; line-height: 1.45; }
.kp-rep b { flex: none; font-size: 11px; letter-spacing: .07em; text-transform: uppercase; }
.kp-rep.r-good { background: var(--good-soft); } .kp-rep.r-good b { color: var(--good); }
.kp-rep.r-mixed { background: var(--key-soft); } .kp-rep.r-mixed b { color: var(--key); }
.kp-rep.r-bad { background: var(--bad-soft); } .kp-rep.r-bad b { color: var(--bad); }

.kp h4 { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 14px 0 3px; }
.kp-card p { margin: 0; max-width: 68ch; }
.kp-card ul { margin: 0; padding-left: 18px; }
.kp-card li { margin: 1px 0; }
.kp-learn { margin-top: 14px; padding: 10px 12px; border-radius: 8px; background: var(--bg); border: 1px solid var(--grid); }
.kp-learn h4 { margin-top: 0; color: var(--ink); }
.kp-meta { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 14px 0 0; padding-top: 10px; border-top: 1px solid var(--grid); font-size: 12.5px; color: var(--muted); }
.kp-meta dt { font-weight: 600; white-space: nowrap; }
.kp-meta dd { margin: 0; min-width: 0; }
.kp-tl { display: inline-block; margin-top: 8px; font-size: 13px; font-weight: 500; }
.kp-next { display: flex; gap: 8px; margin: 12px 0 0 2px; font-style: italic; color: var(--muted); max-width: 62ch; }
.kp-next span { font-style: normal; color: var(--key); font-weight: 600; }
.kp-end { margin: 18px 0 0; padding: 12px 14px; border-radius: 10px; background: var(--key-soft); max-width: none; }
.kp-empty { margin: 24px 0 0; color: var(--muted); }
.kp-link { border: 0; background: none; padding: 0; color: var(--accent); text-decoration: underline; cursor: pointer; }
.kp-list.plain { margin-top: 4px; }

.kp-refs { margin-top: 44px; padding-top: 18px; border-top: 1px solid var(--line); font-size: 13px; color: var(--muted); }
.kp-refs h2 { font-size: 15px; color: var(--ink); margin: 0 0 6px; }
.kp-refs p { margin: 0 0 8px; max-width: 70ch; }
.kp-refs ul { margin: 0; padding-left: 18px; }
.kp-refs li { margin: 3px 0; }

@media (max-width: 640px) {
  .kp-wrap { font-size: 14.5px; }
  .kp h2 { font-size: 20px; }
  .kp h3 { font-size: 18px; }
  .kp-rep { flex-direction: column; gap: 2px; }
  .kp-meta { grid-template-columns: 1fr; }
  .kp-meta dd { margin-bottom: 4px; }
}
</style>
