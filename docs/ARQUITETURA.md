<!-- Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE) -->
# Arquitetura do Tarja Livre

## Visão geral

O programa é uma página HTML única, sem servidor e sem acesso à rede. `scripts/montar.py` junta os fontes de `src/`
e as bibliotecas de `vendor/` em `dist/Tarja Livre.html`:

- os scripts entram escritos dentro da página, e a `Content-Security-Policy` libera cada um pelo seu SHA-256
  (`default-src 'none'`, `connect-src 'none'`, `img-src data:` (só o ícone, embutido), sem `unsafe-inline` nem `unsafe-eval`);
- o worker do PDF.js vai como texto e vira um worker `blob:` na hora, porque página aberta direto do disco
  (`file://`) não pode carregar módulo nem worker de módulo;
- o texto completo das licenças entra na janela **Ajuda e Sobre**.

| Arquivo | O que faz |
|---|---|
| `src/index.html`, `src/estilo.css` | página e visual, com os marcadores que o montador preenche |
| `src/app.js` | interface: abas de arquivos, páginas, tarjas, sugestões, carimbo, conferência e salvamento |
| `src/achados.js` | procura dos padrões e da lista de termos, seleção de texto com o cursor e correção de OCR; sem DOM, testável no Node |
| `src/ocr-worker.js` | só na versão com OCR: primeira parte do worker do Tesseract, que entrega os dados do português embutidos e recusa rede |
| `src/versao.js` | a versão, num lugar só |
| `vendor/pdfjs`, `vendor/jspdf` | PDF.js 4.10.38 e jsPDF 4.2.1, sem alteração |
| `vendor/tesseract` | Tesseract.js 7.0.0, núcleo `simd-lstm` e dados de português, sem alteração (só na versão com OCR) |

## Decisões que sustentam a tarja

- **Tudo guardado em pontos do PDF**, com origem no canto de cima da página. A tela só converte na hora de desenhar,
  então ampliar ou mudar de monitor não desalinha nada.
- **O que se vê é o que sai.** Tela, miniaturas e PDF salvo usam as mesmas opções de desenho do PDF.js (modo de
  impressão, com campos e anotações) e a mesma função para as tarjas e o carimbo.
- **Salvar refaz a página como imagem** (150 ppp, ou menos em página muito grande, para caber na memória) e monta um
  PDF novo com o jsPDF. Nada do original passa: texto, comentários, campos, metadados e JavaScript ficam para trás.
- **A conferência é do arquivo inteiro:** uma página só conta como vista quando aparece inteira, e qualquer mudança
  desmarca "Revisei". Durante o salvamento, nada muda as tarjas nem troca o documento.

## As duas versões

`montar.py` gera `dist/Tarja Livre.html` e `dist/Tarja Livre com OCR.html`. A segunda leva o Tesseract e libera
`'wasm-unsafe-eval'` (WebAssembly, não `eval` de texto); `connect-src 'none'` vale nas duas. O worker do OCR é um
texto só (a parte nossa, o núcleo e o worker do Tesseract) que vira um worker `blob:`, como o do PDF.js.

## Procura de dados pessoais

`achados.js` recebe os pedaços de texto da página (posição, tamanho e direção) e:

1. junta os pedaços numa linha, guardando de que pedaço veio cada letra (e lendo sem os espaços o texto com letras
   espaçadas);
2. procura os padrões, confere os dígitos verificadores de CPF e CNPJ e descarta trechos repetidos;
3. calcula a caixa de cada achado no "quadro da linha" (texto girado volta como retângulo em pé), medindo a largura
   das letras numa fonte da mesma família e com folga de meia letra dos lados: sobrar tarja é melhor que faltar.

Campos de formulário e caixas de texto anotadas são procurados à parte; se acharem algo, a sugestão cobre o campo
inteiro. A lista de termos do usuário é procurada antes dos padrões; um achado só é descartado se estiver inteiro
dentro de outro, e caixas vizinhas do mesmo achado viram um retângulo só. Na versão com OCR, cada palavra reconhecida
vira um pedaço de texto com a caixa tirada da imagem, marcado como lido pelo OCR, e entra na mesma procura. Como o
português do Tesseract não tem o @, nessas páginas o e-mail também é aceito com o @ lido como `&`, `(D`, `Q` e
outras sequências medidas (`docs/PROPOSTA-OCR-EMAIL.md`). A seleção com o cursor usa o mesmo
texto da página, pedido ao PDF.js uma vez só.

## Vários arquivos

`docs` é a lista dos arquivos abertos e `doc` o da tela. O que só vale para o arquivo na tela (página, zoom,
Desfazer, página do carimbo, "Revisei") vai para o objeto do arquivo na troca de aba. A procura recebe o arquivo e
pode rodar em todos. O carimbo é comum a todos.

## Testes

| Teste | O que prova |
|---|---|
| `tests/achados.test.mjs` | padrões, dígitos verificadores, caixas, texto girado e espaçado |
| `tests/montar.test.mjs` | CSP com o hash de cada script, nada carregado de fora, versão igual em todos os lugares |
| `tests/ficticios.test.mjs` | só dados de exemplo fictícios no projeto |
| `tests/e2e.mjs` | o fluxo completo no Microsoft Edge, com a página aberta por `file://` |
| `tests/e2e_pdf_teste.mjs` | o PDF de teste padronizado: cobertura pixel a pixel contra a máscara, arquivos hostis, nada do original no salvo |
| `tests/e2e_varios.mjs` | vários arquivos: abas, estado por arquivo, carimbo comum, salvar um a um, texto nas tarjas |
| `tests/e2e_ocr.mjs` | versão com OCR: página digitalizada lida, sugestões, cobertura pixel a pixel contra a máscara, sem rede; e a página fixa `tests/fixtures/ocr-email.pdf`, com e-mails de @ lido errado entre textos comuns |

O PDF de teste e a máscara são gerados byte a byte por `tests/fixtures/gerar_pdf_teste.py`; veja
`tests/fixtures/LEIA-ME.md`.
