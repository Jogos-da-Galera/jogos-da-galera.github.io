# AGENTS.md — Jogos da Galera

Plataforma de jogos (clássicos e novos), 100% gratuita e sem propagandas.
Site estático, sem build, sem dependências — apenas HTML, CSS, JS vanilla e JSON.

## Como rodar

Por usar `fetch("jogos.json")`, precisa ser servido por HTTP (não funciona via `file://`):

```bash
# em algum terminal, na raiz do projeto:
python3 -m http.server 8000
# depois abra http://localhost:8000
```

## Estrutura

```
/
├── index.html        # página única com 3 "views" (home, detalhes, jogar)
├── app.js            # roteador + renderização da aplicação
├── app.css           # estilo (vibrante, jovem, tons de roxo)
├── jogos.json        # descritor dos jogos (array)
└── jogos/
    └── <id>/         # um pasta por jogo (id padrão posix)
        ├── index.html   # o payload do jogo
        └── imagem.svg   # thumbnail / imagem do jogo
```

## Roteamento (hash routing, em `app.js`)

| Rota | Página |
|---|---|
| `#/` | Grid de jogos com busca por nome e filtro por categoria (chips) |
| `#/jogo/<id>` | Página do jogo: imagem grande, descrição, categorias, botão **Jogar** |
| `#/jogar/<id>` | Barra fixa no topo ("🎮 Jogos da Galera" + voltar) e `<iframe>` rodando o jogo |

O iframe carrega `jogos/<id>/index.html` e usa `sandbox="allow-scripts allow-pointer-lock"`.
Ao sair da página de jogo o `src` do iframe é removido para parar o jogo.

## Formato de `jogos.json`

Array de objetos:

```json
{
  "id": "minhoquinha",
  "nome": "Minhoquinha",
  "descricao": "texto usado na página principal",
  "categorias": ["Arcade", "Clássicos"]
}
```

- `id`: padrão posix, vira a pasta `jogos/<id>/` — sem acentos/maiúsculas.
- As categorias dos chips de filtro são derivadas automaticamente do JSON.

## Como adicionar um novo jogo

1. Adicione o objeto em `jogos.json` (com `id`, `nome`, `descricao`, `categorias`).
2. Crie a pasta `jogos/<id>/`.
3. Coloque lá o `index.html` do jogo (autocontido, roda sozinho) e o `imagem.svg` (idealmente 480×300, proporção 8:5, que é a do grid).

Não é preciso mexer em `index.html`/`app.js` — tudo é gerado a partir do JSON.

## Jogo de demonstração

`jogos/minhoquinha/` — snake clássico em canvas:

- Setas / WASD para mover, espaço/enter para reiniciar, clique para reiniciar após game over.
- Controles touch (botões + swipe) para mobile.
- Acelera a cada maçã; recorde salvo em `localStorage` (chave `minhoquinha-high`).
