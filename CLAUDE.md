# CLAUDE.md — Consulta de Lotes

## O que é o projeto

PWA mobile-first para consulta de lotes de café. Lê dados do Google Sheets via API pública (sem autenticação OAuth). O usuário configura o ID da planilha e a API Key pelo painel de configurações (⚙️); as credenciais ficam salvas no `localStorage` do dispositivo.

## Arquitetura

Vanilla JS, HTML e CSS puros — **sem build, sem bundler, sem dependências npm**. Tudo roda diretamente no browser. Não criar `package.json` nem ferramentas de build.

```
index.html    — estrutura e modais (detalhes + configuração)
script.js     — toda a lógica (~500 linhas)
styles.css    — estilos
sw.js         — service worker (cache offline)
manifest.json — configuração do PWA
favicon.svg   — ícone
```

## Estrutura esperada da planilha

A primeira linha da aba é o cabeçalho. Colunas relevantes (todas em maiúsculas após normalização):

| Coluna   | Uso                                              |
|----------|--------------------------------------------------|
| `NOME`   | Campo de busca principal (`CONFIG.SEARCH_COL`)   |
| `DATA`   | Filtro por texto parcial (ex: `01/2025`)         |
| `ENTREGA`| Chip especial — só aparece se tiver valor        |
| `SCS`    | Quantidade de sacas                              |
| `BEBIDA` | Código da bebida (ver regra abaixo)              |
| `CATA`   | Nota de catação                                  |
| `UMID.`  | Umidade                                          |
| `17/18`  | Peneira                                          |

Para adicionar ou remover colunas visíveis no card edite `CONFIG.CARD_VISIBLE_COLS` em `script.js`.  
Para alterar as colunas dos filtros edite `CONFIG.FILTER_COLS`.

## Regra de cores do campo BEBIDA

Função `getBebidaColorClass(val)` — analisa apenas a **primeira palavra** do valor, remove dígitos e verifica as letras restantes (prioridade de cima para baixo):

| Letra presente | Classe CSS       | Cor visual |
|----------------|------------------|------------|
| `B`            | `bebida-red`     | Vermelho   |
| `L` (sem `B`)  | `bebida-yellow`  | Amarelo    |
| `R` (sem `B` nem `L`) | `bebida-green` | Verde |

Exemplos: `B` → vermelho · `RL1` → amarelo (tem L) · `R1L` → amarelo · `R` → verde · `RL1B` → vermelho (B tem prioridade).

## Regra de formatação ao copiar (BEBIDA)

Função `formatBebidaForCopy(val)` — usa a mesma regra de cores para montar o texto copiado:

| Cor      | Prefixo       | Exemplo entrada | Exemplo saída        |
|----------|---------------|-----------------|----------------------|
| Verde    | `Duro`        | `R MOLE`        | `Duro Mole`          |
| Amarelo  | `Duro Riado`  | `R1L FERMENTADO`| `Duro Riado Fermentado` |
| Vermelho | `Rio`         | `RL1B`          | `Rio`                |

A palavra após o espaço (se houver) é capitalizada e concatenada ao prefixo. Campos copiados pelo botão de cópia do card: Nome, Quantidade, Bebida, Cata, Umidade.

## PWA — Service Worker

Ao fazer qualquer alteração que deva ser percebida pelos usuários **sempre incrementar** a versão do cache em `sw.js`:

```js
const CACHE_NAME = 'consulta-lotes-vXX'  // incrementar XX
```

O service worker usa cache-first para estáticos e network-first para a API do Google Sheets.

## Commits e Push

**Nunca fazer commit nem push sem perguntar antes.** Após concluir as alterações, apresentar o que foi feito e aguardar o usuário decidir o momento de commitar e publicar.

Usar sempre o padrão **Conventional Commits**:

```
feat:     nova funcionalidade
fix:      correção de bug
chore:    tarefas de manutenção (bump de versão, etc.)
style:    alterações visuais / CSS
refactor: refatoração sem mudança de comportamento
docs:     documentação
perf:     melhoria de performance
```

## Deploy

O projeto é servido via GitHub Pages. O push para `main` já atualiza o site. Não há CI/CD adicional.
