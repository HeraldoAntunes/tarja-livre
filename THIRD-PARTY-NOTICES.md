# Componentes de terceiros

O Tarja Livre é distribuído sob a licença MIT (ver `LICENSE`). O arquivo `Tarja Livre.html` leva dentro os
componentes abaixo, cada um com a sua licença, todas compatíveis com uso e redistribuição livres. Eles ficam **fora**
do pacote do registro no INPI e mantêm as licenças dos seus autores.

| Componente | Versão | Uso no Tarja Livre | Licença | Texto da licença |
|---|---|---|---|---|
| **PDF.js** (Mozilla) | 4.10.38 | ler e desenhar o PDF, achar o texto das páginas | Apache License 2.0 | `vendor/pdfjs/LICENSE` |
| **OpenJPEG** (Université catholique de Louvain e outros), dentro do `pdf.worker.min.mjs` | junto com o PDF.js 4.10.38 | imagens JPEG 2000 dentro de PDFs | BSD de 2 cláusulas | `vendor/pdfjs/OPENJPEG-LICENSE.txt` |
| **jsPDF** (James Hall, yWorks e colaboradores), com as partes que ele inclui (fflate e outras, MIT) | 4.2.1 | gravar o PDF novo e a folha de conferência | MIT | `vendor/jspdf/LICENSE` |
| **Tesseract.js** (projeto naptha/tesseract.js e colaboradores), com as partes que ele inclui (buffer e regenerator-runtime, MIT; ieee754, BSD-3; zlib.js, MIT) | 7.0.0 | só na versão com OCR: ler páginas digitalizadas | Apache License 2.0 | `vendor/tesseract/LICENSE-tesseract.js.md` e `worker.min.js.LICENSE.txt` |
| **Tesseract.js-core** (Tesseract OCR compilado para WebAssembly, variante `simd-lstm`) | 7.0.0 | só na versão com OCR: o reconhecimento de texto | Apache License 2.0 | `vendor/tesseract/LICENSE-tesseract.js-core.txt` |
| **Dados de português do Tesseract** (`por.traineddata`, modelo `4.0.0_best_int`, do pacote `@tesseract.js-data/por` 1.0.0) | 4.0.0 | só na versão com OCR | Apache License 2.0 (dados do projeto Tesseract; o pacote npm é MIT) | `vendor/tesseract/LICENSE-tesseract.js-core.txt` (mesmo texto da Apache 2.0) |
| **Bandeira do Brasil** (desenho de Raimundo Teixeira Mendes, 1889; SVG do Wikimedia Commons, `File:Flag_of_Brazil.svg`, versão de 09/08/2024) | baixada em 27/10/2026 | ao lado do nome no Sobre (SVG dentro da página) e no README (`docs/img/bandeira-brasil.svg`) | domínio público (símbolo nacional; uso respeitoso pela Lei 5.700/1971) | não se aplica |

Origem das cópias do OCR: pacotes npm `tesseract.js@7.0.0`, `tesseract.js-core@7.0.0` e `@tesseract.js-data/por@1.0.0`,
baixados em 27/10/2026 (SHA-256 dos pacotes: `9a93bf51…b606a`, `ba584355…18ee0` e `e9d54a37…bddac`). Os arquivos são
usados sem alteração; o worker do OCR ganha na frente uma parte do próprio Tarja Livre (`src/ocr-worker.js`) que
entrega os dados do português embutidos e recusa qualquer acesso à rede.

Origem das cópias: o PDF.js é o mesmo do Giz Livre 1.13.0 (`app/vendor/pdfjs/`); o jsPDF veio do pacote npm
`jspdf@4.2.1` (`dist/jspdf.umd.min.js`). Os arquivos são usados sem alteração; o montador só tira o `export` do
fim dos dois arquivos do PDF.js para que funcionem dentro de uma página aberta direto do disco.

O texto completo de cada licença vai dentro do próprio `Tarja Livre.html`, na janela **Ajuda e Sobre** (o
montador copia os arquivos de licença de `vendor/` e o `LICENSE` do projeto): quem baixa só o HTML recebe as
licenças junto.
