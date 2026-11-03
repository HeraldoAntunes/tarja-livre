<!-- Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE) -->
# Testes no Linux, terceira bateria

Este documento conta a terceira bateria dos testes no Linux, em 02/11/2026, depois das mudanças da `main`
(correções de testes, CodeQL, testes de propriedade com fast-check e PC limpo). Os focos foram dois: o `e2e_varios` no
Firefox, que tinha falhado 1 vez com "doc is null" na segunda bateria
([E2E-LINUX-2.md](E2E-LINUX-2.md)), e se algum teste deixa sobra na pasta temporária. O jeito de rodar está em
[E2E-MULTIPLATAFORMA.md](E2E-MULTIPLATAFORMA.md).

## O que foi testado

- **Commit testado:** `4a2328cc3da0b42ae7916d2eb0d6091f85409aac`, no ramo `e2e-multiplataforma`. É o merge da `main`
  (`dac03d7`) neste ramo, mais a correção da pasta temporária do navegador descrita abaixo. Nada em `src/` mudou.
- **Onde:** Ubuntu 24.04.5 num contêiner sem tela; Chromium 153.0.8010.12 (o do Playwright 1.63.0) e Firefox 136.0,
  os dois sem janela; Node.js 22.22.0; Python 3.13.17 com PyMuPDF 1.27.2.3 e numpy 2.5.3 (o CI da `main` fixa o numpy
  2.4.4); fast-check 4.10.2 (`npm ci --ignore-scripts --prefix tests/propriedades`).
- **Como:** 3 rodadas seguidas. Em cada rodada: os testes rápidos (`node --test` de procura, montador e dados
  fictícios), os de propriedade (`tests/propriedades`), os 9 de ponta a ponta no Chromium e os 9 no Firefox, um de
  cada vez. Depois, mais 20 execuções só do `e2e_varios` no Firefox, para medir a falha. Antes e depois de cada teste,
  a lista da `/tmp` foi comparada para achar sobras. Nenhum teste foi repetido nem pulado.

## Resultado

| Parte | Rodada 1 | Rodada 2 | Rodada 3 |
|---|---|---|---|
| Rápidos (49 testes) | passou | passou | passou |
| Propriedades (6 testes) | passou | passou | passou |
| e2e no Chromium | 8 de 9 | 8 de 9 | 8 de 9 |
| e2e no Firefox | 8 de 9 | 8 de 9 | 8 de 9 |

Nas 3 rodadas, o único e2e que falhou foi o `e2e_ocr`, nas 6 vezes, como esperado, pelo defeito do @:

```
OCR FALHOU: E-mail 1 em 3 pendente(s): CPF 1, Telefone 1, Termo da lista 1
```

O `e2e_andamento` passou nas 6 vezes, nos dois navegadores, sem nenhuma falha no "queda 1".

### Cada e2e, por rodada

Tempo em segundos entre parênteses.

| Teste | Chromium 1 | Chromium 2 | Chromium 3 | Firefox 1 | Firefox 2 | Firefox 3 |
|---|---|---|---|---|---|---|
| `e2e` | passou (5) | passou (5) | passou (5) | passou (7) | passou (7) | passou (8) |
| `e2e_pdf_teste` | passou (15) | passou (12) | passou (12) | passou (18) | passou (18) | passou (18) |
| `e2e_varios` | passou (4) | passou (4) | passou (4) | passou (6) | passou (6) | passou (5) |
| `e2e_ocr` | falhou (2) | falhou (3) | falhou (3) | falhou (3) | falhou (3) | falhou (4) |
| `e2e_andamento` | passou (41) | passou (39) | passou (40) | passou (56) | passou (56) | passou (55) |
| `e2e_auditoria` | passou (4) | passou (5) | passou (5) | passou (6) | passou (6) | passou (6) |
| `e2e_auditoria2` | passou (28) | passou (27) | passou (26) | passou (33) | passou (33) | passou (34) |
| `e2e_export_real` | passou (8) | passou (5) | passou (6) | passou (7) | passou (7) | passou (7) |
| `e2e_telas` | passou (4) | passou (4) | passou (5) | passou (9) | passou (8) | passou (8) |

## Foco 1: o `e2e_varios` no Firefox continua instável

Nas 3 rodadas, ele passou. Nas 20 execuções extras, **falhou 4 vezes** (a 1, a 2, a 11 e a 17), sempre com a mesma
mensagem:

