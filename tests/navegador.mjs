// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Controle do navegador sem janela, comum aos testes de ponta a ponta. Abre o Tarja Livre montado direto do disco
// (file://), como o usuário abre, e junta erros do console e violações da política de segurança para o teste reprovar
// se aparecer algum. No Windows, usa o Microsoft Edge, como sempre. Fora dele (ou com TARJA_NAVEGADOR), usa o Chromium
// (ou Chrome, ou Edge) pelo mesmo protocolo de depuração, ou o Firefox pelo WebDriver BiDi, com uma tradução pequena
// dos comandos que os testes mandam (ver docs/E2E-MULTIPLATAFORMA.md).
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const HTML = join(RAIZ, 'dist', 'Tarja Livre.html');
export const HTML_OCR = join(RAIZ, 'dist', 'Tarja Livre com OCR.html');
export const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const WINDOWS = process.platform === 'win32';
// no Windows o Python se chama python; no Linux e no macOS, em geral, python3. PYTHON=<comando> escolhe outro.
export const PYTHON = process.env.PYTHON || (WINDOWS ? 'python' : 'python3');

export function montar() {
  execFileSync(PYTHON, ['-X', 'utf8', join(RAIZ, 'scripts', 'montar.py')], { stdio: 'inherit' });
}

// Onde procurar cada navegador. No Windows, o Edge vem primeiro (é o que o programa usa e o que o CI testa).
const CAMINHOS = {
  edge: ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable'],
  chromium: ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe'],
  firefox: ['/usr/bin/firefox', '/usr/lib/firefox/firefox', '/usr/lib/firefox-esr/firefox-esr',
    '/Applications/Firefox.app/Contents/MacOS/firefox',
    'C:/Program Files/Mozilla Firefox/firefox.exe'],
};
// o Chromium que vem com o Playwright, se ele estiver instalado (o do Firefox é modificado e não fala o WebDriver BiDi)
function chromiumDoPlaywright() {
  const exigir = createRequire(import.meta.url);
  for (const m of ['playwright', 'playwright-core']) {
    try { const c = exigir(m).chromium.executablePath(); if (c && existsSync(c)) return c; } catch { /* não instalado */ }
  }
  return null;
}
const tipoDo = (caminho) => (/firefox/i.test(basename(caminho)) ? 'firefox' : 'chromium');
// TARJA_NAVEGADOR=<caminho do executável>, ou só o nome: edge, chromium (ou chrome) ou firefox
export function acharNavegador() {
  const pedido = process.env.TARJA_NAVEGADOR;
  if (pedido && !['edge', 'chromium', 'chrome', 'firefox'].includes(pedido.toLowerCase())) {
    if (!existsSync(pedido)) throw new Error('TARJA_NAVEGADOR aponta para um arquivo que não existe: ' + pedido);
    return { caminho: pedido, tipo: tipoDo(pedido) };
  }
  const nome = pedido?.toLowerCase();
  const ordem = nome === 'firefox' ? [CAMINHOS.firefox]
    : nome === 'edge' ? [CAMINHOS.edge]
      : nome ? [[chromiumDoPlaywright()], CAMINHOS.chromium]
        : [WINDOWS ? CAMINHOS.edge : [], [chromiumDoPlaywright()], CAMINHOS.chromium, CAMINHOS.edge, CAMINHOS.firefox];
  const caminho = ordem.flat().find((c) => c && existsSync(c));
  if (!caminho) {
    throw new Error(nome ? `navegador "${nome}" não encontrado; aponte o executável com TARJA_NAVEGADOR=<caminho>`
      : WINDOWS ? 'Microsoft Edge não encontrado' : 'nenhum navegador encontrado (Chromium, Chrome, Edge ou Firefox); aponte um com TARJA_NAVEGADOR=<caminho>');
  }
  return { caminho, tipo: tipoDo(caminho) };
}

const portaLivre = () => new Promise((ok) => {
  const s = createServer();
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); });
});

// Com TARJA_EXE=<caminho do exe>, os testes rodam dentro da janela própria (WebView2) em vez do Edge sem janela.
const EXE = process.env.TARJA_EXE;

