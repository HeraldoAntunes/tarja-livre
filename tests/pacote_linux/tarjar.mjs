// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-License-Identifier: MIT
// Parte do teste do pacote Linux (testar_pacote.sh): liga no navegador que o comando tarja-livre abriu (Chromium
// com janela, no Xvfb, com a porta de depuração), confere que a página aberta é a do pacote, tarja um PDF fictício
// gerado aqui e salva por download na pasta Downloads da pessoa. Quem confere o PDF salvo é o pdftotext, depois.
// Uso: node tarjar.mjs <porta> <caminho esperado do HTML> <pasta de downloads> <captura.png>
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [porta, esperado, baixados, captura] = process.argv.slice(2);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
for (let t = 0; t < 60 && !browser; t++) {
  try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${porta}`, defaultViewport: null }); } catch { await espera(500); }
}
assert.ok(browser, 'o navegador aberto pelo tarja-livre não respondeu');
let page;
for (let t = 0; t < 60 && !page; t++) {
  page = (await browser.pages()).find((p) => decodeURIComponent(p.url()) === 'file://' + esperado);
  if (!page) await espera(500);
}
assert.ok(page, 'página do pacote não aberta; abertas: ' + (await browser.pages()).map((p) => p.url()).join(', '));
const erros = [];
page.on('console', (m) => { if (['error', 'warn'].includes(m.type())) erros.push(m.text()); });
page.on('pageerror', (e) => erros.push(String(e)));
page.on('dialog', (d) => d.dismiss());
const js = (e) => page.evaluate(e);
const ate = async (e, rotulo, ms = 60000) => {
  for (let t = 0; t < ms / 200; t++) { if (await js(e).catch(() => false)) return; await espera(200); }
  throw new Error('tempo esgotado: ' + rotulo);
};
await ate(`document.readyState === 'complete' && !!globalThis.pdfjsLib && !!globalThis.jspdf`, 'carregar');
const s = await page.createCDPSession();
await s.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: baixados });
// a caixa "Salvar como" do Chromium não tem quem clique no Xvfb: sem ela, o programa salva por download
await js(`window.showSaveFilePicker = undefined`);
await js(`(() => { const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' }); d.setFontSize(13);
  ['Ficha fictícia de teste', 'Nome: Fulano de Teste', 'CPF: 831.975.872-60', 'E-mail: fulano.teste@exemplo.test'].forEach((t, i) => d.text(t, 60, 100 + 30 * i));
  const u = new Uint8Array(d.output('arraybuffer')); const dt = new DataTransfer();
  dt.items.add(new File([u], 'ficha-ficticia.pdf', { type: 'application/pdf' }));
  const e = document.getElementById('entrada'); e.files = dt.files; e.dispatchEvent(new Event('change')); })()`);
await ate(`document.getElementById('tela').dataset.pagina === '1'`, 'abrir o PDF');
await js(`(() => { const t = document.getElementById('termos'); t.value = 'Fulano de Teste'; t.dispatchEvent(new Event('input')); })()`);
await js(`document.getElementById('btProcurar').click()`);
await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procurar');
const resumo = await js(`document.getElementById('resumoAchados').textContent`);
for (const t of ['CPF 1', 'E-mail 1', 'Termo da lista 1']) assert.ok(resumo.includes(t), t + ' em ' + resumo);
await js(`document.getElementById('btAceitarTodas').click()`);
// a página conta como vista ao ser mostrada; o clique na miniatura é o mesmo que os testes do repositório fazem
await js(`document.querySelectorAll('.mini-pag')[0].click()`);
await ate(`document.getElementById('infoVistas').textContent === '1 de 1'`, 'página vista');
await js(`document.getElementById('revisei').click()`);
await page.screenshot({ path: captura });
await js(`document.getElementById('btSalvar').click()`);
const nome = 'ficha-ficticia-tarjado.pdf';
for (let t = 0; t < 300 && !(existsSync(join(baixados, nome)) && !readdirSync(baixados).some((a) => a.endsWith('.crdownload'))); t++) await espera(200);
assert.ok(existsSync(join(baixados, nome)), 'PDF salvo não apareceu em ' + baixados);
await espera(500);
assert.deepEqual(erros, [], 'console sem erro');
console.log(`tarjar: ${resumo}; salvo ${join(baixados, nome)}`);
await browser.close();
