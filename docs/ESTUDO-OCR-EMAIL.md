# Estudo: como o OCR lê o @ dos e-mails em páginas digitalizadas

Estudo feito em 30/10/2026 sobre o Tarja Livre 1.2.1 (a versão HTML com OCR, como está em `main`), para a correção
do defeito 3 de `docs/LINUX.md` na 1.2.2. Nada em `src/` foi alterado. Todos os dados das páginas são inventados.

## Resumo

1. **O OCR do Tarja Livre nunca escreve @.** O arquivo de português embutido (`vendor/tesseract/por.traineddata.gz`)
   só conhece 117 caracteres, e o @ não está entre eles. Também não estão `_`, `©` e `®`. No lugar do @ sai sempre
   outra coisa: `&`, `G`, `Q`, `(D`, `O`, `g`... Foram 473 leituras diferentes em 9.606 e-mails.
2. **Hoje, só 6,8% dos e-mails de página digitalizada viram sugestão inteira.** Quase todos esses são o caso
   em que o @ sai como `Q` colado, que `corrigirOcr()` já troca.
3. **A regra proposta leva a 54,6%, sem nenhum falso positivo novo** nos 9.624 textos comuns lidos pelo OCR e nas
   1.043 linhas de texto do repositório. A lista tem 11 sequências: `&`, `&&`, `(D`, `(Q`, `(O`, `(o`, `(d`, `(P`,
   `(E`, `(&` e `ê`. Ela erra em endereço de site com `&` no meio (`barros&lima.adv.br`), que é raro.
4. **Duas opções somam mais acertos, com algum risco:** o `Q` depois de um espaço (55,9%) e a letra maiúscula colada
   entre minúsculas (`fulanoGexemplo.gov.br`, 71,5%). As duas juntas levam a 72,8%. A das maiúsculas erra em
   endereço de site com maiúscula no meio, como `portalEducacao.gov.br`.
5. **Aceitar qualquer letra sozinha no lugar do @ não serve.** Com `G`, `g`, `O`, `E`... aceitas, o acerto iria a
   85,8%, mas 12,9% dos textos comuns virariam e-mail: `exemplo.gov.br` não se distingue de `exempl` + `o` + `.gov.br`.
6. **Fontes mono quase não melhoram** (de 1,1% para 16,4%): nelas o @ sai quase sempre como `g` ou `G`.
7. **A regra de hoje já tem um falso positivo:** numa página digitalizada com o texto `ARQUITETURA.md` (está no
   `README.md`), o `Q` vira @ e a procura sugere `AR＠UITETURA.md` como e-mail.
8. O teto, se o @ fosse lido certo, é 91,6%. O que falta até ele (cerca de 3.600 e-mails) é quase todo o @ lido como
   letra sozinha.

## Como foi medido

### As páginas

O script `tests/estudo-ocr/gerar.py` faz páginas A4 só com imagem, com 20 linhas cada: 10 com um e-mail inventado e 10
com textos comuns de documento (os contraexemplos). Três conjuntos:

| Conjunto | Páginas | E-mails | Como a página é desenhada |
|---|---:|---:|---|
| `pil` | 660 | 6.600 | Pillow, com cada fonte pelo arquivo dela. 22 fontes x 5 tamanhos x 3 resoluções x 2 estados |
| `navegador` | 300 | 3.000 | canvas do Chromium, como em `tests/e2e_ocr.mjs`. 20 fontes x 5 tamanhos x 3 resoluções, só limpa |
| `reproducao` | 6 | 6 | a mesma página de `tests/e2e_ocr.mjs` (36 px a 150 ppp), nas seis fontes da tabela do defeito 3 |
| **Total** | **966** | **9.606** | |

- **Fontes (22):** sem serifa: DejaVu Sans, Liberation Sans, FreeSans, Noto Sans, Carlito, Roboto, Open Sans,
  Ubuntu, Inter. Serifa: DejaVu Serif, Liberation Serif, FreeSerif, Noto Serif, Caladea, Bitstream Charter. Mono:
  DejaVu Sans Mono, Liberation Mono, FreeMono, Noto Sans Mono, Ubuntu Mono, JetBrains Mono, Courier 10 Pitch. As duas
  Type 1 (Bitstream Charter e Courier 10 Pitch) ficam só no conjunto `pil`, porque o Chromium não as desenha.
- **Tamanhos:** 8, 10, 12, 14 e 16 pt.
- **Resolução da digitalização:** 150, 200 e 300 ppp.
- **Estado:** limpa (JPEG de qualidade 95) ou com ruído (desfoque leve, ruído do sensor, pontos de sujeira,
  inclinação de 0,3 a 1,5 grau para um lado ou outro, JPEG de qualidade 70).
