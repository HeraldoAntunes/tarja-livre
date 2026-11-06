// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
//
// Interface: abrir o PDF, tarjar, sugerir, carimbar, conferir e salvar. Tudo o que fica guardado (tarjas, carimbo,
// sugestões) está em pontos do PDF, com origem no canto de cima da página; a tela só converte na hora de desenhar,
// então ampliar ou mudar de monitor não desalinha nada.
import { VERSAO } from './versao.js';
import { TIPOS, NOMES, DESMARCADOS, procurar, ajustarATinta, textoAparece, bateComImagem, temDesenhoAos, camadaEstranha, coberta, prepararTermos, corrigirOcr, selecionar, MAX_TERMOS, MAX_LETRAS_TERMO } from './achados.js';

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
  tipos: $('tipos'), resumoOpcoes: $('resumoOpcoes'), btProcurar: $('btProcurar'), resumoAchados: $('resumoAchados'),
  btAceitarPagina: $('btAceitarPagina'), btAceitarTodas: $('btAceitarTodas'), btDescartar: $('btDescartar'),
  carAtivo: $('carAtivo'), carTexto: $('carTexto'), carTodas: $('carTodas'), carUma: $('carUma'),
  carHash: $('carHash'), carData: $('carData'), carDica: $('carDica'),
  formato: $('formato'), folha: $('folha'), infoVistas: $('infoVistas'), barraVistas: $('barraVistas'),
  revisei: $('revisei'), dicaRevisei: $('dicaRevisei'), btSalvar: $('btSalvar'), progresso: $('progresso'),
  barraProgresso: $('barraProgresso'), rotuloHashSaida: $('rotuloHashSaida'), infoHashSaida: $('infoHashSaida'),
  aviso: $('aviso'), sobre: $('sobre'), sobreVersao: $('sobreVersao'), mostrarAvisos: $('mostrarAvisos'),
  infoConferido: $('infoConferido'), opOcr: $('opOcr'), ocrLigado: $('ocrLigado'), rotuloTarja: $('rotuloTarja'), listaSugestoes: $('listaSugestoes'),
  btSugestoes: $('btSugestoes'), acoesSugestao: $('acoesSugestao'), acoesTexto: $('acoesTexto'), btAceitarEsta: $('btAceitarEsta'),
  btDescartarEsta: $('btDescartarEsta'), passosSugestoes: $('passosSugestoes'), btConferir: $('btConferir'),
  avisoLista: $('avisoLista'), btAceitarMarcadas: $('btAceitarMarcadas'),
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
  const cor = (c) => typeof c === 'string' && (CORES_TARJA.includes(c.toLowerCase()) || c.toLowerCase() in CORES_ANTIGAS);
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
  // a tarja branca de uma versão antiga volta preta (a branca saiu na 1.2.3)
  let trocadas = 0;
  const comCorAtual = (m) => {
    const c = CORES_ANTIGAS[m.cor.toLowerCase()];
    if (!c) return m;
    trocadas++;
    return { ...m, cor: c };
  };
  registrar(a.paginas.map((p, i) => ({ pagina: i, antes: doc.paginas[i].marcas.slice(), depois: [...doc.paginas[i].marcas, ...p.marcas.map(marcaSoGeometria).map(comCorAtual)] }))
    .filter((m) => m.depois.length > m.antes.length));
  montarMiniaturas();
  // os botões das miniaturas são refeitos: o selo das marcas recuperadas tem de voltar já (como no resto do programa)
  atualizarMiniaturas();
  avisar('Marcas de antes recuperadas. Confira as páginas antes de salvar.' +
    (trocadas ? ` ${trocadas === 1 ? 'Uma tarja branca virou preta' : `${trocadas} tarjas brancas viraram pretas`}: a tarja branca saiu do programa.` : ''));
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
let ferramenta = 'mao';     // a Mão anda pela página sem tarjar nada (retorno do professor em 04/11/2026)
let ferramentaAntes = null;  // a ferramenta de antes, enquanto a barra de espaço segura a Mão
let espacoPreso = false;
// As cores da tarja: só escuras e opacas (retorno do professor em 04/11/2026). O PDF salvo é refeito como imagem com a
// tarja pintada por cima, então a cor não muda a remoção do dado; cor clara ou seletor livre ficam de fora, porque
// tarja clara parece marca-texto. A branca saiu na 1.2.3 (decisão do professor): numa página branca ela esconde que
// houve remoção, e quem lê não sabe que falta algo. A cor é sempre uma desta lista (andamentoValido, botões); o
// andamento guardado por uma versão antiga com tarja branca volta com ela preta (CORES_ANTIGAS).
const CORES_TARJA = ['#000000', '#3c4043', '#1a2b4c', '#5b1a2b', '#1e3b2a'];
const CORES_ANTIGAS = { '#ffffff': '#000000' };
let cor = '#000000';
let espessura = 9;
let historico = [];      // [{ mudancas: [{ pagina, antes, depois }] }]
let refazer = [];
let procurando = false;
let abertura = null;     // a abertura em andamento ({ cancelada, novos }): o Fechar a cancela (e2e no Linux, achado 4)
let rotuloTarja = '';      // texto opcional dentro das tarjas (vale para todos os arquivos)
let destaque = null;     // sugestão destacada na tela, escolhida na lista de revisão
let escolhida = null;    // { sg, i }: a sugestão aberta por último, com a barra de Aceitar e Descartar junto dela
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
  // o aviso importante (arquivo que não abriu, procura que falhou) fica mais tempo: em 4 s some antes de ser lido
  // (e2e no Linux da 1.2.2, achado 3)
  tempoAviso = setTimeout(() => el.aviso.classList.remove('visivel'), forcar ? 10000 : 4200);
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

// Lê um arquivo e devolve o documento pronto (ainda fora da lista), ou null com o motivo já avisado (ou se a
// abertura foi cancelada no meio).
async function carregarArquivo(arquivo, pedido = {}) {
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
    if (pedido.cancelada) {
      pdf.destroy();
      return null;
    }
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
  const pedido = { cancelada: false, novos: [] };
  abertura = pedido;
  atualizar();
  const limite = () => avisar(`Limite de ${MAX_ARQUIVOS} arquivos abertos: salve e feche alguns antes de abrir mais.`, true);
  for (const arquivo of lista) {
    if (pedido.cancelada) break;
    if (docs.length >= MAX_ARQUIVOS) {
      limite();
      break;
    }
    const novo = await carregarArquivo(arquivo, pedido);
    if (pedido.cancelada) {
      if (novo && !docs.includes(novo)) novo.pdf.destroy();
      break;
    }
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
      pedido.novos.push(novo);
    }
    primeiro = primeiro || novo;
    montarAbas();
  }
  if (abertura === pedido) abertura = null;
  if (pedido.cancelada) {
    // Fechar antes de o arquivo aparecer: os que esta abertura acabou de pôr nas abas saem também
    for (const d of pedido.novos) {
      if (d === doc || !docs.includes(d)) continue;
      docs.splice(docs.indexOf(d), 1);
      d.pdf.destroy();
    }
    montarAbas();
    atualizar();
    avisar('Abertura cancelada: o arquivo não foi aberto.');
    return;
  }
  atualizar();
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
  d.avisarFechou?.();
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
    for (let i = 0; minha === geracao && doc && i < doc.paginas.length; i++) await redesenharMiniatura(i);
  })();
}

