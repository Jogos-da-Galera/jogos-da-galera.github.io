/**
 * Jogos da Galera — app.js
 * Navegação por hash routing:
 *   #/                    -> página inicial (grid de jogos)
 *   #/jogo/<id>           -> página do jogo (imagem, descrição, categorias)
 *   #/jogar/<id>          -> página de jogo (iframe)
 */

const routes = {
  home: document.getElementById("page-home"),
  game: document.getElementById("page-game"),
  play: document.getElementById("page-play"),
};

let jogos = [];

/** Carrega o descritor de jogos. */
async function init() {
  try {
    const res = await fetch("jogos.json");
    jogos = await res.json();
  } catch (err) {
    console.error("Falha ao carregar jogos.json:", err);
    return;
  }
  renderCategoryFilters();
  window.addEventListener("hashchange", route);
  route();
}

/** Renderiza os chips de filtro de categoria (com "Todas"). */
function renderCategoryFilters() {
  const wrap = document.getElementById("filter-categories");
  const categories = [...new Set(jogos.flatMap((j) => j.categorias ?? []))].sort();
  wrap.innerHTML = "";

  const all = chip("Todas", true);
  wrap.appendChild(all);
  categories.forEach((c) => wrap.appendChild(chip(c)));

  function chip(label, active = false) {
    const el = document.createElement("button");
    el.className = "chip" + (active ? " active" : "");
    el.textContent = label;
    el.dataset.category = label === "Todas" ? "" : label;
    el.addEventListener("click", () => {
      wrap.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      el.classList.add("active");
      applyFilters();
    });
    return el;
  }
}

/** Aplica busca por nome + filtro de categoria no grid. */
function applyFilters() {
  const name = document.getElementById("filter-name").value.trim().toLowerCase();
  const catEl = document.querySelector("#filter-categories .chip.active");
  const category = catEl ? catEl.dataset.category : "";

  const filtered = jogos.filter((j) => {
    const matchName = !name || j.nome.toLowerCase().includes(name);
    const matchCat = !category || (j.categorias ?? []).includes(category);
    return matchName && matchCat;
  });

  renderGrid(filtered);
}

/** Renderiza o grid de tiles. */
function renderGrid(list) {
  const grid = document.getElementById("games-grid");
  const empty = document.getElementById("empty-state");
  grid.innerHTML = "";
  empty.classList.toggle("hidden", list.length > 0);

  list.forEach((jogo) => {
    const tile = document.createElement("a");
    tile.className = "tile";
    tile.href = `#/jogo/${jogo.id}`;

    const img = document.createElement("img");
    img.src = `jogos/${jogo.id}/imagem.svg`;
    img.alt = jogo.nome;
    img.loading = "lazy";

    const body = document.createElement("div");
    body.className = "tile-body";

    const title = document.createElement("h2");
    title.className = "tile-title";
    title.textContent = jogo.nome;

    const cats = document.createElement("div");
    cats.className = "category-chips small";
    (jogo.categorias ?? []).forEach((c) => {
      const el = document.createElement("span");
      el.className = "chip static";
      el.textContent = c;
      cats.appendChild(el);
    });

    body.append(title, cats);
    tile.append(img, body);
    grid.appendChild(tile);
  });
}

/** Mostra a página do jogo (detalhes). */
function showGamePage(id) {
  const jogo = jogos.find((j) => j.id === id);
  if (!jogo) return routeHome();

  document.getElementById("game-title").textContent = jogo.nome;
  const img = document.getElementById("game-image");
  img.src = `jogos/${jogo.id}/imagem.svg`;
  img.alt = `Imagem de ${jogo.nome}`;
  document.getElementById("game-name").textContent = jogo.nome;
  document.getElementById("game-description").textContent = jogo.descricao;

  const cats = document.getElementById("game-categories");
  cats.innerHTML = "";
  (jogo.categorias ?? []).forEach((c) => {
    const el = document.createElement("span");
    el.className = "chip static";
    el.textContent = c;
    cats.appendChild(el);
  });

  document.getElementById("play-btn").href = `#/jogar/${jogo.id}`;
  showPage("game");
}