- **E-mails:** 16 partes antes do @ (simples, com ponto, com hífen e com números, como `fulano`, `fulano.teste`,
  `beltrana-souza`, `aluno123`) e 8 domínios (`exemplo.com.br`, `teste.com.br`, `exemplo.gov.br`,
  `orgao-teste.gov.br`, `exemplo.edu.br`, `campus.exemplo.edu.br`, `exemplo.test`, `mail2.exemplo.test`), em 8
  frases diferentes (`E-mail: ...`, `Envie para ... até sexta.`, o e-mail sozinho etc.).

Neste documento e em `resultados.md`, o @ de um e-mail fora do domínio `.test` aparece como ＠ (o @ largo, como no
pedido deste estudo): o teste `tests/ficticios.test.mjs` não aceita e-mail com outro domínio nos textos do
repositório. Os CSV guardam o texto como foi lido, com o @ normal. Os domínios `.com.br`, `.gov.br` e `.edu.br` são
inventados para o estudo, como pedido.

### O OCR

O mesmo do programa, com as mesmas versões e os mesmos parâmetros. O script `tests/estudo-ocr/ler.mjs` abre o
`dist/Tarja Livre com OCR.html` montado por `python3 scripts/montar.py` e, dentro dele, faz o que `lerComOcr()` de
`src/app.js` faz:

1. a imagem vira um PDF de uma página A4 (jsPDF embutido);
2. o PDF.js embutido desenha a página a 200 ppp, com `annotationMode: ENABLE` e `intent: 'print'`;
3. o Tesseract.js 7.0.0 embutido, criado como em `obterOcr()` (`createWorker('por', 1, {...})`, isto é, português e
   o modo LSTM, com o worker e os dados do idioma de dentro do HTML), lê o canvas com
   `recognize(canvas, {}, { blocks: true, text: false })`.

Cada palavra lida, com a caixa dela, vai para `palavras.csv`. Ambiente: Ubuntu 24.04 num contêiner, Chromium
153.0.8010.12 (o do Playwright 1.63.0, o mesmo da validação Linux), Node 22.22.0, Python 3.13.17, Pillow 12.3.0.

### A análise

O script `tests/estudo-ocr/analisar.mjs` monta as palavras de cada linha como `lerComOcr()` monta (com `corrigirOcr()`
em cada palavra) e usa as funções de verdade de `src/achados.js`:

- **Antes** é `procurar()` de hoje.
- **Depois** é `procurar()` mais a regra proposta (`tests/estudo-ocr/regra.mjs`), rodada sobre o texto juntado da
  linha (o de `juntarTexto()`).
- **Leitura do @**: o texto esperado e o lido são alinhados letra a letra; a leitura do @ é o que ficou entre a
  última letra antes dele e a primeira depois dele (com os espaços, que aparecem como `␣`).
- **E-mail inteiro**: alguma sugestão cobre todo o trecho lido no lugar do e-mail. "Algum" quer dizer que houve
  sugestão de e-mail na linha, mesmo que só parte dele.

## O @ não existe para este OCR

Os 117 caracteres que o `por.traineddata.gz` embutido sabe escrever:

```
! " $ % & ' ( ) * + , - . / 0-9 : ; < = > ? A-Z [ ] a-z | £ « º » À Á Â Ã Ç É Ê Í Ó Ô Õ Ú à á â ã ç é ê í ó ô õ ú — “ ” €
```

Não há `@`, `_`, `#`, `§`, `©` nem `®`. Consequências:

- o Tesseract nunca devolve @: em 9.606 e-mails e 966 páginas, nenhuma palavra lida tem @;
- a troca de `©` e `®` em `corrigirOcr()` nunca acontece com este OCR (não faz mal, mas não ajuda);
- e-mail com `_` (como `fulano_teste@...`) também não pode ser lido certo. O estudo não testou esse caso.

## Leituras do @ por frequência

As 40 mais comuns, com os espaços (`␣`) em volta como foram lidos. "A regra aceita?" foi testado de verdade:
`fulano.teste` + leitura + `exemplo.gov.br`, passado por `corrigirOcr()`, `procurar()` e a regra proposta.

