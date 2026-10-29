// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Teste padronizado com o PDF de teste (tests/fixtures/tarja-teste.pdf, gerado por gerar_pdf_teste.py) e com
// arquivos hostis. Prova três coisas: a procura acha o que deve; depois de aceitar as sugestões, todo pixel de dado
// pessoal (desenhado sozinho no PDF máscara, no mesmo lugar) está preto no PDF salvo; e nada do original (texto,
// comentário, metadados, JavaScript) passa para o arquivo salvo. Uso: node tests/e2e_pdf_teste.mjs [pasta]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, montar, abrirNavegador } from './navegador.mjs';

const CAPTURAS = process.argv[2] || join(RAIZ, 'files', 'e2e-pdf-teste');
const FIX = join(RAIZ, 'tests', 'fixtures');
const ROTULOS = { termo: 'Termo da lista', cpf: 'CPF', cnpj: 'CNPJ', rg: 'RG', email: 'E-mail', telefone: 'Telefone', cep: 'CEP' };

montar();
const pdfTeste = readFileSync(join(FIX, 'tarja-teste.pdf'));
const pdfDados = readFileSync(join(FIX, 'tarja-teste-dados.pdf'));
const esperado = JSON.parse(readFileSync(join(FIX, 'tarja-teste.json'), 'utf8'));
const nav = await abrirNavegador(CAPTURAS);
const { js, ate, clicar, texto, erros } = nav;
const aviso = () => texto('aviso');

// passa por todas as páginas clicando nas miniaturas, esperando cada uma aparecer inteira
async function verTodas(n) {
  for (let i = 0; i < n; i++) {
    await js(`document.querySelectorAll('.mini-pag')[${i}].click()`);
    await ate(`document.getElementById('tela').dataset.pagina === '${i + 1}'`, 'ver a página ' + (i + 1));
  }
  await ate(`document.getElementById('infoVistas').textContent === '${n} de ${n}'`, 'todas vistas');
}

async function conferirESalvar(nome) {
  await clicar('revisei');
  await clicar('btSalvar');
  return nav.esperarDownload(nome, 90000);
}

