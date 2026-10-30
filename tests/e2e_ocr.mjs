// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Teste de ponta a ponta da versão com OCR: uma "página digitalizada" (só imagem, sem texto) com dados fictícios é
// lida pelo OCR, os dados viram sugestões, e o PDF salvo é comparado pixel a pixel com a máscara (os mesmos dados
// desenhados sozinhos, no mesmo lugar): todo pixel de dado tem que estar preto. Depois, a página fixa
// tests/fixtures/ocr-email.pdf (gerar_ocr_email.py: e-mails em que o OCR lê o @ como "&", "(D", " Q"..., entre textos
// comuns com QD, WO, Q&A, & e endereços de site): os e-mails todos sugeridos, nenhum texto comum como e-mail, e os
// e-mails cobertos pixel a pixel (máscara ocr-email-dados.pdf). Uso: node tests/e2e_ocr.mjs [pasta]
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, HTML_OCR, montar, abrirNavegador } from './navegador.mjs';

const CAPTURAS = process.argv[2] || join(RAIZ, 'files', 'e2e-ocr');
montar();
const nav = await abrirNavegador(CAPTURAS);
const { js, ate, clicar, texto, erros } = nav;

// linhas da página digitalizada: [texto antes, dado, texto depois] (dados fictícios, ver tests/fixtures/LEIA-ME.md)
const LINHAS = [
  ['Declaração de exemplo (página digitalizada)', '', ''],
  ['Nome: ', 'Fulano de Teste', ''],
  ['CPF: ', '831.975.872-60', ''],
  ['E-mail: ', 'fulano.teste@exemplo.test', ''],
  ['Telefone: ', '(00) 91234-5678', ' (recado)'],
];

