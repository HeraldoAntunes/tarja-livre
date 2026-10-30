// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
//
// Interface: abrir o PDF, tarjar, sugerir, carimbar, conferir e salvar. Tudo o que fica guardado (tarjas, carimbo,
// sugestões) está em pontos do PDF, com origem no canto de cima da página; a tela só converte na hora de desenhar,
// então ampliar ou mudar de monitor não desalinha nada.
import { VERSAO } from './versao.js';
import { TIPOS, NOMES, DESMARCADOS, procurar, coberta, prepararTermos, corrigirOcr, selecionar, MAX_TERMOS, MAX_LETRAS_TERMO } from './achados.js';

const pdfjsLib = globalThis.pdfjsLib;
const { jsPDF } = globalThis.jspdf;

const DPI_SAIDA = 150;
const MAX_PAGINAS = 1000;
const PAGINAS_MUITAS = 150;   // acima disto, o salvar avisa que vai demorar
// Tela, miniatura e PDF salvo desenham igual, com campos e anotações: o que se confere é o que sai. Tudo no modo
// de impressão: (1) o modo de tela do PDF.js espera o requestAnimationFrame, que para em aba escondida e depois
// de canvas muito grande, e a página nunca terminava de aparecer; (2) se só o PDF salvo usasse impressão, uma
// anotação escondida na tela mas marcada para imprimir sairia no arquivo sem ter sido vista.
const OPCOES_DESENHO = { annotationMode: pdfjsLib.AnnotationMode.ENABLE, intent: 'print' };
const ANOT_ESCONDIDA = 2;
const ANOT_IMPRIMIR = 4;
// limites de canvas que os navegadores aguentam com folga; página maior sai com menos pontos por polegada
const MAX_LADO_PX = 12000;
const MAX_LADO_PT = 14400;  // maior lado de página que o PDF salvo aceita
const MAX_AREA_PX = 36e6;  // folha A0 ainda sai a 150 ppp
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const TEXTO_CARIMBO = 'Documento com dados pessoais tarjados\nconforme a LGPD (Lei nº 13.709/2018)';
const COR_CARIMBO = '#1e3a8a';

const $ = (id) => document.getElementById(id);
const el = {
  entrada: $('entrada'), btAbrir: $('btAbrir'), btFechar: $('btFechar'), btSobre: $('btSobre'),
  nomeArquivo: $('nomeArquivo'), miniaturas: $('miniaturas'), palco: $('palco'), vazio: $('vazio'), tela: $('tela'),
  btPaginaInteira: $('btPaginaInteira'),
  btDesfazer: $('btDesfazer'), btRefazer: $('btRefazer'), btMenos: $('btMenos'), btMais: $('btMais'),
  zoomTexto: $('zoomTexto'), btAnterior: $('btAnterior'), btProxima: $('btProxima'), paginaTexto: $('paginaTexto'),
  infoPaginas: $('infoPaginas'), infoHash: $('infoHash'), btCopiarHash: $('btCopiarHash'),
  tipos: $('tipos'), btProcurar: $('btProcurar'), resumoAchados: $('resumoAchados'),
  btAceitarPagina: $('btAceitarPagina'), btAceitarTodas: $('btAceitarTodas'), btDescartar: $('btDescartar'),
  carAtivo: $('carAtivo'), carTexto: $('carTexto'), carTodas: $('carTodas'), carUma: $('carUma'),
  carHash: $('carHash'), carData: $('carData'), carDica: $('carDica'),
  formato: $('formato'), folha: $('folha'), infoVistas: $('infoVistas'), barraVistas: $('barraVistas'),
  revisei: $('revisei'), dicaRevisei: $('dicaRevisei'), btSalvar: $('btSalvar'), progresso: $('progresso'),
  barraProgresso: $('barraProgresso'), rotuloHashSaida: $('rotuloHashSaida'), infoHashSaida: $('infoHashSaida'),
  aviso: $('aviso'), sobre: $('sobre'), sobreVersao: $('sobreVersao'), mostrarAvisos: $('mostrarAvisos'),
  infoConferido: $('infoConferido'), opOcr: $('opOcr'), ocrLigado: $('ocrLigado'), rotuloTarja: $('rotuloTarja'), listaSugestoes: $('listaSugestoes'), btAceitarMarcadas: $('btAceitarMarcadas'),
  abas: $('abas'), btProcurarTodos: $('btProcurarTodos'), btProximo: $('btProximo'),
  andamento: $('andamento'), andamentoTexto: $('andamentoTexto'), btRecuperar: $('btRecuperar'),
  btDescartarAndamento: $('btDescartarAndamento'), guardarAndamento: $('guardarAndamento'), btApagarTudo: $('btApagarTudo'),
  termos: $('termos'), infoTermos: $('infoTermos'), btImportarTermos: $('btImportarTermos'), btLimparTermos: $('btLimparTermos'),
  entradaTermos: $('entradaTermos'), termoInteira: $('termoInteira'), termoAcento: $('termoAcento'), termoGuardar: $('termoGuardar'),
};

// ---------- preferências (só do programa, nunca do documento) ----------
const PREF = 'tarja-livre.preferencias';
function lerPref() {
  try { return JSON.parse(localStorage.getItem(PREF)) || {}; } catch (e) { return {}; }
}
function gravarPref() {
  const p = { formato: el.formato.value, folha: el.folha.checked, avisos: el.mostrarAvisos.checked,
              andamento: el.guardarAndamento.checked, tipos: tiposMarcados(), tiposVistos: Object.keys(TIPOS) };
  try { localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) { console.warn('preferências não gravadas', e); }
}

// ---------- andamento (recuperar as tarjas se o programa fechar de repente) ----------
// Guarda só a geometria das marcas (tarjas e traços) e as páginas vistas, pela impressão digital (SHA-256) do PDF
// original. Nada do PDF, do nome do arquivo nem do texto achado. Some ao salvar, ao fechar o arquivo, ao descartar,
// ao desligar a opção e depois de 7 dias. Vai no IndexedDB com escrita confirmada no disco: o localStorage fica
// segundos só na memória e uma queda nesse intervalo o perde (medido no Edge e no WebView2).
const ANDAMENTO_DIAS = 7;
let tempoAndamento = null;
let bancoAndamento = null;
let filaAndamento = Promise.resolve();

