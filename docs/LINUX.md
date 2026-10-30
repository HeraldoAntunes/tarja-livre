<!-- Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE) -->
# Tarja Livre no Linux

Este documento conta como usar o Tarja Livre no Linux e o que foi testado nele em 30/10/2026, na versão 1.2.1.
Ele **não promete suporte**: diz só o que funcionou nos testes, em qual sistema e navegador, e o que ficou de fora.

## Como usar

No Linux não há o `.exe` (ele é só para Windows). Use um dos dois arquivos HTML da release:

- `TarjaLivre-1.2.1.html`: o programa normal;
- `TarjaLivre-OCR-1.2.1.html`: o mesmo, também lendo PDF digitalizado (mais pesado, cerca de 8 MB).

1. Baixe o arquivo e abra no Firefox ou no Chromium (ou Google Chrome): clique com o botão direito no arquivo,
   **Abrir com**, e escolha o navegador. Também dá para arrastar o arquivo para uma janela do navegador.
2. Use como no Windows, seguindo o [Guia de uso](GUIA-DE-USO.md).
3. Ao salvar:
   - no **Chromium** e no **Chrome**, o navegador pergunta onde salvar (caixa "Salvar como");
   - no **Firefox**, o PDF tarjado vai como download comum, para a pasta de downloads.

Diferenças que você pode notar:

- A pergunta ao marcar **Guardar** na lista de nomes fala em "usuário do Windows". No Linux, vale o mesmo para o
  usuário do Linux: quem entrar com o mesmo usuário vê a lista guardada.
- No Firefox, recarregar a página (F5) traz de volta a lista de nomes que estava na tela, mesmo sem **Guardar**.
  Veja o defeito 2 abaixo. Para tirar a lista da tela, clique em **Limpar** antes de fechar.
- Na versão com OCR, confira com atenção os e-mails das páginas digitalizadas. Veja o defeito 3 abaixo.

## O que foi testado

### Onde

| Item | Versão |
|---|---|
| Sistema | Ubuntu 24.04.5 LTS (64 bits, x86-64), num contêiner, sem tela |
| Chromium | Chrome for Testing 153.0.8010.12 (o Chromium que vem com o Playwright 1.63.0), sem janela (headless) |
| Firefox | 136.0, sem janela (headless). Pacote `firefox_136.0+build3-0ubuntu0.20.04.1` do Ubuntu 20.04, rodando com a `libnss3` 3.114 do Ubuntu, numa pasta à parte (o Firefox do Ubuntu 24.04 vem em snap, que não há neste contêiner) |
| Fontes | as do Ubuntu; **não há o Arial da Microsoft** (no lugar dele entra o Liberation Sans) |
| Node.js | 22.22.0 |
| Python | 3.13.17 |
| Controle dos navegadores | puppeteer-core 25.13.0 (Chromium pelo protocolo de depuração, Firefox pelo WebDriver BiDi) |

O Firefox 136 é de março de 2025 e já está desatualizado. Foi o mais novo que deu para instalar aqui, porque a rede
deste ambiente não alcança os servidores da Mozilla.

### Os dois HTML

Montados a partir do fonte com `python3 scripts/montar.py`, sem `--release`. Montando duas vezes, os bytes saíram
iguais.

| Arquivo | Tamanho | SHA-256 |
|---|---|---|
| `dist/Tarja Livre.html` | 2.304.597 bytes | `aaebc730624fb7cd34c3ce75906d3cf2bad9ef74d1e64b706250c4cfd6ade8dd` |
| `dist/Tarja Livre com OCR.html` | 8.259.832 bytes | `63833d056d91b9447c17d52580a7c65d23817d6db836f5472869e1dd4999608e` |

São os arquivos montados do fonte deste ramo (o commit `2bd6893`), não os anexos de uma release publicada.

### Os casos

O teste está em [`tests/linux/teste_linux.mjs`](../tests/linux/teste_linux.mjs). Ele abre o HTML direto do disco
(`file://`), como a pessoa abre, e usa só PDFs fictícios gerados na hora pelo próprio teste. Em todos os casos, o
teste também confere que o console ficou sem erro e sem aviso, e que não houve violação da política de segurança
(CSP) da página.

