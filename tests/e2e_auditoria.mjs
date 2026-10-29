// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Pontos da auditoria independente de 29/10/2026 (seção 3), cada um num navegador de verdade:
//   1. trocar de página no meio de um arrasto não pode pôr a tarja na outra página;
//   2. gesto cancelado (pointercancel) no carimbo devolve o carimbo ao lugar;
//   3. procura que falha não pode terminar em "Nada encontrado";
//   4. com zoom cortando a página, ela só conta como vista depois de aparecer inteira (rolando).
// Uso: node tests/e2e_auditoria.mjs [pasta]. ITENS=13 roda só os itens 1 e 3 (para ver cada um falhar antes da correção).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, montar, abrirNavegador, espera } from './navegador.mjs';

const ITENS = process.env.ITENS || '1234';
const PDF = readFileSync(join(RAIZ, 'tests', 'fixtures', 'tarja-teste.pdf'));
montar();
const n = await abrirNavegador(process.argv[2] || join(RAIZ, 'files', 'e2e-auditoria'));
const marcas = (i) => n.js(`document.querySelectorAll('.mini-pag')[${i}].querySelector('.selo')?.textContent || '0'`);
const ponto = async (fx, fy) => {
  const r = await n.js(`(() => { const r = document.getElementById('tela').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
  return { x: r[0] + fx * r[2], y: r[1] + fy * r[3] };
};
// apertar, arrastar e soltar com o botão esquerdo; mover sem botão é só passar por cima
const mouse = (type, p, buttons) => n.cdp('Input.dispatchMouseEvent', { type, ...p,
  button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount: 1 });
const pagina = (i) => n.ate(`document.getElementById('tela').dataset.pagina === '${i}'`, 'mostrar a página ' + i, 30000);

await n.abrirPrograma();
await n.enviarArquivo(PDF, 'teste.pdf');
await pagina(1);

// 1. arrasto começado na página 1, página trocada no meio, soltura na página 2
if (ITENS.includes('1')) {
await mouse('mousePressed', await ponto(0.2, 0.2), 1);
await mouse('mouseMoved', await ponto(0.3, 0.3), 1);
await n.clicar('btProxima');
await pagina(2);
await mouse('mouseMoved', await ponto(0.5, 0.4), 1);
await mouse('mouseReleased', await ponto(0.5, 0.4), 0);
await espera(300);
assert.equal(await marcas(1), '0', '1: a tarja do arrasto da página 1 não pode cair na página 2');
assert.equal(await marcas(0), '0', '1: o arrasto interrompido não vira tarja na página 1');
// o próximo arrasto, inteiro na página 2, funciona
await n.arrastar(0.2, 0.2, 0.4, 0.3);
await n.ate(`document.querySelectorAll('.mini-pag')[1].querySelector('.selo')?.textContent === '1'`, '1: arrasto normal depois');
}

// 2. carimbo: arrastar e o sistema cancelar o gesto
if (ITENS.includes('2')) {
await n.js(`(() => { const c = document.getElementById('carAtivo'); c.checked = true; c.dispatchEvent(new Event('change')); })()`);
await espera(300);
const noLugar = await ponto(0.08, 0.88);
await mouse('mouseMoved', noLugar, 0);
assert.equal(await n.js(`document.getElementById('tela').classList.contains('mover')`), true, '2: o carimbo começa no canto');
await mouse('mousePressed', noLugar, 1);
await mouse('mouseMoved', await ponto(0.5, 0.5), 1);
await n.js(`document.getElementById('tela').dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }))`);
await mouse('mouseReleased', await ponto(0.5, 0.5), 0);
await mouse('mouseMoved', await ponto(0.9, 0.1), 0);
await mouse('mouseMoved', noLugar, 0);
assert.equal(await n.js(`document.getElementById('tela').classList.contains('mover')`), true,
  '2: depois do gesto cancelado, o carimbo volta ao lugar de antes');
await n.js(`(() => { const c = document.getElementById('carAtivo'); c.checked = false; c.dispatchEvent(new Event('change')); })()`);
}

// 3. procura que falha: o texto das páginas não pode ser lido
if (ITENS.includes('3')) {
await n.js(`(async () => {
  const d = await pdfjsLib.getDocument({ data: Uint8Array.from(atob('${PDF.toString('base64')}'), (c) => c.charCodeAt(0)), isEvalSupported: false }).promise;
  const pg = await d.getPage(1);
  const proto = Object.getPrototypeOf(pg);
  window.__textoOriginal = proto.getTextContent;
  proto.getTextContent = () => Promise.reject(new Error('falha de teste ao ler o texto'));
})()`);
await n.clicar('btProcurar');
await n.ate(`!document.body.classList.contains('ocupado') && !/Procurando/.test(document.getElementById('resumoAchados').textContent)`, '3: fim da procura', 60000);
await espera(500);
const aviso = await n.js(`document.getElementById('aviso').textContent`);
assert.doesNotMatch(aviso, /Nada encontrado/, '3: procura que falhou não pode dizer "Nada encontrado"');
assert.match(aviso, /não terminou/, '3: avisa que a procura não terminou');
await n.js(`(async () => { const d = await pdfjsLib.getDocument({ data: Uint8Array.from(atob('${PDF.toString('base64')}'), (c) => c.charCodeAt(0)), isEvalSupported: false }).promise; Object.getPrototypeOf(await d.getPage(1)).getTextContent = window.__textoOriginal; })()`);
n.erros.length = 0;  // os avisos da falha acima eram esperados
}

// 4. zoom em 300% na página 3: aparece só um pedaço, não conta como vista
if (ITENS.includes('4')) {
for (let k = 0; k < 6; k++) await n.clicar('btMais');
await n.js(`document.querySelectorAll('.mini-pag')[2].click()`);
await pagina(3);
await espera(800);
assert.equal(await n.js(`!!document.querySelectorAll('.mini-pag')[2].querySelector('.visto')`), false,
  '4: com zoom cortando a página, ela não conta como vista');
// rolando por ela toda, conta
await n.js(`(async () => {
  const p = document.getElementById('palco');
  for (let y = 0; y <= p.scrollHeight; y += p.clientHeight / 2)
    for (let x = 0; x <= p.scrollWidth; x += p.clientWidth / 2) { p.scrollTo(x, y); await new Promise((r) => setTimeout(r, 30)); }
})()`);
await n.ate(`!!document.querySelectorAll('.mini-pag')[2].querySelector('.visto')`, '4: depois de rolar pela página inteira, ela conta como vista', 10000);
}

assert.deepEqual(n.erros, [], 'console limpo');
await n.fechar();
console.log('auditoria: tudo certo (arrasto com troca de página, carimbo com gesto cancelado, procura que falha, página vista com zoom)');