| Leitura (␣ = espaço) | Vezes | % | % acumulado | A regra aceita? |
|---|---:|---:|---:|---:|
| `&` | 1910 | 19,9% | 19,9% | sim |
| `G` | 973 | 10,1% | 30,0% | não |
| `Q` | 639 | 6,7% | 36,7% | sim |
| `(D` | 574 | 6,0% | 42,6% | sim |
| `O` | 446 | 4,6% | 47,3% | não |
| `g` | 423 | 4,4% | 51,7% | não |
| `t` | 323 | 3,4% | 55,0% | não |
| `(Q` | 223 | 2,3% | 57,4% | sim |
| `(O` | 219 | 2,3% | 59,7% | sim |
| `(&` | 171 | 1,8% | 61,4% | sim |
| `&Q` | 168 | 1,7% | 63,2% | sim |
| `␣&` | 155 | 1,6% | 64,8% | sim |
| `Q&` | 154 | 1,6% | 66,4% | sim |
| `␣Q` | 123 | 1,3% | 67,7% | não |
| `E` | 117 | 1,2% | 68,9% | não |
| `␣O` | 116 | 1,2% | 70,1% | não |
| `&G` | 103 | 1,1% | 71,2% | sim |
| `G&` | 96 | 1,0% | 72,2% | sim |
| `&g` | 96 | 1,0% | 73,2% | sim |
| `t&` | 85 | 0,9% | 74,1% | sim |
| `ê` | 80 | 0,8% | 74,9% | sim |
| `d` | 78 | 0,8% | 75,7% | não |
| `&D` | 73 | 0,8% | 76,5% | sim |
| `e` | 72 | 0,7% | 77,2% | não |
| `␣G` | 60 | 0,6% | 77,8% | não |
| `0` | 55 | 0,6% | 78,4% | não |
| `O&` | 54 | 0,6% | 79,0% | sim |
| `&M` | 52 | 0,5% | 79,5% | sim |
| `␣` | 52 | 0,5% | 80,1% | não |
| `gG` | 51 | 0,5% | 80,6% | não |
| `&&` | 45 | 0,5% | 81,1% | sim |
| `(&D` | 42 | 0,4% | 81,5% | sim |
| `(o` | 41 | 0,4% | 81,9% | sim |
| `&␣` | 36 | 0,4% | 82,3% | sim |
| `C` | 36 | 0,4% | 82,7% | não |
| `(d` | 34 | 0,4% | 83,0% | sim |
| `f` | 34 | 0,4% | 83,4% | não |
| `B` | 33 | 0,3% | 83,7% | não |
| `␣E` | 32 | 0,3% | 84,1% | não |
| `(P` | 30 | 0,3% | 84,4% | sim |

Leituras aceitas pela regra: 5633 de 9606 (58,6%).

Leituras diferentes: 473. As 40 mais comuns somam 84,4%.

Sem os espaços em volta (as 30 mais comuns):

| Sequência | Vezes | % | A regra aceita? |
|---|---:|---:|---:|
| `&` | 2128 | 22,2% | sim |
| `G` | 1033 | 10,8% | não |
| `Q` | 772 | 8,0% | sim |
| `(D` | 580 | 6,0% | sim |
| `O` | 577 | 6,0% | não |
| `g` | 425 | 4,4% | não |
| `t` | 324 | 3,4% | não |
| `(Q` | 226 | 2,4% | sim |
| `(O` | 223 | 2,3% | sim |
| `(&` | 180 | 1,9% | sim |
| `&Q` | 178 | 1,9% | sim |
| `E` | 162 | 1,7% | não |
| `Q&` | 158 | 1,6% | sim |
| `&G` | 104 | 1,1% | sim |
| `G&` | 97 | 1,0% | sim |
| `&g` | 96 | 1,0% | sim |
| `t&` | 85 | 0,9% | sim |
| `ê` | 80 | 0,8% | sim |
| `d` | 78 | 0,8% | não |
| `(nada)` | 77 | 0,8% | não |
| `e` | 75 | 0,8% | não |
| `&D` | 74 | 0,8% | sim |
| `O&` | 62 | 0,6% | sim |
| `0` | 56 | 0,6% | não |
| `C` | 55 | 0,6% | não |
| `&M` | 52 | 0,5% | sim |
| `gG` | 51 | 0,5% | não |
| `&&` | 45 | 0,5% | sim |
| `(&D` | 42 | 0,4% | sim |
| `(o` | 41 | 0,4% | sim |

## Quais leituras aparecem só entre duas partes com cara de e-mail

Para cada uma das 30 leituras mais comuns, a conta de quantos contraexemplos (textos que não são e-mail, lidos
pelo OCR, escritos à mão ou tirados do repositório) têm a mesma sequência no mesmo formato: colada entre uma parte
com cara de usuário e uma parte com cara de domínio.

