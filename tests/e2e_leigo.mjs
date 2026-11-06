// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// O fluxo de sugestões como um professor leigo faria (retorno do professor com a rc.8 em 05/11/2026: "mandei procurar
// sugestão e aceitei, mas ele não tarjou"). Documento fictício parecido com o dele: relatório de 2 páginas com
// brasão, tabela e selo de assinatura digital (imagens), nomes, CPF, telefone e e-mail inventados. Cada caminho tem
// de terminar com a tarja desenhada ou com um aviso claro do motivo, nunca calado, e o Salvar tem de funcionar no fim:
//   A. procurar e "Aceitar marcadas" sem abrir nada;
//   B. procurar e "Aceitar todas" com sugestões "confira";
//   C. abrir uma sugestão na lista e aceitar pela barra junto dela, na página;
//   D. "Descartar" e procurar de novo;
//   E. nomes da lista.
// Uso: node tests/e2e_leigo.mjs [pasta para as capturas]   (TARJA_HTML=<html> testa outro HTML, sem montar)
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, HTML, montar, abrirNavegador, espera } from './navegador.mjs';

const CAPTURAS = process.argv[2] || join(RAIZ, 'files', 'e2e-leigo');
if (!process.env.TARJA_HTML) montar();
const nav = await abrirNavegador(CAPTURAS, { largura: 1366, altura: 768 });
const { js, ate, clicar, texto, erros } = nav;
const falhas = [];
const conferir = async (rotulo, f) => { try { await f(); } catch (e) { falhas.push(`${rotulo}: ${e.message}`); } };

const fazerPdf = () => js(`(() => {
  const img = (w, h, desenhar) => { const c = document.createElement('canvas'); c.width = w; c.height = h; desenhar(c.getContext('2d')); return c.toDataURL('image/png'); };
  const brasao = img(160, 180, (g) => { g.fillStyle = '#1f4e8c'; g.beginPath(); g.moveTo(80, 5); g.lineTo(155, 40); g.lineTo(140, 150);
    g.lineTo(80, 175); g.lineTo(20, 150); g.lineTo(5, 40); g.closePath(); g.fill(); g.fillStyle = '#f2c230'; g.beginPath(); g.arc(80, 85, 35, 0, 7); g.fill(); });
  const selo = img(360, 90, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 360, 90); g.strokeStyle = '#2e7d32'; g.lineWidth = 3; g.strokeRect(2, 2, 356, 86);
    g.fillStyle = '#2e7d32'; g.font = 'bold 18px sans-serif'; g.fillText('Documento assinado digitalmente', 14, 34);
    g.font = '14px sans-serif'; g.fillText('Data: 05/11/2026 10:12 - verifique em exemplo.test', 14, 62); });
  const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  d.addImage(brasao, 'PNG', 270, 30, 55, 62);
  d.setFontSize(13); d.text('INSTITUTO FICTÍCIO DE TESTES - RELATÓRIO DE TURMA', 120, 115);
  d.setFontSize(11);
  d.text('Responsável: Fulano de Teste', 60, 150);
  d.text('CPF: 831.975.872-60   E-mail: fulano.teste@exemplo.test', 60, 170);
  // tabela: linhas finas e compridas (não contam como desenho), mas o brasão e o selo são imagens
  const x0 = 60, y0 = 195, larg = [180, 120, 175], alt = 22;
  const linhas = [['Aluno', 'Matrícula', 'Telefone'], ['Beltrana Exemplo', '2026100001', '(00) 91234-5678'], ['Ciclano Modelo', '2026100002', '(00) 98765-4321']];
  linhas.forEach((l, r) => { let x = x0; l.forEach((c, k) => { d.text(c, x + 6, y0 + r * alt + 15); x += larg[k]; }); });
  for (let r = 0; r <= linhas.length; r++) d.line(x0, y0 + r * alt, x0 + 475, y0 + r * alt);
  let xs = x0; for (let k = 0; k <= larg.length; k++) { d.line(xs, y0, xs, y0 + linhas.length * alt); xs += larg[k] || 0; }
  d.addImage(selo, 'PNG', 60, 700, 240, 60);
  d.addPage('a4', 'p');
  d.setFontSize(11);
  d.text('Observações: contato da coordenação (00) 3333-4444.', 60, 100);
  d.text('Atendimento feito por Fulano de Teste.', 60, 125);
  const u = new Uint8Array(d.output('arraybuffer')); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s);
})()`);

const tarjas = () => js(`[...document.querySelectorAll('.mini-pag .selo')].reduce((n, s) => n + Number(s.textContent), 0)`);
const pendentes = async () => Number(((await texto('resumoAchados')).match(/^(\d+) pendente/) || [0, 0])[1]);
const termos = (t) => js(`(() => { const e = document.getElementById('termos'); e.value = ${JSON.stringify(t)}; e.dispatchEvent(new Event('input')); })()`);

