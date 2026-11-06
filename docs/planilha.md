# Planilha (Google Sheets)

Cada aba da planilha vira uma "página" no seletor do app. A **primeira linha** de cada aba é o cabeçalho; os nomes são normalizados para maiúsculas.

## Colunas usadas

| Coluna    | Uso |
|-----------|-----|
| `NOME`    | Título do card e campo de busca (`CONFIG.SEARCH_COL`). O negrito desta célula é lido (ver abaixo) |
| `DATA`    | Chip no card; filtro por texto parcial (ex: `01/2025`) |
| `ENTREGA` | Chip só aparece se tiver valor; card com valor ganha borda verde; filtro por lista |
| `SCS`     | Quantidade de sacas |
| `BEBIDA`  | Código da bebida, com cor (ver [funcionalidades.md](funcionalidades.md)); filtro por lista |
| `CATA`    | Nota de catação |
| `UMID.`   | Umidade |
| `17/18`   | Peneira |

Colunas que aparecem no card: `CONFIG.CARD_VISIBLE_COLS` em `script.js`.
Colunas dos filtros: `CONFIG.FILTER_COLS`.
O modal de detalhes mostra **todas** as colunas da aba.

## Formatação lida pelo app

- **Negrito na célula `NOME`** → em linhas com `ENTREGA` preenchida, mostra o selo "⚠ Separar" no card.
  - O nome é sempre todo em negrito ou todo sem; negrito parcial não é tratado.
  - É lido o `effectiveFormat`, que inclui formatação condicional: uma regra condicional que deixe o nome em negrito também ativa o selo.
  - Negrito em linha sem `ENTREGA` é ignorado.

Nenhuma outra formatação (cor, fundo etc.) é lida.