| Sequência | No lugar do @ | Contraexemplos com a sequência nesse formato | Exemplo |
|---|---:|---:|---:|
| `&` | 2128 | 4 | `G&Q-emexemplo.test` |
| `G` | 1033 | 2 | `meuGov.gov.br` |
| `Q` | 772 | 1 | `ARQUITETURA.md` |
| `(D` | 580 | 0 |  |
| `O` | 577 | 4 | `SistemaOnline.edu.br` |
| `g` | 425 | 9 | `Original.pdf` |
| `t` | 324 | 305 | `relatorio.final.pdf` |
| `(Q` | 226 | 0 |  |
| `(O` | 223 | 1 | `Ata(Original.pdf` |
| `(&` | 180 | 0 |  |
| `&Q` | 178 | 0 |  |
| `E` | 162 | 10 | `portalEducacao.gov.br` |
| `Q&` | 158 | 0 |  |
| `&G` | 104 | 0 |  |
| `G&` | 97 | 0 |  |
| `&g` | 96 | 0 |  |
| `t&` | 85 | 0 |  |
| `ê` | 80 | 0 |  |
| `d` | 78 | 14 | `edital.pdf` |
| `e` | 75 | 1551 | `exemplo.edu.br` |
| `&D` | 74 | 0 |  |
| `O&` | 62 | 0 |  |
| `0` | 56 | 0 |  |
| `C` | 55 | 8 | `TarjaLivre-OCR-1.2.1.html` |
| `&M` | 52 | 0 |  |
| `gG` | 51 | 0 |  |
| `&&` | 45 | 0 |  |
| `(&D` | 42 | 0 |  |
| `(o` | 41 | 0 |  |
| `B` | 35 | 1 | `CONTRIBUTING.md` |

O que a tabela mostra:

- **Sequências com `(`**: aparecem praticamente só no lugar do @. O `(` aberto, colado nas duas pontas e sem `)`
  depois, não é texto comum. O único caso de texto comum foi `Ata(Original.pdf`, que a regra descarta pela extensão.
- **Sequências com `&`**: o `&` aparece em muito texto comum (`P&D`, `Q&A`, `Silva & Souza`, endereços com `&` na
  pergunta), mas quase nunca colado entre usuário e domínio. Os 4 casos são o contraexemplo feito de propósito
  (`Veja G&Q em exemplo.test`, que o OCR leu `G&Q-emexemplo.test`, e a regra descarta porque a parte antes tem só 1
  letra), `Edital&Anexo.pdf` (descartado pela extensão) e os dois endereços de site com `&` no meio.
- **Letras minúsculas sozinhas** (`e`, `t`, `d`, `g`): aparecem dentro de endereço de site e de nome de arquivo.
  `e` está no formato em 1.551 contraexemplos. `g` aparece menos só porque o corpo tem poucos domínios com `g` no meio
  (`programa.exemplo.gov.br`, `agenda.exemplo.edu.br`). Não podem ser aceitas.
- **Letras maiúsculas sozinhas** (`G`, `O`, `E`, `Q`, `C`, `B`): aparecem pouco, porque endereço de site
  costuma ser todo em minúsculas. Os casos são endereços com maiúscula no meio (`meuGov.gov.br`,
  `portalEducacao.gov.br`) e nomes de arquivo (`ARQUITETURA.md`). É a base da opção das maiúsculas coladas, abaixo.
- **`ê`**: aparece em muitas palavras em português (64 contraexemplos têm `ê`), mas nunca colado entre usuário e
  domínio, porque não existe em endereço de site.

## Proposta de regra

### A lista curta

Aceitar no lugar do @ uma destas 11 sequências, com maiúsculas e minúsculas como estão:

| Sequência | Por quê |
|---|---|
| `&` | a leitura mais comum (22% sem os espaços). Também cobre `G&`, `&Q`, `Q&`, `&G`, `&g`, `t&`, `&M`, `&D`, `O&`, `G&G`, `Q&Q`..., porque a letra colada fica na parte antes ou no domínio e o trecho sugerido é o mesmo |
| `&&` | o `&` duplo (45 vezes) |
| `(D`, `(Q`, `(O`, `(o`, `(d`, `(P`, `(E`, `(&` | o `(` seguido de uma letra que o OCR tira do desenho do @. Também cobre `(&D`, `(OD`, `(QW`... |
| `ê` | leitura das fontes mono (80 vezes sozinho, 120 com outra letra junto) |

O `Q` colado (8% das leituras) já é trocado por `corrigirOcr()` e continua assim.

### Quando aceitar

A regra roda sobre o texto juntado da linha, o de `juntarTexto()`, e não palavra por palavra como `corrigirOcr()`:
em 7,5% dos casos o OCR põe um espaço antes ou depois da sequência (`fulano.teste &exemplo.test`), e aí o e-mail fica em
duas palavras. Aceitar quando tudo isto vale:

1. a sequência é uma da lista;
2. pode haver um espaço antes ou depois da sequência, **nunca dos dois lados** (`Silva & Souza` é texto comum);
3. a parte antes tem 2 caracteres ou mais, só os que o padrão de e-mail aceita (`A-Z a-z 0-9 . _ % + -`), termina
   em letra ou algarismo e não vem logo depois de `/`, `\`, `=`, `?` ou `#` (pedaço de caminho ou de endereço de site);
