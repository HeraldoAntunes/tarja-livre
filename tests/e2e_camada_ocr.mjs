// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Teste de ponta a ponta da página digitalizada que já vem com texto invisível por cima (o OCR de outro programa),
// quando esse texto não coincide com as letras da imagem (achado 1 de docs/PROVA-TARJA-1.2.2.md): na página 1 a
// camada invisível é mais estreita que a imagem, na 2 ela está 6 pontos abaixo. A procura acha os dados na camada e
// o PDF salvo é comparado pixel a pixel com a máscara (os mesmos dados desenhados sozinhos, no mesmo lugar da imagem):
// todo pixel de dado tem que estar preto. Na 1.2.2 sobravam letras à mostra. Uso: node tests/e2e_camada_ocr.mjs [pasta]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, HTML, montar, abrirNavegador } from './navegador.mjs';

const CAPTURAS = process.argv[2] || join(RAIZ, 'files', 'e2e-camada-ocr');
if (!process.env.TARJA_HTML) montar();
const nav = await abrirNavegador(CAPTURAS);
const { js, ate, clicar, texto, erros } = nav;

// linhas da página: [texto antes, dado] (dados fictícios, ver tests/fixtures/LEIA-ME.md)
const LINHAS = [['Declaração de exemplo (página digitalizada)', ''], ['Nome: ', 'Fulano de Teste'], ['CPF: ', '831.975.872-60']];

let ok = false;
try {
  await nav.abrirPrograma(process.env.TARJA_HTML || HTML);
  // a imagem (150 ppp) com as letras; a máscara só com os dados; por cima, o texto invisível de cada página
  const pdf = await js(`(() => {
    const linhas = ${JSON.stringify(LINHAS)};
    const fazer = (soDados) => { const c = document.createElement('canvas'); c.width = 1240; c.height = 1754;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#111';
      x.font = '36px Arial'; x.textBaseline = 'alphabetic';
      linhas.forEach(([a, dado], i) => { const y = 220 + i * 90;
        if (!soDados) x.fillText(a, 150, y);
        if (dado) x.fillText(dado, 150 + x.measureText(a).width, y); });
      return c; };
    const pagina = fazer(false); window.__mascara = fazer(true);
    const pt = 595.28 / 1240;
    const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    // página 1: camada 20% mais estreita que as letras da imagem; página 2: do mesmo tamanho, 6 pontos abaixo
    [[0.8, 0], [1, 6]].forEach(([tam, desce], p) => {
      if (p) d.addPage('a4', 'p');
      d.addImage(pagina.toDataURL('image/png'), 'PNG', 0, 0, 595.28, 841.89);
      d.setFontSize(36 * pt * tam);
      linhas.forEach(([a, dado], i) => d.text(a + dado, 150 * pt, (220 + i * 90) * pt + desce, { renderingMode: 'invisible' }));
    });
    const u = new Uint8Array(d.output('arraybuffer')); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s);
  })()`);
  await nav.enviarArquivo(Buffer.from(pdf, 'base64'), 'camada-ocr.pdf');
  await ate(`document.getElementById('infoPaginas').textContent === '2' && document.getElementById('tela').dataset.pagina === '1'`, 'abrir');

  await js(`(() => { const t = document.getElementById('termos'); t.value = 'Fulano de Teste'; t.dispatchEvent(new Event('input')); })()`);
  await clicar('btProcurar');
  await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procura', 60000);
  const resumo = await texto('resumoAchados');
  assert.match(resumo, /^4 pendente/, 'CPF e nome nas duas páginas: ' + resumo);
  // na 1.2.3, toda sugestão da camada invisível diz "confira" e só é aceita depois de aberta na lista
  const lista = await js(`[...document.querySelectorAll('.sugestao .onde')].map((e) => e.textContent)`);
  assert.ok(lista.every((t) => /confira/.test(t)), 'sugestão sem "confira": ' + lista.join('; '));
  await nav.conferirSugestoes();
  await clicar('btAceitarTodas');
  await js(`document.querySelectorAll('.mini-pag')[1].click()`);
  await ate(`document.getElementById('infoVistas').textContent === '2 de 2'`, 'páginas vistas');
  await nav.captura('1-tarjas.png');
  await clicar('revisei');
  await clicar('btSalvar');
  const saida = await nav.esperarDownload('camada-ocr-tarjado.pdf', 90000);
  const exame = await js(`(async () => {
    const s = atob('${saida.toString('base64')}'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    const d = await pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise;
    const m = window.__mascara.getContext('2d').getImageData(0, 0, 1240, 1754).data;
    const r = [];
    for (const n of [1, 2]) {
      const p = await d.getPage(n); const v = p.getViewport({ scale: 1240 / 595.28 });
      const c = document.createElement('canvas'); c.width = 1240; c.height = 1754; const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await p.render({ canvasContext: ctx, viewport: v, intent: 'print' }).promise;
      const o = ctx.getImageData(0, 0, 1240, 1754).data;
      let falhas = 0, primeiro = null;
      for (let k = 0; k < m.length; k += 4) {
        if (m[k] + m[k + 1] + m[k + 2] < 300 && o[k] + o[k + 1] + o[k + 2] > 150) { falhas++; if (!primeiro) primeiro = [(k / 4) % 1240, Math.floor(k / 4 / 1240)]; }
      }
      r.push({ falhas, primeiro, imagem: falhas ? c.toDataURL('image/png').split(',')[1] : null });
    }
    return r;
  })()`);
  exame.forEach((e, i) => { if (e.imagem) writeFileSync(join(CAPTURAS, `2-salvo-p${i + 1}.png`), Buffer.from(e.imagem, 'base64')); });
  assert.equal(exame[0].falhas, 0, `camada mais estreita: todo pixel de dado coberto (primeiro descoberto em ${exame[0].primeiro})`);
  assert.equal(exame[1].falhas, 0, `camada 6 pontos abaixo: todo pixel de dado coberto (primeiro descoberto em ${exame[1].primeiro})`);
  assert.deepEqual(await js('window.__csp'), [], 'nenhuma violação da política de segurança');
  assert.deepEqual(erros, [], 'console sem erro nem aviso');
  ok = true;
  console.log('camada de OCR: tudo certo (camada estreita e deslocada, as tarjas cobrem as letras da imagem pixel a pixel)');
} catch (e) {
  console.error('camada de OCR FALHOU:', e.message);
  if (erros.length) console.error('console do navegador:\n  ' + erros.join('\n  '));
} finally {
  await nav.fechar();
  process.exit(ok ? 0 : 1);
}
