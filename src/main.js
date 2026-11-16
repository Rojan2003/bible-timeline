import { createApp } from 'vue';
import App from './App.vue';
import TIMELINE from './timeline.json';

createApp(App).mount('#app');

// Installable app (PWA): register the service worker in the built site only, so it never gets in
// the way of `npm run dev`. Once it is running, hand it the timeline pictures to save for offline use.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
      const pictures = TIMELINE.flatMap((d) => d.events.flatMap((e) => e.images || []))
        .map((src) => new URL(src, document.baseURI).href);
      // On the very first visit the page loaded before the worker was running, so also pass the
      // page and the files it has already loaded (scripts, styles, fonts).
      const loaded = performance.getEntriesByType('resource').map((r) => r.name)
        .filter((u) => u.startsWith(location.origin) || u.includes('//fonts.g'));
      const urls = [...new Set([location.href.split('#')[0], ...loaded, ...pictures])];
      if (reg.active) reg.active.postMessage({ type: 'save', urls });
    }).catch(() => {});
  });
}
