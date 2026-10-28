// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Trava dos dados de exemplo: o projeto (código, testes, PDFs de teste e documentos) só pode ter dados pessoais
// fictícios. Telefone, CEP e e-mail usam faixas que não existem (DDD 00, CEP começando em 000, domínio .test,
// reservado para testes). CPF e CNPJ não têm faixa reservada: os de exemplo foram sorteados uma vez, não pertencem a
// ninguém conhecido, e só os desta lista podem aparecer. Ver tests/fixtures/LEIA-ME.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpfValido, cnpjValido } from '../src/achados.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CPF_FICTICIOS = ['831.975.872-60', '514.334.988-55', '833.311.475-08', '834.068.419-10'];
export const CNPJ_FICTICIOS = ['19.808.456/0001-00'];
const FORA = new Set(['.git', 'vendor', 'dist', 'files', 'node_modules']);

function arquivos(pasta) {
  return readdirSync(pasta).flatMap((n) => {
    if (FORA.has(n)) return [];
    const c = join(pasta, n);
    return statSync(c).isDirectory() ? arquivos(c) : [c];
  });
}
const todos = arquivos(RAIZ).filter((c) => /\.(js|mjs|py|html|css|md|json|cff|txt|pdf|yml|toml)$/i.test(c));
const conteudo = (c) => readFileSync(c, 'latin1');
const achar = (re) => todos.flatMap((c) => [...conteudo(c).matchAll(re)].map((m) => [relative(RAIZ, c), m[0]]));

test('CPF válido só os fictícios da lista', () => {
  const sem = (s) => s.replace(/\D/g, '');
  const ok = new Set(CPF_FICTICIOS.map(sem));
  const ruins = achar(/(?<![\d./-])\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?![\d/-]|\.\d)/g)
    .filter(([, v]) => cpfValido(v) && !ok.has(sem(v)));
  assert.deepEqual(ruins, []);
});

test('CNPJ válido só os fictícios da lista', () => {
  const sem = (s) => s.replace(/\D/g, '');
  const ok = new Set(CNPJ_FICTICIOS.map(sem));
  const ruins = achar(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g).filter(([, v]) => cnpjValido(v) && !ok.has(sem(v)));
  assert.deepEqual(ruins, []);
});

test('telefone só com DDD 00, que não existe', () => {
  const ruins = achar(/\(\d{2}\)\s?9?\d{4}-\d{4}/g).filter(([, v]) => !v.startsWith('(00)'));
  assert.deepEqual(ruins, []);
});

test('CEP só na faixa 000, que não existe', () => {
  const ruins = achar(/(?<![\d.-])\d{5}-\d{3}(?![\d-])/g).filter(([, v]) => !v.startsWith('000'));
  assert.deepEqual(ruins, []);
});

test('e-mail só no domínio .test, reservado para testes', () => {
  const ruins = achar(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)
    .filter(([, v]) => !/\.test$/.test(v));
  assert.deepEqual(ruins, []);
});
