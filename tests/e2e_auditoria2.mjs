// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Pontos da auditoria independente de 29/10/2026, rodada 2 (sobre a 1.2.0 publicada), num navegador de verdade:
//   A. carimbo: arrastar e soltar move; gesto cancelado depois de mover volta; trocar de página no meio volta;
//   B. "Apagar tudo" com a limpeza falhando não pode dizer "Apagado"; sem falha, diz;
//   C. andamento: edição sem parar grava mesmo assim (prazo máximo); falha ao gravar avisa;
//   D. com zoom, a página não conta como vista se uma faixa da margem nunca apareceu;
//   E. a lista de termos diz o que ficou de fora (repetidos, de uma letra, além de 500) e o que foi cortado (mais de 200
//      letras), em vez de descartar calado (relatório completo da rodada 1).
// Uso: node tests/e2e_auditoria2.mjs [pasta]. ITENS=AC roda só os itens A e C (para ver cada um falhar antes da correção).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, montar, abrirNavegador, espera } from './navegador.mjs';

const ITENS = process.env.ITENS || 'ABCDEF';
const PDF = readFileSync(join(RAIZ, 'tests', 'fixtures', 'tarja-teste.pdf'));
const LER = `new Promise((ok) => { const q = indexedDB.open('tarja-livre', 1);
  q.onupgradeneeded = () => q.result.createObjectStore('andamento');
  q.onsuccess = () => { const r = {}; q.result.transaction('andamento').objectStore('andamento').openCursor().onsuccess = (e) => {
    const c = e.target.result; if (c) { r[c.key] = c.value; c.continue(); } else { q.result.close(); ok(Object.keys(r).length ? JSON.stringify(r) : ''); } }; }; })`;
