// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Teste de ponta a ponta: abre dist/Tarja Livre.html direto do disco (file://) no Microsoft Edge sem janela, pelo
// protocolo de depuração, gera um PDF de exemplo com dados fictícios, procura, tarja, confere e salva, e depois lê
// o PDF salvo para provar que o texto coberto sumiu. Uso: node tests/e2e.mjs [pasta para as capturas de tela]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, espera, montar, abrirNavegador } from './navegador.mjs';

const CAPTURAS = process.argv[2] || join(RAIZ, 'files', 'e2e');
montar();
const nav = await abrirNavegador(CAPTURAS);
const { cdp, js, ate, clicar, texto, tecla, captura, arrastar, erros, baixados } = nav;

let ok = false;
try {
  await nav.abrirPrograma();
  await captura('1-vazio.png');

  // Sobre: bandeira embutida (SVG dentro da página), desenhada e sem buscar nada fora
  await clicar('btSobre');
  const bandeira = await js(`(() => { const s = document.querySelector('#sobre svg.bandeira-br'); if (!s) return null;
    const r = s.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), s.getAttribute('aria-label')]; })()`);
  assert.deepEqual(bandeira, [20, 14, 'Brasil'], 'bandeira no Sobre');
  const versaoSobre = await js(`document.getElementById('versaoInstalada').textContent`);
  assert.match(versaoSobre, /^\d+\.\d+\.\d+$/, 'versão instalada ao lado do botão de versão nova');
  await captura('0-sobre.png');
  await js(`document.getElementById('sobre').close()`);

  // lista de termos: importar .txt, guardar só quando pedido, e apagar ao desmarcar
  await js(`(() => { const dt = new DataTransfer(); dt.items.add(new File(['Fulano de Teste\\nRua das Flores\\nfulano de teste\\n'], 'nomes.txt', { type: 'text/plain' }));
    const e = document.getElementById('entradaTermos'); e.files = dt.files; e.dispatchEvent(new Event('change')); })()`);
  await ate(`document.getElementById('infoTermos').textContent === '2 termo(s) na lista.'`, 'importar a lista de termos');
  assert.equal(await js(`localStorage.getItem('tarja-livre.termos')`), null, 'lista não gravada sem pedir');
  // computador dividido: guardar pergunta antes; Cancelar não guarda
  nav.responder(false);
  await clicar('termoGuardar');
  assert.equal(await js(`document.getElementById('termoGuardar').checked`), false, 'Cancelar deixa desmarcado');
  assert.equal(await js(`localStorage.getItem('tarja-livre.termos')`), null, 'Cancelar não guarda a lista');
  assert.match(nav.perguntas.at(-1), /mesmo usuário do Windows/, 'a pergunta avisa do computador dividido');
  nav.responder(true);
  await clicar('termoGuardar');
  assert.match(await js(`localStorage.getItem('tarja-livre.termos') || ''`), /Rua das Flores/, 'lista guardada quando pedido');
  await clicar('termoGuardar');
  assert.equal(await js(`localStorage.getItem('tarja-livre.termos')`), null, 'desmarcar apaga a lista guardada');
  await clicar('btLimparTermos');
  assert.equal(await texto('infoTermos'), 'Nenhum termo.');

  // PDF de exemplo: página A4 com dados fictícios, página carta deitada, página só com desenho (sem texto)
  const b64 = await js(`(() => {
    const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    d.setFontSize(13);
    d.text('Declaração de exemplo', 60, 80);
    d.text('Nome: Fulano de Teste', 60, 120);
    d.text('CPF: 831.975.872-60', 60, 145);
    d.text('E-mail: fulano.teste@exemplo.test', 60, 170);
    d.addPage('letter', 'l');
    d.text('Telefone: (00) 91234-5678', 60, 100);
    d.text('Empresa CNPJ 19.808.456/0001-00', 60, 130);
    d.addPage('a4', 'p');
    d.setFillColor(200, 220, 255);
    d.rect(100, 100, 300, 200, 'F');
    const u = new Uint8Array(d.output('arraybuffer'));
    let s = ''; for (const c of u) s += String.fromCharCode(c);
    return btoa(s);
  })()`);
  const original = Buffer.from(b64, 'base64');
  await js(`(() => {
    const s = atob('${b64}'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    const dt = new DataTransfer(); dt.items.add(new File([u], 'exemplo.pdf', { type: 'application/pdf' }));
    const e = document.getElementById('entrada'); e.files = dt.files; e.dispatchEvent(new Event('change'));
  })()`);
  await ate(`document.getElementById('infoPaginas').textContent === '3'`, 'abrir o PDF');
  const hash = createHash('sha256').update(original).digest('hex');
  assert.equal(await js(`document.getElementById('infoHash').textContent`), hash, 'SHA-256 do original');
  assert.equal(await js(`document.getElementById('btSalvar').disabled`), true, 'Salvar travado logo ao abrir');
  assert.equal(await js(`document.getElementById('revisei').disabled`), true, 'Revisei travado antes de ver tudo');

  // procura: CPF e e-mail na página 1, telefone e CNPJ na 2, nada na 3 (sem texto)
  await clicar('btProcurar');
  await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procura terminar');
  const resumo = await js(`document.getElementById('resumoAchados').textContent`);
  assert.match(resumo, /^4 pendente/, 'quatro sugestões: ' + resumo);
  for (const t of ['CPF 1', 'CNPJ 1', 'E-mail 1', 'Telefone 1']) assert.ok(resumo.includes(t), t + ' em ' + resumo);
  await captura('2-sugestoes.png');

  // revisão em lista: as 4 sugestões aparecem com o trecho; desmarcar o telefone e aceitar só as marcadas
  const lista = await js(`[...document.querySelectorAll('#listaSugestoes .sugestao')].map((l) => l.textContent)`);
  assert.equal(lista.length, 4, 'quatro linhas na lista: ' + lista.join(' / '));
  assert.ok(lista.some((l) => l.includes('p. 2') && l.includes('Telefone') && l.includes('(00) 91234-5678')), 'linha do telefone');
  await js(`[...document.querySelectorAll('#listaSugestoes .sugestao')].find((l) => l.textContent.includes('Telefone')).querySelector('input').click()`);
  await clicar('btAceitarMarcadas');
  await ate(`document.getElementById('resumoAchados').textContent === '1 pendente(s): Telefone 1'`, 'aceitar marcadas');
  // clicar na linha leva à página da sugestão
  await js(`document.querySelector('#listaSugestoes .sugestao button').click()`);
  await ate(`document.getElementById('tela').dataset.pagina === '2'`, 'ir à página da sugestão');
  await js(`document.querySelectorAll('.mini-pag')[0].click()`);
  await ate(`document.getElementById('tela').dataset.pagina === '1'`, 'voltar à página 1');

  await clicar('btAceitarTodas');
  await ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'aceitar todas');
  // uma tarja à mão sobre o nome, com o mouse
  await arrastar(0.09, 0.125, 0.45, 0.15);
  await ate(`document.querySelector('.mini-pag .selo')?.textContent === '3'`, 'tarja à mão contar na miniatura');

  // carimbo antes da conferência; depois, passar pelas páginas libera o "Revisei"
  await clicar('carAtivo');
  // o carimbo aparece na página grande na hora (e não só nas miniaturas)
  const azuis = await js(`(() => { const c = document.getElementById('tela'); const d = c.getContext('2d')
    .getImageData(0, Math.round(c.height * 0.84), Math.round(c.width * 0.5), Math.round(c.height * 0.15)).data;
    let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k + 2] > d[k] + 60) n++; return n; })()`);
  assert.ok(azuis > 50, 'carimbo desenhado na página grande ao ligar (pixels azuis: ' + azuis + ')');
  await tecla('ArrowRight', 'ArrowRight', 39);
  await ate(`document.getElementById('infoVistas').textContent === '2 de 3'`, 'ver a página 2');
  await tecla('ArrowRight', 'ArrowRight', 39);
  await ate(`document.getElementById('infoVistas').textContent === '3 de 3'`, 'ver as 3 páginas');
  assert.equal(await js(`document.getElementById('revisei').disabled`), false, 'Revisei liberado');
  await clicar('revisei');
  assert.equal(await js(`document.getElementById('btSalvar').disabled`), false, 'Salvar liberado');

  // mudança depois da conferência desmarca o "Revisei"
  await tecla('ArrowLeft', 'ArrowLeft', 37);
  await tecla('ArrowLeft', 'ArrowLeft', 37);
  await ate(`document.getElementById('tela').dataset.pagina === '1'`, 'voltar à página 1');
  await arrastar(0.6, 0.5, 0.7, 0.55);
  assert.equal(await js(`document.getElementById('revisei').checked`), false, 'mudança desmarca o Revisei');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 });
  await ate(`document.querySelector('.mini-pag .selo')?.textContent === '3'`, 'Ctrl+Z desfazer a tarja extra');
  await captura('3-tarjado.png');

  // ferramenta Texto: selecionar só a palavra "exemplo" do título (posição exata pela fonte do PDF de exemplo)
  const [sx0, sx1, sy] = await js(`(() => { const r = new jspdf.jsPDF({ unit: 'pt' }); r.setFontSize(13);
    const x0 = 60 + r.getTextWidth('Declaração de '), x1 = x0 + r.getTextWidth('exemplo');
    return [(x0 + 1.5) / 595.28, (x1 - 1.5) / 595.28, (80 - 13 * 0.35) / 841.89]; })()`);
  await js(`document.querySelector('[data-ferramenta="texto"]').click()`);
  await arrastar(sx0, sy, sx1, sy);
  await ate(`document.querySelector('.mini-pag .selo')?.textContent === '4'`, 'tarja pela seleção de texto');
  await js(`document.querySelector('[data-ferramenta="tarja"]').click()`);

  // página inteira com um clique, na página 3
  await js(`document.querySelectorAll('.mini-pag')[2].click()`);
  await ate(`document.getElementById('tela').dataset.pagina === '3'`, 'ir à página 3');
  await clicar('btPaginaInteira');
  await ate(`document.querySelectorAll('.mini-pag')[2].querySelector('.selo')?.textContent === '1'`, 'página 3 coberta');
  await js(`document.querySelectorAll('.mini-pag')[0].click()`);
  await ate(`document.getElementById('tela').dataset.pagina === '1'`, 'voltar à página 1');

  // zoom 200%: a tarja continua no mesmo lugar do PDF (guardada em pontos)
  await clicar('btMais'); await clicar('btMais'); await clicar('btMais');
  await ate(`document.getElementById('zoomTexto').textContent === '200%'`, 'zoom 200%');
  await captura('4-zoom-200.png');

  await clicar('revisei');
  // enquanto salva, nem o teclado mexe na tela (o carimbo e o "Revisei" ficam iguais em todas as páginas)
  assert.equal(await js(`document.getElementById('btSalvar').click(), document.querySelector('.corpo').inert && document.querySelector('.topo').inert`),
    true, 'interface travada durante o salvamento');
  let arquivo;
  for (let t = 0; t < 200 && !arquivo; t++) {
    await espera(150);
    arquivo = nav.prontos().find((n) => n.endsWith('.pdf'));
  }
  assert.ok(arquivo, 'PDF salvo baixado');
  assert.equal(arquivo, 'exemplo-tarjado.pdf');
  await espera(300);
  const saida = readFileSync(join(baixados, arquivo));
  const hashSaida = createHash('sha256').update(saida).digest('hex');
  await ate(`!document.getElementById('infoHashSaida').hidden`, 'hash do PDF salvo aparecer');
  await ate(`!document.querySelector('.corpo').inert && !document.querySelector('.topo').inert`, 'interface destravada');
  assert.equal(await js(`document.getElementById('infoHashSaida').textContent`), hashSaida, 'SHA-256 do PDF salvo');
  await captura('5-salvo.png');

  // lê o PDF salvo com o próprio PDF.js da página
  const exame = await js(`(async () => {
    const s = atob('${saida.toString('base64')}'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    const d = await pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise;
    const paginas = [];
    for (let i = 1; i <= d.numPages; i++) {
      const p = await d.getPage(i); const v = p.getViewport({ scale: 1 });
      const t = await p.getTextContent();
      paginas.push({ w: Math.round(v.width), h: Math.round(v.height), texto: t.items.map((x) => x.str).join(' ') });
    }
    const meta = await d.getMetadata();
    // cobertura: onde cada dado estava no original (medido pela própria fonte do PDF de exemplo), o PDF salvo
    // tem que estar preto de ponta a ponta, sem nenhuma letra à mostra
    const regua = new jspdf.jsPDF({ unit: 'pt' }); regua.setFontSize(13);
    const dados = [[1, 145, 'CPF: ', '831.975.872-60'], [1, 170, 'E-mail: ', 'fulano.teste@exemplo.test'],
      [2, 100, 'Telefone: ', '(00) 91234-5678'], [2, 130, 'Empresa CNPJ ', '19.808.456/0001-00']];
    const descobertos = [];
    for (const [n, base, antes, dado] of dados) {
      const p = await d.getPage(n); const v = p.getViewport({ scale: 2 });
      const c = document.createElement('canvas'); c.width = v.width; c.height = v.height;
      const ctx = c.getContext('2d'); await p.render({ canvasContext: ctx, viewport: v, intent: 'print' }).promise;
      const x0 = 60 + regua.getTextWidth(antes), x1 = x0 + regua.getTextWidth(dado);
      for (const fy of [0.15, 0.35, 0.6]) {
        const y = Math.round((base - 13 * fy) * 2);
        const linha = ctx.getImageData(Math.round(x0 * 2) + 1, y, Math.round((x1 - x0) * 2) - 2, 1).data;
        for (let k = 0; k < linha.length; k += 4) {
          if (linha[k] + linha[k + 1] + linha[k + 2] > 180) { descobertos.push(dado + ' em x=' + (x0 + k / 8).toFixed(1)); break; }
        }
      }
    }
    // seleção de texto: "exemplo" coberto inteiro, "Declaração" ainda visível
    const r = new jspdf.jsPDF({ unit: 'pt' }); r.setFontSize(13);
    const p1 = await d.getPage(1); const v1 = p1.getViewport({ scale: 2 });
    const c1 = document.createElement('canvas'); c1.width = v1.width; c1.height = v1.height; const k1 = c1.getContext('2d');
    await p1.render({ canvasContext: k1, viewport: v1, intent: 'print' }).promise;
    const faixa = (x0, x1) => { const l = k1.getImageData(Math.round(x0 * 2), Math.round((80 - 13 * 0.35) * 2), Math.round((x1 - x0) * 2), 1).data;
      let claros = 0; for (let k = 0; k < l.length; k += 4) if (l[k] + l[k + 1] + l[k + 2] > 600) claros++; return claros; };
    const ex0 = 60 + r.getTextWidth('Declaração de ');
    const selecao = { exemploClaros: faixa(ex0 + 0.5, ex0 + r.getTextWidth('exemplo') - 0.5), declaracaoClaros: faixa(60, 60 + r.getTextWidth('Declaração')) };
    // página 3 coberta inteira: o meio dela (longe do carimbo) tem que estar preto
    const p3 = await d.getPage(3); const v3 = p3.getViewport({ scale: 1 });
    const c3 = document.createElement('canvas'); c3.width = v3.width; c3.height = v3.height;
    await p3.render({ canvasContext: c3.getContext('2d'), viewport: v3, intent: 'print' }).promise;
    const meio = c3.getContext('2d').getImageData(Math.round(v3.width / 2), Math.round(v3.height * 0.3), 1, 1).data;
    const pagina3Preta = meio[0] + meio[1] + meio[2] < 60;
    const vistas = [];
    for (const n of [1, 4]) {
      const p = await d.getPage(n); const v = p.getViewport({ scale: 1.2 });
      const c = document.createElement('canvas'); c.width = v.width; c.height = v.height;
      await p.render({ canvasContext: c.getContext('2d'), viewport: v, intent: 'print' }).promise;
      vistas.push(c.toDataURL('image/png').split(',')[1]);
    }
    return { paginas, titulo: meta.info.Title, autor: meta.info.Author || '', descobertos, vistas, pagina3Preta, selecao };
  })()`);
  writeFileSync(join(CAPTURAS, '6-salvo-pagina-1.png'), Buffer.from(exame.vistas[0], 'base64'));
  writeFileSync(join(CAPTURAS, '7-salvo-folha.png'), Buffer.from(exame.vistas[1], 'base64'));
  assert.deepEqual(exame.descobertos, [], 'dados inteiramente cobertos no PDF salvo');
  assert.equal(exame.paginas.length, 4, 'três páginas e a folha de conferência');
  assert.deepEqual(exame.paginas.slice(0, 3).map((p) => [p.w, p.h]), [[595, 842], [792, 612], [595, 842]], 'tamanho original das páginas');
  for (const p of exame.paginas.slice(0, 3)) assert.equal(p.texto.trim(), '', 'página refeita como imagem, sem texto');
  const folha = exame.paginas[3].texto.replace(/\s+/g, ' ');
  assert.ok(folha.includes('Folha de conferência'), 'folha presente');
  assert.ok(exame.pagina3Preta, 'página inteira coberta no PDF salvo');
  assert.equal(exame.selecao.exemploClaros, 0, '"exemplo" coberto inteiro pela seleção de texto');
  assert.ok(exame.selecao.declaracaoClaros > 0, '"Declaração" continua visível (a seleção não passou do ponto)');
  assert.match(folha, /Página 3: 1 tarja/, 'folha conta a tarja da página inteira');
  assert.match(folha, /leu de novo as 3 página\(s\) refeitas e encontrou 0 caracteres/, 'folha registra a conferência automática');
  assert.match(await texto('infoConferido'), /0 caracteres de texto nas 3 página/, 'painel mostra a conferência');
  assert.ok(folha.includes(hash), 'folha com o SHA-256 do original');
  for (const segredo of ['831.975.872-60', 'fulano', 'Fulano', '91234', '19.808.456']) {
    assert.ok(!folha.includes(segredo), 'folha sem dado tarjado: ' + segredo);
    assert.ok(!saida.includes(Buffer.from(segredo, 'latin1')), 'arquivo sem o texto: ' + segredo);
  }
  assert.equal(exame.titulo, 'Documento tarjado');
  assert.equal(exame.autor, '');

  const csp = await js('window.__csp');
  assert.deepEqual(csp, [], 'nenhuma violação da política de segurança');
  assert.deepEqual(erros, [], 'console sem erro nem aviso');
  ok = true;
  console.log('e2e: tudo certo (abrir, procurar, aceitar, tarjar à mão, carimbo, conferência, desfazer, zoom, salvar, folha)');
  console.log('capturas em ' + CAPTURAS);
} catch (e) {
  console.error('e2e FALHOU:', e.message);
  if (erros.length) console.error('console do navegador:\n  ' + erros.join('\n  '));
} finally {
  await nav.fechar();
  process.exit(ok ? 0 : 1);
}
