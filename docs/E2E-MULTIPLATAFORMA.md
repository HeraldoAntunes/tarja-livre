<!-- Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE) -->
# Testes de ponta a ponta no Windows, no Linux e no macOS

Até a versão 1.2.1, os 9 testes de ponta a ponta (`tests/e2e*.mjs` da lista do `tests/todos.py`) só rodavam no
Windows, com o Microsoft Edge. Fora dele, falhavam todos sem começar: procuravam o Edge no caminho do Windows e usavam
`taskkill` e `powershell` para fechar o navegador (ver `docs/LINUX.md`, no ramo `linux-validacao`).

Neste ramo (`e2e-multiplataforma`, para a 1.2.2), os mesmos 9 testes rodam também no Linux, no Chromium e no
Firefox. Nada em `src/` mudou, e nenhum teste deixou de verificar o que verificava.

## Resultado

Rodado em 30/10/2026, um teste de cada vez, no mesmo computador:

| Teste | Chromium | Firefox |
|---|---|---|
| `e2e` | passou | passou |
| `e2e_pdf_teste` | passou | passou |
| `e2e_varios` | passou | passou |
| `e2e_ocr` | **falhou** (defeito do programa, abaixo) | **falhou** (o mesmo defeito) |
| `e2e_andamento` | passou | passou |
| `e2e_auditoria` | passou | passou |
| `e2e_auditoria2` | passou | passou |
| `e2e_export_real` | passou | passou |
| `e2e_telas` | passou | passou |
| **Total** | **8 de 9** | **8 de 9** |

Os testes rápidos (`node --test`, 49 testes) também passaram. Depois de cada teste, nenhum processo do navegador e
nenhuma pasta temporária `tarja-e2e-*` ficaram para trás.

Onde rodou:

| Item | Versão |
|---|---|
| Sistema | Ubuntu 24.04.5 LTS (64 bits, x86-64), num contêiner, sem tela |
| Chromium | Chrome for Testing 153.0.8010.12, o Chromium que vem com o Playwright 1.63.0, sem janela |
| Firefox | 136.0, sem janela. Pacote `firefox_136.0+build3-0ubuntu0.20.04.1` do Ubuntu 20.04, aberto numa pasta à parte (sem instalar). A rede deste ambiente não alcança os servidores da Mozilla, e o Firefox do Ubuntu 24.04 é snap |
| Fontes | as do Ubuntu, sem o Arial da Microsoft (no lugar dele entra o Liberation Sans) |
| Node.js | 22.22.0 |
| Python | 3.13.17, com PyMuPDF 1.27.2.3 (para o `e2e_export_real`) |

**No Windows, os testes não foram rodados neste ramo** (este ambiente é Linux). O caminho do Edge continua o
primeiro e o mesmo de antes (ver "O que mudou"), mas é preciso rodar a suíte no Windows, ou deixar o `testes.yml`
rodar no PR, antes de levar o ramo para a `main`.

### O defeito que derruba o `e2e_ocr`

O teste desenha uma página digitalizada com a linha `E-mail: fulano.teste@exemplo.test` em "Arial" e espera que o
OCR transforme o e-mail em sugestão. No Linux, o "Arial" vira Liberation Sans, e o OCR do programa não lê o @ como @.
Resultado nos dois navegadores:

```
OCR FALHOU: E-mail 1 em 3 pendente(s): CPF 1, Telefone 1, Termo da lista 1
```

CPF, telefone e o nome da lista foram achados; o e-mail, não. Numa conferência à parte (a mesma linha desenhada
direto numa imagem, lida pelo mesmo Tesseract embutido, com as mesmas opções do programa), o @ saiu assim:

| Navegador | Palavras lidas |
|---|---|
| Chromium | `fulano.teste` e `Oexemplo.test` |
| Firefox | `fulano.teste`, `O` e `exemplo.test` |

