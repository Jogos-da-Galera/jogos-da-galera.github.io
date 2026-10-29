// Service Worker do Jogos da Galera
// Estratégia: precache do shell do site + cache-first para todos os
// recursos locais (cada jogo fica offline depois de ser aberto 1x).

// Aumente o valor a cada vez que o site mudar (novos jogos, css, etc.)
const CACHE_VERSION = "v1";
const CACHE_NAME = `jogos-da-galera-${CACHE_VERSION}`;

// Shell essencial: sem isso nada funciona
const SHELL = [
  "/",
  "index.html",
  "app.js",
  "app.css",
  "jogos.json",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("jogos-da-galera-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navegações: cache-first, com fallback para o index (app de página única)
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        }).catch(() => caches.match("index.html"))
      )
    );
    return;
  }

  // Demais recursos (jogos, imagens, json): cache-first com preenchimento
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
