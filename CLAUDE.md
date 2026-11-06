# CLAUDE.md — Consulta de Lotes

## O que é o projeto

PWA mobile-first para consulta de lotes de café. Lê dados do Google Sheets via API pública (API Key, sem OAuth). O ID da planilha e a API Key são configurados no app (⚙️) e ficam no `localStorage` do dispositivo. Publicado pelo GitHub Pages em `provacafe-consulta.rildo.dev`.

## Documentação — ler antes de mexer

O contexto completo está em [`docs/`](docs/README.md):

- [docs/arquitetura.md](docs/arquitetura.md) — arquivos, fluxo de dados, chamadas à API, service worker
- [docs/funcionalidades.md](docs/funcionalidades.md) — comportamento atual e regras de negócio (busca, filtros, cores de BEBIDA, cópia, selo "Separar", offline)
- [docs/planilha.md](docs/planilha.md) — colunas esperadas e formatação lida (negrito)
- [docs/decisoes.md](docs/decisoes.md) — decisões tomadas, com data e motivo
- [docs/fluxo-de-trabalho.md](docs/fluxo-de-trabalho.md) — branch, teste local, publicação

## Regras

### Manter a documentação atualizada
- **Toda modificação no app atualiza os arquivos de `docs/` afetados**, no mesmo trabalho e antes de propor o commit. Decisões novas entram no topo de `docs/decisoes.md`.
- Os documentos descrevem o **estado atual**; histórico só em `docs/decisoes.md`.
- **Reorganizar de tempos em tempos**, quando necessário: arquivo passando de ~300 linhas, informação repetida entre arquivos, ou algo descrito que não existe mais no código. Remover o obsoleto, juntar/dividir arquivos e resumir decisões antigas. Avisar o usuário quando fizer uma reorganização.
- Não repetir neste `CLAUDE.md` o que já está em `docs/`.

### Arquitetura
Vanilla JS, HTML e CSS puros — **sem build, sem bundler, sem dependências npm**. Não criar `package.json` nem ferramentas de build.

### Service worker
Toda alteração que os usuários devam receber **incrementa** a versão do cache em `sw.js`:

```js
const CACHE_NAME = 'consulta-lotes-vXX'  // incrementar XX
```

### Testar antes de publicar
A `main` publica direto em produção. Trabalhar numa branch `feat/...`, testar em `http://localhost:8080` e só levar para a `main` com o OK do usuário (passo a passo em [docs/fluxo-de-trabalho.md](docs/fluxo-de-trabalho.md)).

### Commits e push
**Nunca fazer commit nem push sem perguntar antes.** Apresentar o que foi feito e aguardar o usuário decidir.

Padrão **Conventional Commits**:

```
feat:     nova funcionalidade
fix:      correção de bug
chore:    tarefas de manutenção (bump de versão, etc.)
style:    alterações visuais / CSS
refactor: refatoração sem mudança de comportamento
docs:     documentação
perf:     melhoria de performance
```