Ou seja, o @ vira um "O" e, além disso, o endereço é partido em duas ou três palavras. `corrigirOcr()` em
`src/achados.js` só troca por @ um Q, © ou ® que esteja **dentro de uma palavra só**, entre as duas partes do
endereço; não trata o "O" nem junta palavras separadas. O `docs/LINUX.md` mostra leituras parecidas com outras fontes
do Linux (`WO`, `G&Q`, `QD`, `&Q`). A leitura depende da fonte da página, e não do sistema; então um documento
digitalizado com essas fontes deve ter o mesmo problema no Windows (não testado).

Não foi corrigido aqui (o trabalho não mexe em `src/`). O teste continua exigindo "E-mail 1", como antes.

## O que mudou

### `tests/navegador.mjs`, a camada comum

Os 9 testes já usavam esta camada para abrir o navegador. Ela agora:

1. **Acha o navegador** nesta ordem:
   - `TARJA_NAVEGADOR`: o caminho do executável, ou só o nome (`edge`, `chromium`, `chrome` ou `firefox`). Com o
     caminho, é Firefox se o nome do arquivo tiver "firefox"; senão, é tratado como Chromium (Chrome, Edge e
     Chromium falam o mesmo protocolo);
   - no Windows, o Edge nos dois caminhos de sempre (é o primeiro, como antes);
   - o Chromium do Playwright, se o Playwright estiver instalado;
   - os caminhos conhecidos do Chromium, do Chrome, do Edge e do Firefox no Linux, no macOS e no Windows.
2. **Mata o navegador de forma portátil**. No Windows, `taskkill /F /T` pelo PID, como antes. Nos outros sistemas, o
   navegador sobe num grupo de processos só dele, e o `process.kill` manda SIGKILL para o grupo inteiro (o navegador
   e todos os filhos). A limpeza das pastas usa `powershell` no Windows, como antes, e `pkill -f <pasta>` nos outros.
3. **Usa sempre um perfil temporário próprio** (`tarja-e2e-perfil-*` na pasta temporária, ou o perfil fixo do
   `e2e_andamento`, também temporário), nunca o perfil do usuário, e apaga no fim, também quando o teste falha.
4. **Fala com o Firefox pelo WebDriver BiDi**. O Firefox não tem mais o protocolo de depuração do Chromium. A camada
   traduz os poucos comandos que os testes mandam: avaliar JavaScript, navegar, capturar a tela, mouse, teclado
   (setas, Ctrl+Z, Ctrl+Y), tamanho da tela e as perguntas da página (`confirm`). Os erros e avisos do console, as
   exceções e as perguntas inesperadas entram na mesma lista `erros`, com o mesmo texto, para o "console limpo" valer
   igual nos dois. Um comando sem tradução dá erro; nunca é ignorado em silêncio.
5. **Download no Firefox**: o perfil temporário recebe preferências para o PDF salvo ir direto para a pasta do teste,
   sem perguntar e sem abrir no leitor de PDF do próprio Firefox. A espera pelo download agora também espera o
   arquivo ficar pronto (o Firefox cria o nome final vazio e grava em `.part`; o Chromium grava em `.crdownload`).
6. **Python**: `python` no Windows, como antes, e `python3` nos outros. `PYTHON=<comando>` escolhe outro.
7. Diz no começo de cada teste qual navegador usou (`navegador: firefox (/caminho/do/firefox)`).

Outras mudanças pequenas no Chromium: como root (contêiner, CI), ele sobe com `--no-sandbox`, sem o qual não abre; e,
se um Chromium novo não tiver mais o `Page.setDownloadBehavior`, a camada usa o `Browser.setDownloadBehavior`.

Com `TARJA_EXE` (o exe do Windows), nada mudou.

### Nos testes

Só duas trocas, sem mudar o que é verificado:

- `tests/e2e.mjs`: em vez de olhar a pasta de downloads crua, olha só os arquivos já baixados por inteiro
  (`nav.prontos()`). A asserção continua a mesma: um PDF, com o nome `exemplo-tarjado.pdf`, e o SHA-256 dele igual ao
  que o programa mostra.
