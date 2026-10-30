// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Validação no Linux: abre o HTML montado direto do disco (file://) no Chromium ou no Firefox sem janela, com o
// puppeteer-core (Chromium pelo protocolo de depuração, Firefox pelo WebDriver BiDi), e passa pelos casos de
// docs/LINUX.md. Todos os PDFs são fictícios, gerados na hora pelo próprio teste. Não muda nada do programa.
//
// Uso (dentro de tests/linux, depois de npm ci e de python3 scripts/montar.py na raiz):
//   CHROMIUM=/caminho/do/chrome node teste_linux.mjs chromium [casos]
//   FIREFOX=/caminho/do/firefox node teste_linux.mjs firefox [casos]
// casos: fluxo,ab,ab-rapido,recuperar,termos,ocr (padrão: todos)
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HTML = join(RAIZ, 'dist', 'Tarja Livre.html');
const HTML_OCR = join(RAIZ, 'dist', 'Tarja Livre com OCR.html');
const NAVEGADOR = process.argv[2];
const CASOS = (process.argv[3] || 'fluxo,ab,ab-rapido,recuperar,termos,ocr').split(',');
const CAPTURAS = join(RAIZ, 'files', 'linux', NAVEGADOR || '');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (b) => createHash('sha256').update(b).digest('hex');
if (!['chromium', 'firefox'].includes(NAVEGADOR)) {
  console.error('uso: node teste_linux.mjs chromium|firefox [casos]');
  process.exit(2);
}