4. o domínio tem ponto, o primeiro pedaço dele tem 2 caracteres ou mais e o último é só de letras (2 ou mais);
5. o último pedaço do domínio **não é extensão de arquivo** (`pdf`, `doc`, `docx`, `odt`, `xls`, `xlsx`, `jpg`,
   `png`, `txt`, `md`, `html`, `zip` e as outras de `EXTENSOES` em `regra.mjs`);
6. se a sequência tem `(`, não há `)` no resto da palavra (`Portal(exemplo.gov.br)` é texto comum).

A sugestão é o trecho todo, da parte antes até o fim do domínio, como lido. Não precisa trocar a sequência por @
no texto: o tamanho do texto não muda e as caixas das letras continuam certas. Na prática, é mais um padrão de e-mail
em `PADROES`, só para páginas lidas por OCR. A expressão está em `criarRegra()` de `tests/estudo-ocr/regra.mjs`.

### Correção na regra de hoje

Pôr a condição 5 (extensão de arquivo) também na troca do `Q` em `corrigirOcr()`. Hoje, numa página lida pelo OCR,
`ARQUITETURA.md` vira `AR＠UITETURA.md` e é sugerido como e-mail. Com a condição, não vira, porque `md` é extensão.

### Opções, para a equipe decidir

| Opção | O que aceita a mais | Ganho | Risco medido |
|---|---|---:|---|
| A. `␣Q` | `Q` depois de um espaço e colado no domínio, com o domínio começando em minúscula (`fulano.teste Qexemplo.test`). É a leitura do `e2e_ocr` no Linux | +1,3 ponto | `Acesse Qualidade.gov.br` vira e-mail |
| B. maiúsculas coladas | 1 ou 2 letras maiúsculas (`G`, `O`, `E`, `Q`, `D`, `B`, `P`, `Ek`, `G0`, `QD`...) coladas entre uma parte antes toda em minúsculas e algarismos e um domínio todo em minúsculas, sem `www.` e sem `/` depois (`fulanoGexemplo.gov.br`) | +16,9 pontos | endereço de site com maiúscula no meio vira e-mail: `portalEducacao.gov.br`, `meuGov.gov.br`, `exemploDigital.com.br`, `cursoOnline.exemplo.edu.br` |

Nos 9.624 contraexemplos lidos pelo OCR e nas 1.043 linhas do repositório, nenhuma das duas opções criou falso
positivo. Os erros acima são de contraexemplos escritos à mão para achar o limite de cada uma.

## Taxa de acerto antes e depois

Simulação sobre as leituras de verdade (a regra rodando sobre o que o OCR leu):

|  | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| Todos | 9606 | 6,8% | 7,0% | 54,6% | 56,1% |

Teto: se o OCR lesse o @ certo e o resto do e-mail como leu, a procura de hoje acharia o e-mail inteiro em 8802 de 9606 (91,6%). O que falta até o teto é o @ lido como outra coisa que a regra não aceita; o que falta depois do teto são erros do OCR em outras letras do e-mail.

Comparando listas de sequências (todas com as mesmas condições 2 a 6):

| Lista | E-mail inteiro sugerido | Contraexemplos que viram e-mail (todos) | Só os lidos pelo OCR |
|---|---:|---:|---:|
| hoje (só corrigirOcr) | 654 (6,8%) | 1 de 10764 (0,0%) | 0 de 9624 (0,0%) |
| a proposta | 5245 (54,6%) | 3 de 10764 (0,0%) | 0 de 9624 (0,0%) |
| a proposta + ␣Q (Q depois de um espaço, colado no domínio) | 5365 (55,9%) | 4 de 10764 (0,0%) | 0 de 9624 (0,0%) |
| a proposta + ␣Q, ␣O, ␣G | 5531 (57,6%) | 5 de 10764 (0,0%) | 0 de 9624 (0,0%) |
| a proposta + letras sozinhas (G, g, O, E...) | 8239 (85,8%) | 1276 de 10764 (11,9%) | 1240 de 9624 (12,9%) |
| só "&" e "(D" | 4293 (44,7%) | 3 de 10764 (0,0%) | 0 de 9624 (0,0%) |
| a proposta + maiúsculas coladas entre minúsculas | 6871 (71,5%) | 7 de 10764 (0,1%) | 0 de 9624 (0,0%) |
| a proposta + ␣Q + maiúsculas coladas | 6991 (72,8%) | 8 de 10764 (0,1%) | 0 de 9624 (0,0%) |

### Por tipo de fonte

