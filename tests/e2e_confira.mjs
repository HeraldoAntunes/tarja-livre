// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Achados da revisão do Codex na 1.2.3-rc.1 (Ordem 24), com PDFs feitos na hora, só com dados fictícios:
//   1. página digitalizada com camada de texto invisível 32 pontos abaixo da palavra (o ocr-longe): a sugestão sai
//      com "confira"; "Aceitar todas" não a aceita enquanto a pessoa não a abre na lista, e o Salvar não passa;
//      depois de aberta, aceita e salva;
//   2. procura num arquivo de 250 páginas, troca para outro e fecha o primeiro no meio: a mensagem não pode dizer
//      "Nada encontrado" sobre o outro, que não foi procurado;
//   3. (revisão do Codex na 1.2.3-rc.2) duas páginas do cinza-claro ORIGINAL da Ordem 24, só a primeira sugestão
//      aberta: Descartar pergunta antes, porque a segunda não foi conferida; dizendo não, nada é descartado.
// Uso: node tests/e2e_confira.mjs [pasta para as capturas]   (TARJA_HTML=<html> testa outro HTML, sem montar)
import { join, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { RAIZ, HTML, montar, abrirNavegador, espera } from './navegador.mjs';

const CAPTURAS = process.argv[2] || join(RAIZ, 'files', 'e2e-confira');
if (!process.env.TARJA_HTML) montar();
const nav = await abrirNavegador(CAPTURAS);
const { js, ate, clicar, texto, erros } = nav;
const falhas = [];
const conferir = async (rotulo, f) => { try { await f(); } catch (e) { falhas.push(`${rotulo}: ${e.message}`); } };

try {
  await nav.abrirPrograma(process.env.TARJA_HTML || HTML);

  // ---- 1. sugestão da camada invisível: confira, e o Salvar só depois de olhar ----
  await conferir('camada invisível', parte1);
  await js(`document.querySelectorAll('#abas .aba-fechar').forEach((b) => b.click())`);
  await ate(`document.querySelectorAll('#abas .aba').length === 0`, 'fechar o cartão');
  // ---- 2. procura cancelada não diz "Nada encontrado" sobre outro arquivo ----
  await conferir('procura cancelada', parte2);
  await js(`document.querySelectorAll('#abas .aba-fechar').forEach((b) => b.click())`);
  await ate(`document.querySelectorAll('#abas .aba').length === 0`, 'fechar B');
  // ---- 3. Descartar com sugestão "confira" não aberta pede confirmação ----
  await conferir('descartar sem conferir', parte3);
  await conferir('console', () => assert.deepEqual(erros, [], 'console com erro'));
} catch (e) {
  falhas.push(e.message);
} finally {
  await nav.fechar();
}
if (falhas.length) {
  console.error('confira FALHOU:\n  ' + falhas.join('\n  '));
  process.exit(1);
}
console.log('confira: tudo certo (sugestão da camada invisível com "confira", aceitar e salvar só depois de ver; procura cancelada sem "Nada encontrado"; descartar sem conferir pergunta antes)');
process.exit(0);

async function parte1() {
  await js(`(() => {
    const c = document.createElement('canvas'); c.width = 990; c.height = 555; const g = c.getContext('2d');
    g.fillStyle = '#fafafa'; g.fillRect(0, 0, 990, 555); g.fillStyle = '#141414';
    g.font = '54px monospace'; g.fillText('SIGILOCODIGO', 180, 270);
    g.font = '36px monospace'; g.fillText('CONTROLE PUBLICO', 180, 435);
    const d = new jspdf.jsPDF({ unit: 'pt', format: [330, 185], orientation: 'landscape' });
    d.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, 330, 185);
    d.setFont('courier'); d.setFontSize(18);
    d.text('SIGILOCODIGO', 60, 122, { renderingMode: 'invisible' });
    const u = new Uint8Array(d.output('arraybuffer'));
    const dt = new DataTransfer(); dt.items.add(new File([u], 'cartao.pdf', { type: 'application/pdf' }));
    const e = document.getElementById('entrada'); e.files = dt.files; e.dispatchEvent(new Event('change')); })()`);
  await ate(`document.getElementById('tela').dataset.pagina === '1'`, 'abrir o cartão');
  await js(`(() => { const t = document.getElementById('termos'); t.value = 'SIGILOCODIGO'; t.dispatchEvent(new Event('input')); })()`);
  await clicar('btProcurar');
  await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procurar no cartão', 60000);
  const lista = await js(`[...document.querySelectorAll('.sugestao .onde')].map((e) => e.textContent)`);
  await conferir('lista', () => assert.ok(lista.length === 1 && /confira/.test(lista[0]), 'sugestão sem "confira": ' + lista));
  // a página com imagem volta a "não vista" depois da procura (revisão da gestão na 1.2.3-rc.6, A2); o
  // Aceitar todas abre sozinho a primeira "confira" e mostra a página, o que conta como ver (decisão da gestão na rc.9)
  await conferir('página com imagem precisa ser vista de novo', async () => {
    assert.equal(await js(`document.getElementById('revisei').disabled`), true, 'o "Revisei" ficou livre sem ver de novo a página');
  });
  await clicar('btAceitarTodas');
  await espera(300);
  await conferir('aceitar todas antes de olhar', async () => {
    assert.match(await texto('resumoAchados'), /1 pendente/, 'aceitou a sugestão "confira" sem a pessoa ver');
    assert.match(await texto('aviso'), /confira/, 'o aviso não explica o que falta');
  });
  await js(`document.querySelector('.mini-pag').click()`);
  await ate(`document.getElementById('infoVistas').textContent === '1 de 1'`, 'página vista');
  await js(`(() => { const r = document.getElementById('revisei'); if (!r.checked) r.click(); })()`);
  await nav.responder(true);   // se a versão perguntar "salvar com sugestões pendentes?", a resposta é sim
  await clicar('btSalvar');
  await conferir('salvar antes de olhar', async () => {
    let salvou = false;
    try { await nav.esperarDownload('cartao-tarjado.pdf', 4000); salvou = true; } catch { /* não salvou: certo */ }
    assert.equal(salvou, false, 'salvou com a sugestão "confira" sem a pessoa ver');
    assert.match(await texto('aviso'), /Antes de salvar/, 'o aviso não explica por que não salvou');
  });
  await ate(`!document.body.classList.contains('ocupado')`, 'livre depois do salvar');
  await js(`document.querySelector('.sugestao.revisar button').click()`);
  await ate(`/\\(vista\\)/.test(document.querySelector('.sugestao .onde')?.textContent || '')`, 'marcada como vista');
  await clicar('btAceitarTodas');
  await ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'aceitar depois de olhar');
  await js(`(() => { const r = document.getElementById('revisei'); if (!r.checked) r.click(); })()`);
  await clicar('btSalvar');
  await conferir('salvar depois de olhar', async () => { await nav.esperarDownload('cartao-tarjado.pdf', 30000); });
  await ate(`!document.body.classList.contains('ocupado')`, 'fim do salvar');
}