- `tests/e2e_export_real.mjs`: chama o Python pelo `PYTHON` da camada, em vez de `python` fixo.

Os outros 7 não mudaram. Também mudou o comentário de `tests/todos.py`, para citar `TARJA_NAVEGADOR`.

## Como rodar

Antes, em qualquer sistema: Node.js 22 ou mais novo e Python 3. Para o `e2e_export_real`, o PyMuPDF:

```bash
python3 -m pip install pymupdf==1.27.2.3
```

Cada teste monta o HTML sozinho (`scripts/montar.py`). Para rodar os 9 e os testes rápidos, de uma vez:

```bash
python3 -X utf8 tests/todos.py --sem-auditoria
```

Sem `--sem-auditoria`, roda também a auditoria externa, que precisa de `npm ci --ignore-scripts --prefix
tests/auditoria-ext/ampliada`. Para rodar um teste só:

```bash
node tests/e2e.mjs
```

### Windows

Como sempre: com o Edge instalado, nada a configurar. No Windows o Python se chama `python`:

```bash
python -X utf8 tests/todos.py
```

Para rodar no Chrome ou no Firefox do Windows, aponte o executável com `TARJA_NAVEGADOR` (não testado neste ramo).

### Linux

Com o Chromium, o Google Chrome ou o Playwright instalados, nada a configurar. Para escolher:

```bash
TARJA_NAVEGADOR=chromium python3 -X utf8 tests/todos.py --sem-auditoria
```

```bash
TARJA_NAVEGADOR=firefox python3 -X utf8 tests/todos.py --sem-auditoria
```

Para um navegador fora dos caminhos conhecidos, use o caminho:

```bash
TARJA_NAVEGADOR=/caminho/do/firefox python3 -X utf8 tests/todos.py --sem-auditoria
```

O Firefox em snap (padrão do Ubuntu desde a 22.04) não foi testado; ele pode não enxergar a pasta temporária
(`/tmp`). Se não abrir, use um Firefox fora do snap (por exemplo, o `.tar` da Mozilla) e aponte o caminho.

### macOS

Os caminhos do Chrome, do Chromium, do Edge e do Firefox em `/Applications` estão na lista, e o jeito de matar o
navegador é o mesmo do Linux. **Não foi testado**.

## CI no Linux: proposta, desligada

A proposta está em `.github/workflows/e2e-linux.yml.proposta`. Com esse nome, o GitHub não a lê, então não roda. Ela
monta um Ubuntu 24.04 e roda `tests/todos.py --sem-auditoria` duas vezes, uma no Google Chrome e outra no Firefox
que já vêm na imagem do GitHub, nos PRs e quando alguém pede à mão.

Recomendação: **ligar só depois de corrigir o defeito do OCR**. Hoje o `e2e_ocr` falha nos dois navegadores, e o job
ficaria vermelho em todo PR, o que ensina a ignorar o vermelho. Depois da correção, vale ligar, como um a mais: o
`testes.yml` no Windows com o Edge continua sendo o principal, porque é onde o programa roda de verdade. Para ligar,
renomeie o arquivo:

```bash
git mv .github/workflows/e2e-linux.yml.proposta .github/workflows/e2e-linux.yml
```

Antes de ligar, confira também: o tempo (aqui, os 9 levaram uns 2 min no Chromium e 3 min no Firefox) e se o Firefox
da imagem do GitHub abre o `file://` da pasta do repositório sem problema.

## O que não foi testado

- **Os 9 no Windows depois da mudança.** O caminho do Edge é o mesmo, mas precisa rodar lá.
- O macOS, o Chrome e o Firefox do Windows, o Firefox em snap e o Firefox mais novo que o 136.
- O job de CI proposto (ele não foi ligado nem disparado).
- Os testes que ficam fora da lista dos 9 (`e2e_fechar`, `e2e_longo`, `e2e_pesado`) e os `.ps1`, que são do Windows.
