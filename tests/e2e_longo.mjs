// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Teste longo do .exe (bateria C1, C3 e C5): abre um PDF, põe uma tarja sem salvar, minimiza a janela e confere a
// cada 5 minutos que o programa continua vivo, que a página responde e que os relógios dela andam (minimizada, a
// janela não pode congelar nem fechar sozinha), que o andamento continua guardado e que nenhum processo do programa
// carrega a DLL do módulo de segurança de banco que se injeta nos navegadores (wslbdhm64.dll). No fim, volta a
// janela e confere que responde.
// Uso: TARJA_EXE=<exe> node tests/e2e_longo.mjs [minutos, padrão 30]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, abrirNavegador, espera } from './navegador.mjs';

if (!process.env.TARJA_EXE) throw new Error('rode com TARJA_EXE=<caminho do exe>');
const MINUTOS = Number(process.argv[2] || 30);
const perfilFixo = mkdtempSync(join(tmpdir(), 'tarja-e2e-longo-'));
const ps = (c) => execFileSync('powershell', ['-NoProfile', '-Command', c]).toString().trim();

const n = await abrirNavegador(join(RAIZ, 'files', 'e2e-longo'), { perfilFixo });
await n.abrirPrograma();
await n.enviarArquivo(readFileSync(join(RAIZ, 'tests', 'fixtures', 'tarja-teste.pdf')), 'teste.pdf');
await n.ate(`document.getElementById('tela').dataset.pagina === '1'`, 'abrir o PDF de teste', 30000);
await n.arrastar(0.2, 0.2, 0.5, 0.3);
await n.js(`window.__batidas = 0; setInterval(() => window.__batidas++, 1000)`);

// o exe deste teste (o mais novo) e os processos do motor dele (os que usam a pasta de perfil do teste)
const processos = () => JSON.parse(ps(`$exe = Get-Process '${basename(process.env.TARJA_EXE, '.exe')}' | Sort-Object StartTime | Select-Object -Last 1;
  $motor = Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -like '*${basename(perfilFixo)}*' };
  $ids = @($exe.Id) + @($motor | ForEach-Object { $_.ProcessId });
  $com = @($ids | Where-Object { try { (Get-Process -Id $_).Modules.ModuleName -contains 'wslbdhm64.dll' } catch { $false } });
  @{ exe = $exe.Id; motor = @($motor).Count; warsaw = $com.Count; warsawNoChrome = @(Get-Process chrome, msedge -ErrorAction SilentlyContinue |
    Where-Object { try { $_.Modules.ModuleName -contains 'wslbdhm64.dll' } catch { $false } }).Count } | ConvertTo-Json -Compress`));
const inicio = processos();
assert.ok(inicio.exe && inicio.motor > 0, 'achar o exe e o motor dele: ' + JSON.stringify(inicio));
ps(`Add-Type -Name J -Namespace M -MemberDefinition '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);';
  [void][M.J]::ShowWindow((Get-Process -Id ${inicio.exe}).MainWindowHandle, 6)`); // 6 = minimizar

const leituras = [];
for (let m = 5; m <= MINUTOS; m += 5) {
  await espera(5 * 60 * 1000);
  const p = processos();
  const vivo = p.exe === inicio.exe;
  const batidas = await Promise.race([n.js('window.__batidas'), espera(10000).then(() => 'sem resposta')]);
  const andamento = await n.js(`new Promise((ok) => { const q = indexedDB.open('tarja-livre', 1);
    q.onsuccess = () => { const g = q.result.transaction('andamento').objectStore('andamento').count(); g.onsuccess = () => { q.result.close(); ok(g.result); }; }; })`);
  const l = { minuto: m, vivo, batidas, andamento, warsawNoPrograma: p.warsaw, processosDoMotor: p.motor, warsawNoChromeEdge: p.warsawNoChrome };
  leituras.push(l);
  console.log(JSON.stringify(l));
  assert.ok(vivo, `minuto ${m}: o programa fechou sozinho`);
  assert.equal(typeof batidas, 'number', `minuto ${m}: a página não respondeu`);
  assert.equal(andamento, 1, `minuto ${m}: o andamento sumiu`);
  assert.equal(p.warsaw, 0, `minuto ${m}: a DLL do módulo de banco (wslbdhm64.dll) entrou num processo do programa`);
}
// as batidas andam minimizado (o navegador pode espaçar os relógios, mas não parar)
assert.ok(leituras.at(-1).batidas > leituras[0].batidas, 'os relógios da página pararam minimizada');
ps(`Add-Type -Name J2 -Namespace M2 -MemberDefinition '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);';
  [void][M2.J2]::ShowWindow((Get-Process -Id ${inicio.exe}).MainWindowHandle, 9)`); // 9 = restaurar
await espera(1500);
assert.equal(await n.js(`document.getElementById('tela').dataset.pagina`), '1', 'volta da janela: a página responde');
await n.captura('longo-fim.png');
await n.matar();
rmSync(perfilFixo, { recursive: true, force: true });
console.log(`longo: tudo certo (${MINUTOS} min minimizado com trabalho não salvo, sem fechar, respondendo, andamento guardado, módulo de banco fora)`);
