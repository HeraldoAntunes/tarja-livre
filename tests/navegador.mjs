// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Controle do Microsoft Edge sem janela pelo protocolo de depuração, comum aos testes de ponta a ponta. Abre o
// Tarja Livre montado direto do disco (file://), como o usuário abre, e junta erros do console e violações da
// política de segurança para o teste reprovar se aparecer algum.
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const HTML = join(RAIZ, 'dist', 'Tarja Livre.html');
export const HTML_OCR = join(RAIZ, 'dist', 'Tarja Livre com OCR.html');
export const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);

export function montar() {
  execFileSync('python', ['-X', 'utf8', join(RAIZ, 'scripts', 'montar.py')], { stdio: 'inherit' });
}

const portaLivre = () => new Promise((ok) => {
  const s = createServer();
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); });
});

// Com TARJA_EXE=<caminho do exe>, os testes rodam dentro da janela própria (WebView2) em vez do Edge sem janela.
const EXE = process.env.TARJA_EXE;

// perfilFixo: pasta de perfil que sobrevive ao fechar (para testar o que fica guardado entre uma abertura e outra)
// Limpeza no fim, também quando o teste falha (cada perfil do WebView2 ocupa uns 0,5 GB; antes ficavam na pasta
// temporária para sempre). Fecha os processos do Edge e do WebView2 que usam a pasta do teste (só esses: a pasta é
// única, criada aqui) e apaga as pastas, tentando de novo enquanto algum processo ainda as segura.
const abertos = new Map();     // pid do navegador ou do exe → pastas do teste
const pastasDoFim = new Set(); // perfis fixos (sobrevivem entre aberturas): só saem no fim do processo
const pausa = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function fecharProcessosDa(pasta) {
  try {
    execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^msedge' -and $_.CommandLine -like '*${pasta.replace(/'/g, "''")}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' });
  } catch { /* nada a fechar */ }
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
  try { execFileSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' }); } catch { /* já saiu */ }
  for (const p of pastas) { fecharProcessosDa(p); apagarPasta(p); }
  abertos.delete(pid);
}
process.on('exit', () => {
  for (const [pid, pastas] of abertos) limpar(pid, pastas);
  for (const p of pastasDoFim) { fecharProcessosDa(p); apagarPasta(p); }
});

export async function abrirNavegador(capturas, { largura = 1400, altura = 900, perfilFixo = null } = {}) {
  if (!EDGE && !EXE) throw new Error('Microsoft Edge não encontrado');
  const porta = await portaLivre();
  const perfil = perfilFixo || mkdtempSync(join(tmpdir(), 'tarja-e2e-perfil-'));
  const baixados = mkdtempSync(join(tmpdir(), 'tarja-e2e-saida-'));
  const edge = EXE
    ? spawn(EXE, ['--sem-instalar'], { stdio: 'ignore', env: { ...process.env, WEBVIEW2_USER_DATA_FOLDER: perfil,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${porta}` } })
    : spawn(EDGE, ['--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`,
      '--no-first-run', '--no-default-browser-check', `--window-size=${largura},${altura}`, 'about:blank'], { stdio: 'ignore' });
  const erros = [];
  const respostas = [];   // respostas combinadas para as próximas perguntas (confirm) da página
  const perguntas = [];   // o texto de cada pergunta respondida assim
  let alvo;
  for (let t = 0; t < 60 && !alvo; t++) {
    await espera(250);
    try {
      const lista = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
      alvo = lista.find((x) => x.type === 'page');
    } catch { /* o Edge ainda está subindo */ }
  }
  abertos.set(edge.pid, perfilFixo ? [baixados] : [perfil, baixados]);
  if (perfilFixo) pastasDoFim.add(perfilFixo);
  if (!alvo) { limpar(edge.pid, abertos.get(edge.pid)); throw new Error('Edge não respondeu no protocolo de depuração'); }

  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((r, f) => { ws.onopen = r; ws.onerror = f; });
  let seq = 0;
  const pend = new Map();
  const ouvintes = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    for (const f of ouvintes) f(d);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
    if (d.method === 'Runtime.exceptionThrown') erros.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) {
      erros.push(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') erros.push('log: ' + d.params.entry.text);
    // confirm()/alert() inesperado travaria a página sem janela: registra como erro e responde "Cancelar"
    if (d.method === 'Page.javascriptDialogOpening') {
      if (respostas.length) perguntas.push(d.params.message);
      else erros.push('janela inesperada: ' + d.params.message);
      // a resposta pode ser { aceitar, depois: ms }: como alguém que demora para responder
      const r = respostas.length ? respostas.shift() : false;
      const accept = typeof r === 'object' ? r.aceitar : r;
      const enviar = () => ws.send(JSON.stringify({ id: ++seq, method: 'Page.handleJavaScriptDialog', params: { accept } }));
      if (typeof r === 'object' && r.depois) setTimeout(enviar, r.depois); else enviar();
    }
  };
  const cdp = (method, params = {}) => new Promise((r, f) => {
    const id = ++seq;
    pend.set(id, (d) => (d.error ? f(new Error(method + ': ' + d.error.message)) : r(d.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
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
    cdp, js, ate, erros, baixados, perguntas, pid: edge.pid,
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
      await cdp('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: baixados });
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
        if (readdirSync(baixados).includes(nome)) {
          await espera(300);
          return readFileSync(join(baixados, nome));
        }
      }
      throw new Error('PDF salvo não apareceu: ' + nome);
    },
    // queda brusca: mata o processo e os filhos pelo PID, sem dar à página a chance de gravar nada
    async matar() {
      try { ws.close(); } catch { /* já fechado */ }
      try { execFileSync('taskkill', ['/F', '/T', '/PID', String(edge.pid)], { stdio: 'ignore' }); } catch { /* já saiu */ }
      await espera(1500);
    },
    async fechar() {
      try { ws.close(); } catch { /* já fechado */ }
      await espera(300);
      limpar(edge.pid, abertos.get(edge.pid) || []);
    },
  };
  return n;
}
