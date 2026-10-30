# Proposta para a 1.2.2: e-mail em página digitalizada

Proposta de correção do defeito 3 da validação Linux (o e-mail de página digitalizada não vira sugestão de tarja),
para a equipe Tarja revisar. Está no ramo `ocr-email-1.2.2`, feito a partir da `main` de 30/10/2026. Não mexe na
`main`, não cria tag nem release.

Base: o estudo do ramo `estudo-ocr-email` (`docs/ESTUDO-OCR-EMAIL.md` e os dados em `tests/estudo-ocr/`). Todos os
números abaixo foram medidos de novo com o código desta proposta, não com a simulação do estudo.

## O problema

O português do Tesseract embutido (`vendor/tesseract/por.traineddata.gz`) não tem o @ entre os 117 caracteres que
sabe escrever. Numa página digitalizada, o @ de um e-mail sai sempre como outra coisa: `&`, `G`, `Q`, `(D`, `O`...
Hoje só o `Q` colado é trocado (`corrigirOcr()`), e só 6,8% dos e-mails de página digitalizada viram sugestão
inteira. Numa página assim, o e-mail fica sem tarja sugerida, o que é grave para a LGPD.

## A mudança

Três arquivos de `src/`:

1. **`src/app.js`**: `lerComOcr()` marca cada palavra lida pelo OCR com `ocr: true`.
2. **`src/achados.js`, `procurar()`**: numa página com palavras marcadas `ocr`, a procura de e-mail também aceita o
   @ lido como uma das sequências abaixo (função `emailsDoOcr()`). Em página com texto de verdade nada muda.
3. **`src/achados.js`, `corrigirOcr()`**: o `Q` não vira @ quando o "domínio" termina em extensão de arquivo. Hoje,
   numa página digitalizada, `ARQUITETURA.md` vira `AR＠UITETURA.md` (o Q trocado por @) e é sugerido como e-mail.

### A regra

Sequências aceitas no lugar do @ (`ARROBA_OCR`), com maiúsculas e minúsculas como estão:

| Sequência | Observação |
|---|---|
| `&` | a leitura mais comum. Também cobre `G&`, `&Q`, `Q&`, `&G`, `t&`, `&M`, `&D`..., porque a letra colada fica na parte de antes ou no domínio |
| `&&` | |
| `(D`, `(Q`, `(O`, `(o`, `(d`, `(P`, `(E`, `(&` | o `(` só com a letra que o OCR tira do desenho do @, nunca sozinho |
| `ê` | leitura das fontes mono |
| `Q` | a troca que `corrigirOcr()` já faz, agora também quando o `Q` cai entre duas palavras (veja abaixo) |

São as 11 sequências do estudo mais o `Q`. O `Q` entrou porque, sem ele, o `tests/e2e_ocr.mjs` continua falhando no
Linux: lá o OCR separa `fulano.teste` e `Qexemplo.test` em duas palavras, e `corrigirOcr()`, que olha uma palavra
por vez, não vê o @.

A regra roda sobre o texto juntado da linha (o de `juntarTexto()`), porque às vezes o OCR põe um espaço antes ou
depois da sequência. Aceita quando tudo isto vale:

1. a parte de antes tem 2 caracteres ou mais, dos que o e-mail aceita (`A-Z a-z 0-9 . _ % + -`), termina em letra
   ou algarismo e não vem logo depois de `/`, `\`, `=`, `?` ou `#` (caminho ou endereço de site);
2. o domínio tem ponto, o primeiro pedaço dele tem 2 caracteres ou mais e o último é só de letras;
3. o último pedaço do domínio não é extensão de arquivo (`pdf`, `docx`, `xlsx`, `jpg`, `md`, `html`... a lista
   `EXTENSOES`);
4. pode haver um espaço antes ou depois da sequência, nunca dos dois lados (`Silva & Souza`);
5. com `(`, não há `)` no resto da palavra (`Portal(exemplo.gov.br)`);
6. com `Q`: nunca com espaço depois; com espaço antes, só se a parte de antes tiver ponto, hífen, sublinhado ou
   algarismo e o domínio começar em minúscula. Assim `fulano.teste Qexemplo.test` vira e-mail e
   `Acesse Qualidade.gov.br` não vira.

A sugestão é o trecho como foi lido, da parte de antes ao fim do domínio. O texto não muda de tamanho, então as
caixas das letras continuam certas, também quando o e-mail ficou em duas palavras.

## Os números

Medidos com `tests/medir_ocr_email.mjs`, que roda o `src/achados.js` da `main` (antes) e o desta proposta (agora)
sobre os dados brutos do estudo: 966 páginas fictícias, 22 fontes livres, 8 a 16 pt, 150, 200 e 300 ppp, limpas e
com ruído e inclinação, lidas pelo OCR do próprio programa.

