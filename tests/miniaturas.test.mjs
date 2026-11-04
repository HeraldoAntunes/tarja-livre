// Tarja Livre: regressão da interrupção do desenho das miniaturas
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const fonte = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const inicio = fonte.indexOf('function montarMiniaturas() {');
const fim = fonte.indexOf('// Cada pedido desenha', inicio);
assert.ok(inicio >= 0 && fim > inicio, 'localiza a função real do programa');
// Observa a promessa do laço sem gancho de depuração nem alteração no programa.
const funcao = fonte.slice(inicio, fim).replace('(async () => {', 'pendente = (async () => {');
assert.notEqual(funcao, fonte.slice(inicio, fim));

function contexto(desenhar) {
  const miniaturas = { children: [], replaceChildren() { this.children = []; },
    append(b) { this.children.push(b); } };
  const documento = { paginas: Array.from({ length: 3 }, () => ({ w: 600, h: 800 })) };
  const c = vm.createContext({
    doc: documento, geracao: 1, el: { miniaturas }, redesenharMiniatura: desenhar,
    mostrar() {},
    document: { createElement() { return { dataset: {}, append() {}, addEventListener() {} }; } },
  });
  vm.runInContext('let pendente;\n' + funcao + '\nmontarMiniaturas(); globalThis.desenho = pendente;', c);
  return c;
}
function barreira() {
  let liberar;
  const espera = new Promise(r => { liberar = r; });
  return { espera, liberar };
}

for (const modo of ['fechar com geração nova', 'fechar sem geração nova', 'trocar de aba']) {
  test('miniaturas param sem erro ao ' + modo + ' durante o desenho', async () => {
    const entrou = barreira(), continuar = barreira(), chamadas = [];
    const c = contexto(async i => { chamadas.push(i); entrou.liberar(); await continuar.espera; });
    await entrou.espera;
    c.doc = modo === 'trocar de aba' ? { paginas: [{ w: 300, h: 300 }] } : null;
    if (modo !== 'fechar sem geração nova') c.geracao++;
    continuar.liberar();
    await assert.doesNotReject(c.desenho);
    assert.deepEqual(chamadas, [0], 'não desenha página seguinte do arquivo fechado ou de outra aba');
  });
}
test('sem interrupção, desenha todas as miniaturas uma vez', async () => {
  const chamadas = [];
  const c = contexto(async i => { chamadas.push(i); });
  await c.desenho;
  assert.deepEqual(chamadas, [0, 1, 2]);
  assert.equal(c.el.miniaturas.children.length, 3);
});

// redesenharMiniatura(): fechar ou trocar a aba no meio do desenho faz o PDF.js cancelar (ou o PDF já foi destruído).
// Isso não é erro e não pode ir para o console (docs/E2E-LINUX-1.2.2.md, achado 2, no ramo e2e-linux-1.2.2); uma falha
// de verdade, com a aba ainda aberta, continua avisando.
const iniRedesenhar = fonte.indexOf('const pedidoMiniatura = [];');
const fimRedesenhar = fonte.indexOf('function atualizarMiniaturas() {', iniRedesenhar);
assert.ok(iniRedesenhar >= 0 && fimRedesenhar > iniRedesenhar, 'localiza redesenharMiniatura no programa');
const redesenhar = fonte.slice(iniRedesenhar, fimRedesenhar);

function contextoDesenho(erro) {
  const canvas = () => ({ width: 120, height: 160, getContext: () => ({ fillRect() {}, drawImage() {} }) });
  const botao = { querySelector: () => canvas() };
  const desenho = barreira(), falhar = barreira();
  const documento = { paginas: [{ w: 600, h: 800 }], pdf: { getPage: async () => ({
    getViewport: () => ({}), render: () => { desenho.liberar(); return { promise: falhar.espera.then(() => { throw erro; }) }; } }) } };
  const avisos = [];
  const c = vm.createContext({
    doc: documento, docs: [documento], geracao: 1, el: { miniaturas: { children: [botao] } }, OPCOES_DESENHO: {},
    desenharMarcas() {}, document: { createElement: canvas }, console: { warn: (...a) => avisos.push(a.join(' ')) },
  });
  vm.runInContext(redesenhar + '\nglobalThis.pendente = redesenharMiniatura(0);', c);
  return { c, documento, avisos, desenho, falhar };
}
const cancelado = Object.assign(new Error('Rendering cancelled, page 1'), { name: 'RenderingCancelledException' });
const destruido = new Error('Worker was destroyed');
for (const [modo, erro, mudar] of [
  ['fechar a aba (geração nova)', destruido, (c, d) => { c.docs = c.docs.filter((x) => x !== d); c.doc = null; c.geracao++; }],
  ['fechar a aba sem geração nova', destruido, (c, d) => { c.docs = c.docs.filter((x) => x !== d); }],
  ['trocar de aba', cancelado, (c) => { c.doc = { paginas: [{ w: 300, h: 300 }] }; c.geracao++; }],
  ['desenho cancelado com a aba aberta', cancelado, () => {}],
]) {
  test('miniatura: ' + modo + ' durante o desenho não avisa no console', async () => {
    const { c, documento, avisos, desenho, falhar } = contextoDesenho(erro);
    await desenho.espera;
    mudar(c, documento);
    falhar.liberar();
    await assert.doesNotReject(c.pendente);
    assert.deepEqual(avisos, []);
  });
}
test('miniatura: falha de verdade com a aba aberta continua avisando', async () => {
  const { c, avisos, desenho, falhar } = contextoDesenho(new Error('página com defeito'));
  await desenho.espera;
  falhar.liberar();
  await c.pendente;
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /^miniatura não desenhada 1 Error: página com defeito/);
});
