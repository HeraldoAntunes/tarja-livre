<!-- Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE) -->
# Uso da interface da 1.2.2 no Linux

Este documento conta os testes de ponta a ponta do **uso** da interface da Tarja Livre 1.2.2 no Linux, em
03/11/2026, com navegador sem janela e só PDFs sintéticos com dados fictícios. Se a tarja apaga mesmo o dado é
assunto de outra validação; aqui o foco é se dá para usar o programa.

Não repeti o que já estava provado nos relatórios anteriores
([E2E-MULTIPLATAFORMA.md](E2E-MULTIPLATAFORMA.md), [E2E-LINUX-2.md](E2E-LINUX-2.md),
[E2E-LINUX-3.md](E2E-LINUX-3.md)) e nos e2e do repositório:

- cobertura pixel a pixel (`e2e_pdf_teste`, `e2e_export_real`);
- queda do navegador e recuperação das marcas com o mesmo perfil (`e2e_andamento`);
- desfazer e refazer pelo teclado, e várias abas (`e2e_varios`);
- a tela de 1366×768 sem transbordar (`e2e_telas`).

## O que foi testado

- **Versão:** a `main` em `e3404f5`, que é a tag `v1.2.2` (`8196a82`) mais três commits. Desses três, só um mexe no
  programa: o escape das leituras do @ do OCR em `src/achados.js`, que este teste não usa (os PDFs têm texto, sem
  OCR).
- **Ramo:** `e2e-linux-1.2.2`. É a `main` com o merge do ramo `e2e-multiplataforma`, que traz a camada para rodar os
  e2e no Linux. Nada em `src/` mudou.
- **Onde:**

| Item | Versão |
|---|---|
| Sistema | Ubuntu 24.04.5 LTS, num contêiner sem tela |
| Chromium | Chrome for Testing 153.0.8010.12 (o do Playwright 1.63.0), sem janela |
| Firefox | 136.0, sem janela |
| Node.js / Python | 22.22.0 / 3.13.17, com PyMuPDF 1.27.2.3 |

- **O teste:** [`tests/e2e_uso.mjs`](../tests/e2e_uso.mjs), novo. Ele gera os PDFs na hora, com o jsPDF do próprio
  programa. Cada página traz uma declaração com nome, CPF e e-mail fictícios. Rodou três vezes: no Chromium e no
  Firefox com `LANG=C.UTF-8`, e no Chromium sem `LANG` (o locale C, comum em contêiner e CI). Em cada execução, a
  `/tmp` foi comparada antes e depois: nenhuma sobra.

Para repetir:

```bash
LANG=C.UTF-8 TARJA_NAVEGADOR=chromium node tests/e2e_uso.mjs
```

```bash
LANG=C.UTF-8 TARJA_NAVEGADOR=firefox node tests/e2e_uso.mjs
```

Os tempos e o que o teste viu vão para `files/e2e-uso/resultado-<navegador>.json`. As capturas ficam na mesma pasta.

## Resultado

O teste reprova nos três casos, sempre pelo mesmo motivo: o **achado 1** (o botão Procurar fica desligado para
sempre). Fora isso, todos os passos passaram nos dois navegadores.

| Passo | Chromium | Firefox |
|---|---|---|
| A. Abrir 1 e 300 páginas | passou | passou |
| B. Marcar, desfazer e refazer pelos botões | passou | passou |
| C. Procurar nas 300 páginas e tarjar as 900 ocorrências | passou | passou |
| D. Salvar as 300 páginas e conferir com o PyMuPDF | passou | passou |
| E. PDF com senha | passou (achado 3) | passou (achado 3) |
| F. Sete PDFs corrompidos | passou | passou |
| G. Nome acentuado (NFC e NFD) | passou com UTF-8; sem locale, achado 5 | passou |
| H. Fechar no meio e reabrir | **falhou** (achado 1; também achados 2 e 4) | **falhou** (achado 1; também achados 2 e 4) |
| I. Telas de 1366×768 e 1920×1080 | passou | passou |

### Tempos

Em milissegundos, da execução final de cada navegador (com `LANG=C.UTF-8`).

| Medida | Chromium | Firefox |
|---|---|---|
| Abrir o PDF de 1 página até a página aparecer | 108 | 114 |
| Abrir o PDF de 300 páginas até a página 1 aparecer | 136 | 127 |
| Pior demora da página para responder enquanto as 300 abrem | 10 | 5 |
| Desenhar as 300 miniaturas | 321 | 655 |
| Procurar nas 300 páginas (CPF, e-mail e um nome da lista) | 424 | 524 |
| Aceitar as 900 sugestões | 158 | 72 |
| Passar pelas 300 páginas clicando nas miniaturas | 16.129 | 32.138 |
| Salvar as 300 páginas (do clique ao arquivo pronto) | 105.985 | 177.313 |

O PDF de 300 páginas tem 199 KB. O salvo tem 7,3 MB (Chromium) e 7,4 MB (Firefox), em PNG, e a folha de conferência
dele ocupa 2 páginas. Salvar 300 páginas leva quase 2 minutos no Chromium e 3 no Firefox, com a barra de andamento
na tela. É lento, mas não trava.

