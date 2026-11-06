# Registro de decisões

Entradas mais recentes no topo. Cada uma diz **o que** foi decidido e **por quê**. Entradas antigas que já não influenciam o trabalho podem ser resumidas na seção "Histórico resumido".

---

## 2026-11-06 — Documentação em `docs/` mantida a cada mudança

- Criada a pasta `docs/` com arquitetura, funcionalidades, planilha, decisões e fluxo de trabalho.
- Regra: toda modificação atualiza os documentos afetados; de tempos em tempos, reorganizar para tirar o que ficou obsoleto ou repetido.
- O `CLAUDE.md` ficou só com regras e ponteiros, e os detalhes de regra de negócio foram para `docs/`, para não repetir informação.
- **Por quê:** facilitar o contexto ao abrir uma sessão nova sem precisar reler todo o código.

## 2026-11-06 — Modo offline com data da última atualização (v20)

- **Onde mostrar:** na linha "PÁGINA DA PLANILHA", à direita. Cinza quando online (`Atualizado em …`), âmbar quando offline (`Offline · dados de …`).
- **Como saber se veio do cache:** o service worker já fazia network-first na API e guardava as respostas. Faltava o app saber a origem e a data. Escolhido: o service worker grava `X-Cached-At` na cópia guardada e acrescenta `X-From-Cache: 1` quando devolve a cópia.
  - Alternativa descartada: só guardar o horário no `localStorage`, porque o app não conseguiria distinguir uma resposta da rede de uma do cache.
- **Respostas de erro** da API deixaram de ser guardadas, para um erro não substituir os dados offline bons.
- **Correção junto:** a instalação de uma versão nova passou a usar `cache: 'reload'`. Antes, podia guardar cópias antigas dos arquivos que estavam no cache HTTP do navegador, o que atrasava atualizações no celular.
- **Aceito:** ao subir a versão do cache, os dados offline são apagados; como a atualização só chega com internet, os dados são baixados de novo em seguida.

## 2026-11-06 — Selo "⚠ Separar" para entregas com nome em negrito (v19)

- **Necessidade:** destacar na planilha quais entregas precisam ser separadas, marcando o nome em negrito.
- **Regra:** o selo aparece só se o card tiver `ENTREGA` preenchida **e** o `NOME` estiver em negrito. Negrito sem entrega é ignorado. O card continua com a borda verde normal.
- **Negrito:** sempre o nome inteiro (nunca parcial), então basta o campo `bold` da célula, sem tratar `textFormatRuns`.
- **Visual:** pílula vermelha com "⚠ Separar" (escolhida em vez de só o ícone, por ser mais clara sem explicação). Usa as cores `--bebida-red-*`, então funciona nos dois temas.
- **Leitura do negrito:** o endpoint `values` não traz formatação. Escolhidas **duas chamadas**: a de valores continua igual, e uma segunda busca só a coluna `NOME` com `includeGridData` e `fields` mínimo. É mais leve que trazer toda a aba com formatação e mexe menos no código. As respostas são cruzadas pela posição da linha.
  - Se a segunda chamada falhar, os cards aparecem sem o selo, em vez de dar erro.
- Usado `effectiveFormat` (inclui formatação condicional).

## 2026-11-06 — Testar em branch + localhost antes de publicar

- Mudanças são feitas numa branch `feat/...`, testadas em `http://localhost:8080` e só vão para a `main` (produção) depois do OK do usuário. Detalhes em [fluxo-de-trabalho.md](fluxo-de-trabalho.md).
- **Por quê:** a `main` publica direto no GitHub Pages, sem ambiente de homologação.

---

## Histórico resumido (antes de 2026-11)

- **2026-10-15** — Busca tolerante a erros de digitação e variações fonéticas.
- **2026-09-26** — Modais viraram bottom sheets com mola e arrastar para fechar (diretrizes apple-design); feedback de toque e acessibilidade.
- **2026-07-03** — Campo umidade (`UMID.`) nos cards.
- **2026-06-24** — Versão ativa exibida no modal de configuração; ícones movidos para `assets/icons`; regra de commit/push só com autorização.
- **2026-06-23** — Bebida formatada no texto copiado conforme a cor; `CLAUDE.md` criado.
- **Antes** — Configuração da planilha pela interface (sem credenciais no código), cores de BEBIDA, botão copiar, botão atualizar, destaque de entrega com borda verde, filtros.