// a abertura que falhou não fica guardada: a próxima gravação tenta abrir de novo (auditoria TL-X06)
function banco() {
  bancoAndamento = bancoAndamento || new Promise((ok, falha) => {
    const q = indexedDB.open('tarja-livre', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('andamento');
    q.onsuccess = () => {
      // fechado por fora (o navegador limpou os dados do site): a próxima vez abre de novo
      q.result.onclose = () => { bancoAndamento = null; };
      ok(q.result);
    };
    q.onerror = () => falha(q.error);
  }).catch((e) => {
    bancoAndamento = null;
    throw e;
  });
  return bancoAndamento;
}
// uma operação no depósito do andamento, só terminando depois de gravada no disco
async function noAndamento(modo, f) {
  const db = await banco();
  return new Promise((ok, falha) => {
    const t = db.transaction('andamento', modo, { durability: 'strict' });
    let r;
    f(t.objectStore('andamento'), (v) => { r = v; });
    t.oncomplete = () => ok(r);
    t.onerror = () => falha(t.error);
    t.onabort = () => falha(t.error);
  });
}
// as gravações e remoções andam em fila, na ordem em que foram pedidas; cada uma devolve true se deu certo e false
// se falhou (a falha não para a fila)
function naFila(f) {
  const vez = filaAndamento.then(f, f).then(() => true, (e) => { console.warn('andamento não gravado', e); return false; });
  filaAndamento = vez;
  return vez;
}
// só os campos de desenho, escolhidos um a um: nenhum texto passa daqui
function marcaSoGeometria(m) {
  if (m.tipo === 'caneta') return { tipo: 'caneta', cor: m.cor, largura: m.largura, pontos: m.pontos.map(([x, y]) => [x, y]) };
  return { tipo: 'tarja', cor: m.cor, x: m.x, y: m.y, w: m.w, h: m.h };
}
// Grava 1 s depois da última mudança, mas nunca mais de 2 s depois da primeira mudança ainda não gravada: quem
// edita sem parar também tem o andamento guardado (auditoria de 29/10/2026, rodada 2).
const PRAZO_ANDAMENTO = 2000;
let andamentoDesde = 0;
let avisouFalhaAndamento = false;
function agendarAndamento() {
  if (!el.guardarAndamento.checked) return;
  if (!tempoAndamento) andamentoDesde = Date.now();
  clearTimeout(tempoAndamento);
  tempoAndamento = setTimeout(gravarAndamento, Math.max(0, Math.min(1000, PRAZO_ANDAMENTO - (Date.now() - andamentoDesde))));
}
function gravarAndamento() {
  clearTimeout(tempoAndamento);
  tempoAndamento = null;
  if (!el.guardarAndamento.checked) return filaAndamento;
  const fotos = docs.map((d) => [d.hash, d.andamentoPendente ? null
    : d.salvo || !d.paginas.some((p) => p.marcas.length) ? 'apagar'
      : { quando: Date.now(), paginas: d.paginas.map((p) => ({ vista: p.vista, marcas: p.marcas.map(marcaSoGeometria) })) }]);
  return naFila(() => noAndamento('readwrite', (s) => {
    for (const [hash, foto] of fotos) {
      // enquanto a pessoa não respondeu à oferta, as marcas de antes ficam como estão
      if (foto === 'apagar') s.delete(hash);
      else if (foto) s.put(foto, hash);
    }
  })).then((ok) => {
    // falha ao gravar avisa uma vez (até voltar a dar certo): sem isso, a pessoa conta com uma recuperação que não há
    if (!ok && !avisouFalhaAndamento) {
      avisouFalhaAndamento = true;
      avisar('O andamento não pôde ser guardado neste computador: se o programa fechar de repente, as tarjas não ' +
        'voltam. Salve o PDF assim que puder.', true);
    }
    if (ok) avisouFalhaAndamento = false;
    return ok;
  });
}
function esquecerAndamento(hash) {
  return naFila(() => noAndamento('readwrite', (s) => s.delete(hash)));
}
function apagarTodoAndamento() {
  clearTimeout(tempoAndamento);
  tempoAndamento = null;
  return naFila(() => noAndamento('readwrite', (s) => s.clear()));
}
function limparAndamentoVelho() {
  const limite = Date.now() - ANDAMENTO_DIAS * 24 * 3600 * 1000;
  return naFila(() => noAndamento('readwrite', (s) => {
    s.openCursor().onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return;
      if (!(c.value?.quando > limite)) c.delete();
      c.continue();
    };
  }));
}
// O andamento guardado só é oferecido se servir para este arquivo (mesmo SHA-256 e mesmo número de páginas) e
// tiver só geometria válida: números finitos e dentro do razoável, cores no formato do programa. Entrada estragada
// (marcas: null, número que não é número) é descartada, com aviso no console, sem mexer no trabalho da tela
// (auditoria TL-X05).
function andamentoValido(a, d) {
  const num = (x) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 1e6;
  const cor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  const marca = (m) => !!m && typeof m === 'object' && (m.tipo === 'tarja'
    ? [m.x, m.y, m.w, m.h].every(num) && cor(m.cor)
    : m.tipo === 'caneta' && num(m.largura) && m.largura > 0 && cor(m.cor) && Array.isArray(m.pontos) &&
      m.pontos.length > 0 && m.pontos.every((pt) => Array.isArray(pt) && num(pt[0]) && num(pt[1])));
  return !!a && typeof a === 'object' && typeof a.quando === 'number' && Number.isFinite(a.quando) && Array.isArray(a.paginas) &&
    a.paginas.length === d.paginas.length &&
    a.paginas.every((p) => !!p && typeof p === 'object' && Array.isArray(p.marcas) && p.marcas.every(marca));
}
async function andamentoDe(d) {
  await filaAndamento;
  const a = await noAndamento('readonly', (s, guardar) => { s.get(d.hash).onsuccess = (e) => guardar(e.target.result); })
    .catch(() => null);
  if (!a) return null;
  if (andamentoValido(a, d)) return a;
  console.warn('andamento guardado estragado ou de outra versão do arquivo: descartado');
  esquecerAndamento(d.hash);
  return null;
}
async function mostrarAndamento() {
  const d = doc;
  const oferecer = d && (d.andamentoPendente || (!d.andamentoVisto && !d.paginas.some((p) => p.marcas.length)));
  const a = oferecer ? await andamentoDe(d) : null;
  if (d !== doc) return;
  el.andamento.hidden = !a;
  if (!a) return;
  d.andamentoPendente = true;
  d.andamentoGuardado = a;
  const n = a.paginas.reduce((s, p) => s + p.marcas.length, 0);
  const quando = new Date(a.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  el.andamentoTexto.textContent = `Este arquivo tem ${n} marca(s) de antes (${quando}), que não chegaram a ser salvas.`;
}
function recuperarAndamento() {
  const a = doc && doc.andamentoGuardado;
  doc.andamentoVisto = true;
  doc.andamentoPendente = false;
  doc.andamentoGuardado = null;
  el.andamento.hidden = true;
  if (!a) return;
  a.paginas.forEach((p, i) => { if (p.vista) doc.paginas[i].vista = true; });
  registrar(a.paginas.map((p, i) => ({ pagina: i, antes: doc.paginas[i].marcas.slice(), depois: [...doc.paginas[i].marcas, ...p.marcas.map(marcaSoGeometria)] }))
    .filter((m) => m.depois.length > m.antes.length));
  montarMiniaturas();
  avisar('Marcas de antes recuperadas. Confira as páginas antes de salvar.');
}
function descartarAndamento() {
  doc.andamentoVisto = true;
  doc.andamentoPendente = false;
  doc.andamentoGuardado = null;
  el.andamento.hidden = true;
  esquecerAndamento(doc.hash);
  avisar('Marcas de antes descartadas.');
}

// ---------- estado ----------
// Vários arquivos abertos, um na tela (doc). Cada um guarda:
//   { nome, hash, pdf, paginas: [{ w, h, vista, marcas, sugestoes, semTexto }],
//     procurou (tipos da última procura), aceitas, salvo, revisado, hashSaida,
//     e, enquanto está fora da tela, atual, zoom, historico, refazer e carimboPagina }
// O que só vale para o arquivo na tela fica nas variáveis abaixo e vai para o arquivo na troca de aba.
const MAX_ARQUIVOS = 20;
const docs = [];
let doc = null;
let atual = 0;
let zoom = 1;
let ferramenta = 'tarja';
let cor = '#000000';
let espessura = 9;
let historico = [];      // [{ mudancas: [{ pagina, antes, depois }] }]
let refazer = [];
let procurando = false;
let rotuloTarja = '';      // texto opcional dentro das tarjas (vale para todos os arquivos)
let destaque = null;     // sugestão destacada na tela, escolhida na lista de revisão
let trabalhadorPdf = null;  // worker do PDF.js comum a todos os documentos (ver o fim do arquivo)
let menorDpi = DPI_SAIDA;  // resolução mais baixa usada no último salvamento (página enorme é reduzida)
let geracao = 0;         // invalida desenhos antigos quando o documento muda
const carimbo = { ativo: false, texto: TEXTO_CARIMBO, todas: true, pagina: 0, comHash: true, comData: true,
                  fx: 0.06, fy: 0.86 };

const base = { pagina: -1, escala: 0, canvas: null };  // página já desenhada pelo PDF.js na escala da tela
let tarefaRender = null;

// ---------- avisos ----------
let tempoAviso = 0;
function avisar(texto, forcar = false) {
  if (!el.mostrarAvisos.checked && !forcar) return;
  el.aviso.textContent = texto;
  el.aviso.classList.add('visivel');
  clearTimeout(tempoAviso);
  tempoAviso = setTimeout(() => el.aviso.classList.remove('visivel'), 4200);
}

// enquanto salva, nada muda as tarjas nem troca o documento (o PDF tem que sair igual ao que foi conferido)
const ocupado = () => document.body.classList.contains('ocupado');

// ---------- abrir ----------
async function sha256(bytes) {
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function ehPdf(bytes) {
  // "%PDF-" pode vir depois de algum lixo no começo; o PDF.js aceita até 1 KB
  const inicio = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  return inicio.includes('%PDF-');
}

// Lê um arquivo e devolve o documento pronto (ainda fora da lista), ou null com o motivo já avisado.
async function carregarArquivo(arquivo) {
  let bytes;
  try {
    bytes = new Uint8Array(await arquivo.arrayBuffer());
  } catch (e) {
    console.warn('falha ao ler o arquivo', e);
    avisar('Não foi possível ler ' + arquivo.name + '.', true);
    return null;
  }
  if (!ehPdf(bytes)) {
    avisar(arquivo.name + ': este arquivo não parece ser um PDF.', true);
    return null;
  }
  const hash = await sha256(bytes);
  const repetido = docs.find((d) => d.hash === hash);
  if (repetido) {
    avisar(arquivo.name + ' já está aberto (mesmo conteúdo de ' + repetido.nome + ').', true);
    return repetido;
  }
  let pdf;
  try {
    // o PDF.js fica com os bytes (transfere para o worker), então passa uma cópia
    pdf = await pdfjsLib.getDocument({
      data: bytes.slice(), worker: trabalhadorPdf, isEvalSupported: false, enableXfa: false, useSystemFonts: true,
      disableAutoFetch: true, disableStream: true, stopAtErrors: false,
    }).promise;
  } catch (e) {
    console.warn('PDF.js recusou o arquivo', e);
    const senha = e && e.name === 'PasswordException';
    avisar(arquivo.name + (senha ? ': PDF protegido por senha, tire a senha antes de tarjar.' : ': não foi possível abrir este PDF.'), true);
    return null;
  }
  if (pdf.numPages > MAX_PAGINAS) {
    pdf.destroy();
    avisar(`${arquivo.name}: PDF com ${pdf.numPages} páginas, o limite é ${MAX_PAGINAS}. Divida o arquivo antes de tarjar.`, true);
    return null;
  }
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    let v = null;
    try {
      v = (await pdf.getPage(i)).getViewport({ scale: 1 });
    } catch (e) {
      console.warn('página com defeito', i, e);
    }
    // página que não abre ou com tamanho absurdo sairia em branco ou travaria o navegador: recusa o arquivo todo
    if (!v || !(v.width > 0 && v.height > 0 && v.width < 200000 && v.height < 200000)) {
      pdf.destroy();
      avisar(`${arquivo.name}: a página ${i} está com defeito; o arquivo não foi aberto.`, true);
      return null;
    }
    // o PDF salvo não passa de 14.400 pt de lado (5,08 m; limite do formato e da biblioteca): página maior sairia
    // cortada, então o arquivo é recusado ao abrir (auditoria de 29/10/2026)
    if (Math.max(v.width, v.height) > MAX_LADO_PT + 0.5) {
      pdf.destroy();
      const cm = (pt) => Math.round(pt / 72 * 2.54);
      avisar(`${arquivo.name}: a página ${i} mede ${cm(v.width)} × ${cm(v.height)} cm, maior que o Tarja consegue salvar `
        + `(${cm(MAX_LADO_PT)} cm de lado); o arquivo não foi aberto.`, true);
      return null;
    }
    paginas.push({ w: v.width, h: v.height, vista: false, marcas: [], sugestoes: [], semTexto: false });
  }
  return {
    nome: arquivo.name || 'documento.pdf', hash, pdf, paginas, procurou: null, aceitas: 0, salvo: true,
    revisado: false, hashSaida: '', atual: 0, zoom: 1, historico: [], refazer: [], carimboPagina: 0,
  };
}

// Abre um ou vários arquivos, cada um na sua aba; o primeiro que abrir vai para a tela. Pedido durante um salvamento
// não abre; o que já estava pedido antes termina de ler e entra numa aba, sem ir para a tela no meio do salvamento.
// Duas aberturas ao mesmo tempo (o botão e arrastar, por exemplo) abriam o mesmo PDF em duas abas ou passavam do
// limite de arquivos (auditoria TL-X08 e TL-X09): a leitura, que demora, corre solta, mas a entrada na lista é
// conferida de novo logo antes de entrar, sem espera no meio.
async function abrirArquivos(lista) {
  if (ocupado()) return;
  let primeiro = null;
  const limite = () => avisar(`Limite de ${MAX_ARQUIVOS} arquivos abertos: salve e feche alguns antes de abrir mais.`, true);
  for (const arquivo of lista) {
    if (docs.length >= MAX_ARQUIVOS) {
      limite();
      break;
    }
    const novo = await carregarArquivo(arquivo);
    if (!novo) continue;
    if (!docs.includes(novo)) {
      // conferido de novo depois da leitura, que leva tempo: repetido ou acima do limite não entra
      const igual = docs.find((d) => d.hash === novo.hash);
      if (igual || docs.length >= MAX_ARQUIVOS) {
        novo.pdf.destroy();
        if (!igual) {
          limite();
          break;
        }
        primeiro = primeiro || igual;
        continue;
      }
      docs.push(novo);
    }
    primeiro = primeiro || novo;
    montarAbas();
  }
  if (primeiro) await ativar(primeiro);
  if (lista.length > 1 && docs.length > 1) avisar(`${docs.length} arquivos abertos: cada um é conferido e salvo na sua aba.`);
}

// guarda no arquivo da tela o que só vale para ele
function guardarEstado() {
  if (!doc) return;
  Object.assign(doc, { atual, zoom, historico, refazer, carimboPagina: carimbo.pagina, revisado: el.revisei.checked });
}

// Põe um arquivo na tela, trazendo de volta a página, o zoom, o histórico e a conferência dele.
async function ativar(d) {
  if (ocupado() || !d) return;
  if (d !== doc) {
    guardarEstado();
    doc = d;
    geracao++;
    ({ atual, zoom, historico, refazer } = d);
    carimbo.pagina = Math.min(d.carimboPagina, d.paginas.length - 1);
    base.pagina = -1;
    base.canvas = null;
    el.revisei.checked = d.revisado;
  }
  el.nomeArquivo.textContent = doc.nome;
  mostrarAndamento();
  document.title = doc.nome + ' - Tarja Livre';
  el.infoPaginas.textContent = String(doc.paginas.length);
  el.infoHash.textContent = doc.hash;
  el.vazio.hidden = true;
  el.tela.hidden = false;
  montarAbas();
  montarMiniaturas();
  await mostrar(atual);
}

function fechar(d = doc) {
  if (!d || ocupado()) return;
  const comTarjas = d.paginas.some((p) => p.marcas.length);
  if (!d.salvo && comTarjas && !confirm(`Há tarjas não salvas em ${d.nome}. Fechar mesmo assim?`)) return;
  const k = docs.indexOf(d);
  docs.splice(k, 1);
  d.pdf.destroy();
  // fechar o arquivo é escolher não guardar: as marcas de antes deixam de ser oferecidas
  esquecerAndamento(d.hash);
  if (d !== doc) {
    montarAbas();
    atualizar();
    return;
  }
  doc = null;
  geracao++;
  const vizinho = docs[Math.min(k, docs.length - 1)];
  if (vizinho) {
    ativar(vizinho);
    return;
  }
  historico = [];
  refazer = [];
  base.pagina = -1;
  base.canvas = null;
  el.miniaturas.replaceChildren();
  el.tela.hidden = true;
  el.vazio.hidden = false;
  el.nomeArquivo.textContent = 'tarjar dados pessoais em PDF, sem internet';
  document.title = 'Tarja Livre';
  el.infoPaginas.textContent = '-';
  el.infoHash.textContent = '-';
  el.resumoAchados.textContent = '';
  el.revisei.checked = false;
  montarAbas();
  atualizar();
}

// ---------- abas ----------
function situacao(d) {
  if (d.salvo && d.hashSaida) return ['salvo', 'salvo'];
  const revisado = d === doc ? el.revisei.checked : d.revisado;
  if (revisado) return ['conferido', 'conferido'];
  return [d.hashSaida ? 'mudou, salvar de novo' : 'a conferir', ''];
}

function montarAbas() {
  el.abas.hidden = docs.length === 0;
  el.abas.replaceChildren(...docs.map((d) => {
    const aba = document.createElement('div');
    aba.className = 'aba' + (d === doc ? ' ativa' : '');
    const nome = document.createElement('button');
    nome.type = 'button';
    nome.className = 'aba-nome';
    nome.setAttribute('role', 'tab');
    nome.setAttribute('aria-selected', String(d === doc));
    nome.title = d.nome;
    const txt = document.createElement('span');
    txt.className = 'txt';
    txt.textContent = d.nome;
    const [rotulo, classe] = situacao(d);
    const sit = document.createElement('span');
    sit.className = 'situacao ' + classe;
    sit.textContent = rotulo;
    nome.append(txt, sit);
    nome.addEventListener('click', () => ativar(d));
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'aba-fechar';
    x.title = 'Fechar ' + d.nome;
    x.setAttribute('aria-label', 'Fechar ' + d.nome);
    x.textContent = '×';
    x.addEventListener('click', () => fechar(d));
    aba.append(nome, x);
    return aba;
  }));
}

// ---------- miniaturas ----------
const ICONE_VISTO = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>';

function montarMiniaturas() {
  el.miniaturas.replaceChildren();
  const minha = geracao;
  doc.paginas.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mini-pag';
    b.dataset.pagina = String(i);
    b.title = 'Página ' + (i + 1);
    const c = document.createElement('canvas');
    // cabe numa caixa de 120 x 240: página muito comprida não vira uma miniatura gigante
    const s = Math.min(120 / p.w, 240 / p.h);
    c.width = Math.max(1, Math.round(p.w * s));
    c.height = Math.max(1, Math.round(p.h * s));
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(i + 1);
    b.append(c, num);
    b.addEventListener('click', () => mostrar(i));
    el.miniaturas.append(b);
  });
  // desenha uma de cada vez para não travar a janela em documento grande
  (async () => {
    for (let i = 0; i < doc.paginas.length && minha === geracao; i++) await redesenharMiniatura(i);
  })();
}