| Caso | O que faz | Chromium | Firefox |
|---|---|---|---|
| `fluxo` | abre um PDF de 2 páginas, procura (acha CPF, CNPJ, e-mail e telefone), aceita as sugestões, faz uma tarja à mão com o mouse, passa por todas as páginas, marca **Revisei** e salva. Confere o SHA-256 do original e do salvo, que o arquivo salvo não tem nenhum dos dados, que as páginas viraram imagem sem texto e que a folha de conferência está lá | passou | passou |
| `ab` | abre A (2 páginas) e depois B (1 página), em duas escolhas separadas, com calma; volta para a aba A, procura, aceita, confere e salva. O salvo tem de ser A: nome `A-tarjado.pdf`, 2 páginas mais a folha, SHA-256 de A na folha e o de B não | passou | passou |
| `ab-rapido` | o mesmo, mas escolhendo B antes de A terminar de abrir | passou (ver observação 1) | passou (ver observação 1) |
| `recuperar` | tarja (3 marcas), recarrega a página, abre o mesmo PDF, aparece a oferta "tem 3 marca(s) de antes", clica em **Recuperar** e salva. O salvo não tem os dados | passou, com o defeito 1 | passou, com o defeito 1 |
| `termos` | importa uma lista `.txt` (3 linhas, 2 termos diferentes), procura por ela num PDF, testa **Guardar** (Cancelar não guarda, OK guarda), recarrega e a lista volta, desmarca **Guardar** e a lista some do navegador | passou | passou, com o defeito 2 |
| `ocr` | versão com OCR: uma página A4 só com imagem (texto desenhado em Arial, que aqui vira Liberation Sans), com nome da lista, CPF, e-mail e telefone; procura com OCR, aceita, salva e compara pixel a pixel com uma máscara dos dados | passou, com o defeito 3 | passou, com o defeito 3 |

Resultado guardado em [`tests/linux/resultados/`](../tests/linux/resultados/): 6 de 6 casos passaram nos dois
navegadores; 2 achados no Chromium e 4 no Firefox (os defeitos abaixo).

Sobre o salvar: no Chromium, a caixa "Salvar como" não abre sem janela. O teste põe no lugar dela um substituto que
aceita o nome sugerido e guarda o que o programa gravou; o programa segue o mesmo caminho de quando a caixa existe.
No Firefox, que não tem essa caixa, o PDF saiu como download de verdade, para uma pasta do teste.

### A suíte do repositório

`python -X utf8 tests/todos.py`, sem mudar nada, no mesmo Ubuntu
([registro](../tests/linux/resultados/2026-10-30-suite-do-repositorio.txt)):

| Parte | Resultado |
|---|---|
| rápidos (`node --test`: procura, montador, dados fictícios): 49 testes | passou. Um pedaço de um teste só roda no Windows e foi pulado: a conferência da sintaxe do PowerShell do `Criar-atalho-TarjaLivre.cmd` |
| auditoria externa (`tests/auditoria-ext/rodar.py`, depois de `npm ci --ignore-scripts` em `tests/auditoria-ext/ampliada`): 18 cenários, 27 regressões e a exportação real | passou |
| os 9 de ponta a ponta (`e2e*.mjs`) | **falharam todos**, sem começar: "Microsoft Edge não encontrado". Eles procuram o Edge no caminho do Windows e usam `taskkill` e `powershell` para fechar o navegador |

**Resultado: 2 de 11 partes passaram.** As 9 que falharam não chegaram a testar o programa.

Só para ter mais informação, os 9 e2e também foram rodados uma vez no Chromium, com um atalho provisório: um
script no lugar do caminho do Edge, apagado depois. Nada do repositório mudou. Com isso, sem contar o fechamento do
navegador (que depende do Windows):

- `e2e`, `e2e_pdf_teste` e `e2e_varios`: passaram;
- `e2e_auditoria`, `e2e_auditoria2`, `e2e_telas` e `e2e_export_real` (este com o PyMuPDF instalado à parte):
  mostraram "tudo certo", mas o processo não terminou sozinho, porque o Chromium não foi fechado (`taskkill` não
  existe no Linux);
- `e2e_ocr`: falhou. O e-mail da página digitalizada não virou sugestão (o mesmo defeito 3);
- `e2e_andamento`: falhou antes de testar. Ele simula a queda matando o navegador com `taskkill`; sem isso, o
  navegador anterior continua aberto com o mesmo perfil e o novo não sobe.

## Defeitos encontrados

Nenhum deles foi corrigido nesta validação.

### 1. Depois de "Recuperar", a miniatura fica sem o número de marcas

Acontece no Chromium e no Firefox. Pelo código, deve acontecer também no Windows.

1. Abra o HTML e abra um PDF com um CPF (fictício).
2. Clique em **Procurar no documento** e em **Aceitar todas**. A miniatura da página mostra o selo "1".
3. Espere uns 3 segundos e recarregue a página (F5); confirme que quer sair.
4. Abra o mesmo PDF. Aparece "Este arquivo tem 1 marca(s) de antes...". Clique em **Recuperar**.

Esperado: a miniatura volta com o selo "1". Visto: a miniatura fica sem selo. As marcas estão lá (aparecem na
página grande e o PDF salvo sai tarjado), e o selo volta quando se clica numa miniatura.

Causa provável: `recuperarAndamento()` em `src/app.js` aplica as marcas e depois chama `montarMiniaturas()`, que
recria as miniaturas sem chamar `atualizarMiniaturas()`, que é quem põe o selo.

### 2. No Firefox, a lista de nomes volta ao recarregar a página

Visto só no Firefox 136. É um comportamento do Firefox, então deve acontecer também no Firefox do Windows (não
testado).

1. Abra o HTML no Firefox. Em **Lista de termos**, digite ou importe dois nomes. **Não** marque **Guardar**.
2. Recarregue a página (F5).

