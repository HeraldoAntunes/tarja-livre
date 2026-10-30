// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Queda brusca: o programa é morto pelo PID no meio do trabalho, cinco vezes seguidas, e a cada reabertura do mesmo
// PDF as marcas de antes têm de ser oferecidas e voltar. Confere também que o guardado não tem texto nenhum (nem o
// dado achado, nem o nome do arquivo), que "Descartar" apaga, que uma queda no meio do salvamento não perde as
// marcas e que salvar até o fim as apaga. Com TARJA_EXE, roda dentro do exe. Uso: node tests/e2e_andamento.mjs [pasta]
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, montar, abrirNavegador, espera } from './navegador.mjs';
const CPF_FICTICIOS = ['831.975.872-60', '514.334.988-55', '833.311.475-08', '834.068.419-10'];

const CAPTURAS = process.argv[2] || join(RAIZ, 'files', 'e2e-andamento');
const PDF = readFileSync(join(RAIZ, 'tests', 'fixtures', 'tarja-teste.pdf'));
const NOME = 'Contrato de Fulano de Teste.pdf';
const VEZES = 5;

montar();
const perfilFixo = mkdtempSync(join(tmpdir(), 'tarja-e2e-andamento-'));

async function abrir() {
  const n = await abrirNavegador(CAPTURAS, { perfilFixo });
  await n.abrirPrograma();
  await n.enviarArquivo(PDF, NOME);
  await n.ate(`document.getElementById('infoPaginas').textContent === '8'`, 'abrir o PDF de teste', 30000);
  await n.ate(`document.getElementById('tela').dataset.pagina === '1'`, 'primeira página aparecer');
  return n;
}
// tudo o que está no depósito do andamento (IndexedDB), em texto; '' quando vazio
const LER = `new Promise((ok) => { const q = indexedDB.open('tarja-livre', 1);
  q.onupgradeneeded = () => q.result.createObjectStore('andamento');
  q.onsuccess = () => { const r = {}; q.result.transaction('andamento').objectStore('andamento').openCursor().onsuccess = (e) => {
    const c = e.target.result; if (c) { r[c.key] = c.value; c.continue(); } else { q.result.close(); ok(Object.keys(r).length ? JSON.stringify(r) : ''); } }; }; })`;
const guardado = (n) => n.js(LER);
const oferta = (n) => n.js(`document.getElementById('andamento').hidden ? '' : document.getElementById('andamentoTexto').textContent`);
const marcasNaOferta = (t) => Number((t.match(/tem (\d+) marca/) || [])[1] || 0);
// a oferta vem de mostrarAndamento(), que lê o IndexedDB depois que a página já apareceu: num PC lento (o runner do
// Actions, 30/10/2026) ler na hora pegava a faixa ainda escondida. Esperar a oferta quando ela tem de vir; quando não
// tem de vir, dar o mesmo tempo antes de conferir que ficou vazia.
async function ofertaEsperada(n) {
  await n.ate(`!document.getElementById('andamento').hidden`, 'a oferta aparecer', 10000);
  return oferta(n);
}
async function ofertaAusente(n) {
  await espera(2000);
  return oferta(n);
}
async function esperarGravar(n, marcas) {
  await n.ate(`${LER}.then((t) => { try { const a = Object.values(JSON.parse(t))[0];
    return a.paginas.reduce((s, p) => s + p.marcas.length, 0) === ${marcas}; } catch { return false; } })`, `gravar ${marcas} marca(s)`, 5000);
}

