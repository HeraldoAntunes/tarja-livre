// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Teste de ponta a ponta de vários arquivos abertos de uma vez: abas, procura em todos, estado de cada arquivo
// guardado na troca de aba (página, zoom, desfazer, conferência), carimbo comum a todos e salvamento um a um.
// Uso: node tests/e2e_varios.mjs [pasta para as capturas]
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, montar, abrirNavegador, emJs } from './navegador.mjs';

const CAPTURAS = process.argv[2] || join(RAIZ, 'files', 'e2e-varios');
montar();
const pdfTeste = readFileSync(join(RAIZ, 'tests', 'fixtures', 'tarja-teste.pdf'));
const nav = await abrirNavegador(CAPTURAS);
const { js, ate, clicar, texto, erros } = nav;

const abas = () => js(`[...document.querySelectorAll('#abas .aba')].map((a) =>
  [a.querySelector('.txt').textContent, a.querySelector('.situacao').textContent, a.classList.contains('ativa')])`);
const irPara = async (nome) => {
  await js(`[...document.querySelectorAll('#abas .aba')].find((a) => a.querySelector('.txt').textContent === ${emJs(nome)}).querySelector('.aba-nome').click()`);
  await ate(`document.getElementById('nomeArquivo').textContent === ${emJs(nome)} && !!document.getElementById('tela').dataset.pagina`, 'trocar para ' + nome);
};
async function verTodas(n) {
  for (let i = 0; i < n; i++) {
    await js(`document.querySelectorAll('.mini-pag')[${i}].click()`);
    await ate(`document.getElementById('tela').dataset.pagina === '${i + 1}'`, 'ver a página ' + (i + 1));
  }
  await ate(`document.getElementById('infoVistas').textContent === '${n} de ${n}'`, 'todas vistas');
}
const ctrl = (key, code, vk) => nav.tecla(key, code, vk, 2);