let numero = 0;
async function abrir(b64) {
  numero++;
  await nav.enviarArquivo(Buffer.from(b64, 'base64'), `relatorio-${numero}.pdf`);
  await ate(`document.getElementById('infoPaginas').textContent === '2' && document.getElementById('tela').dataset.pagina === '1'`, 'abrir');
}
async function procurar() {
  // o botão grande fica à vista no topo do painel, sem rolar (1366x768)
  const r = await js(`(() => { const b = document.getElementById('btProcurar').getBoundingClientRect(); return [b.top, b.bottom, innerHeight]; })()`);
  assert.ok(r[0] >= 0 && r[1] <= r[2], `o botão de procurar não está à vista: ${r}`);
  await clicar('btProcurar');
  await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procurar', 60000);
}
// aceita pela barra junto da sugestão aberta até não sobrar nenhuma (é o que o aviso manda fazer)
async function aceitarPelaBarra() {
  for (let i = 0; i < 20 && (await pendentes()) > 0; i++) {
    if (await js(`document.getElementById('acoesSugestao').hidden`)) {
      await js(`document.querySelector('#listaSugestoes .sugestao button').click()`);
      await ate(`!document.getElementById('acoesSugestao').hidden`, 'barra da sugestão');
    }
    const antes = await pendentes();
    await clicar('btAceitarEsta');
    await ate(`(document.getElementById('resumoAchados').textContent.match(/^(\\d+) pendente/) || [0, 0])[1] < ${antes} || /Nenhuma/.test(document.getElementById('resumoAchados').textContent)`, 'aceitar pela barra');
  }
  assert.equal(await pendentes(), 0, 'sobrou sugestão');
}
async function salvar(nome) {
  for (let i = 0; i < 2; i++) {
    await js(`document.querySelectorAll('.mini-pag')[${i}].click()`);
    await ate(`document.getElementById('tela').dataset.pagina === '${i + 1}'`, 'ver a página');
  }
  await js(`(() => { const r = document.getElementById('revisei'); if (!r.checked) r.click(); })()`);
  assert.equal(await js(`document.getElementById('revisei').checked`), true, 'o "Revisei" não liberou');
  nav.responder(true);
  await clicar('btSalvar');
  const pdf = await nav.esperarDownload(`${nome}-tarjado.pdf`, 60000);
  await ate(`!document.body.classList.contains('ocupado')`, 'fim do salvar');
  assert.ok(pdf.length > 1000, 'PDF salvo vazio');
}
async function fecharTudo() {
  await js(`document.querySelectorAll('#abas .aba-fechar').forEach((b) => b.click())`);
  await ate(`document.querySelectorAll('#abas .aba').length === 0`, 'fechar').catch(() => {});
  await espera(300);
}