```
vários arquivos FALHOU: console sem erro inesperado
+ [
+   'warning: miniatura não desenhada 2 [object Object]',
+   'TypeError: doc is null'
+ ]
- []
```

| Bateria | Execuções do `e2e_varios` no Firefox | Falhas |
|---|---|---|
| Segunda (E2E-LINUX-2.md) | 3 | 1 |
| Terceira, rodadas | 3 | 0 |
| Terceira, extras | 20 | 4 |
| **Total** | **26** | **5 (cerca de 1 em 5)** |

No Chromium, ele passou nas 6 vezes das duas últimas baterias (sem execuções extras).

A causa é a mesma descrita em E2E-LINUX-2.md, e é do programa: em `src/app.js`, `montarMiniaturas()` desenha as
miniaturas num laço que lê `doc.paginas.length` a cada volta. Quando o teste fecha a aba da tela no meio desse desenho,
`doc` vira `null`: a miniatura em andamento falha (o aviso) e o laço estoura o `TypeError`. A `main` não mexeu nesse
trecho. Não foi corrigido aqui, como pedido. O teste não deve ser afrouxado: é a conferência do console que pega o
defeito.

## Foco 2: sobras na pasta temporária

| De onde | O que fica | Desde quando | Situação |
|---|---|---|---|
| Testes rápidos, `tests/montar.test.mjs` (teste do `Instalar-TarjaLivre-<versão>.zip`) | uma pasta `/tmp/tmpXXXXXXXX` com `falso.exe`, `1.zip` e `2.zip` (uns 24 KB), a cada execução | já existia na 1.2.1 (não é teste novo) | **não corrigido**: o Python do teste usa `tempfile.mkdtemp()` e não apaga a pasta. Basta trocar por `tempfile.TemporaryDirectory()` (ou apagar no fim) |
| Testes de propriedade (`tests/propriedades`), novos | nada | | sem sobra |
| Os 9 e2e no Chromium, antes da correção deste ramo | uma pasta `/tmp/org.chromium.Chromium.*` por abertura do navegador, com o `SingletonSocket` e o `SingletonCookie` | desde a primeira bateria deste ramo | **corrigido** no commit `4a2328c` (ver abaixo) |
| Os 9 e2e, depois da correção | nada | | sem sobra, nos dois navegadores, nas 3 rodadas e nas 20 extras |

A sobra do Chromium era da camada de testes deste ramo, e não de teste novo da `main`: no Linux, o Chromium cria
`org.chromium.Chromium.*` na pasta temporária e só apaga ao sair por conta própria; a camada fecha o navegador com
SIGKILL, então a pasta ficava. Ao fim das baterias anteriores, havia 88 delas na `/tmp` deste ambiente. A correção, em
`tests/navegador.mjs`: fora do Windows, o navegador sobe com `TMPDIR` numa pasta `tarja-e2e-tmp-*` do teste, apagada
junto com o perfil. No Windows nada mudou.

Também ficaram na `/tmp` deste ambiente as 88 pastas antigas do Chromium e 3 pastas `tarja-e2e-*` de um
`e2e_andamento` que eu interrompi com `kill` ao recomeçar a bateria (morto assim, o processo não roda a limpeza do fim).
Não fazem parte do resultado e não foram apagadas daqui.

## Outras mudanças neste ramo

- O merge da `main` conflitou em `tests/navegador.mjs` e `tests/todos.py`. O retrato da tela do exe
  (`diagnostico_tela.ps1`) e as 240 tentativas de esperar o exe foram mantidos; o retrato foi para o ponto em que
  `abrirNavegador()` trata a falha de ligação.
- A proposta de CI (`.github/workflows/e2e-linux.yml.proposta`, ainda desligada) passou a instalar o numpy e o
  fast-check, que o `tests/todos.py` da `main` agora usa.

## Resumo

- Esperado: só o `e2e_ocr` falhando. Nas 3 rodadas, foi isso.
- O `e2e_varios` no Firefox continua instável: 4 falhas em 20 execuções extras, todas com o "doc is null" das
  miniaturas ao fechar aba. É defeito do programa e não foi corrigido.
- Sobras na `/tmp`: os testes novos de propriedade não deixam nada. O `montar.test.mjs`, que é antigo, deixa uma pasta
  pequena a cada execução. O Chromium deixava uma pasta por abertura, por causa da camada deste ramo; foi corrigido.
- Nada foi publicado: sem tag, sem release e sem mexer na `main`.