### O que foi conferido em cada passo

- **A.** As 300 páginas abrem em menos de 0,2 s, e a página continua respondendo durante a abertura (a pior demora
  foi de 10 ms). As 300 miniaturas ficam desenhadas em menos de 1 s.
- **B.** Três tarjas, desfazer duas, refazer uma: o selo da miniatura vai a 3, 1 e 2. Uma tarja nova depois de
  desfazer esvazia o Refazer. Desfazendo tudo, o selo some e o Desfazer fica desligado.
- **C.** A procura acha 300 CPFs, 300 e-mails e 300 vezes o nome da lista. Aceitar todas dá 900 tarjas, 3 por página.
- **D.** O PDF salvo tem as 300 páginas e mais as 2 da folha. Pelo PyMuPDF:
  - as 300 páginas são só imagem, sem texto nenhum;
  - CPF, e-mail e nome não aparecem nos bytes do arquivo;
  - a folha lista "3 tarja(s)" para cada uma das 300 páginas e não mostra os dados;
  - o SHA-256 na tela é o do arquivo salvo.
- **E.** A mensagem é `com senha.pdf: PDF protegido por senha, tire a senha antes de tarjar.`: diz o arquivo, o
  motivo e o que fazer. Nenhuma aba abre, e o programa continua usável.
- **F.** Os sete corrompidos responderam todos em cerca de 0,1 s, sem travar. O teste espera 0,8 s a mais de propósito
  antes de conferir. Logo depois deles, um PDF bom abriu normalmente.

| Arquivo | O que tem | Resposta |
|---|---|---|
| `vazio.pdf` | 0 bytes | "este arquivo não parece ser um PDF." |
| `cortado-no-meio.pdf` | metade de um PDF bom | "não foi possível abrir este PDF." |
| `so-o-cabecalho.pdf` | só `%PDF-1.7` | "não foi possível abrir este PDF." |
| `cabecalho-e-lixo.pdf` | `%PDF-1.7` e 4 KB de lixo | "não foi possível abrir este PDF." |
| `sem-xref.pdf` | sem a tabela de referências | "não foi possível abrir este PDF." |
| `xref-errada.pdf` | `startxref` apontando para fora | abriu (o PDF.js consertou), 1 página |
| `conteudo-estragado.pdf` | o desenho da página trocado por lixo | abriu, 1 página |

- **G.** O nome `Relatório de Ação da Conceição São João.pdf` aparece igual no cabeçalho e na aba, nas formas Unicode
  NFC (a de sempre) e NFD (a de alguns Mac). O PDF salvo sai como
  `Relatório de Ação da Conceição São João-tarjado.pdf`, com a página e a folha. Exceção no achado 5.
- **H.** Fechar a aba durante a abertura e reabrir funcionou (mas veja o achado 4). Fechar a aba durante o desenho
  das miniaturas, 5 vezes seguidas, não trava nada, mas deixa avisos no console (achado 2). Fechar a aba no meio da
  procura deu o achado 1.
- **I.** Nas duas telas:
  - a página não transborda para os lados;
  - os 11 botões do caminho principal ficam inteiros na janela, sem nada por cima e sem texto cortado (Abrir, Ajuda,
    Procurar, Aceitar todas, Revisei, Salvar, Próxima, Anterior, Desfazer, Refazer e Fechar);
  - a página é UTF-8 e `pt-BR`;
  - o texto da tela não tem acento estragado (nenhum `Ã§`, `Â`, `�` ou entidade `&...;` sem converter) e tem uns 40
    caracteres acentuados.

  Também olhei as capturas nos dois navegadores: ç, ã, ó, é e "Título de eleitor" aparecem certos.

## Achados

Nenhum foi corrigido aqui (este trabalho não mexe em `src/`).

### 1. Fechar a aba no meio da procura deixa o botão Procurar desligado para sempre

**Gravidade: alta** para o uso. Não vaza dado, mas a procura, que é o principal recurso, para de funcionar até
recarregar a página, e nada na tela diz por quê.

Visto no Chromium e no Firefox: 2 de 6 vezes em cada execução final do teste. Numa sonda à parte, foram 6 de 10 e 4
de 4 vezes. Depende de quando a aba é fechada.

1. Abra um PDF grande (300 páginas, por exemplo).
2. Clique em **Procurar no documento** e, enquanto aparece "Procurando... página N de 300", feche a aba no X.
3. Abra o mesmo PDF (ou outro).

Esperado: **Procurar no documento** ligado, e a procura funcionando. Visto: o botão fica desligado. Continua
desligado 60 s depois, sem erro no console. Só recarregar a página (F5) traz o botão de volta.

Causa provável, pelo código: `procurarArquivos()` em `src/app.js` põe `procurando = true` e só volta a `false` quando
`procurarEm()` termina. Quando a aba é fechada, o PDF é destruído, e o `await d.pdf.getPage(i + 1)` que estava
pendente pode nunca terminar: nem resolve, nem dá erro. Aí `procurando` fica `true`, e
`el.btProcurar.disabled = !tem || procurando` mantém o botão desligado. O `if (!docs.includes(d)) return null` vem
depois do `await`, então não chega a rodar. Uma correção possível: conferir `docs.includes(d)` antes de cada
`getPage`, ou correr o `getPage` contra o fechamento da aba.