Esperado: "Nenhum termo.", como no Chromium. Visto: "2 termo(s) na lista." O mesmo acontece depois de marcar
**Guardar** e desmarcar: o programa apaga a lista do navegador (conferido), mas o F5 traz o texto de volta para a
caixa. Fechando e abrindo o arquivo de novo (sem ser pelo F5), a lista vem vazia.

Causa provável: ao recarregar, o Firefox devolve o que estava escrito nos campos do formulário, e a caixa de termos
(`<textarea id="termos">` em `src/index.html`) não tem `autocomplete="off"`. Não foi verificado se o Firefox
também grava esse texto em disco ao restaurar a sessão.

### 3. OCR: o e-mail da página digitalizada não vira sugestão

Visto no Chromium e no Firefox, no teste deste ramo e no `tests/e2e_ocr.mjs` do repositório.

1. Faça uma página só com imagem com a linha `E-mail: fulano.teste@exemplo.test`, escrita numa fonte que exista no
   Linux (o teste usa "Arial", que no Ubuntu vira Liberation Sans), e ponha num PDF.
2. Abra no HTML com OCR e clique em **Procurar no documento**.

Esperado: sugestão "E-mail 1". Visto: só CPF, telefone e o nome da lista. O OCR leu o @ como outra coisa. A mesma
linha, lida pelo OCR do programa, saiu assim:

| Fonte | Lido |
|---|---|
| Arial (Liberation Sans) | `fulano.teste WOexemplo.test` |
| DejaVu Sans | `fulano.testeG&Qexemplo.test` |
| FreeSans | `fulano.testeQDexemplo.test` |
| Carlito | `fulano.teste Qexemplo.test` |
| Caladea | `fulano.teste&Qexemplo.test` |
| DejaVu Serif | `fulano.testeQ&exemplo.test` |

`corrigirOcr()` em `src/achados.js` só troca por @ um Q, © ou ® sozinho entre as duas partes, e nenhum desses
casos é assim. No Windows, o `e2e_ocr` usa o Arial da Microsoft (não testado aqui). Como a leitura depende da fonte da página, e não
do sistema, um documento digitalizado com uma dessas fontes deve dar o mesmo resultado no Windows (não testado).

Os outros dados (CPF, telefone e o nome da lista) foram sugeridos e ficaram cobertos pixel a pixel.

## Observações

1. **Abrir B antes de A terminar.** Escolhendo A e logo em seguida B, as abas ficaram na ordem **B, A** e A ficou na
   tela, nos dois navegadores. Abrindo com calma, a ordem é A, B e B fica na tela. Em todos os casos, salvar com a
   aba A ativa salvou A, e só A.
2. Durante os e2e do repositório, o Chromium tentou falar com servidores do Google (atualização de componentes do
   próprio navegador), e a rede deste ambiente recusou. Não veio da página: os testes não viram nenhuma violação da
   política de segurança da página.

## O que não foi testado

- **Navegador com janela**, em X11 ou Wayland: clicar, arrastar arquivos, imprimir e o "Salvar como" de verdade do
  Chromium e do Chrome.
- **Abrir com dois cliques** no gerenciador de arquivos (Nautilus, Dolphin, Nemo etc.).
- **O Firefox atual** (só o 136) e o **Firefox em snap**, que é o padrão do Ubuntu desde a 22.04. O snap pode
  restringir o acesso a arquivos fora da pasta pessoal; abrir o HTML de um pendrive ou de `/tmp` pode não funcionar.
- **Google Chrome**, Microsoft Edge para Linux, Brave, Vivaldi e outros.
- **Outras distribuições**: Debian, Linux Mint, Fedora, Zorin, Linux Educacional etc.; outras arquiteturas (ARM,
  32 bits); computadores fracos ou com pouca memória.
- **Queda do navegador** (matar o processo) e recuperação depois; só foi testado recarregar a página.
- **Rede desligada**: o teste conferiu a política de segurança da página, mas não rodou com o cabo tirado.
- PDFs grandes, longos (os `e2e_longo` e `e2e_pesado` do repositório) e documentos digitalizados de verdade.
- Teclado físico e acessibilidade (leitor de tela).
- O `.exe` (Tauri/WebView2) não existe para Linux e não foi tentado.

## Como repetir o teste

Na raiz do repositório, com Python 3, Node 22 e um Chromium e/ou Firefox instalados:

```bash
python3 scripts/montar.py
```

```bash
cd tests/linux && npm ci --ignore-scripts
```

```bash
CHROMIUM=/caminho/do/chromium node teste_linux.mjs chromium
```

```bash
FIREFOX=/caminho/do/firefox node teste_linux.mjs firefox
```

Para rodar só alguns casos, ponha os nomes depois do navegador, separados por vírgula (por exemplo
`node teste_linux.mjs firefox fluxo,termos`). O resultado também fica em `files/linux-<navegador>.json`, e as
capturas de tela em `files/linux/<navegador>/`. O teste não baixa navegador; é preciso apontar para um instalado.
