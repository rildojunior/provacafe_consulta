# Fluxo de trabalho

## Passo a passo de uma mudança

1. Combinar o comportamento com o usuário antes de implementar quando houver dúvidas de regra.
2. Criar uma branch: `git checkout -b feat/<nome>` (ou `fix/...`).
3. Implementar e **incrementar `CACHE_NAME`** em `sw.js` se o usuário precisar receber a mudança.
4. Atualizar os documentos de `docs/` afetados (ver [README.md](README.md)).
5. Testar localmente (abaixo).
6. Apresentar o que foi feito e **esperar o OK** do usuário.
7. Com o OK: commit na branch → `git merge --ff-only` na `main` → `git push origin main` → apagar a branch.

Nunca fazer commit nem push sem o usuário pedir.

## Testar localmente

- Servidor estático, só em localhost:

  ```bash
  cd ~/Desktop/provacafe_consulta && python3 -m http.server 8080 --bind 127.0.0.1
  ```

  - Pelo Claude Code: rodar esse comando pelo Bash em segundo plano. O `.claude/launch.json` (ignorado pelo git) só aponta o navegador do app para `http://localhost:8080`, porque o lançador do painel não tem permissão de acessar a pasta Desktop.
  - Expor na rede (`--bind 0.0.0.0`) é bloqueado no modo automático; o usuário pode rodar por conta própria para testar no celular, mas pelo IP o service worker não funciona.
- Em `localhost` o `localStorage` é separado da produção: o usuário precisa informar o ID e a API Key no ⚙️ (o Claude não digita a chave).
- Sem a chave, dá para testar a lógica substituindo `window.fetch` no console por respostas simuladas e chamando `loadSheetData('Teste')`.
- Service worker:
  - depois de mudar `sw.js`, rodar `(await navigator.serviceWorker.getRegistration()).update()` e recarregar;
  - para testar offline: Chrome do Mac → DevTools → Network → **Offline** → recarregar.
- Conferir no tamanho de celular (375 px) e nos temas claro e escuro.

## Commits

Padrão **Conventional Commits** (`feat`, `fix`, `chore`, `style`, `refactor`, `docs`, `perf`), mensagem em português.
