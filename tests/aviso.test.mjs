// Tarja Livre: o aviso de arquivo que não abriu fica na tela até a pessoa fechar
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Na 1.2.2, a mensagem do PDF com senha (e dos arquivos com defeito) sumia em 4,2 s e nada mais na tela dizia por que
// o arquivo não abriu (docs/E2E-LINUX-1.2.2.md, achado 3, no ramo e2e-linux-1.2.2). Roda as funções reais dos avisos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const fonte = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const inicio = fonte.indexOf('// ---------- avisos ----------');
const fim = fonte.indexOf('// enquanto salva', inicio);
assert.ok(inicio >= 0 && fim > inicio, 'localiza os avisos no programa');
const avisos = fonte.slice(inicio, fim);

function contexto({ mostrar = true } = {}) {
  const classes = new Set();
  const relogios = [];
  const el = {
    mostrarAvisos: { checked: mostrar },
    avisoTexto: { textContent: '' },
    avisoFechar: { hidden: true },
    aviso: { classList: {
      add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, sim) => (sim ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) } },
  };
  const c = vm.createContext({
    el, setTimeout: (f, ms) => { relogios.push({ f, ms }); return relogios.length; },
    clearTimeout: (k) => { if (relogios[k - 1]) relogios[k - 1].f = () => {}; },
  });
  vm.runInContext(avisos + '\nObject.assign(globalThis, { avisar, avisarRecusa, fecharAviso });', c);
  const passarTempo = () => { for (const r of relogios.splice(0)) r.f(); };
  return { c, el, classes, passarTempo };
}

test('aviso comum some sozinho em 4,2 s, sem o botão de fechar', () => {
  const { c, el, classes, passarTempo } = contexto();
  c.avisar('3 sugestão(ões).');
  assert.equal(el.avisoTexto.textContent, '3 sugestão(ões).');
  assert.ok(classes.has('visivel'));
  assert.equal(el.avisoFechar.hidden, true);
  passarTempo();
  assert.ok(!classes.has('visivel'), 'sumiu');
});

test('arquivo que não abriu: o aviso fica até fechar no ×, mesmo com os avisos rápidos desligados', () => {
  const { c, el, classes, passarTempo } = contexto({ mostrar: false });
  c.avisarRecusa('com senha.pdf: PDF protegido por senha, tire a senha antes de tarjar.');
  assert.equal(el.avisoTexto.textContent, 'com senha.pdf: PDF protegido por senha, tire a senha antes de tarjar.');
  assert.ok(classes.has('visivel') && classes.has('fixo'));
  assert.equal(el.avisoFechar.hidden, false, 'botão de fechar à vista');
  passarTempo();
  assert.ok(classes.has('visivel'), 'não some sozinho');
  c.fecharAviso();
  assert.ok(!classes.has('visivel') && !classes.has('fixo'));
  assert.equal(el.avisoFechar.hidden, true);
});

test('um aviso comum depois do fixo toma o lugar e volta a sumir sozinho', () => {
  const { c, el, classes, passarTempo } = contexto();
  c.avisarRecusa('ruim.pdf: não foi possível abrir este PDF.');
  c.avisar('Marcas de antes recuperadas.');
  assert.ok(!classes.has('fixo'));
  assert.equal(el.avisoFechar.hidden, true);
  passarTempo();
  assert.ok(!classes.has('visivel'));
});

test('o relógio de um aviso comum anterior não apaga o fixo que veio depois', () => {
  const { c, classes, passarTempo } = contexto();
  c.avisar('Página 2.');
  c.avisarRecusa('ruim.pdf: não foi possível abrir este PDF.');
  passarTempo();
  assert.ok(classes.has('visivel') && classes.has('fixo'));
});

test('cada motivo de não abrir um arquivo usa o aviso que fica', () => {
  for (const m of ['este arquivo não parece ser um PDF.', 'PDF protegido por senha', 'não foi possível abrir este PDF.',
    'Divida o arquivo antes de tarjar.', 'está com defeito; o arquivo não foi aberto.', 'maior que o Tarja consegue salvar',
    'arquivos abertos: salve e feche alguns', 'Solte um ou mais arquivos PDF.', 'Não foi possível ler \' + arquivo.name']) {
    const k = fonte.indexOf(m);
    assert.ok(k > 0, 'mensagem no programa: ' + m);
    const chamada = fonte.lastIndexOf('avisar', k);
    assert.equal(fonte.slice(chamada, chamada + 'avisarRecusa('.length), 'avisarRecusa(', 'usa avisarRecusa: ' + m);
  }
});
