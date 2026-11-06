# Funcionalidades

Comportamento atual do app. Detalhes técnicos em [arquitetura.md](arquitetura.md).

## Primeira abertura e configuração

- Sem ID da planilha ou API Key salvos → tela de boas-vindas com botão "Configurar agora".
- Modal ⚙️: campos de ID e API Key (com dicas "?" e botão 👁 para mostrar a chave).
  - "Salvar e conectar" testa a conexão antes de salvar e mostra quantas abas encontrou.
  - "Limpar dados salvos" pede confirmação e apaga a configuração.
  - Mostra a versão ativa do app (nome do cache do service worker, ex: `v20`).

## Cabeçalho

- Botões: atualizar dados (recarrega a aba atual), alternar tema claro/escuro, configuração.
- Seletor de páginas (abas da planilha).
- **Última atualização**, à direita de "PÁGINA DA PLANILHA":
  - com internet: `Atualizado em dd/mm hh:mm` (cinza);
  - sem internet: `Offline · dados de dd/mm hh:mm` (âmbar), com a data em que aqueles dados foram baixados.
- Busca e botão de filtros (com contador de filtros ativos).

## Busca

Pesquisa na coluna `NOME`, tolerante a erros:

- Ignora acentos e maiúsculas.
- Aproxima grafias de mesmo som: `ph→f`, `th→t`, `w→v`, `y→i`, `k→c`, `z→s`, letras dobradas viram uma.
- Cada palavra digitada precisa casar com o **início** de alguma palavra do nome, aceitando erros de digitação (inclusive letras trocadas de lugar):
  - até 3 letras: nenhum erro;
  - 4 a 7 letras: 1 erro;
  - 8 ou mais: 2 erros.
- Resultados exatos (o nome contém o termo) aparecem primeiro; os aproximados depois.

## Filtros

- `DATA`: campo de texto, filtra por "contém" (ex: `01/2025`).
- `ENTREGA` e `BEBIDA`: lista com os valores únicos da aba, comparação exata.
- Filtros e busca se combinam. "Limpar filtros" zera todos.
- A barra de status mostra `N registros` ou `X de N registros`.

## Card

- Título: `NOME`.
- **Selo "⚠ Separar"** (pílula vermelha logo depois do nome; desce para a linha de baixo quando não cabe): aparece quando o card tem `ENTREGA` preenchida **e** o `NOME` está em negrito na planilha. Se a leitura do negrito falhar, os cards aparecem normalmente, sem o selo.
- **Borda verde à esquerda** quando `ENTREGA` está preenchida.
- Chips com as colunas de `CONFIG.CARD_VISIBLE_COLS`; vazios mostram `—`; o chip `ENTREGA` só aparece se tiver valor.
- Botão copiar (ver abaixo), com vibração curta e ícone de confirmação.
- Toque no card abre o modal de detalhes (todas as colunas da aba).

## Cores do campo BEBIDA

`getBebidaColorClass(val)` olha só a **primeira palavra**, remove os dígitos e verifica as letras (a primeira regra que bater vence):

| Letra presente        | Classe          | Cor      |
|-----------------------|-----------------|----------|
| `B`                   | `bebida-red`    | Vermelho |
| `L` (sem `B`)         | `bebida-yellow` | Amarelo  |
| `R` (sem `B` nem `L`) | `bebida-green`  | Verde    |

Exemplos: `B` → vermelho · `RL1` → amarelo · `R1L` → amarelo · `R` → verde · `RL1B` → vermelho.

A cor vale no chip do card e no modal de detalhes.

## Copiar card

Copia, um por linha, só os campos preenchidos: **Nome, Quantidade (`SCS`), Bebida, Cata, Umidade (`UMID.`)**, no formato `Rótulo: valor`.

A Bebida é reescrita por `formatBebidaForCopy(val)` conforme a cor:

| Cor      | Prefixo      | Entrada          | Saída                   |
|----------|--------------|------------------|-------------------------|
| Verde    | `Duro`       | `R MOLE`         | `Duro Mole`             |
| Amarelo  | `Duro Riado` | `R1L FERMENTADO` | `Duro Riado Fermentado` |
| Vermelho | `Rio`        | `RL1B`           | `Rio`                   |

As palavras depois da primeira são capitalizadas e concatenadas ao prefixo. Sem cor reconhecida, o valor é copiado como está.

## Modais (bottom sheets)

Detalhes e configuração abrem como sheets que sobem de baixo, com animação de mola, arrastar para fechar (com momentum e resistência elástica) e fechamento ao tocar fora.

## Offline

- O app abre sem internet (arquivos guardados pelo service worker).
- Os dados de cada aba (e o negrito) ficam guardados da última vez que foram baixados com internet; o cabeçalho mostra de quando são.
- Ao publicar uma versão nova, os dados guardados são apagados e baixados de novo na próxima abertura com internet.

## Tema

Claro ou escuro, alternado pelo botão do cabeçalho e salvo no dispositivo.
