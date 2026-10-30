// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Mede a procura de e-mail em página lida pelo OCR sobre os dados do estudo (ramo estudo-ocr-email,
// tests/estudo-ocr/: 966 páginas fictícias, 9.606 e-mails e 9.624 linhas comuns, lidas pelo OCR do programa), e
// também sobre os contraexemplos escritos à mão e as linhas de texto deste repositório. Compara duas versões de
// src/achados.js: a de antes (por exemplo a da main, tirada com git show) e a de agora. Os números de
// docs/PROPOSTA-OCR-EMAIL.md saem daqui.
// Uso: node tests/medir_ocr_email.mjs <pasta tests/estudo-ocr do estudo> <achados.js de antes> [achados.js de agora]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const [pasta, arqAntes, arqAgora = join(RAIZ, 'src', 'achados.js')] = process.argv.slice(2);
if (!pasta || !arqAntes) {
  console.error('Uso: node tests/medir_ocr_email.mjs <pasta do estudo> <achados.js de antes> [achados.js de agora]');
  process.exit(2);
}
const versoes = {
  antes: await import(pathToFileURL(resolve(arqAntes)).href),
  agora: await import(pathToFileURL(resolve(arqAgora)).href),
};

function lerCsv(arq) {
  const s = readFileSync(join(pasta, arq), 'utf8');
  const linhas = [];
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (aspas) {
      if (c === '"' && s[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  const [cab, ...resto] = linhas;
  return resto.map((l) => Object.fromEntries(cab.map((k, i) => [k, l[i]])));
}
const agrupar = (lista, chave) => {
  const m = new Map();
  for (const x of lista) {
    const k = chave(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
};

const paginas = lerCsv('paginas.csv');
const linhasDa = agrupar(lerCsv('linhas.csv'), (l) => l.pagina);
const palavrasDa = agrupar(lerCsv('palavras.csv'), (w) => w.pagina);
// o trecho lido no lugar de cada e-mail (calculado pelo estudo, alinhando o texto esperado com o lido)
const leitura = new Map(lerCsv('leituras.csv').map((l) => [l.pagina + '/' + l.linha, l]));

// As palavras de cada linha da página, como lerComOcr() entrega (com o "ocr: true" e corrigirOcr da versão).
function linhasDaPagina(pag, corrigirOcr) {
  const CX = 595.28 / 2, CY = 841.89 / 2;
  const esperadas = linhasDa.get(pag.pagina);
  const ang = (+pag.angulo_graus * Math.PI) / 180;
  const grupos = new Map();
  const ws = (palavrasDa.get(pag.pagina) || []).filter((w) => w.texto && w.texto.trim());
  ws.forEach((w, k) => {
    const s = +w.escala;
    const prox = ws[k + 1];
    const eol = !prox || prox.bloco !== w.bloco || prox.paragrafo !== w.paragrafo || prox.linha_ocr !== w.linha_ocr;
    const x = +w.x0_px / s, y = +w.y1_px / s, wd = (+w.x1_px - +w.x0_px) / s, h = Math.max(3, (+w.y1_px - +w.y0_px) / s);
    // a página com ruído foi girada: o centro da palavra volta ao lugar de antes do giro para achar a linha
    const yOrig = CY + (x + wd / 2 - CX) * Math.sin(ang) + (y - h / 2 - CY) * Math.cos(ang);
    let melhor = null, dist = Infinity;
    for (const e of esperadas) {
      const d = Math.abs(yOrig - (+e.base_pt - 0.3 * +pag.tamanho_pt));
      if (d < dist) { dist = d; melhor = e; }
    }
    if (dist > (+pag.tamanho_pt * 1.9) / 2) return;
    if (!grupos.has(melhor.linha)) grupos.set(melhor.linha, []);
    grupos.get(melhor.linha).push({ str: corrigirOcr(w.texto.trim()), x, y, w: wd, h, eol, ang: 0, familia: 'sans', ocr: true });
  });
  return esperadas.map((e) => ({ e, pedacos: grupos.get(e.linha) || [] }));
}

// texto escrito → palavras soltas, como o OCR entrega
function comoOcr(texto, corrigirOcr) {
  let x = 0;
  const p = texto.split(/\s+/).filter(Boolean).map((str) => {
    const q = { str: corrigirOcr(str), x, y: 10, w: str.length * 5, h: 10, eol: false, ang: 0, familia: 'sans', ocr: true };
    x += str.length * 5 + 4;
    return q;
  });
  if (p.length) p[p.length - 1].eol = true;
  return p;
}

const ESCRITOS = readFileSync(join(pasta, 'contraexemplos.txt'), 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#'));
const textosRepo = [join(RAIZ, 'README.md'), join(RAIZ, 'CHANGELOG.md'), join(RAIZ, 'THIRD-PARTY-NOTICES.md'), join(RAIZ, 'LICENSE'),
  ...readdirSync(join(RAIZ, 'docs')).filter((f) => f.endsWith('.md') && !f.startsWith('PROPOSTA-OCR')).map((f) => join(RAIZ, 'docs', f)),
  ...['jspdf', 'pdfjs', 'tesseract'].flatMap((d) => readdirSync(join(RAIZ, 'vendor', d)).filter((f) => /LICENSE|\.txt$/i.test(f))
    .map((f) => join(RAIZ, 'vendor', d, f)))];
const DO_REPO = textosRepo.flatMap((f) => readFileSync(f, 'utf8').split('\n')).map((l) => l.trim()).filter((l) => l && !l.includes('@'));

const pct = (a, b) => (b ? (100 * a / b).toFixed(1).replace('.', ',') + '%' : '-');
const resultado = {};
for (const [nome, { procurar, corrigirOcr }] of Object.entries(versoes)) {
  const r = { emails: 0, inteiro: 0, escapam: [], porTipo: new Map(), porDesenho: new Map(), falsos: { ocr: [0, 0], escrito: [0, 0], repositorio: [0, 0] }, exemplos: [] };
  const somar = (mapa, k, ok) => { const v = mapa.get(k) || [0, 0]; v[0] += ok; v[1]++; mapa.set(k, v); };
  for (const pag of paginas) {
    for (const { e, pedacos } of linhasDaPagina(pag, corrigirOcr)) {
      const trechos = procurar(pedacos, ['email']).map((a) => a.trecho);
      if (e.tipo === 'email') {
        const l = leitura.get(pag.pagina + '/' + e.linha);
        const ok = +(l.regiao !== '' && trechos.some((t) => t.includes(l.regiao)));
        r.emails++;
        r.inteiro += ok;
        if (!ok) r.escapam.push(l);
        somar(r.porTipo, pag.tipo_fonte, ok);
        somar(r.porDesenho, pag.desenho, ok);
      } else {
        r.falsos.ocr[1]++;
        if (trechos.length) { r.falsos.ocr[0]++; r.exemplos.push(['ocr', e.texto, trechos.join(' | ')]); }
      }
    }
  }
  for (const [origem, lista] of [['escrito', ESCRITOS], ['repositorio', DO_REPO]]) {
    for (const t of lista) {
      const trechos = procurar(comoOcr(t, corrigirOcr), ['email']).map((a) => a.trecho);
      r.falsos[origem][1]++;
      if (trechos.length) { r.falsos[origem][0]++; r.exemplos.push([origem, t, trechos.join(' | ')]); }
    }
  }
  resultado[nome] = r;
}

const { antes, agora } = resultado;
console.log(`E-mails: ${agora.emails}. Sugestão do e-mail inteiro: antes ${antes.inteiro} (${pct(antes.inteiro, antes.emails)}), ` +
  `agora ${agora.inteiro} (${pct(agora.inteiro, agora.emails)}).`);
console.log('\n| Tipo de fonte | E-mails | Antes | Agora |\n|---|---:|---:|---:|');
for (const [k, [ok, n]] of [...agora.porTipo].sort()) console.log(`| ${k} | ${n} | ${pct(antes.porTipo.get(k)[0], n)} | ${pct(ok, n)} |`);
console.log('\n| Desenho da página | E-mails | Antes | Agora |\n|---|---:|---:|---:|');
for (const [k, [ok, n]] of [...agora.porDesenho].sort()) console.log(`| ${k} | ${n} | ${pct(antes.porDesenho.get(k)[0], n)} | ${pct(ok, n)} |`);
console.log('\n| Textos que não são e-mail | Quantos | Viram e-mail antes | Viram e-mail agora |\n|---|---:|---:|---:|');
for (const k of ['ocr', 'escrito', 'repositorio']) {
  console.log(`| ${k} | ${agora.falsos[k][1]} | ${antes.falsos[k][0]} | ${agora.falsos[k][0]} |`);
}
// o que ainda escapa: a leitura do @ (␣ = espaço) e se o resto do e-mail foi lido certo (o teto do estudo)
const semResto = agora.escapam.filter((l) => l.teto_arroba_certo === '1');
console.log(`\nAinda escapam ${agora.escapam.length} (${pct(agora.escapam.length, agora.emails)}): ${semResto.length} só pelo @ ` +
  `(o resto do e-mail foi lido certo) e ${agora.escapam.length - semResto.length} com outro erro do OCR no e-mail.`);
console.log('\n| Leitura do @ nos que escapam só por ele | Vezes |\n|---|---:|');
const cont = new Map();
for (const l of semResto) cont.set(l.leitura_arroba, (cont.get(l.leitura_arroba) || 0) + 1);
for (const [k, n] of [...cont].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`| \`${k.replace(/ /g, '␣') || '(nada)'}\` | ${n} |`);
const largo = (s) => s.replace(/@/g, '＠');
for (const [nome, r] of Object.entries(resultado)) {
  console.log(`\nViram e-mail (${nome}):`);
  for (const [o, t, tr] of r.exemplos) console.log(`- ${o}: \`${largo(t)}\` → \`${largo(tr)}\``);
}
