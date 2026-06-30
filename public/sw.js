// Out Of Sight service worker. Web Push only — caching is out of scope here
// (we lean on Vercel's edge cache for static assets). Keep this file tiny so
// installed PWAs update fast.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = {};
  }
  const title = payload.title || "Out Of Sight";
  const options = {
    body: payload.body || "",
    icon: "/icons/out-of-sight-icon-192.png",
    badge: "/icons/out-of-sight-favicon-96.png",
    tag: payload.tag || "smokey",
    renotify: false,
    data: payload.data || {},
    silent: payload.silent === true,
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Voice readback bridge — broadcast title/body to any open client
      // so it can call speechSynthesis. SW itself can't speak. No-op
      // when no tab is open; the page-side listener gates on the
      // ss_voice_mode localStorage key.
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((wins) => {
          for (const w of wins) {
            try {
              w.postMessage({
                kind: "ss-voice-readback",
                title,
                body: options.body,
              });
            } catch (_) {
              // best-effort
            }
          }
        }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((wins) => {
      const existing = wins.find((c) => c.url.endsWith(url));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    }),
  );
});
