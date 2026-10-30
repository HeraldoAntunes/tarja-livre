// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Estudo do OCR do @ (docs/ESTUDO-OCR-EMAIL.md), passo 2: lê as páginas listadas por gerar.py com o mesmo OCR do
// programa. Abre o "Tarja Livre com OCR.html" montado (python3 scripts/montar.py) no Chromium do Playwright e, dentro
// dele, faz o que lerComOcr() de src/app.js faz: a imagem vira um PDF de uma página, o PDF.js desenha a página a
// 200 ppp com as mesmas opções, e o Tesseract.js embutido (createWorker('por', 1, ...) como em obterOcr()) lê com
// recognize(canvas, {}, { blocks: true, text: false }). Cada palavra lida vai para tests/estudo-ocr/palavras.csv.
// Retoma de onde parou se o CSV já tiver páginas.
// Uso: node tests/estudo-ocr/ler.mjs [quantos trabalhadores, padrão 3]
import { createRequire } from 'node:module';
import { readFileSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lerCsv, aspas } from './csv.mjs';

// o Playwright pode estar instalado fora do projeto (no NODE_PATH), por isso o require
const { chromium } = createRequire(import.meta.url)('playwright');
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const HTML_OCR = join(RAIZ, 'dist', 'Tarja Livre com OCR.html');
const IMAGENS = join(RAIZ, 'files', 'estudo-ocr', 'paginas');
const SAIDA = join(AQUI, 'palavras.csv');
const TRABALHADORES = +process.argv[2] || 3;

const paginas = lerCsv(join(AQUI, 'paginas.csv'));
const linhasDa = new Map();
for (const l of lerCsv(join(AQUI, 'linhas.csv'))) {
  if (!linhasDa.has(l.pagina)) linhasDa.set(l.pagina, []);
  linhasDa.get(l.pagina).push(l);
}
const feitas = new Set();
if (existsSync(SAIDA)) {
  for (const l of readFileSync(SAIDA, 'utf8').split('\n').slice(1)) if (l) feitas.add(l.split(',')[0]);
} else {
  writeFileSync(SAIDA, 'pagina,bloco,paragrafo,linha_ocr,palavra,texto,confianca,x0_px,y0_px,x1_px,y1_px,escala\n');
}
const faltam = paginas.filter((p) => !feitas.has(p.pagina));
console.log(`${paginas.length} páginas, ${faltam.length} por ler, ${TRABALHADORES} trabalhadores`);

const nav = await chromium.launch();
const aba = await nav.newPage();
aba.on('pageerror', (e) => console.error('erro na página:', e.message));
await aba.goto(pathToFileURL(HTML_OCR).href);
await aba.waitForFunction(() => globalThis.Tesseract && globalThis.pdfjsLib && globalThis.jspdf);

// os trabalhadores do OCR, criados como em obterOcr() de src/app.js
await aba.evaluate(async (n) => {
  const fonte = document.getElementById('ocr-worker').textContent;
  const url = URL.createObjectURL(new Blob([fonte], { type: 'text/javascript' }));
  window.__ocr = await Promise.all(Array.from({ length: n }, () => globalThis.Tesseract.createWorker('por', 1, {
    workerPath: url, workerBlobURL: false, corePath: 'embutido/tesseract-core.js', langPath: 'embutido',
    cacheMethod: 'none', gzip: true,
  })));
}, TRABALHADORES);

// uma página: JPEG → PDF de uma página A4 → desenho a 200 ppp (como lerComOcr) → OCR. Sem JPEG (desenho
// "navegador"), a página é desenhada antes no canvas, como em tests/e2e_ocr.mjs, e vira JPEG de qualidade 0,92.
const lerPagina = (jpgBase64, desenho, trab) => aba.evaluate(async ({ jpg, desenho, trab }) => {
  const DPI_OCR = 200, MAX_LADO_PX = 12000, MAX_AREA_PX = 36e6;
  if (!jpg) {
    const { larg, alt, dpi, fonte, tamanho, linhas } = desenho;
    const cv = document.createElement('canvas');
    cv.width = larg;
    cv.height = alt;
    const x = cv.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, larg, alt);
    x.fillStyle = '#111';
    x.font = `${Math.round(tamanho * dpi / 72)}px "${fonte}"`;
    x.textBaseline = 'alphabetic';
    for (const l of linhas) x.fillText(l.texto, l.x * dpi / 72, l.base * dpi / 72);
    jpg = cv.toDataURL('image/jpeg', 0.92).split(',')[1];
    cv.width = cv.height = 0;
  }
  const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  d.addImage('data:image/jpeg;base64,' + jpg, 'JPEG', 0, 0, 595.28, 841.89);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(d.output('arraybuffer')), isEvalSupported: false }).promise;
  const pg = await pdf.getPage(1);
  const v = pg.getViewport({ scale: 1 });
  const p = { w: v.width, h: v.height };
  const s = Math.min(DPI_OCR / 72, MAX_LADO_PX / Math.max(p.w, p.h), Math.sqrt(MAX_AREA_PX / (p.w * p.h)));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(p.w * s));
  c.height = Math.max(1, Math.round(p.h * s));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  await pg.render({ annotationMode: pdfjsLib.AnnotationMode.ENABLE, intent: 'print', canvasContext: ctx,
                    viewport: pg.getViewport({ scale: s }) }).promise;
  const { data } = await window.__ocr[trab].recognize(c, {}, { blocks: true, text: false });
  c.width = c.height = 0;
  await pdf.destroy();
  const saida = [];
  (data.blocks || []).forEach((b, ib) => (b.paragraphs || []).forEach((par, ip) => (par.lines || []).forEach((l, il) => {
    l.words.forEach((w, iw) => saida.push([ib, ip, il, iw, w.text, Math.round(w.confidence), w.bbox.x0, w.bbox.y0,
                                           w.bbox.x1, w.bbox.y1, s]));
  })));
  return saida;
}, { jpg: jpgBase64, desenho, trab });

let prox = 0, prontas = 0;
const inicio = Date.now();
await Promise.all(Array.from({ length: TRABALHADORES }, async (_, trab) => {
  while (prox < faltam.length) {
    const p = faltam[prox++];
    const jpg = p.desenho === 'pil' ? readFileSync(join(IMAGENS, p.pagina + '.jpg')).toString('base64') : null;
    const desenho = { larg: +p.largura_px, alt: +p.altura_px, dpi: +p.dpi, fonte: p.fonte, tamanho: +p.tamanho_pt,
                      linhas: linhasDa.get(p.pagina).map((l) => ({ texto: l.texto, x: +l.x_pt, base: +l.base_pt })) };
    const palavras = await lerPagina(jpg, desenho, trab);
    appendFileSync(SAIDA, palavras.map((w) => [p.pagina, ...w].map(aspas).join(',')).join('\n') + '\n');
    prontas++;
    if (prontas % 20 === 0) console.log(`${prontas}/${faltam.length} em ${Math.round((Date.now() - inicio) / 1000)} s`);
  }
}));
await nav.close();
console.log('pronto:', SAIDA);