// Cada pedido desenha num canvas próprio e só copia para a miniatura se ainda for o pedido mais novo daquela
// página: duas mudanças seguidas não disputam o mesmo canvas.
const pedidoMiniatura = [];
async function redesenharMiniatura(i) {
  const botao = el.miniaturas.children[i];
  if (!botao || !doc) return;
  const c = botao.querySelector('canvas');
  const s = c.width / doc.paginas[i].w;
  const minha = geracao;
  const pedido = (pedidoMiniatura[i] = (pedidoMiniatura[i] || 0) + 1);
  const rascunho = document.createElement('canvas');
  rascunho.width = c.width;
  rascunho.height = c.height;
  const ctx = rascunho.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  try {
    const pg = await doc.pdf.getPage(i + 1);
    await pg.render({ ...OPCOES_DESENHO, canvasContext: ctx, viewport: pg.getViewport({ scale: s }) }).promise;
  } catch (e) {
    console.warn('miniatura não desenhada', i + 1, e);
    return;
  }
  if (minha !== geracao || pedido !== pedidoMiniatura[i]) return;
  desenharMarcas(ctx, i, s, false);
  c.getContext('2d').drawImage(rascunho, 0, 0);
}

function atualizarMiniaturas() {
  if (!doc) return;
  [...el.miniaturas.children].forEach((b, i) => {
    const p = doc.paginas[i];
    b.classList.toggle('atual', i === atual);
    b.classList.toggle('sugestoes', p.sugestoes.length > 0);
    let selo = b.querySelector('.selo');
    if (p.marcas.length) {
      if (!selo) { selo = document.createElement('span'); selo.className = 'selo'; b.append(selo); }
      selo.textContent = String(p.marcas.length);
      selo.title = p.marcas.length + ' tarja(s) ou traço(s)';
    } else if (selo) selo.remove();
    let visto = b.querySelector('.visto');
    if (p.vista && !visto) {
      visto = document.createElement('span');
      visto.className = 'visto';
      visto.title = 'Página já vista';
      visto.innerHTML = ICONE_VISTO;  // ícone fixo do programa, nada vindo do PDF
      b.append(visto);
    }
  });
  const ativo = el.miniaturas.children[atual];
  if (ativo) ativo.scrollIntoView({ block: 'nearest' });
}

// ---------- página grande ----------
function escalaTela() {
  const p = doc.paginas[atual];
  // 100% = a página inteira cabe no palco; para tarjar trecho pequeno, amplia-se
  const largura = Math.max(200, el.palco.clientWidth - 40);
  const altura = Math.max(200, el.palco.clientHeight - 40);
  return Math.min(largura / p.w, altura / p.h) * zoom;
}

async function mostrar(i) {
  if (!doc) return;
  atual = Math.max(0, Math.min(doc.paginas.length - 1, i));
  atualizar();
  // só conta como vista a página que chegou a aparecer inteira (passar depressa por ela não vale)
  const desenhada = await desenharBase();
  if (desenhada >= 0 && desenhada === atual) marcarVisto();
  atualizar();
}

// Com zoom, a página não cabe no palco: ela só conta como vista quando a área inteira dela, margens incluídas, já
// apareceu na tela, rolando (auditoria de 29/10/2026, rodadas 1 e 2). Cada trecho à vista fica guardado, em pontos da
// página, e a página conta como vista quando esses trechos juntos a cobrem (a mesma conta da cobertura das tarjas).
function marcarVisto() {
  if (!doc || base.pagina !== atual) return;
  const p = doc.paginas[atual];
  if (p.vista) return;
  const t = el.tela.getBoundingClientRect();
  const c = el.palco.getBoundingClientRect();
  if (t.width <= 0 || t.height <= 0) return;
  // a parte do palco onde a página aparece (sem as barras de rolagem)
  const vx0 = c.left + el.palco.clientLeft, vy0 = c.top + el.palco.clientTop;
  const vx1 = vx0 + el.palco.clientWidth, vy1 = vy0 + el.palco.clientHeight;
  const sx = p.w / t.width, sy = p.h / t.height;
  // 1 pixel de folga para o arredondamento da tela
  const x0 = Math.max(0, (Math.max(vx0, t.left) - t.left - 1) * sx), x1 = Math.min(p.w, (Math.min(vx1, t.right) - t.left + 1) * sx);
  const y0 = Math.max(0, (Math.max(vy0, t.top) - t.top - 1) * sy), y1 = Math.min(p.h, (Math.min(vy1, t.bottom) - t.top + 1) * sy);
  if (x1 <= x0 || y1 <= y0) return;
  const trecho = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  p.vistos = p.vistos || [];
  if (coberta(trecho, p.vistos)) return;
  p.vistos.push(trecho);
  if (coberta({ x: 0, y: 0, w: p.w, h: p.h }, p.vistos)) {
    p.vista = true;
    p.vistos = null;
    if (!doc.salvo) agendarAndamento();
    atualizar();
  }
}

// Escala (pixels por ponto) limitada para o canvas caber na memória do navegador: canvas grande demais sai em
// branco sem aviso em alguns navegadores.
function escalaSegura(p, s) {
  return Math.min(s, MAX_LADO_PX / Math.max(p.w, p.h), Math.sqrt(MAX_AREA_PX / (p.w * p.h)));
}

// Desenha a página atual e devolve o número dela, ou -1 se outro desenho tomou o lugar antes de terminar.
async function desenharBase() {
  const p = doc.paginas[atual];
  const s = escalaTela();
  const dpr = window.devicePixelRatio || 1;
  const px = escalaSegura(p, s * dpr);
  el.tela.style.width = Math.round(p.w * s) + 'px';
  el.tela.style.height = Math.round(p.h * s) + 'px';
  if (base.pagina === atual && base.escala === px && base.canvas) {
    desenharTela();
    return atual;
  }
  const esta = atual;
  if (tarefaRender) tarefaRender.cancel();
  const c = document.createElement('canvas');
  c.width = Math.round(p.w * px);
  c.height = Math.round(p.h * px);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  const minha = geracao;
  const pg = await doc.pdf.getPage(esta + 1);
  if (minha !== geracao || esta !== atual) return -1;
  const tarefa = pg.render({ ...OPCOES_DESENHO, canvasContext: ctx, viewport: pg.getViewport({ scale: px }) });
  tarefaRender = tarefa;
  try {
    await tarefa.promise;
  } catch (e) {
    if (e && e.name === 'RenderingCancelledException') return -1;
    console.warn('página não desenhada', e);
    return -1;
  } finally {
    if (tarefaRender === tarefa) tarefaRender = null;
  }
  if (minha !== geracao || esta !== atual) return -1;
  base.pagina = esta;
  base.escala = px;
  base.canvas = c;
  el.tela.dataset.pagina = String(esta + 1);  // página que está de fato na tela (os testes esperam por ela)
  desenharTela();
  return esta;
}

let arrasto = null;  // traço ou tarja em andamento, ou carimbo sendo movido

function desenharTela() {
  // enquanto a página nova não termina de aparecer, a tela antiga fica como está
  if (!doc || !base.canvas || base.pagina !== atual) return;
  const c = el.tela;
  c.width = base.canvas.width;
  c.height = base.canvas.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(base.canvas, 0, 0);
  const s = base.escala;
  desenharMarcas(ctx, atual, s, true);
  const p = doc.paginas[atual];
  // sugestões: contorno laranja tracejado, nunca entram no PDF salvo
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 2;
  for (const sug of p.sugestoes) {
    for (const k of sug.caixas) {
      ctx.fillStyle = sug.desmarcada ? 'rgba(120, 120, 120, 0.12)' : 'rgba(232, 113, 10, 0.16)';
      ctx.fillRect(k.x * s, k.y * s, k.w * s, k.h * s);
      ctx.strokeStyle = sug === destaque ? '#1e6fd9' : sug.desmarcada ? '#8a8f96' : '#e8710a';
      ctx.lineWidth = sug === destaque ? 4 : 2;
      ctx.strokeRect(k.x * s, k.y * s, k.w * s, k.h * s);
    }
  }
  ctx.restore();
  if (arrasto && arrasto.tipo === 'tarja') {
    const r = retangulo(arrasto);
    ctx.fillStyle = cor === '#ffffff' ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.7)';
    ctx.fillRect(r.x * s, r.y * s, r.w * s, r.h * s);
    ctx.strokeStyle = '#1e6fd9';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x * s, r.y * s, r.w * s, r.h * s);
  }
  if (arrasto && arrasto.tipo === 'caneta') desenharMarca(ctx, arrasto.marca, s);
  if (arrasto && arrasto.tipo === 'texto' && arrasto.pedacos) {
    // prévia da seleção: azul claro por cima das letras que vão virar tarja
    ctx.fillStyle = 'rgba(30, 111, 217, 0.35)';
    for (const k of selecionar(arrasto.pedacos, arrasto.inicio, arrasto.fim, medirTexto)) {
      ctx.fillRect(k.x * s, k.y * s, k.w * s, k.h * s);
    }
  }
}