| | Antes (main) | Agora |
|---|---:|---:|
| E-mails sugeridos inteiros, de 9.606 | 654 (6,8%) | 5.381 (56,0%) |

| Tipo de fonte | E-mails | Antes | Agora |
|---|---:|---:|---:|
| mono | 3.000 | 1,1% | 16,4% |
| sem serifa | 4.054 | 13,1% | 73,6% |
| serifa | 2.552 | 3,5% | 74,7% |

| Desenho da página | E-mails | Antes | Agora |
|---|---:|---:|---:|
| Pillow (com e sem ruído) | 6.600 | 7,0% | 55,8% |
| canvas do Chromium | 3.000 | 6,4% | 56,5% |
| a página do `e2e_ocr` nas 6 fontes do defeito 3 | 6 | 2 de 6 | 5 de 6 |

### Falso positivo

| Textos que não são e-mail | Quantos | Viram e-mail antes | Viram e-mail agora |
|---|---:|---:|---:|
| linhas comuns das páginas, lidas pelo OCR (CPF, datas, nomes, `QD 05`, `Bloco WO`, `Q&A`, `P&D`, `Silva & Souza`, endereços de site, nomes de arquivo) | 9.624 | 0 | 0 |
| linhas sem @ dos textos do repositório (README, CHANGELOG, docs, avisos e licenças), passadas pela procura como se o OCR as tivesse lido | 1.043 | 1 | 0 |
| textos escritos à mão para cair perto da regra (`tests/estudo-ocr/contraexemplos.txt` do estudo) | 97 | 0 | 2 |

O "1" de antes é o `ARQUITETURA.md`, que a mudança 3 corrige. Os 2 de agora são os dois endereços de site com `&`
no meio, postos de propósito no estudo para medir o limite: `barros&lima.adv.br` e `Silva&Souza.com.br`.

## O que ainda escapa

Ainda escapam 4.225 e-mails (44,0%):

- **3.429 só pelo @**, lido como letra sozinha: `G` (833), `O` (410), `g` (353), `t` (301), `␣O` (111), `E` (101),
  `d`, `e`, `␣Q` sem cara de usuário antes, `␣G`, `0`... Letra sozinha não entra na regra: `exemplo.gov.br` não se
  distingue de `exempl` + `o` + `.gov.br`. No estudo, aceitar as letras levaria a 85,8%, mas 12,9% das linhas comuns
  virariam e-mail.
- **796 com outro erro do OCR** no próprio e-mail (letra ou algarismo trocado, ponto perdido). Nenhuma regra do @
  resolve.
- **Fontes mono** quase não melhoram (16,4%): nelas o @ sai quase sempre como `g` ou `G`.
- **E-mail com `_`**: o modelo também não tem o `_`; não foi testado.
- **A leitura muda com o desenho.** Na validação Linux, a mesma página do `e2e_ocr` foi lida como
  `fulano.teste WOexemplo.test`, que esta regra não pega. Aqui, com o mesmo Chromium, ela sai como
  `fulano.teste Qexemplo.test` (com as duas palavras coladas na junção), que a regra pega. O Windows, com o Arial de
  verdade, não foi testado.

Duas opções medidas no estudo e **não** incluídas aqui, para a equipe decidir depois: aceitar letra maiúscula colada
entre minúsculas (`fulanoGexemplo.gov.br`, que levaria a cerca de 72%, mas erra em endereço com maiúscula no meio,
como `portalEducacao.gov.br`) e ler de novo a palavra suspeita com outro modelo que tenha o @ (não medido).

## Risco de falso positivo

