// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Uso da interface, com PDFs sintéticos feitos na hora (só dados fictícios, ver tests/fixtures/LEIA-ME.md). Não repete o
// que outros e2e já provam (cobertura pixel a pixel, recuperação depois de queda, teclado, várias abas); aqui:
//   A. abrir um PDF de 1 página e um de 300, com tempo medido e a página respondendo durante a abertura;
//   B. marcar, desfazer e refazer pelos botões;
//   C. procurar nas 300 páginas e tarjar todas as ocorrências;
//   D. salvar as 300 páginas e conferir o arquivo com outro leitor (PyMuPDF);
//   E. PDF com senha: mensagem clara, programa usável depois;
//   F. PDFs corrompidos de vários jeitos: nada trava e um PDF bom abre logo depois;
//   G. nome de arquivo acentuado, na tela e no PDF salvo;
//   H. fechar no meio (da abertura, da procura e das miniaturas) e reabrir;
//   I. telas de 1366×768 e 1920×1080: botões cabem e os acentos estão certos.
// Os tempos e observações vão para <pasta>/resultado-<navegador>.json. Uso: node tests/e2e_uso.mjs [pasta]
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, PYTHON, montar, abrirNavegador, espera, emJs } from './navegador.mjs';

const SAIDA = process.argv[2] || join(RAIZ, 'files', 'e2e-uso');
mkdirSync(SAIDA, { recursive: true });
const CPF = '831.975.872-60';
const EMAIL = 'fulano.teste@exemplo.test';
const NOME = 'Fulano de Teste';
const ACENTUADO = 'Relatório de Ação da Conceição São João.pdf';
const r = { tempos: {}, observacoes: [] };
const agora = () => Date.now();
const anotar = (t) => { r.observacoes.push(t); console.log('  obs: ' + t); };

montar();
let n = await abrirNavegador(SAIDA, { largura: 1366, altura: 768 });
r.navegador = n.tipo;
const { js, ate, clicar } = { js: (e) => n.js(e), ate: (...a) => n.ate(...a), clicar: (id) => n.clicar(id) };
const aviso = () => js(`document.getElementById('aviso').textContent`);
const abas = () => js(`[...document.querySelectorAll('#abas .aba .txt')].map((a) => a.textContent)`);
const selos = () => js(`[...document.querySelectorAll('.mini-pag')].reduce((s, b) => s + Number(b.querySelector('.selo')?.textContent || 0), 0)`);
// erros do console que cada passo espera (o PDF.js reclama dos arquivos ruins); qualquer outro reprova no fim
const ESPERADOS = /PDF\.js recusou|página com defeito|não parece|falha ao ler/;
const errosInesperados = () => n.erros.filter((e) => !ESPERADOS.test(e));
const fecharTudo = async () => {
  for (let k = 0; k < 10 && (await js(`document.querySelectorAll('#abas .aba').length`)) > 0; k++) {
    n.responder(true);   // fechar uma aba com tarjas pergunta antes; sem tarjas, fecha direto
    await clicar('btFechar');
    await espera(300);
    n.esquecerRespostas();
  }
};