O passo H2 do `e2e_uso` repete isso 6 vezes e reprova enquanto o defeito existir.

### 2. Fechar a aba durante o desenho das miniaturas ainda deixa aviso no console

**Gravidade: baixa.** Não atrapalha quem usa (a aba fecha e nada trava), mas suja o console e deixa testes
instáveis.

A 1.2.2 tirou o `TypeError: doc is null` (ver [E2E-LINUX-3.md](E2E-LINUX-3.md)), mas o aviso continua:

```
warning: miniatura não desenhada 45 RenderingCancelledException
```

No Firefox, ele sai como `miniatura não desenhada 2 [object Object]`.

1. Abra um PDF de 300 páginas.
2. Logo que a primeira página aparecer, clique em **Fechar**.

Nas 5 vezes do passo H3, apareceram 7 avisos no Chromium e 11 no Firefox. No `e2e_varios` do repositório, rodado 10
vezes no Firefox, isso ainda reprovou 2 vezes ("console sem erro inesperado"), agora só com esse aviso.

Causa provável: em `redesenharMiniatura()` (`src/app.js`), o `catch` faz `console.warn('miniatura não desenhada', ...)`
também quando o desenho foi cancelado porque a aba fechou. Uma correção possível: não avisar quando o erro é
`RenderingCancelledException` ou quando a aba já não existe.

### 3. O aviso do PDF com senha some sozinho em 4 segundos

**Gravidade: baixa.** A mensagem é clara, mas some em 4,2 s, e depois nada na tela diz por que o arquivo não abriu
(não abre aba, não fica registro). Quem se distrai ou lê devagar vê só que "não aconteceu nada".

1. Clique em **Abrir PDF** e escolha um PDF protegido por senha.
2. Espere uns 5 s.

Visto: a mensagem aparece (conferido aos 2 s) e some (conferido aos 6 s). O mesmo vale para os PDFs corrompidos,
que usam o mesmo aviso (`avisar()` em `src/app.js`, com `setTimeout` de 4200 ms).

### 4. Fechar logo depois de escolher o arquivo não cancela a abertura

**Gravidade: baixa.**

1. Clique em **Abrir PDF**, escolha um PDF grande e, antes de a primeira página aparecer, clique em **Fechar**.

Esperado: o arquivo não abre. Visto: o Fechar não faz nada (ainda não há aba para fechar) e, logo depois, o arquivo
abre assim mesmo. Basta fechar de novo, mas quem pediu para fechar não espera ver o arquivo aberto.

### 5. Sem locale UTF-8, o Chromium salva o PDF de nome acentuado como "download"

**Gravidade: baixa, e é do ambiente, não do programa.**

1. Num Linux sem `LANG` (ou com `LANG=C`), abra no Chromium um PDF de nome acentuado, como
   `Relatório de Ação.pdf`.
2. Tarje e salve por download.

Visto: o arquivo sai com o nome `download`, sem `.pdf`. Com `LANG=C.UTF-8`, sai
`Relatório de Ação-tarjado.pdf`. No Firefox, sai certo nos dois casos. Uma sonda à parte, sem o programa, mostrou
que é o Chromium: qualquer download com acento vira `download` sem locale UTF-8, e sem acento o nome sai certo.

Atenção: no Chromium de verdade, com janela, o programa usa a caixa **Salvar como**, que o teste substitui por
download. Esse caminho não foi testado. Um Linux de mesa costuma ter locale UTF-8; contêiner, CI e alguns
computadores de laboratório, não. Para os testes, rodar com `LANG=C.UTF-8`.

### Observação (não é defeito)

Nas duas telas, o nome longo do arquivo aparece cortado na aba (`Relatório de Ação ...`). O nome inteiro está no
cabeçalho, logo abaixo de "Tarja Livre", e na dica da aba ao passar o mouse.

## O que não foi testado

- Navegador com janela: a caixa **Salvar como** do Chromium, arrastar arquivo, imprimir.
- Leitor de tela e só teclado.
- PDF digitalizado (OCR) e PDFs reais de escola. Só PDFs sintéticos com dados fictícios.
- Computador fraco: os tempos são deste contêiner.
- O Windows e o exe.
- Se a tarja apaga mesmo o dado (outra validação).

## Resumo

- 8 dos 9 passos passaram nos dois navegadores. O que falhou foi o H (fechar no meio e reabrir), pelo achado 1.
- Achado 1, de gravidade alta: fechar a aba no meio da procura pode deixar o botão Procurar desligado até recarregar
  a página.
- Achados 2 a 4, de gravidade baixa: o aviso das miniaturas no console (correção parcial da 1.2.2), o aviso do PDF
  com senha que some em 4 s, e o Fechar durante a abertura que não cancela.
- Achado 5, de gravidade baixa e do ambiente: o Chromium sem locale UTF-8 troca o nome acentuado do download por
  `download`.
- Nada foi publicado: sem tag, sem release e sem mexer na `main`.