- **Só em página lida pelo OCR.** PDF com texto de verdade não passa pela regra (teste "as leituras do @ pelo OCR
  só valem em página lida pelo OCR").
- **Endereço de site com `&` no meio** (`barros&lima.adv.br`) vira sugestão de e-mail. É raro em documento, e é uma
  sugestão: a pessoa vê e pode recusar. Sobra tarja, não falta.
- **`Q` entre duas palavras com cara de e-mail**, como `arquivo.v2 Qualquer.com.br` com o domínio em minúscula,
  vira e-mail. Não apareceu em nenhum dos textos medidos.
- O resto do risco é o da regra de hoje do `Q` colado, agora menor por causa da extensão de arquivo.

## Os testes

Todos falham com o `src/` da `main` e passam com esta proposta, salvo onde está dito.

| Teste | O que confere | Antes | Agora |
|---|---|---|---|
| `tests/achados.test.mjs`: "OCR: e-mail com o @ lido como &, (D, ê, Q..." | 19 leituras de verdade do estudo (inclusive com espaço de um lado e a do `e2e_ocr`) viram o e-mail inteiro, e as duas palavras coladas também | falha | passa |
| `tests/achados.test.mjs`: "OCR: o e-mail em duas palavras ganha uma caixa só" | a tarja cobre as duas palavras | falha | passa |
| `tests/achados.test.mjs`: "OCR: nome de arquivo com Q..." | `ARQUITETURA.md` fica como está | falha | passa |
| `tests/achados.test.mjs`: "OCR: textos comuns de documento não viram e-mail" | 37 textos comuns (`QD`, `WO`, `Q&A`, `P&D`, `Silva & Souza`, endereços de site, arquivos, `Acesse Qualidade.gov.br`...) | passa | passa (guarda contra falso positivo) |
| `tests/achados.test.mjs`: "as leituras do @ pelo OCR só valem em página lida pelo OCR" | sem a marca `ocr`, nada muda | passa | passa (guarda) |
| `tests/e2e_ocr.mjs`, primeira página (a de sempre, em "Arial") | o e-mail sugerido e coberto pixel a pixel | falha no Linux (defeito 3) | passa no Linux |
| `tests/e2e_ocr.mjs`, segunda página: `tests/fixtures/ocr-email.pdf` | 5 e-mails com o @ lido como `&Q`, `&`, `(D`, `␣Q` e `(D`, entre linhas com `QD`, `WO`, `Q&A`, `Silva & Souza`, `Portal(exemplo.gov.br)`, `Edital&Anexo.pdf`, CPF e `ARQUITETURA.md`: exatamente "E-mail 5" e os e-mails cobertos pixel a pixel | "E-mail 1" (falha) | passa |

A segunda página é uma imagem fixa a 200 ppp, gerada por `tests/fixtures/gerar_ocr_email.py` (sai igual byte a
byte), com a máscara `ocr-email-dados.pdf`. Ela não depende das fontes do computador, então deve falhar antes e
passar depois também no Windows. A primeira página usa o Arial do sistema: no Windows ela provavelmente já passava
antes.

Rodado em 30/10/2026, num Ubuntu 24.04 com o Chromium 153 do Playwright:

- `node --test tests/achados.test.mjs tests/montar.test.mjs tests/ficticios.test.mjs`: 54 de 54 passam;
- `tests/e2e_ocr.mjs`, `tests/e2e.mjs` e `tests/e2e_pdf_teste.mjs`: passam.

**Não foi rodado no Windows nem no Edge.** O CI do GitHub (Windows, Edge) deve rodar a suíte inteira quando o ramo
for enviado ou quando abrirem um pull request.

### Para rodar os e2e fora do Windows

`tests/navegador.mjs` agora aceita `TARJA_NAVEGADOR=<caminho de um Chromium>`. No Windows nada muda: sem a variável,
usa o Edge como antes. Fora do Windows, fecha o navegador pelo grupo do processo em vez do `taskkill`, chama
`python3` e passa `--no-sandbox`.

```bash
TARJA_NAVEGADOR=/caminho/do/chromium node tests/e2e_ocr.mjs
```

### Para medir de novo

Os dados brutos ficam no ramo do estudo. Com uma cópia dele numa pasta ao lado e o `achados.js` da `main` salvo à
parte:

```bash
git worktree add ../tarja-estudo estudo-ocr-email
```

```bash
git show main:src/achados.js > /tmp/achados-main.js
```

```bash
node tests/medir_ocr_email.mjs ../tarja-estudo/tests/estudo-ocr /tmp/achados-main.js
```

Leva uns 2 segundos e imprime as tabelas desta página.

## Arquivos

| Arquivo | O que mudou |
|---|---|
| `src/achados.js` | `EXTENSOES`, `ARROBA_OCR`, `emailsDoOcr()`; `corrigirOcr()` não troca o `Q` em nome de arquivo; `procurar()` usa `emailsDoOcr()` em página lida pelo OCR |
| `src/app.js` | `lerComOcr()` marca as palavras com `ocr: true` |
| `tests/achados.test.mjs` | os 5 testes acima |
| `tests/e2e_ocr.mjs` | a segunda página |
| `tests/fixtures/gerar_ocr_email.py`, `ocr-email.pdf`, `ocr-email-dados.pdf`, `ocr-email.json` | a página fixa dos e-mails e a máscara |
| `tests/navegador.mjs` | `TARJA_NAVEGADOR` para rodar os e2e num Chromium fora do Windows |
| `tests/medir_ocr_email.mjs` | a medição antes e agora sobre os dados do estudo |
| `CHANGELOG.md` | a linha em "Não publicado" |
| `docs/PROPOSTA-OCR-EMAIL.md` | esta página |