try {
  await n.abrirPrograma();
  // PDFs sintéticos feitos pelo jsPDF do próprio programa, na página
  const gerar = (paginas, extra = '') => js(`(() => { const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' ${extra} }); d.setFontSize(14);
    for (let p = 0; p < ${paginas}; p++) { if (p) d.addPage();
      ${emJs([`Declaração de exemplo, página `, `Nome: ${NOME}`, `CPF: ${CPF}`, `E-mail: ${EMAIL}`])}.forEach((t, i) => d.text(i ? t : t + (p + 1), 60, 100 + 30 * i)); }
    const u = new Uint8Array(d.output('arraybuffer')); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s); })()`);
  const pdf1 = Buffer.from(await gerar(1), 'base64');
  const pdf300 = Buffer.from(await gerar(300), 'base64');
  r.tamanhos = { pdf1: pdf1.length, pdf300: pdf300.length };

  // ---- A. abrir 1 e 300 páginas, com tempo ----
  let t0 = agora();
  await n.enviarArquivo(pdf1, 'uma.pdf');
  await ate(`document.getElementById('infoPaginas').textContent === '1' && document.getElementById('tela').dataset.pagina === '1'`, 'A: abrir 1 página');
  r.tempos.abrir1 = agora() - t0;
  await fecharTudo();
  // enquanto as 300 abrem, mede quanto a página demora para responder (se travar, o usuário não consegue nem clicar)
  t0 = agora();
  await n.enviarArquivo(pdf300, 'trezentas.pdf');
  let pior = 0;
  for (;;) {
    const a = agora();
    const pronto = await js(`document.getElementById('infoPaginas').textContent === '300' && document.getElementById('tela').dataset.pagina === '1'`);
    pior = Math.max(pior, agora() - a);
    if (pronto) break;
    assert.ok(agora() - t0 < 120000, 'A: 300 páginas abrem em menos de 2 min');
    await espera(100);
  }
  r.tempos.abrir300 = agora() - t0;
  r.tempos.piorRespostaAbrindo300 = pior;
  t0 = agora();
  await ate(`[...document.querySelectorAll('.mini-pag canvas')].length === 300`, 'A: 300 miniaturas criadas', 30000);
  // a última miniatura desenhada: o canvas tem algum pixel escuro (texto)
  await ate(`(() => { const c = document.querySelectorAll('.mini-pag canvas')[299]; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] < 128) return true; return false; })()`, 'A: miniaturas desenhadas até a 300', 180000);
  r.tempos.miniaturas300 = agora() - t0;

  // ---- B. marcar, desfazer e refazer pelos botões (na página 1 das 300) ----
  assert.equal(await js(`document.getElementById('btDesfazer').disabled`), true, 'B: nada a desfazer no começo');
  await n.arrastar(0.1, 0.5, 0.3, 0.55);
  await n.arrastar(0.1, 0.6, 0.3, 0.65);
  await n.arrastar(0.1, 0.7, 0.3, 0.75);
  await ate(`document.querySelectorAll('.mini-pag')[0].querySelector('.selo')?.textContent === '3'`, 'B: 3 tarjas');
  await clicar('btDesfazer'); await clicar('btDesfazer');
  await ate(`document.querySelectorAll('.mini-pag')[0].querySelector('.selo')?.textContent === '1'`, 'B: desfazer 2');
  await clicar('btRefazer');
  await ate(`document.querySelectorAll('.mini-pag')[0].querySelector('.selo')?.textContent === '2'`, 'B: refazer 1');
  assert.equal(await js(`document.getElementById('btRefazer').disabled`), false, 'B: ainda há o que refazer');
  await n.arrastar(0.5, 0.8, 0.7, 0.85);   // tarja nova depois de desfazer: o que estava para refazer se perde
  await ate(`document.querySelectorAll('.mini-pag')[0].querySelector('.selo')?.textContent === '3'`, 'B: tarja nova');
  assert.equal(await js(`document.getElementById('btRefazer').disabled`), true, 'B: tarja nova esvazia o refazer');
  for (let k = 0; k < 3; k++) await clicar('btDesfazer');
  await ate(`!document.querySelectorAll('.mini-pag')[0].querySelector('.selo')`, 'B: desfazer tudo');
  assert.equal(await js(`document.getElementById('btDesfazer').disabled`), true, 'B: nada mais a desfazer');

  // ---- C. procurar nas 300 páginas e tarjar todas as ocorrências ----
  await js(`(() => { const t = document.getElementById('termos'); t.value = ${emJs(NOME)}; t.dispatchEvent(new Event('input')); })()`);
  t0 = agora();
  await clicar('btProcurar');
  await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'C: procura nas 300', 300000);
  r.tempos.procurar300 = agora() - t0;
  const resumo = await js(`document.getElementById('resumoAchados').textContent`);
  r.resumoProcura = resumo;
  const conta = (rot) => Number((resumo.match(new RegExp(rot + ' (\\d+)')) || [])[1] || 0);
  assert.equal(conta('CPF'), 300, 'C: um CPF por página: ' + resumo);
  assert.equal(conta('E-mail'), 300, 'C: um e-mail por página: ' + resumo);
  assert.equal(conta('Termo da lista'), 300, 'C: o nome da lista em cada página: ' + resumo);
  t0 = agora();
  await clicar('btAceitarTodas');
  await ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'C: aceitar todas', 60000);
  r.tempos.aceitar900 = agora() - t0;
  assert.equal(await selos(), 900, 'C: 900 tarjas nas miniaturas (3 por página)');

  // ---- D. salvar as 300 e conferir com o PyMuPDF ----
  t0 = agora();
  for (let i = 0; i < 300; i++) {
    await js(`document.querySelectorAll('.mini-pag')[${i}].click()`);
    await ate(`document.getElementById('tela').dataset.pagina === '${i + 1}'`, 'D: ver a página ' + (i + 1));
  }
  await ate(`document.getElementById('infoVistas').textContent === '300 de 300'`, 'D: 300 vistas', 20000);
  r.tempos.passar300 = agora() - t0;
  await clicar('revisei');
  t0 = agora();
  await clicar('btSalvar');
  const salvo = await n.esperarDownload('trezentas-tarjado.pdf', 600000);
  r.tempos.salvar300 = agora() - t0;
  await ate(`!document.getElementById('infoHashSaida').hidden && !document.body.classList.contains('ocupado')`, 'D: terminar', 60000);
  assert.equal(await js(`document.getElementById('infoHashSaida').textContent`), createHash('sha256').update(salvo).digest('hex'), 'D: SHA-256 mostrado é o do arquivo');
  writeFileSync(join(SAIDA, `trezentas-tarjado-${n.tipo}.pdf`), salvo);
  r.tamanhos.salvo300 = salvo.length;
  for (const m of [CPF, EMAIL, NOME, 'Fulano', '831.975']) assert.ok(!salvo.includes(Buffer.from(m)), `D: "${m}" não pode estar no salvo`);
  const exame = JSON.parse(execFileSync(PYTHON, ['-c', `import fitz,json,sys
d=fitz.open(sys.argv[1]); ps=list(d)
print(json.dumps({"paginas": d.page_count, "texto": "".join(p.get_text() for p in ps[:300]).strip(),
  "imagens": sum(1 for p in ps[:300] if p.get_images()), "folha": "".join(p.get_text() for p in ps[300:])}))`,
  join(SAIDA, `trezentas-tarjado-${n.tipo}.pdf`)]).toString());
  r.paginasDaFolha300 = exame.paginas - 300;
  assert.ok(exame.paginas > 300, 'D: as 300 páginas e a folha');
  assert.deepEqual([exame.texto, exame.imagens], ['', 300], 'D: as 300 páginas só de imagem, sem texto (PyMuPDF)');
  assert.match(exame.folha, /^Folha de conferência/, 'D: a folha vem depois das 300');
  const porPagina = (exame.folha.match(/Página\s+\d+:\s+3\s+tarja\(s\)/g) || []).length;
  assert.equal(porPagina, 300, 'D: a folha lista as 3 tarjas de cada uma das 300 páginas');
  for (const m of [CPF, EMAIL, NOME]) assert.ok(!exame.folha.includes(m), `D: a folha não mostra "${m}"`);
  await fecharTudo();

  // ---- E. PDF com senha ----
  const comSenha = Buffer.from(await gerar(1, `, encryption: { userPassword: 'senha-de-teste', ownerPassword: 'dono', userPermissions: ['print'] }`), 'base64');
  await n.enviarArquivo(comSenha, 'com senha.pdf');
  await ate(`/protegido por senha/.test(document.getElementById('aviso').textContent)`, 'E: recusar o PDF com senha', 15000);
  r.mensagemSenha = await aviso();
  assert.equal(r.mensagemSenha, 'com senha.pdf: PDF protegido por senha, tire a senha antes de tarjar.', 'E: mensagem com o nome e o que fazer');
  assert.deepEqual(await abas(), [], 'E: nenhuma aba aberta');
  const visivelDepois = async (ms) => { await espera(ms); return js(`document.getElementById('aviso').classList.contains('visivel')`); };
  r.senhaAvisoVisivel = { aos2s: await visivelDepois(2000), aos6s: await visivelDepois(4000) };
  if (!r.senhaAvisoVisivel.aos6s) anotar('o aviso do PDF com senha some sozinho em uns 4 s, e nada mais na tela diz por que o arquivo não abriu');

  // ---- F. corrompidos: nada trava, cada um tem resposta, e um PDF bom abre logo depois ----
  const s1 = pdf1.toString('latin1');
  const CORROMPIDOS = {
    'vazio.pdf': Buffer.alloc(0),
    'cortado-no-meio.pdf': pdf1.subarray(0, Math.floor(pdf1.length / 2)),
    'so-o-cabecalho.pdf': Buffer.from('%PDF-1.7\n'),
    'cabecalho-e-lixo.pdf': Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from(Array.from({ length: 4000 }, (_, i) => (i * 7919) % 256))]),
    'sem-xref.pdf': Buffer.from(s1.replace(/xref[\s\S]*$/, ''), 'latin1'),
    'xref-errada.pdf': Buffer.from(s1.replace(/startxref\s+\d+/, 'startxref 999999'), 'latin1'),
    'conteudo-estragado.pdf': Buffer.from(s1.replace(/stream\r?\n[\s\S]*?endstream/, 'stream\nÿþ garbage BT ET Tj ( endstream'), 'latin1'),
  };
  r.corrompidos = {};
  for (const [nome, bytes] of Object.entries(CORROMPIDOS)) {
    await js(`document.getElementById('aviso').textContent = ''`);
    t0 = agora();
    await n.enviarArquivo(bytes, nome);
    await ate(`!!document.getElementById('aviso').textContent || document.querySelectorAll('#abas .aba').length > 0`, 'F: resposta para ' + nome, 20000);
    // espera um pouco: se abriu, a página tem de aparecer; se recusou, nada de aba
    await espera(800);
    const a = agora();
    await js('1');
    r.corrompidos[nome] = { resposta: agora() - t0, respostaDepois: agora() - a, aviso: await aviso(), abas: await abas(),
      paginas: await js(`document.querySelectorAll('#abas .aba').length ? document.getElementById('infoPaginas').textContent : ''`) };
    await fecharTudo();
  }
  await n.enviarArquivo(pdf1, 'uma.pdf');
  await ate(`document.getElementById('infoPaginas').textContent === '1' && document.getElementById('tela').dataset.pagina === '1'`, 'F: PDF bom depois dos ruins', 20000);
  await fecharTudo();

  // ---- G. nome acentuado (NFC, como no Windows e no Linux; e NFD, como sai de alguns Mac) ----
  r.acentos = {};
  for (const [forma, nome] of [['NFC', ACENTUADO.normalize('NFC')], ['NFD', ACENTUADO.normalize('NFD')]]) {
    await n.enviarArquivo(pdf1, nome);
    // espera o nome do arquivo novo (o número da página da tela fica do arquivo anterior até o novo aparecer)
    await ate(`document.getElementById('nomeArquivo').textContent === ${emJs(nome)} && document.getElementById('infoPaginas').textContent === '1'`,
      'G: abrir com o nome ' + forma, 20000);
    const naTela = await js(`document.getElementById('nomeArquivo').textContent`);
    const naAba = (await abas())[0];
    await n.arrastar(0.1, 0.1, 0.3, 0.15);
    await ate(`document.getElementById('infoVistas').textContent === '1 de 1'`, 'G: vista');
    await clicar('revisei');
    await clicar('btSalvar');
    const esperado = nome.replace(/\.pdf$/, '') + '-tarjado.pdf';
    // o nome salvo pode sair noutra forma Unicode (o navegador normaliza o nome do download): confere pela forma NFC
    await ate(`!document.body.classList.contains('ocupado') && !document.getElementById('infoHashSaida').hidden`, 'G: terminar', 60000);
    let salvoNome;
    for (let k = 0; k < 100 && !salvoNome; k++) {
      salvoNome = n.prontos().find((a) => a.normalize('NFC') === esperado.normalize('NFC'));
      if (!salvoNome) await espera(150);
    }
    // sem locale UTF-8 (LANG vazio ou C, comum em contêiner e CI), o Chromium troca por "download" o nome de download
    // com acento; o teste anota e segue (docs/E2E-LINUX-1.2.2.md). Com UTF-8, o nome tem de sair certo
    const utf8 = /utf-?8/i.test(process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || '');
    if (!salvoNome && !utf8 && n.prontos().includes('download')) {
      salvoNome = 'download';
      anotar(`${forma}: sem locale UTF-8, o ${n.tipo} salvou o PDF de nome acentuado como "download", sem extensão`);
    }
    assert.ok(salvoNome, `G: ${forma}: PDF salvo com o nome acentuado: ${JSON.stringify(n.prontos())}`);
    const bytes = readFileSync(join(n.baixados, salvoNome));
    rmSync(join(n.baixados, salvoNome));
    const folha = JSON.parse(execFileSync(PYTHON, ['-c', `import fitz,json,sys
d=fitz.open(stream=sys.stdin.buffer.read(), filetype="pdf"); print(json.dumps({"paginas": d.page_count}))`], { input: bytes }).toString());
    r.acentos[forma] = { naTela: naTela === nome, naAba: naAba === nome, nomeSalvo: salvoNome,
      mesmaFormaUnicode: salvoNome === esperado, paginas: folha.paginas };
    assert.equal(naTela, nome, `G: nome ${forma} igual na tela`);
    assert.equal(naAba, nome, `G: nome ${forma} igual na aba`);
    assert.equal(folha.paginas, 2, `G: ${forma}: a página e a folha`);
    await fecharTudo();
  }

  // ---- H. fechar no meio e reabrir ----
  r.fecharNoMeio = {};
  // H1. durante a abertura das 300
  // o Fechar logo depois de escolher o arquivo, antes de a página aparecer
  await n.enviarArquivo(pdf300, 'trezentas.pdf');
  r.fecharNoMeio.aindaAbrindo = await js(`document.getElementById('infoPaginas').textContent !== '300'`);
  await clicar('btFechar');
  await espera(1500);
  r.fecharNoMeio.abasDepoisDeFecharNaAbertura = await abas();
  await fecharTudo();
  t0 = agora();
  await n.enviarArquivo(pdf300, 'trezentas.pdf');
  await ate(`document.getElementById('infoPaginas').textContent === '300' && document.getElementById('tela').dataset.pagina === '1'`, 'H1: reabrir depois de fechar na abertura', 120000);
  r.fecharNoMeio.abertura = { reabriu: true, tempo: agora() - t0 };
  // H2. durante a procura
  // o X da aba 50 ms depois de pedir a procura (as 300 páginas são procuradas em menos de 1 s)
  r.fecharNoMeio.naHoraDeFechar = await js(`new Promise((ok) => { document.getElementById('btProcurar').click();
    setTimeout(() => { const estado = { procurando: !/pendente/.test(document.getElementById('resumoAchados').textContent),
      ocupado: document.body.classList.contains('ocupado') }; document.querySelectorAll('#abas .aba-fechar')[0]?.click(); ok(estado); }, 50); })`);
  await espera(1500);
  r.fecharNoMeio.abasDepoisDeFecharNaProcura = (await abas()).length;
  await ate(`!document.body.classList.contains('ocupado')`, 'H2: procura parar', 120000);
  await fecharTudo();
  await n.enviarArquivo(pdf300, 'trezentas.pdf');
  await ate(`document.getElementById('infoPaginas').textContent === '300' && document.getElementById('tela').dataset.pagina === '1'`, 'H2: reabrir', 120000);
  await clicar('btProcurar');
  await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'H2: procurar de novo', 300000);
  assert.match(await js(`document.getElementById('resumoAchados').textContent`), /CPF 300/, 'H2: a procura de novo acha tudo');
  r.fecharNoMeio.procura = { reabriu: true, achouTudo: true };
  await fecharTudo();
  // H3. durante o desenho das miniaturas, 5 vezes seguidas (o "doc is null" da 1.2.1)
  for (let k = 0; k < 5; k++) {
    await n.enviarArquivo(pdf300, 'trezentas.pdf');
    await ate(`document.getElementById('infoPaginas').textContent === '300' && document.getElementById('tela').dataset.pagina === '1'`, 'H3: abrir ' + (k + 1), 120000);
    await espera(200 * k);
    await clicar('btFechar');
    await espera(500);
  }
  r.fecharNoMeio.miniaturas = { vezes: 5, errosDoConsole: errosInesperados().filter((e) => /doc is null|miniatura/.test(e)).length };
  // (fechar o navegador no meio e reabrir com o mesmo perfil, com a oferta de recuperação, já está no e2e_andamento)
  r.erros = [...n.erros];
  await n.fechar();

  // ---- I. telas: botões cabem e os acentos estão certos ----
  r.telas = {};
  const BOTOES = ['btAbrir', 'btSobre', 'btProcurar', 'btAceitarTodas', 'revisei', 'btSalvar', 'btProxima', 'btAnterior', 'btDesfazer', 'btRefazer', 'btFechar'];
  for (const [largura, altura] of [[1366, 768], [1920, 1080]]) {
    n = await abrirNavegador(SAIDA, { largura, altura });
    await n.abrirPrograma();
    await n.cdp('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: false });
    await n.enviarArquivo(pdf1, ACENTUADO);
    await n.ate(`document.getElementById('tela').dataset.pagina === '1'`, 'I: abrir');
    await n.js(`(() => { const t = document.getElementById('termos'); t.value = ${emJs(NOME)}; t.dispatchEvent(new Event('input')); })()`);
    await n.clicar('btProcurar');
    await n.ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'I: procurar', 60000);
    const t = await n.js(`(() => {
      const ruins = [];
      for (const id of ${JSON.stringify(BOTOES)}) {
        const b = document.getElementById(id);
        b.scrollIntoView({ block: 'center', inline: 'nearest' });
        const q = b.getBoundingClientRect();
        const dentro = q.width > 0 && q.left >= 0 && q.top >= 0 && q.right <= innerWidth && q.bottom <= innerHeight;
        const no = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
        const livre = !!no && (no === b || b.contains(no) || no.contains(b) || (b.labels && [...b.labels].some((l) => l.contains(no))));
        // texto do botão cortado: o conteúdo é mais largo que o botão
        const cortado = b.tagName === 'BUTTON' && b.scrollWidth > b.clientWidth + 1;
        if (!dentro || !livre || cortado) ruins.push(id + (!dentro ? ' fora da janela' : !livre ? ' coberto' : ' com o texto cortado'));
      }
      scrollTo(0, 0);
      const texto = document.body.innerText;
      return { janela: [innerWidth, innerHeight], vazaLado: document.documentElement.scrollWidth > innerWidth + 1, ruins,
        charset: document.characterSet, lang: document.documentElement.lang,
        estragados: [...new Set(texto.match(/[ÃÂ][\\u0080-\\u00ff]|\\ufffd|&[a-z]+;/g) || [])],
        acentuados: (texto.match(/[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g) || []).length,
        nomeNaAba: document.querySelector('#abas .aba .txt')?.textContent,
        nomeCabe: (() => { const e = document.querySelector('#abas .aba .txt'); return e ? e.scrollWidth <= e.clientWidth + 1 : null; })() };
    })()`);
    await n.captura(`tela-${largura}x${altura}-${n.tipo}.png`);
    await n.js(`document.getElementById('termos').scrollIntoView({ block: 'center' })`);
    await n.captura(`tela-${largura}x${altura}-${n.tipo}-termos.png`);
    r.telas[`${largura}x${altura}`] = t;
    assert.deepEqual(t.janela, [largura, altura], 'I: tamanho da janela');
    assert.equal(t.vazaLado, false, `I: ${largura}×${altura} transborda para os lados`);
    assert.deepEqual(t.ruins, [], `I: ${largura}×${altura}: botões que não cabem`);
    assert.equal(t.charset, 'UTF-8', 'I: página em UTF-8');
    assert.deepEqual(t.estragados, [], `I: ${largura}×${altura}: acentos estragados no texto da página`);
    assert.ok(t.acentuados > 20, 'I: a interface tem acentos de verdade: ' + t.acentuados);
    assert.equal(t.nomeNaAba, ACENTUADO, 'I: nome acentuado na aba');
    if (!t.nomeCabe) anotar(`${largura}×${altura}: o nome longo do arquivo aparece cortado na aba (inteiro no cabeçalho e na dica da aba)`);
    r.erros.push(...n.erros);
    await n.fechar();
  }

  const inesperados = r.erros.filter((e) => !ESPERADOS.test(e));
  r.errosInesperados = inesperados;
  writeFileSync(join(SAIDA, `resultado-${r.navegador}.json`), JSON.stringify(r, null, 2));
  assert.deepEqual(inesperados, [], 'console sem erro inesperado');
  console.log(`uso: tudo certo (${r.navegador}; abrir 1 pág. ${r.tempos.abrir1} ms, 300 pág. ${r.tempos.abrir300} ms, procurar 300 ${r.tempos.procurar300} ms, salvar 300 ${r.tempos.salvar300} ms)`);
} catch (e) {
  r.falha = String(e.stack || e);
  r.erros = [...(r.erros || []), ...n.erros];
  writeFileSync(join(SAIDA, `resultado-${r.navegador}.json`), JSON.stringify(r, null, 2));
  console.error('uso FALHOU: ' + e.message);
  if (n.erros.length) console.error('console do navegador:\n  ' + n.erros.join('\n  '));
  try { await n.captura(`falha-${r.navegador}.png`); } catch { /* sem tela */ }
  await n.fechar();
  process.exit(1);
}
