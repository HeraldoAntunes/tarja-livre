// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Os cenários de camada de texto invisível da prova da tarja (tests/prova_tarja/gerar_casos.py), pela camada de
// testes comum (navegador.mjs): roda no Edge sem janela e também dentro do exe (TARJA_EXE), onde a prova com o
// Puppeteer não entra. Para cada caso: abre o original.pdf, procura os termos, confere que toda sugestão da lista
// diz "confira", abre cada uma na lista, aceita todas, salva e compara pixel a pixel: onde o original.pdf e o
// sem-dados.pdf diferem (os pixels dos dados), o PDF salvo tem de estar escuro. Só dados fictícios.
// Uso: PROVA_CASOS=<pasta dos casos do gerar_casos.py> node tests/e2e_prova_ocr.mjs [pasta para as capturas]
//   (sem PROVA_CASOS: tests/casos-codex, ao lado deste arquivo: os PDFs originais das revisões do Codex)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RAIZ, HTML, montar, abrirNavegador, espera } from './navegador.mjs';

const CASOS = process.env.PROVA_CASOS || join(dirname(fileURLToPath(import.meta.url)), 'casos-codex');
const CAPTURAS = process.argv[2] || join(RAIZ, 'files', 'e2e-prova-ocr');
const nomes = readdirSync(CASOS).filter((n) => existsSync(join(CASOS, n, 'caso.json'))).sort();
if (!process.env.TARJA_HTML) montar();
const nav = await abrirNavegador(CAPTURAS);
const { js, ate, clicar, erros } = nav;
const falhas = [];