// Cada pedido desenha num canvas próprio e só copia para a miniatura se ainda for o pedido mais novo daquela
// página: duas mudanças seguidas não disputam o mesmo canvas.
const pedidoMiniatura = [];
async function redesenharMiniatura(i) {
  const botao = el.miniaturas.children[i];
  if (!botao || !doc) return;
  const d = doc;
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
    const pg = await d.pdf.getPage(i + 1);
    await pg.render({ ...OPCOES_DESENHO, canvasContext: ctx, viewport: pg.getViewport({ scale: s }) }).promise;
  } catch (e) {
    // desenho cancelado porque o arquivo fechou ou saiu da tela não é erro (e2e no Linux da 1.2.2, achado 2)
    if (docs.includes(d) && d === doc && e?.name !== 'RenderingCancelledException') console.warn('miniatura não desenhada', i + 1, e);
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
  if (!doc || !base.canvas || base.pagina !== atual) { el.acoesSugestao.hidden = true; return; }
  posicionarAcoes();
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
    ctx.fillStyle = cor + 'b3';   // prévia: a cor escolhida, a 70%
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
  ctx.fillStyle = '#ffffff';   // toda cor da tarja é escura
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
  if (ferramenta === 'mao') {
    // a Mão rola a página ampliada; o clique parado numa sugestão só a mostra (não aceita nada)
    arrasto = { tipo: 'mao', x: ev.clientX, y: ev.clientY, sl: el.palco.scrollLeft, st: el.palco.scrollTop, inicio: pt, longe: false };
    el.tela.classList.add('agarrando');
  } else if (ferramenta === 'caneta') {
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
  el.tela.classList.remove('mover', 'agarrando');
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
  if (arrasto.tipo === 'mao') {
    const dx = ev.clientX - arrasto.x;
    const dy = ev.clientY - arrasto.y;
    if (Math.hypot(dx, dy) > 3) arrasto.longe = true;
    el.palco.scrollLeft = arrasto.sl - dx;
    el.palco.scrollTop = arrasto.st - dy;
    return;
  }
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
  el.tela.classList.remove('mover', 'agarrando');
  const p = doc.paginas[atual];
  if (a.tipo === 'mao') {
    voltarDaMao();
    if (a.longe) return;
    const k = sugestaoEm(a.inicio);
    if (k >= 0) mostrarSugestao(p.sugestoes[k], atual);
    return;
  }
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
  resumirOpcoes();
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
// o "Opções da procura" fechado diz o que vai ser procurado (a seção fica curta e o botão de procurar fica à vista)
function resumirOpcoes() {
  const n = tiposMarcados().length;
  const termos = termosAtuais().lista.length;
  el.resumoOpcoes.textContent = `Opções da procura: ${n === 1 ? '1 tipo de dado' : `${n} tipos de dado`}, ` +
    (termos === 0 ? 'nenhum nome na lista' : termos === 1 ? '1 nome na lista' : `${termos} nomes na lista`);
}

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
  const pedacos = await reconhecer(c, s);
  c.width = c.height = 0;
  return pedacos;
}

// O OCR da página já desenhada sem a camada de texto (tintaDaPagina com semTexto), na página que tem imagem ou
// desenho: o dado que só existe nele vira sugestão (regra da gestão na revisão da 1.2.3-rc.5)
async function lerDesenhoComOcr(sem) {
  const c = document.createElement('canvas');
  c.width = sem.largura;
  c.height = sem.altura;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, c.height);
  for (let i = 0; i < sem.lum.length; i++) {
    img.data[4 * i] = img.data[4 * i + 1] = img.data[4 * i + 2] = sem.lum[i];
    img.data[4 * i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const pedacos = await reconhecer(c, sem.escala);
  c.width = c.height = 0;
  return pedacos;
}

// As palavras que o OCR lê no desenho c, feito na escala s, em pontos da página
async function reconhecer(c, s) {
  const trabalhador = await obterOcr();
  const { data } = await trabalhador.recognize(c, {}, { blocks: true, text: false });
  const pedacos = [];
  for (const bloco of data.blocks || []) {
    for (const par of bloco.paragraphs || []) {
      for (const linha of par.lines || []) {
        const palavras = (linha.words || []).filter((w) => w.text && w.text.trim());
        palavras.forEach((w, j) => {
          const { x0, y0, x1, y1 } = w.bbox;
          // a caixa da palavra vem da imagem: base na parte de baixo dela, altura inteira
          pedacos.push({ str: corrigirOcr(w.text.trim()), x: x0 / s, y: y1 / s, w: (x1 - x0) / s, h: Math.max(3, (y1 - y0) / s),
                         eol: j === palavras.length - 1, ang: 0, familia: 'sans', ocr: true });
        });
      }
    }
  }
  return pedacos;
}

// Algum texto da página é pintado sem aparecer, pela própria pintura (modo 3 ou 7, opacidade de preenchimento quase
// zero, recorte de área zero)? Antes só os modos 3 e 7 contavam (revisão do Codex na 1.2.3-rc.2, opacity-zero). Os
// outros jeitos de esconder (tinta branca, recorte fora do texto, imagem por cima) não dá para dizer pela pintura,
// porque são comuns em documento normal (cabeçalho de tabela, logotipo); para eles, a conferência é o desenho da
// página com e sem o texto (textoAparece). Este atalho só poupa o segundo desenho.
async function temTextoEscondido(pg) {
  const { fnArray, argsArray } = await pg.getOperatorList();
  const O = pdfjsLib.OPS;
  let g = { modo: 0, opaco: 1, recorteVazio: false };
  const pilha = [];
  let caminhoVazio = false;
  let escondido = false;
  fnArray.forEach((f, j) => {
    const a = argsArray[j];
    if (f === O.save || f === O.paintFormXObjectBegin) pilha.push({ ...g });
    else if (f === O.restore || f === O.paintFormXObjectEnd) g = pilha.pop() || g;
    else if (f === O.setTextRenderingMode) g.modo = a[0];
    else if (f === O.setGState) for (const [k, v] of a[0]) { if (k === 'ca') g.opaco = v; }
    else if (f === O.constructPath) {
      const mm = a[2];
      caminhoVazio = !!mm && (mm[2] - mm[0] < 0.5 || mm[3] - mm[1] < 0.5);
    } else if (f === O.clip || f === O.eoClip) { if (caminhoVazio) g.recorteVazio = true; }
    else if (f === O.showText || f === O.showSpacedText) {
      if ([3, 7].includes(g.modo) || g.opaco < 0.05 || g.recorteVazio) escondido = true;
    }
  });
  return escondido;
}

// A página desenhada como na tela, em luminosidade de 0 a 255 por pixel (para ajustarATinta). semTexto desenha a
// página sem pintar texto nenhum (para textoAparece). O PDF.js pinta as letras com fillText e strokeText ou, com a
// fonte em traço (texto com padrão de cor, ou sem fonte do navegador, como no Node), com fill e stroke de um caminho,
// sempre de dentro de paintChar; o fill de caminho de fora dele (a máscara de imagem, por exemplo) continua no
// desenho. Se pintar de outro jeito (fonte Type3), as letras saem nos dois desenhos e a sugestão ganha "confira", o
// lado seguro.
const deLetra = () => /paintChar/.test(new Error().stack || '');
async function tintaDaPagina(pg, p, semTexto = false) {
  const s = escalaSegura(p, DPI_OCR / 72);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(p.w * s));
  c.height = Math.max(1, Math.round(p.h * s));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const imagens = [];
  // letras: onde cada letra que o desenho sem texto deixou de pintar cairia, em pixels (o ponto de partida dela, na
  // linha de base): letra pintada fora da camada de texto é texto que a procura não vê (revisão da gestão na rc.12, x5)
  const letras = [];
  const guardar = (x = 0, y = 0) => {
    const m = ctx.getTransform();
    if (letras.length < 20000) letras.push([m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
  };
  if (semTexto) {
    ctx.fillText = ctx.strokeText = (_, x, y) => guardar(x, y);
    for (const nome of ['fill', 'stroke']) {
      const original = ctx[nome].bind(ctx);
      ctx[nome] = (...a) => (a.length && typeof a[0] === 'object' && deLetra() ? guardar() : original(...a));
    }
    // onde cada imagem cai na página, em pixels (para bateComImagem): o PDF.js desenha imagem, máscara de imagem e
    // grupo transparente com drawImage. Sem saber onde, a imagem conta como a página inteira, o lado seguro
    const desenharImagem = ctx.drawImage.bind(ctx);
    ctx.drawImage = (...a) => {
      try {
        const [dx, dy, dw, dh] = a.length >= 9 ? a.slice(5, 9) : a.length >= 5 ? a.slice(1, 5) : [a[1], a[2], a[0].width, a[0].height];
        const t = ctx.getTransform();
        const xs = [];
        const ys = [];
        for (const [px, py] of [[dx, dy], [dx + dw, dy], [dx, dy + dh], [dx + dw, dy + dh]]) {
          xs.push(t.a * px + t.c * py + t.e);
          ys.push(t.b * px + t.d * py + t.f);
        }
        const r = { x0: Math.floor(Math.min(...xs)), y0: Math.floor(Math.min(...ys)), x1: Math.ceil(Math.max(...xs)), y1: Math.ceil(Math.max(...ys)) };
        imagens.push(Object.values(r).every(Number.isFinite) ? r : { x0: 0, y0: 0, x1: c.width, y1: c.height });
      } catch {
        imagens.push({ x0: 0, y0: 0, x1: c.width, y1: c.height });
      }
      return desenharImagem(...a);
    };
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  await pg.render({ ...OPCOES_DESENHO, canvasContext: ctx, viewport: pg.getViewport({ scale: s }) }).promise;
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  const lum = new Uint8Array(c.width * c.height);
  // afasta: quanto o canal mais escuro do pixel fica abaixo do branco (para temDesenho, que olha a cor por canal)
  const afasta = semTexto ? new Uint8Array(lum.length) : undefined;
  for (let i = 0; i < lum.length; i++) {
    lum[i] = px[4 * i] * 0.299 + px[4 * i + 1] * 0.587 + px[4 * i + 2] * 0.114;
    if (afasta) afasta[i] = 255 - Math.min(px[4 * i], px[4 * i + 1], px[4 * i + 2]);
  }
  const tinta = { largura: c.width, altura: c.height, escala: s, lum, afasta, imagens, letras };
  c.width = c.height = 0;
  return tinta;
}

// Dá a vez à tela no meio de uma conta longa (temDesenho numa página grande levava até 7 s de tela parada, com o
// processador freado 4x, na rc.7), mas só depois de 30 ms desde a última vez: cada pausa custa alguns ms. Usa o
// scheduler.yield do navegador (Edge e WebView2); onde não houver, a conta vai de uma vez, como antes.
let ultimaVez = 0;
function ceder() {
  const sc = globalThis.scheduler;
  if (Date.now() - ultimaVez < 30 || typeof sc?.yield !== 'function') return null;
  return sc.yield().then(() => { ultimaVez = Date.now(); });
}

// Espera um pedido ao PDF.js do arquivo, mas desiste com erro se o arquivo for fechado: o pedido feito ao PDF já
// destruído pode ficar pendente para sempre, sem resolver nem dar erro, e a procura nunca terminaria (o Procurar
// ficava desligado até recarregar a página; e2e no Linux da 1.2.2, achado 1).
function enquantoAberto(d, pedido) {
  if (!docs.includes(d)) return Promise.reject(new Error('arquivo fechado'));
  d.fechou = d.fechou || new Promise((_, nao) => { d.avisarFechou = () => nao(new Error('arquivo fechado')); });
  d.fechou.catch(() => {});
  return Promise.race([pedido, d.fechou]);
}

// O que a lista diz da sugestão tirada da camada de texto invisível, da mais grave para a mais leve (ajustarATinta).
const NOTAS_TINTA = ['sem-letras', 'longe', 'curta', 'cresceu', 'ajustada'];
// quando a tarja pode ter ido para outro lugar que não o dado (decisão da gestão na revisão da rc.4)
const OUTRO_PONTO = 'o dado pode estar em outro ponto da página; procure e tarje à mão';
// a página com imagem ou desenho fora de linha reta e retângulo (temDesenho): todas as sugestões dela saem com
// "confira", também as do texto que está certo, e a nota diz por quê (regra da gestão na revisão da 1.2.3-rc.5)
const AVISO_DESENHO = 'esta página tem imagem ou desenho; o programa pode não ver dados que estejam nela; confira a página inteira';
// a sugestão do OCR da página digitalizada: o OCR pode não ler tudo (revisão da gestão na rc.7, A3)
const AVISO_OCR = 'lida pelo OCR, que pode errar letras ou não ler o dado pequeno, claro ou girado; confira a página inteira';
// a página cuja camada de texto parece não dizer o que está desenhado (camadaEstranha: letras de outro alfabeto
// misturadas, ideogramas, caracteres sem desenho conhecido): a procura nela não basta (revisão da gestão na rc.11, w1 e w2)
// Quantas letras pintadas (tintaDaPagina com semTexto) caem fora de todos os pedaços da camada de texto, com folga de
// meia letra (do texto girado, a caixa vai até o comprimento dele em qualquer direção)
function letrasForaDaCamada(sem, pedacos) {
  const s = sem.escala;
  const caixas = pedacos.filter((p) => String(p.str || '').trim()).map((p) => {
    const f = p.ang ? p.w + p.h : 0.6 * p.h;
    return p.ang
      ? [(p.x - f) * s, (p.y - f) * s, (p.x + f) * s, (p.y + f) * s]
      : [(p.x - f) * s, (p.y - 1.3 * p.h) * s, (p.x + p.w + f) * s, (p.y + 0.6 * p.h) * s];
  });
  let fora = 0;
  for (const [x, y] of sem.letras || []) if (!caixas.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d)) fora++;
  return fora;
}
const AVISO_CAMADA = 'o texto desta página tem letras que o programa não lê direito; o dado pode estar escrito nela sem ser achado; confira a página inteira';
const TEXTO_NOTA = {
  desenho: 'confira: ' + AVISO_DESENHO,
  camada: 'confira: ' + AVISO_CAMADA,
  ocr: 'confira: ' + AVISO_OCR,
  imagem: 'confira: a camada de texto não tem o tamanho e o lugar das letras da imagem; ' + OUTRO_PONTO,
  'sem-letras': 'confira: não achei estas letras na imagem; ' + OUTRO_PONTO,
  longe: 'confira: a camada de texto não coincide com a imagem, a tarja foi para a palavra parecida mais perto; ' + OUTRO_PONTO,
  curta: 'confira: a tarja pode ter ficado curta; veja se alguma letra do dado ficou à mostra ao lado dela',
  cresceu: 'confira: a tarja cresceu até as letras da imagem e pode cobrir letras vizinhas',
  ajustada: 'confira: a tarja foi para as letras da imagem embaixo da camada de texto; veja se são mesmo o dado; ' + OUTRO_PONTO,
};

// Procura num arquivo (na tela ou não). Para no meio, sem estragar nada, se o arquivo for fechado.
// Devolve { total, semTexto } ou null se parou.
async function procurarEm(d, tipos, progresso, termos = null) {
  let semTexto = 0;
  const novas = [];
  const incompletas = [];   // páginas em que os campos de formulário e as anotações não puderam ser lidos
  const comDesenho = [];    // páginas com imagem ou desenho (temDesenho), com sugestão ou sem
  const comCamada = [];     // páginas com a camada de texto estranha (camadaEstranha), com sugestão ou sem
  const usarOcr = ocrDisponivel() && el.ocrLigado.checked;
  for (let i = 0; i < d.paginas.length; i++) {
    progresso(i);
    const pg = await enquantoAberto(d, d.pdf.getPage(i + 1));
    const v = pg.getViewport({ scale: 1 });
    const pedacos = (await enquantoAberto(d, textoDaPagina(d, i))).slice();
    // página sem texto (digitalizada): o texto sai da imagem, pelo OCR, quando a versão tem e a opção está ligada
    let ocr = false;
    if (!pedacos.length && usarOcr) {
      progresso(i, true);
      pedacos.push(...(await enquantoAberto(d, lerComOcr(pg, d.paginas[i]))));
      ocr = true;
    }
    const anotacoes = await enquantoAberto(d, sugestoesDeAnotacoes(pg, v, tipos, termos));
    if (!anotacoes) incompletas.push(i + 1);
    const doTexto = procurar(pedacos, tipos, medirTexto, termos);
    // camada de texto invisível sobre a imagem: a caixa vai até as letras da imagem (prova da tarja da 1.2.2), e a
    // sugestão sai sempre marcada para conferir, porque a camada pode não coincidir com a imagem (revisão do Codex
    // na 1.2.3-rc.1: dado legível no PDF salvo, com a sugestão sem aviso). O texto que não aparece na página
    // desenhada também é invisível, seja qual for o jeito de esconder: só conta como visível se tirá-lo do desenho
    // muda os pixels da caixa em toda a largura (textoAparece). Ter tinta na caixa não basta, porque a tinta pode
    // ser outra palavra, da imagem ou de traços, embaixo da camada, com o dado desenhado em outro lugar (revisões
    // do Codex na rc.2 e na rc.3). Vale para toda página com sugestão da camada de texto, com imagem ou sem
    const escondido = !ocr && doTexto.length ? await enquantoAberto(d, temTextoEscondido(pg)) : false;
    // TODA página é desenhada sem a camada de texto, também a que não tem sugestão: o dado pode estar só na imagem de
    // uma página cuja camada fala de outra coisa (revisão independente da gestão na rc.6, r4). Tem imagem ou desenho
    // (qualquer tinta que não é texto)? Então nenhuma conferência da caixa basta (o dado pode estar
    // desenhado longe da isca, em curvas ou em blocos): todas as sugestões dela saem com "confira", a página entra no
    // aviso e precisa ser vista de novo antes do Salvar, e no HTML com OCR o desenho sem a camada passa pelo OCR
    // (revisões da rc.5, n1 e n2, e da rc.6). A página digitalizada já lida inteira pelo OCR não passa de novo por ele.
    // O desenho a 200 ppp: com menos, a borda suavizada de uma letra branca sobre letra escura da imagem passava por
    // letra que aparece (branco-publico a 100 ppp, na rc.4 em preparo)
    const sem = await enquantoAberto(d, tintaDaPagina(pg, d.paginas[i], true));
    const desenho = await enquantoAberto(d, temDesenhoAos(sem, ceder));
    if (desenho) comDesenho.push(i + 1);
    // camada de texto estranha: mesma conferência da página de desenho (sugestões com "confira", aviso, visita
    // obrigatória antes do Salvar), com a nota própria
    // ou letras pintadas fora de qualquer pedaço da camada: o mapa de letras da fonte manda tudo para o espaço, e o
    // PDF.js tira esse texto da camada (revisão da gestão na rc.12, x5)
    const estranha = !ocr && (camadaEstranha(pedacos) || letrasForaDaCamada(sem, pedacos) >= 3);
    if (estranha) comCamada.push(i + 1);
    const confira = desenho || estranha;
    if (desenho && usarOcr && !ocr) progresso(i, true);
    const lidos = desenho && usarOcr && !ocr ? procurar(await enquantoAberto(d, lerDesenhoComOcr(sem)), tipos, medirTexto, termos) : [];
    // toda sugestão da página digitalizada lida pelo OCR sai com "confira" (revisão da gestão na rc.7, A3)
    if (ocr) for (const a of doTexto) { a.revisar = 'ocr'; a.desenho = true; }
    if (!ocr && doTexto.length) {
      const tinta = await enquantoAberto(d, tintaDaPagina(pg, d.paginas[i]));
      for (const a of doTexto) {
        a.desenho = confira;
        // o texto aparece, mas com imagem embaixo ou perto ele só basta se tiver o tamanho e o lugar das letras da
        // imagem: a camada visível minúscula (2 pt sob o dado de 18 pt), ou em cinza claro sobre outra palavra, com o
        // dado em outra linha, saía sem "confira" e o dado ficava inteiro (revisão independente da gestão na rc.4)
        const visivel = !escondido && a.caixas.every((k) => textoAparece(k, tinta, sem));
        if (visivel && !confira && a.caixas.every((k) => bateComImagem(k, sem))) continue;
        if (visivel && confira) { a.revisar = desenho ? 'desenho' : 'camada'; continue; }
        const ajustes = a.caixas.map((k) => ajustarATinta(k, tinta, k.h / 1.49));
        const novas = ajustes.flatMap((j) => j.caixas);
        // o texto visível continua tarjado; a tarja ajustada à imagem vai junto
        a.caixas = visivel ? [...a.caixas, ...novas.filter((n) => !a.caixas.some((k) => k.x === n.x && k.y === n.y && k.w === n.w && k.h === n.h))] : novas;
        a.revisar = visivel ? 'imagem' : NOTAS_TINTA.find((n) => ajustes.some((j) => j.nota === n));
      }
    }
    // o que o OCR leu no desenho sem a camada vira sugestão, menos o que a camada já cobre no mesmo lugar
    const sobre = (k, j) => Math.max(0, Math.min(k.x + k.w, j.x + j.w) - Math.max(k.x, j.x)) *
      Math.max(0, Math.min(k.y + k.h, j.y + j.h) - Math.max(k.y, j.y));
    const daCamada = doTexto.slice();
    for (const a of lidos) {
      if (a.caixas.every((k) => daCamada.some((b) => b.caixas.some((j) => sobre(k, j) >= 0.5 * k.w * k.h)))) continue;
      a.revisar = 'desenho';
      a.desenho = true;
      doTexto.push(a);
    }
    const achados = [...doTexto, ...(anotacoes || [])];
    if (!docs.includes(d)) return null;
    novas.push({ semTexto: pedacos.length === 0, ocr, achados, desenho: confira });
  }
  // só no fim aplica tudo de uma vez, descontando o que já foi tarjado nesse meio tempo
  novas.forEach(({ semTexto: vazia, ocr, achados, desenho }, i) => {
    const p = d.paginas[i];
    p.semTexto = vazia;
    p.ocr = ocr;
    // a página com imagem ou desenho volta a "não vista": o "Revisei" (e com ele o Salvar) só libera depois que a
    // pessoa passar de novo por ela, inteira, depois do aviso (revisão da gestão na rc.6, A2)
    p.desenho = desenho;
    if (desenho) { p.vista = false; p.vistos = null; }
    if (vazia) semTexto++;
    const tarjas = tarjasDa(d, i);
    p.sugestoes = achados.filter((a) => !a.caixas.every((k) => coberta(k, tarjas)));
  });
  d.procurou = tipos;
  d.termosProcurados = termos?.lista?.length || 0;  // só a quantidade: os termos são dado pessoal
  return { total: d.paginas.reduce((n, p) => n + p.sugestoes.length, 0), semTexto, incompletas, comDesenho, comCamada };
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
  const procurados = [];
  const falharam = [];
  const incompletos = [];
  const desenhos = [];
  const camadas = [];
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
        procurados.push(d);
        total += r.total;
        semTexto += r.semTexto;
        if (r.incompletas.length) incompletos.push(`${d.nome} (página ${r.incompletas.join(', ')})`);
        if (r.comDesenho.length) desenhos.push((lista.length > 1 ? `${d.nome}, ` : '') + `página ${r.comDesenho.join(', ')}`);
        if (r.comCamada.length) camadas.push((lista.length > 1 ? `${d.nome}, ` : '') + `página ${r.comCamada.join(', ')}`);
      }
    } catch (e) {
      // arquivo fechado no meio da procura: não é erro
      if (!docs.includes(d)) continue;
      console.warn('procura interrompida', d.nome, e);
      falharam.push(d.nome);
    }
  }
  procurando = false;
  // sugestão nova pede revisão nova: o "Revisei" de antes da procura não vale mais (revisão da gestão na rc.8, A3)
  if (total) el.revisei.checked = false;
  if (doc) desenharTela();
  atualizar();
  if (total) chamarLista();
  // o resultado é só dos arquivos procurados até o fim, e diz quais quando não é o da tela (revisão do Codex na
  // 1.2.3-rc.1: fechar o arquivo no meio da procura mostrava "Nada encontrado" sobre outro, ainda não procurado)
  const onde = procurados.length > 1 ? ` em ${procurados.length} arquivos`
    : procurados.length && procurados[0] !== doc ? ` em ${procurados[0].nome}` : '';
  // procura que falhou nunca vira "Nada encontrado": isso daria falsa segurança (auditoria de 29/10/2026)
  if (!procurados.length && !falharam.length) {
    avisar('A procura parou: o arquivo foi fechado antes do fim.', true);
  } else if (falharam.length) {
    avisar(`A procura em ${falharam.join(', ')} não terminou: tente de novo. Até lá, não conte com as sugestões ` +
      'desse arquivo.', true);
  } else if (incompletos.length) {
    avisar(`Procura incompleta: os campos de formulário e as anotações de ${incompletos.join('; ')} não puderam ser ` +
      `lidos. ${total ? `Há ${sugestoes(total)} no resto. ` : ''}Confira essas páginas à mão ou procure de novo. ${SO_AJUDA}`, true);
  } else if (semTexto) {
    avisar(`${semTexto} página(s) sem texto${onde} (talvez digitalizadas): nelas a procura não funciona, tarje à mão.` +
      (ocrDisponivel() ? '' : ' A versão com OCR lê páginas digitalizadas.') + ' ' + (total ? SO_AJUDA : NADA_NAO_QUER_DIZER), true);
  } else if (desenhos.length || camadas.length) {
    // a página com imagem ou desenho: o programa pode não ver o dado desenhado nela (regra da gestão na rc.5); a de
    // camada de texto estranha, o dado escrito nela (rc.11, w1 e w2)
    const partes = [];
    if (desenhos.length) {
      partes.push(`${desenhos.join('; ')}: imagem ou desenho; o programa pode não ver dados que estejam nela; confira a ` +
        'página inteira.' + (ocrDisponivel() ? '' : ' Sem OCR, o dado que só existe na imagem ou no desenho não é lido.'));
    }
    if (camadas.length) {
      partes.push(`${camadas.join('; ')}: texto com letras que o programa não lê direito; o dado pode estar escrito ` +
        'nela sem ser achado; confira a página inteira.');
    }
    avisar(`${sugestoes(total)}${onde}. ${partes.join(' ')} ${total ? SO_AJUDA : NADA_NAO_QUER_DIZER}`, true);
  } else {
    avisar(total ? `${sugestoes(total)}${onde}. Clique numa sugestão para ver onde está e aceitar as certas. ${SO_AJUDA}`
      : `Nada encontrado nos tipos marcados. ${NADA_NAO_QUER_DIZER}`);
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

// o que conferir numa sugestão marcada "confira", inteiro
function notaDa(sg) {
  return TEXTO_NOTA[sg.revisar] + (sg.desenho && !['desenho', 'ocr', 'camada'].includes(sg.revisar) ? '; ' + AVISO_DESENHO : '');
}

function montarListaSugestoes() {
  const todas = sugestoesPendentes();
  // só remonta quando a lista muda: navegar entre páginas não perde a rolagem nem as marcações
  const assinatura = docs.indexOf(doc) + ':' + todas.map(({ sg, i }) => i + (sg.desmarcada ? '-' : '+')
    + (sg.conferida ? 'v' : '') + sg.trecho).join('|');
  if (assinatura === assinaturaLista) return;
  assinaturaLista = assinatura;
  el.listaSugestoes.hidden = todas.length === 0;
  el.btAceitarMarcadas.hidden = todas.length === 0;
  const linhas = todas.slice(0, MAX_LINHAS_LISTA).map(({ sg, i }) => {
    const linha = document.createElement('div');
    linha.className = 'sugestao' + (sg.desmarcada ? ' desmarcada' : '') + (sg.revisar ? ' revisar' : '')
      + (sg.conferida ? ' conferida' : '');
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
    // o item é curto ("p. 1 · CPF · confira"); a nota inteira (o que conferir) fica no item para o leitor de tela e
    // aparece na tela junto da sugestão aberta (retorno do professor na rc.9: a nota repetida em cada item escondia o
    // aceitar)
    onde.append(`p. ${i + 1} · ${NOMES[sg.tipo] || sg.tipo}`);
    if (sg.revisar) {
      const marca = document.createElement('span');
      marca.className = 'marca-confira';
      marca.textContent = 'confira';
      const nota = document.createElement('span');
      nota.className = 'so-leitor';
      nota.textContent = ': ' + notaDa(sg).replace(/^confira: /, '');
      onde.append(' · ', marca, nota, sg.conferida ? ' (vista)' : '');
      linha.title = notaDa(sg);
    }
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
    mais.textContent = `e mais ${sugestoes(todas.length - MAX_LINHAS_LISTA)}, nas páginas.`;
    linhas.push(mais);
  }
  el.listaSugestoes.replaceChildren(...linhas);
  // o aviso das páginas com imagem ou desenho, uma vez só, acima da lista
  const comDesenho = [...new Set(todas.filter(({ sg }) => sg.revisar === 'desenho' || sg.revisar === 'ocr' || sg.desenho).map(({ i }) => i + 1))];
  const outras = todas.some(({ sg }) => sg.revisar && !(sg.revisar === 'desenho' || sg.revisar === 'ocr' || sg.desenho));
  const deCamada = new Set(todas.filter(({ sg }) => sg.revisar === 'camada').map(({ i }) => i + 1));
  const partes = [];
  if (comDesenho.length) {
    partes.push(`${comDesenho.length === 1 ? 'A página' : 'As páginas'} ${comDesenho.slice(0, 8).join(', ')}` +
      `${comDesenho.length > 8 ? '...' : ''} ${comDesenho.length === 1 ? 'tem' : 'têm'} ` +
      `${deCamada.size === comDesenho.length ? 'texto com letras que o programa não lê direito' : deCamada.size ? 'imagem, desenho ou texto que o programa não lê direito' : 'imagem ou desenho'}: ` +
      'o programa pode não ver dados que estejam nela; confira cada sugestão e a página inteira.');
  }
  if (outras) partes.push('As marcadas "confira" pedem que você olhe antes: o motivo aparece junto da sugestão, ao abrir.');
  el.avisoLista.textContent = partes.join(' ');
  el.avisoLista.hidden = !partes.length;
}

let tempoDestaque = 0;
// marcar = false: abre e destaca sem contar como conferida (a que abre sozinha depois do aceitar em grupo; ela só entra
// pelo Aceitar junto dela, e o Aceitar todas de novo não a aceita)
async function mostrarSugestao(sg, i, marcar = true) {
  destaque = sg;
  escolhida = { sg, i };
  if (marcar) sg.conferida = true;
  // a página ainda não vista (a com imagem ou desenho, depois da procura) passa a contar como vista ao abrir nela
  if (i !== atual || !doc.paginas[i].vista) await mostrar(i);
  else desenharTela();
  montarListaSugestoes();
  clearTimeout(tempoDestaque);
  tempoDestaque = setTimeout(() => { destaque = null; desenharTela(); }, 2500);
}

// A barra de Aceitar e Descartar fica junto da sugestão aberta (retorno do professor em 04/11/2026: as sugestões
// ficavam escondidas no painel). Some quando a sugestão sai da página na tela (aceita, descartada, outra página).
function posicionarAcoes() {
  const b = el.acoesSugestao;
  const p = doc?.paginas[atual];
  const sg = escolhida?.sg;
  if (!p || !sg || escolhida.i !== atual || !p.sugestoes.includes(sg) || el.tela.hidden || base.pagina !== atual) {
    b.hidden = true;
    return;
  }
  const k = sg.caixas[0];
  const s = el.tela.clientWidth / p.w;
  b.hidden = false;
  el.acoesTexto.textContent = (NOMES[sg.tipo] || sg.tipo) + (sg.revisar ? ' · ' + notaDa(sg) : '');
  // na altura da sugestão, sem cobrir a linha de baixo (de uma tabela, por exemplo; desde a rc.9) nem
  // o resto da linha: na margem à direita da página, se couber; senão, à direita da sugestão, à esquerda, ou embaixo
  const fimDaPagina = el.tela.offsetLeft + el.tela.clientWidth;
  const limiteDir = Math.max(el.palco.scrollWidth, el.palco.clientWidth) - 4;
  // a margem à direita da página, se tiver pelo menos 220 px, é o lugar: a barra encolhe para caber nela
  const margem = limiteDir - fimDaPagina - 14;
  b.style.maxWidth = margem >= 220 ? Math.min(340, margem) + 'px' : '';
  const largura = b.offsetWidth, altura = b.offsetHeight;
  const esq = el.tela.offsetLeft + k.x * s, dir = el.tela.offsetLeft + (k.x + k.w) * s;
  const meio = el.tela.offsetTop + (k.y + k.h / 2) * s - altura / 2;
  const limite = Math.max(el.palco.scrollWidth, el.palco.clientWidth) - 4;
  let x, y;
  if (fimDaPagina + 10 + largura <= limite) { x = fimDaPagina + 10; y = meio; }
  else if (dir + 8 + largura <= limite) { x = dir + 8; y = meio; }
  else if (esq - 8 - largura >= 4) { x = esq - 8 - largura; y = meio; }
  else { x = Math.max(4, Math.min(esq, limite - largura)); y = el.tela.offsetTop + (k.y + k.h) * s + 6; }
  b.style.left = Math.round(x) + 'px';
  b.style.top = Math.round(Math.max(4, y)) + 'px';
}

function aceitarEscolhida() {
  const p = doc?.paginas[atual];
  const k = escolhida && escolhida.i === atual ? p.sugestoes.indexOf(escolhida.sg) : -1;
  if (k < 0) return;
  escolhida = null;
  aceitar([[atual, k]]);
  avisar('1 tarja aplicada.' + (abrirProximaConfira() ? ' A próxima sugestão "confira" está aberta.' : ''));
}

function descartarEscolhida() {
  const p = doc?.paginas[atual];
  const k = escolhida && escolhida.i === atual ? p.sugestoes.indexOf(escolhida.sg) : -1;
  if (k < 0) return;
  escolhida = null;
  p.sugestoes.splice(k, 1);
  desenharTela();
  atualizar();
  if (abrirProximaConfira()) avisar('Sugestão descartada. A próxima sugestão "confira" está aberta.');
}

// leva o painel até a lista de sugestões e chama a atenção para ela
function chamarLista() {
  if (el.listaSugestoes.hidden) return;
  // o resumo fica logo abaixo do botão de procurar: o painel sobe até ele, e a lista e os botões de aceitar ficam
  // à vista sem esconder o botão (1366x768)
  el.resumoAchados.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  el.listaSugestoes.classList.add('chamando');
  setTimeout(() => el.listaSugestoes.classList.remove('chamando'), 1600);
}

// sugestão "confira" que a pessoa ainda não abriu na lista: os botões de aceitar em grupo não a aceitam, e o Salvar
// não passa com ela pendente (revisão do Codex na 1.2.3-rc.1)
const naoVista = (sg) => sg.revisar && !sg.conferida;

const tarjasAplicadas = (n) => (n === 0 ? 'Nenhuma tarja aplicada' : n === 1 ? '1 tarja aplicada' : `${n} tarjas aplicadas`);

// O que o aceitar em grupo fez. A sugestão "confira" só entra depois de vista: quando sobra alguma, o aviso diz isso com
// todas as letras e a primeira já abre na página, com Aceitar e Descartar junto dela (retorno do professor em
// 05/11/2026: "mandei procurar sugestão e aceitei, mas ele não tarjou"; com imagem na página, todas eram "confira" e o
// Aceitar todas não tarjava nada, com um aviso que começava por "0 tarja(s) aplicada(s)")
function avisoAceitas(n, ficaram) {
  if (ficaram) {
    avisar(`${tarjasAplicadas(n)}. ${ficaram === 1 ? 'Falta 1 sugestão marcada "confira"' : `Faltam ${ficaram} sugestões marcadas "confira"`}: ` +
      'elas só são tarjadas depois que você olha cada uma. A primeira está aberta na página: confira e clique em Aceitar ' +
      '(ou Descartar), e a próxima abre em seguida.', true);
    abrirProximaConfira();
  } else avisar(`${tarjasAplicadas(n)}. Confira cada página.`);
}

// abre na página a primeira sugestão "confira" ainda não vista (na página da tela primeiro); devolve se achou
function abrirProximaConfira() {
  if (!doc) return false;
  const ordem = [atual, ...doc.paginas.map((_, i) => i).filter((i) => i !== atual)];
  for (const i of ordem) {
    const sg = doc.paginas[i].sugestoes.find(naoVista);
    if (sg) { mostrarSugestao(sg, i, false); return true; }
  }
  return false;
}

function aceitarMarcadas() {
  const marcadas = sugestoesPendentes().filter(({ sg }) => !sg.desmarcada);
  if (!marcadas.length) {
    avisar('Nenhuma sugestão marcada.', true);
    return;
  }
  const pares = marcadas.filter(({ sg }) => !naoVista(sg)).map(({ i, k }) => [i, k]);
  aceitar(pares);
  avisoAceitas(pares.length, marcadas.length - pares.length);
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

// "1 sugestão", "3 sugestões": o plural certo nos avisos (pedido da gestão na rc.9)
const sugestoes = (n) => (n === 1 ? '1 sugestão' : `${n} sugestões`);
// desde a rc.12: a parte automática é só uma ajuda, nada dispensa a revisão humana visual
const SO_AJUDA = 'A procura é só uma ajuda: confira cada página com os próprios olhos antes de salvar.';
const NADA_NAO_QUER_DIZER = 'Isso não quer dizer que o documento não tem dados pessoais. ' + SO_AJUDA;

// pares [página, índice da sugestão] viram tarjas, na cor escolhida, num passo só
// do Desfazer
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
    for (const k of ks) for (const c of p.sugestoes[k].caixas) novas.push({ tipo: 'tarja', cor, ...c });
    // guarda as sugestões de antes: desfazer o aceite devolve as tarjas e as sugestões
    mudancas.push({ pagina: i, antes: p.marcas.slice(), depois: [...p.marcas, ...novas], sugestoes: p.sugestoes.slice(),
                    aceitas: ks.length });
  }
  if (mudancas.length) registrar(mudancas);
}

function aceitarPagina() {
  const sugestoes = doc.paginas[atual].sugestoes;
  const pares = sugestoes.flatMap((sg, k) => (naoVista(sg) ? [] : [[atual, k]]));
  aceitar(pares);
  if (pares.length < sugestoes.length) avisoAceitas(pares.length, sugestoes.length - pares.length);
}

function aceitarTodas() {
  const pares = [];
  let ficaram = 0;
  doc.paginas.forEach((p, i) => p.sugestoes.forEach((sg, k) => (naoVista(sg) ? ficaram++ : pares.push([i, k]))));
  aceitar(pares);
  avisoAceitas(pares.length, ficaram);
}

// Descartar continua permitido, por ser escolha explícita, mas a sugestão "confira" que ninguém abriu pede confirmação:
// sem isso, o Salvar deixava de barrar e o dado da página continuava legível no PDF (revisão do Codex na 1.2.3-rc.2)
function descartar() {
  const naoVistas = doc.paginas.reduce((n, p) => n + p.sugestoes.filter(naoVista).length, 0);
  if (naoVistas && !confirm(`${naoVistas === 1 ? '1 sugestão marcada com "confira" não foi conferida' : `${naoVistas} sugestões marcadas com "confira" não foram conferidas`}. Se descartar, ` +
    `${naoVistas === 1 ? 'esse dado continua legível' : 'esses dados continuam legíveis'} no PDF. Descartar mesmo assim?`)) return;
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
  if (procurando) {
    avisar('Espere a procura terminar: as sugestões dela ainda não estão na página. Depois confira e salve.', true);
    return;
  }
  const naoVistas = doc.paginas.reduce((n, p) => n + p.sugestoes.filter(naoVista).length, 0);
  if (naoVistas) {
    avisar(`Antes de salvar, confira ${naoVistas === 1 ? 'a sugestão marcada' : `as ${naoVistas} sugestões marcadas`} com "confira": clique em cada uma na ` +
      'lista para ver na página e aceite ou descarte.', true);
    return;
  }
  const pendentes = doc.paginas.reduce((n, p) => n + p.sugestoes.length, 0);
  if (pendentes && !confirm(`Ainda há ${pendentes === 1 ? '1 sugestão não aceita' : `${pendentes} sugestões não aceitas`}. Salvar mesmo assim?`)) return;
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
  el.btFechar.disabled = !tem && !abertura;
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
  el.btSugestoes.hidden = !pend;
  // o botão principal: "Conferir e aceitar" abre a primeira "confira" que falta, com Aceitar e Descartar junto dela, e
  // vai passando uma por uma; sem "confira" pendente, vira "Aceitar todas" (retorno do professor na rc.9)
  const faltaVer = tem ? doc.paginas.reduce((n, p) => n + p.sugestoes.filter(naoVista).length, 0) : 0;
  el.btConferir.hidden = !pend;
  el.btConferir.textContent = faltaVer ? `Conferir e aceitar (${pend})` : `Aceitar todas (${pend})`;
  el.btSugestoes.textContent = pend === 1 ? '1 sugestão para conferir' : `${pend} sugestões para conferir`;
  el.passosSugestoes.hidden = !pend;
  if (!tem) el.acoesSugestao.hidden = true;
  montarListaSugestoes();
  const vistas = tem ? doc.paginas.filter((p) => p.vista).length : 0;
  const total = tem ? doc.paginas.length : 0;
  el.infoVistas.textContent = `${vistas} de ${total}`;
  el.barraVistas.style.width = total ? Math.round((100 * vistas) / total) + '%' : '0';
  const todasVistas = tem && vistas === total;
  // durante a procura, nem "Revisei" nem Salvar: o PDF salvo no meio dela sairia sem as tarjas das sugestões que ainda
  // vão chegar, sem pergunta nenhuma (revisão independente da gestão na rc.8, A3: Salvar 0,3 s depois de Procurar)
  el.revisei.disabled = !todasVistas || procurando;
  if (!todasVistas) el.revisei.checked = false;
  const desenhoFalta = tem ? doc.paginas.flatMap((p, i) => (p.desenho && !p.vista ? [i + 1] : [])) : [];
  el.dicaRevisei.textContent = !tem ? 'Abra um PDF.' : procurando ? 'Procurando: espere terminar para revisar e salvar.' : todasVistas
    ? 'Confira de novo cada página antes de marcar.'
    : desenhoFalta.length && vistas + desenhoFalta.length === total
      ? `Passe pela${desenhoFalta.length > 1 ? 's' : ''} página${desenhoFalta.length > 1 ? 's' : ''} com aviso ` +
        `(${desenhoFalta.slice(0, 8).join(', ')}${desenhoFalta.length > 8 ? '...' : ''}) e confira a página inteira para liberar.`
      : 'Passe por todas as páginas para liberar.';
  el.btSalvar.disabled = !tem || !el.revisei.checked || procurando || document.body.classList.contains('ocupado');
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
// solta a barra de espaço: volta para a ferramenta de antes, mas só depois de terminar o arrasto da Mão
function voltarDaMao() {
  if (ferramentaAntes && !espacoPreso && !arrasto) { escolherFerramenta(ferramentaAntes); ferramentaAntes = null; }
}

function escolherFerramenta(nome) {
  ferramenta = nome;
  document.querySelectorAll('[data-ferramenta]').forEach((b) => b.classList.toggle('ativo', b.dataset.ferramenta === nome));
  el.tela.classList.toggle('borracha', nome === 'borracha');
  el.tela.classList.toggle('mao', nome === 'mao');
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
    c.addEventListener('change', () => { gravarPref(); resumirOpcoes(); });
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
  // o cartão "Abra um PDF para começar" também abre (retorno do professor em 04/11/2026)
  el.vazio.addEventListener('click', () => el.entrada.click());
  el.vazio.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.entrada.click(); }
  });
  el.entrada.addEventListener('change', () => { abrirArquivos([...el.entrada.files]); el.entrada.value = ''; });
  // durante uma abertura, o Fechar cancela o que ainda não apareceu (e2e no Linux da 1.2.2, achado 4: o Fechar ficava
  // desligado sem aba, e o arquivo abria logo depois)
  el.btFechar.addEventListener('click', () => {
    if (abertura) abertura.cancelada = true;
    else fechar();
  });
  el.btSobre.addEventListener('click', () => el.sobre.showModal());
  el.btCopiarHash.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(doc.hash); avisar('SHA-256 copiado.'); }
    catch (e) { console.warn('cópia recusada', e); avisar('O navegador não deixou copiar: selecione o código e copie.', true); }
  });
  document.querySelectorAll('[data-ferramenta]').forEach((b) => b.addEventListener('click', () => { ferramentaAntes = null; escolherFerramenta(b.dataset.ferramenta); }));
  escolherFerramenta(ferramenta);
  document.querySelectorAll('[data-cor]').forEach((b) => b.addEventListener('click', () => {
    if (!CORES_TARJA.includes(b.dataset.cor)) return;
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
  el.btSugestoes.addEventListener('click', chamarLista);
  el.btConferir.addEventListener('click', () => {
    if (!doc) return;
    if (abrirProximaConfira()) avisar('Confira a sugestão aberta na página e clique em Aceitar ou Descartar, junto dela; a próxima abre em seguida.');
    else aceitarTodas();
  });
  el.btAceitarEsta.addEventListener('click', aceitarEscolhida);
  el.btDescartarEsta.addEventListener('click', descartarEscolhida);
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
  window.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
    el.palco.classList.add('arrastando');
  });
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
    else if (ev.key === ' ') {
      // segurar a barra de espaço vira Mão por um momento, como nos editores de imagem
      ev.preventDefault();
      espacoPreso = true;
      if (!ev.repeat && ferramenta !== 'mao' && !arrasto) { ferramentaAntes = ferramenta; escolherFerramenta('mao'); }
    }
  });
  const soltarEspaco = () => {
    espacoPreso = false;
    voltarDaMao();
  };
  window.addEventListener('keyup', (ev) => { if (ev.key === ' ') soltarEspaco(); });
  window.addEventListener('blur', soltarEspaco);

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