// perfilFixo: pasta de perfil que sobrevive ao fechar (para testar o que fica guardado entre uma abertura e outra)
// Limpeza no fim, também quando o teste falha (cada perfil do WebView2 ocupa uns 0,5 GB; antes ficavam na pasta
// temporária para sempre). Fecha os processos do navegador e do WebView2 que usam a pasta do teste (só esses: a pasta é
// única, criada aqui) e apaga as pastas, tentando de novo enquanto algum processo ainda as segura. O perfil é sempre
// uma pasta temporária do teste, nunca o perfil do usuário.
const abertos = new Map();     // pid do navegador ou do exe → pastas do teste
const pastasDoFim = new Set(); // perfis fixos (sobrevivem entre aberturas): só saem no fim do processo
const pausa = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function fecharProcessosDa(pasta) {
  try {
    if (WINDOWS) {
      execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(msedge|chrome|firefox)' -and $_.CommandLine -like '*${pasta.replace(/'/g, "''")}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' });
    } else {
      execFileSync('pkill', ['-KILL', '-f', pasta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')], { stdio: 'ignore' });
    }
  } catch { /* nada a fechar */ }
}
// mata o processo e os filhos dele. No Windows pelo taskkill; nos outros, o navegador sobe num grupo de processos só
// dele (detached), e o SIGKILL vai para o grupo inteiro
function matarArvore(pid) {
  if (WINDOWS) {
    try { execFileSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' }); } catch { /* já saiu */ }
    return;
  }
  try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* já saiu */ } }
}
function apagarPasta(pasta) {
  for (let k = 0; k < 10; k++) {
    try { rmSync(pasta, { recursive: true, force: true }); } catch { /* ainda presa */ }
    if (!existsSync(pasta)) return;
    fecharProcessosDa(pasta);
    pausa(500);
  }
}
function limpar(pid, pastas) {
  matarArvore(pid);
  for (const p of pastas) { fecharProcessosDa(p); apagarPasta(p); }
  abertos.delete(pid);
}
process.on('exit', () => {
  for (const [pid, pastas] of abertos) limpar(pid, pastas);
  for (const p of pastasDoFim) { fecharProcessosDa(p); apagarPasta(p); }
});

// arquivos que já terminaram de baixar (o Firefox cria o nome final vazio e grava em nome.part; o Chromium grava
// em .crdownload)
export function baixadosProntos(pasta) {
  const todos = readdirSync(pasta);
  if (todos.some((a) => a.endsWith('.part') || a.endsWith('.crdownload'))) return [];
  return todos;
}

// Preferências do perfil temporário do Firefox: sem primeira execução, sem atualização e sem rede de fundo, e o PDF
// salvo vai direto para a pasta do teste, sem perguntar e sem abrir no leitor de PDF do próprio Firefox.
function preferenciasFirefox(baixados) {
  const p = {
    'browser.shell.checkDefaultBrowser': false, 'browser.startup.page': 0, 'browser.startup.homepage': 'about:blank',
    'browser.startup.homepage_override.mstone': 'ignore', 'browser.aboutwelcome.enabled': false,
    'browser.sessionstore.resume_from_crash': false, 'toolkit.startup.max_resumed_crashes': -1,
    'datareporting.policy.dataSubmissionEnabled': false, 'toolkit.telemetry.reportingpolicy.firstRun': false,
    'app.update.disabledForTesting': true, 'app.normandy.enabled': false, 'extensions.update.enabled': false,
    'network.captive-portal-service.enabled': false, 'network.connectivity-service.enabled': false,
    'browser.safebrowsing.malware.enabled': false, 'browser.safebrowsing.phishing.enabled': false,
    'browser.safebrowsing.downloads.enabled': false,
    'browser.download.dir': baixados, 'browser.download.folderList': 2, 'browser.download.useDownloadDir': true,
    'browser.download.always_ask_before_handling_new_types': false, 'browser.download.open_pdf_attachments_inline': false,
    'browser.download.alwaysOpenPanel': false, 'pdfjs.disabled': true,
  };
  return Object.entries(p).map(([k, v]) => `user_pref(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('\n') + '\n';
}

// valor de volta do WebDriver BiDi (serializado) para o que o protocolo do Chromium devolve com returnByValue
const NUMEROS = { NaN: NaN, '-0': -0, Infinity: Infinity, '-Infinity': -Infinity };
function valorBidi(v) {
  switch (v?.type) {
    case 'undefined': return undefined;
    case 'null': return null;
    case 'string': case 'boolean': return v.value;
    case 'number': return typeof v.value === 'number' ? v.value : NUMEROS[v.value];
    case 'array': case 'set': return (v.value || []).map(valorBidi);
    case 'object': case 'map': return Object.fromEntries((v.value || []).map(([k, x]) => [typeof k === 'string' ? k : valorBidi(k), valorBidi(x)]));
    case 'date': return v.value;
    default: return {};
  }
}
// teclas especiais e modificadores do WebDriver (os testes usam as setas, Ctrl+Z e Ctrl+Y)
const TECLAS = { ArrowLeft: '\uE012', ArrowUp: '\uE013', ArrowRight: '\uE014', ArrowDown: '\uE015', Enter: '\uE007',
  Escape: '\uE00C', Tab: '\uE004', Backspace: '\uE003', Delete: '\uE017', Home: '\uE011', End: '\uE010',
  PageUp: '\uE00E', PageDown: '\uE00F' };
const MODIFICADORES = [[1, '\uE00A'], [2, '\uE009'], [4, '\uE03D'], [8, '\uE008']];   // Alt, Ctrl, Meta, Shift
const BOTOES = { left: 0, middle: 1, right: 2 };

// Liga ao Firefox pelo WebDriver BiDi e devolve um cdp(method, params) que entende os comandos do protocolo do
// Chromium que os testes usam, traduzidos. Um comando sem tradução dá erro (nunca é ignorado em silêncio).
async function ligarFirefox(porta, { aoRegistro, aoPerguntar, ouvintes }) {
  let ws;
  for (let t = 0; t < 60 && !ws; t++) {
    await espera(250);
    try {
      const w = new WebSocket(`ws://127.0.0.1:${porta}/session`);
      await new Promise((r, f) => { w.onopen = r; w.onerror = f; });
      ws = w;
    } catch { /* o Firefox ainda está subindo */ }
  }
  if (!ws) return null;
  let seq = 0;
  const pend = new Map();
  const pedir = (method, params = {}) => new Promise((r, f) => {
    const id = ++seq;
    pend.set(id, (d) => (d.type === 'error' ? f(new Error(method + ': ' + d.error + ' ' + (d.message || ''))) : r(d.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  let contexto;
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    for (const f of ouvintes) f(d);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
    if (d.method === 'log.entryAdded') {
      const e = d.params;
      if (e.type === 'javascript') aoRegistro(e.text);
      else if (e.type === 'console' && ['error', 'warn'].includes(e.level)) aoRegistro((e.level === 'warn' ? 'warning' : 'error') + ': ' + e.text);
      else if (e.level === 'error') aoRegistro('log: ' + e.text);
    }
    if (d.method === 'browsingContext.userPromptOpened' && d.params.context === contexto) {
      aoPerguntar(d.params.message, (accept) => pedir('browsingContext.handleUserPrompt', { context: contexto, accept }).catch(() => {}));
    }
  };
  await pedir('session.new', { capabilities: { alwaysMatch: { unhandledPromptBehavior: { default: 'ignore' } } } });
  contexto = (await pedir('browsingContext.getTree', {})).contexts[0].context;
  await pedir('session.subscribe', { events: ['log.entryAdded', 'browsingContext.userPromptOpened'] });
  const mouse = { type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' } };
  const acoes = (fonte, actions) => pedir('input.performActions', { context: contexto, actions: [{ ...fonte, actions }] });
  // o Firefox só aceita coordenadas inteiras
  const mover = (p) => ({ type: 'pointerMove', x: Math.round(p.x), y: Math.round(p.y), origin: 'viewport' });
  const valorTecla = (key) => {
    if (TECLAS[key]) return TECLAS[key];
    if ([...key].length === 1) return key;
    throw new Error('tecla sem tradução para o Firefox: ' + key);
  };
  const cdp = async (method, p = {}) => {
    switch (method) {
      case 'Runtime.enable': case 'Log.enable': case 'Page.enable': return {};
      case 'Page.setDownloadBehavior': return {};   // a pasta de download vem das preferências do perfil
      case 'Page.navigate': await pedir('browsingContext.navigate', { context: contexto, url: p.url, wait: 'complete' }); return {};
      case 'Runtime.evaluate': {
        const r = await pedir('script.evaluate', { expression: p.expression, target: { context: contexto },
          awaitPromise: !!p.awaitPromise, resultOwnership: 'none', serializationOptions: { maxObjectDepth: 20 } });
        if (r.type === 'exception') return { exceptionDetails: { text: r.exceptionDetails.text, exception: { description: r.exceptionDetails.text } } };
        return { result: { value: valorBidi(r.result) } };
      }
      case 'Page.captureScreenshot': {
        const clip = p.clip ? { clip: { type: 'box', x: p.clip.x, y: p.clip.y, width: p.clip.width, height: p.clip.height } } : {};
        return { data: (await pedir('browsingContext.captureScreenshot', { context: contexto, ...clip })).data };
      }
      case 'Emulation.setDeviceMetricsOverride':
        await pedir('browsingContext.setViewport', { context: contexto, viewport: { width: p.width, height: p.height },
          devicePixelRatio: p.deviceScaleFactor || 1 });
        return {};
      case 'Input.dispatchMouseEvent': {
        const botao = BOTOES[p.button] ?? 0;
        if (p.type === 'mouseMoved') await acoes(mouse, [mover(p)]);
        else if (p.type === 'mousePressed') await acoes(mouse, [mover(p), { type: 'pointerDown', button: botao }]);
        else if (p.type === 'mouseReleased') await acoes(mouse, [mover(p), { type: 'pointerUp', button: botao }]);
        else throw new Error('evento de mouse sem tradução para o Firefox: ' + p.type);
        return {};
      }
      case 'Input.dispatchKeyEvent': {
        const mods = MODIFICADORES.filter(([b]) => (p.modifiers || 0) & b).map(([, v]) => v);
        const tecla = valorTecla(p.key);
        const lista = p.type === 'keyDown' ? [...mods.map((v) => ({ type: 'keyDown', value: v })), { type: 'keyDown', value: tecla }]
          : p.type === 'keyUp' ? [{ type: 'keyUp', value: tecla }, ...mods.map((v) => ({ type: 'keyUp', value: v }))] : null;
        if (!lista) throw new Error('evento de tecla sem tradução para o Firefox: ' + p.type);
        await acoes({ type: 'key', id: 'teclado' }, lista);
        return {};
      }
      default: throw new Error('comando sem tradução para o Firefox: ' + method);
    }
  };
  return { ws, cdp };
}

// Liga ao Chromium, ao Edge ou ao WebView2 pelo protocolo de depuração (o de sempre)
async function ligarChromium(porta, { aoRegistro, aoPerguntar, ouvintes }) {
  let alvo;
  for (let t = 0; t < 60 && !alvo; t++) {
    await espera(250);
    try {
      const lista = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
      alvo = lista.find((x) => x.type === 'page');
    } catch { /* o navegador ainda está subindo */ }
  }
  if (!alvo) return null;
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((r, f) => { ws.onopen = r; ws.onerror = f; });
  let seq = 0;
  const pend = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    for (const f of ouvintes) f(d);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
    if (d.method === 'Runtime.exceptionThrown') aoRegistro(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) {
      aoRegistro(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') aoRegistro('log: ' + d.params.entry.text);
    if (d.method === 'Page.javascriptDialogOpening') {
      aoPerguntar(d.params.message, (accept) => ws.send(JSON.stringify({ id: ++seq, method: 'Page.handleJavaScriptDialog', params: { accept } })));
    }
  };
  const cdp = (method, params = {}) => new Promise((r, f) => {
    const id = ++seq;
    pend.set(id, (d) => (d.error ? f(new Error(method + ': ' + d.error.message)) : r(d.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { ws, cdp };
}

let avisado = false;
export async function abrirNavegador(capturas, { largura = 1400, altura = 900, perfilFixo = null } = {}) {
  const nav = EXE ? { caminho: EXE, tipo: 'chromium' } : acharNavegador();
  const firefox = nav.tipo === 'firefox';
  if (!avisado) { avisado = true; console.error(`navegador: ${EXE ? 'exe' : nav.tipo} (${nav.caminho})`); }
  const porta = await portaLivre();
  const perfil = perfilFixo || mkdtempSync(join(tmpdir(), 'tarja-e2e-perfil-'));
  const baixados = mkdtempSync(join(tmpdir(), 'tarja-e2e-saida-'));
  if (firefox) writeFileSync(join(perfil, 'user.js'), preferenciasFirefox(baixados));
  // fora do Windows, o navegador sobe num grupo de processos só dele, para matar() pegar também os filhos
  const opcoes = { stdio: 'ignore', detached: !WINDOWS };
  const processo = EXE
    ? spawn(EXE, ['--sem-instalar'], { stdio: 'ignore', env: { ...process.env, WEBVIEW2_USER_DATA_FOLDER: perfil,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${porta}` } })
    : firefox
      ? spawn(nav.caminho, ['--headless', '--no-remote', '--profile', perfil, `--remote-debugging-port=${porta}`,
        `--window-size=${largura},${altura}`, 'about:blank'], opcoes)
      : spawn(nav.caminho, ['--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
        '--no-first-run', '--no-default-browser-check', `--window-size=${largura},${altura}`,
        // como root (contêiner, CI), o Chromium do Linux não sobe com a caixa de areia
        ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), 'about:blank'], opcoes);
  const erros = [];
  const respostas = [];   // respostas combinadas para as próximas perguntas (confirm) da página
  const perguntas = [];   // o texto de cada pergunta respondida assim
  const ouvintes = [];
  // confirm()/alert() inesperado travaria a página sem janela: registra como erro e responde "Cancelar"
  const aoPerguntar = (mensagem, responderCom) => {
    if (respostas.length) perguntas.push(mensagem);
    else erros.push('janela inesperada: ' + mensagem);
    // a resposta pode ser { aceitar, depois: ms }: como alguém que demora para responder
    const r = respostas.length ? respostas.shift() : false;
    const accept = typeof r === 'object' ? r.aceitar : r;
    if (typeof r === 'object' && r.depois) setTimeout(() => responderCom(accept), r.depois); else responderCom(accept);
  };
  const ligacao = await (firefox ? ligarFirefox : ligarChromium)(porta, { aoRegistro: (e) => erros.push(e), aoPerguntar, ouvintes });
  abertos.set(processo.pid, perfilFixo ? [baixados] : [perfil, baixados]);
  if (perfilFixo) pastasDoFim.add(perfilFixo);
  if (!ligacao) {
    limpar(processo.pid, abertos.get(processo.pid));
    throw new Error((firefox ? 'Firefox' : EXE ? 'O exe' : WINDOWS ? 'Edge' : 'O navegador') + ' não respondeu no protocolo de depuração');
  }
  const { ws, cdp } = ligacao;
  const js = async (expr) => {
    const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('no navegador: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  const ate = async (expr, rotulo, ms = 20000) => {
    if (process.env.DEPURA) console.error(new Date().toISOString().slice(11, 19), 'esperando:', rotulo);
    for (let t = 0; t < ms / 100; t++) {
      if (await js(expr)) return;
      await espera(100);
    }
    const estado = await js(`['paginaTexto', 'infoPaginas', 'infoVistas', 'resumoAchados', 'aviso']
      .map((id) => id + '=' + (document.getElementById(id)?.textContent || '')).join(' | ') +
      ' | tela=' + document.getElementById('tela').dataset.pagina + ' | ocupado=' + document.body.classList.contains('ocupado')`).catch(() => '?');
    throw new Error('tempo esgotado esperando: ' + rotulo + '\n  estado: ' + estado);
  };
  const n = {
    cdp, js, ate, erros, baixados, perguntas, pid: processo.pid, tipo: firefox ? 'firefox' : 'chromium',
    // os arquivos já baixados por inteiro (vazio enquanto algum download não terminou)
    prontos: () => baixadosProntos(baixados),
    // combina a resposta das próximas perguntas da página (true = OK, false = Cancelar, ou { aceitar, depois: ms })
    responder: (...r) => respostas.push(...r),
    // eventos do protocolo (por exemplo, uma janela nova aberta pela página)
    aoEvento: (f) => ouvintes.push(f),
    clicar: (id) => js(`document.getElementById('${id}').click()`),
    texto: (id) => js(`document.getElementById('${id}').textContent`),
    async tecla(key, code, vk, modifiers = 0) {
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, modifiers });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers });
    },
    async captura(nome, recorte) {
      mkdirSync(capturas, { recursive: true });
      const { data } = await cdp('Page.captureScreenshot', { format: 'png', ...(recorte ? { clip: { ...recorte, scale: 1 } } : {}) });
      writeFileSync(join(capturas, nome), Buffer.from(data, 'base64'));
    },
    // arrasta o mouse de verdade sobre a página, em frações do tamanho dela
    async arrastar(fx0, fy0, fx1, fy1) {
      const r = await js(`(() => { const r = document.getElementById('tela').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
      const p = (fx, fy) => ({ x: r[0] + fx * r[2], y: r[1] + fy * r[3] });
      const a = p(fx0, fy0);
      const b = p(fx1, fy1);
      await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...a, button: 'left', buttons: 1, clickCount: 1 });
      for (let k = 1; k <= 5; k++) {
        await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x + ((b.x - a.x) * k) / 5, y: a.y + ((b.y - a.y) * k) / 5, button: 'left', buttons: 1 });
      }
      await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...b, button: 'left', buttons: 0, clickCount: 1 });
    },
    async abrirPrograma(arquivo = HTML) {
      await cdp('Runtime.enable');
      await cdp('Log.enable');
      await cdp('Page.enable');
      // o Chromium mais novo pode não ter mais o Page.setDownloadBehavior; o Browser.setDownloadBehavior faz o mesmo
      await cdp('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: baixados })
        .catch(() => cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: baixados }));
      if (!EXE) await cdp('Page.navigate', { url: pathToFileURL(arquivo).href });
      await ate(`document.readyState === 'complete' && !!globalThis.pdfjsLib && !!globalThis.jspdf`, 'página carregar');
      await js(`window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => __csp.push(e.violatedDirective + ' ' + e.blockedURI))`);
      // a caixa "Salvar como" do sistema não abre sem janela: os testes salvam por download, e o teste do
      // "Salvar como" põe um substituto no lugar dela
      await js(`window.showSaveFilePicker = undefined`);
    },
    // entrega um arquivo ao botão "Abrir PDF", como se o usuário tivesse escolhido
    async enviarArquivo(bytes, nome) {
      const b64 = Buffer.from(bytes).toString('base64');
      await js(`(() => {
        const s = atob('${b64}'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        const dt = new DataTransfer(); dt.items.add(new File([u], ${JSON.stringify(nome)}, { type: 'application/pdf' }));
        const e = document.getElementById('entrada'); e.files = dt.files; e.dispatchEvent(new Event('change'));
      })()`);
    },
    async esperarDownload(nome, ms = 30000) {
      for (let t = 0; t < ms / 150; t++) {
        await espera(150);
        if (erros.some((e) => e.startsWith('janela inesperada'))) throw new Error(erros.find((e) => e.startsWith('janela')));
        if (baixadosProntos(baixados).includes(nome)) {
          await espera(300);
          return readFileSync(join(baixados, nome));
        }
      }
      throw new Error('PDF salvo não apareceu: ' + nome);
    },
    // queda brusca: mata o processo e os filhos pelo PID, sem dar à página a chance de gravar nada
    async matar() {
      try { ws.close(); } catch { /* já fechado */ }
      matarArvore(processo.pid);
      await espera(1500);
    },
    async fechar() {
      try { ws.close(); } catch { /* já fechado */ }
      await espera(300);
      limpar(processo.pid, abertos.get(processo.pid) || []);
    },
  };
  return n;
}