// 1ª vez: nada a oferecer; aceita as sugestões (CPF, e-mail, nomes...) e tarja à mão; morre sem salvar
let n = await abrir();
assert.equal(await ofertaAusente(n), '', 'nada a oferecer na primeira vez');
await n.clicar('btProcurar');
await n.ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procura terminar', 60000);
await n.clicar('btAceitarTodas');
await n.ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'aceitar todas');
await n.arrastar(0.1, 0.9, 0.3, 0.95);
let total = 0;
await n.ate(`${LER}.then((t) => !!t)`, 'gravar o andamento', 5000);
total = JSON.parse(await guardado(n)) && Object.values(JSON.parse(await guardado(n)))[0].paginas.reduce((s, p) => s + p.marcas.length, 0);
assert.ok(total > 5, 'aceites e tarja guardados: ' + total);
const texto = await guardado(n);
for (const proibido of [...CPF_FICTICIOS, 'Fulano', 'Contrato', '@', 'exemplo']) {
  assert.ok(!texto.includes(proibido), 'o andamento não pode ter texto: achou ' + proibido);
}
const chaves = new Set();
JSON.parse(texto, (k, v) => { if (k && Number.isNaN(Number(k))) chaves.add(k); return v; });
assert.deepEqual([...chaves].filter((k) => !['quando', 'paginas', 'vista', 'marcas', 'tipo', 'cor', 'x', 'y', 'w', 'h', 'largura', 'pontos'].includes(k)
  && !/^[0-9a-f]{64}$/.test(k)), [], 'só geometria, páginas vistas e o SHA-256 como chave');
await n.captura('andamento-1-antes-da-queda.png');
await n.matar();

// 2ª a 5ª vez: a oferta aparece com as marcas certas, recupera, tarja mais uma e morre de novo
for (let k = 2; k <= VEZES; k++) {
  n = await abrir();
  const t = await ofertaEsperada(n);
  assert.equal(marcasNaOferta(t), total, `queda ${k - 1}: oferta com ${total} marca(s), veio "${t}"`);
  if (k === 2) await n.captura('andamento-2-oferta.png');
  await n.clicar('btRecuperar');
  assert.equal(await oferta(n), '', 'a oferta some depois de recuperar');
  await n.arrastar(0.1 + k * 0.1, 0.05, 0.15 + k * 0.1, 0.08);
  total += 1;
  await esperarGravar(n, total);
  await n.matar();
}

// queda no meio do salvamento: as marcas continuam guardadas
n = await abrir();
assert.equal(marcasNaOferta(await ofertaEsperada(n)), total, 'oferta depois da última queda');
await n.clicar('btRecuperar');
for (let i = 0; i < 8; i++) {
  await n.js(`document.querySelectorAll('.mini-pag')[${i}].click()`);
  await n.ate(`document.getElementById('tela').dataset.pagina === '${i + 1}'`, 'ver a página ' + (i + 1));
}
await n.clicar('revisei');
// queda no meio do salvamento, sem depender do tempo: o lugar escolhido na caixa "Salvar como" (substituta) nunca
// termina de abrir para gravar, e o salvamento fica parado ali, já com o PDF gerado e conferido, até a queda. Antes era
// o processador freado e uma espera fixa; com o PC parado, o PDF pequeno terminava de salvar antes do kill e o teste
// falhava por isso (29/10/2026, noite).
await n.js(`window.showSaveFilePicker = async () => ({ name: 'preso.pdf', createWritable: () => new Promise(() => {}) })`);
await n.clicar('btSalvar');
await n.ate(`document.getElementById('btSalvar').textContent === 'Conferindo o PDF gerado...'`, 'chegar à conferência', 60000);
await espera(1500);
assert.ok(await n.js(`document.body.classList.contains('ocupado')`), 'salvamento em andamento na hora da queda');
await n.matar();
n = await abrir();
assert.equal(marcasNaOferta(await ofertaEsperada(n)), total, 'queda no salvamento: as marcas continuam oferecidas');

// salvar até o fim apaga o andamento
await n.clicar('btRecuperar');
for (let i = 0; i < 8; i++) {
  await n.js(`document.querySelectorAll('.mini-pag')[${i}].click()`);
  await n.ate(`document.getElementById('tela').dataset.pagina === '${i + 1}'`, 'ver a página ' + (i + 1));
}
await n.clicar('revisei');
// "Salvar como" (substituto da caixa do sistema): cancelar não grava nada e mantém o andamento
await n.js(`window.showSaveFilePicker = async () => { throw new DOMException('cancelado', 'AbortError'); }`);
await n.clicar('btSalvar');
await n.ate(`/Salvamento cancelado/.test(document.getElementById('aviso').textContent)`, 'aviso de cancelado');
assert.ok(await guardado(n), 'cancelar o Salvar como mantém o andamento');
// escolher o lugar: o PDF inteiro vai para ele, com o nome sugerido
await n.js(`window.__salvo = null; window.showSaveFilePicker = async (o) => { window.__sugerido = o.suggestedName;
  const partes = []; return { name: 'escolhido.pdf', createWritable: async () => ({
    write: async (b) => partes.push(b), close: async () => { window.__salvo = new Blob(partes); } }) }; }`);
