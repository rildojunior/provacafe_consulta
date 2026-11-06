# Documentação — Consulta de Lotes

Contexto do projeto para retomar o trabalho em uma nova sessão. Leia na ordem que fizer sentido para a tarefa.

| Arquivo | O que tem |
|---------|-----------|
| [arquitetura.md](arquitetura.md) | Arquivos, fluxo de dados, chamadas à API do Google Sheets, service worker e cache, deploy |
| [funcionalidades.md](funcionalidades.md) | Como cada parte do app se comporta hoje e as regras de negócio (busca, filtros, cards, cores de BEBIDA, cópia, selo "Separar", offline) |
| [planilha.md](planilha.md) | Estrutura esperada da planilha e como a formatação (negrito) é usada |
| [decisoes.md](decisoes.md) | Registro das decisões tomadas, com data e motivo |
| [fluxo-de-trabalho.md](fluxo-de-trabalho.md) | Como testar localmente antes de publicar, versão do cache, commits |

## Manutenção destes arquivos

- **A cada modificação no app**, atualizar o(s) arquivo(s) afetado(s) no mesmo trabalho, antes de propor o commit:
  - comportamento novo ou alterado → `funcionalidades.md`
  - arquivo, chamada de API ou cache novo → `arquitetura.md`
  - coluna ou formatação da planilha → `planilha.md`
  - escolha entre alternativas, regra combinada com o usuário → `decisoes.md` (nova entrada no topo)
- **Descrever o estado atual**, não o histórico. O histórico fica só em `decisoes.md` e no `git log`.
- **Reorganizar de tempos em tempos** (por exemplo, quando um arquivo passar de ~300 linhas, quando houver informação repetida entre arquivos ou quando algo descrito não existir mais no código):
  - remover o que ficou obsoleto;
  - juntar ou dividir arquivos conforme o assunto;
  - em `decisoes.md`, resumir entradas antigas que já não influenciam o trabalho atual.
