// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Prova da tarja (docs/PROVA-TARJA-1.2.2.md): para cada caso de gerar_casos.py, abre o PDF no próprio Tarja Livre
// (o HTML montado, direto do disco, no Chromium sem janela), põe os termos na lista, procura, aceita todas as
// sugestões, faz as tarjas à mão do caso, confere as páginas e salva. Depois compara pixel a pixel: onde o
// original.pdf e o sem-dados.pdf diferem (os pixels dos dados), o tarjado.pdf tem de estar escuro.
// Grava tarjado.pdf e resultado.json em cada caso. Não muda nada do programa.
//
// Uso: CHROMIUM=<chrome> node tarjar.mjs <pasta dos casos> <HTML normal> <HTML com OCR> [caso,...]
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const [CASOS, HTML, HTML_OCR, SO] = process.argv.slice(2);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const nomes = (SO ? SO.split(',') : readdirSync(CASOS).filter((n) => existsSync(join(CASOS, n, 'caso.json')))).sort();

const browser = await puppeteer.launch({ browser: 'chrome', executablePath: process.env.CHROMIUM, headless: true,
  args: ['--no-sandbox'], defaultViewport: { width: 1400, height: 900 } });

async function tarjarCaso(nome) {
  const pasta = join(CASOS, nome);
  const caso = JSON.parse(readFileSync(join(pasta, 'caso.json'), 'utf8'));
  const original = readFileSync(join(pasta, 'original.pdf'));
  const page = await browser.newPage();
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(String(e)));
  page.on('dialog', (d) => d.accept());   // "salvar com sugestões pendentes?": sim (a prova é do que foi tarjado)
  const js = (e) => page.evaluate(e);
  const ate = async (e, rotulo, ms = 180000) => {
    for (let t = 0; t < ms / 200; t++) { if (await js(e).catch(() => false)) return; await espera(200); }
    throw new Error('tempo esgotado: ' + rotulo + ' (aviso: ' + await js(`document.getElementById('aviso').textContent`).catch(() => '?') + ')');
  };
  try {
    await page.goto(pathToFileURL(caso.html === 'ocr' ? HTML_OCR : HTML).href);
    await ate(`!!globalThis.pdfjsLib && !!globalThis.jspdf`, 'carregar');
    // a caixa "Salvar como" não abre sem janela: um substituto aceita o nome sugerido e guarda o que foi gravado
    await js(`window.__salvo = null; window.showSaveFilePicker = async (o) => { const partes = [];
      return { name: o.suggestedName, createWritable: async () => ({ write: async (b) => partes.push(b),
        close: async () => { window.__salvo = { nome: o.suggestedName, blob: new Blob(partes) }; } }) }; }`);
    const b64 = original.toString('base64');
    await js(`(() => { const s = atob('${b64}'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      const dt = new DataTransfer(); dt.items.add(new File([u], 'documento.pdf', { type: 'application/pdf' }));
      const e = document.getElementById('entrada'); e.files = dt.files; e.dispatchEvent(new Event('change')); })()`);
    await ate(`document.getElementById('tela').dataset.pagina === '1'`, 'abrir');
    const paginas = Number(await js(`document.getElementById('infoPaginas').textContent`));
    // os termos vão como argumento, não como parte do código executado na página (alerta 17 do CodeQL)
    await page.evaluate((termos) => {
      const t = document.getElementById('termos'); t.value = termos; t.dispatchEvent(new Event('input'));
    }, caso.termos.join('\n'));
    await js(`document.getElementById('btProcurar').click()`);
    await ate(`!document.body.classList.contains('ocupado') && document.getElementById('resumoAchados').textContent.length > 0
      && !/Procurando|Lendo/.test(document.getElementById('resumoAchados').textContent)`, 'procurar');
    const sugestoes = await js(`document.getElementById('resumoAchados').textContent`);
    if (/pendente/.test(sugestoes)) {
      await js(`document.getElementById('btAceitarTodas').click()`);
      await ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'aceitar');
    }
    // tarjas à mão: [página (0..), x, y, largura, altura] em pontos, origem no canto de cima
    for (const [pg, x, y, w, h] of caso.tarjas) {
      await js(`document.querySelectorAll('.mini-pag')[${pg}].click()`);
      await ate(`document.getElementById('tela').dataset.pagina === '${pg + 1}'`, 'ir à página');
      const r = await js(`(() => { const r = document.getElementById('tela').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
      const [pw, ph] = await js(`(async () => { const p = await (await pdfjsLib.getDocument({ data: Uint8Array.from(atob('${b64}'), (c) => c.charCodeAt(0)), isEvalSupported: false }).promise).getPage(${pg + 1}); const v = p.getViewport({ scale: 1 }); return [v.width, v.height]; })()`);
      const px = (fx, fy) => [Math.round(r[0] + (fx / pw) * r[2]), Math.round(r[1] + (fy / ph) * r[3])];
      const [ax, ay] = px(x, y); const [bx, by] = px(x + w, y + h);
      await page.mouse.move(ax, ay); await page.mouse.down();
      for (let k = 1; k <= 5; k++) await page.mouse.move(Math.round(ax + ((bx - ax) * k) / 5), Math.round(ay + ((by - ay) * k) / 5));
      await page.mouse.up();
    }
    for (let i = 0; i < paginas; i++) {
      await js(`document.querySelectorAll('.mini-pag')[${i}].click()`);
      await ate(`document.getElementById('tela').dataset.pagina === '${i + 1}'`, 'ver a página ' + (i + 1));
    }
    await ate(`document.getElementById('infoVistas').textContent === '${paginas} de ${paginas}'`, 'todas vistas');
    const marcas = await js(`[...document.querySelectorAll('.mini-pag')].map((m) => Number(m.querySelector('.selo')?.textContent || 0)).reduce((a, b) => a + b, 0)`);
    await js(`document.getElementById('revisei').click()`);
    await js(`document.getElementById('btSalvar').click()`);
    await ate(`!!window.__salvo`, 'salvar');
    const saida = Buffer.from(await js(`(async () => { const u = new Uint8Array(await window.__salvo.blob.arrayBuffer()); let r = '';
      for (let i = 0; i < u.length; i += 0x8000) r += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(r); })()`), 'base64');
    writeFileSync(join(pasta, 'tarjado.pdf'), saida);
    // pixel a pixel, na mesma escala do programa (150 ppp)
    const pixels = await js(`(async () => {
      const ler = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        return pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise; };
      const [o, n, t] = await Promise.all(['${b64}', '${readFileSync(join(pasta, 'sem-dados.pdf')).toString('base64')}', '${saida.toString('base64')}'].map(ler));
      const desenhar = async (d, i, w, h) => { const p = await d.getPage(i); const v0 = p.getViewport({ scale: 1 });
        const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
        await p.render({ canvasContext: x, viewport: p.getViewport({ scale: w / v0.width }), annotationMode: pdfjsLib.AnnotationMode.ENABLE, intent: 'print' }).promise;
        return x.getImageData(0, 0, w, h).data; };
      const r = [];
      for (let i = 1; i <= o.numPages; i++) {
        const v = (await o.getPage(i)).getViewport({ scale: 150 / 72 }); const w = Math.round(v.width), h = Math.round(v.height);
        const [po, pn, pt] = await Promise.all([desenhar(o, i, w, h), desenhar(n, i, w, h), desenhar(t, i, w, h)]);
        let dados = 0, descobertos = 0; const marca = new Uint8ClampedArray(pt);
        for (let k = 0; k < po.length; k += 4) {
          const dif = Math.abs(po[k] - pn[k]) + Math.abs(po[k + 1] - pn[k + 1]) + Math.abs(po[k + 2] - pn[k + 2]);
          if (dif < 60) continue;
          dados++;
          if (pt[k] + pt[k + 1] + pt[k + 2] > 150) { descobertos++; marca[k] = 255; marca[k + 1] = 0; marca[k + 2] = 0; }
        }
        let png = null;
        if (descobertos) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(marca, w, h), 0, 0); png = c.toDataURL('image/png').split(',')[1]; }
        r.push({ pagina: i, dados, descobertos, png });
      }
      return r;
    })()`);
    for (const p of pixels) if (p.png) { writeFileSync(join(pasta, `descobertos-p${p.pagina}.png`), Buffer.from(p.png, 'base64')); delete p.png; }
    const resultado = { caso: nome, html: caso.html, sugestoes, marcas, paginas, nomeSalvo: await js('window.__salvo.nome'),
      aviso: await js(`document.getElementById('aviso').textContent`), sha256_original: sha(original), sha256_tarjado: sha(saida), pixels, erros };
    writeFileSync(join(pasta, 'resultado.json'), JSON.stringify(resultado, null, 1));
    const desc = pixels.reduce((s, p) => s + p.descobertos, 0); const tot = pixels.reduce((s, p) => s + p.dados, 0);
    console.log(`${nome}: ${sugestoes} | marcas ${marcas} | pixels dos dados ${tot}, descobertos ${desc}`);
  } catch (e) {
    writeFileSync(join(pasta, 'resultado.json'), JSON.stringify({ caso: nome, falha: e.message, erros }, null, 1));
    console.log(`${nome}: FALHOU ${e.message}`);
  } finally {
    await page.close();
  }
}

for (const n of nomes) await tarjarCaso(n);
await browser.close();
