// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Os retornos do professor depois de usar a Tarja em 04/11/2026 (entram na 1.2.3-rc.9), sem janela:
//   1. Mão: é a ferramenta ao abrir; arrastar com ela rola a página ampliada e não tarja nada; o clique parado numa
//      sugestão só a mostra; segurar a barra de espaço vira Mão e soltar volta para a ferramenta de antes;
//   2. sugestões à vista: depois da procura, o contador na barra e os três passos aparecem; a barra de Aceitar e
//      Descartar fica junto da sugestão aberta e cada botão age só nela;
//   3. cores: cada cor da paleta sai opaca no PDF salvo (os pixels da tarja têm a cor escolhida, sem nada do texto de
//      baixo), e a conferência do salvar continua sem nenhum caractere; não há tarja branca, e o andamento de uma versão
//      antiga com tarja branca volta com ela preta e um aviso;
//   4. cartão "Abra um PDF para começar": clique, Enter e espaço abrem a escolha de arquivo; soltar um PDF em cima dele
//      abre o arquivo.
// Só dados fictícios. Uso: node tests/e2e_retornos.mjs [pasta para as capturas]   (TARJA_HTML=<html> testa outro HTML)
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { RAIZ, HTML, montar, abrirNavegador, espera } from './navegador.mjs';

const CAPTURAS = process.argv[2] || join(RAIZ, 'files', 'e2e-retornos');
if (!process.env.TARJA_HTML) montar();
const nav = await abrirNavegador(CAPTURAS);
const { js, ate, clicar, texto, erros, cdp } = nav;
const falhas = [];
const conferir = async (rotulo, f) => { try { await f(); } catch (e) { falhas.push(`${rotulo}: ${e.message}`); } };
const CORES = ['#000000', '#3c4043', '#1a2b4c', '#5b1a2b', '#1e3b2a'];

// PDF de 2 páginas com texto: CPF e e-mail na 1, telefone na 2 (só dados fictícios)
const fazerPdf = () => js(`(() => {
  const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  d.setFontSize(14);
  d.text('Nome: Fulano de Teste', 60, 100);
  d.text('CPF: 831.975.872-60', 60, 140);
  d.text('E-mail: fulano.teste@exemplo.test', 60, 180);
  d.addPage('a4', 'p');
  d.text('Telefone: (00) 91234-5678', 60, 100);
  const u = new Uint8Array(d.output('arraybuffer')); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s);
})()`);
const abrirPdf = async (b64, nome) => {
  await nav.enviarArquivo(Buffer.from(b64, 'base64'), nome);
  await ate(`document.getElementById('infoPaginas').textContent === '2' && document.getElementById('tela').dataset.pagina === '1'`, 'abrir ' + nome);
};
const fecharTudo = async () => {
  await js(`document.querySelectorAll('#abas .aba-fechar').forEach((b) => b.click())`);
  await nav.responder?.(true);
  await ate(`document.querySelectorAll('#abas .aba').length === 0 && !document.getElementById('vazio').hidden`, 'fechar tudo').catch(() => {});
};

