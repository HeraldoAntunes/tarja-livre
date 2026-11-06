// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Fechar a aba no meio do trabalho (achados 1 e 2 do e2e no Linux da 1.2.2, docs/E2E-LINUX-1.2.2.md no ramo
// e2e-linux-1.2.2), com um PDF de 300 páginas feito na hora, só com dados fictícios:
//   1. fechar a aba durante a procura, 8 vezes, com atrasos diferentes: o Procurar volta a ligar logo depois e a
//      procura nova acha tudo (antes, o pedido de página pendente do PDF destruído deixava o botão desligado);
//   2. fechar a aba durante o desenho das miniaturas, 5 vezes: nada de aviso no console (o cancelamento não é erro);
//   3. clicar em Fechar logo depois de escolher o arquivo, antes de ele aparecer, 4 vezes (achado 4): o arquivo não
//      abre (antes, o Fechar ficava desligado sem aba e o arquivo abria logo depois).
// Uso: node tests/e2e_fechar_no_meio.mjs [pasta para as capturas]   (TARJA_HTML=<html> testa outro HTML, sem montar)
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, HTML, montar, abrirNavegador, espera } from './navegador.mjs';

const CAPTURAS = process.argv[2] || join(RAIZ, 'files', 'e2e-fechar-no-meio');
const PAGINAS = 300;
if (!process.env.TARJA_HTML) montar();
const nav = await abrirNavegador(CAPTURAS);
const { js, ate, clicar, erros } = nav;

let ok = false;
try {
  await nav.abrirPrograma(process.env.TARJA_HTML || HTML);
  // 300 páginas, cada uma com um CPF e um e-mail inventados
  await js(`(() => { const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' }); d.setFontSize(14);
    for (let p = 0; p < ${PAGINAS}; p++) { if (p) d.addPage(); d.text('Declaração de Fulano de Teste', 60, 100);
      d.text('CPF 831.975.872-60', 60, 130); d.text('E-mail fulano.teste@exemplo.test', 60, 160); }
    window.__grande = new Uint8Array(d.output('arraybuffer')); })()`);
  const abrir = async () => {
    await js(`(() => { const dt = new DataTransfer(); dt.items.add(new File([window.__grande], 'grande.pdf', { type: 'application/pdf' }));
      const e = document.getElementById('entrada'); e.files = dt.files; e.dispatchEvent(new Event('change')); })()`);
    await ate(`document.getElementById('infoPaginas').textContent === '${PAGINAS}' && document.querySelectorAll('#abas .aba').length === 1
      && document.getElementById('tela').dataset.pagina === '1'`, 'abrir o PDF grande', 120000);
  };
  const fecharAba = () => js(`document.querySelectorAll('#abas .aba-fechar')[0]?.click()`);

  // ---- 1. fechar durante a procura ----
  const travadas = [];
  for (const atraso of [0, 10, 20, 35, 50, 80, 120, 200]) {
    await abrir();
    const naHora = await js(`new Promise((ok) => { document.getElementById('btProcurar').click();
      setTimeout(() => { const t = document.getElementById('resumoAchados').textContent;
        document.querySelectorAll('#abas .aba-fechar')[0]?.click(); ok(t); }, ${atraso}); })`);
    await ate(`document.querySelectorAll('#abas .aba').length === 0`, 'fechar a aba');
    await abrir();
    let ligado = false;
    for (let t = 0; t < 25 && !ligado; t++) { ligado = await js(`!document.getElementById('btProcurar').disabled`); if (!ligado) await espera(200); }
    if (!ligado) { travadas.push(`${atraso} ms ("${naHora}")`); await fecharAba(); continue; }
    await clicar('btProcurar');
    await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procurar de novo', 60000);
    const sugestoes = await js(`Number((document.getElementById('resumoAchados').textContent.match(/(\\d+)/) || [])[1] || 0)`);
    assert.ok(sugestoes >= 2 * PAGINAS, `procura nova depois de fechar aos ${atraso} ms achou ${sugestoes} sugestões`);
    await fecharAba();
    await ate(`document.querySelectorAll('#abas .aba').length === 0`, 'fechar a aba');
  }
  assert.deepEqual(travadas, [], 'o Procurar ficou desligado depois de fechar a aba no meio da procura');

  // ---- 2. fechar durante o desenho das miniaturas ----
  const antes = erros.length;
  for (let k = 0; k < 5; k++) {
    await js(`(() => { const dt = new DataTransfer(); dt.items.add(new File([window.__grande], 'grande.pdf', { type: 'application/pdf' }));
      const e = document.getElementById('entrada'); e.files = dt.files; e.dispatchEvent(new Event('change')); })()`);
    await ate(`document.getElementById('tela').dataset.pagina === '1' && document.querySelectorAll('#abas .aba').length === 1`, 'abrir', 120000);
    await clicar('btFechar');
    await ate(`document.querySelectorAll('#abas .aba').length === 0`, 'fechar durante as miniaturas');
    await espera(500);
  }
  await espera(1500);
  assert.deepEqual(erros.slice(antes).filter((e) => /miniatura/.test(e)), [], 'aviso de miniatura no console depois de fechar');

  // ---- 3. Fechar logo depois de escolher o arquivo, antes de ele aparecer ----
  const abriram = [];
  for (const atraso of [0, 5, 15, 40]) {
    await js(`new Promise((ok) => { const dt = new DataTransfer(); dt.items.add(new File([window.__grande], 'grande.pdf', { type: 'application/pdf' }));
      const e = document.getElementById('entrada'); e.files = dt.files; e.dispatchEvent(new Event('change'));
      setTimeout(() => { document.getElementById('btFechar').click(); ok(); }, ${atraso}); })`);
    await espera(2500);
    if (await js(`document.querySelectorAll('#abas .aba').length`)) {
      abriram.push(`${atraso} ms`);
      await fecharAba();
      await ate(`document.querySelectorAll('#abas .aba').length === 0`, 'fechar a aba que abriu');
    }
  }
  assert.deepEqual(abriram, [], 'o arquivo abriu depois do Fechar');
  assert.equal(await js(`document.getElementById('tela').hidden`), true, 'a tela ficou com página depois do Fechar');
  assert.deepEqual(erros, [], 'console sem erro inesperado');
  ok = true;
  console.log('fechar no meio: tudo certo (8 procuras interrompidas, Procurar religado e procura nova completa; 5 fechamentos durante as miniaturas, console limpo; Fechar antes de o arquivo aparecer, 4 vezes, sem abrir)');
} catch (e) {
  console.error('fechar no meio FALHOU:', e.message);
  if (erros.length) console.error('console do navegador:\n  ' + erros.join('\n  '));
} finally {
  await nav.fechar();
  process.exit(ok ? 0 : 1);
}
