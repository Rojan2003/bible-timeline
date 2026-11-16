<!-- Switches between the pages using the address after the #, so no router package is needed.
     #/                     the main timeline
     #/timeline?y=-997      the main timeline, opened on that year (&info=1 also opens "About these years")
     #/kings                the Kings and Prophets page (?sel=k-hezekiah or ?sel=p-isaiah opens one)
     #/t/jesus              one of the topic timelines in src/topics/ (?sel=baptism opens one item) -->
<template>
  <div class="shell">
    <nav class="topnav" aria-label="Timelines">
      <a v-for="p in pages" :key="p.id" :href="p.href" :class="{ on: p.id === route.page }" :aria-current="p.id === route.page ? 'page' : null">{{ p.label }}</a>
    </nav>
    <KingsProphets v-if="route.page === 'kings'" :sel="route.sel" />
    <TopicTimeline v-else-if="topic" :key="topic.id" :topic="topic" :sel="route.sel" />
    <BibleTimeline v-else :key="'t' + route.year + route.info" :focus-year="route.year" :open-info="route.info" />
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import BibleTimeline from './BibleTimeline.vue';
import KingsProphets from './KingsProphets.vue';
import TopicTimeline from './TopicTimeline.vue';
import { pages, topicById } from './topics/index.js';

function read() {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const q = new URLSearchParams(query || '');
  const y = q.get('y');
  const m = /^t\/([\w-]+)/.exec(path);
  const page = path === 'kings' ? 'kings' : m && topicById[m[1]] ? m[1] : 'timeline';
  return { page, sel: q.get('sel'), info: q.get('info') === '1', year: y !== null && y !== '' && !isNaN(+y) ? +y : null };
}

export default {
  components: { BibleTimeline, KingsProphets, TopicTimeline },
  setup() {
    const route = ref(read());
    const topic = computed(() => topicById[route.value.page] || null);
    const onHash = () => { route.value = read(); };
    // Keep the current page's name visible in the strip of links, which scrolls sideways on a phone.
    const showCurrent = () => nextTick(() => {
      const el = document.querySelector('.topnav a.on');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    watch(() => route.value.page, showCurrent);
    onMounted(() => { window.addEventListener('hashchange', onHash); showCurrent(); });
    onBeforeUnmount(() => window.removeEventListener('hashchange', onHash));
    return { route, topic, pages };
  },
};
</script>

<style>
.shell { height: 100%; display: flex; flex-direction: column; }
.shell > .app { flex: 1 1 auto; min-height: 0; height: auto; }
.topnav { flex: none; display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; padding: 8px max(12px, env(safe-area-inset-right, 0px)) 0 max(12px, env(safe-area-inset-left, 0px)); padding-top: max(8px, env(safe-area-inset-top, 0px)); background: var(--bg); }
.topnav::-webkit-scrollbar { display: none; }
.topnav a { flex: none; padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 500; color: var(--muted); text-decoration: none; white-space: nowrap; border: 1px solid transparent; }
.topnav a:hover { color: var(--ink); border-color: var(--line); }
.topnav a.on { color: var(--surface); background: var(--ink); }
.topnav a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
