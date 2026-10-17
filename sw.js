/* Cache the public learning hub shell and supplied lessons for offline reading. */
const CACHE_NAME = "ads1-offline-v2";
const BASE = new URL("./", self.location.href);
const SHELL_URLS = [
  "./",
  "./index.html",
  "./styles.css?v=offline-1",
  "./supabase-config.js?v=student-accounts-setup",
  "./arena-core.js?v=arena-1",
  "./arena.js?v=debug-lab-1",
  "./algorithm-bug-lab.js?v=2",
  "./app.js?v=weekly-plan-1",
  "./smart-review.js?v=smart-review-3",
  "./glossary.js?v=3",
  "./focus-timer.js?v=3",
  "./study-plan.js?v=1",
  "./offline.js?v=1",
  "./chapters.json",
  "./CHAPTER1.html?v=dark-audit-1",
  "./CHAPTER2.html?v=dark-audit-1",
  "./assets/university-ouargla-logo.png",
  "./assets/university-ouargla-logo.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("ads1-offline-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== "opaque") await cache.put(request, response.clone());
      return response;
    } catch {
      const saved = await cache.match(request);
      if (saved) return saved;
      if (request.mode === "navigate") {
        const shell = await cache.match(new URL("./", BASE).href) || await cache.match(new URL("./index.html", BASE).href);
        if (shell) return shell;
      }
      return new Response("This page is not available offline yet. Reconnect once to load it.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
