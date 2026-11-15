# Análise do Chess.com — referência para o "Castelo"

> Auditoria executada com **crawl4ai** (extração de conteúdo e IA) e **Playwright** (navegação real,
> captura de tela, extração de tokens CSS computados, responsividade).
> Data: 14/11/2026 · Alvo: `https://www.chess.com/` (desktop 1440×900 e mobile 390×844).

---

## 1. Arquitetura de informação (validada por navegação)

Navbar horizontal **sticky, 48px**, sempre presente, com 6 entradas + utilidades:

| Item | Rota real | Ícone |
|---|---|---|
| Play | `/play` | cavalo |
| Puzzles | `/puzzles` | peça de xadrez |
| Learn | `/learn` | grifo |
| Train | `/train` | alvos |
| Watch | `/watch` | binóculo |
| Community | `/community` | grupo |
| Other | `/other` | reticências |

À direita: **Search** (toggle), **Sign Up** (botão verde), **Log In** (botão neutro), **Help & Support**,
**Change Language**.

Em telas internas, a barra vira **sidebar esquerda fixa (~170px)** com o logo no topo, a lista de ícones
+ rótulo, e no rodapé: Search / Sign Up / Log In / Help & Support / Language.

### Sub-rotas de `/play` (extraídas do DOM)
`/play/online` (rival de nível parecido) · `/play/computer` (bots, Easy→Master) · `/play/coach`
(aprenda jogando) · `/play/online/friend` (convidar amigo) · `/play/online/tournaments` (arena) ·
`/variants` · `/games/archive` (histórico) · `/leaderboard`.

### Formulários
- **Register** (`/register`): "Create Your Chess.com Account" → "Continue with Email" / divisor "OR" /
  Continue with Google / Apple / Phone. **Não há campo de senha no primeiro passo** (o e-mail é o
  identificador; a senha é criada depois).
- **Login** (`/login_and_go`): country code do telefone (+55), campo de telefone, "Remember me",
  "Forgot Password?", botão Log In, divisor OR, login social (Apple/Google/Facebook).
  Existe também `/login` (clássico por e-mail/senha) e `/forgot`.

### Páginas-chave inspecionadas
- `/` — hero "Play Chess Online on the #1 Site!", subtítulo, CTA **Get Started** (verde), tabuleiro
  interativo ao lado, seções em 2 colunas (texto à esquerda, arte/3D à direita).
- `/play` — layout de 3 colunas (rail | tabuleiro | cards "Play Chess").
- `/puzzles` — hero de marketing + tabuleiro de desafio com coordenadas numéricas ("87654321") e
  alerta "When you get a Puzzle wrong, you should always retry it…".
- `/members` — contadores globais (Online / Joined in the past 24 hours / Members), tabela de
  "Titled Players", ranking.
- `/leaderboards` → **404** (rota correta é `/leaderboard`).

---

## 2. Sistema visual (tokens extraídos via `getComputedStyle`)

O site usa **497 custom properties**. A base é uma escala de paleta por família com degraus
25→900 (`--color-{aqua,blue,brown,fuchsia,gold,gray,green,orange,purple,skin}-*`) + transparências
brancas/pretas com alfa.

### Cor semântica (tema escuro, o padrão)
| Token | Valor | Uso |
|---|---|---|
| `--theme-background-color` | `#302E2B` | fundo da página |
| `--color-gray-800` | `#312E2B` | cabeçalho |
| `--color-gray-900` | `#262421` | cards/superfícies |
| `--color-gray-75` | `#F8F8F8` | fundo do tema claro |
| `--color-gray-100` | `#F1F1F1` | overlay (tema claro) |
| `--color-gray-200` | `#E7E6E5` | botão discreto |
| `--color-gray-300` | `#DAD8D6` | borda de superfície (claro) |
| Accent CTA | verde (Sign Up / Get Started) | ação primária |
| `--elevation-foreground` | `0 .1rem 0 rgba(0,0,0,.2)` | cards |
| `--elevation-popover` | `0 .3rem .8rem rgba(0,0,0,.3)` | popovers |
| `--elevation-modal` | `0 .8rem 2.4rem rgba(0,0,0,.65)` | modais |

### Espaçamento (grid de 4px, escala em rem)
`.1 .2 .4 .6 .8 1.2 1.6 2.4 3.2 4 8` → tokens `--space-1 … --space-80`.

### Raios e bordas
`--radius-2 .2rem` · `--radius-3 .3rem` · `--radius-5 .5rem` · `--radius-10 1rem` · `--radius-20 2rem`
`--border-1/2/3/5` = `.1/.2/.3/.5rem`

### Ícones e avatares
`--icon-12 … --icon-64` (1.2 → 6.4rem) · `--avatar-24 … --avatar-160`

### Tipografia
- Corpo: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Helvetica, Arial, sans-serif`, **14px**.
- Display: `"Chess Sans"` (`--font-family-heading`) — sans geométrica bold, usada nos títulos grandes.
- Ícones: `"Chess V3"` (`--font-family-icons`) — fonte de ícones própria (o Chess.com não usa emoji no
  código de produção; os emojis que aparecem nas capturas são o *fallback* do crawler).
- Serifas: nenhuma.

### Movimento
`--motion-snappy 50ms` · `faster .1s` · `fast .15s` · `standard .2s` · `moderate .25s` ·
`steady .3s` · `slow .4s` · `slower .5s` · `crawl .8s` · `linger 5s`
Easings: `out-gentle cubic-bezier(0,0,.2,1)` · `in-out-gentle cubic-bezier(1,.1,.4,1)` ·
`out-dramatic cubic-bezier(.2,1,.3,1)`.

### Tabuleiro
- Renderizado em **`<canvas>`** (chessground), não em DOM — 8×8 desenhado.
- Coordenadas **dentro** das casas: número da linha na casa a8 (topo-esquerda), letra da coluna na
  casa h1 (base-direita).
- Cores padrão (green): clara `#EBECD0`, escura `#739552`; cor de destaque de casa `#FFFF33`.
- Espelho: as coordenadas são invertidas quando o jogador joga de pretas.

