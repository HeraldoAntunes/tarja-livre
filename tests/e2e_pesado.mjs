// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Máquina lenta e PDF grande (computador de escola): gera na hora um PDF fictício com N páginas, freia o processador
// do navegador F vezes (Emulation.setCPUThrottlingRate) e mede o tempo de abrir, procurar, aceitar, passar por todas as
// páginas e salvar, e o pico de memória dos processos do navegador do teste. Durante o salvamento, a barra de progresso
// tem de andar e a página tem de responder. O PDF salvo é conferido (páginas e nada do texto original).
// Uso: node tests/e2e_pesado.mjs [páginas=100] [freio=4] [formato=png|jpeg]
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, montar, abrirNavegador, espera } from './navegador.mjs';

const PAGINAS = Number(process.argv[2] || 100);
const FREIO = Number(process.argv[3] || 4);
const FORMATO = process.argv[4] || 'png';
const CPF = '514.334.988-55';

montar();
const n = await abrirNavegador(join(RAIZ, 'files', 'e2e-pesado'));
await n.abrirPrograma();
const perfilDoTeste = await n.js('1') && process.env.TARJA_EXE ? 'br.tarjalivre' : 'tarja-e2e-perfil-';
const memoria = () => Number(execFileSync('powershell', ['-NoProfile', '-Command',
  `(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${perfilDoTeste}*' } | ForEach-Object { (Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue).PrivateMemorySize64 } | Measure-Object -Sum).Sum`]).toString().trim() || 0);
let pico = 0;
const medir = () => { pico = Math.max(pico, memoria()); };
const tempos = {};
const cronometro = async (nome, f) => { const t = Date.now(); await f(); tempos[nome] = Math.round((Date.now() - t) / 1000); medir(); };

// PDF de teste: uma página A4 de texto por página, com um CPF fictício em cada uma
const b64 = await n.js(`(() => {
  const d = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  for (let i = 1; i <= ${PAGINAS}; i++) {
    if (i > 1) d.addPage();
    d.setFontSize(12);
    for (let l = 0; l < 40; l++) d.text('Linha ' + (l + 1) + ' da página ' + i + ' do documento de teste, com texto comum.', 50, 60 + l * 18);
    d.text('CPF do titular: ${CPF}', 50, 800);
  }
  return btoa(d.output());
})()`);
const pdf = Buffer.from(b64, 'base64');
if (FORMATO === 'jpeg') await n.js(`(() => { const f = document.getElementById('formato'); f.value = 'jpeg'; f.dispatchEvent(new Event('change')); })()`);
await n.cdp('Emulation.setCPUThrottlingRate', { rate: FREIO });

await cronometro('abrir', async () => {
  await n.enviarArquivo(pdf, 'documento-grande.pdf');
  await n.ate(`document.getElementById('infoPaginas').textContent === '${PAGINAS}'`, 'abrir o PDF grande', 600000);
  await n.ate(`document.getElementById('tela').dataset.pagina === '1'`, 'primeira página', 120000);
});
await cronometro('procurar', async () => {
  await n.clicar('btProcurar');
  await n.ate(`/${PAGINAS} pendente/.test(document.getElementById('resumoAchados').textContent)`, 'achar um CPF por página', 900000);
});
await cronometro('aceitar', async () => {
  await n.clicar('btAceitarTodas');
  await n.ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'aceitar todas', 300000);
});
await cronometro('verTodas', async () => {
  for (let i = 0; i < PAGINAS; i++) {
    await n.js(`document.querySelectorAll('.mini-pag')[${i}].click()`);
    await n.ate(`document.getElementById('tela').dataset.pagina === '${i + 1}'`, 'ver a página ' + (i + 1), 120000);
    if (i % 25 === 0) medir();
  }
  await n.ate(`document.getElementById('infoVistas').textContent === '${PAGINAS} de ${PAGINAS}'`, 'todas vistas');
});
const barras = [];
let lenta = 0;
await cronometro('salvar', async () => {
  await n.clicar('revisei');
  await n.clicar('btSalvar');
  const fim = Date.now() + 1800000;
  while (Date.now() < fim) {
    await espera(2000);
    const t = Date.now();
    const b = await Promise.race([n.js(`[document.getElementById('barraProgresso').style.width, document.body.classList.contains('ocupado')]`),
      espera(15000).then(() => null)]);
    lenta = Math.max(lenta, Date.now() - t);
    medir();
    if (!b) continue;
    barras.push(b[0]);
    if (!b[1]) break;
  }
});
const nome = 'documento-grande-tarjado.pdf';
const salvo = await n.esperarDownload(nome, 60000);
const pdfSalvo = salvo.toString('latin1');
const paginasSalvas = (pdfSalvo.match(/\/Type\s*\/Page[^s]/g) || []).length;
const larguras = [...new Set(barras)];
const r = { paginas: PAGINAS, freio: FREIO, formato: FORMATO, segundos: tempos, picoMemoriaMB: Math.round(pico / 1048576),
  pdfSalvoMB: +(salvo.length / 1048576).toFixed(1), paginasSalvas, passosDaBarra: larguras.length, respostaMaisLentaMs: lenta };
console.log(JSON.stringify(r));
assert.ok(paginasSalvas >= PAGINAS, `o PDF salvo tem ${paginasSalvas} páginas, eram ${PAGINAS}`);
assert.ok(!pdfSalvo.includes(CPF), 'o CPF não pode estar no PDF salvo');
assert.ok(larguras.length >= 3, 'a barra de progresso andou durante o salvamento');
assert.ok(lenta < 15000, 'a página respondeu durante o salvamento');
assert.deepEqual(n.erros, [], 'console limpo');
await n.fechar();
console.log(`pesado: tudo certo (${PAGINAS} páginas, processador freado ${FREIO}x, ${FORMATO})`);