let ok = false;
try {
  await nav.abrirPrograma(HTML_OCR);
  assert.equal(await js(`document.getElementById('opOcr').hidden`), false, 'opção de OCR visível na versão com OCR');

  // página A4 a 150 ppp desenhada numa imagem; a máscara tem só os dados, no mesmo lugar
  const pdf = await js(`(() => {
    const linhas = ${JSON.stringify(LINHAS)};
    const fazer = (soDados) => { const c = document.createElement('canvas'); c.width = 1240; c.height = 1754;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#111';
      x.font = '36px Arial'; x.textBaseline = 'alphabetic';
      linhas.forEach(([a, dado, b], i) => { const y = 220 + i * 90; let px = 150;
        for (const [t, eDado] of [[a, false], [dado, true], [b, false]]) { if (!t) continue;
          if (!soDados || eDado) x.fillText(t, px, y); px += x.measureText(t).width; } });
      return c; };
    const pagina = fazer(false); window.__mascara = fazer(true);
    const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    d.addImage(pagina.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595.28, 841.89);
    const u = new Uint8Array(d.output('arraybuffer')); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s);
  })()`);
  await nav.enviarArquivo(Buffer.from(pdf, 'base64'), 'digitalizado.pdf');
  await ate(`document.getElementById('infoPaginas').textContent === '1' && document.getElementById('tela').dataset.pagina === '1'`, 'abrir');

  await js(`(() => { const t = document.getElementById('termos'); t.value = 'Fulano de Teste'; t.dispatchEvent(new Event('input')); })()`);
  await clicar('btProcurar');
  await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'OCR e procura', 180000);
  const resumo = await texto('resumoAchados');
  for (const t of ['CPF 1', 'E-mail 1', 'Telefone 1', 'Termo da lista 1']) assert.ok(resumo.includes(t), t + ' em ' + resumo);
  await nav.captura('1-ocr-sugestoes.png');

  await clicar('btAceitarTodas');
  await ate(`document.getElementById('infoVistas').textContent === '1 de 1'`, 'página vista');
  await clicar('revisei');
  await clicar('btSalvar');
  const saida = await nav.esperarDownload('digitalizado-tarjado.pdf', 90000);
  const exame = await js(`(async () => {
    const s = atob('${saida.toString('base64')}'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    const d = await pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise;
    const p = await d.getPage(1); const v = p.getViewport({ scale: 1240 / 595.28 });
    const c = document.createElement('canvas'); c.width = 1240; c.height = 1754; const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await p.render({ canvasContext: ctx, viewport: v, intent: 'print' }).promise;
    const m = window.__mascara.getContext('2d').getImageData(0, 0, 1240, 1754).data;
    const o = ctx.getImageData(0, 0, 1240, 1754).data;
    let falhas = 0, primeiro = null;
    for (let k = 0; k < m.length; k += 4) {
      if (m[k] + m[k + 1] + m[k + 2] < 300 && o[k] + o[k + 1] + o[k + 2] > 150) { falhas++; if (!primeiro) primeiro = [(k / 4) % 1240, Math.floor(k / 4 / 1240)]; }
    }
    const folha = (await (await d.getPage(d.numPages)).getTextContent()).items.map((x) => x.str).join(' ');
    return { falhas, primeiro, folha, paginas: d.numPages, imagem: c.toDataURL('image/png').split(',')[1] };
  })()`);
  writeFileSync(join(CAPTURAS, '2-ocr-salvo.png'), Buffer.from(exame.imagem, 'base64'));
  assert.equal(exame.falhas, 0, `todo pixel de dado coberto (primeiro descoberto em ${exame.primeiro})`);
  assert.equal(exame.paginas, 2, 'a página e a folha');
  assert.match(exame.folha.replace(/\s+/g, ' '), /lidas por OCR: 1/, 'folha registra a leitura por OCR');

  // a página fixa dos e-mails (a imagem não depende das fontes do computador)
  const FIXTURES = join(RAIZ, 'tests', 'fixtures');
  const { emails } = JSON.parse(readFileSync(join(FIXTURES, 'ocr-email.json'), 'utf8'));
  await nav.enviarArquivo(readFileSync(join(FIXTURES, 'ocr-email.pdf')), 'ocr-email.pdf');
  await ate(`document.getElementById('nomeArquivo').textContent === 'ocr-email.pdf' && document.getElementById('tela').dataset.pagina === '1'`, 'abrir ocr-email.pdf');
  await js(`(() => { const t = document.getElementById('termos'); t.value = ''; t.dispatchEvent(new Event('input')); })()`);
  await clicar('btProcurar');
  await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'OCR e procura em ocr-email.pdf', 180000);
  const resumo2 = await texto('resumoAchados');
  await nav.captura('3-ocr-email-sugestoes.png');
  // todos os e-mails, e só eles: um texto comum lido como e-mail faria a conta passar
  assert.ok(new RegExp(`E-mail ${emails.length}(?!\\d)`).test(resumo2), `E-mail ${emails.length} em ${resumo2}`);
  assert.ok(resumo2.includes('CPF 1'), 'CPF 1 em ' + resumo2);

  await clicar('btAceitarTodas');
  await ate(`document.getElementById('infoVistas').textContent === '1 de 1'`, 'ocr-email.pdf: página vista');
  await clicar('revisei');
  await clicar('btSalvar');
  const saida2 = await nav.esperarDownload('ocr-email-tarjado.pdf', 90000);
  const mascara = readFileSync(join(FIXTURES, 'ocr-email-dados.pdf'));
  const exame2 = await js(`(async () => {
    const abrir = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      return pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise; };
    const desenhar = async (d) => { const p = await d.getPage(1); const v = p.getViewport({ scale: 1240 / p.getViewport({ scale: 1 }).width });
      const c = document.createElement('canvas'); c.width = 1240; c.height = Math.round(v.height); const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await p.render({ canvasContext: ctx, viewport: v, intent: 'print' }).promise; return c; };
    const o = await desenhar(await abrir('${saida2.toString('base64')}'));
    const m = await desenhar(await abrir('${mascara.toString('base64')}'));
    const a = m.getContext('2d').getImageData(0, 0, m.width, m.height).data;
    const b = o.getContext('2d').getImageData(0, 0, o.width, o.height).data;
    let falhas = 0, primeiro = null;
    for (let k = 0; k < a.length; k += 4) {
      if (a[k] + a[k + 1] + a[k + 2] < 300 && b[k] + b[k + 1] + b[k + 2] > 150) { falhas++; if (!primeiro) primeiro = [(k / 4) % m.width, Math.floor(k / 4 / m.width)]; }
    }
    return { falhas, primeiro, iguais: m.width === o.width && m.height === o.height, imagem: o.toDataURL('image/png').split(',')[1] };
  })()`);
  writeFileSync(join(CAPTURAS, '4-ocr-email-salvo.png'), Buffer.from(exame2.imagem, 'base64'));
  assert.ok(exame2.iguais, 'página salva do mesmo tamanho da máscara');
  assert.equal(exame2.falhas, 0, `todo pixel dos e-mails coberto (primeiro descoberto em ${exame2.primeiro})`);
  assert.deepEqual(await js('window.__csp'), [], 'nenhuma violação da política de segurança');
  assert.deepEqual(erros, [], 'console sem erro nem aviso');
  ok = true;
  console.log('OCR: tudo certo (página digitalizada lida, CPF, e-mail, telefone e nome sugeridos, os e-mails com o @ lido errado também, nenhum texto comum como e-mail, cobertura pixel a pixel, sem rede)');
  console.log('capturas em ' + CAPTURAS);
} catch (e) {
  console.error('OCR FALHOU:', e.message);
  if (erros.length) console.error('console do navegador:\n  ' + erros.join('\n  '));
} finally {
  await nav.fechar();
  process.exit(ok ? 0 : 1);
}
