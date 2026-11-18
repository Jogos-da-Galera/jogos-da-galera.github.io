/* Testes das bombas (linha / coluna / 3x3) do Samba da Fruta.
 *
 * Rodar:  node test-bombas.js
 *
 * Carrega o index.html num sandbox Node (vm) com DOM fake e testa a
 * função REAL `cascade()` do jogo — sem browser, sem canvas.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error("script não encontrado no index.html");

// RNG determinístico (mesma sequência toda vez que rodar)
let seed = 987654321;
const MathFake = Object.create(Math);
MathFake.random = function () {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const sandbox = {
  console,
  __SAMBATEST: true,
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  localStorage: { getItem: () => null, setItem: () => {} },
  Math: MathFake,
  document: {
    getElementById: function () {
      return {
        width: 512, height: 704,
        addEventListener: function () {},
        getContext: function () { return {}; }
      };
    }
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: "samba-da-fruta.js" });

const api = sandbox.__samba;
if (!api) throw new Error("hook de teste (__SAMBATEST) não encontrado no jogo");

// ---------------- helpers ----------------
const GRID = 8;
// padrão base sem trios: horizontal difere em 1, vertical difere em 2 (mod 5)
function base(x, y) { return (x + 2 * y) % 5; }

function buildBoard(overrides) {
  const g = [];
  for (let y = 0; y < GRID; y++) {
    g[y] = [];
    for (let x = 0; x < GRID; x++) g[y][x] = api.newPiece(base(x, y), y, x);
  }
  for (const o of overrides) {
    const x = o[0], y = o[1], t = o[2], opts = o[3];
    g[y][x] = api.newPiece(t, y, x, opts);
  }
  return g;
}

function runsOf() {
  return api.findRuns().map(r =>
    r.h ? "h y=" + r.y + " x=" + r.x + " n=" + r.n
        : "v x=" + r.x + " y=" + r.y + " n=" + r.n
  ).sort();
}
function expectRuns(expected, label) {
  const got = runsOf().join("|");
  const exp = expected.slice().sort().join("|");
  if (got !== exp) throw new Error("setup " + label + ": runs " + got + " (esperado " + exp + ")");
}

function isPopped(g, x, y) { const p = g[y] && g[y][x]; return !!(p && p.pop); }
function rowPopped(g, y) { for (let x = 0; x < GRID; x++) if (!isPopped(g, x, y)) return false; return true; }
function colPopped(g, x) { for (let y = 0; y < GRID; y++) if (!isPopped(g, x, y)) return false; return true; }
function poppedSet(g) {
  const s = {};
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (isPopped(g, x, y)) s[x + "," + y] = 1;
  return s;
}
function sameSet(a, b) {
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i]);
}
function lineSet(y) { const s = {}; for (let x = 0; x < GRID; x++) s[x + "," + y] = 1; return s; }
function colSet(x) { const s = {}; for (let y = 0; y < GRID; y++) s[x + "," + y] = 1; return s; }
function union(a, b) { const s = Object.assign({}, a); for (const k in b) s[k] = 1; return s; }

// ---------------- runner ----------------
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("PASS  " + name); }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); }
}

// ---------------- cenários ----------------

test("bomba de linha (trio): explode a linha inteira, só ela", () => {
  const g0 = buildBoard([
    [1, 2, 3], [6, 2, 3],
    [2, 2, 0], [3, 2, 0, { isB: "row" }], [4, 2, 0]
  ]);
  api.setGrid(g0);
  expectRuns(["h y=2 x=2 n=3"], "bomba de linha");
  api.cascade(1);
  const g = api.getGrid();
  if (!rowPopped(g, 2)) throw new Error("linha 2 não foi toda limpa");
  if (Object.keys(poppedSet(g)).length !== 8) throw new Error("limparam células fora da linha");
});

test("bomba de coluna (trio): explode a coluna inteira, só ela", () => {
  const g0 = buildBoard([
    [3, 1, 3],
    [3, 2, 0], [3, 3, 0, { isB: "col" }], [3, 4, 0]
  ]);
  api.setGrid(g0);
  expectRuns(["v x=3 y=2 n=3"], "bomba de coluna");
  api.cascade(1);
  const g = api.getGrid();
  if (!colPopped(g, 3)) throw new Error("coluna 3 não foi toda limpa");
  if (Object.keys(poppedSet(g)).length !== 8) throw new Error("limparam células fora da coluna");
});

test("bomba de linha na borda esquerda: linha inteira explode", () => {
  const g0 = buildBoard([
    [0, 4, 0, { isB: "row" }], [1, 4, 0], [2, 4, 0]
  ]);
  api.setGrid(g0);
  expectRuns(["h y=4 x=0 n=3"], "bomba na borda");
  api.cascade(1);
  const g = api.getGrid();
  if (!rowPopped(g, 4)) throw new Error("linha 4 (borda) não foi toda limpa");
  if (Object.keys(poppedSet(g)).length !== 8) throw new Error("limparam células fora da linha");
});

test("dois trios? não — dois tipos de bomba no MESMO trio: as duas explodem", () => {
  const g0 = buildBoard([
    [5, 5, 1],
    [2, 5, 0, { isB: "row" }], [3, 5, 0], [4, 5, 0, { isB: "col" }]
  ]);
  api.setGrid(g0);
  expectRuns(["h y=5 x=2 n=3"], "duas bombas no trio");
  api.cascade(1);
  const g = api.getGrid();
  const exp = union(lineSet(5), colSet(4)); // linha 5 + coluna 4
  if (!sameSet(poppedSet(g), exp))
    throw new Error("pop = " + Object.keys(poppedSet(g)).sort() + " esperado " + Object.keys(exp).sort());
});

test("CADEIA: bomba de linha atinge bomba de coluna na linha → coluna dela explode", () => {
  const g0 = buildBoard([
    [1, 3, 0], [2, 3, 0, { isB: "row" }], [3, 3, 0],
    [4, 3, 2], [6, 3, 2, { isB: "col" }]
  ]);
  api.setGrid(g0);
  expectRuns(["h y=3 x=1 n=3"], "cadeia linha+coluna");
  api.cascade(1);
  const g = api.getGrid();
  if (!rowPopped(g, 3)) throw new Error("linha 3 não foi toda limpa");
  if (!colPopped(g, 6)) throw new Error("bomba de coluna em (6,3) atingida pela linha não explodiu sua coluna");
  const exp = union(lineSet(3), colSet(6));
  if (!sameSet(poppedSet(g), exp))
    throw new Error("pop = " + Object.keys(poppedSet(g)).sort() + " esperado " + Object.keys(exp).sort());
});

test("CADEIA: bomba 3x3 atinge bomba de coluna → coluna dela explode", () => {
  const g0 = buildBoard([
    [2, 3, 0], [3, 3, 0, { isB: "blast" }], [4, 3, 0],
    [4, 2, 3, { isB: "col" }]
  ]);
  api.setGrid(g0);
  expectRuns(["h y=3 x=2 n=3"], "cadeia blast+coluna");
  api.cascade(1);
  const g = api.getGrid();
  if (!colPopped(g, 4)) throw new Error("bomba de coluna em (4,2) atingida pelo blast 3x3 não explodiu sua coluna");
  const blast = {};
  for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) blast[x + "," + y] = 1;
  const exp = union(blast, colSet(4));
  if (!sameSet(poppedSet(g), exp))
    throw new Error("pop = " + Object.keys(poppedSet(g)).sort() + " esperado " + Object.keys(exp).sort());
});

test("bomba 3x3 no canto: só as 5 células válidas (recorte pela borda)", () => {
  const g0 = buildBoard([
    [0, 0, 0, { isB: "blast" }], [1, 0, 0], [2, 0, 0]
  ]);
  api.setGrid(g0);
  expectRuns(["h y=0 x=0 n=3"], "blast no canto");
  api.cascade(1);
  const g = api.getGrid();
  const exp = { "0,0": 1, "1,0": 1, "2,0": 1, "0,1": 1, "1,1": 1 };
  if (!sameSet(poppedSet(g), exp))
    throw new Error("pop = " + Object.keys(poppedSet(g)).sort() + " esperado " + Object.keys(exp).sort());
});

test("quarteto SEM bomba: cria 1 bomba (row/col) e limpa só o quarteto", () => {
  const g0 = buildBoard([
    [2, 1, 0], [3, 1, 0], [4, 1, 0], [5, 1, 0]
  ]);
  api.setGrid(g0);
  expectRuns(["h y=1 x=2 n=4"], "quarteto");
  api.cascade(1);
  const g = api.getGrid();
  if (Object.keys(poppedSet(g)).length !== 4) throw new Error("deveria limpar só as 4 células do quarteto");
  const data = api.animData();
  if (!data.creates || data.creates.length !== 1) throw new Error("deveria criar exatamente 1 bomba");
  const c = data.creates[0];
  if (c.y !== 1 || c.x < 2 || c.x > 5) throw new Error("bomba fora do quarteto: " + c.x + "," + c.y);
  if (c.isB !== "row" && c.isB !== "col") throw new Error("tipo inesperado: " + c.isB);
  api.onPopDone();
  const g2 = api.getGrid();
  if (!g2[1][c.x] || g2[1][c.x].isB !== c.isB) throw new Error("bomba criada não apareceu no tabuleiro");
});

test("bomba dentro de quarteto: explode a linha/coluna E vira a bomba nova", () => {
  const g0 = buildBoard([
    [2, 3, 0], [3, 3, 0], [4, 3, 0], [5, 3, 0, { isB: "col" }]
  ]);
  // força a criação de bomba na célula da bomba existente: (0.9 * 4) | 0 = 3
  const origRandom = sandbox.Math.random;
  sandbox.Math.random = () => 0.9;
  try {
    api.setGrid(g0);
    expectRuns(["h y=3 x=2 n=4"], "quarteto com bomba");
    api.cascade(1);
  } finally { sandbox.Math.random = origRandom; }
  const g = api.getGrid();
  const data = api.animData();
  const c = data.creates && data.creates[0];
  if (!c || c.x !== 5 || c.y !== 3) throw new Error("premissa: bomba nova deveria nascer em (5,3)");
  if (!colPopped(g, 5))
    throw new Error("bomba em (5,3) foi substituída sem explodir sua coluna (nada explodiu)");
  const expected = colSet(5); for (let x = 2; x <= 4; x++) expected[x + ",3"] = 1;
  if (!sameSet(poppedSet(g), expected))
    throw new Error("pop = " + Object.keys(poppedSet(g)).sort() + " esperado " + Object.keys(expected).sort());
  api.onPopDone();
  const g2 = api.getGrid();
  // a coluna 5 inteira foi limpa pela própria bomba: a bomba nova nasce lá e
  // cai até o fundo por gravidade — ela só precisa existir na coluna
  let found = false;
  for (let y = 0; y < GRID; y++) if (g2[y][5] && g2[y][5].isB) found = true;
  if (!found) throw new Error("bomba nova não apareceu na coluna 5");
});

// ---------------- resumo ----------------
console.log("\n" + pass + " passaram, " + fail + " falharam.");
process.exit(fail ? 1 : 0);