| tipo de fonte | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| mono | 3000 | 1,1% | 1,3% | 16,4% | 17,4% |
| sem serifa | 4054 | 13,1% | 13,4% | 70,7% | 72,7% |
| serifa | 2552 | 3,5% | 3,6% | 73,9% | 75,4% |

### Por fonte

| fonte | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| Bitstream Charter | 300 | 9,3% | 9,7% | 83,3% | 84,7% |
| Caladea | 451 | 2,0% | 2,0% | 90,7% | 92,0% |
| Carlito | 451 | 7,1% | 7,1% | 44,1% | 45,9% |
| Courier 10 Pitch | 300 | 0,0% | 0,0% | 33,7% | 34,0% |
| DejaVu Sans | 451 | 3,1% | 3,1% | 72,5% | 72,5% |
| DejaVu Sans Mono | 450 | 0,0% | 0,2% | 2,4% | 2,7% |
| DejaVu Serif | 451 | 5,3% | 5,3% | 76,1% | 77,2% |
| FreeMono | 450 | 0,0% | 0,0% | 23,8% | 24,7% |
| FreeSans | 451 | 9,1% | 9,5% | 78,3% | 80,5% |
| FreeSerif | 450 | 0,2% | 0,2% | 33,3% | 37,6% |
| Inter | 450 | 31,1% | 31,1% | 81,1% | 82,7% |
| JetBrains Mono | 450 | 2,0% | 2,7% | 5,1% | 5,8% |
| Liberation Mono | 450 | 2,7% | 3,1% | 23,1% | 25,8% |
| Liberation Sans | 451 | 7,8% | 8,0% | 73,2% | 74,1% |
| Liberation Serif | 450 | 0,4% | 0,7% | 92,7% | 93,1% |
| Noto Sans | 450 | 2,2% | 2,2% | 69,6% | 70,9% |
| Noto Sans Mono | 450 | 0,2% | 0,2% | 23,8% | 24,7% |
| Noto Serif | 450 | 5,8% | 6,0% | 70,2% | 70,7% |
| Open Sans | 450 | 4,7% | 4,7% | 68,0% | 69,1% |
| Roboto | 450 | 20,2% | 21,8% | 81,1% | 87,3% |
| Ubuntu | 450 | 32,7% | 33,1% | 68,7% | 71,6% |
| Ubuntu Mono | 450 | 2,4% | 2,7% | 8,9% | 9,6% |

### Por tamanho, resolução, estado e desenho

| tamanho (pt) | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| 8 | 1920 | 6,6% | 7,1% | 53,7% | 55,9% |
| 10 | 1920 | 6,1% | 6,3% | 54,5% | 56,1% |
| 12 | 1920 | 7,3% | 7,4% | 56,3% | 57,2% |
| 14 | 1920 | 7,0% | 7,1% | 55,3% | 56,7% |
| 16 | 1920 | 6,9% | 7,2% | 53,3% | 54,8% |
| 17.28 | 6 | 33,3% | 33,3% | 50,0% | 50,0% |

O tamanho 17,28 pt é a página da reprodução (36 px a 150 ppp).

| dpi | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| 150 | 3206 | 4,2% | 4,5% | 54,1% | 56,4% |
| 200 | 3200 | 7,7% | 8,0% | 54,6% | 56,0% |
| 300 | 3200 | 8,5% | 8,7% | 55,0% | 56,0% |

| estado | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| limpa | 6306 | 6,6% | 6,8% | 54,4% | 55,7% |
| ruido | 3300 | 7,2% | 7,5% | 55,0% | 57,0% |

| desenho | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| navegador | 3000 | 6,4% | 6,4% | 55,7% | 56,6% |
| pil | 6600 | 7,0% | 7,3% | 54,1% | 55,9% |
| reproducao | 6 | 33,3% | 33,3% | 50,0% | 50,0% |

O tamanho, a resolução e o ruído mudam pouco o resultado: o que decide é a fonte. Desenhar no Pillow ou no canvas
do navegador também dá quase o mesmo resultado.

### Por tipo de e-mail

| final do domínio | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| .com.br | 2400 | 6,5% | 6,8% | 53,2% | 54,4% |
| .edu.br | 2400 | 7,8% | 8,0% | 56,0% | 57,8% |
| .gov.br | 2400 | 4,7% | 4,9% | 59,3% | 60,8% |
| .test | 2406 | 8,3% | 8,5% | 49,9% | 51,6% |

| parte antes do @ | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| com hífen | 2700 | 6,7% | 6,9% | 62,9% | 63,6% |
| com número | 3300 | 5,1% | 5,4% | 43,5% | 46,3% |
| com ponto | 1806 | 9,2% | 9,4% | 61,1% | 62,5% |
| simples | 1800 | 7,7% | 7,8% | 56,0% | 56,6% |