await n.clicar('btSalvar');
await n.ate(`!!window.__salvo`, 'gravar no lugar escolhido', 120000);
assert.equal(await n.js('window.__sugerido'), 'Contrato de Fulano de Teste-tarjado.pdf', 'nome sugerido na caixa');
assert.equal(await n.js(`window.__salvo.slice(0, 5).text()`), '%PDF-', 'o lugar escolhido recebeu um PDF');
assert.ok(await n.js('window.__salvo.size') > 10000, 'PDF inteiro');
await n.ate(`/salvo como escolhido\.pdf/.test(document.getElementById('aviso').textContent)`, 'aviso com o nome escolhido');
await n.ate(`!document.body.classList.contains('ocupado')`, 'terminar de salvar', 120000);
await n.ate(`${LER}.then((t) => t === '')`, 'salvar apagar o andamento', 5000);
await n.matar();

// Descartar apaga; desligar a opção também
n = await abrir();
assert.equal(await ofertaAusente(n), '', 'depois de salvo, nada a oferecer');
await n.arrastar(0.2, 0.2, 0.4, 0.3);
await esperarGravar(n, 1);
await n.matar();
n = await abrir();
assert.equal(marcasNaOferta(await ofertaEsperada(n)), 1, 'oferta da tarja nova');
await n.clicar('btDescartarAndamento');
await n.ate(`${LER}.then((t) => t === '')`, 'Descartar apagar', 5000);
await n.arrastar(0.2, 0.2, 0.4, 0.3);
await esperarGravar(n, 1);
await n.js(`(() => { const c = document.getElementById('guardarAndamento'); c.click(); })()`);
await n.ate(`${LER}.then((t) => t === '')`, 'desligar a opção apagar', 5000);
await n.arrastar(0.5, 0.5, 0.6, 0.6);
await espera(1800);
assert.equal(await guardado(n), '', 'com a opção desligada nada é guardado');

// computador dividido: "Apagar tudo" tira escolhas, lista guardada e andamento, e o que está aberto continua
await n.js(`document.getElementById('guardarAndamento').click()`);
await n.arrastar(0.6, 0.6, 0.7, 0.7);
await n.ate(`${LER}.then((t) => !!t)`, 'gravar de novo', 5000);
await n.js(`(() => { const t = document.getElementById('termos'); t.value = 'Fulano de Teste'; t.dispatchEvent(new Event('input')); })()`);
n.responder(true);
await n.clicar('termoGuardar');
await n.ate(`!!localStorage.getItem('tarja-livre.termos') && !!localStorage.getItem('tarja-livre.preferencias')`, 'lista e escolhas guardadas', 5000);
n.responder(false);
await n.clicar('btApagarTudo');
assert.ok(await n.js(`!!localStorage.getItem('tarja-livre.termos')`), 'Cancelar não apaga nada');
n.responder(true);
await n.clicar('btApagarTudo');
await n.ate(`${LER}.then((t) => t === '' && !localStorage.getItem('tarja-livre.termos') && !localStorage.getItem('tarja-livre.preferencias'))`,
  'Apagar tudo', 5000);
assert.equal(await n.js(`document.getElementById('termoGuardar').checked`), false, 'Guardar a lista desmarcado');
assert.equal(await n.js(`document.getElementById('tela').dataset.pagina`), '1', 'o PDF aberto continua na tela');
const erros = n.erros.filter((e) => !e.startsWith('janela inesperada'));
assert.deepEqual(erros, [], 'console limpo');
await n.fechar();
rmSync(perfilFixo, { recursive: true, force: true });
console.log(`andamento: tudo certo (${VEZES - 1} quedas no meio do trabalho e 1 no salvamento, marcas de volta a cada vez, sem texto guardado, salvar/descartar/desligar apagam, Apagar tudo limpa o computador)`);
