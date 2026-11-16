<!-- "At the same time": links from one item to whatever overlaps it in the other timelines. -->
<template>
  <div v-if="groups.length" class="rel">
    <h4>At the same time</h4>
    <div v-for="g in groups" :key="g.label" class="rel-g">
      <b>{{ g.label }}</b>
      <span class="rel-links">
        <a v-for="x in g.items" :key="x.key" :href="x.href">{{ x.name }}</a>
        <i v-if="g.more">+{{ g.more }} more</i>
      </span>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { relatedFor } from './topics/index.js';

export default {
  props: { c0: { type: Number, required: true }, c1: { type: Number, required: true }, selfKey: { type: String, default: '' }, selfTopic: { type: String, default: '' } },
  setup(props) {
    const groups = computed(() => relatedFor(props.c0, props.c1, props.selfKey, props.selfTopic));
    return { groups };
  },
};
</script>

<style>
.rel { margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--grid); }
.rel h4 { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px; }
.rel-g { display: grid; grid-template-columns: 1fr; gap: 3px; margin-bottom: 8px; font-size: 12.5px; }
.rel-g b { font-weight: 600; color: var(--ink); }
.rel-links { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.rel-links a { display: inline-block; padding: 2px 9px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--accent); text-decoration: none; }
.rel-links a:hover { border-color: var(--accent); }
.rel-links a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.rel-links i { font-style: normal; color: var(--muted); font-size: 12px; }
</style>