try {
  await nav.abrirPrograma(process.env.TARJA_HTML || HTML);

  // ---- 4. cartão: clique, Enter e espaço abrem a escolha de arquivo; soltar o PDF nele abre ----
  await conferir('cartão', async () => {
    assert.equal(await js(`document.getElementById('vazio').hidden`), false, 'cartão à mostra sem arquivo');
    await js(`(() => { const e = document.getElementById('entrada'); window.__escolher = 0; e.click = () => { window.__escolher++; }; })()`);
    await js(`document.getElementById('vazio').click()`);
    await js(`document.getElementById('vazio').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
    await js(`document.getElementById('vazio').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))`);
    assert.equal(await js(`window.__escolher`), 3, 'clique, Enter e espaço no cartão abrem a escolha de arquivo');
    assert.match(await texto('vazio'), /Clique aqui/, 'o cartão diz que dá para clicar');
    const r = await js(`(() => { const b = document.getElementById('vazio').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
    const data = { items: [], files: [join(RAIZ, 'tests', 'fixtures', 'tarja-teste.pdf')], dragOperationsMask: 1 };
    for (const type of ['dragEnter', 'dragOver', 'drop']) await cdp('Input.dispatchDragEvent', { type, x: r.x, y: r.y, data });
    await ate(`document.querySelectorAll('#abas .aba').length === 1 && document.getElementById('tela').dataset.pagina === '1'`, 'soltar o PDF no cartão');
  });
  await fecharTudo();

  const b64 = await fazerPdf();
  await abrirPdf(b64, 'retornos.pdf');

  // ---- 1. Mão ----
  await conferir('Mão', async () => {
    assert.equal(await js(`document.querySelector('[data-ferramenta].ativo').dataset.ferramenta`), 'mao', 'a Mão é a ferramenta ao abrir');
    assert.equal(await js(`document.getElementById('tela').classList.contains('mao')`), true, 'cursor de mão');
    for (let i = 0; i < 3; i++) await clicar('btMais');
    await ate(`document.getElementById('palco').scrollHeight > document.getElementById('palco').clientHeight + 50`, 'página ampliada');
    await espera(400);
    const antes = await js(`[document.getElementById('palco').scrollLeft, document.getElementById('palco').scrollTop]`);
    await nav.arrastar(0.5, 0.5, 0.3, 0.3, { mao: true });
    const depois = await js(`[document.getElementById('palco').scrollLeft, document.getElementById('palco').scrollTop]`);
    assert.ok(depois[0] !== antes[0] || depois[1] !== antes[1], `a Mão rolou a página (${antes} -> ${depois})`);
    assert.equal(await js(`document.getElementById('btDesfazer').disabled`), true, 'a Mão não tarjou nada');
    for (let i = 0; i < 3; i++) await clicar('btMenos');
    // barra de espaço: segura vira Mão, solta volta
    await js(`document.querySelector('[data-ferramenta="caneta"]').click()`);
    await js(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))`);
    assert.equal(await js(`document.querySelector('[data-ferramenta].ativo').dataset.ferramenta`), 'mao', 'espaço segurado: Mão');
    await js(`document.body.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }))`);
    assert.equal(await js(`document.querySelector('[data-ferramenta].ativo').dataset.ferramenta`), 'caneta', 'espaço solto: volta para a Caneta');
    await js(`document.querySelector('[data-ferramenta="mao"]').click()`);
  });

  // ---- 2. sugestões à vista ----
  await conferir('sugestões', async () => {
    assert.equal(await js(`document.getElementById('btSugestoes').hidden`), true, 'sem procura, sem contador');
    await clicar('btProcurar');
    await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procura');
    assert.equal(await texto('btSugestoes'), '3 sugestões para conferir', 'contador na barra');
    assert.equal(await js(`document.getElementById('passosSugestoes').hidden`), false, 'os três passos à mostra');
    // com a Mão, o clique parado na sugestão do CPF só a mostra: aparece a barra junto dela, nada é tarjado
    await js(`[...document.querySelectorAll('#listaSugestoes .sugestao')].find((l) => /CPF/.test(l.textContent)).querySelector('button').click()`);
    await ate(`!document.getElementById('acoesSugestao').hidden`, 'barra junto da sugestão');
    assert.match(await texto('acoesTexto'), /CPF/);
    await clicar('btAceitarEsta');
    await ate(`document.getElementById('resumoAchados').textContent === '2 pendente(s): E-mail 1, Telefone 1'`, 'aceitar só o CPF');
    assert.equal(await js(`document.getElementById('acoesSugestao').hidden`), true, 'a barra some depois de aceitar');
    // a barra do e-mail: Descartar tira só ele
    await js(`[...document.querySelectorAll('#listaSugestoes .sugestao')].find((l) => /E-mail/.test(l.textContent)).querySelector('button').click()`);
    await ate(`!document.getElementById('acoesSugestao').hidden && /E-mail/.test(document.getElementById('acoesTexto').textContent)`, 'barra do e-mail');
    await clicar('btDescartarEsta');
    await ate(`document.getElementById('resumoAchados').textContent === '1 pendente(s): Telefone 1'`, 'descartar só o e-mail');
    assert.equal(await texto('btSugestoes'), '1 sugestão para conferir');
    // o clique parado com a Mão na sugestão da página 2 (o telefone) mostra a barra e não tarja
    await js(`document.querySelectorAll('.mini-pag')[1].click()`);
    await ate(`document.getElementById('tela').dataset.pagina === '2'`, 'página 2');
    const desfazerAntes = await js(`document.getElementById('btDesfazer').disabled`);
    const alvo = await js(`(() => { const t = document.getElementById('tela'); const r = t.getBoundingClientRect();
      return { x: r.left + r.width * (200 / 595.28), y: r.top + r.height * (96 / 841.89) }; })()`);
    for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, ...alvo, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
    await ate(`!document.getElementById('acoesSugestao').hidden && /Telefone/.test(document.getElementById('acoesTexto').textContent)`, 'clique da Mão na sugestão');
    assert.equal(await js(`document.getElementById('resumoAchados').textContent`), '1 pendente(s): Telefone 1', 'o clique da Mão não aceitou');
    assert.equal(await js(`document.getElementById('btDesfazer').disabled`), desfazerAntes, 'o clique da Mão não tarjou');
    await nav.captura('2-barra-da-sugestao.png');
    await clicar('btAceitarEsta');
    await ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'aceitar o telefone');
    assert.equal(await js(`document.getElementById('btSugestoes').hidden`), true, 'sem sugestão, sem contador');
  });
  await fecharTudo();

  // ---- 2b. página com imagem: tudo "confira"; o Aceitar todas não tarja, diz isso e abre a primeira ----
  await conferir('aceitar com confira', async () => {
    const comImagem = await js(`(() => {
      const c = document.createElement('canvas'); c.width = 120; c.height = 60; const g = c.getContext('2d');
      g.fillStyle = '#3a6'; g.fillRect(0, 0, 120, 60); g.fillStyle = '#fff'; g.font = '20px sans-serif'; g.fillText('LOGO', 20, 38);
      const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
      d.addImage(c.toDataURL('image/png'), 'PNG', 400, 40, 120, 60);
      d.setFontSize(14);
      d.text('CPF: 831.975.872-60', 60, 140);
      d.text('E-mail: fulano.teste@exemplo.test', 60, 180);
      d.addPage('a4', 'p');
      d.text('Telefone: (00) 91234-5678', 60, 100);
      const u = new Uint8Array(d.output('arraybuffer')); let s = ''; for (const x of u) s += String.fromCharCode(x); return btoa(s);
    })()`);
    await abrirPdf(comImagem, 'com-logo.pdf');
    await clicar('btProcurar');
    await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procura');
    const notas = await js(`[...document.querySelectorAll('.sugestao')].map((l) => l.classList.contains('revisar'))`);
    assert.deepEqual(notas, [true, true, false], 'as duas da página com imagem são "confira", a da página 2 não');
    await clicar('btAceitarTodas');
    await ate(`/Falta/.test(document.getElementById('aviso').textContent)`, 'aviso do que ficou');
    assert.match(await texto('aviso'), /^1 tarja aplicada\. Faltam 2 sugestões marcadas "confira": elas só são tarjadas depois que você olha cada uma/);
    await ate(`!document.getElementById('acoesSugestao').hidden && document.getElementById('tela').dataset.pagina === '1'`, 'a primeira "confira" aberta');
    await nav.captura('2b-confira-aberta.png');
    // a que abriu sozinha não conta como vista: o Aceitar todas de novo não a aceita
    await clicar('btAceitarTodas');
    await espera(300);
    assert.match(await texto('resumoAchados'), /^2 pendente/, 'o Aceitar todas de novo não aceitou a que abriu sozinha');
    // o Aceitar junto dela tarja e abre a próxima
    await clicar('btAceitarEsta');
    await ate(`/^1 pendente/.test(document.getElementById('resumoAchados').textContent) && !document.getElementById('acoesSugestao').hidden`, 'aceitar e abrir a próxima');
    await clicar('btAceitarEsta');
    await ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'aceitar a última');
  });
  await fecharTudo();

  // ---- 3. cores opacas no PDF salvo ----
  for (const c of CORES) {
    await conferir('cor ' + c, async () => {
      await abrirPdf(b64, `cor-${c.slice(1)}.pdf`);
      await js(`document.querySelector('[data-cor="${c}"]').click()`);
      // tarja à mão sobre o nome (linha de y = 100 pt), em frações da página A4
      await nav.arrastar(50 / 595.28, 84 / 841.89, 330 / 595.28, 108 / 841.89);
      await ate(`!document.getElementById('btDesfazer').disabled`, 'tarja posta');
      await nav.captura(`3-cor-${c.slice(1)}.png`);
      for (let i = 0; i < 2; i++) {
        await js(`document.querySelectorAll('.mini-pag')[${i}].click()`);
        await ate(`document.getElementById('tela').dataset.pagina === '${i + 1}'`, 'ver a página');
      }
      await js(`(() => { const r = document.getElementById('revisei'); if (!r.checked) r.click(); })()`);
      await nav.responder?.(true);
      await clicar('btSalvar');
      const saida = await nav.esperarDownload(`cor-${c.slice(1)}-tarjado.pdf`, 60000);
      await ate(`!document.body.classList.contains('ocupado')`, 'fim do salvar');
      const r = await js(`(async () => {
        const s = atob('${saida.toString('base64')}'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        const d = await pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise;
        const p = await d.getPage(1); const v = p.getViewport({ scale: 150 / 72 });
        const cv = document.createElement('canvas'); cv.width = Math.round(v.width); cv.height = Math.round(v.height);
        const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
        await p.render({ canvasContext: x, viewport: v, intent: 'print' }).promise;
        const texto = (await p.getTextContent()).items.length;
        // o miolo da tarja (com folga de 4 pt para a borda suavizada): todo pixel tem a cor escolhida
        const k = 150 / 72, x0 = Math.round(56 * k), y0 = Math.round(88 * k), x1 = Math.round(322 * k), y1 = Math.round(104 * k);
        const px = x.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        const alvo = [${parseInt(c.slice(1, 3), 16)}, ${parseInt(c.slice(3, 5), 16)}, ${parseInt(c.slice(5, 7), 16)}];
        let fora = 0, pior = 0;
        for (let i = 0; i < px.length; i += 4) {
          const dif = Math.abs(px[i] - alvo[0]) + Math.abs(px[i + 1] - alvo[1]) + Math.abs(px[i + 2] - alvo[2]);
          pior = Math.max(pior, dif);
          if (dif > 24) fora++;
        }
        return { texto, fora, pior, total: px.length / 4 };
      })()`);
      assert.equal(r.texto, 0, 'o PDF salvo não tem texto');
      assert.equal(r.fora, 0, `pixels da tarja fora da cor ${c}: ${r.fora} de ${r.total} (pior diferença ${r.pior})`);
    });
    await fecharTudo();
  }

  // ---- 3b. sem tarja branca; o andamento antigo com branca volta preto ----
  await conferir('sem branca', async () => {
    assert.deepEqual(await js(`[...document.querySelectorAll('[data-cor]')].map((b) => b.dataset.cor)`), CORES, 'só as cinco cores escuras');
    // o andamento que uma versão antiga deixou para este PDF (a chave é o SHA-256 dele), antes de abrir
    const hash = createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex');
    await js(`new Promise((ok) => { const q = indexedDB.open('tarja-livre', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('andamento');
      q.onsuccess = () => { const tx = q.result.transaction('andamento', 'readwrite');
        tx.objectStore('andamento').put({ quando: Date.now(), paginas: [{ vista: false, marcas: [{ tipo: 'tarja', cor: '#ffffff', x: 50, y: 84, w: 280, h: 24 }] },
          { vista: false, marcas: [] }] }, '${hash}');
        tx.oncomplete = () => { q.result.close(); ok(true); }; }; })`);
    await abrirPdf(b64, 'antigo.pdf');
    await ate(`!document.getElementById('andamento').hidden`, 'a oferta do andamento', 10000);
    await clicar('btRecuperar');
    await ate(`/tarja branca virou preta/.test(document.getElementById('aviso').textContent)`, 'aviso da branca que virou preta');
    await nav.captura('4-branca-virou-preta.png');
    await js(`document.querySelector('[data-ferramenta="tarja"]').click()`);
  });
  await fecharTudo();

  await conferir('console', () => assert.deepEqual(erros, [], 'console com erro'));
} catch (e) {
  falhas.push(e.message);
} finally {
  await nav.fechar();
}
if (falhas.length) {
  console.error('retornos FALHOU:\n  ' + falhas.join('\n  '));
  process.exit(1);
}
console.log('retornos: tudo certo (Mão, sugestões à vista, cores opacas no PDF salvo, cartão que abre e recebe o PDF)');
process.exit(0);
