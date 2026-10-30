// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Fechar a janela do exe (auditoria de 29/10/2026, rodada 2). Com PDF sem salvar, a página pergunta, e o exe espera a
// resposta o tempo que for. Com a página travada, o exe pergunta ele mesmo, numa caixa do Windows, em poucos segundos:
// "Não" deixa a janela aberta; "Sim" fecha. Só no exe: TARJA_EXE=<exe> node tests/e2e_fechar.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, montar, abrirNavegador, espera } from './navegador.mjs';

if (!process.env.TARJA_EXE) throw new Error('rode com TARJA_EXE=<caminho do exe>');
const ps = (c) => execFileSync('powershell', ['-NoProfile', '-Command', '[Console]::OutputEncoding = [Text.Encoding]::UTF8; ' + c]).toString().trim();
// janelas de primeiro nível do processo: [alça, classe, título, textos dos controles]
const JANELAS = `Add-Type -TypeDefinition @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class Jan {
  public delegate bool P(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(P f, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h, P f, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  static string T(IntPtr h) { var s = new StringBuilder(2048); GetWindowText(h, s, 2048); return s.ToString(); }
  static string C(IntPtr h) { var s = new StringBuilder(256); GetClassName(h, s, 256); return s.ToString(); }
  public static string Listar(uint pid) {
    var r = new List<string>();
    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid && IsWindowVisible(h)) {
      var f = new List<string>(); EnumChildWindows(h, (c, x) => { var t = T(c); if (t.Length > 0) f.Add(t); return true; }, IntPtr.Zero);
      r.Add(h.ToInt64() + "\\t" + C(h) + "\\t" + T(h) + "\\t" + string.Join(" | ", f)); } return true; }, IntPtr.Zero);
    return string.Join("\\n", r);
  }
  public static void Botao(IntPtr h, string rotulo) {
    EnumChildWindows(h, (c, x) => { if (T(c) == rotulo) { SendMessage(c, 0x00F5, IntPtr.Zero, IntPtr.Zero); return false; } return true; }, IntPtr.Zero);
  }
}
'@`;
const janelas = (pid) => ps(`${JANELAS}; [Jan]::Listar(${pid})`).split('\n').filter(Boolean).map((l) => l.split('\t'));
const caixa = (pid) => janelas(pid).find((j) => j[1] === '#32770');

montar();
const n = await abrirNavegador(join(RAIZ, 'files', 'e2e-fechar'));
await n.abrirPrograma();
await n.enviarArquivo(readFileSync(join(RAIZ, 'tests', 'fixtures', 'tarja-teste.pdf')), 'teste.pdf');
await n.ate(`document.getElementById('tela').dataset.pagina === '1'`, 'abrir', 30000);
const principal = janelas(n.pid).find((j) => j[2] === 'Tarja Livre');
assert.ok(principal, 'achar a janela do Tarja');

// PDF com tarja sem salvar: a página pergunta, e a pessoa demora 6 s para responder "Cancelar". Nesse tempo, o exe
// não pode pôr a pergunta dele por cima, e no fim a janela continua aberta
await n.arrastar(0.2, 0.2, 0.4, 0.3);
n.responder({ aceitar: false, depois: 6000 });
ps(`${JANELAS}; [void][Jan]::PostMessage([IntPtr]${principal[0]}, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)`);
for (let t = 0; t < 10; t++) {
  await espera(700);
  assert.equal(caixa(n.pid), undefined, 'com a pergunta da página aberta, o exe não pergunta por cima');
}
assert.equal(n.perguntas.length, 1, 'a página perguntou');
assert.ok(janelas(n.pid).some((j) => j[2] === 'Tarja Livre'), 'Cancelar na pergunta da página deixa a janela aberta');

// trava a página por 25 s e pede para fechar a janela (como o X)
await n.js(`setTimeout(() => { const t = Date.now(); while (Date.now() - t < 25000); }, 0)`).catch(() => {});
await espera(300);
ps(`${JANELAS}; [void][Jan]::PostMessage([IntPtr]${principal[0]}, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)`);
let c = null;
for (let t = 0; t < 16 && !c; t++) { await espera(500); c = caixa(n.pid); }
assert.ok(c, 'com a página travada, o exe pergunta numa caixa do Windows em até 8 s');
assert.match(c[3], /não respondeu/, 'a caixa explica que a página não respondeu: ' + c[3]);
// "Não": a janela continua
ps(`${JANELAS}; [Jan]::Botao([IntPtr]${c[0]}, '&Não')`);
await espera(1500);
assert.ok(janelas(n.pid).some((j) => j[2] === 'Tarja Livre'), '"Não" deixa a janela aberta');
// de novo, e "Sim": fecha
ps(`${JANELAS}; [void][Jan]::PostMessage([IntPtr]${principal[0]}, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)`);
c = null;
for (let t = 0; t < 16 && !c; t++) { await espera(500); c = caixa(n.pid); }
assert.ok(c, 'a pergunta volta no segundo pedido de fechar');
ps(`${JANELAS}; [Jan]::Botao([IntPtr]${c[0]}, '&Sim')`);
let vivo = true;
for (let t = 0; t < 20 && vivo; t++) { await espera(500); vivo = !!ps(`if (Get-Process -Id ${n.pid} -ErrorAction SilentlyContinue) { 'sim' } else { '' }`); }
assert.equal(vivo, false, '"Sim" fecha o programa');
await n.fechar().catch(() => {});
console.log('fechar: tudo certo (página travada: o exe pergunta sozinho, Não deixa aberta, Sim fecha)');