async function abrirNavegador() {
  const perfil = mkdtempSync(join(tmpdir(), 'tarja-linux-perfil-'));
  const baixados = mkdtempSync(join(tmpdir(), 'tarja-linux-saida-'));
  const browser = NAVEGADOR === 'chromium'
    ? await puppeteer.launch({ browser: 'chrome', executablePath: process.env.CHROMIUM, headless: true, userDataDir: perfil,
      args: ['--no-sandbox', '--window-size=1400,900'], defaultViewport: { width: 1400, height: 900 } })
    : await puppeteer.launch({ browser: 'firefox', executablePath: process.env.FIREFOX, headless: true, userDataDir: perfil,
      defaultViewport: { width: 1400, height: 900 },
      // o PDF salvo vai direto para a pasta do teste, sem perguntar e sem abrir no leitor de PDF do Firefox
      extraPrefsFirefox: { 'browser.download.dir': baixados, 'browser.download.folderList': 2,
        'browser.download.useDownloadDir': true, 'browser.download.always_ask_before_handling_new_types': false,
        'browser.download.open_pdf_attachments_inline': false, 'pdfjs.disabled': true,
        'browser.helperApps.neverAsk.saveToDisk': 'application/pdf' } });
  const page = (await browser.pages())[0] || await browser.newPage();
  if (NAVEGADOR === 'chromium') {
    const s = await page.createCDPSession();
    await s.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: baixados });
  }
  const erros = [];
  const respostas = [];
  const perguntas = [];
  page.on('console', (m) => { if (['error', 'warn', 'warning'].includes(m.type())) erros.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => erros.push('exceção: ' + (e.message || e)));
  page.on('dialog', async (d) => {
    // recarregar com tarjas não salvas: o navegador pergunta se quer sair; a pessoa confirma
    if (d.type() === 'beforeunload') { perguntas.push('beforeunload'); await d.accept().catch(() => {}); return; }
    if (respostas.length) perguntas.push(d.message()); else erros.push('janela inesperada: ' + d.message());
    const r = respostas.length ? respostas.shift() : false;
    try { if (r) await d.accept(); else await d.dismiss(); } catch { /* já respondida */ }
  });
  const js = (expr) => page.evaluate(expr);
  const ate = async (expr, rotulo, ms = 30000) => {
    for (let t = 0; t < ms / 150; t++) {
      if (await js(expr).catch(() => false)) return;
      await espera(150);
    }
    const estado = await js(`['paginaTexto', 'infoPaginas', 'infoVistas', 'resumoAchados', 'aviso', 'nomeArquivo']
      .map((id) => id + '=' + (document.getElementById(id)?.textContent || '')).join(' | ') + ' | selos=' +
      [...document.querySelectorAll('.mini-pag')].map((m) => m.querySelector('.selo')?.textContent || '0').join(',')`).catch(() => '?');
    throw new Error('tempo esgotado esperando: ' + rotulo + '\n  estado: ' + estado);
  };
  const n = {
    page, js, ate, erros, perguntas, baixados,
    responder: (...r) => respostas.push(...r),
    clicar: (id) => js(`document.getElementById('${id}').click()`),
    texto: (id) => js(`document.getElementById('${id}').textContent`),
    async abrirPrograma(arquivo = HTML) {
      await page.goto(pathToFileURL(arquivo).href, { waitUntil: 'load' });
      await n.prepararPagina();
    },
    async prepararPagina() {
      await ate(`document.readyState === 'complete' && !!globalThis.pdfjsLib && !!globalThis.jspdf`, 'página carregar');
      await js(`window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => __csp.push(e.violatedDirective + ' ' + e.blockedURI))`);
      // Chromium tem a caixa "Salvar como" (showSaveFilePicker), que não abre sem janela: no lugar dela entra um
      // substituto que faz o papel da pessoa (aceita o nome sugerido) e guarda o que o programa gravou. O programa
      // segue o mesmo caminho de quando há a caixa. No Firefox não há a caixa e o PDF sai como download comum.
      await js(`if (typeof window.showSaveFilePicker === 'function') {
        window.__salvos = [];
        window.showSaveFilePicker = async (o) => { const partes = [];
          return { name: o.suggestedName, createWritable: async () => ({ write: async (b) => partes.push(b),
            close: async () => { window.__salvos.push({ nome: o.suggestedName, blob: new Blob(partes) }); } }) }; };
      }`);
    },
    // entrega arquivos ao botão "Abrir PDF", como se o usuário tivesse escolhido
    async enviar(arquivos, campo = 'entrada', tipo = 'application/pdf') {
      const lista = arquivos.map(([b, nome]) => [Buffer.from(b).toString('base64'), nome]);
      await js(`(() => { const dt = new DataTransfer();
        for (const [b64, nome] of ${JSON.stringify(lista)}) { const s = atob(b64); const u = new Uint8Array(s.length);
          for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); dt.items.add(new File([u], nome, { type: '${tipo}' })); }
        const e = document.getElementById('${campo}'); e.files = dt.files; e.dispatchEvent(new Event('change')); })()`);
    },
    async arrastar(fx0, fy0, fx1, fy1) {
      const r = await js(`(() => { const r = document.getElementById('tela').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
      const p = (fx, fy) => [r[0] + fx * r[2], r[1] + fy * r[3]];
      // o Firefox (WebDriver BiDi) só aceita coordenadas inteiras
      const [ax, ay] = p(fx0, fy0).map(Math.round);
      const [bx, by] = p(fx1, fy1).map(Math.round);
      await page.mouse.move(ax, ay);
      await page.mouse.down();
      for (let k = 1; k <= 5; k++) await page.mouse.move(Math.round(ax + ((bx - ax) * k) / 5), Math.round(ay + ((by - ay) * k) / 5));
      await page.mouse.up();
    },
    // nomes de todos os PDFs que o programa salvou nesta sessão (pela caixa ou por download)
    async salvos() {
      const pelaCaixa = await js(`(window.__salvos || []).map((s) => s.nome)`);
      return [...pelaCaixa, ...readdirSync(baixados)];
    },
    async esperarDownload(nome, ms = 120000) {
      for (let t = 0; t < ms / 200; t++) {
        await espera(200);
        if (erros.some((e) => e.startsWith('janela inesperada'))) throw new Error(erros.find((e) => e.startsWith('janela')));
        const b64 = await js(`(async () => { const s = (window.__salvos || []).find((x) => x.nome === ${JSON.stringify(nome)});
          if (!s) return null; const u = new Uint8Array(await s.blob.arrayBuffer()); let r = '';
          for (let i = 0; i < u.length; i += 0x8000) r += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(r); })()`);
        if (b64) return Buffer.from(b64, 'base64');
        const achados = readdirSync(baixados);
        if (achados.includes(nome) && !achados.some((a) => a.endsWith('.part') || a.endsWith('.crdownload'))) {
          await espera(400);
          return readFileSync(join(baixados, nome));
        }
      }
      throw new Error('PDF salvo não apareceu: ' + nome + ' (na pasta: ' + readdirSync(baixados).join(', ') + ')');
    },
    async captura(nome) {
      mkdirSync(CAPTURAS, { recursive: true });
      await page.screenshot({ path: join(CAPTURAS, nome) });
    },
    async fechar() {
      await browser.close().catch(() => {});
      for (const p of [perfil, baixados]) rmSync(p, { recursive: true, force: true });
    },
  };
  return n;
}

// PDF fictício feito com o jsPDF da própria página: linhas de texto em cada página
const gerarPdf = (n, paginas) => n.js(`(() => { const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' }); d.setFontSize(13);
  ${JSON.stringify(paginas)}.forEach((linhas, p) => { if (p) d.addPage(); linhas.forEach((t, i) => d.text(t, 60, 100 + 30 * i)); });
  const u = new Uint8Array(d.output('arraybuffer')); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s); })()`)
  .then((b) => Buffer.from(b, 'base64'));

const abas = (n) => n.js(`[...document.querySelectorAll('#abas .aba')].map((a) => a.querySelector('.txt').textContent)`);
async function irPara(n, nome) {
  await n.js(`[...document.querySelectorAll('#abas .aba')].find((a) => a.querySelector('.txt').textContent === ${JSON.stringify(nome)}).querySelector('.aba-nome').click()`);
  await n.ate(`document.getElementById('nomeArquivo').textContent === ${JSON.stringify(nome)} && !!document.getElementById('tela').dataset.pagina`, 'trocar para ' + nome);
}
async function verTodas(n, total) {
  for (let i = 0; i < total; i++) {
    await n.js(`document.querySelectorAll('.mini-pag')[${i}].click()`);
    await n.ate(`document.getElementById('tela').dataset.pagina === '${i + 1}'`, 'ver a página ' + (i + 1));
  }
  await n.ate(`document.getElementById('infoVistas').textContent === '${total} de ${total}'`, 'todas vistas');
}
async function procurarEAceitar(n, ms = 60000) {
  await n.clicar('btProcurar');
  await n.ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procura terminar', ms);
  const resumo = await n.texto('resumoAchados');
  await n.clicar('btAceitarTodas');
  await n.ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'aceitar todas');
  return resumo;
}
// lê o PDF salvo com o PDF.js da página: páginas, texto de cada uma e a folha de conferência
const examinar = (n, bytes) => n.js(`(async () => {
  const s = atob('${bytes.toString('base64')}'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  const d = await pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise;
  const textos = [];
  for (let i = 1; i <= d.numPages; i++) textos.push((await (await d.getPage(i)).getTextContent()).items.map((x) => x.str).join(' '));
  return { paginas: d.numPages, textos, folha: textos.at(-1).replace(/\\s+/g, ' ') };
})()`);
function semSegredos(bytes, segredos, rotulo) {
  for (const s of segredos) assert.ok(!bytes.includes(Buffer.from(s, 'latin1')), `${rotulo}: arquivo salvo ainda tem "${s}"`);
}
function semErros(n) {
  return n.js('window.__csp').then((csp) => {
    assert.deepEqual(csp, [], 'nenhuma violação da política de segurança');
    assert.deepEqual(n.erros, [], 'console sem erro nem aviso');
  });
}

const casos = {
  // abrir, procurar, tarjar (sugestões e à mão), conferir e salvar; o PDF salvo não pode ter os dados
  async fluxo() {
    const n = await abrirNavegador();
    try {
      await n.abrirPrograma();
      assert.equal(await n.js(`document.getElementById('opOcr').hidden`), true, 'sem OCR no HTML normal');
      const pdf = await gerarPdf(n, [['Declaração de exemplo', 'Nome: Fulano de Teste', 'CPF: 831.975.872-60',
        'E-mail: fulano.teste@exemplo.test'], ['Telefone: (00) 91234-5678', 'Empresa CNPJ 19.808.456/0001-00']]);
      await n.enviar([[pdf, 'exemplo.pdf']]);
      await n.ate(`document.getElementById('infoPaginas').textContent === '2'`, 'abrir o PDF');
      assert.equal(await n.texto('infoHash'), sha(pdf), 'SHA-256 do original na tela');
      const resumo = await procurarEAceitar(n);
      assert.match(resumo, /^4 pendente/, 'quatro sugestões: ' + resumo);
      for (const t of ['CPF 1', 'CNPJ 1', 'E-mail 1', 'Telefone 1']) assert.ok(resumo.includes(t), t + ' em ' + resumo);
      await n.js(`document.querySelectorAll('.mini-pag')[0].click()`);
      await n.ate(`document.getElementById('tela').dataset.pagina === '1'`, 'página 1');
      await n.arrastar(0.09, 0.145, 0.45, 0.165);   // tarja à mão sobre o nome
      await n.ate(`document.querySelector('.mini-pag .selo')?.textContent === '3'`, 'tarja à mão contar na miniatura');
      await verTodas(n, 2);
      await n.clicar('revisei');
      await n.captura('fluxo-antes-de-salvar.png');
      await n.clicar('btSalvar');
      const saida = await n.esperarDownload('exemplo-tarjado.pdf');
      await n.ate(`!document.getElementById('infoHashSaida').hidden`, 'SHA-256 do salvo aparecer');
      assert.equal(await n.texto('infoHashSaida'), sha(saida), 'SHA-256 do PDF salvo confere com o arquivo baixado');
      semSegredos(saida, ['831.975.872-60', 'Fulano', 'fulano', '91234', '19.808.456'], 'fluxo');
      const ex = await examinar(n, saida);
      assert.equal(ex.paginas, 3, 'duas páginas e a folha de conferência');
      for (const t of ex.textos.slice(0, 2)) assert.equal(t.trim(), '', 'página refeita como imagem, sem texto');
      assert.ok(ex.folha.includes('Folha de conferência'), 'folha presente');
      assert.ok(ex.folha.includes(sha(pdf)), 'folha com o SHA-256 do original');
      await semErros(n);
      return `4 sugestões, 1 tarja à mão, salvo ${saida.length} bytes sem os dados`;
    } finally { await n.fechar(); }
  },

  // abrir A e depois B (em duas escolhas separadas), voltar para A e salvar: o arquivo salvo tem de ser A
  async ab(rapido = false) {
    const n = await abrirNavegador();
    try {
      await n.abrirPrograma();
      const a = await gerarPdf(n, [['Aluno A', 'CPF 831.975.872-60'], ['Aluno A, segunda página', 'CPF 514.334.988-55']]);
      const b = await gerarPdf(n, [['Aluna B', 'E-mail aluna.b@exemplo.test']]);
      await n.enviar([[a, 'A.pdf']]);
      if (!rapido) await n.ate(`document.getElementById('nomeArquivo').textContent === 'A.pdf' && !!document.getElementById('tela').dataset.pagina`, 'abrir A');
      await n.enviar([[b, 'B.pdf']]);
      await n.ate(`document.querySelectorAll('#abas .aba').length === 2`, 'duas abas', 30000);
      // abrindo com calma, B (o último) fica na tela; abrindo B antes de A terminar, o programa pode ficar em A
      await n.ate(`!!document.getElementById('tela').dataset.pagina && !document.body.classList.contains('ocupado')`, 'um arquivo na tela');
      const naTela = await n.texto('nomeArquivo');
      if (!rapido) assert.equal(naTela, 'B.pdf', 'B na tela depois de abrir');
      const ordem = (await abas(n)).join(', ');
      if (!rapido) assert.equal(ordem, 'A.pdf, B.pdf', 'abas na ordem de abertura');
      await irPara(n, 'A.pdf');
      assert.equal(await n.texto('infoHash'), sha(a), 'na aba A, o SHA-256 mostrado é o de A');
      assert.equal(await n.texto('infoPaginas'), '2', 'A tem 2 páginas');
      const resumo = await procurarEAceitar(n);
      assert.match(resumo, /^2 pendente\(s\): CPF 2$/, 'A: um CPF em cada página: ' + resumo);
      await verTodas(n, 2);
      await n.clicar('revisei');
      await n.clicar('btSalvar');
      const saida = await n.esperarDownload('A-tarjado.pdf');
      assert.deepEqual(await n.salvos(), ['A-tarjado.pdf'], 'só A foi salvo');
      const ex = await examinar(n, saida);
      assert.equal(ex.paginas, 3, 'as 2 páginas de A e a folha (B tem 1 página)');
      assert.ok(ex.folha.includes(sha(a)), 'folha com o SHA-256 de A');
      assert.ok(!ex.folha.includes(sha(b)), 'folha sem o SHA-256 de B');
      semSegredos(saida, ['831.975', '514.334', 'Aluno', 'Aluna', 'aluna.b'], 'A');
      await semErros(n);
      return `abas: ${ordem}; na tela depois de abrir: ${naTela}; salvo A-tarjado.pdf com 2 páginas + folha e o SHA-256 de A`;
    } finally { await n.fechar(); }
  },
  'ab-rapido': () => casos.ab(true),

  // tarjar, recarregar a página, abrir o mesmo PDF e recuperar as marcas
  async recuperar() {
    const n = await abrirNavegador();
    try {
      await n.abrirPrograma();
      const pdf = await gerarPdf(n, [['Ficha fictícia', 'CPF 831.975.872-60', 'E-mail ciclana@exemplo.test']]);
      await n.enviar([[pdf, 'ficha.pdf']]);
      await n.ate(`document.getElementById('tela').dataset.pagina === '1'`, 'abrir');
      assert.equal(await n.js(`document.getElementById('andamento').hidden`), true, 'nada a recuperar na primeira vez');
      await procurarEAceitar(n);
      await n.arrastar(0.2, 0.5, 0.5, 0.55);
      await n.ate(`document.querySelector('.mini-pag .selo')?.textContent === '3'`, '3 marcas');
      await espera(3500);   // o andamento grava até 2 s depois da mudança
      await n.page.reload({ waitUntil: 'load' });
      await n.prepararPagina();
      await n.enviar([[pdf, 'ficha.pdf']]);
      await n.ate(`document.getElementById('tela').dataset.pagina === '1'`, 'abrir de novo');
      await n.ate(`!document.getElementById('andamento').hidden`, 'oferta de recuperar', 10000);
      const oferta = await n.texto('andamentoTexto');
      assert.match(oferta, /tem 3 marca/, 'oferta com as 3 marcas: ' + oferta);
      await n.captura('recuperar-oferta.png');
      await n.clicar('btRecuperar');
      assert.equal(await n.js(`document.getElementById('andamento').hidden`), true, 'oferta some depois de recuperar');
      // achado (docs/LINUX.md, defeito 1): logo depois de Recuperar, a miniatura fica sem o selo com o número de
      // marcas, porque as miniaturas são remontadas depois de aplicar as marcas. O selo volta na próxima mudança de tela.
      await espera(1000);
      const seloLogo = await n.js(`document.querySelector('.mini-pag .selo')?.textContent || 'nenhum'`);
      if (seloLogo !== '3') achados.push(`recuperar: selo da miniatura logo depois de Recuperar = ${seloLogo} (esperado 3)`);
      await verTodas(n, 1);
      await n.ate(`document.querySelector('.mini-pag .selo')?.textContent === '3'`, 'as 3 marcas de volta na miniatura');
      await n.clicar('revisei');
      await n.clicar('btSalvar');
      const saida = await n.esperarDownload('ficha-tarjado.pdf');
      semSegredos(saida, ['831.975', 'ciclana'], 'recuperado');
      await semErros(n);
      return `oferta com 3 marcas depois de recarregar; recuperado e salvo sem os dados; selo logo depois de Recuperar: ${seloLogo}`;
    } finally { await n.fechar(); }
  },

  // lista de termos: importar .txt, procurar por ela, guardar (só depois de perguntar), recarregar e apagar
  async termos() {
    const n = await abrirNavegador();
    try {
      await n.abrirPrograma();
      await n.enviar([[Buffer.from('Beltrano Fictício\nRua das Acácias Inventadas\nbeltrano fictício\n'), 'nomes.txt']], 'entradaTermos', 'text/plain');
      await n.ate(`document.getElementById('infoTermos').textContent === '2 termo(s) na lista.'`, 'importar a lista');
      assert.equal(await n.js(`localStorage.getItem('tarja-livre.termos')`), null, 'lista não gravada sem pedir');
      // sem "Guardar", recarregar deveria esvaziar a lista; o Firefox devolve o texto do formulário (docs/LINUX.md, defeito 2)
      const recarregar = async () => { await n.page.reload({ waitUntil: 'load' }); await n.prepararPagina(); await espera(500); };
      const lista = () => n.js(`[document.getElementById('infoTermos').textContent, document.getElementById('termos').value.length]`);
      await recarregar();
      const semGuardar = await lista();
      if (semGuardar[0] !== 'Nenhum termo.') achados.push(`termos: lista nunca guardada voltou depois de recarregar (F5): ${semGuardar[0]}`);
      if (semGuardar[0] === 'Nenhum termo.') {
        await n.enviar([[Buffer.from('Beltrano Fictício\nRua das Acácias Inventadas\nbeltrano fictício\n'), 'nomes.txt']], 'entradaTermos', 'text/plain');
        await n.ate(`document.getElementById('infoTermos').textContent === '2 termo(s) na lista.'`, 'importar a lista de novo');
      }
      const pdf = await gerarPdf(n, [['Aluno: Beltrano Fictício', 'Endereço: Rua das Acácias Inventadas, 0']]);
      await n.enviar([[pdf, 'termos.pdf']]);
      await n.ate(`document.getElementById('tela').dataset.pagina === '1'`, 'abrir');
      const resumo = await procurarEAceitar(n);
      assert.match(resumo, /Termo da lista 2/, 'os dois termos achados: ' + resumo);
      n.responder(false);
      await n.clicar('termoGuardar');
      assert.equal(await n.js(`document.getElementById('termoGuardar').checked`), false, 'Cancelar deixa desmarcado');
      assert.equal(await n.js(`localStorage.getItem('tarja-livre.termos')`), null, 'Cancelar não guarda');
      n.responder(true);
      await n.clicar('termoGuardar');
      assert.match(await n.js(`localStorage.getItem('tarja-livre.termos') || ''`), /Acácias/, 'guardada quando pedido');
      await n.page.reload({ waitUntil: 'load' });
      await n.prepararPagina();
      await n.ate(`document.getElementById('infoTermos').textContent === '2 termo(s) na lista.'`, 'lista de volta depois de recarregar', 5000);
      assert.equal(await n.js(`document.getElementById('termoGuardar').checked`), true, 'Guardar continua marcado');
      await n.clicar('termoGuardar');
      assert.equal(await n.js(`localStorage.getItem('tarja-livre.termos')`), null, 'desmarcar apaga');
      await recarregar();
      const depoisDeApagar = await lista();
      if (depoisDeApagar[0] !== 'Nenhum termo.') achados.push(`termos: lista apagada (Guardar desmarcado) voltou depois de recarregar (F5): ${depoisDeApagar[0]}`);
      // abrir o arquivo de novo (nova navegação, não recarregar): nada guardado, lista vazia
      await n.abrirPrograma();
      assert.equal(await n.texto('infoTermos'), 'Nenhum termo.', 'lista vazia ao abrir de novo depois de apagar');
      await semErros(n);
      const pergunta = n.perguntas.find((q) => q !== 'beforeunload') || '';
      return `F5 sem Guardar: ${semGuardar[0]}; F5 depois de apagar: ${depoisDeApagar[0]}; abrir de novo: Nenhum termo.; ` +
        `pergunta: "${pergunta.split('\n').slice(-1)[0].slice(0, 60)}..."`;
    } finally { await n.fechar(); }
  },

  // OCR: página só com imagem (dados fictícios), lida pelo OCR; o salvo é comparado pixel a pixel com a máscara
  async ocr() {
    const n = await abrirNavegador();
    try {
      await n.abrirPrograma(HTML_OCR);
      assert.equal(await n.js(`document.getElementById('opOcr').hidden`), false, 'opção de OCR visível');
      const LINHAS = [['Declaração de exemplo (página digitalizada)', '', ''], ['Nome: ', 'Fulano de Teste', ''],
        ['CPF: ', '831.975.872-60', ''], ['E-mail: ', 'fulano.teste@exemplo.test', ''], ['Telefone: ', '(00) 91234-5678', ' (recado)']];
      const pdf = Buffer.from(await n.js(`(() => {
        const linhas = ${JSON.stringify(LINHAS)};
        const fazer = (soDados, semEmail = false) => { const c = document.createElement('canvas'); c.width = 1240; c.height = 1754;
          const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#111';
          x.font = '36px Arial'; x.textBaseline = 'alphabetic';
          linhas.forEach(([a, dado, b], i) => { const y = 220 + i * 90; let px = 150;
            for (const [t, eDado] of [[a, false], [dado, true], [b, false]]) { if (!t) continue;
              if (!soDados || (eDado && !(semEmail && t.includes('@')))) x.fillText(t, px, y); px += x.measureText(t).width; } });
          return c; };
        const pagina = fazer(false); window.__mascara = fazer(true); window.__mascaraSemEmail = fazer(true, true);
        const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
        d.addImage(pagina.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595.28, 841.89);
        const u = new Uint8Array(d.output('arraybuffer')); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s);
      })()`), 'base64');
      await n.enviar([[pdf, 'digitalizado.pdf']]);
      await n.ate(`document.getElementById('tela').dataset.pagina === '1'`, 'abrir');
      await n.js(`(() => { const t = document.getElementById('termos'); t.value = 'Fulano de Teste'; t.dispatchEvent(new Event('input')); })()`);
      const inicio = Date.now();
      await n.clicar('btProcurar');
      await n.ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'OCR e procura', 300000);
      const segundos = Math.round((Date.now() - inicio) / 1000);
      const resumo = await n.texto('resumoAchados');
      for (const t of ['CPF 1', 'Telefone 1', 'Termo da lista 1']) assert.ok(resumo.includes(t), t + ' em ' + resumo);
      // achado (docs/LINUX.md, defeito 3): com as fontes do Linux, o OCR lê o @ como outra coisa e o e-mail não vira
      // sugestão. O e-mail fica fora da máscara para a conferência pixel a pixel dos outros dados.
      const comEmail = resumo.includes('E-mail 1');
      if (!comEmail) achados.push(`ocr: e-mail da página digitalizada não sugerido (resumo: ${resumo})`);
      await n.captura('ocr-sugestoes.png');
      await n.clicar('btAceitarTodas');
      await verTodas(n, 1);
      await n.clicar('revisei');
      await n.clicar('btSalvar');
      const saida = await n.esperarDownload('digitalizado-tarjado.pdf');
      const ex = await n.js(`(async () => {
        const s = atob('${saida.toString('base64')}'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        const d = await pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise;
        const p = await d.getPage(1); const v = p.getViewport({ scale: 1240 / 595.28 });
        const c = document.createElement('canvas'); c.width = 1240; c.height = 1754; const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await p.render({ canvasContext: ctx, viewport: v, intent: 'print' }).promise;
        const m = window[${comEmail} ? '__mascara' : '__mascaraSemEmail'].getContext('2d').getImageData(0, 0, 1240, 1754).data;
        const o = ctx.getImageData(0, 0, 1240, 1754).data;
        let falhas = 0;
        for (let k = 0; k < m.length; k += 4) if (m[k] + m[k + 1] + m[k + 2] < 300 && o[k] + o[k + 1] + o[k + 2] > 150) falhas++;
        const folha = (await (await d.getPage(d.numPages)).getTextContent()).items.map((x) => x.str).join(' ');
        return { falhas, folha, paginas: d.numPages };
      })()`);
      assert.equal(ex.falhas, 0, 'todo pixel de dado coberto (descobertos: ' + ex.falhas + ')');
      assert.equal(ex.paginas, 2, 'a página e a folha');
      assert.match(ex.folha.replace(/\s+/g, ' '), /lidas por OCR: 1/, 'folha registra a leitura por OCR');
      await semErros(n);
      return `OCR em ${segundos} s; sugestões: ${resumo}; 0 pixel descoberto nos dados sugeridos`;
    } finally { await n.fechar(); }
  },
};

const versao = await (async () => {
  const exe = NAVEGADOR === 'chromium' ? process.env.CHROMIUM : process.env.FIREFOX;
  const b = NAVEGADOR === 'chromium'
    ? await puppeteer.launch({ browser: 'chrome', executablePath: exe, headless: true, args: ['--no-sandbox'] })
    : await puppeteer.launch({ browser: 'firefox', executablePath: exe, headless: true });
  const v = await b.version();
  await b.close();
  return v;
})();
console.log(`navegador: ${NAVEGADOR} (${versao}), sem janela`);
console.log(`HTML: ${sha(readFileSync(HTML))}  ${HTML}`);
console.log(`OCR:  ${sha(readFileSync(HTML_OCR))}  ${HTML_OCR}`);
const resultados = [];
const achados = [];   // defeitos encontrados que não impedem o resto do caso (ver docs/LINUX.md)
for (const c of CASOS) {
  const inicio = Date.now();
  try {
    const nota = await casos[c]();
    resultados.push([c, true]);
    console.log(`PASSOU  ${c} (${Math.round((Date.now() - inicio) / 1000)} s): ${nota}`);
  } catch (e) {
    resultados.push([c, false]);
    console.log(`FALHOU  ${c} (${Math.round((Date.now() - inicio) / 1000)} s): ${e.message}`);
  }
}
const falhas = resultados.filter(([, ok]) => !ok).map(([c]) => c);
for (const a of achados) console.log('ACHADO  ' + a);
console.log(`\n${resultados.length - falhas.length} de ${resultados.length} passaram` + (falhas.length ? `; falharam: ${falhas.join(', ')}` : '') +
  (achados.length ? `; ${achados.length} achado(s)` : ''));
mkdirSync(join(RAIZ, 'files'), { recursive: true });
writeFileSync(join(RAIZ, 'files', `linux-${NAVEGADOR}.json`), JSON.stringify({ navegador: NAVEGADOR, versao, resultados, achados }, null, 1));
process.exit(falhas.length ? 1 : 0);
