// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Prova da tarja (docs/PROVA-TARJA-1.2.2.md), como teste: gera os casos, tarja cada um no próprio programa e tenta
// recuperar os dados. Para cada caso, dois testes:
//   - nenhuma ferramenta acha os dados no tarjado.pdf (e, de controle, alguma coisa acha no original.pdf);
//   - todo pixel onde os dados aparecem no original ficou escuro no tarjado.pdf.
// Na 1.2.2, falham de propósito os testes de pixel de camada-ocr-largura e camada-ocr-deslocada: é o defeito 1 do
// relatório (a tarja sai da camada de texto invisível, não das letras da imagem). Não corrige o programa.
//
// Uso (em tests/prova_tarja, depois de npm ci e de python3 scripts/montar.py na raiz):
//   CHROMIUM=<chrome> PYTHON=<python com PyMuPDF> node --test prova.test.mjs
// HTML=<html> e HTML_OCR=<html> escolhem outros HTML (padrão: os de dist/).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const HTML = process.env.HTML || join(RAIZ, 'dist', 'Tarja Livre.html');
const HTML_OCR = process.env.HTML_OCR || join(RAIZ, 'dist', 'Tarja Livre com OCR.html');
const CASOS = mkdtempSync(join(tmpdir(), 'prova-tarja-'));
let recuperacao;

before(() => {
  execFileSync(process.env.PYTHON || 'python3', ['-I', join(AQUI, 'gerar_casos.py'), CASOS], { stdio: 'ignore' });
  execFileSync('node', [join(AQUI, 'tarjar.mjs'), CASOS, HTML, HTML_OCR], { stdio: 'inherit', timeout: 1800000 });
  try { execFileSync('python3', ['-I', join(AQUI, 'recuperar.py'), CASOS], { stdio: 'ignore' }); } catch { /* sai 1 se vazar */ }
  recuperacao = JSON.parse(readFileSync(join(CASOS, 'resultado-recuperacao.json'), 'utf8'));
});

const FERRAMENTAS = ['pdftotext', 'qpdf --qdf', 'mutool extract', 'strings', 'versões', 'metadados', 'anexos'];
// a lista vem do gerador, para que cada caso apareça mesmo se o programa falhar nele
const nomes = execFileSync(process.env.PYTHON || 'python3', ['-I', '-c',
  `import sys; sys.path.insert(0, ${JSON.stringify(AQUI)}); import gerar_casos; print(' '.join(gerar_casos.CASOS))`]).toString().trim().split(' ');

for (const nome of nomes) {
  test(`${nome}: nenhuma ferramenta recupera os dados do tarjado`, () => {
    const r = recuperacao[nome];
    assert.ok(r?.tarjado, 'o programa não salvou o tarjado.pdf (ver resultado.json do caso)');
    const achados = Object.fromEntries(FERRAMENTAS.map((f) => [f, r.tarjado[f]]).filter(([, v]) => v.length));
    assert.deepEqual(achados, {}, 'dados recuperados do tarjado.pdf');
    assert.equal(r.tarjado['versões (quantas)'], 1, 'uma versão só no tarjado.pdf');
    assert.deepEqual(r.tarjado['anotações e campos'], { Annots: 0, AcroForm: 0 }, 'sem anotações nem formulário');
  });
  test(`${nome}: todo pixel dos dados ficou escuro`, () => {
    const r = JSON.parse(readFileSync(join(CASOS, nome, 'resultado.json'), 'utf8'));
    assert.ok(r.pixels, 'sem conferência de pixels: ' + (r.falha || '?'));
    const dados = r.pixels.reduce((s, p) => s + p.dados, 0);
    const descobertos = r.pixels.reduce((s, p) => s + p.descobertos, 0);
    assert.ok(dados > 0, 'o caso tem de ter pixels de dados (controle)');
    const imagens = readdirSync(join(CASOS, nome)).filter((f) => f.startsWith('descobertos-'));
    assert.equal(descobertos, 0, `${descobertos} de ${dados} pixels dos dados à mostra no tarjado.pdf ` +
      `(em vermelho em ${imagens.map((f) => join(CASOS, nome, f)).join(', ')})`);
  });
}
