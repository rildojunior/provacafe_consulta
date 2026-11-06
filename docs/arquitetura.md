# Arquitetura

PWA mobile-first em **HTML, CSS e JavaScript puros** — sem build, sem bundler, sem dependências npm. Tudo roda direto no navegador. Não criar `package.json` nem ferramentas de build.

## Arquivos

```
index.html      — estrutura: cabeçalho, lista de cards, sheets de detalhes e de configuração
script.js       — toda a lógica (~1100 linhas, dividida em seções com cabeçalho ═══)
styles.css      — estilos; cores em variáveis CSS no :root e em [data-theme="dark"]
sw.js           — service worker (cache offline)
manifest.json   — configuração do PWA (nome, ícones, cores, standalone)
assets/icons/   — favicon.svg, ícones PNG 180/192/512 e maskable-512
CNAME           — domínio do GitHub Pages: provacafe-consulta.rildo.dev
docs/           — esta documentação
```

### Seções de `script.js` (na ordem do arquivo)

| Seção | Funções principais |
|-------|--------------------|
| Configuração | `CONFIG`, `getSavedConfig`, `saveConfig`, `clearConfig` |
| Estado global | objeto `state` (abas, linhas, linhas filtradas, cabeçalhos, filtros, termo de busca) |
| Inicialização | `init` — tema, verifica config, carrega abas ou mostra boas-vindas |
| Google Sheets API | `loadSheets`, `loadSheetData`, `updateLastUpdated`, `loadBoldColumn` |
| Abas | `renderSheetTabs`, `selectSheet` |
| Filtros | `buildFilterUI`, `updateFilterBadge` |
| Busca e filtros | `normalizeSearch`, `prefixEditDistance`, `maxTypos`, `fuzzyMatch`, `applyFilters` |
| Copiar card | `copyToClipboard`, `formatBebidaForCopy`, `buildCopyText` |
| Bebida | `getBebidaColorClass` |
| Render | `renderCards` (inclui o selo "Separar") |
| Modal de detalhes | `openModal`, `closeModal` |
| Bottom sheet | `createSheet` — mola, arrastar para fechar, momentum (`projectMomentum`, `rubberband`) |
| Configuração (modal) | `openConfig`, `handleConfigSave` (testa a conexão antes de salvar), `loadAppVersion` |
| Status / estados da UI | `updateStatus`, `showState` (`loading`, `empty`, `error`, `list`, `welcome`), `showError` |
| Tema | `loadTheme`, `applyTheme` (salvo em `localStorage.theme`) |
| Eventos | listeners de busca, filtros, retry, atualizar, tema |
| Service worker | registro de `sw.js` |

## Configuração do usuário

O ID da planilha e a API Key são informados no modal ⚙️ e ficam no `localStorage` do dispositivo (`cfg_sheet_id`, `cfg_api_key`). Não há OAuth: a planilha precisa estar pública para leitura. Cada origem tem seu próprio `localStorage` — em `localhost` é preciso configurar de novo.

## Fluxo de dados

1. `init` → `loadSheets` busca a lista de abas e seleciona a primeira.
2. `selectSheet` → `loadSheetData(aba)`:
   1. **Chamada 1 — valores:** texto de todas as células da aba.
   2. `updateLastUpdated(res)` atualiza a data no cabeçalho.
   3. Monta `state.headers` (primeira linha, em maiúsculas) e `state.allRows` (um objeto por linha, chave = cabeçalho).
   4. **Chamada 2 — negrito da coluna `NOME`:** marca `row.__bold` em cada linha, cruzando pela posição da linha. Se falhar, segue sem o selo.
   5. `buildFilterUI` e `applyFilters` → `renderCards` e `updateStatus`.

### Chamadas à API (todas com `?key=API_KEY`)

| Uso | Endpoint |
|-----|----------|
| Lista de abas / teste da config | `GET /v4/spreadsheets/{ID}?fields=sheets.properties` |
| Valores da aba | `GET /v4/spreadsheets/{ID}/values/{aba}?valueRenderOption=FORMATTED_VALUE` |
| Negrito da coluna NOME | `GET /v4/spreadsheets/{ID}?ranges='{aba}'!{COL}:{COL}&includeGridData=true&fields=sheets.data.rowData.values.effectiveFormat.textFormat.bold` |

O endpoint `values` não traz formatação; por isso o negrito precisa da segunda chamada. A letra da coluna vem de `colIndexToLetter`, a partir da posição de `NOME` no cabeçalho.

## Service worker (`sw.js`)

- **Versão:** `CACHE_NAME = 'consulta-lotes-vXX'`. Incrementar a cada mudança que o usuário deva receber. Ao ativar, caches com outro nome são apagados (inclusive os dados offline, que são baixados de novo na próxima abertura com internet). A versão aparece no modal de configuração (`loadAppVersion`).
- **Instalação:** guarda os arquivos estáticos com `cache: 'reload'`, para não copiar versões antigas do cache HTTP do navegador.
- **Estáticos:** cache-first.
- **Fontes Google:** cache-first.
- **API do Sheets (`sheets.googleapis.com`):** network-first.
  - Resposta OK → devolvida ao app e guardada no cache com o cabeçalho `X-Cached-At` (horário ISO da busca). Respostas de erro não são guardadas.
  - Falha de rede → devolve a cópia guardada com o cabeçalho extra `X-From-Cache: 1`; sem cópia, `Response.error()`.
- O app lê esses dois cabeçalhos em `updateLastUpdated`. Como a resposta é criada pelo service worker, os cabeçalhos são visíveis para o app mesmo sendo de outra origem.
- O service worker só funciona em `localhost` ou HTTPS (não pelo IP da rede local).

## Deploy

GitHub Pages servindo a branch `main` em `provacafe-consulta.rildo.dev`. O push para `main` publica; não há CI/CD.