async function parte2() {
  await js(`(() => { const u = (t, n) => { const d = new jspdf.jsPDF(); for (let i = 0; i < n; i++) { if (i) d.addPage(); d.text(t, 20, 30); }
      return new Uint8Array(d.output('arraybuffer')); };
    const dt = new DataTransfer(); dt.items.add(new File([u('segredo.a@exemplo.test', 250)], 'A-ficticio.pdf'));
    dt.items.add(new File([u('segredo.b@exemplo.test', 1)], 'B-ficticio.pdf'));
    const e = document.getElementById('entrada'); e.files = dt.files; e.dispatchEvent(new Event('change')); })()`);
  await ate(`document.querySelectorAll('#abas .aba').length === 2 && document.getElementById('tela').dataset.pagina === '1'`, 'dois arquivos', 60000);
  await js(`document.querySelectorAll('#abas .aba')[0].querySelector('button:not(.aba-fechar)').click()`);
  await ate(`document.getElementById('infoPaginas').textContent === '250'`, 'A na tela');
  await js(`(() => { const p = document.getElementById('btProcurar'); p.click(); p.click();
    document.querySelectorAll('#abas .aba')[1].querySelector('button:not(.aba-fechar)').click();
    document.querySelectorAll('#abas .aba-fechar')[0].click(); })()`);
  await ate(`!document.getElementById('btProcurar').disabled && document.querySelectorAll('#abas .aba').length === 1`, 'procura volta');
  const aviso = await texto('aviso');
  await conferir('procura cancelada', () => assert.doesNotMatch(aviso, /Nada encontrado/, `aviso sobre B, que não foi procurado: "${aviso}"`));
  await clicar('btProcurar');
  await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procurar em B');
  const achados = await js(`[...document.querySelectorAll('.sugestao .trecho')].map((e) => e.textContent)`);
  await conferir('procura em B', () => assert.deepEqual(achados, ['segredo.b@exemplo.test']));
}

async function parte3() {
  const pdf = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'casos-codex', 'duas-paginas-cinza.pdf'));
  await nav.enviarArquivo(pdf, 'duas-paginas.pdf');
  await ate(`document.getElementById('infoPaginas').textContent === '2' && document.querySelectorAll('#abas .aba').length === 1`, 'abrir as duas páginas');
  await js(`(() => { const t = document.getElementById('termos'); t.value = 'SIGILOCODIGO'; t.dispatchEvent(new Event('input')); })()`);
  await clicar('btProcurar');
  await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procurar nas duas páginas', 60000);
  assert.match(await texto('resumoAchados'), /^2 pendente/, 'duas sugestões');
  await js(`document.querySelector('.sugestao.revisar button').click()`);
  await ate(`document.querySelectorAll('.sugestao.conferida').length === 1`, 'só a primeira aberta');
  nav.esquecerRespostas();   // o "sim" da parte 1, se o Salvar não chegou a perguntar
  const antes = nav.perguntas.length;
  nav.responder(false);
  await clicar('btDescartar');
  await espera(400);
  assert.equal(nav.perguntas.length, antes + 1, 'Descartar não perguntou nada com uma sugestão "confira" não aberta');
  assert.match(nav.perguntas.at(-1), /1 sugestão marcada.*não foi conferida.*continua legível/s, 'a pergunta não diz o que fica legível');
  assert.match(await texto('resumoAchados'), /^2 pendente/, 'dizendo não, descartou assim mesmo');
  nav.responder(true);
  await clicar('btDescartar');
  await ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'descartar dizendo sim');
}