---

## 3. Layout

### Desktop (≥1180px) — `/play`
```
┌──────────┬──────────────────────────────┬─────────────────┐
│  RAIL    │  barra do oponente (avatar)   │  "Play Chess"   │
│  170px   │  ┌────────────────────────┐  │  ┌───────────┐  │
│  logo    │  │       TABULEIRO        │  │  │ card 1    │  │
│  nav     │  │      (canvas 8×8)      │  │  ├───────────┤  │
│  ─────   │  └────────────────────────┘  │  │ card 2    │  │
│  search  │  barra do jogador (avatar)    │  ├───────────┤  │
│  Sign Up │                              │  │ card 3    │  │
│  Log In  │                              │  │ ...       │  │
│  help    │                              │  └───────────┘  │
│  lang    │                              │  Game History   │
│          │                              │  Leaderboard    │
└──────────┴──────────────────────────────┴─────────────────┘
```
- Rail: fundo `#211E1B`-escuro, separador vertical de 1px entre rail e conteúdo.
- Cards da coluna direita: superfície `#262421`, raio ~6px, ícone grande à esquerda (48px), título bold
  18px + descrição em 14px cinza, `padding 16px`, gap 8px entre cards.
- Título "Play Chess" com ícone, dentro de um card header.

### Mobile (390px)
- Rail vira **barra superior**: `[☰] [logo]  [Sign Up] [Log In]`.
- Coluna direita vira **stack de largura total**; cards mantêm ícone + título + descrição.
- Tabuleiro fica full-width com as barras de jogador acima/abaixo.

---

## 4. UX e microinterações observadas

- **Tabuleiro é o herói**: a home tem um tabuleiro interativo real (não imagem).
- Coordenadas dentro das casas, com contraste invertido por casa.
- Ações do header sempre no topo à direita; no mobile ficam visíveis sem menu.
- O botão primário é verde filled, o secundário é neutro filled (não há botão "outline" com borda de 1px).
- Estados vazios não são celebratórios: são invitation-to-act ("Play Online — Play vs a person of
  similar skill").
- Cartões de opções: o texto explicativo sempre diz **para quem** é a opção ("Challenge a bot from Easy
  to Master"), não o que ela é.

---

## 5. Pontos fracos observados (oportunidades para o Castelo)

1. `Settings` é profundo e não está na navegação principal.
2. `/leaderboards` retorna **404** — rota inconsistente.
3. A home usa ilustrações 3D pesadas e um bloco de "news" genérico, que competem com o CTA.
4. Não há modo claro/escuro visível na navegação principal (o tema claro existe como tokens).
5. Puzzles e Learn compartilham a mesma estrutura de marketing; a distinção é fraca.
6. O formulário de login prioriza telefone —的一段 desnecessária para quem só quer e-mail.

---

## 6. Decisões de design do "Castelo" (identidade própria)

O Castelo **não copia** o Chess.com: muda o acento (brass/dourado em vez de verde), a paleta de
tabuleiro (nogueira em vez de verde), as fontes (Space Grotesk) e o nome. Herda apenas as **decisões
estruturais** que são boas: grid de 4px, escala de tokens semântica, cabeçalho sticky de 48px,
superfícies separadas por passo de tom (sem sombra em repouso), coordenadas dentro das casas e
cards de opção com "para quem é".

### Plano de design (2 passes)

**1ª passada — tokens**

| Papel | Hex |
|---|---|
| `ground` (fundo da página) | `#1F1C19` |
| `surface` (cards, sidebar) | `#2A2622` |
| `surface-raised` (inputs, hover) | `#332E29` |
| `surface-sunken` (rail, campos) | `#171512` |
| `ink` | `#F4EEE2` |
| `ink-muted` | `#A79C8C` |
| `ink-faint` | `#6E6558` |
| `accent` (brass) | `#D8A33B` |
| `accent-strong` | `#EDBC57` |
| `accent-ink` (texto sobre accent) | `#201A0C` |
| `success` | `#7FB069` |
| `danger` | `#D0603C` |
| `info` (patina) | `#5EA0A8` |

Tabuleiro "Nogueira": clara `#EFE3CB` · escura `#7A5B3C` · coord. clara `#C3AB84` · coord. escura `#F0E6D2`.
Alternativas em Settings: Esmeralda (clássica), Ardósia, Gelo.

**2ª passada — tipo, layout, princípios**
- **Tipo**: Space Grotesk (display, relógio, algarismos tabulares) + pilha de sistema (corpo). 2 fontes.
- **Layout**: 3 colunas em ≥1180px; rail vira barra superior em <768px; o tabuleiro nunca é
  menor que 320px nem maior que 560px.
- **Princípios**:
  1. O tabuleiro é o produto — o resto é moldura.
  2. Sem gradientes, sem emoji, sem sombra em repouso; separação por passo de tom.
  3. Um único acento (brass) reservado a ações.
  4. A notação é elemento visual de primeira classe (algarismos tabulares).
  5. Estados de loading com o formato do conteúdo real (esqueleto do tabuleiro), nunca spinner solto.
