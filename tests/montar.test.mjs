// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Testes dos arquivos montados (o normal e o com OCR): política de segurança, nada carregado de fora e versão igual
// em todos os lugares.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('python', ['-X', 'utf8', join(RAIZ, 'scripts', 'montar.py')]);
const sha = (t) => `'sha256-${createHash('sha256').update(t, 'utf8').digest('base64')}'`;

function examinar(nome) {
  const html = readFileSync(join(RAIZ, 'dist', nome), 'utf8');
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1] || '';
  const diretiva = (d) => csp.split(';').map((x) => x.trim()).find((x) => x.startsWith(d + ' ')) || '';
  return { html, csp, diretiva };
}
const VERSOES = [
  { nome: 'Tarja Livre.html', scripts: 3, wasm: false },
  { nome: 'Tarja Livre com OCR.html', scripts: 4, wasm: true },
];

for (const { nome, scripts: quantos, wasm } of VERSOES) {
  const { html, csp, diretiva } = examinar(nome);

  test(`${nome}: política de segurança fecha a rede e só libera os scripts da própria página`, () => {
    assert.ok(csp, 'meta CSP presente');
    assert.equal(diretiva('default-src'), "default-src 'none'");
    assert.equal(diretiva('connect-src'), "connect-src 'none'");
    // imagem só embutida (o favicon), nunca de endereço
    assert.equal(diretiva('img-src'), 'img-src data:');
    assert.equal(diretiva('object-src'), "object-src 'none'");
    assert.equal(diretiva('form-action'), "form-action 'none'");
    assert.ok(!/unsafe-inline|'unsafe-eval'/.test(csp), 'sem unsafe-inline nem unsafe-eval');
    // WebAssembly (o núcleo do OCR) só na versão com OCR
    assert.equal(/'wasm-unsafe-eval'/.test(csp), wasm, wasm ? 'WebAssembly liberado' : 'sem WebAssembly');
    assert.ok(!/https?:/.test(csp), 'nenhum endereço de fora na política');
  });

  test(`${nome}: cada script que roda tem o seu hash na política, e nenhum vem de fora`, () => {
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    const rodam = scripts.filter(([, atrib]) => !/type="text\/plain"/.test(atrib));
    assert.equal(rodam.length, quantos, 'jsPDF, PDF.js, o programa' + (wasm ? ' e o Tesseract' : ''));
    for (const [, atrib, corpo] of rodam) {
      assert.ok(!/\bsrc=/.test(atrib), 'script sem src');
      assert.ok(diretiva('script-src').includes(sha(corpo)), 'hash do script na CSP');
    }
    const [, estilo] = html.match(/<style>([\s\S]*?)<\/style>/);
    assert.ok(diretiva('style-src').includes(sha(estilo)), 'hash do estilo na CSP');
    // fora dos scripts (as bibliotecas têm textos com essas palavras, que não são marcação)
    const pagina = html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
    assert.ok(!/<(script|link|img|iframe)[^>]+(src|href)="https?:/i.test(pagina), 'nada carregado da internet');
    assert.ok(!/\sstyle="/.test(pagina), 'sem style="" (a CSP bloquearia)');
    assert.equal(html.includes('id="ocr-worker"'), wasm, 'worker do OCR só na versão com OCR');
  });

  test(`${nome}: favicon embutido é o mesmo docs/img/icone.svg do README`, () => {
    const href = html.match(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml;base64,([^"]+)">/)?.[1];
    assert.ok(href, 'favicon em data URL');
    assert.deepEqual(Buffer.from(href, 'base64'), readFileSync(join(RAIZ, 'docs', 'img', 'icone.svg')));
  });

  test(`${nome}: "Ver se há versão nova" só abre a página de versões, numa aba nova`, () => {
    const a = html.match(/<a[^>]*id="verVersaoNova"[^>]*>/)?.[0] || '';
    assert.match(a, /href="https:\/\/github\.com\/HeraldoAntunes\/tarja-livre\/releases\/latest"/, 'endereço da página de versões');
    assert.match(a, /target="_blank"/, 'abre no navegador, fora do programa');
    assert.match(a, /rel="noopener noreferrer"/, 'sem acesso de volta à página do programa');
    // o programa em si continua sem pedir nada à rede
    const programa = readFileSync(join(RAIZ, 'src', 'app.js'), 'utf8');
    assert.ok(!/\bfetch\(|XMLHttpRequest|sendBeacon|new WebSocket/.test(programa), 'sem fetch, XHR, beacon ou WebSocket no programa');
  });
}

test('worker do OCR: o pedido de rede é trocado pelos dados embutidos', () => {
  const { html } = examinar('Tarja Livre com OCR.html');
  const worker = html.match(/<script type="text\/plain" id="ocr-worker">([\s\S]*?)<\/script>/)[1];
  assert.ok(worker.startsWith('// Tarja Livre'), 'a parte nossa vem antes do Tesseract');
  assert.ok(worker.indexOf('self.fetch =') < worker.indexOf('var TesseractCore'), 'fetch trocado antes do núcleo');
  assert.ok(!worker.includes('__DADOS_POR__'), 'dados do português embutidos');
});

test('PDF.js aberto com isEvalSupported desligado', () => {
  assert.match(readFileSync(join(RAIZ, 'src', 'app.js'), 'utf8'), /isEvalSupported:\s*false/);
});

test('versão igual no programa, no CHANGELOG e no CITATION', () => {
  const versao = readFileSync(join(RAIZ, 'src', 'versao.js'), 'utf8').match(/VERSAO = '([^']+)'/)[1];
  const changelog = readFileSync(join(RAIZ, 'CHANGELOG.md'), 'utf8');
  const citation = readFileSync(join(RAIZ, 'CITATION.cff'), 'utf8');
  assert.match(changelog, new RegExp(`^## \\[${versao.replace(/\./g, '\\.')}\\]`, 'm'), 'CHANGELOG com a versão');
  assert.match(citation, new RegExp(`^version: "${versao.replace(/\./g, '\\.')}"`, 'm'), 'CITATION com a versão');
  for (const { nome } of VERSOES) assert.ok(examinar(nome).html.includes(`VERSAO = '${versao}'`), 'versão em ' + nome);
});

test('Criar-atalho-TarjaLivre.cmd: CRLF, ícone embutido, PowerShell sem erro de sintaxe e nada da internet', () => {
  const cmd = execFileSync('python', ['-X', 'utf8', '-c',
    'import sys; sys.path.insert(0, "scripts"); import montar; sys.stdout.buffer.write(montar.criar_atalho().encode())'],
  { cwd: RAIZ, maxBuffer: 1 << 24 }).toString('utf8');
  assert.ok(!/[^\r]\n/.test(cmd), 'toda linha termina em CRLF');
  const icone = cmd.match(/\$icone64 = '([A-Za-z0-9+/=]+)'/)?.[1];
  assert.ok(icone, 'ícone no lugar do marcador');
  assert.deepEqual(Buffer.from(icone, 'base64'), readFileSync(join(RAIZ, 'docs', 'img', 'icone.ico')), 'é o docs/img/icone.ico');
  assert.doesNotMatch(cmd, /https?:\/\//, 'nenhum endereço da internet');
  const partes = cmd.split('#--POWERSHELL--#');
  assert.equal(partes.length, 2, 'um marcador só, o que separa o PowerShell (a linha do cmd monta o texto em dois pedaços)');
  if (process.platform === 'win32') {
    const erros = execFileSync('powershell', ['-NoProfile', '-Command',
      '$e = $null; [void][System.Management.Automation.Language.Parser]::ParseInput([Console]::In.ReadToEnd(), [ref]$null, [ref]$e); $e.Count'],
    { input: partes[1] }).toString().trim();
    assert.equal(erros, '0', 'PowerShell sem erro de sintaxe');
  }
});
