// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Fechar a aba no meio da procura e reabrir: a procura tem de voltar a funcionar. Na 1.2.2, o PDF.js destruído no
// fechamento deixava a procura esperando para sempre, e o botão Procurar ficava desligado até recarregar a página
// (docs/E2E-LINUX-1.2.2.md, achado 1). Fecha 12 vezes, com atrasos diferentes, num PDF de 300 páginas feito na hora
// (dados fictícios). Uso: node tests/e2e_procura_fechar.mjs [pasta]
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, montar, abrirNavegador, espera } from './navegador.mjs';

const CAPTURAS = process.argv[2] || join(RAIZ, 'files', 'e2e-procura-fechar');
const ATRASOS = [0, 10, 20, 20, 30, 50, 50, 80, 100, 150, 20, 50];
montar();
const n = await abrirNavegador(CAPTURAS);
const { js, ate, clicar, erros } = n;

let ok = false;
try {
  await n.abrirPrograma();
  const pdf = Buffer.from(await js(`(() => { const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' }); d.setFontSize(14);
    for (let p = 0; p < 300; p++) { if (p) d.addPage(); d.text('Página ' + (p + 1), 60, 70); d.text('CPF: 831.975.872-60', 60, 100); }
    const u = new Uint8Array(d.output('arraybuffer')); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s); })()`), 'base64');
  // abre e espera as 300 miniaturas desenhadas (fechar no meio delas é outro assunto)
  const abrir = async (rotulo) => {
    await n.enviarArquivo(pdf, 'trezentas.pdf');
    await ate(`document.getElementById('infoPaginas').textContent === '300' && document.querySelectorAll('#abas .aba').length === 1`, rotulo, 60000);
    await ate(`(() => { const c = document.querySelectorAll('.mini-pag canvas')[299]; if (!c) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] < 128) return true; return false; })()`, rotulo + ': miniaturas', 60000);
  };
  const vezes = [];
  for (const atraso of ATRASOS) {
    await abrir('abrir');
    // pede a procura e fecha a aba no X depois do atraso, ainda no meio (300 páginas levam bem mais que 150 ms)
    const naHora = await js(`new Promise((ok) => { document.getElementById('btProcurar').click(); setTimeout(() => {
      const t = document.getElementById('resumoAchados').textContent; document.querySelectorAll('#abas .aba-fechar')[0].click(); ok(t); }, ${atraso}); })`);
    await ate(`document.querySelectorAll('#abas .aba').length === 0`, 'fechar no meio da procura', 5000);
    await abrir('reabrir');
    // a procura que foi interrompida tem de ter parado: o botão volta a funcionar
    await ate(`!document.getElementById('btProcurar').disabled`, `Procurar ligado depois de fechar no meio (atraso ${atraso} ms, "${naHora}")`, 10000);
    await clicar('btProcurar');
    await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procurar de novo', 60000);
    assert.match(await js(`document.getElementById('resumoAchados').textContent`), /^300 pendente\(s\): CPF 300$/, 'a procura nova acha os 300 CPFs');
    vezes.push(naHora);
    await clicar('btFechar');
    await ate(`document.querySelectorAll('#abas .aba').length === 0`, 'fechar', 5000);
  }
  // pelo menos metade das vezes a aba fechou com a procura em andamento (senão o teste não provou nada)
  const noMeio = vezes.filter((t) => /^Procurando/.test(t)).length;
  assert.ok(noMeio >= ATRASOS.length / 2, `fechou no meio da procura em ${noMeio} de ${ATRASOS.length} vezes`);
  assert.deepEqual(erros, [], 'console sem erro nem aviso');
  ok = true;
  console.log(`procura e fechar: tudo certo (${ATRASOS.length} vezes, ${noMeio} no meio da procura, a procura volta a cada vez)`);
} catch (e) {
  console.error('procura e fechar FALHOU: ' + e.message);
  if (erros.length) console.error('console do navegador:\n  ' + erros.join('\n  '));
} finally {
  await n.fechar();
}
process.exit(ok ? 0 : 1);
