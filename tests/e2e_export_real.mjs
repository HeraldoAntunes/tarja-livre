// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Exportação real com os PDFs da auditoria externa de 29/10/2026 (tests/fixtures/auditoria), num navegador de verdade
// (ou dentro do exe, com TARJA_EXE), conferida por OUTRO leitor de PDF (PyMuPDF, tests/conferir_pixels.py). Regressão
// de privacidade:
//   1. página de 20.000 pt (por /UserUnit), PDF com senha e PDF de 1.001 páginas são recusados ao abrir;
//   2. tarja que cobre só 90,5% da sugestão do e-mail não a resolve (na 1.1.0, sumia e "st" ficava à vista);
//   3. aceita a sugestão, o e-mail fica coberto pixel a pixel e nada do original (texto, metadados, script, anexo,
//      comentário) passa para o PDF salvo;
//   4. página inteira coberta sai preta, em PNG e em JPEG.
// Uso: node tests/e2e_export_real.mjs [pasta]
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, PYTHON, montar, abrirNavegador } from './navegador.mjs';

const FIX = join(RAIZ, 'tests', 'fixtures', 'auditoria');
const SAIDA = process.argv[2] || join(RAIZ, 'files', 'e2e-export-real');
mkdirSync(SAIDA, { recursive: true });
const pixels = (...a) => {
  try { return { ok: true, r: JSON.parse(execFileSync(PYTHON, [join(RAIZ, 'tests', 'conferir_pixels.py'), ...a]).toString()) }; }
  catch (e) { return { ok: false, r: (e.stdout || '').toString() + (e.stderr || '').toString() }; }
};
// e-mail na página de 595 × 842 pt, achado pelo PyMuPDF: (60; 90,5) a (267,04; 117,98)
const EMAIL = [60, 90.5, 267.04, 117.98];
const W = 595, H = 842;

montar();
const n = await abrirNavegador(SAIDA);
await n.abrirPrograma();
const aviso = () => n.js(`document.getElementById('aviso').textContent`);
const resumo = () => n.js(`document.getElementById('resumoAchados').textContent`);

// 1. recusados ao abrir
for (const [arq, re] of [['wide-userunit.pdf', /maior que o Tarja consegue salvar/], ['password.pdf', /protegido por senha/],
  ['1001-pages.pdf', /o limite é 1000/]]) {
  await n.enviarArquivo(readFileSync(join(FIX, arq)), arq);
  await n.ate(`${re}.test(document.getElementById('aviso').textContent)`, `recusar ${arq}`, 60000);
}
assert.equal(await n.js(`document.getElementById('btSalvar').disabled`), true, '1: nada aberto para salvar');
n.erros.length = 0;   // os avisos dos arquivos recusados eram esperados

// 2. tarja parcial (90,5% da largura) sobre o e-mail: a sugestão continua pendente
await n.enviarArquivo(readFileSync(join(FIX, 'simple.pdf')), 'simple.pdf');
await n.ate(`document.getElementById('tela').dataset.pagina === '1'`, 'abrir simple.pdf', 30000);
await n.js(`(() => { const f = document.getElementById('folha'); if (f.checked) f.click(); })()`);
await n.clicar('btProcurar');
await n.ate(`/1 pendente/.test(document.getElementById('resumoAchados').textContent)`, 'achar o e-mail', 30000);
const larg = EMAIL[2] - EMAIL[0];
await n.arrastar((EMAIL[0] - 6) / W, (EMAIL[1] - 4) / H, (EMAIL[0] - 6 + 0.905 * (larg + 12)) / W, (EMAIL[3] + 4) / H);
await n.ate(`document.querySelectorAll('.mini-pag')[0].querySelector('.selo')?.textContent === '1'`, 'a tarja parcial entrou');
assert.match(await resumo(), /1 pendente/, '2: tarja sobre 90,5% do e-mail não resolve a sugestão');

// 3. aceita a sugestão inteira, salva e confere com o PyMuPDF
await n.clicar('btAceitarTodas');
await n.ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'aceitar');
await n.clicar('revisei');
await n.clicar('btSalvar');
const salvo = await n.esperarDownload('simple-tarjado.pdf', 60000);
writeFileSync(join(SAIDA, 'simple-tarjado.pdf'), salvo);
rmSync(join(n.baixados, 'simple-tarjado.pdf'), { force: true });   // o próximo salvamento usa o mesmo nome
for (const marca of ['SEGREDO_', 'sintetico', 'exemplo.test', 'AUTOR_FICTICIO']) {
  assert.ok(!salvo.includes(Buffer.from(marca)), `3: "${marca}" não pode estar no PDF salvo`);
}
const exame = JSON.parse(execFileSync(PYTHON, ['-c', `import fitz,json,sys
d=fitz.open(sys.argv[1]); p=d[0]
print(json.dumps({"texto": "".join(x.get_text() for x in d).strip(), "anexos": d.embfile_count(), "comentarios": sum(len(list(x.annots())) for x in d),
  "metadados": {k: v for k, v in (d.metadata or {}).items() if v and ("SEGREDO" in v or "FICTICIO" in v)}}))`, join(SAIDA, 'simple-tarjado.pdf')]).toString());
assert.deepEqual(exame, { texto: '', anexos: 0, comentarios: 0, metadados: {} }, '3: PyMuPDF não acha nada do original');
const cobre = pixels('regiao', join(SAIDA, 'simple-tarjado.pdf'), join(FIX, 'simple-original.pdf'), ...EMAIL.map((v, i) => String(v + (i < 2 ? -2 : 2))));
assert.ok(cobre.ok, '3: o e-mail coberto pixel a pixel (PyMuPDF): ' + JSON.stringify(cobre.r));

// 4. página inteira coberta, PNG e JPEG: o interior sai preto
for (const formato of ['png', 'jpeg']) {
  await n.js(`(() => { const f = document.getElementById('formato'); f.value = '${formato}'; f.dispatchEvent(new Event('change')); })()`);
  await n.clicar('btPaginaInteira');
  await n.clicar('revisei');
  await n.clicar('btSalvar');
  const total = await n.esperarDownload('simple-tarjado.pdf', 60000);
  writeFileSync(join(SAIDA, `total-${formato}.pdf`), total);
  rmSync(join(n.baixados, 'simple-tarjado.pdf'), { force: true });
  const r = pixels('preto', join(SAIDA, `total-${formato}.pdf`), formato === 'jpeg' ? '16' : '0');
  assert.ok(r.ok, `4: página inteira preta em ${formato}: ` + JSON.stringify(r.r));
  await n.tecla('z', 'KeyZ', 90, 2);    // Ctrl+Z: desfaz a página inteira para a próxima rodada
}

assert.deepEqual(n.erros, [], 'console limpo');
await n.fechar();
console.log('exportação real: tudo certo (recusas, tarja parcial pendente, e-mail coberto pixel a pixel pelo PyMuPDF, nada do original, página inteira preta em PNG e JPEG)');