E-mail com número na parte antes do @ acerta menos porque o OCR também erra os algarismos perto do @
(`aluno1239orgao-teste.gov.br`, com o @ lido como `9`).

### O que continua sem sugestão

| Situação | Vezes |
|---|---:|
| sem sugestão | 4214 |
| sugestão parcial | 147 |

Desses, cerca de 3.600 têm o resto do e-mail lido certo: falta só o @, lido como letra sozinha (`G`, `O`, `g`, `t`,
`␣Q`, `␣O`, `E`, `d`...). Os outros cerca de 800 têm erro do OCR em outra letra do e-mail, e nenhuma regra do @
resolve. Para passar da casa dos 55% sem aceitar letras sozinhas seria preciso outro caminho, como ler de novo, com
outro modelo que tenha o @, a palavra suspeita. Isso não foi medido aqui.

## Contraexemplos e falso positivo

Três origens de texto que **não** é e-mail:

- **ocr**: as 10 linhas comuns de cada página (CPF, datas, nomes, endereços com `QD` e `Bloco WO`, `Q&A`, `P&D`,
  `Silva & Souza`, `WO 1234`, endereços de site, nomes de arquivo...), lidas pelo mesmo OCR;
- **escrito**: os 97 textos de `tests/estudo-ocr/contraexemplos.txt`, escritos à mão para cair perto da regra
  (siglas com `&`, endereços com `QD`, `Q`, `WO`, endereços de site e de arquivo, palavras coladas pelo OCR, endereço
  com maiúscula no meio). Inclui dois endereços de site com `&` que a regra erra de propósito, para a taxa ser
  honesta;
- **repositorio**: todas as linhas sem @ dos textos do próprio repositório (`README.md`, `CHANGELOG.md`, `docs/*.md`,
  `THIRD-PARTY-NOTICES.md`, `LICENSE` e as licenças em `vendor/`), cheias de endereços de site, caminhos e siglas.

Os escritos e os do repositório passam pela procura como palavras soltas, cada uma por `corrigirOcr()`, como o OCR
entrega.

| Origem | Textos | Viram e-mail antes | Viram e-mail depois | Taxa depois |
|---|---:|---:|---:|---:|
| ocr | 9624 | 0 | 0 | 0,0% |
| escrito | 97 | 0 | 2 | 2,1% |
| repositorio | 1043 | 1 | 1 | 0,1% |

Taxa de falso positivo da regra proposta: **0 em 9.624** textos lidos pelo OCR, **0 novo em 1.043** linhas do
repositório (o único é o `AR＠UITETURA.md` de hoje) e **2 em 97** escritos à mão para cair perto da regra (2,1%,
os dois endereços de site com `&` no meio).

Exemplos de texto comum que a regra **não** transforma em e-mail (todos medidos): `CPF: 831.975.872-60`,
`Data: 30/10/2026`, `Nome: Fulano de Teste`, `Endereço: QD 05 Lote 12`, `QD05 LT12 Setor Teste`,
`SQS 308 Bloco WO, apto. 101`, `WO 1234 Ordem de serviço`, `Fiz o QD da turma e o WO do setor`, `Q&A do edital 3/2026`,
`P&D e inovação no campus`, `Silva & Souza Ltda.`, `Barros&Lima Advogados`, `AT&T e Q&A são siglas`, `M&M.com.br`,
`Q&A.exemplo.test`, `Pesquisa & Extensão: exemplo.edu.br`, `Portal(exemplo.gov.br)`, `Ata(Original.pdf`,
`Anexo Edital&Anexo.pdf`, `Planilha G&Q.xlsx`, `https://exemplo.gov.br/sei/consulta&id=5`, `C:\Documentos\Q&A\edital.pdf`,
`Fulano(Diretor)de Teste`, `Portal Gov.br`, `Consulte o QEdu.org.br`.

## Os seis casos do defeito 3

A tabela de `docs/LINUX.md` e a reprodução daqui, com a mesma página de `tests/e2e_ocr.mjs` e o mesmo Chromium.

| Fonte | Lido no docs/LINUX.md | Hoje | Proposta | + ␣Q | + ␣Q + maiúsculas | Lido na reprodução daqui | Hoje | Proposta | + ␣Q | + ␣Q + maiúsculas |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Liberation Sans | `fulano.teste␣WOexemplo.test` | não | não | não | não | `fulano.teste␣Qexemplo.test` | não | não | sim | sim |
| DejaVu Sans | `fulano.testeG&Qexemplo.test` | não | sim | sim | sim | `fulano.testegexemplo.test` | não | não | não | não |
| FreeSans | `fulano.testeQDexemplo.test` | sim | sim | sim | sim | `fulano.testeQexemplo.test` | sim | sim | sim | sim |
| Carlito | `fulano.teste␣Qexemplo.test` | não | não | sim | sim | `fulano.teste␣Qexemplo.test` | não | não | sim | sim |
| Caladea | `fulano.teste&Qexemplo.test` | não | sim | sim | sim | `fulano.teste&exemplo.test` | não | sim | sim | sim |
| DejaVu Serif | `fulano.testeQ&exemplo.test` | não | sim | sim | sim | `fulano.testeGQexemplo.test` | sim | sim | sim | sim |

