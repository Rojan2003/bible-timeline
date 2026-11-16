<!-- Switches between the two pages using the address after the #, so no router package is needed.
     #/            the timeline
     #/timeline?y=-997   the timeline, opened on that year
     #/kings       the Kings and Prophets page -->
<template>
  <KingsProphets v-if="route.page === 'kings'" />
  <BibleTimeline v-else :key="'t' + route.year" :focus-year="route.year" />
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import BibleTimeline from './BibleTimeline.vue';
import KingsProphets from './KingsProphets.vue';

function read() {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const y = new URLSearchParams(query || '').get('y');
  return { page: path === 'kings' ? 'kings' : 'timeline', year: y !== null && y !== '' && !isNaN(+y) ? +y : null };
}

export default {
  components: { BibleTimeline, KingsProphets },
  setup() {
    const route = ref(read());
    const onHash = () => { route.value = read(); };
    onMounted(() => window.addEventListener('hashchange', onHash));
    onBeforeUnmount(() => window.removeEventListener('hashchange', onHash));
    return { route };
  },
};
</script>