try {
  await nav.abrirPrograma(process.env.TARJA_HTML || HTML);
  for (const nome of nomes) {
    try {
      const caso = JSON.parse(readFileSync(join(CASOS, nome, 'caso.json'), 'utf8'));
      const b64 = (f) => readFileSync(join(CASOS, nome, f)).toString('base64');
      await nav.enviarArquivo(readFileSync(join(CASOS, nome, 'original.pdf')), `${nome}.pdf`);
      await ate(`document.getElementById('tela').dataset.pagina === '1' && document.querySelectorAll('#abas .aba').length === 1`, 'abrir ' + nome);
      const verTodas = async () => {
        const n = Number(await js(`document.getElementById('infoPaginas').textContent`));
        for (let i = 0; i < n; i++) {
          await js(`document.querySelectorAll('.mini-pag')[${i}].click()`);
          await ate(`document.getElementById('tela').dataset.pagina === '${i + 1}'`, 'ver a página');
        }
        return n;
      };
      // a página com imagem ou desenho volta a "não vista" depois da procura (revisão da gestão na rc.6, A2): para ver
      // isso, as páginas são vistas antes da procura
      if (caso.desenhoNaPagina) await verTodas();
      await js(`(() => { const t = document.getElementById('termos'); t.value = ${JSON.stringify(caso.termos.join('\n'))}; t.dispatchEvent(new Event('input')); })()`);
      await clicar('btProcurar');
      await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procurar em ' + nome, 60000);
      const lista = await js(`[...document.querySelectorAll('.sugestao .onde')].map((e) => e.textContent)`);
      const aviso = await js(`document.getElementById('aviso').textContent`);
      // documento comum sem imagem nem desenho (só texto, tabela, sublinhado): o aviso da procura não fala de desenho
      if (caso.semAvisoDesenho && /imagem ou desenho|não lê direito/.test(aviso)) falhas.push(`${nome}: aviso de imagem ou desenho em documento comum: ${aviso}`);
      // o dado só na imagem de uma página sem sugestão (revisão da gestão na rc.6, r4): a página entra no aviso e o
      // "Revisei" fica preso até a pessoa passar de novo por ela
      for (const n of caso.desenhoNaPagina || []) {
        if (!new RegExp(`página [0-9, ]*\\b${n}\\b[^;]*: (imagem ou desenho|texto com letras que o programa não lê direito)|página\\(s\\) sem texto`).test(aviso)) falhas.push(`${nome}: o aviso não fala da página ${n}: ${aviso}`);
      }
      if (caso.desenhoNaPagina && !(await js(`document.getElementById('revisei').disabled`))) {
        falhas.push(`${nome}: o "Revisei" ficou livre sem passar de novo pela página com imagem ou desenho`);
      }
      // a procura é só uma ajuda (desde a rc.12): o resultado diz isso, e o "nada encontrado" diz que
      // não quer dizer que não há dados pessoais
      if (!/só uma ajuda/.test(aviso)) falhas.push(`${nome}: o resultado não diz que a procura é só uma ajuda: ${aviso}`);
      if (!lista.length && !/não quer dizer que o documento não tem dados pessoais/.test(aviso)) falhas.push(`${nome}: resultado vazio sem dizer que isso não quer dizer que não há dados: ${aviso}`);
      if (!(await js(`!!document.getElementById('avisoAjuda').offsetParent`))) falhas.push(`${nome}: o aviso "só uma ajuda" não está à vista`);
      const sem = lista.filter((t) => !/confira/.test(t));
      if (caso.confira && sem.length) falhas.push(`${nome}: sugestão sem "confira": ${sem.join('; ')}`);
      // documento comum (revisão da rc.5, c1 e c3): sem imagem nem desenho fora de linha reta e retângulo, nada de
      // "confira" a mais
      if (caso.semConfira && sem.length !== lista.length) falhas.push(`${nome}: "confira" em documento comum: ${lista.join('; ')}`);
      if (caso.semConfira && !lista.length) falhas.push(`${nome}: nenhuma sugestão (controle)`);
      // dado fora da camada (revisão do Codex na 1.2.3-rc.3, recorte-publico e branco-publico): a camada escondida fica
      // sobre outra palavra da imagem, e o dado está desenhado em outra linha, onde a camada não diz nada. Sem OCR, o
      // programa não acha o dado; o que ele garante é o "confira" com a nota que manda ver se a palavra coberta é o
      // dado. Os pixels à mostra são contados e mostrados, e ficam até a pessoa tarjar à mão
      // (o dado só na imagem de outra página, desenhoNaPagina, é avisado no aviso da procura, não na nota)
      if (caso.foraDaCamada && !caso.desenhoNaPagina && !lista.every((t) => /o dado pode estar em outro ponto da página; procure e tarje à mão|o programa pode não ver dados que estejam nela; confira a página inteira/.test(t))) {
        falhas.push(`${nome}: a nota não diz que o dado pode estar em outro ponto da página: ${lista.join('; ')}`);
      }
      await nav.conferirSugestoes();
      await clicar('btAceitarTodas');
      await ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'aceitar em ' + nome);
      await verTodas();
      await nav.captura(`${nome}.png`);
      await js(`(() => { const r = document.getElementById('revisei'); if (!r.checked) r.click(); })()`);
      await clicar('btSalvar');
      const saida = await nav.esperarDownload(`${nome}-tarjado.pdf`, 60000);
      await ate(`!document.body.classList.contains('ocupado')`, 'fim do salvar');
      // pixel a pixel, na mesma escala do programa (150 ppp), como tests/prova_tarja/tarjar.mjs
      const pixels = await js(`(async () => {
        const ler = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
          return pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise; };
        const [o, n, t] = await Promise.all(['${b64('original.pdf')}', '${b64('sem-dados.pdf')}', '${saida.toString('base64')}'].map(ler));
        const desenhar = async (d, i, w, h) => { const p = await d.getPage(i); const v0 = p.getViewport({ scale: 1 });
          const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
          x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
          await p.render({ canvasContext: x, viewport: p.getViewport({ scale: w / v0.width }), intent: 'print' }).promise;
          return x.getImageData(0, 0, w, h).data; };
        // descoberto: o pixel do dado que ficou claro no salvo. inalterado: o que ficou igual ao original (diferença
        // menor que 30 na soma RGB) ou claro, como o contar2.py da revisão da gestão na rc.6 (A4): o miolo de um dado
        // escuro e grosso que sobrou sem tarja é tão escuro quanto a tarja e não conta como descoberto. O pixel preto
        // puro do original fica fora do inalterado, porque a tarja também é preta (texto preto sob tarja preta: para
        // isso vale a captura)
        let dados = 0, descobertos = 0, inalterados = 0;
        for (let i = 1; i <= o.numPages; i++) {
          const v = (await o.getPage(i)).getViewport({ scale: 150 / 72 }); const w = Math.round(v.width), h = Math.round(v.height);
          const [po, pn, pt] = await Promise.all([desenhar(o, i, w, h), desenhar(n, i, w, h), desenhar(t, i, w, h)]);
          for (let k = 0; k < po.length; k += 4) {
            if (Math.abs(po[k] - pn[k]) + Math.abs(po[k + 1] - pn[k + 1]) + Math.abs(po[k + 2] - pn[k + 2]) < 60) continue;
            dados++;
            const claro = pt[k] + pt[k + 1] + pt[k + 2] > 150;
            if (claro) descobertos++;
            const igual = Math.abs(pt[k] - po[k]) + Math.abs(pt[k + 1] - po[k + 1]) + Math.abs(pt[k + 2] - po[k + 2]) < 30;
            if (claro || (igual && po[k] + po[k + 1] + po[k + 2] >= 30)) inalterados++;
          }
        }
        // sem destroy(): os três dividem o worker do PDF.js com o programa, e destruir um derruba o do programa
        return { dados, descobertos, inalterados };
      })()`);
      console.log(`${nome}: ${lista.length} sugestão(ões), pixels dos dados ${pixels.dados}, descobertos ${pixels.descobertos}, ` +
        `inalterados ${pixels.inalterados}`);
      if (!pixels.dados) falhas.push(`${nome}: o caso não tem pixels de dados (controle)`);
      const sobrou = Math.max(pixels.descobertos, pixels.inalterados);
      if (sobrou && caso.foraDaCamada) {
        console.log(`${nome}: dado fora da camada, ${sobrou} pixels à mostra até a pessoa tarjar à mão (esperado)`);
      } else if (sobrou) falhas.push(`${nome}: ${pixels.descobertos} descobertos e ${pixels.inalterados} inalterados de ${pixels.dados} pixels dos dados`);
    } catch (e) {
      falhas.push(`${nome}: ${e.message}`);
    }
    await js(`document.querySelectorAll('#abas .aba-fechar').forEach((b) => b.click())`);
    await ate(`document.querySelectorAll('#abas .aba').length === 0`, 'fechar ' + nome).catch(() => {});
    await espera(300);
  }
  // corrida (revisão independente da gestão na rc.8, A3): Revisei marcado, Procurar e, 0,3 s depois, Salvar. O PDF não
  // pode sair no meio da procura sem as tarjas das sugestões que ainda vão chegar. 40 páginas, metade com imagem
  if (!process.env.PROVA_SO_CASOS) {
    try {
      const b64 = await js(`(() => {
        const c = document.createElement('canvas'); c.width = 600; c.height = 120; const g = c.getContext('2d');
        g.fillStyle = '#fafafa'; g.fillRect(0, 0, 600, 120); g.fillStyle = '#141414'; g.font = '40px monospace'; g.fillText('SIGILOCODIGO', 20, 70);
        const img = c.toDataURL('image/png');
        const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
        for (let i = 0; i < 40; i++) {
          if (i) d.addPage('a4', 'p');
          d.setFontSize(14); d.text('Página ' + (i + 1) + ': código SIGILOCODIGO no texto.', 60, 100);
          if (i % 2) d.addImage(img, 'PNG', 60, 140, 300, 60);
        }
        const u = new Uint8Array(d.output('arraybuffer')); let s = ''; for (const x of u) s += String.fromCharCode(x); return btoa(s);
      })()`);
      await nav.enviarArquivo(Buffer.from(b64, 'base64'), 'corrida.pdf');
      await ate(`document.getElementById('infoPaginas').textContent === '40' && document.getElementById('tela').dataset.pagina === '1'`, 'abrir a corrida', 60000);
      for (let i = 0; i < 40; i++) {
        await js(`document.querySelectorAll('.mini-pag')[${i}].click()`);
        await ate(`document.getElementById('tela').dataset.pagina === '${i + 1}'`, 'ver a página');
      }
      await js(`(() => { const r = document.getElementById('revisei'); if (!r.checked) r.click(); })()`);
      await js(`(() => { const t = document.getElementById('termos'); t.value = 'SIGILOCODIGO'; t.dispatchEvent(new Event('input')); })()`);
      nav.responder(true, true, true, true);
      await clicar('btProcurar');
      await espera(300);
      const salvarNoMeio = await js(`document.getElementById('btSalvar').disabled`);
      await js(`document.getElementById('btSalvar').click()`);
      let saiu = false;
      try { await nav.esperarDownload('corrida-tarjado.pdf', 5000); saiu = true; } catch { /* não saiu: certo */ }
      await ate(`!document.getElementById('btProcurar').disabled && /pendente/.test(document.getElementById('resumoAchados').textContent)`, 'fim da procura', 600000);
      if (!saiu) { try { await nav.esperarDownload('corrida-tarjado.pdf', 5000); saiu = true; } catch { /* certo */ } }
      const revisei = await js(`document.getElementById('revisei').checked`);
      console.log(`corrida: Salvar desligado no meio ${salvarNoMeio}, salvou ${saiu}, Revisei marcado depois ${revisei}`);
      if (!salvarNoMeio) falhas.push('corrida: o Salvar ficou ligado durante a procura');
      if (saiu) falhas.push('corrida: o PDF foi salvo no meio da procura, sem as tarjas das sugestões');
      if (revisei) falhas.push('corrida: o "Revisei" continuou marcado depois da procura com sugestões novas');
    } catch (e) {
      falhas.push('corrida: ' + e.message);
    }
  }
  if (erros.length) falhas.push('console com erro: ' + erros.join(' | '));
} catch (e) {
  falhas.push(e.message);
} finally {
  await nav.fechar();
}
if (falhas.length) {
  console.error('prova OCR FALHOU:\n  ' + falhas.join('\n  '));
  process.exit(1);
}
console.log(`prova OCR: tudo certo (${nomes.length} casos; 0 pixel dos dados à mostra fora dos casos de dado fora da camada)`);
process.exit(0);