// Texto escolhido pelo usuário no meio da tarja, em cor que contrasta; só se couber (não sai da tarja nem fica
// pequeno demais para ler). Desenhado por cima do preenchimento: nada do que está embaixo aparece.
function escreverNaTarja(ctx, m, s) {
  const medida = document.createElement('canvas').getContext('2d');
  medida.font = '600 10px Helvetica, Arial, sans-serif';
  const largura10 = medida.measureText(rotuloTarja).width;
  const fonte = Math.min(m.h * 0.55, ((m.w * 0.9) / largura10) * 10);
  if (fonte < 5) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(m.x * s, m.y * s, m.w * s, m.h * s);
  ctx.clip();
  ctx.fillStyle = m.cor === '#ffffff' ? '#5f6670' : '#ffffff';
  ctx.font = `600 ${fonte * s}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rotuloTarja, (m.x + m.w / 2) * s, (m.y + m.h / 2) * s);
  ctx.restore();
}

function desenharMarca(ctx, m, s) {
  ctx.save();
  if (m.tipo === 'tarja') {
    ctx.fillStyle = m.cor;
    ctx.fillRect(m.x * s, m.y * s, m.w * s, m.h * s);
    if (rotuloTarja) escreverNaTarja(ctx, m, s);
  } else if (m.tipo === 'caneta') {
    ctx.strokeStyle = m.cor;
    ctx.lineWidth = m.largura * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    m.pontos.forEach(([x, y], k) => (k ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
    if (m.pontos.length === 1) ctx.lineTo(m.pontos[0][0] * s + 0.01, m.pontos[0][1] * s);
    ctx.stroke();
  }
  ctx.restore();
}

// Desenha tarjas, traços e o carimbo da página i numa escala s (pixels por ponto). Usada na tela, nas
// miniaturas e no PDF salvo, para que o que se vê seja o que sai.
function desenharMarcas(ctx, i, s, comContorno) {
  for (const m of doc.paginas[i].marcas) desenharMarca(ctx, m, s);
  if (carimboNaPagina(i)) desenharCarimbo(ctx, i, s, comContorno);
}

// ---------- carimbo ----------
function carimboNaPagina(i) {
  return carimbo.ativo && (carimbo.todas || carimbo.pagina === i);
}

function dataHoje() {
  return new Date().toLocaleDateString('pt-BR');
}

function linhasCarimbo() {
  const linhas = carimbo.texto.split('\n').map((l) => l.trimEnd()).filter((l, k, a) => l || k < a.length - 1);
  if (carimbo.comData) linhas.push('Tarjado em ' + dataHoje());
  if (carimbo.comHash && doc) {
    linhas.push('SHA-256 do original:');
    linhas.push(doc.hash.slice(0, 32));
    linhas.push(doc.hash.slice(32));
  }
  return linhas;
}

// Caixa do carimbo em pontos; o tamanho da letra acompanha a largura da página.
function caixaCarimbo(ctx, i) {
  const p = doc.paginas[i];
  const fonte = Math.max(6, Math.min(p.w, p.h) * 0.016);
  const linhas = linhasCarimbo();
  ctx.save();
  ctx.font = `600 ${fonte}px Helvetica, Arial, sans-serif`;
  const larg = Math.max(...linhas.map((l) => ctx.measureText(l).width), fonte * 4);
  ctx.restore();
  const pad = fonte * 0.6;
  const w = larg + 2 * pad;
  const h = linhas.length * fonte * 1.3 + 2 * pad - fonte * 0.3;
  const x = Math.max(0, Math.min(p.w - w, carimbo.fx * p.w));
  const y = Math.max(0, Math.min(p.h - h, carimbo.fy * p.h));
  return { x, y, w, h, fonte, pad, linhas };
}

function desenharCarimbo(ctx, i, s, comContorno) {
  // a medida do texto é feita em pontos (escala 1) e depois ampliada, igual na tela e no PDF
  const medida = document.createElement('canvas').getContext('2d');
  const k = caixaCarimbo(medida, i);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(k.x * s, k.y * s, k.w * s, k.h * s);
  ctx.strokeStyle = COR_CARIMBO;
  ctx.lineWidth = Math.max(1, k.fonte * 0.14 * s);
  ctx.strokeRect(k.x * s, k.y * s, k.w * s, k.h * s);
  ctx.fillStyle = COR_CARIMBO;
  ctx.font = `600 ${k.fonte * s}px Helvetica, Arial, sans-serif`;
  ctx.textBaseline = 'top';
  k.linhas.forEach((l, n) => ctx.fillText(l, (k.x + k.pad) * s, (k.y + k.pad + n * k.fonte * 1.3) * s));
  if (comContorno && arrasto && arrasto.tipo === 'carimbo') {
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#1e6fd9';
    ctx.lineWidth = 2;
    ctx.strokeRect(k.x * s - 3, k.y * s - 3, k.w * s + 6, k.h * s + 6);
  }
  ctx.restore();
}

function mudouCarimbo() {
  carimbo.ativo = el.carAtivo.checked;
  carimbo.texto = el.carTexto.value;
  carimbo.todas = el.carTodas.checked;
  carimbo.comHash = el.carHash.checked;
  carimbo.comData = el.carData.checked;
  if (!carimbo.todas && carimbo.ativo && doc && !carimboNaPagina(atual)) carimbo.pagina = atual;
  carimboMudou();
  desenharTela();
  if (doc) doc.paginas.forEach((_, i) => redesenharMiniatura(i));
}

// O carimbo (texto, opções e lugar) vale para todos os arquivos abertos: mudar num muda o PDF de todos, então
// os outros também voltam para "a conferir" e, se já salvos, pedem para salvar de novo.
function carimboMudou() {
  for (const d of docs) {
    if (d === doc) continue;
    d.revisado = false;
    d.salvo = false;
  }
  mudou();
}

// ---------- ponteiro: tarja, caneta, borracha, carimbo, aceitar sugestão ----------
function pontoPdf(ev) {
  const r = el.tela.getBoundingClientRect();
  const p = doc.paginas[atual];
  return [((ev.clientX - r.left) / r.width) * p.w, ((ev.clientY - r.top) / r.height) * p.h];
}

function retangulo(a) {
  const [x0, y0] = a.inicio;
  const [x1, y1] = a.fim;
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

function dentro([x, y], k) {
  return x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h;
}

function distSegmento([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function marcaEm(pt) {
  const marcas = doc.paginas[atual].marcas;
  for (let k = marcas.length - 1; k >= 0; k--) {
    const m = marcas[k];
    if (m.tipo === 'tarja' && dentro(pt, m)) return k;
    if (m.tipo === 'caneta') {
      const folga = m.largura / 2 + 3;
      const pts = m.pontos;
      for (let j = 0; j < pts.length; j++) {
        if (distSegmento(pt, pts[j], pts[Math.min(j + 1, pts.length - 1)]) <= folga) return k;
      }
    }
  }
  return -1;
}

function sugestaoEm(pt) {
  return doc.paginas[atual].sugestoes.findIndex((sg) => sg.caixas.some((k) => dentro(pt, k)));
}

function noCarimbo(pt) {
  if (!carimboNaPagina(atual)) return false;
  return dentro(pt, caixaCarimbo(document.createElement('canvas').getContext('2d'), atual));
}

el.tela.addEventListener('pointerdown', (ev) => {
  if (!doc || ev.button !== 0 || base.pagina !== atual) return;
  const pt = pontoPdf(ev);
  el.tela.setPointerCapture(ev.pointerId);
  if (ferramenta === 'borracha') {
    const k = marcaEm(pt);
    if (k >= 0) {
      const p = doc.paginas[atual];
      registrar([{ pagina: atual, antes: p.marcas.slice(), depois: p.marcas.filter((_, j) => j !== k) }]);
    }
    return;
  }
  if (noCarimbo(pt)) {
    const k = caixaCarimbo(document.createElement('canvas').getContext('2d'), atual);
    arrasto = { tipo: 'carimbo', dx: pt[0] - k.x, dy: pt[1] - k.y, antes: { fx: carimbo.fx, fy: carimbo.fy, pagina: carimbo.pagina },
                doc, pagina: atual };
    el.tela.classList.add('mover');
    desenharTela();
    return;
  }
  if (ferramenta === 'caneta') {
    arrasto = { tipo: 'caneta', marca: { tipo: 'caneta', cor, largura: espessura, pontos: [pt] } };
  } else if (ferramenta === 'texto') {
    // o texto da página chega do PDF.js; enquanto não chega, a seleção espera
    const a = { tipo: 'texto', inicio: pt, fim: pt, pedacos: null, pronto: textoDaPagina(doc, atual) };
    a.pronto.then((ped) => { a.pedacos = ped; desenharTela(); }).catch((e) => console.warn('texto da página não lido', e));
    arrasto = a;
  } else {
    arrasto = { tipo: 'tarja', inicio: pt, fim: pt };
  }
  // o gesto vale só para o arquivo e a página onde começou (auditoria de 29/10/2026)
  arrasto.doc = doc;
  arrasto.pagina = atual;
});

// Gesto interrompido (o sistema cancelou, ou a página ou o arquivo mudaram no meio): nada é aplicado e o carimbo
// volta para onde estava.
function cancelarArrasto() {
  const a = arrasto;
  arrasto = null;
  el.tela.classList.remove('mover');
  if (a?.tipo === 'carimbo') Object.assign(carimbo, a.antes);
  if (doc) desenharTela();
}

const arrastoFora = () => arrasto && (arrasto.doc !== doc || arrasto.pagina !== atual);

el.tela.addEventListener('pointermove', (ev) => {
  if (!doc) return;
  const pt = pontoPdf(ev);
  if (!arrasto) {
    el.tela.classList.toggle('mover', ferramenta !== 'borracha' && noCarimbo(pt));
    return;
  }
  if (arrastoFora()) { cancelarArrasto(); return; }
  if (arrasto.tipo === 'carimbo') {
    const p = doc.paginas[atual];
    carimbo.fx = (pt[0] - arrasto.dx) / p.w;
    carimbo.fy = (pt[1] - arrasto.dy) / p.h;
    carimbo.pagina = atual;
  } else if (arrasto.tipo === 'caneta') {
    const ult = arrasto.marca.pontos[arrasto.marca.pontos.length - 1];
    if (Math.hypot(pt[0] - ult[0], pt[1] - ult[1]) >= 0.8) arrasto.marca.pontos.push(pt);
  } else {
    arrasto.fim = pt;
  }
  desenharTela();
});

async function soltarTexto(a) {
  const d = doc;
  const i = atual;
  let pedacos;
  try {
    pedacos = await a.pronto;
  } catch (e) {
    console.warn('texto da página não lido', e);
    return;
  }
  if (d !== doc || i !== atual) return;
  if (!pedacos.length) {
    avisar('Esta página não tem texto para selecionar (talvez seja digitalizada): use a Tarja.', true);
    desenharTela();
    return;
  }
  const novas = selecionar(pedacos, a.inicio, a.fim, medirTexto).map((k) => ({ tipo: 'tarja', cor, ...k }));
  const p = d.paginas[i];
  if (novas.length) registrar([{ pagina: i, antes: p.marcas.slice(), depois: [...p.marcas, ...novas] }]);
  else desenharTela();
}

function soltar(ev) {
  if (!doc || !arrasto) return;
  if (arrastoFora()) { cancelarArrasto(); return; }
  const a = arrasto;
  arrasto = null;
  el.tela.classList.remove('mover');
  const p = doc.paginas[atual];
  if (a.tipo === 'texto') {
    soltarTexto(a);
    return;
  }
  if (a.tipo === 'carimbo') {
    // fixa a posição dentro da página, do jeito que foi desenhada
    const k = caixaCarimbo(document.createElement('canvas').getContext('2d'), atual);
    carimbo.fx = k.x / p.w;
    carimbo.fy = k.y / p.h;
    carimboMudou();
    desenharTela();
    doc.paginas.forEach((_, i) => carimboNaPagina(i) && redesenharMiniatura(i));
    return;
  }
  if (a.tipo === 'caneta') {
    registrar([{ pagina: atual, antes: p.marcas.slice(), depois: [...p.marcas, a.marca] }]);
    return;
  }
  const r = retangulo(a);
  if (r.w < 2 && r.h < 2) {
    // clique parado: aceita a sugestão embaixo dele, se houver
    const k = sugestaoEm(a.inicio);
    if (k >= 0) aceitar([[atual, k]]);
    else desenharTela();
    return;
  }
  registrar([{ pagina: atual, antes: p.marcas.slice(), depois: [...p.marcas, { tipo: 'tarja', cor, ...r }] }]);
}
el.tela.addEventListener('pointerup', soltar);
el.tela.addEventListener('pointercancel', cancelarArrasto);

// Tarja do tamanho da página, na cor escolhida (anexo que não pode sair, página só com dado pessoal).
function cobrirPagina() {
  if (!doc || ocupado()) return;
  const p = doc.paginas[atual];
  registrar([{ pagina: atual, antes: p.marcas.slice(), depois: [...p.marcas, { tipo: 'tarja', cor, x: 0, y: 0, w: p.w, h: p.h }] }]);
  avisar(`Página ${atual + 1} coberta inteira. Desfazer volta.`);
}

// ---------- histórico ----------
function aplicar(mudancas, lado) {
  const tocadas = new Set();
  for (const m of mudancas) {
    doc.paginas[m.pagina].marcas = m[lado].slice();
    if (m.sugestoes && lado === 'antes') doc.paginas[m.pagina].sugestoes = m.sugestoes.slice();
    if (m.aceitas) doc.aceitas += lado === 'antes' ? -m.aceitas : m.aceitas;
    tocadas.add(m.pagina);
  }
  for (const i of tocadas) {
    limparSugestoesCobertas(i);
    redesenharMiniatura(i);
  }
  mudou();
  desenharTela();
}

function registrar(mudancas) {
  if (ocupado()) return;
  historico.push({ mudancas });
  refazer = [];
  aplicar(mudancas, 'depois');
}

function desfazer() {
  if (ocupado()) return;
  const h = historico.pop();
  if (!h) return;
  refazer.push(h);
  aplicar(h.mudancas, 'antes');
  avisar('Desfeito.');
}

function refazerUltimo() {
  if (ocupado()) return;
  const h = refazer.pop();
  if (!h) return;
  historico.push(h);
  aplicar(h.mudancas, 'depois');
}

// qualquer mudança depois da conferência pede conferência de novo
function mudou() {
  if (doc) doc.salvo = false;
  agendarAndamento();
  if (el.revisei.checked) {
    el.revisei.checked = false;
    avisar('Houve mudança: confira as páginas e marque "Revisei" de novo.');
  }
  atualizar();
}

// ---------- lista de termos do usuário (nomes, endereços) ----------
// A lista é dado pessoal: fica só na memória e some ao fechar, a não ser que o usuário marque "Guardar".
const GUARDA_TERMOS = 'tarja-livre.termos';
const MAX_ARQUIVO_TERMOS = 1024 * 1024;

function termosAtuais() {
  return { lista: prepararTermos(el.termos.value), palavraInteira: el.termoInteira.checked, semAcento: el.termoAcento.checked };
}

function mudouTermos() {
  const n = prepararTermos(el.termos.value).length;
  // o que a lista deixa de fora não some calado (auditoria de 29/10/2026): repetidos, de uma letra só, além do limite
  // de termos, e o que passa do limite de letras (é cortado)
  const brutos = el.termos.value.split(/[\r\n;]+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const fora = brutos.length - n;
  const cortados = brutos.filter((l) => l.length > MAX_LETRAS_TERMO).length;
  el.infoTermos.textContent = (n ? `${n} termo(s) na lista.` : 'Nenhum termo.') +
    (fora > 0 ? ` ${fora} linha(s) não entraram (repetidas, com uma letra só ou além do limite de ${MAX_TERMOS} termos).` : '') +
    (cortados ? ` ${cortados} termo(s) com mais de ${MAX_LETRAS_TERMO} letras foram cortados.` : '');
  if (el.termoGuardar.checked) guardarTermos();
}

function guardarTermos() {
  try {
    localStorage.setItem(GUARDA_TERMOS, JSON.stringify({ texto: el.termos.value, inteira: el.termoInteira.checked,
                                                       acento: el.termoAcento.checked }));
  } catch (e) {
    console.warn('lista de termos não guardada', e);
    avisar('O navegador não deixou guardar a lista neste computador.', true);
  }
}

// Para computador dividido: tira deste navegador tudo o que o Tarja guardou (escolhas, lista e andamento). O que está
// aberto continua na tela; só deixa de ficar guardado.
async function apagarTudoGuardado() {
  if (!confirm('Apagar deste computador tudo o que o Tarja Livre guardou (escolhas, lista de nomes e andamento)?')) return;
  el.termoGuardar.checked = false;
  for (const d of docs) { d.andamentoPendente = false; d.andamentoGuardado = null; }
  el.andamento.hidden = true;
  // cada depósito conferido: em computador dividido, dizer "Apagado" sem ter apagado é pior que não ter o botão
  const falharam = [];
  for (const [chave, nome] of [[GUARDA_TERMOS, 'a lista guardada'], [PREF, 'as escolhas']]) {
    try {
      localStorage.removeItem(chave);
      if (localStorage.getItem(chave) !== null) throw new Error('continua guardado');
    } catch (e) {
      console.warn('não apagou', nome, e);
      falharam.push(nome);
    }
  }
  if (!(await apagarTodoAndamento())) falharam.push('o andamento');
  if (falharam.length) {
    const lista = falharam.length > 1 ? falharam.slice(0, -1).join(', ') + ' e ' + falharam.at(-1) : falharam[0];
    avisar(`Não foi possível apagar ${lista} deste computador. Feche o Tarja Livre, abra de novo e clique outra vez em ` +
      '"Apagar tudo"; se continuar, apague os dados de navegação deste arquivo no navegador.', true);
  } else {
    avisar('Apagado deste computador: escolhas, lista guardada e andamento.');
  }
}

function esquecerTermos() {
  try { localStorage.removeItem(GUARDA_TERMOS); } catch (e) { console.warn('lista guardada não apagada', e); }
}

function lerTermosGuardados() {
  try {
    const g = JSON.parse(localStorage.getItem(GUARDA_TERMOS));
    if (!g || typeof g.texto !== 'string') return;
    el.termos.value = g.texto.slice(0, MAX_ARQUIVO_TERMOS);
    el.termoInteira.checked = g.inteira !== false;
    el.termoAcento.checked = g.acento !== false;
    el.termoGuardar.checked = true;
  } catch (e) {
    console.warn('lista guardada ilegível', e);
  }
}

async function importarTermos(arquivo) {
  if (!arquivo) return;
  if (arquivo.size > MAX_ARQUIVO_TERMOS) {
    avisar('Arquivo de lista grande demais (o limite é 1 MB).', true);
    return;
  }
  let texto;
  try {
    texto = await arquivo.text();
  } catch (e) {
    console.warn('lista não lida', e);
    avisar('Não foi possível ler o arquivo da lista.', true);
    return;
  }
  const antes = prepararTermos(el.termos.value).length;
  el.termos.value = prepararTermos(el.termos.value + '\n' + texto).join('\n');
  mudouTermos();
  avisar(`${prepararTermos(el.termos.value).length - antes} termo(s) novo(s) na lista.`);
}

// ---------- sugestões ----------
function tiposMarcados() {
  return [...el.tipos.querySelectorAll('input:checked')].map((c) => c.value);
}

function tarjasDa(d, i) {
  return d.paginas[i].marcas.filter((m) => m.tipo === 'tarja');
}

function limparSugestoesCobertas(i) {
  const p = doc.paginas[i];
  const tarjas = tarjasDa(doc, i);
  p.sugestoes = p.sugestoes.filter((sg) => !sg.caixas.every((k) => coberta(k, tarjas)));
}

// Largura relativa de um texto, para achar onde começa o dado dentro de um pedaço de texto. Mede na família que o
// PDF.js informa para a fonte (sem serifa, com serifa ou de largura fixa): medir letra de largura fixa como se
// fosse proporcional desloca a caixa e pode deixar o começo do dado à mostra.
const regua = document.createElement('canvas').getContext('2d');
const FAMILIAS = { sans: 'Helvetica, Arial, sans-serif', serif: '"Times New Roman", Times, serif', mono: 'monospace' };
function familiaDe(nome) {
  const f = String(nome || '').toLowerCase();
  if (f.includes('mono') || f.includes('courier')) return 'mono';
  if (f.includes('serif') && !f.includes('sans')) return 'serif';
  if (f.includes('times')) return 'serif';
  return 'sans';
}
function medirTexto(t, pedaco) {
  regua.font = '100px ' + FAMILIAS[pedaco.familia || 'sans'];
  return regua.measureText(t).width;
}

// Campos de formulário e caixas de texto anotadas aparecem na página mas não vêm no texto dela: procura neles à
// parte e, se achar, sugere cobrir o campo inteiro. Devolve null se não conseguir ler: a página fica com a procura
// incompleta, nunca com "nada encontrado" (auditoria TL-X18).
async function sugestoesDeAnotacoes(pg, v, tipos, termos) {
  let anots = [];
  try {
    anots = await pg.getAnnotations({ intent: 'print' });
  } catch (e) {
    console.warn('anotações não lidas', e);
    return null;
  }
  const lista = [];
  for (const a of anots) {
    // só o que aparece no modo de impressão, o mesmo que é desenhado (OPCOES_DESENHO)
    const flags = a.annotationFlags || 0;
    if (flags & ANOT_ESCONDIDA || !(flags & ANOT_IMPRIMIR) || !Array.isArray(a.rect)) continue;
    const valor = Array.isArray(a.fieldValue) ? a.fieldValue.join(' ') : a.fieldValue;
    const textos = [valor, a.subtype === 'FreeText' ? a.contentsObj?.str : null].filter((s) => typeof s === 'string' && s);
    for (const str of textos) {
      const achados = procurar([{ str, x: 0, y: 10, w: str.length * 6, h: 10, eol: true }], tipos, null, termos);
      if (!achados.length) continue;
      const [x1, y1, x2, y2] = v.convertToViewportRectangle(a.rect);
      const caixa = { x: Math.min(x1, x2) - 1, y: Math.min(y1, y2) - 1, w: Math.abs(x2 - x1) + 2, h: Math.abs(y2 - y1) + 2 };
      lista.push({ tipo: achados[0].tipo, ini: 0, fim: 0, trecho: str, caixas: [caixa] });
      break;
    }
  }
  return lista;
}

// Pedaços de texto de uma página (posição, tamanho, direção e família da fonte), pedidos ao PDF.js uma vez só por
// página: servem à procura e à seleção com o cursor. Ficam só na memória, junto com o documento aberto.
function textoDaPagina(d, i) {
  const p = d.paginas[i];
  if (!p.texto) {
    p.texto = (async () => {
      const pg = await d.pdf.getPage(i + 1);
      const v = pg.getViewport({ scale: 1 });
      const conteudo = await pg.getTextContent();
      const pedacos = [];
      for (const it of conteudo.items) {
        if (!it.str) continue;
        const t = pdfjsLib.Util.transform(v.transform, it.transform);
        const h = Math.hypot(t[2], t[3]) || it.height || 10;
        // direção do texto na página (texto girado ou página com /Rotate); quase deitado conta como deitado
        let ang = Math.atan2(t[1], t[0]);
        if (Math.abs(ang) < 0.01) ang = 0;
        const familia = familiaDe(conteudo.styles?.[it.fontName]?.fontFamily);
        // a largura vem sem o /UserUnit da página, que o viewport (e portanto x, y e h) já aplica
        pedacos.push({ str: it.str, x: t[4], y: t[5], w: it.width * (pg.userUnit || 1), h, eol: !!it.hasEOL, ang, familia });
      }
      return pedacos;
    })().catch((e) => { p.texto = null; throw e; });
  }
  return p.texto;
}

// ---------- OCR (só na versão com OCR) ----------
// O Tesseract roda num worker feito do texto embutido na página (dados do português dentro, sem rede). Só as
// palavras e as caixas delas voltam para cá, e só ficam na memória enquanto a procura roda.
const DPI_OCR = 200;
let ocrPronto = null;

function ocrDisponivel() {
  return !!(globalThis.Tesseract && document.getElementById('ocr-worker'));
}

function obterOcr() {
  if (!ocrPronto) {
    const fonte = document.getElementById('ocr-worker').textContent;
    const url = URL.createObjectURL(new Blob([fonte], { type: 'text/javascript' }));
    ocrPronto = globalThis.Tesseract.createWorker('por', 1, {
      workerPath: url, workerBlobURL: false, corePath: 'embutido/tesseract-core.js', langPath: 'embutido',
      cacheMethod: 'none', gzip: true,
    }).catch((e) => { ocrPronto = null; throw e; });
  }
  return ocrPronto;
}

// Desenha a página como na tela e devolve as palavras reconhecidas como pedaços de texto em pontos do PDF.
async function lerComOcr(pg, p) {
  const s = escalaSegura(p, DPI_OCR / 72);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(p.w * s));
  c.height = Math.max(1, Math.round(p.h * s));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  await pg.render({ ...OPCOES_DESENHO, canvasContext: ctx, viewport: pg.getViewport({ scale: s }) }).promise;
  const trabalhador = await obterOcr();
  const { data } = await trabalhador.recognize(c, {}, { blocks: true, text: false });
  c.width = c.height = 0;
  const pedacos = [];
  for (const bloco of data.blocks || []) {
    for (const par of bloco.paragraphs || []) {
      for (const linha of par.lines || []) {
        const palavras = (linha.words || []).filter((w) => w.text && w.text.trim());
        palavras.forEach((w, j) => {
          const { x0, y0, x1, y1 } = w.bbox;
          // a caixa da palavra vem da imagem: base na parte de baixo dela, altura inteira
          pedacos.push({ str: corrigirOcr(w.text.trim()), x: x0 / s, y: y1 / s, w: (x1 - x0) / s, h: Math.max(3, (y1 - y0) / s),
                         eol: j === palavras.length - 1, ang: 0, familia: 'sans' });
        });
      }
    }
  }
  return pedacos;
}

// Procura num arquivo (na tela ou não). Para no meio, sem estragar nada, se o arquivo for fechado.
// Devolve { total, semTexto } ou null se parou.
async function procurarEm(d, tipos, progresso, termos = null) {
  let semTexto = 0;
  const novas = [];
  const incompletas = [];   // páginas em que os campos de formulário e as anotações não puderam ser lidos
  const usarOcr = ocrDisponivel() && el.ocrLigado.checked;
  for (let i = 0; i < d.paginas.length; i++) {
    progresso(i);
    const pg = await d.pdf.getPage(i + 1);
    const v = pg.getViewport({ scale: 1 });
    const pedacos = (await textoDaPagina(d, i)).slice();
    // página sem texto (digitalizada): o texto sai da imagem, pelo OCR, quando a versão tem e a opção está ligada
    let ocr = false;
    if (!pedacos.length && usarOcr) {
      progresso(i, true);
      pedacos.push(...(await lerComOcr(pg, d.paginas[i])));
      ocr = true;
    }
    const anotacoes = await sugestoesDeAnotacoes(pg, v, tipos, termos);
    if (!anotacoes) incompletas.push(i + 1);
    const achados = [...procurar(pedacos, tipos, medirTexto, termos), ...(anotacoes || [])];
    if (!docs.includes(d)) return null;
    novas.push({ semTexto: pedacos.length === 0, ocr, achados });
  }
  // só no fim aplica tudo de uma vez, descontando o que já foi tarjado nesse meio tempo
  novas.forEach(({ semTexto: vazia, ocr, achados }, i) => {
    const p = d.paginas[i];
    p.semTexto = vazia;
    p.ocr = ocr;
    if (vazia) semTexto++;
    const tarjas = tarjasDa(d, i);
    p.sugestoes = achados.filter((a) => !a.caixas.every((k) => coberta(k, tarjas)));
  });
  d.procurou = tipos;
  d.termosProcurados = termos?.lista?.length || 0;  // só a quantidade: os termos são dado pessoal
  return { total: d.paginas.reduce((n, p) => n + p.sugestoes.length, 0), semTexto, incompletas };
}

async function procurarArquivos(lista) {
  const tipos = tiposMarcados();
  const termos = termosAtuais();
  if (!tipos.length && !termos.lista.length) {
    avisar('Marque ao menos um tipo de dado ou escreva um nome na lista para procurar.', true);
    return;
  }
  if (procurando) return;
  procurando = true;
  atualizar();
  let total = 0;
  let semTexto = 0;
  const falharam = [];
  const incompletos = [];
  for (const [n, d] of lista.entries()) {
    if (!docs.includes(d)) continue;
    try {
      const r = await procurarEm(d, tipos, (i, ocr) => {
        const arq = lista.length > 1 ? `arquivo ${n + 1} de ${lista.length}, ` : '';
        el.resumoAchados.textContent = ocr
          ? `Lendo a página ${i + 1} (digitalizada) com OCR... ${arq}`.trim()
          : `Procurando... ${arq}página ${i + 1} de ${d.paginas.length}`;
      }, termos);
      if (r) {
        total += r.total;
        semTexto += r.semTexto;
        if (r.incompletas.length) incompletos.push(`${d.nome} (página ${r.incompletas.join(', ')})`);
      }
    } catch (e) {
      // arquivo fechado no meio da procura: não é erro
      if (!docs.includes(d)) continue;
      console.warn('procura interrompida', d.nome, e);
      falharam.push(d.nome);
    }
  }
  procurando = false;
  if (doc) desenharTela();
  atualizar();
  const onde = lista.length > 1 ? ` em ${lista.length} arquivos` : '';
  // procura que falhou nunca vira "Nada encontrado": isso daria falsa segurança (auditoria de 29/10/2026)
  if (falharam.length) {
    avisar(`A procura em ${falharam.join(', ')} não terminou: tente de novo. Até lá, não conte com as sugestões ` +
      'desse arquivo.', true);
  } else if (incompletos.length) {
    avisar(`Procura incompleta: os campos de formulário e as anotações de ${incompletos.join('; ')} não puderam ser ` +
      `lidos. ${total ? `Há ${total} sugestão(ões) no resto. ` : ''}Confira essas páginas à mão ou procure de novo.`, true);
  } else if (semTexto) {
    avisar(`${semTexto} página(s) sem texto${onde} (talvez digitalizadas): nelas a procura não funciona, tarje à mão.` +
      (ocrDisponivel() ? '' : ' A versão com OCR lê páginas digitalizadas.'), true);
  } else {
    avisar(total ? `${total} sugestão(ões)${onde}. Clique numa sugestão para aceitar.` : 'Nada encontrado nos tipos marcados.');
  }
}

// ---------- revisão em lista ----------
// Todas as sugestões pendentes do arquivo, com página, tipo e o trecho achado. O trecho só aparece aqui, na tela:
// não vai para a folha de conferência nem é guardado em lugar nenhum.
const MAX_LINHAS_LISTA = 300;
let assinaturaLista = '';

function sugestoesPendentes() {
  const todas = [];
  doc?.paginas.forEach((p, i) => p.sugestoes.forEach((sg, k) => todas.push({ sg, i, k })));
  return todas;
}

function montarListaSugestoes() {
  const todas = sugestoesPendentes();
  // só remonta quando a lista muda: navegar entre páginas não perde a rolagem nem as marcações
  const assinatura = docs.indexOf(doc) + ':' + todas.map(({ sg, i }) => i + (sg.desmarcada ? '-' : '+') + sg.trecho).join('|');
  if (assinatura === assinaturaLista) return;
  assinaturaLista = assinatura;
  el.listaSugestoes.hidden = todas.length === 0;
  el.btAceitarMarcadas.hidden = todas.length === 0;
  const linhas = todas.slice(0, MAX_LINHAS_LISTA).map(({ sg, i }) => {
    const linha = document.createElement('div');
    linha.className = 'sugestao' + (sg.desmarcada ? ' desmarcada' : '');
    linha.setAttribute('role', 'listitem');
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = !sg.desmarcada;
    caixa.title = 'Marcada para aceitar';
    caixa.addEventListener('change', () => { sg.desmarcada = !caixa.checked; desenharTela(); atualizar(); });
    const ir = document.createElement('button');
    ir.type = 'button';
    ir.title = 'Mostrar na página';
    const onde = document.createElement('span');
    onde.className = 'onde';
    onde.textContent = `p. ${i + 1} · ${NOMES[sg.tipo] || sg.tipo}`;
    const trecho = document.createElement('span');
    trecho.className = 'trecho';
    trecho.textContent = sg.trecho || '';  // texto do PDF: sempre como texto, nunca como HTML
    ir.append(onde, trecho);
    ir.addEventListener('click', () => mostrarSugestao(sg, i));
    linha.append(caixa, ir);
    return linha;
  });
  if (todas.length > MAX_LINHAS_LISTA) {
    const mais = document.createElement('div');
    mais.className = 'mais';
    mais.textContent = `e mais ${todas.length - MAX_LINHAS_LISTA} sugestão(ões), nas páginas.`;
    linhas.push(mais);
  }
  el.listaSugestoes.replaceChildren(...linhas);
}

let tempoDestaque = 0;
async function mostrarSugestao(sg, i) {
  destaque = sg;
  if (i !== atual) await mostrar(i);
  else desenharTela();
  clearTimeout(tempoDestaque);
  tempoDestaque = setTimeout(() => { destaque = null; desenharTela(); }, 2500);
}

function aceitarMarcadas() {
  const pares = sugestoesPendentes().filter(({ sg }) => !sg.desmarcada).map(({ i, k }) => [i, k]);
  if (!pares.length) {
    avisar('Nenhuma sugestão marcada.', true);
    return;
  }
  aceitar(pares);
  avisar(`${pares.length} tarja(s) aplicada(s). Confira cada página.`);
}

function resumoSugestoes() {
  const cont = {};
  for (const p of doc.paginas) for (const sg of p.sugestoes) cont[sg.tipo] = (cont[sg.tipo] || 0) + 1;
  const partes = Object.keys(NOMES).filter((t) => cont[t]).map((t) => `${NOMES[t]} ${cont[t]}`);
  const total = Object.values(cont).reduce((a, b) => a + b, 0);
  if (!doc.procurou) return '';
  if (!total) return 'Nenhuma sugestão pendente.';
  return `${total} pendente(s): ${partes.join(', ')}`;
}

// pares [página, índice da sugestão] viram tarjas pretas, num passo só do Desfazer
function aceitar(pares) {
  const porPagina = new Map();
  for (const [i, k] of pares) {
    if (!porPagina.has(i)) porPagina.set(i, []);
    porPagina.get(i).push(k);
  }
  const mudancas = [];
  for (const [i, ks] of porPagina) {
    const p = doc.paginas[i];
    const novas = [];
    for (const k of ks) for (const c of p.sugestoes[k].caixas) novas.push({ tipo: 'tarja', cor: '#000000', ...c });
    // guarda as sugestões de antes: desfazer o aceite devolve as tarjas e as sugestões
    mudancas.push({ pagina: i, antes: p.marcas.slice(), depois: [...p.marcas, ...novas], sugestoes: p.sugestoes.slice(),
                    aceitas: ks.length });
  }
  if (mudancas.length) registrar(mudancas);
}

function aceitarPagina() {
  aceitar(doc.paginas[atual].sugestoes.map((_, k) => [atual, k]));
}

function aceitarTodas() {
  const pares = [];
  doc.paginas.forEach((p, i) => p.sugestoes.forEach((_, k) => pares.push([i, k])));
  aceitar(pares);
  avisar(`${pares.length} tarja(s) aplicada(s). Confira cada página.`);
}

function descartar() {
  for (const p of doc.paginas) p.sugestoes = [];
  desenharTela();
  atualizar();
}

// ---------- salvar ----------
function nomeSaida() {
  const limpo = doc.nome.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'documento';
  return limpo + '-tarjado.pdf';
}

function contarMarcas(p) {
  const tarjas = p.marcas.filter((m) => m.tipo === 'tarja').length;
  return { tarjas, tracos: p.marcas.length - tarjas };
}

function blobEmBytes(canvas, tipo, qualidade) {
  return new Promise((ok, falha) => canvas.toBlob(async (b) => {
    if (!b) return falha(new Error('imagem não gerada'));
    ok(new Uint8Array(await b.arrayBuffer()));
  }, tipo, qualidade));
}

// Folha a mais no fim: conta o que foi feito sem mostrar nada do que foi coberto.
class ErroConferencia extends Error {
  constructor(letras) {
    super('texto extraível no PDF gerado: ' + letras);
    this.letras = letras;
  }
}

// Quantos caracteres de texto o PDF.js consegue extrair das primeiras n páginas (o que deveria ser zero).
async function contarTexto(bytes, n) {
  // cópia: o PDF.js transfere os bytes para o worker, e o original ainda vai ser salvo
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(), worker: trabalhadorPdf, isEvalSupported: false, enableXfa: false }).promise;
  try {
    let letras = 0;
    for (let i = 1; i <= Math.min(n, pdf.numPages); i++) {
      const t = await (await pdf.getPage(i)).getTextContent();
      for (const it of t.items) letras += (it.str || '').replace(/\s/g, '').length;
    }
    return letras;
  } finally {
    pdf.destroy();
  }
}

function folhaConferencia(pdf, formato, quando, letras) {
  pdf.addPage('a4', 'p');
  const W = 595.28;
  const M = 56;
  let y = M;
  const escrever = (texto, tam = 10.5, negrito = false, cor = [43, 47, 54]) => {
    pdf.setFont('helvetica', negrito ? 'bold' : 'normal');
    pdf.setFontSize(tam);
    pdf.setTextColor(...cor);
    for (const l of pdf.splitTextToSize(texto, W - 2 * M)) {
      if (y > 800) { pdf.addPage('a4', 'p'); y = M; }
      pdf.text(l, M, y);
      y += tam * 1.4;
    }
  };
  escrever('Folha de conferência', 17, true, [31, 107, 69]);
  y += 4;
  escrever(`Gerada pelo Tarja Livre ${VERSAO} em ${quando}.`);
  y += 6;
  escrever('SHA-256 do PDF original', 10.5, true);
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(9.5);
  pdf.text(doc.hash, M, y);
  y += 20;
  const totalTarjas = doc.paginas.reduce((n, p) => n + contarMarcas(p).tarjas, 0);
  const totalTracos = doc.paginas.reduce((n, p) => n + contarMarcas(p).tracos, 0);
  const dpi = menorDpi < DPI_SAIDA ? `${DPI_SAIDA} ppp (páginas muito grandes com até ${menorDpi} ppp)` : `${DPI_SAIDA} ppp`;
  escrever(`Páginas: ${doc.paginas.length}, cada uma refeita como imagem ${formato.toUpperCase()} a ${dpi}. ` +
    `O texto coberto pelas tarjas não existe neste arquivo.`);
  escrever(`Tarjas: ${totalTarjas}. Traços de caneta: ${totalTracos}.`);
  if (doc.procurou) {
    const usados = doc.procurou.map((t) => TIPOS[t]);
    if (doc.termosProcurados) usados.push(`lista de ${doc.termosProcurados} termo(s) do usuário (os termos não aparecem nesta folha)`);
    escrever(`Procura automática usada para: ${usados.join(', ')}. ` +
      `Sugestões aceitas: ${doc.aceitas}. Sugestões não aceitas: ${doc.paginas.reduce((n, p) => n + p.sugestoes.length, 0)}.`);
  } else {
    escrever('Procura automática: não usada.');
  }
  const semTexto = doc.paginas.filter((p) => p.semTexto).length;
  if (semTexto) escrever(`Páginas sem texto (procura automática não se aplica): ${semTexto}.`);
  const lidasOcr = doc.paginas.filter((p) => p.ocr).length;
  if (lidasOcr) escrever(`Páginas digitalizadas lidas por OCR: ${lidasOcr} (o texto reconhecido não fica neste arquivo).`);
  escrever(rotuloTarja ? `Texto nas tarjas: "${rotuloTarja}".` : 'Texto nas tarjas: nenhum.');
  escrever(`Carimbo: ${carimbo.ativo ? (carimbo.todas ? 'em todas as páginas' : 'na página ' + (carimbo.pagina + 1)) : 'não'}.`);
  escrever('Revisão: quem salvou confirmou ter visto e revisado todas as páginas.');
  escrever(`Conferência automática: antes de terminar, o Tarja Livre leu de novo as ${doc.paginas.length} página(s) ` +
    `refeitas e encontrou ${letras} caracteres de texto extraível.`);
  y += 8;
  escrever('Tarjas por página', 10.5, true);
  const linhas = doc.paginas.map((p, i) => {
    const c = contarMarcas(p);
    return `Página ${i + 1}: ${c.tarjas} tarja(s)` + (c.tracos ? `, ${c.tracos} traço(s)` : '');
  });
  escrever(linhas.join('   ·   '), 9.5);
  y += 10;
  escrever('Esta folha não mostra o conteúdo tarjado. O Tarja Livre não garante anonimização perfeita nem ' +
    'conformidade jurídica: revise o documento antes de compartilhar.', 9, false, [95, 102, 112]);
}

function travarInterface(sim) {
  for (const x of document.querySelectorAll('.topo, .corpo')) x.inert = sim;
}

async function salvar() {
  // um salvar por vez (auditoria TL-X11): o segundo pedido, com o primeiro ainda na caixa ou gerando, não faz nada
  if (ocupado() || !doc || !el.revisei.checked) return;
  const pendentes = doc.paginas.reduce((n, p) => n + p.sugestoes.length, 0);
  if (pendentes && !confirm(`Ainda há ${pendentes} sugestão(ões) não aceita(s). Salvar mesmo assim?`)) return;
  // o salvar fica preso ao documento que o começou (auditoria de 29/10/2026: com a caixa "Salvar como" aberta, trocar
  // de aba fazia sair o outro documento com o nome deste). A interface trava já no clique, antes da caixa, e trava
  // também o teclado (Tab): mudar o carimbo ou o "Revisei" no meio deixaria páginas diferentes entre si.
  const origem = doc;
  const conferirOrigem = () => { if (doc !== origem) throw new ErroTroca(); };
  document.body.classList.add('ocupado');
  travarInterface(true);
  const destino = typeof window.showSaveFilePicker === 'function' ? await escolherDestino() : null;
  if (destino === 'cancelado' || doc !== origem) {
    document.body.classList.remove('ocupado');
    travarInterface(false);
    avisar(destino === 'cancelado' ? 'Salvamento cancelado: nada foi gravado.'
      : 'O documento na tela mudou durante o salvamento: nada foi gravado. Salve de novo.', destino !== 'cancelado');
    atualizar();
    return;
  }
  const formato = el.formato.value === 'jpeg' ? 'jpeg' : 'png';
  el.progresso.hidden = false;
  el.btSalvar.disabled = true;
  let pdf = null;
  menorDpi = DPI_SAIDA;
  const inicio = Date.now();
  // medido: 100 páginas levaram 9 min num processador 4x mais lento, e 300 páginas passaram de 1 GB de memória
  if (doc.paginas.length > PAGINAS_MUITAS) {
    avisar(`Documento grande (${doc.paginas.length} páginas): salvar pode levar vários minutos. Deixe o computador na tomada ` +
      'e feche outros programas. Em computador lento, o formato JPEG salva mais rápido.');
  }
  try {
    for (let i = 0; i < doc.paginas.length; i++) {
      const p = doc.paginas[i];
      el.btSalvar.textContent = `Gerando página ${i + 1} de ${doc.paginas.length}...` + faltaTempo(inicio, i, doc.paginas.length);
      el.barraProgresso.style.width = Math.round((100 * i) / doc.paginas.length) + '%';
      const s = escalaSegura(p, DPI_SAIDA / 72);
      menorDpi = Math.min(menorDpi, Math.floor(s * 72));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(p.w * s));
      c.height = Math.max(1, Math.round(p.h * s));
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('canvas recusado pelo navegador na página ' + (i + 1));
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      const pg = await doc.pdf.getPage(i + 1);
      await pg.render({ ...OPCOES_DESENHO, canvasContext: ctx, viewport: pg.getViewport({ scale: s }) }).promise;
      conferirOrigem();
      desenharMarcas(ctx, i, s, false);
      const img = await blobEmBytes(c, 'image/' + formato, 0.88);
      const orient = p.w > p.h ? 'l' : 'p';
      if (!pdf) pdf = new jsPDF({ unit: 'pt', format: [p.w, p.h], orientation: orient, compress: true });
      else pdf.addPage([p.w, p.h], orient);
      pdf.addImage(img, formato.toUpperCase(), 0, 0, p.w, p.h, undefined, 'FAST');
      c.width = c.height = 0;  // devolve a memória da imagem antes da próxima página
    }
    const agora = new Date();
    const quando = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    // conferência automática: relê as páginas geradas, antes da folha, e recusa salvar se sobrar texto extraível
    el.btSalvar.textContent = 'Conferindo o PDF gerado...';
    const antes = await contarTexto(new Uint8Array(pdf.output('arraybuffer')), doc.paginas.length);
    if (antes !== 0) throw new ErroConferencia(antes);
    conferirOrigem();
    if (el.folha.checked) folhaConferencia(pdf, formato, quando, antes);
    pdf.setProperties({ title: 'Documento tarjado', subject: '', author: '', keywords: '', creator: 'Tarja Livre ' + VERSAO });
    const bytes = new Uint8Array(pdf.output('arraybuffer'));
    const depois = await contarTexto(bytes, doc.paginas.length);
    if (depois !== 0) throw new ErroConferencia(depois);
    const hashSaida = await sha256(bytes);
    conferirOrigem();
    const nomeFinal = await gravar(destino, bytes);
    origem.salvo = true;
    esquecerAndamento(origem.hash);
    origem.hashSaida = hashSaida;
    origem.conferencia = `Conferido: o PDF salvo foi lido de novo e tem 0 caracteres de texto nas ${origem.paginas.length} página(s) refeitas.`;
    el.barraProgresso.style.width = '100%';
    const faltam = docs.filter((d) => !d.hashSaida).length;
    avisar('PDF salvo como ' + nomeFinal + '. Abra e confira antes de compartilhar.' +
      (faltam ? ` Falta(m) ${faltam} arquivo(s).` : ''), true);
  } catch (e) {
    console.warn('falha ao salvar', e);
    avisar(e instanceof ErroTroca
      ? 'O documento na tela mudou durante o salvamento: nada foi gravado. Salve de novo.'
      : e instanceof ErroConferencia
      ? `O PDF gerado ainda tinha ${e.letras} caractere(s) de texto: por segurança, nada foi salvo. Relate o problema.`
      : e instanceof ErroGravar
        ? 'Não foi possível gravar o PDF na pasta escolhida (sem permissão ou disco cheio). Tente outra pasta.'
        : 'Não foi possível gerar o PDF. Tente o formato JPEG ou um documento menor.', true);
  } finally {
    document.body.classList.remove('ocupado');
    travarInterface(false);
    el.btSalvar.textContent = 'Salvar PDF tarjado';
    setTimeout(() => { el.progresso.hidden = true; el.barraProgresso.style.width = '0'; }, 1200);
    atualizar();
  }
}

class ErroGravar extends Error {}
class ErroTroca extends Error {}

// Em computador lento um PDF grande leva minutos: a partir da 3ª página, a média por página dá o tempo que falta
// (o "travou?" vira "faltam cerca de 6 min").
function faltaTempo(inicio, feitas, total) {
  if (feitas < 2) return '';
  const s = ((Date.now() - inicio) / feitas) * (total - feitas) / 1000;
  if (s < 20) return '';
  return s < 90 ? ' Falta menos de 2 min.' : ` Faltam cerca de ${Math.round(s / 60)} min.`;
}

// "Salvar como": onde o navegador oferece (Edge, Chrome e a janela própria), a pessoa escolhe a pasta e o nome. A caixa
// só pode abrir logo depois do clique, por isso vem antes de gerar o PDF. Sem ela (Firefox) ou se o navegador recusar,
// o PDF vai como download comum. Devolve o lugar escolhido, null (download) ou 'cancelado'.
async function escolherDestino() {
  if (typeof window.showSaveFilePicker !== 'function') return null;
  try {
    return await window.showSaveFilePicker({ suggestedName: nomeSaida(),
      types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }] });
  } catch (e) {
    if (e.name === 'AbortError') return 'cancelado';
    console.warn('caixa "Salvar como" recusada; vai como download', e);
    return null;
  }
}

// grava no lugar escolhido ou baixa; devolve o nome com que ficou
async function gravar(destino, bytes) {
  if (!destino) {
    baixar(bytes, nomeSaida());
    return nomeSaida();
  }
  try {
    const w = await destino.createWritable();
    await w.write(bytes);
    await w.close();
  } catch (e) {
    console.warn('falha ao gravar no lugar escolhido', e);
    throw new ErroGravar();
  }
  return destino.name;
}

function baixar(bytes, nome) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ---------- estado dos controles ----------
function atualizar() {
  const tem = !!doc;
  if (!tem) el.andamento.hidden = true;
  el.btFechar.disabled = !tem;
  el.btCopiarHash.disabled = !tem;
  el.btProcurar.disabled = !tem;
  el.btPaginaInteira.disabled = !tem;
  el.btDesfazer.disabled = !tem || !historico.length;
  el.btRefazer.disabled = !tem || !refazer.length;
  el.btAnterior.disabled = !tem || atual === 0;
  el.btProxima.disabled = !tem || atual >= doc.paginas.length - 1;
  el.btMenos.disabled = !tem || zoom <= ZOOMS[0];
  el.btMais.disabled = !tem || zoom >= ZOOMS[ZOOMS.length - 1];
  el.zoomTexto.textContent = Math.round(zoom * 100) + '%';
  el.paginaTexto.textContent = tem ? `${atual + 1} de ${doc.paginas.length}` : '0 de 0';
  const pend = tem ? doc.paginas.reduce((n, p) => n + p.sugestoes.length, 0) : 0;
  el.btAceitarPagina.disabled = !tem || !doc.paginas[atual].sugestoes.length;
  el.btAceitarTodas.disabled = el.btDescartar.disabled = !pend;
  el.resumoAchados.textContent = tem ? resumoSugestoes() : '';
  montarListaSugestoes();
  const vistas = tem ? doc.paginas.filter((p) => p.vista).length : 0;
  const total = tem ? doc.paginas.length : 0;
  el.infoVistas.textContent = `${vistas} de ${total}`;
  el.barraVistas.style.width = total ? Math.round((100 * vistas) / total) + '%' : '0';
  const todasVistas = tem && vistas === total;
  el.revisei.disabled = !todasVistas;
  if (!todasVistas) el.revisei.checked = false;
  el.dicaRevisei.textContent = !tem ? 'Abra um PDF.' : todasVistas
    ? 'Confira de novo cada página antes de marcar.' : 'Passe por todas as páginas para liberar.';
  el.btSalvar.disabled = !tem || !el.revisei.checked || document.body.classList.contains('ocupado');
  el.carDica.textContent = !carimbo.ativo ? 'Desligado.' : carimbo.todas || !tem || carimbo.pagina === atual
    ? 'Arraste o carimbo na página para mudar de lugar.'
    : `O carimbo está na página ${carimbo.pagina + 1}. Marque de novo "Só numa página" para trazê-lo para cá.`;
  el.infoHashSaida.textContent = tem ? doc.hashSaida : '';
  el.infoHashSaida.hidden = el.rotuloHashSaida.hidden = !(tem && doc.hashSaida);
  el.infoConferido.textContent = tem && doc.salvo && doc.conferencia ? doc.conferencia : '';
  el.infoConferido.hidden = !el.infoConferido.textContent;
  el.btProcurar.disabled = !tem || procurando;
  el.btProcurarTodos.hidden = docs.length < 2;
  el.btProcurarTodos.disabled = procurando;
  el.btProximo.hidden = !proximoArquivo();
  atualizarAbas();
  atualizarMiniaturas();
}

// próximo arquivo, depois do da tela, que ainda não foi salvo como está
function proximoArquivo() {
  if (!doc || docs.length < 2) return null;
  const k = docs.indexOf(doc);
  for (let j = 1; j < docs.length; j++) {
    const d = docs[(k + j) % docs.length];
    if (!d.salvo || !d.hashSaida) return d;
  }
  return null;
}

function atualizarAbas() {
  [...el.abas.children].forEach((aba, k) => {
    const d = docs[k];
    if (!d) return;
    const [rotulo, classe] = situacao(d);
    const sit = aba.querySelector('.situacao');
    sit.textContent = rotulo;
    sit.className = 'situacao ' + classe;
  });
}

// ---------- ligações ----------
function escolherFerramenta(nome) {
  ferramenta = nome;
  document.querySelectorAll('[data-ferramenta]').forEach((b) => b.classList.toggle('ativo', b.dataset.ferramenta === nome));
  el.tela.classList.toggle('borracha', nome === 'borracha');
  el.tela.classList.toggle('texto', nome === 'texto');
}

function mudarZoom(passo) {
  if (!doc) return;
  const k = ZOOMS.indexOf(zoom) + passo;
  if (k < 0 || k >= ZOOMS.length) return;
  zoom = ZOOMS[k];
  desenharBase().then((i) => { if (i === atual) marcarVisto(); });
  atualizar();
}

function iniciar() {
  const pref = lerPref();
  el.sobreVersao.textContent = VERSAO;
  document.getElementById('versaoInstalada').textContent = VERSAO;
  for (const [chave, nome] of Object.entries(TIPOS)) {
    const l = document.createElement('label');
    l.className = 'op';
    const c = document.createElement('input');
    c.type = 'checkbox';
    c.value = chave;
    // tipo que a pessoa ainda não viu (chegou numa versão nova) começa no padrão, não desmarcado
    const visto = Array.isArray(pref.tipos) && (!Array.isArray(pref.tiposVistos) ? chave in { cpf: 1, cnpj: 1, rg: 1, email: 1, telefone: 1, cep: 1 }
      : pref.tiposVistos.includes(chave));
    c.checked = visto ? pref.tipos.includes(chave) : !DESMARCADOS.includes(chave);
    c.addEventListener('change', gravarPref);
    l.append(c, ' ' + nome);
    el.tipos.append(l);
  }
  if (pref.formato === 'jpeg') el.formato.value = 'jpeg';
  if (pref.folha === false) el.folha.checked = false;
  if (pref.avisos === false) el.mostrarAvisos.checked = false;
  if (pref.andamento === false) el.guardarAndamento.checked = false;
  limparAndamentoVelho();
  el.guardarAndamento.addEventListener('change', () => {
    if (el.guardarAndamento.checked) gravarAndamento();
    else apagarTodoAndamento();
    gravarPref();
  });
  el.btRecuperar.addEventListener('click', recuperarAndamento);
  el.btApagarTudo.addEventListener('click', apagarTudoGuardado);
  el.btDescartarAndamento.addEventListener('click', descartarAndamento);
  // a janela escondida ou fechando grava na hora o que ainda estava esperando
  document.addEventListener('visibilitychange', () => { if (tempoAndamento) gravarAndamento(); });
  window.addEventListener('pagehide', () => { if (tempoAndamento) gravarAndamento(); });
  el.carTexto.value = carimbo.texto;

  el.btAbrir.addEventListener('click', () => el.entrada.click());
  el.entrada.addEventListener('change', () => { abrirArquivos([...el.entrada.files]); el.entrada.value = ''; });
  el.btFechar.addEventListener('click', () => fechar());
  el.btSobre.addEventListener('click', () => el.sobre.showModal());
  el.btCopiarHash.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(doc.hash); avisar('SHA-256 copiado.'); }
    catch (e) { console.warn('cópia recusada', e); avisar('O navegador não deixou copiar: selecione o código e copie.', true); }
  });
  document.querySelectorAll('[data-ferramenta]').forEach((b) => b.addEventListener('click', () => escolherFerramenta(b.dataset.ferramenta)));
  document.querySelectorAll('[data-cor]').forEach((b) => b.addEventListener('click', () => {
    cor = b.dataset.cor;
    document.querySelectorAll('[data-cor]').forEach((o) => o.classList.toggle('ativo', o === b));
  }));
  document.querySelectorAll('[data-espessura]').forEach((b) => b.addEventListener('click', () => {
    espessura = +b.dataset.espessura || 9;
    document.querySelectorAll('[data-espessura]').forEach((o) => o.classList.toggle('ativo', o === b));
    escolherFerramenta('caneta');
  }));
  el.btPaginaInteira.addEventListener('click', cobrirPagina);
  el.btDesfazer.addEventListener('click', desfazer);
  el.btRefazer.addEventListener('click', refazerUltimo);
  el.btMenos.addEventListener('click', () => mudarZoom(-1));
  el.btMais.addEventListener('click', () => mudarZoom(1));
  el.btAnterior.addEventListener('click', () => mostrar(atual - 1));
  el.btProxima.addEventListener('click', () => mostrar(atual + 1));
  el.btProcurar.addEventListener('click', () => doc && procurarArquivos([doc]));
  el.btProcurarTodos.addEventListener('click', () => procurarArquivos(docs.slice()));
  el.btProximo.addEventListener('click', () => ativar(proximoArquivo()));
  el.btAceitarPagina.addEventListener('click', aceitarPagina);
  el.btAceitarTodas.addEventListener('click', aceitarTodas);
  el.btAceitarMarcadas.addEventListener('click', aceitarMarcadas);
  el.rotuloTarja.addEventListener('input', () => {
    rotuloTarja = el.rotuloTarja.value.replace(/\s+/g, ' ').trim().slice(0, 60);
    // muda o PDF de todos os arquivos: pede conferência de novo, como o carimbo
    carimboMudou();
    desenharTela();
    if (doc) doc.paginas.forEach((_, i) => redesenharMiniatura(i));
  });
  el.btDescartar.addEventListener('click', descartar);
  for (const c of [el.carAtivo, el.carTodas, el.carUma, el.carHash, el.carData]) c.addEventListener('change', mudouCarimbo);
  el.carTexto.addEventListener('input', mudouCarimbo);
  el.opOcr.hidden = !ocrDisponivel();
  lerTermosGuardados();
  mudouTermos();
  el.termos.addEventListener('input', mudouTermos);
  el.btImportarTermos.addEventListener('click', () => el.entradaTermos.click());
  el.entradaTermos.addEventListener('change', () => { importarTermos(el.entradaTermos.files[0]); el.entradaTermos.value = ''; });
  el.btLimparTermos.addEventListener('click', () => { el.termos.value = ''; mudouTermos(); });
  for (const c of [el.termoInteira, el.termoAcento]) c.addEventListener('change', mudouTermos);
  el.termoGuardar.addEventListener('change', () => {
    if (el.termoGuardar.checked) {
      if (!confirm('Guardar a lista de nomes neste computador?\n\nQualquer pessoa que usar este mesmo usuário do ' +
        'Windows depois vai ver a lista. Em computador dividido (sala dos professores, laboratório), não guarde.')) {
        el.termoGuardar.checked = false;
        return;
      }
      guardarTermos();
      avisar('A lista fica guardada neste navegador até você desmarcar "Guardar".');
    } else {
      esquecerTermos();
      avisar('Lista apagada deste computador.');
    }
  });
  el.carUma.addEventListener('click', () => { if (doc) { carimbo.pagina = atual; mudouCarimbo(); } });
  // com zoom, rolar pela página é o que a faz contar como vista
  el.palco.addEventListener('scroll', marcarVisto, { passive: true });
  window.addEventListener('resize', marcarVisto);
  el.formato.addEventListener('change', gravarPref);
  el.folha.addEventListener('change', gravarPref);
  el.mostrarAvisos.addEventListener('change', gravarPref);
  el.revisei.addEventListener('change', atualizar);
  el.btSalvar.addEventListener('click', salvar);

  // arrastar o PDF para qualquer lugar da janela
  window.addEventListener('dragover', (ev) => { ev.preventDefault(); el.palco.classList.add('arrastando'); });
  window.addEventListener('dragleave', (ev) => { if (!ev.relatedTarget) el.palco.classList.remove('arrastando'); });
  window.addEventListener('drop', (ev) => {
    ev.preventDefault();
    el.palco.classList.remove('arrastando');
    if (ocupado()) return;  // salvando: trocar de documento agora misturaria os dois
    const pdfs = [...(ev.dataTransfer?.files || [])].filter((a) => /\.pdf$/i.test(a.name) || a.type === 'application/pdf');
    if (pdfs.length) abrirArquivos(pdfs);
    else avisar('Solte um ou mais arquivos PDF.', true);
  });

  window.addEventListener('keydown', (ev) => {
    if (ocupado() || ev.target.closest('textarea, input, select') || el.sobre.open || !doc) return;
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && ev.key.toLowerCase() === 'z' && !ev.shiftKey) { ev.preventDefault(); desfazer(); }
    else if (ctrl && (ev.key.toLowerCase() === 'y' || (ev.key.toLowerCase() === 'z' && ev.shiftKey))) { ev.preventDefault(); refazerUltimo(); }
    else if (ctrl) return;
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); mostrar(atual - 1); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); mostrar(atual + 1); }
    else if (ev.key === '+' || ev.key === '=') mudarZoom(1);
    else if (ev.key === '-') mudarZoom(-1);
  });

  let tempoJanela = 0;
  window.addEventListener('resize', () => {
    clearTimeout(tempoJanela);
    tempoJanela = setTimeout(() => doc && desenharBase(), 150);
  });
  window.addEventListener('beforeunload', (ev) => {
    if (docs.some((d) => !d.salvo)) { ev.preventDefault(); ev.returnValue = ''; }
  });
  atualizar();
}

// worker do PDF.js a partir do texto guardado na própria página: funciona aberto direto do disco, sem servidor
const fonteWorker = document.getElementById('pdfjs-worker');
if (fonteWorker) {
  const url = URL.createObjectURL(new Blob([fonteWorker.textContent], { type: 'text/javascript' }));
  pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(url);
  // um PDFWorker só, entregue a cada documento: assim fechar um documento não derruba o worker dos outros
  trabalhadorPdf = new pdfjsLib.PDFWorker({ port: pdfjsLib.GlobalWorkerOptions.workerPort });
}
iniciar();