let ok = false;
try {
  await nav.abrirPrograma();

  // ---- 1. arquivos hostis: o programa recusa com aviso e continua funcionando ----
  await nav.enviarArquivo(Buffer.from('isto não é um PDF, só texto com a extensão trocada'), 'falso.pdf');
  await ate(`/não parece ser um PDF/.test(document.getElementById('aviso').textContent)`, 'recusar arquivo que não é PDF');

  const comSenha = await js(`(() => {
    const d = new jspdf.jsPDF({ encryption: { userPassword: 'senha-de-teste', ownerPassword: 'dono', userPermissions: ['print'] } });
    d.text('documento com senha', 40, 40);
    const u = new Uint8Array(d.output('arraybuffer')); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s);
  })()`);
  await nav.enviarArquivo(Buffer.from(comSenha, 'base64'), 'senha.pdf');
  await ate(`/protegido por senha/.test(document.getElementById('aviso').textContent)`, 'recusar PDF com senha');

  await nav.enviarArquivo(pdfTeste.subarray(0, 900), 'cortado.pdf');
  await ate(`/não foi possível abrir|com defeito/i.test(document.getElementById('aviso').textContent) || document.getElementById('infoPaginas').textContent !== '-'`, 'PDF cortado: aviso ou abre o que der');
  assert.equal(await js(`document.getElementById('btSalvar').disabled`), true, 'nada para salvar depois de arquivo ruim');

  // página maior que o máximo do PDF salvo (14.400 pt, 5,08 m): era aceita e saía cortada, dizendo que deu certo
  // (auditoria de 29/10/2026). Tem de ser recusada ao abrir. Mesmo tamanho de texto: 10000 vira 20000.
  const larga = await js(`(() => {
    const d = new jspdf.jsPDF({ unit: 'pt', format: [10000, 1000], orientation: 'l' });
    d.text('CPF 831.975.872-60', 100, 100);
    const s = d.output().replace('/MediaBox [0 0 10000. ', '/MediaBox [0 0 20000. ');
    if (!s.includes('/MediaBox [0 0 20000. ')) throw new Error('não achou a MediaBox para trocar: ' + (() => { const o = d.output(); const i = o.indexOf('/MediaBox'); return o.slice(i, i + 40); })());
    return btoa(s);
  })()`);
  await nav.enviarArquivo(Buffer.from(larga, 'base64'), 'larga.pdf');
  await ate(`/maior que o Tarja consegue salvar/.test(document.getElementById('aviso').textContent)`, 'recusar página de 20.000 pt');
  assert.equal(await js(`document.getElementById('btSalvar').disabled`), true, 'nada para salvar depois da página larga demais');

  // página enorme (200 x 200 polegadas): sai com resolução menor, mas sai inteira e no tamanho certo
  const enorme = await js(`(() => {
    const d = new jspdf.jsPDF({ unit: 'pt', format: [14400, 14400] });
    d.setFontSize(400); d.text('CPF 831.975.872-60', 1000, 3000);
    const u = new Uint8Array(d.output('arraybuffer')); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s);
  })()`);
  await nav.enviarArquivo(Buffer.from(enorme, 'base64'), 'enorme.pdf');
  await ate(`document.getElementById('infoPaginas').textContent === '1'`, 'abrir página enorme');
  await clicar('btProcurar');
  await ate(`/1 pendente/.test(document.getElementById('resumoAchados').textContent)`, 'achar o CPF na página enorme');
  await clicar('btAceitarTodas');
  await verTodas(1);
  const saidaEnorme = await conferirESalvar('enorme-tarjado.pdf');
  const exameEnorme = await js(`(async () => {
    const s = atob('${saidaEnorme.toString('base64')}'); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    const d = await pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise;
    const v = (await d.getPage(1)).getViewport({ scale: 1 });
    const folha = (await (await d.getPage(2)).getTextContent()).items.map((x) => x.str).join(' ');
    return { w: Math.round(v.width), h: Math.round(v.height), folha };
  })()`);
  assert.deepEqual([exameEnorme.w, exameEnorme.h], [14400, 14400], 'página enorme no tamanho original');
  assert.match(exameEnorme.folha, /páginas muito grandes com até \d+ ppp/, 'folha avisa da resolução menor');
  assert.ok(!saidaEnorme.includes(Buffer.from('831.975')), 'CPF fora dos bytes do PDF enorme');

  // ---- 2. o PDF de teste padronizado ----
  erros.length = 0;  // os avisos dos arquivos ruins acima eram esperados
  await nav.enviarArquivo(pdfTeste, 'tarja-teste.pdf');
  await ate(`document.getElementById('infoPaginas').textContent === '${esperado.paginas}'`, 'abrir o PDF de teste');
  assert.equal(await texto('infoHash'), createHash('sha256').update(pdfTeste).digest('hex'), 'SHA-256 do original');

  // lista de nomes digitada pelo usuário (não fica gravada: "Guardar" desmarcado)
  await js(`(() => { const t = document.getElementById('termos'); t.value = ${JSON.stringify(esperado.termos.join('\n'))};
    t.dispatchEvent(new Event('input')); })()`);
  assert.equal(await js(`localStorage.getItem('tarja-livre.termos')`), null, 'lista de termos não gravada sem pedir');
  await clicar('btProcurar');
  await ate(`/pendente/.test(document.getElementById('resumoAchados').textContent)`, 'procura terminar');
  const resumo = await texto('resumoAchados');
  assert.ok(/sem texto/.test(await aviso()), 'aviso de página sem texto');
  const achados = Object.fromEntries(Object.entries(ROTULOS).map(([k, r]) => [k, +(resumo.match(new RegExp(r + ' (\\d+)'))?.[1] || 0)]));
  assert.deepEqual(achados, esperado.sugestoes, 'sugestões por tipo: ' + resumo);
  await js(`document.querySelectorAll('.mini-pag')[0].click()`);
  await ate(`document.getElementById('tela').dataset.pagina === '1'`, 'página 1');
  await nav.captura('1-sugestoes.png');

  await clicar('btAceitarTodas');
  await ate(`document.getElementById('resumoAchados').textContent === 'Nenhuma sugestão pendente.'`, 'aceitar todas');
  await verTodas(esperado.paginas);
  const saida = await conferirESalvar('tarja-teste-tarjado.pdf');
  writeFileSync(join(CAPTURAS, 'tarja-teste-tarjado.pdf'), saida);

  // compara, página a página, o PDF salvo com a máscara: pixel escuro na máscara = dado; tem que estar preto
  const exame = await js(`(async () => {
    const abrir = async (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      return pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise; };
    const salvo = await abrir('${saida.toString('base64')}');
    const mascara = await abrir('${pdfDados.toString('base64')}');
    const desenhar = async (d, n, escala) => { const p = await d.getPage(n); const v = p.getViewport({ scale: escala });
      const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await p.render({ canvasContext: ctx, viewport: v, intent: 'print' }).promise; return { c, ctx, v }; };
    const paginas = []; const vistas = [];
    for (let n = 1; n <= salvo.numPages; n++) {
      const p = await salvo.getPage(n); const v = p.getViewport({ scale: 1 });
      const t = await p.getTextContent();
      paginas.push({ w: Math.round(v.width), h: Math.round(v.height), texto: t.items.map((x) => x.str).join(' ') });
    }
    const descobertos = [];
    for (let n = 1; n <= mascara.numPages; n++) {
      const m = await desenhar(mascara, n, 2); const o = await desenhar(salvo, n, 2);
      const W = Math.min(m.c.width, o.c.width), H = Math.min(m.c.height, o.c.height);
      const dm = m.ctx.getImageData(0, 0, W, H).data, dsv = o.ctx.getImageData(0, 0, W, H).data;
      let falhas = 0, exemplo = null;
      for (let k = 0; k < dm.length; k += 4) {
        if (dm[k] + dm[k + 1] + dm[k + 2] < 300 && dsv[k] + dsv[k + 1] + dsv[k + 2] > 150) {
          falhas++; if (!exemplo) { const q = k / 4; exemplo = [q % W, Math.floor(q / W)]; }
        }
      }
      if (falhas) descobertos.push({ pagina: n, pixels: falhas, primeiro: exemplo });
      if (n === 1 || falhas) vistas.push([n, o.c.toDataURL('image/png').split(',')[1]]);
    }
    const meta = await salvo.getMetadata();
    return { paginas, descobertos, vistas, info: JSON.stringify(meta.info) };
  })()`);
  for (const [n, b64] of exame.vistas) writeFileSync(join(CAPTURAS, `salvo-pagina-${n}.png`), Buffer.from(b64, 'base64'));
  assert.deepEqual(exame.descobertos, [], 'todo pixel de dado pessoal coberto no PDF salvo');
  assert.equal(exame.paginas.length, esperado.paginas + 1, 'páginas do original e a folha de conferência');
  assert.deepEqual(exame.paginas.slice(0, esperado.paginas).map((p) => [p.w, p.h]), esperado.tamanhos, 'tamanho de cada página');
  for (const p of exame.paginas.slice(0, esperado.paginas)) assert.equal(p.texto.trim(), '', 'página refeita como imagem');
  for (const proibido of esperado.proibidos) {
    assert.ok(!saida.includes(Buffer.from(proibido, 'latin1')), 'bytes do PDF salvo sem: ' + proibido);
    assert.ok(!exame.paginas.at(-1).texto.includes(proibido), 'folha sem: ' + proibido);
    assert.ok(!exame.info.includes(proibido), 'metadados sem: ' + proibido);
  }
  // o jsPDF escreve "/OpenAction [página /FitH null]" (só o zoom ao abrir); ação de verdade é um dicionário
  const bruto = saida.toString('latin1');
  for (const re of [/\/JavaScript/, /\/JS\b/, /\/Launch/, /\/URI/, /\/OpenAction\s*<</, /\/AcroForm/, /\/Annots/, /\/EmbeddedFile/]) {
    assert.ok(!re.test(bruto), 'PDF salvo sem ' + re.source);
  }

  assert.deepEqual(await js('window.__csp'), [], 'nenhuma violação da política de segurança');
  assert.deepEqual(erros, [], 'console sem erro nem aviso com o PDF de teste');
  ok = true;
  console.log(`pdf de teste: tudo certo (arquivos hostis recusados, página enorme, ${esperado.total} sugestões, cobertura pixel a pixel em ${esperado.paginas} páginas, nada do original no salvo)`);
  console.log('capturas em ' + CAPTURAS);
} catch (e) {
  console.error('pdf de teste FALHOU:', e.message);
  if (erros.length) console.error('console do navegador:\n  ' + erros.join('\n  '));
} finally {
  await nav.fechar();
  process.exit(ok ? 0 : 1);
}