montar();
const n = await abrirNavegador(process.argv[2] || join(RAIZ, 'files', 'e2e-auditoria2'));
const ponto = async (fx, fy) => {
  const r = await n.js(`(() => { const r = document.getElementById('tela').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
  return { x: r[0] + fx * r[2], y: r[1] + fy * r[3] };
};
const mouse = (type, p, buttons) => n.cdp('Input.dispatchMouseEvent', { type, ...p,
  button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount: 1 });
const pagina = (i) => n.ate(`document.getElementById('tela').dataset.pagina === '${i}'`, 'mostrar a página ' + i, 30000);
const aviso = () => n.js(`document.getElementById('aviso').textContent`);
// o carimbo está em (fx, fy)? Passa o mouse por cima, sem botão: a página mostra a mãozinha de mover
const carimboEm = async (fx, fy) => {
  await mouse('mouseMoved', await ponto(0.97, 0.03), 0);
  await mouse('mouseMoved', await ponto(fx, fy), 0);
  return n.js(`document.getElementById('tela').classList.contains('mover')`);
};
const arrastarAte = async (de, ate, passos = 8) => {
  await mouse('mousePressed', await ponto(...de), 1);
  for (let k = 1; k <= passos; k++) await mouse('mouseMoved', await ponto(de[0] + ((ate[0] - de[0]) * k) / passos, de[1] + ((ate[1] - de[1]) * k) / passos), 1);
};

await n.abrirPrograma();
await n.enviarArquivo(PDF, 'teste.pdf');
await pagina(1);

if (ITENS.includes('A')) {
  await n.js(`(() => { const c = document.getElementById('carAtivo'); c.checked = true; c.dispatchEvent(new Event('change')); })()`);
  await espera(300);
  assert.ok(await carimboEm(0.08, 0.88), 'A: o carimbo começa no canto');
  // A1. arrastar e soltar: o carimbo vai junto
  await arrastarAte([0.08, 0.88], [0.5, 0.5]);
  await mouse('mouseReleased', await ponto(0.5, 0.5), 0);
  await espera(200);
  assert.ok(await carimboEm(0.5, 0.5), 'A1: depois de arrastar e soltar, o carimbo está no lugar novo');
  assert.ok(!(await carimboEm(0.08, 0.88)), 'A1: e saiu do canto');
  // A2. gesto cancelado depois de mover de verdade: volta para onde estava
  await arrastarAte([0.5, 0.5], [0.3, 0.2]);
  assert.ok(await n.js(`document.getElementById('tela').classList.contains('mover')`), 'A2: durante o arrasto, a mãozinha');
  await n.js(`document.getElementById('tela').dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }))`);
  await mouse('mouseReleased', await ponto(0.3, 0.2), 0);
  assert.ok(await carimboEm(0.5, 0.5), 'A2: gesto cancelado devolve o carimbo');
  assert.ok(!(await carimboEm(0.3, 0.2)), 'A2: e ele não fica onde o gesto parou');
  // A3. trocar de página no meio do arrasto: volta para onde estava, e a outra página não ganha nada
  await arrastarAte([0.5, 0.5], [0.3, 0.2]);
  await n.tecla('ArrowRight', 'ArrowRight', 39);
  await pagina(2);
  await mouse('mouseMoved', await ponto(0.32, 0.22), 1);
  await mouse('mouseReleased', await ponto(0.32, 0.22), 0);
  assert.ok(await carimboEm(0.5, 0.5), 'A3: depois de trocar de página no meio, o carimbo está onde estava');
  assert.ok(!(await carimboEm(0.3, 0.2)), 'A3: e não onde o gesto parou');
  assert.equal(await n.js(`document.querySelectorAll('.mini-pag')[1].querySelector('.selo')?.textContent || '0'`), '0', 'A3: nenhuma tarja na página 2');
  await n.js(`(() => { const c = document.getElementById('carAtivo'); c.checked = false; c.dispatchEvent(new Event('change')); })()`);
}

if (ITENS.includes('C')) {
  await n.ate(`document.getElementById('guardarAndamento').checked`, 'guardar andamento ligado', 5000);
  // C1. 40 tarjas seguidas, uma a cada ~0,2 s, sem nenhuma pausa de 1 s: no fim, ainda sem parar, já tem de estar gravado
  for (let k = 0; k < 40; k++) {
    const x = 0.1 + (k % 10) * 0.08, y = 0.1 + Math.floor(k / 10) * 0.08;
    await mouse('mousePressed', await ponto(x, y), 1);
    await mouse('mouseMoved', await ponto(x + 0.05, y + 0.03), 1);
    await mouse('mouseReleased', await ponto(x + 0.05, y + 0.03), 0);
    await espera(120);
  }
  assert.ok(await n.js(LER), 'C1: edição sem parar também grava o andamento');
  // C2. falha ao gravar: avisa
  await n.js(`window.__putOriginal = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new Error('falha simulada ao gravar'); }`);
  await n.arrastar(0.1, 0.7, 0.2, 0.75);
  await espera(4000);
  assert.match(await aviso(), /andamento/i, 'C2: falha ao gravar o andamento avisa');
  await n.js(`IDBObjectStore.prototype.put = window.__putOriginal`);
  n.erros.length = 0;   // a falha acima era esperada
}

if (ITENS.includes('B')) {
  // B1. a limpeza falha (localStorage e IndexedDB recusam): não pode dizer "Apagado"
  await n.js(`window.__rem = Storage.prototype.removeItem; window.__clear = IDBObjectStore.prototype.clear;
    Storage.prototype.removeItem = function () { throw new Error('falha simulada no localStorage'); };
    IDBObjectStore.prototype.clear = function () { throw new Error('falha simulada no IndexedDB'); };`);
  n.responder(true);
  await n.clicar('btApagarTudo');
  await espera(1500);
  const falhou = await aviso();
  await n.js(`Storage.prototype.removeItem = window.__rem; IDBObjectStore.prototype.clear = window.__clear`);
  n.erros.length = 0;
  assert.doesNotMatch(falhou, /^Apagado/, 'B1: limpeza que falhou não pode dizer "Apagado": ' + falhou);
  assert.match(falhou, /não/i, 'B1: avisa o que não foi apagado');
  // B2. sem falha: "Apagado"
  n.responder(true);
  await n.clicar('btApagarTudo');
  await n.ate(`/^Apagado/.test(document.getElementById('aviso').textContent)`, 'B2: sem falha, Apagado', 5000);
  assert.equal(await n.js(LER), '', 'B2: o andamento sumiu');
}

if (ITENS.includes('D')) {
  // O navegador sem janela do teste às vezes deixa a página "oculta" no meio da rolagem, e aí não avisa a rolagem
  // (evento scroll). Por isso, depois de cada passo, o teste avisa ele mesmo, como o navegador faz na janela à vista.
  // zoom 300% na página 4; rola pela página toda menos uma faixa de 6% na margem direita
  for (let k = 0; k < 6; k++) await n.clicar('btMais');
  await n.js(`document.querySelectorAll('.mini-pag')[3].click()`);
  await pagina(4);
  await espera(800);
  await n.js(`(async () => {
    const p = document.getElementById('palco');
    p.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 50));
    const t = document.getElementById('tela').getBoundingClientRect(), c = p.getBoundingClientRect();
    // rolagem máxima para a direita sem passar de 95% da largura (a faixa de 95% a 100% nunca aparece)
    const limite = 0.95 * t.width - (c.right - t.left);
    window.__limite = [limite, t.width, c.width, p.scrollWidth, p.clientWidth];
    const xs = []; for (let x = 0; x < limite; x += p.clientWidth / 3) xs.push(x); xs.push(limite);
    for (let y = 0; y <= p.scrollHeight; y += p.clientHeight / 3)
      for (const x of xs) { p.scrollTo(x, y); p.dispatchEvent(new Event('scroll')); await new Promise((r) => setTimeout(r, 30)); }
    p.scrollTo(limite, p.scrollHeight); p.dispatchEvent(new Event('scroll')); await new Promise((r) => setTimeout(r, 30));
    const t2 = document.getElementById('tela').getBoundingClientRect();
    window.__direita = (c.right - t2.left) / t2.width;
  })()`);
  console.log('D: rolagem', await n.js('window.__limite'), 'direita vista até', await n.js('window.__direita'));
  await espera(300);
  assert.equal(await n.js(`!!document.querySelectorAll('.mini-pag')[3].querySelector('.visto')`), false,
    'D: com a margem direita nunca à vista, a página não conta como vista');
  await n.js(`(async () => { const p = document.getElementById('palco');
    for (let y = 0; y <= p.scrollHeight; y += p.clientHeight / 3) { p.scrollTo(p.scrollWidth, y); p.dispatchEvent(new Event('scroll')); await new Promise((r) => setTimeout(r, 30)); } })()`);
  await n.ate(`!!document.querySelectorAll('.mini-pag')[3].querySelector('.visto')`, 'D: vista depois de a margem aparecer', 10000);
}

if (ITENS.includes('E')) {
  const linhas = ['Fulano de Teste', 'fulano de teste', 'a', 'X'.repeat(250), ...Array.from({ length: 505 }, (_, i) => 'Termo ' + i)];
  await n.js(`(() => { const t = document.getElementById('termos'); t.value = ${JSON.stringify(linhas.join('\n'))}; t.dispatchEvent(new Event('input')); })()`);
  const info = await n.js(`document.getElementById('infoTermos').textContent`);
  assert.match(info, /^500 termo/, 'E: entram 500: ' + info);
  assert.match(info, /não entraram/, 'E: diz quantas linhas ficaram de fora: ' + info);
  assert.match(info, /200 letras/, 'E: diz que um termo foi cortado: ' + info);
  await n.js(`(() => { const t = document.getElementById('termos'); t.value = ''; t.dispatchEvent(new Event('input')); })()`);
}

assert.deepEqual(n.erros, [], 'console limpo');
await n.fechar();
if (ITENS.includes('F')) {
  // num navegador próprio, limpo: os itens A a E deixam zoom, rolagem e abas que não são o caso deste
  const n = await abrirNavegador(join(process.argv[2] || join(RAIZ, 'files', 'e2e-auditoria2'), 'F'));
  const aviso = () => n.js(`document.getElementById('aviso').textContent`);
  await n.abrirPrograma();
  await n.enviarArquivo(PDF, 'teste.pdf');
  await n.ate(`document.getElementById('tela').dataset.pagina === '1'`, 'F: mostrar a página 1', 30000);
  // auditor, 29/10/2026 (sobre a 1.2.0): a exportação podia receber um documento diferente do que iniciou o salvamento.
  // Com a caixa "Salvar como" aberta, a pessoa (ou um clique perdido) troca de aba: o PDF salvo tem de ser o de origem,
  // com as tarjas dele, ou nada é salvo e um aviso explica. O outro (1 página) não pode sair com o nome do primeiro (8).
  await n.enviarArquivo(readFileSync(join(RAIZ, 'tests', 'fixtures', 'auditoria', 'simple.pdf')), 'outro.pdf');
  await n.ate(`document.querySelectorAll('#abas .aba').length === 2`, 'F: abrir o segundo arquivo', 30000);
  const aba = (nome) => `[...document.querySelectorAll('#abas .aba')].find((a) => a.querySelector('.txt').textContent === '${nome}')`;
  await n.js(`${aba('teste.pdf')}.querySelector('.aba-nome').click()`);
  await n.ate(`document.getElementById('nomeArquivo').textContent === 'teste.pdf'`, 'F: voltar ao primeiro', 30000);
  // o item D deixa o zoom em 300%: com zoom, só passar a página não basta para contar como vista
  for (let k = 0; k < 12 && parseInt(await n.js(`document.getElementById('zoomTexto').textContent`), 10) > 100; k++) await n.clicar('btMenos');
  for (let k = 0; k < 8 && (await n.js(`document.getElementById('infoVistas').textContent`)) !== '8 de 8'; k++) {
    await n.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await n.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await espera(700);
    await n.js(`document.getElementById('palco').dispatchEvent(new Event('scroll'))`);
  }
  await n.ate(`document.getElementById('infoVistas').textContent === '8 de 8'`, 'F: passar pelas 8 páginas', 30000);
  await n.js(`(() => { const r = document.getElementById('revisei'); if (!r.checked) r.click(); })()`);
  await n.ate(`!document.getElementById('btSalvar').disabled`, 'F: liberar o Salvar', 5000);
  await n.js(`window.__salvo = null; window.__sugerido = null; window.showSaveFilePicker = async (o) => {
    window.__sugerido = o.suggestedName;
    ${aba('outro.pdf')}.querySelector('.aba-nome').click();
    await new Promise((r) => setTimeout(r, 1500));
    const partes = []; return { name: 'escolhido.pdf', createWritable: async () => ({
      write: async (b) => partes.push(b), close: async () => { window.__salvo = new Blob(partes); } }) }; }`);
  n.responder(true);   // "Ainda há sugestões não aceitas. Salvar mesmo assim?"
  await n.js(`document.getElementById('btSalvar').click()`);
  await n.ate(`!!window.__sugerido`, 'F: abrir a caixa Salvar como', 10000);
  await espera(2000);
  await n.ate(`!document.body.classList.contains('ocupado')`, 'F: terminar de salvar', 180000);
  const salvo = await n.js(`window.__salvo ? window.__salvo.arrayBuffer().then((b) =>
    pdfjsLib.getDocument({ data: new Uint8Array(b) }).promise).then((d) => d.numPages) : 0`);
  const tela = await n.js(`document.getElementById('nomeArquivo').textContent`);
  const situacao = await n.js(`[${aba('teste.pdf')}.querySelector('.situacao').textContent, ${aba('outro.pdf')}.querySelector('.situacao').textContent]`);
  assert.equal(await n.js('window.__sugerido'), 'teste-tarjado.pdf', 'F: a caixa sugere o nome do documento de origem');
  if (salvo) {
    const esperado = 8 + (await n.js(`document.getElementById('folha').checked`) ? 1 : 0);   // + a folha de conferência
    assert.equal(salvo, esperado, `F: o PDF salvo é o de origem (${esperado} páginas), não o outro: ${salvo} página(s)`);
    assert.deepEqual(situacao.map((x) => x === 'salvo'), [true, false], 'F: só o de origem fica como salvo: ' + situacao);
  } else {
    assert.match(await aviso(), /nada foi (gravado|salvo)/, 'F: sem salvar, o aviso diz que nada foi gravado');
    assert.ok(!situacao.includes('salvo'), 'F: nenhum dos dois fica como salvo: ' + situacao);
  }
  console.log(`F: salvo ${salvo} página(s); na tela: ${tela}; situação: ${situacao.join(', ')}`);
  assert.deepEqual(n.erros, [], 'F: console limpo');
  await n.fechar();
}
console.log(`auditoria 2: tudo certo (${ITENS})`);