A leitura muda com detalhes do desenho que não mudam o texto: com o mesmo Chromium, só uma das seis leituras daqui
(Carlito) saiu igual à de `docs/LINUX.md`. A validação usou o nome "Arial" (que vira Liberation Sans) e o programa
inteiro; aqui, o nome da fonte direto. A causa da diferença não foi investigada. Por isso a regra não deve depender
de uma sequência exata e rara: `WO`, `QD` e `G&Q`, citadas no defeito, quase não aparecem nas 9.606 leituras (`WO`
nenhuma vez, `QD` 7 vezes, `G&Q` 4 vezes).

Com a proposta, o `e2e_ocr` no Linux ainda pode falhar (Liberation Sans leu `␣WO` lá e `␣Q` aqui). Com a opção A,
passa na leitura daqui.

## Limites do estudo

- As páginas são fabricadas. Não houve documento digitalizado de verdade, com papel, carimbo, assinatura, fundo de cor
  ou fonte de impressora.
- Uma fonte por página, só no peso normal (sem negrito e sem itálico), e o e-mail sempre numa linha só.
- Domínios só com `.com.br`, `.gov.br`, `.edu.br` e `.test`. Sem `_` no e-mail.
- O ruído e a inclinação são simulados.
- Os contraexemplos escritos à mão são poucos (97). O teste de falso positivo mais forte é o das linhas do
  repositório e o das linhas lidas pelo OCR, mas os textos do repositório não são documentos de órgão público.
- Só o Chromium. Firefox e WebView2 usam o mesmo Tesseract (WebAssembly), mas desenham o PDF de outro jeito.

## Arquivos e como repetir

Tudo em `tests/estudo-ocr/`:

| Arquivo | O que é |
|---|---|
| `gerar.py` | gera as páginas (imagens em `files/estudo-ocr/paginas/`, fora do Git) e as listas `paginas.csv` e `linhas.csv` |
| `ler.mjs` | lê as páginas com o OCR do HTML montado e grava `palavras.csv` |
| `analisar.mjs` | junta tudo, mede antes e depois e grava `leituras.csv`, `contraexemplos.csv` e `resultados.md` |
| `regra.mjs` | a regra proposta e as opções, só para a simulação |
| `csv.mjs` | leitura e gravação dos CSV |
| `contraexemplos.txt` | os contraexemplos escritos à mão |
| `paginas.csv` | uma linha por página: desenho, fonte, tamanho, resolução, estado, ângulo |
| `linhas.csv` | uma linha por linha de texto da página: o texto esperado, o e-mail, a posição |
| `palavras.csv` | **dado bruto**: cada palavra que o OCR leu, com a caixa e a confiança |
| `leituras.csv` | uma linha por e-mail: o texto lido, a leitura do @, a sugestão antes e depois, o teto |
| `contraexemplos.csv` | uma linha por texto que não é e-mail: o texto lido e a sugestão antes e depois |
| `resultados.md` | todas as tabelas, geradas por `analisar.mjs` |

Na raiz do repositório, com Python 3 (Pillow e NumPy), Node 22, o Playwright com o Chromium dele e as fontes
instaladas (no Ubuntu, `fonts-dejavu-core`, `fonts-liberation`, `fonts-freefont-ttf`, `fonts-noto-core`,
`fonts-crosextra-carlito`, `fonts-crosextra-caladea`, `fonts-roboto`, `fonts-open-sans`, `fonts-ubuntu`,
`fonts-inter`, `fonts-jetbrains-mono` e `xfonts-scalable`):

```bash
python3 scripts/montar.py
```

```bash
python3 tests/estudo-ocr/gerar.py
```

```bash
node tests/estudo-ocr/ler.mjs 4
```

```bash
node tests/estudo-ocr/analisar.mjs
```

`gerar.py` sai igual a cada vez (semente fixa) e leva uns 5 minutos. `ler.mjs` leva uns 8 minutos com 4
trabalhadores e continua de onde parou se `palavras.csv` já tiver páginas; para ler tudo de novo, apague o
`palavras.csv` antes. `analisar.mjs` leva segundos e só precisa dos CSV: para testar outra regra, mude `regra.mjs` e
rode só ele.