let ok = false;
try {
  await nav.abrirPrograma();
  // dois PDFs pequenos feitos na hora, com dados inventados
  const gerar = (linhas, paginas = 1) => js(`(() => { const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' }); d.setFontSize(14);
    for (let p = 0; p < ${paginas}; p++) { if (p) d.addPage(); ${emJs(linhas)}.forEach((t, i) => d.text(t, 60, 100 + 30 * i)); }
    const u = new Uint8Array(d.output('arraybuffer')); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s); })()`);
  const a = Buffer.from(await gerar(['Aluno A', 'CPF 831.975.872-60'], 2), 'base64');
  const b = Buffer.from(await gerar(['Aluna B', 'E-mail aluna.b@exemplo.test']), 'base64');

  // ---- abrir vários de uma vez, com um arquivo ruim e um repetido no meio ----
  await js(`(() => {
    const arq = (b64, nome) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      return new File([u], nome, { type: 'application/pdf' }); };
    const dt = new DataTransfer();
    dt.items.add(arq('${pdfTeste.toString('base64')}', 'tarja-teste.pdf'));
    dt.items.add(arq('${a.toString('base64')}', 'A.pdf'));
    dt.items.add(arq('${b.toString('base64')}', 'B.pdf'));
    dt.items.add(new File([new TextEncoder().encode('não sou PDF')], 'falso.pdf', { type: 'application/pdf' }));
    dt.items.add(arq('${a.toString('base64')}', 'copia de A.pdf'));
    const e = document.getElementById('entrada'); e.files = dt.files; e.dispatchEvent(new Event('change'));
  })()`);
  await ate(`document.querySelectorAll('#abas .aba').length === 3 && document.getElementById('nomeArquivo').textContent === 'tarja-teste.pdf'`, 'abrir três arquivos');
  await ate(`document.getElementById('aviso').textContent.length > 0`, 'aviso');
  assert.deepEqual(await abas(), [['tarja-teste.pdf', 'a conferir', true], ['A.pdf', 'a conferir', false], ['B.pdf', 'a conferir', false]],
    'três abas, sem o arquivo ruim nem o repetido');

  // texto dentro das tarjas, para todos os arquivos
  await js(`(() => { const r = document.getElementById('rotuloTarja'); r.value = 'omitido'; r.dispatchEvent(new Event('input')); })()`);

  // ---- procurar em todos ----
  assert.equal(await js(`document.getElementById('btProcurarTodos').hidden`), false, 'botão de procurar em todos');
  await clicar('btProcurarTodos');
  await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent) && !document.getElementById('btProcurarTodos').disabled`, 'procurar em todos');
  assert.match(await texto('resumoAchados'), /^19 pendente/, 'PDF de teste');
  await irPara('A.pdf');
  assert.match(await texto('resumoAchados'), /^2 pendente\(s\): CPF 2$/, 'A: um CPF em cada página');
  await irPara('B.pdf');
  assert.match(await texto('resumoAchados'), /^1 pendente\(s\): E-mail 1$/, 'B');
  await nav.captura('1-abas.png');

  // ---- cada arquivo guarda o seu estado ----
  await irPara('A.pdf');
  await clicar('btAceitarTodas');
  await verTodas(2);
  await clicar('revisei');
  assert.equal((await abas())[1][1], 'conferido', 'A conferido');
  await irPara('B.pdf');
  assert.equal(await js(`document.getElementById('revisei').checked`), false, 'B começa sem conferência');
  assert.equal(await texto('infoVistas'), '1 de 1', 'B: a página que apareceu conta como vista');
  await clicar('btMais'); await clicar('btMais');
  await ate(`document.getElementById('zoomTexto').textContent === '150%'`, 'zoom em B');
  await irPara('A.pdf');
  assert.equal(await texto('zoomTexto'), '100%', 'A volta com o zoom dele');
  assert.equal(await texto('paginaTexto'), '2 de 2', 'A volta na página em que estava');
  assert.equal(await js(`document.getElementById('revisei').checked`), true, 'A volta conferido');
  // o Desfazer de A desfaz o que foi feito em A (e desmarca a conferência)
  await ctrl('z', 'KeyZ', 90);
  await ate(`/^2 pendente/.test(document.getElementById('resumoAchados').textContent)`, 'Ctrl+Z em A');
  assert.equal(await js(`document.getElementById('revisei').checked`), false, 'desfazer desmarca a conferência');
  await ctrl('y', 'KeyY', 89);
  await ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'Ctrl+Y em A');
  await clicar('revisei');

  // ---- carimbo vale para todos: mudar em B tira a conferência de A ----
  await irPara('B.pdf');
  await clicar('carAtivo');
  assert.equal((await abas())[1][1], 'a conferir', 'carimbo mudou: A volta para a conferir');
  await irPara('A.pdf');
  await clicar('revisei');
  await clicar('btSalvar');
  const saidaA = await nav.esperarDownload('A-tarjado.pdf', 60000);
  await ate(`document.querySelectorAll('#abas .situacao')[1].textContent === 'salvo'`, 'A salvo');
  assert.ok(!saidaA.includes(Buffer.from('831.975')), 'A salvo sem o CPF');

  // ---- próximo arquivo e salvar B ----
  assert.equal(await js(`document.getElementById('btProximo').hidden`), false, 'botão de próximo arquivo');
  await clicar('btProximo');
  await ate(`document.getElementById('nomeArquivo').textContent === 'B.pdf'`, 'próximo é B');
  await clicar('btAceitarTodas');
  await verTodas(1);
  await clicar('revisei');
  await clicar('btSalvar');
  const saidaB = await nav.esperarDownload('B-tarjado.pdf', 60000);
  assert.ok(!saidaB.includes(Buffer.from('aluna.b')), 'B salvo sem o e-mail');
  const exameB = await js(`(async () => {
    const s = atob('${saidaB.toString('base64')}'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    const d = await pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise;
    // a tarja do e-mail tem o texto escrito em claro por cima do preto
    const p = await d.getPage(1); const v = p.getViewport({ scale: 2 });
    const c = document.createElement('canvas'); c.width = v.width; c.height = v.height; const ctx = c.getContext('2d');
    await p.render({ canvasContext: ctx, viewport: v, intent: 'print' }).promise;
    const regua = new jspdf.jsPDF({ unit: 'pt' }); regua.setFontSize(14);
    const x0 = 60 + regua.getTextWidth('E-mail '), x1 = x0 + regua.getTextWidth('aluna.b@exemplo.test');
    const linha = ctx.getImageData(Math.round(x0 * 2), Math.round((130 - 14 * 0.35) * 2), Math.round((x1 - x0) * 2), 1).data;
    let claros = 0, escuros = 0;
    for (let k = 0; k < linha.length; k += 4) { const t = linha[k] + linha[k + 1] + linha[k + 2]; if (t > 600) claros++; if (t < 150) escuros++; }
    return [d.numPages, (await (await d.getPage(d.numPages)).getTextContent()).items.map((x) => x.str).join(' '), claros, escuros];
  })()`);
  assert.equal(exameB[0], 2, 'B: a página e a folha');
  assert.match(exameB[1], /Carimbo: em todas as páginas/, 'folha de B registra o carimbo');
  assert.match(exameB[1], /Texto nas tarjas: "omitido"/, 'folha de B registra o texto nas tarjas');
  assert.ok(exameB[2] > 0 && exameB[3] > 0, `texto claro sobre a tarja preta (claros ${exameB[2]}, escuros ${exameB[3]})`);
  assert.ok(exameB[1].includes(createHashHex(b)), 'folha de B tem o SHA-256 do B original');
  assert.deepEqual((await abas()).map((x) => x[1]), ['a conferir', 'salvo', 'salvo']);
  await nav.captura('2-salvos.png');

  // ---- fechar: aba sem tarja fecha direto; a tela passa para a vizinha ----
  await js(`document.querySelectorAll('#abas .aba-fechar')[0].click()`);
  await ate(`document.querySelectorAll('#abas .aba').length === 2`, 'fechar o PDF de teste');
  await clicar('btFechar');
  await ate(`document.querySelectorAll('#abas .aba').length === 1`, 'fechar a aba da tela');
  await clicar('btFechar');
  await ate(`document.getElementById('abas').hidden && !document.getElementById('vazio').hidden`, 'tudo fechado: tela inicial');

  assert.deepEqual(await js('window.__csp'), [], 'nenhuma violação da política de segurança');
  assert.deepEqual(erros.filter((e) => !/PDF\.js recusou|não parece/.test(e)), [], 'console sem erro inesperado');
  ok = true;
  console.log('vários arquivos: tudo certo (abrir junto, repetido e ruim de fora, procurar em todos, estado por aba, carimbo comum, salvar um a um, próximo, fechar)');
  console.log('capturas em ' + CAPTURAS);
} catch (e) {
  console.error('vários arquivos FALHOU:', e.message);
  if (erros.length) console.error('console do navegador:\n  ' + erros.join('\n  '));
} finally {
  await nav.fechar();
  process.exit(ok ? 0 : 1);
}

function createHashHex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
