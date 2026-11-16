// Service worker: makes the site installable and lets it open with no connection.
// - The page itself is fetched fresh when online, so a new version shows up straight away;
//   offline, the last saved copy is used.
// - Scripts, styles, fonts and pictures are answered from the saved copy at once and refreshed
//   in the background.
// Change the name below only if the saved files ever need to be thrown away for everyone.
const CACHE = 'bible-timeline-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
// Match saved files by address only. Some servers add a Vary header that would otherwise make a
// saved script or style look like a different file.
const ANY = { ignoreVary: true };

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const save = (request, response) => {
  if (response && (response.ok || response.type === 'opaque')) {
    const copy = response.clone();
    caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((r) => save(request, r))
        .catch(() => caches.match(request, ANY).then((hit) => hit || caches.match(self.registration.scope, ANY)))
    );
    return;
  }

  event.respondWith(
    caches.match(request, ANY).then((hit) => {
      const fresh = fetch(request).then((r) => save(request, r));
      if (hit) { fresh.catch(() => {}); return hit; }
      return fresh;
    })
  );
});

// The page sends the list of timeline pictures after it loads, so they are all saved for offline
// use, not only the ones that were looked at.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'save' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(data.urls.map((u) =>
      cache.match(u, ANY).then((hit) => hit || fetch(u).then((r) => { if (r.ok) return cache.put(u, r); })).catch(() => {})
    )))
  );
});
