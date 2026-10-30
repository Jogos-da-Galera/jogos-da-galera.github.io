// Service Worker do Jogos da Galera
// Estratégia: precache do shell + de TODOS os jogos no install (a lista é
// derivada do jogos.json), e cache-first para o resto dos recursos locais.
// Assim todos os jogos funcionam offline desde a instalação, sem precisar
// abrir cada um uma vez.

// Aumente o valor a cada vez que o site mudar (novos jogos, css, etc.)
const CACHE_VERSION = "v23";
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

// Lista os recursos de todos os jogos lendo o jogos.json.
// Se algo falhar (ex.: offline no momento do install), volta apenas
// ao precache do shell e os jogos continuam sendo cacheados sob demanda.
async function listGameAssets() {
  try {
    const res = await fetch("jogos.json");
    if (!res.ok) return [];
    const jogos = await res.json();
    return jogos.flatMap((j) => [
      `jogos/${j.id}/index.html`,
      `jogos/${j.id}/imagem.svg`,
    ]);
  } catch (err) {
    return [];
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    listGameAssets()
      .then(async (jogos) => {
        const cache = await caches.open(CACHE_NAME);
        // Shell precisa estar completo (senão o app inteiro quebra);
        // um jogo em falta não deve derrubar o install inteiro.
        await cache.addAll(SHELL);
        await Promise.all(jogos.map(async (url) => {
          try {
            const res = await fetch(url);
            if (res && res.status === 200) await cache.put(url, res);
          } catch (err) { /* jogo em falta: fica pra cachear sob demanda */ }
        }));
      })
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
