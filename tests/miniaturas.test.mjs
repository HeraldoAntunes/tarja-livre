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