try {
  await nav.abrirPrograma(process.env.TARJA_HTML || HTML);
  const b64 = await fazerPdf();

  await conferir('A. Aceitar marcadas sem abrir', async () => {
    await abrir(b64);
    await procurar();
    await nav.captura('A1-depois-da-procura.png');
    // a lista e os botões de aceitar ficam à vista sem rolar
    const vis = await js(`(() => { const a = document.getElementById('listaSugestoes').getBoundingClientRect(); const b = document.getElementById('btAceitarTodas').getBoundingClientRect();
      return [a.top >= 0 && a.top < innerHeight, b.bottom <= innerHeight]; })()`);
    assert.deepEqual(vis, [true, true], 'a lista ou os botões de aceitar ficaram fora da tela');
    const antes = await tarjas();
    await clicar('btAceitarMarcadas');
    await espera(400);
    const aviso = await texto('aviso');
    const depois = await tarjas();
    // ou tarjou, ou disse por que não, e abriu a primeira "confira"
    assert.ok(depois > antes || /confira/.test(aviso), `nem tarjou nem avisou: "${aviso}"`);
    if ((await pendentes()) > 0) {
      assert.match(aviso, /só são tarjadas depois que você olha cada uma/, 'o aviso não diz por que não tarjou');
      await ate(`!document.getElementById('acoesSugestao').hidden`, 'a primeira "confira" aberta');
      await nav.captura('A2-aviso-e-confira-aberta.png');
      await aceitarPelaBarra();
    }
    assert.ok((await tarjas()) > antes, 'nenhuma tarja no fim');
    await salvar('relatorio-1');
  });
  await fecharTudo();

  await conferir('B. Aceitar todas com confira', async () => {
    await abrir(b64);
    await procurar();
    const antes = await tarjas();
    await clicar('btAceitarTodas');
    await espera(400);
    const aviso = await texto('aviso');
    assert.ok((await tarjas()) > antes || /confira/.test(aviso), `nem tarjou nem avisou: "${aviso}"`);
    // de novo, sem abrir: não aceita a que abriu sozinha, e avisa outra vez
    if ((await pendentes()) > 0) {
      const p = await pendentes();
      await clicar('btAceitarTodas');
      await espera(300);
      assert.equal(await pendentes(), p, 'o Aceitar todas de novo aceitou sem olhar');
      assert.match(await texto('aviso'), /Falta/, 'o segundo Aceitar todas não avisou');
      await aceitarPelaBarra();
    }
    await salvar('relatorio-2');
  });
  await fecharTudo();

  await conferir('C. pela barra na página', async () => {
    await abrir(b64);
    await procurar();
    const antes = await tarjas();
    const n = await pendentes();
    await js(`document.querySelector('#listaSugestoes .sugestao button').click()`);
    await ate(`!document.getElementById('acoesSugestao').hidden`, 'barra da sugestão');
    await clicar('btAceitarEsta');
    await ate(`(document.getElementById('resumoAchados').textContent.match(/^(\\d+) pendente/) || [0, ${n}])[1] < ${n} || /Nenhuma/.test(document.getElementById('resumoAchados').textContent)`, 'aceitar');
    assert.ok((await tarjas()) > antes, 'o Aceitar da barra não tarjou');
    await aceitarPelaBarra();
    await salvar('relatorio-3');
  });
  await fecharTudo();

  await conferir('D. Descartar e procurar de novo', async () => {
    await abrir(b64);
    await procurar();
    const n = await pendentes();
    nav.responder(true);   // há "confira" não aberta: Descartar pergunta antes
    await clicar('btDescartar');
    await ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'descartar');
    assert.equal(await tarjas(), 0, 'o Descartar tarjou alguma coisa');
    await procurar();
    assert.equal(await pendentes(), n, 'procurar de novo não trouxe as mesmas sugestões');
    await aceitarPelaBarra();
    await salvar('relatorio-4');
  });
  await fecharTudo();

  await conferir('E. nomes da lista', async () => {
    await termos('Fulano de Teste\nBeltrana Exemplo');
    assert.match(await texto('resumoOpcoes'), /2 nomes na lista/, 'o resumo das opções não conta os nomes');
    await abrir(b64);
    await procurar();
    const lista = await js(`[...document.querySelectorAll('#listaSugestoes .sugestao')].map((l) => l.textContent)`);
    assert.equal(lista.filter((l) => /Termo da lista/.test(l)).length, 3, 'os nomes da lista (2 na p. 1, 1 na p. 2): ' + lista.join(' / '));
    await aceitarPelaBarra();
    await salvar('relatorio-5');
    await termos('');
  });
  await fecharTudo();

  await conferir('F. só o botão principal "Conferir e aceitar"', async () => {
    await abrir(b64);
    await procurar();
    const vis = await js(`(() => { const a = document.getElementById('btConferir').getBoundingClientRect(); const b = document.getElementById('listaSugestoes').getBoundingClientRect();
      return [a.top >= 0 && a.bottom <= innerHeight, b.top >= 0 && b.top < innerHeight]; })()`);
    assert.deepEqual(vis, [true, true], 'o botão principal ou a lista fora da tela');
    const n = await pendentes();
    assert.equal(await texto('btConferir'), `Conferir e aceitar (${n})`);
    assert.match(await texto('avisoLista'), /página 1 tem imagem ou desenho/, 'o aviso da página com desenho, uma vez, acima da lista');
    await nav.captura('F1-botao-principal.png');
    await clicar('btConferir');
    await ate(`!document.getElementById('acoesSugestao').hidden`, 'a primeira aberta pelo botão principal');
    assert.match(await texto('acoesTexto'), /confira/, 'a nota aparece junto da sugestão aberta');
    await nav.captura('F2-primeira-aberta.png');
    // repetir o clique não aceita sem olhar
    await clicar('btConferir');
    await espera(300);
    assert.equal(await pendentes(), n, 'o botão principal aceitou sem a pessoa olhar');
    // Aceitar junto de cada uma até não sobrar "confira"; depois o botão vira "Aceitar todas"
    for (let i = 0; i < 10 && /^Conferir/.test(await texto('btConferir')); i++) {
      if (await js(`document.getElementById('acoesSugestao').hidden`)) await clicar('btConferir');
      await ate(`!document.getElementById('acoesSugestao').hidden`, 'sugestão aberta');
      const antes = await pendentes();
      await clicar('btAceitarEsta');
      await ate(`(document.getElementById('resumoAchados').textContent.match(/^(\\d+) pendente/) || [0, 0])[1] < ${antes} || /Nenhuma/.test(document.getElementById('resumoAchados').textContent)`, 'aceitar');
    }
    if ((await pendentes()) > 0) {
      assert.match(await texto('btConferir'), /^Aceitar todas \(\d+\)$/, 'sem "confira", o botão vira Aceitar todas');
      await clicar('btConferir');
      await ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'aceitar todas pelo botão principal');
    }
    await salvar('relatorio-6');
  });
  await fecharTudo();

  await conferir('console', () => assert.deepEqual(erros, [], 'console com erro'));
} catch (e) {
  falhas.push(e.message);
} finally {
  await nav.fechar();
}
if (falhas.length) {
  console.error('leigo FALHOU:\n  ' + falhas.join('\n  '));
  process.exit(1);
}
console.log('leigo: tudo certo (Aceitar marcadas e Aceitar todas com "confira" avisam e abrem a primeira, barra na página, Descartar e procurar de novo, nomes da lista, Salvar em cada caminho)');
process.exit(0);