/** Mostra a página de jogo com iframe. */
function showPlayPage(id) {
  const jogo = jogos.find((j) => j.id === id);
  if (!jogo) return routeHome();
  document.getElementById("game-frame").src = `jogos/${jogo.id}/index.html`;
  showPage("play");
}

function routeHome() {
  applyFilters();
  showPage("home");
}

/** Controla qual seção fica visível e limpa o iframe ao sair. */
function showPage(name) {
  Object.entries(routes).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
  // Limpa o iframe quando saímos da página de jogo (para de rodar)
  const frame = document.getElementById("game-frame");
  if (name !== "play" && frame.src) frame.removeAttribute("src");
  window.scrollTo(0, 0);
}

/** Roteador principal baseado no hash. */
function route() {
  const hash = location.hash || "#/";
  const gameMatch = hash.match(/^#\/jogo\/([a-z0-9-_]+)/);
  const playMatch = hash.match(/^#\/jogar\/([a-z0-9-_]+)/);

  if (gameMatch) showGamePage(gameMatch[1]);
  else if (playMatch) showPlayPage(playMatch[1]);
  else routeHome();
}

// Eventos
document.getElementById("filter-name").addEventListener("input", applyFilters);

document.addEventListener("DOMContentLoaded", init);

// Service Worker: habilita o modo offline e o prompt de instalar (PWA).
// Só registra via HTTPS (ou localhost) e no navegador que suportar.
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.error("Falha ao registrar service worker:", err);
    });
  });
}

// ===== Botão "Instalar app" =====
// - Chrome/Edge: usa o beforeinstallprompt (instala direto)
// - Outros: abre modal com instruções (Android menu, iOS Safari, desktop)
(function setupInstallButton() {
  const btn = document.getElementById("install-btn");
  const modal = document.getElementById("install-modal");
  const closeBtn = document.getElementById("install-modal-close");
  if (!btn || !modal) return;

  let deferredPrompt = null;
  let userDismissed = false;

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS: detecta quando aberto como app na tela de início
      (navigator.standalone === true) ||
      (window.navigator.standalone === true)
    );
  }

  function detectPlatform() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return "ios";
    if (/Android/.test(ua)) return "android";
    return "desktop";
  }

  function openModal() {
    // Mostra apenas as instruções da plataforma detectada
    const platform = detectPlatform();
    modal.querySelectorAll(".install-steps").forEach((el) => el.classList.add("hidden"));
    const section = document.getElementById(`install-steps-${platform}`);
    if (section) section.classList.remove("hidden");
    modal.classList.remove("hidden");
    closeBtn.focus();
  }

  function closeModal() {
    modal.classList.add("hidden");
    btn.focus();
  }

  // Chrome/Edge disparam beforeinstallprompt quando o site é instalável.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!userDismissed && !isStandalone()) {
      btn.classList.remove("hidden");
    }
  });

  // Se o usuário já instalou, esconde o botão
  window.addEventListener("appinstalled", () => {
    btn.classList.add("hidden");
    deferredPrompt = null;
  });

  // Mostra o botão mesmo sem beforeinstallprompt (iOS, Firefox, etc.)
  // para que o usuário ao menos veja as instruções.
  if (!isStandalone()) {
    btn.classList.remove("hidden");
  }

  btn.addEventListener("click", async () => {
    if (deferredPrompt) {
      // Instala direto via API (Chrome/Android, Chrome/desktop)
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        btn.classList.add("hidden");
      } else {
        // Se recusou, esconde o botão e oferece as instruções manuais
        userDismissed = true;
        btn.classList.add("hidden");
      }
      deferredPrompt = null;
    } else {
      openModal();
    }
  });

  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });
})();
