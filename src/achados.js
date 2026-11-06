// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
//
// Procura de dados pessoais no texto de uma página. Sem DOM e sem PDF.js: recebe os pedaços de texto já com
// posição (x, y da linha de base, largura e altura, em pontos, origem no canto de cima) e devolve as caixas a tarjar.

export const TIPOS = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  rg: 'RG',
  email: 'E-mail',
  telefone: 'Telefone',
  cep: 'CEP',
  pis: 'PIS/NIS',
  titulo: 'Título de eleitor',
  cnh: 'CNH',
  processo: 'Processo (NUP)',
};

// tipos que vêm desmarcados de início: número de processo quase sempre precisa ficar visível
export const DESMARCADOS = ['processo'];

// rótulos de tudo o que a procura acha, inclusive os termos digitados pelo usuário (que não são uma caixa de marcar)
export const NOMES = { ...TIPOS, termo: 'Termo da lista' };

export const MAX_TERMOS = 500;
export const MAX_LETRAS_TERMO = 200;

// Lista digitada, colada ou importada: um termo por linha (ou separado por ponto e vírgula), sem repetidos.
export function prepararTermos(texto) {
  const vistos = new Set();
  const lista = [];
  for (const bruto of String(texto || '').split(/[\r\n;]+/)) {
    const termo = bruto.replace(/\s+/g, ' ').trim().slice(0, MAX_LETRAS_TERMO);
    const chave = termo.toLocaleLowerCase('pt-BR');
    if (termo.length < 2 || vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push(termo);
    if (lista.length >= MAX_TERMOS) break;
  }
  return lista;
}

// Letras de outro alfabeto que se desenham iguais às latinas (cirílico e grego): a procura as lê como latinas, para
// que "ЅІGІLО" com S, I e O cirílicos case com "SIGILO" (revisão independente da gestão na rc.11, w2). Também os
// traços parecidos com o hífen.
const SOSIAS = {
  'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'І': 'I', 'Ј': 'J', 'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P',
  'Ѕ': 'S', 'Т': 'T', 'Х': 'X', 'Ү': 'Y', 'Ԁ': 'D', 'Ԛ': 'Q', 'Ԝ': 'W',
  'а': 'a', 'с': 'c', 'е': 'e', 'һ': 'h', 'і': 'i', 'ј': 'j', 'о': 'o', 'р': 'p', 'ѕ': 's', 'х': 'x', 'у': 'y',
  'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w', 'ү': 'y',
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P',
  'Τ': 'T', 'Υ': 'Y', 'Χ': 'X', 'ο': 'o', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ρ': 'p', 'ϲ': 'c', 'ϳ': 'j', 'Ϲ': 'C',
  // as gregas de fórmula que lembram latinas (revisão da gestão na rc.13, y1: "mαriαnα")
  'α': 'a', 'γ': 'y', 'η': 'n', 'μ': 'u', 'χ': 'x', 'ω': 'w', 'τ': 't',
  // e as que faltavam (revisão da gestão na rc.14, z2b: "εvα")
  'ε': 'e', 'σ': 'o', 'ς': 'o', 'υ': 'u',
  // traços que se desenham como hífen: o hífen suave (U+00AD, que a extração dá no lugar do "-" de muitas fontes
  // embutidas), o hífen Unicode, o inseparável e o sinal de menos
  '\u00AD': '-', '\u2010': '-', '\u2011': '-', '\u2212': '-',
};
// A letra como a procura a compara: sósia vira latina e a forma de compatibilidade vira a comum (NFKC: o "１" de
// largura total vira "1", a ligadura "ﬁ" vira "fi", o numeral romano "Ⅼ" vira "L").
const comoLatina = (c) => (SOSIAS[c] || c).normalize('NFKC');
// O texto para os padrões dos tipos (CPF, e-mail...), com o mesmo tamanho do original para as posições valerem: a
// letra cuja forma comum tem outro tamanho fica como está.
export function textoDeProcura(texto) {
  let s = '';
  for (const c of texto) {
    const n = comoLatina(c);
    s += n.length === c.length ? n : c;
  }
  return s;
}

// Tira acentos e maiúsculas guardando, para cada letra do resultado, a posição dela no texto original. Sósias e formas
// de compatibilidade viram a letra comum mesmo sem tirar acento. A pontuação e os símbolos não contam, nos dois lados
// da comparação (revisão da gestão na rc.12, A2: o PDF.js tira o hífen suave da camada, e "123.456.789-00" não casava
// com "123.456.78900"): entre dois algarismos, somem; no resto, viram espaço (o "Nome:Fulano" continua com a borda da
// palavra antes de "Fulano").
const PONTUACAO = /[\p{P}\p{S}]/u;
function normalizar(texto, semAcento, literal = false) {
  const letras = [];
  for (let i = 0; i < texto.length; i++) {
    let base = comoLatina(texto[i]);
    if (semAcento) base = base.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (const c of base) letras.push([c, i]);
  }
  let norm = '';
  const mapa = [];
  const algarismo = (k) => k >= 0 && k < letras.length && /\p{N}/u.test(letras[k][0]);
  for (let k = 0; k < letras.length; k++) {
    let [c, i] = letras[k];
    if (!literal && PONTUACAO.test(c)) {
      // a pontuação seguida (o ".-" de "1.-2"): olha o vizinho de fora da sequência
      let a = k - 1, b = k + 1;
      while (a >= 0 && PONTUACAO.test(letras[a][0])) a--;
      while (b < letras.length && PONTUACAO.test(letras[b][0])) b++;
      if (algarismo(a) && algarismo(b)) continue;
      c = ' ';
    }
    norm += c;
    mapa.push(i);
  }
  return { norm, mapa };
}

// A camada de texto da página parece não dizer o que está desenhado? Então a procura nela não basta, e a página pede
// conferência como a de desenho (revisões independentes da gestão na rc.11, w1 e w2, e na rc.12, x2; decisão do
// professor):
// - letra de escrita que não é a latina (cirílico, grego, cherokee, armênio, ideograma, qualquer uma), menos as letras
//   gregas de fórmula que não se parecem com latinas (CIENCIA: α, β, Δ, μ, π, Ω...), misturada com letra latina na
//   mesma palavra;
// - letra ou caractere que não se espera num documento em português: essas letras de outra escrita, e também área de
//   uso privado, U+FFFD, caractere de controle ou sem definição. Três deles na mesma palavra, ou 2% das letras da página
//   (com 3 ou mais), bastam. O marcador de lista de fonte Symbol (um caractere da área de uso privado, sozinho) não dá
//   alarme.
const ESTRANHA = /[\p{Co}\p{Cn}\u{FFFD}]|[\p{Cc}--[\t\n\r]]/v;
// (com o micro, U+00B5, e o ohm, U+2126, que o Unicode também conta como gregos)
const CIENCIA = new Set([...'αβγδεζηθλμξπσςτφχψωΓΔΘΛΞΠΣΦΨΩ', 'µ', 'Ω']);
// a letra matemática do editor de equações (𝑥, 𝐴, ℎ, 𝛼) é vista na forma comum, pelo NFKC; a sósia cirílica, não
const UNIDADE_MICRO = /^[µμ](?:m|g|s|S|F|A|V|L|l|W|H|J|C|N|Pa|mol|Hz|in|Sv|Gy)$/u;
const outraLetra = (c) => [...c.normalize('NFKC')].some((k) => /\p{L}/u.test(k) && !/\p{Script=Latin}/u.test(k) && !CIENCIA.has(k));
export function camadaEstranha(pedacosPagina) {
  let letras = 0;
  let estranhas = 0;
  for (const p of pedacosPagina) {
    for (const palavra of String(p.str || '').split(/\s+/)) {
      if (!palavra) continue;
      let n = 0;
      for (const c of palavra) {
        letras++;
        if (ESTRANHA.test(c) || outraLetra(c)) n++;
      }
      if (n >= 3) return true;
      // a mistura se mede em cada sequência de letras seguidas ("μS/cm" são "μS" e "cm"): latina com letra de outra
      // escrita, ou com uma grega de fórmula quando há 3 latinas ou mais ("mαriαnα"; "μm", "Δt" e "kΩ" ficam livres)
      for (const seq of palavra.match(/\p{L}+/gu) || []) {
        let lat = 0, outra = false, formula = false, sosia = false;
        for (const c of seq) {
          const k = c.normalize('NFKC');
          if (outraLetra(c)) outra = true;
          else if (/\p{Script=Latin}/u.test(k)) lat++;
          else if (CIENCIA.has(k)) { formula = true; if (SOSIAS[k]) sosia = true; }
        }
        // a grega sósia de uma latina (α, ε, ο, ν...) junto de qualquer letra latina é mistura ("εvα", rc.14, z2b), menos
        // na unidade com o micro ("μm", "μS", "μmol"); a de fórmula que não lembra latina (Δ, π, θ, Ω), só a partir de 3
        if ((lat && outra) || (!UNIDADE_MICRO.test(seq) && ((sosia && lat) || (formula && lat >= 3)))) return true;
      }
      estranhas += n;
    }
  }
  return estranhas >= 3 && estranhas >= 0.02 * letras;
}

export const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Trechos [ini, fim) do texto juntado que casam com algum termo da lista. Entre as palavras de um termo vale
// qualquer espaço (inclusive a quebra de linha, que juntarTexto transforma em espaço).
function acharTermos(texto, { lista = [], palavraInteira = true, semAcento = true } = {}) {
  // o termo com menos de 2 letras ou algarismos ("(a+)+$") é procurado ao pé da letra, com a pontuação: sem ela,
  // sobraria uma letra solta, que casa em todo lugar (regressão do auditor externo, na rc.15)
  const comum = normalizar(texto, semAcento);
  let literal = null;
  const borda = palavraInteira ? ['(?<![\\p{L}\\p{N}])', '(?![\\p{L}\\p{N}])'] : ['', ''];
  const trechos = [];
  for (const termo of lista) {
    const aoPe = (termo.match(/[\p{L}\p{N}]/gu) || []).length < 2;
    const { norm, mapa } = aoPe ? (literal ||= normalizar(texto, semAcento, true)) : comum;
    const palavras = normalizar(termo, semAcento, aoPe).norm.split(/\s+/).filter(Boolean).map(escaparRegex);
    if (!palavras.length) continue;
    const re = new RegExp(borda[0] + palavras.join('\\s+') + borda[1], 'gu');
    for (const m of norm.matchAll(re)) {
      if (!m[0].length) continue;
      const a = m.index;
      const b = a + m[0].length;
      const [ini, fim] = [mapa[a], mapa[b - 1] + 1];
      // o termo tem mais letras que o trecho achado: a pontuação dele não está na camada (o hífen suave que o PDF.js
      // tira), mas está desenhada, e a tarja precisa de folga para ela (revisão da gestão na rc.12, x6)
      trechos.push([ini, fim, Math.max(0, termo.replace(/\s+/g, '').length - texto.slice(ini, fim).replace(/\s+/g, '').length)]);
    }
  }
  // o termo mais longo primeiro: "Fulano de Teste" ganha de "Fulano" no mesmo lugar
  return trechos.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]) || x[0] - y[0]);
}

const EXTENSOES = new Set(['pdf', 'doc', 'docx', 'odt', 'ods', 'odp', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg',
  'png', 'gif', 'bmp', 'tif', 'tiff', 'txt', 'md', 'rtf', 'csv', 'xml', 'json', 'zip', 'rar', 'html', 'htm', 'mp3', 'mp4']);

// Palavra lida pelo OCR, com as trocas de letra mais comuns desfeitas para a procura (o tamanho não muda, então a
// posição de cada letra continua valendo): "@" que sai como "Q" ou "©" antes de um domínio (que não seja nome de
// arquivo), e letras parecidas com algarismos dentro de um número (O e o viram 0, l, I e | viram 1, S e s viram 5,
// B vira 8).
export function corrigirOcr(palavra) {
  let s = String(palavra);
  if (!s.includes('@')) {
    const m = s.match(/^(.*[A-Za-z0-9._%+-])[Q©®](?=[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.([A-Za-z]{2,})[.,;:)]*$)/);
    if (m && !EXTENSOES.has(m[2].toLowerCase())) s = m[1] + '@' + s.slice(m[1].length + 1);
  }
  const algarismos = (s.match(/[0-9]/g) || []).length;
  const resto = s.replace(/[.\-/()\s]/g, '').length;
  if (algarismos >= 4 && algarismos / resto >= 0.6) {
    s = s.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8');
  }
  return s;
}

// E-mail em página lida pelo OCR. O português do Tesseract embutido não tem o "@" entre os caracteres que sabe
// escrever: no lugar dele sai outra coisa. Estas são as leituras aceitas, medidas em 9.606 e-mails de páginas
// fictícias. O "&" também cobre "G&", "&Q", "t&"... (a letra colada fica na parte de
// antes ou no domínio); o "(" só vale com a letra que o OCR tira do desenho do @, nunca sozinho. Letra sozinha
// ("G", "g", "O") fica de fora: "fulanogexemplo.test" não se distingue de um endereço de site. O "Q" é a troca de
// corrigirOcr(), para quando ele cai entre duas palavras ("fulano.teste" + "Qexemplo.test"), coladas ou não.
const ARROBA_OCR = ['&&', '(&', '(D', '(Q', '(O', '(o', '(d', '(P', '(E', '&', 'ê', 'Q'];
const EMAIL_OCR = new RegExp(String.raw`(?<![A-Za-z0-9._%+\-\/\\=?#])([A-Za-z0-9._%+\-]*[A-Za-z0-9])( ?)(` +
  ARROBA_OCR.map(escaparRegex).join('|') +
  String.raw`)( ?)([A-Za-z0-9][A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.([A-Za-z]{2,}))(?![A-Za-z0-9\-]|\.[A-Za-z0-9])`, 'g');

// Trechos [ini, fim) do texto juntado da página (o de juntarTexto, palavras separadas por um espaço) que são
// e-mail com o "@" lido como uma das sequências de ARROBA_OCR. O trecho vai como foi lido, do começo da parte de
// antes ao fim do domínio; o tamanho do texto não muda.
function emailsDoOcr(texto) {
  const trechos = [];
  for (const m of texto.matchAll(EMAIL_OCR)) {
    const [tudo, antes, esp1, seq, esp2, dominio, final] = m;
    if (antes.length < 2) continue;
    if (EXTENSOES.has(final.toLowerCase())) continue;
    // espaço de um lado só: "Silva & Souza" é texto comum
    if (esp1 && esp2) continue;
    // "(" sem ")" depois: "Portal(exemplo.gov.br)" é texto comum
    if (seq[0] === '(' && /\)/.test(texto.slice(m.index + tudo.length).split(/\s/)[0])) continue;
    // "Q": nunca com espaço depois; com espaço antes, só com cara de usuário de e-mail antes (ponto, hífen,
    // sublinhado ou algarismo) e o domínio em minúscula, para "Acesse Qualidade.gov.br" não virar e-mail
    if (seq === 'Q' && (esp2 || (esp1 && (!/[._\-0-9]/.test(antes) || !/^[a-z0-9]/.test(dominio))))) continue;
    trechos.push([m.index, m.index + tudo.length]);
  }
  return trechos;
}

// a ordem decide quem fica quando dois padrões pegam o mesmo trecho (um CPF não vira telefone)
// PIS, título e CNH antes do CPF: a palavra antes do número diz o que ele é, mesmo que ele também passe como CPF
const ORDEM = ['email', 'processo', 'cnpj', 'pis', 'titulo', 'cnh', 'cpf', 'rg', 'cep', 'telefone'];

// Antes do número, a palavra que diz o que ele é (o número é tarjado, a palavra fica visível).
const ROTULO = String.raw`\s*(?:n[ºo°.]*\s*)?[:\-]?\s*`;
const DEPOIS = String.raw`(?![\d])`;

const PADROES = {
  cpf: /(?<![\d.\/-])\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?![\d\/-]|\.\d)/g,
  cnpj: /(?<![\d.\/-])\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?![\d\/-]|\.\d)/g,
  // RG muda de formato em cada estado: só o formato com pontos e traço, ou o número logo depois da palavra
  rg: /(?<![\d.-])\d{1,2}\.\d{3}\.\d{3}-?[\dXx](?![\d-]|\.\d)|(?:\bRG|\bR\.G\.|\bIdentidade|\bC\.I\.)\s*(?:n[ºo°.]*\s*)?[:\-]?\s*(\d[\d.\-\/xX]{4,16}\d|\d[\d.\-\/]{4,16}[xX])/gi,
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
  // exige separador entre as metades do número para não pegar qualquer sequência de dígitos
  telefone: /(?<![\d])(?:\+?55[\s.-]?)?(?:\(\d{2}\)\s?|\d{2}[\s.-])?(?:9[\s.]?)?\d{4}[\s.-]\d{4}(?!\d)/g,
  cep: /(?<![\d.\/-])\d{2}\.?\d{3}-\d{3}(?![\d-])/g,
  // Número Único de Protocolo (o do SEI): o formato com ponto, barra e traço já basta
  processo: /(?<![\d.\/-])\d{5}\.\d{6}\/\d{4}-\d{2}(?![\d-])/g,
  // PIS, PASEP, NIS e NIT: o formato com pontos e traço, ou o número depois da sigla
  pis: new RegExp(String.raw`(?<![\d.\/-])\d{3}\.\d{5}\.\d{2}-\d(?![\d-]|\.\d)|(?:\bPIS|\bPASEP|\bNIS|\bNIT)(?:\s*\/\s*(?:PIS|PASEP|NIS|NIT))*`
    + ROTULO + String.raw`(\d[\d.\-\s]{9,15}\d)` + DEPOIS, 'gi'),
  // título de eleitor: 12 algarismos; o formato em três grupos de quatro, ou o número depois das palavras
  titulo: new RegExp(String.raw`(?<![\d])\d{4} \d{4} \d{4}(?!\d)|(?:t[íi]tulo\s+(?:de\s+)?eleitor(?:al)?|inscri[çc][ãa]o\s+eleitoral)`
    + ROTULO + String.raw`(\d[\d.\-\s\/]{10,17}\d)` + DEPOIS, 'gi'),
  // CNH: o número de registro, só depois da sigla ou do nome do documento
  cnh: new RegExp(String.raw`(?:\bCNH|carteira\s+(?:nacional\s+)?de\s+habilita[çc][ãa]o|\bhabilita[çc][ãa]o)(?:\s*\(?registro\)?)?`
    + ROTULO + String.raw`(\d[\d.\-\s]{7,13}\d)` + DEPOIS, 'gi'),
};

// Conferências além do formato. Para PIS, título e CNH não há fonte oficial do dígito verificador conferida: vale a
// quantidade de algarismos (e, no título, o código do estado), para não descartar número verdadeiro.
const CONFERIR = {
  cpf: (t) => cpfValido(t),
  cnpj: (t) => cnpjValido(t),
  pis: (t) => digitos(t).length === 11,
  titulo: (t) => {
    const d = digitos(t);
    const uf = +d.slice(8, 10);
    return d.length === 12 && uf >= 1 && uf <= 28;
  },
  cnh: (t) => digitos(t).length >= 9 && digitos(t).length <= 11,
};

function digitos(s) {
  return s.replace(/\D/g, '');
}

export function cpfValido(texto) {
  const d = digitos(texto);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += +d[i] * (n + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== +d[n]) return false;
  }
  return true;
}

export function cnpjValido(texto) {
  const d = digitos(texto);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (const n of [12, 13]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += +d[i] * pesos[i + 13 - n];
    const resto = soma % 11;
    const dv = resto < 2 ? 0 : 11 - resto;
    if (dv !== +d[n]) return false;
  }
  return true;
}

// Junta os pedaços numa linha de texto, guardando de que pedaço veio cada letra.
export function juntarTexto(pedacos) {
  let texto = '';
  const origem = []; // para cada letra: [índice do pedaço, posição dentro dele] ou null (espaço posto aqui)
  pedacos.forEach((p, i) => {
    const anterior = pedacos[i - 1];
    if (anterior) {
      // pedaços em linhas diferentes, ou longe na mesma linha, ganham um espaço entre eles
      const mesmaLinha = Math.abs(anterior.y - p.y) < Math.max(anterior.h, p.h) * 0.5;
      const lacuna = p.x - (anterior.x + anterior.w);
      const juntos = mesmaLinha && !anterior.eol && lacuna < Math.max(p.h, 1) * 0.25 && lacuna > -Math.max(p.h, 1);
      if (!juntos && !/\s$/.test(texto) && texto !== '') {
        texto += ' ';
        origem.push(null);
      }
    }
    // texto com espaçamento entre letras chega como "a n a @ e x . c o m": lê sem esses espaços, senão o dado
    // passa despercebido (as palavras também se juntam, e aí a tarja sobra, nunca falta)
    const espacado = /^\S( \S){5,}$/.test(p.str);
    for (let k = 0; k < p.str.length; k++) {
      if (espacado && k % 2 === 1) continue;
      texto += p.str[k];
      origem.push([i, k]);
    }
  });
  return { texto, origem };
}

// Caixa (em pontos, origem no canto de cima) que cobre as letras [ini, fim) do texto juntado. medir(texto) dá a
// largura relativa de um texto (no navegador, pela fonte); sem ela, toda letra conta igual.
function caixas(pedacos, origem, ini, fim, medir, falta = 0) {
  const porPedaco = new Map();
  for (let j = ini; j < fim; j++) {
    const o = origem[j];
    if (!o) continue;
    const [i, k] = o;
    const faixa = porPedaco.get(i) || [k, k];
    faixa[0] = Math.min(faixa[0], k);
    faixa[1] = Math.max(faixa[1], k);
    porPedaco.set(i, faixa);
  }
  const lista = [];
  for (const [i, [a, b]] of porPedaco) {
    const p = pedacos[i];
    const total = medir ? medir(p.str, p) : p.str.length;
    const frac = (k) => (total > 0 ? (medir ? medir(p.str.slice(0, k), p) : k) / total : 0);
    const x0 = p.x + p.w * frac(a);
    const x1 = p.x + p.w * frac(b + 1);
    // a fonte do PDF não é a mesma da medida: folga dos lados de meia letra, porque sobrar tarja é melhor que
    // deixar uma letra do dado à mostra
    // falta: letras do termo que não estão na camada; a largura média de uma letra para cada, dos dois lados
    const folgaX = p.h * 0.3 + (falta ? (falta * p.w) / Math.max(1, p.str.length) : 0);
    const folgaY = p.h * 0.12;
    const k = { x: x0 - folgaX, y: p.y - p.h * 0.95 - folgaY, w: x1 - x0 + 2 * folgaX, h: p.h * 1.25 + 2 * folgaY };
    lista.push(p.ang ? desgirar(k, p.ang) : k);
  }
  return juntarVizinhas(lista);
}

// Página digitalizada com camada de texto invisível (o OCR de impressora ou de outro programa): a camada pode não
// coincidir com as letras da imagem, e a caixa tirada dela deixaria letras à mostra (prova da tarja da 1.2.2,
// achado 1; revisão do Codex na 1.2.3-rc.1). Aqui a caixa cresce até cobrir as manchas da imagem que ela toca ou que
// continuam a mesma palavra (vão menor que um quinto da altura da letra), sem nunca encolher, só na linha de letras
// dela e com limite: nunca a linha de cima ou de baixo, nem a coluna vizinha. Mancha grande demais para ser letra
// (linha de tabela, foto, fundo escuro) não puxa a caixa. Mancha é o que é mais escuro que o fundo em volta, com
// limiar tirado da própria região (letra cinza-clara também conta). Se a caixa não toca letra nenhuma, procura mais
// longe (até 3 letras de altura para cima, para baixo e para os lados) uma palavra da largura da camada; achando
// uma só, a caixa vai para ela. tinta: { largura, altura, escala (pixels por ponto), lum (luminosidade de 0 a 255, 1 por
// pixel, linha a linha) }; h: altura da letra em pontos. Devolve { caixas (em pontos), nota }; a nota diz à pessoa o
// que conferir: 'ajustada' (cobriu as letras perto da camada), 'curta' (há letra logo depois da tarja, que pode ser
// o resto do dado), 'cresceu' (cresceu além da camada e pode cobrir
// letras vizinhas), 'longe' (a camada não coincide com a imagem e a tarja foi para a palavra parecida mais perto) ou 'sem-letras' (não achou as letras na imagem: tarjar à mão).
export function ajustarATinta(k, tinta, h) {
  const { largura, altura, escala, lum } = tinta;
  const hp = h * escala;
  const x0 = Math.max(0, Math.floor((k.x - 3 * h) * escala));
  const x1 = Math.min(largura, Math.ceil((k.x + k.w + 3 * h) * escala));
  const y0 = Math.max(0, Math.floor((k.y - 3 * h) * escala));
  const y1 = Math.min(altura, Math.ceil((k.y + k.h + 3 * h) * escala));
  const nada = { caixas: [k], nota: 'sem-letras' };
  if (x1 <= x0 || y1 <= y0) return nada;
  // o fundo (a luminosidade mais comum da região: 60% dos pixels são mais escuros que ele ou iguais) e a tinta (o
  // mais escuro); escuro é o que fica abaixo do fundo pelo menos um quarto da diferença, e no mínimo 30
  const conta = new Uint32Array(256);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) conta[lum[y * largura + x]]++;
  const n = (x1 - x0) * (y1 - y0);
  let fundo = 0;
  for (let s = 0; fundo < 255 && (s += conta[fundo]) < 0.6 * n;) fundo++;
  let escura = 0;
  while (escura < 255 && !conta[escura]) escura++;
  if (fundo - escura < 30) return nada;
  const limiar = fundo - Math.max(30, 0.25 * (fundo - escura));
  // manchas escuras (vizinhança de 8) dentro da região em volta da caixa, cada uma pelo retângulo que a contém
  const visto = new Uint8Array(n);
  const escuro = (x, y) => lum[y * largura + x] < limiar;
  const manchas = [];
  const pilha = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y - y0) * (x1 - x0) + (x - x0);
      if (visto[i] || !escuro(x, y)) continue;
      const m = { x0: x, y0: y, x1: x + 1, y1: y + 1 };
      visto[i] = 1;
      pilha.push(x, y);
      while (pilha.length) {
        const py = pilha.pop();
        const px = pilha.pop();
        m.x0 = Math.min(m.x0, px); m.x1 = Math.max(m.x1, px + 1);
        m.y0 = Math.min(m.y0, py); m.y1 = Math.max(m.y1, py + 1);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const qx = px + dx;
            const qy = py + dy;
            if (qx < x0 || qx >= x1 || qy < y0 || qy >= y1) continue;
            const j = (qy - y0) * (x1 - x0) + (qx - x0);
            if (visto[j] || !escuro(qx, qy)) continue;
            visto[j] = 1;
            pilha.push(qx, qy);
          }
        }
      }
      if (m.y1 - m.y0 <= 2.5 * hp && m.x1 - m.x0 <= 6 * hp) manchas.push(m);
    }
  }
  const kx0 = k.x * escala;
  const kx1 = (k.x + k.w) * escala;
  const ky0 = k.y * escala;
  const ky1 = (k.y + k.h) * escala;
  const sobre = (m, a, b) => Math.max(0, Math.min(m.y1, b) - Math.max(m.y0, a));
  const alt = (m) => m.y1 - m.y0;
  const naLinha = (m, f) => sobre(m, f.y0, f.y1) >= 0.5 * Math.min(alt(m), f.y1 - f.y0);
  // a borda clara das letras (a suavização da imagem) também é coberta
  const margem = 0.08 * h;
  const emPontos = (r) => ({ x: r.x0 / escala - margem, y: r.y0 / escala - margem,
    w: (r.x1 - r.x0) / escala + 2 * margem, h: (r.y1 - r.y0) / escala + 2 * margem });
  // a linha de letras da caixa: entre as manchas que o miolo da caixa corta, a que ela cobre em maior parte dá a
  // faixa; as de outra linha (a de cima ou a de baixo, mesmo encostadas na caixa) ficam de fora. O miolo é a caixa sem
  // a folga de 0,3 letra dos lados: a letra que só a folga toca (os dois-pontos de "Nome:", depois de um espaço) não
  // é do dado e não puxa a caixa para o rótulo
  const folga = kx1 - kx0 > 0.6 * hp ? 0.3 * hp : 0;
  const cortadas = manchas.filter((m) => m.x0 < kx1 - folga && m.x1 > kx0 + folga && sobre(m, ky0, ky1) > 0);
  if (!cortadas.length) {
    // nenhuma letra sob a camada: as palavras da região (manchas da mesma linha separadas por menos de um terço da
    // altura da letra) com a altura de uma linha de texto, que cruzam a caixa na horizontal e têm a largura da
    // camada (a caixa tem 0,6 letra de folga)
    const largCamada = kx1 - kx0 - 0.6 * hp;
    const palavras = [];
    for (const m of manchas.slice().sort((a, b) => a.x0 - b.x0)) {
      const p = palavras.find((q) => naLinha(m, q) && m.x0 - q.x1 < 0.35 * hp && q.x0 - m.x1 < 0.35 * hp);
      if (p) { p.x0 = Math.min(p.x0, m.x0); p.x1 = Math.max(p.x1, m.x1); p.y0 = Math.min(p.y0, m.y0); p.y1 = Math.max(p.y1, m.y1); }
      else palavras.push({ ...m });
    }
    const parecidas = palavras.filter((p) => p.x0 < kx1 + hp && p.x1 > kx0 - hp && alt(p) >= 0.4 * hp && alt(p) <= 1.6 * hp
      && (p.x1 - p.x0) >= 0.6 * largCamada && (p.x1 - p.x0) <= 1.7 * largCamada);
    if (parecidas.length !== 1) return nada;
    // a caixa da camada fica sobre o fundo, sem letra: vai só a da palavra achada
    return { caixas: [emPontos(parecidas[0])], nota: 'longe' };
  }
  const melhor = cortadas.reduce((a, b) => (sobre(b, ky0, ky1) / alt(b) > sobre(a, ky0, ky1) / alt(a) ? b : a));
  const faixa = { y0: melhor.y0, y1: melhor.y1 };
  for (const m of cortadas) if (naLinha(m, melhor)) { faixa.y0 = Math.min(faixa.y0, m.y0); faixa.y1 = Math.max(faixa.y1, m.y1); }
  // o vão que ainda é da mesma palavra sai das letras que o miolo já corta: em fonte de largura fixa, a letra estreita
  // (o I) deixa vão de um quarto da altura da letra, e um quinto fixo parava antes do fim do dado (revisão do Codex na
  // 1.2.3-rc.2: "IGO" à mostra no cinza-claro da Ordem 24). O espaço entre palavras (vão bem maior que os outros) não
  // entra na conta; nunca menos de um quinto nem mais de 0,45 da altura da letra
  const daLinha = cortadas.filter((m) => naLinha(m, faixa)).sort((a, b) => a.x0 - b.x0);
  const vaos = daLinha.slice(1).map((m, i) => m.x0 - daLinha[i].x1).filter((g) => g > 0).sort((a, b) => a - b);
  const mediano = vaos.length ? vaos[Math.floor(vaos.length / 2)] : 0;
  const deLetra = vaos.filter((g) => g <= 2.5 * mediano);
  const vao = Math.min(0.45 * hp, Math.max(0.2 * hp, 1.3 * (deLetra.length ? deLetra[deLetra.length - 1] : 0)));
  // cresce na linha, a partir do miolo: manchas que ele corta ou que continuam a palavra, até 3 letras de altura para
  // cada lado da caixa (no fim, a caixa da camada continua inteira dentro da tarja)
  const r = { x0: kx0 + folga, x1: kx1 - folga, y0: ky0, y1: ky1 };
  const limite = { x0: kx0 - 3 * hp, x1: kx1 + 3 * hp, y0: ky0 - 0.6 * hp, y1: ky1 + 0.6 * hp };
  let bateu = false;
  const usadas = new Set();
  for (let mudou = true; mudou;) {
    mudou = false;
    for (const m of manchas) {
      if (usadas.has(m) || !naLinha(m, faixa)) continue;
      if (!(m.x0 < r.x1 + vao && m.x1 > r.x0 - vao)) continue;
      usadas.add(m);
      if (m.x0 < limite.x0 || m.x1 > limite.x1 || m.y0 < limite.y0 || m.y1 > limite.y1) bateu = true;
      r.x0 = Math.max(limite.x0, Math.min(r.x0, m.x0)); r.x1 = Math.min(limite.x1, Math.max(r.x1, m.x1));
      r.y0 = Math.max(limite.y0, Math.min(r.y0, m.y0)); r.y1 = Math.min(limite.y1, Math.max(r.y1, m.y1));
      mudou = true;
    }
  }
  const t = emPontos(r);
  const x = Math.min(k.x, t.x);
  const y = Math.min(k.y, t.y);
  const caixa = { x, y, w: Math.max(k.x + k.w, t.x + t.w) - x, h: Math.max(k.y + k.h, t.y + t.h) - y };
  // letra da imagem além da caixa da camada (que já tem meia letra de folga dos lados): pode ser letra vizinha,
  // pública, colada no dado (revisão do Codex, vizinho-colado); a pessoa confere o que fica coberto
  const cresceu = bateu || r.x0 < kx0 - 0.1 * hp || r.x1 > kx1 + 0.1 * hp || r.y0 < ky0 - 0.25 * hp || r.y1 > ky1 + 0.25 * hp;
  // letra da linha logo depois da tarja (a menos de 1,25 vão): pode ser o resto do dado, com um vão maior que os
  // que a camada cobre, e a cobertura não está garantida; a pessoa confere se ficou letra à mostra
  const perto = manchas.some((m) => !usadas.has(m) && naLinha(m, faixa) && m.x0 < r.x1 + 1.25 * vao && m.x1 > r.x0 - 1.25 * vao);
  return { caixas: [caixa], nota: perto ? 'curta' : cresceu ? 'cresceu' : 'ajustada' };
}

// O texto da caixa aparece na página desenhada? tinta é a página desenhada e semTexto, a mesma página desenhada sem
// pintar texto nenhum (as duas como em ajustarATinta). Só o texto que aparece muda os pixels quando sai; o texto
// escondido de qualquer jeito (recorte, tinta branca no fundo branco, imagem por cima, opacidade zero) não muda nada,
// mesmo que a imagem tenha outra palavra no mesmo lugar (revisão do Codex na 1.2.3-rc.3: a palavra pública da imagem
// embaixo da camada passava na conferência de tinta da rc.3, e a sugestão saía sem "confira", com o dado legível em outra linha). A
// mudança tem de aparecer nos quatro quartos do comprimento da caixa (a largura, ou a altura no texto que corre na
// vertical, como na página girada): texto coberto pela metade não aparece todo.
export function textoAparece(k, tinta, semTexto) {
  const { largura, altura, escala, lum } = tinta;
  if (!semTexto || semTexto.largura !== largura || semTexto.altura !== altura) return false;
  const x0 = Math.max(0, Math.floor(k.x * escala));
  const x1 = Math.min(largura, Math.ceil((k.x + k.w) * escala));
  const y0 = Math.max(0, Math.floor(k.y * escala));
  const y1 = Math.min(altura, Math.ceil((k.y + k.h) * escala));
  if (x1 - x0 < 4 && y1 - y0 < 4) return false;
  if (x1 <= x0 || y1 <= y0) return false;
  const deitada = x1 - x0 >= y1 - y0;
  // o fundo da caixa é a luminosidade do meio (a letra ocupa bem menos da metade da caixa); o pixel que o texto mudou
  // só conta se, com o texto, ficou diferente do fundo: a tinta branca que apaga pedaços de uma palavra escura da
  // imagem muda pixels, mas deixa branco no branco, e o dado não aparece (revisão da rc.3, branco-publico)
  const conta = new Uint32Array(256);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) conta[lum[y * largura + x]]++;
  let fundo = 0;
  for (let s = 0, n = (x1 - x0) * (y1 - y0); fundo < 255 && (s += conta[fundo]) < n / 2;) fundo++;
  const quartos = [0, 0, 0, 0];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * largura + x;
      if (Math.abs(lum[i] - semTexto.lum[i]) >= 40 && Math.abs(lum[i] - fundo) >= 40) {
        quartos[deitada ? Math.min(3, Math.floor((4 * (x - x0)) / (x1 - x0))) : Math.min(3, Math.floor((4 * (y - y0)) / (y1 - y0)))]++;
      }
    }
  }
  // em cada quarto, ao menos 1% dos pixels mudou (uma letra de traço fino já passa disso)
  const minimo = Math.max(2, (0.01 * (x1 - x0) * (y1 - y0)) / 4);
  return quartos.every((n) => n >= minimo);
}

// A caixa do texto visível bate com a imagem embaixo dela ou perto dela? semTexto é a página desenhada sem texto, com
// imagens (os retângulos em pixels onde cada imagem caiu). Sem imagem na região em volta da caixa (a caixa mais 24 pt,
// ou duas vezes a altura da letra, de cada lado), bate. Com imagem, a tinta da imagem na região tem de estar toda na
// caixa (com folga de 15% da altura da letra), nos quatro quartos do comprimento e com pelo menos 40% da altura dela:
// a camada tem o tamanho e o lugar das letras da imagem. A camada visível de 2 pt sob o dado de 18 pt da imagem, ou
// em cinza claro sobre outra palavra com o dado na linha de cima, não bate, e a sugestão ganha "confira" (revisão
// independente da gestão na 1.2.3-rc.4). Na dúvida, não bate: ver texto que não é o dado é melhor que deixar o dado
// passar. Região de imagem lisa (sem nada desenhado perto da caixa) bate.
export function bateComImagem(k, semTexto) {
  if (!semTexto) return false;
  const { largura, altura, escala, lum, imagens = [] } = semTexto;
  const lado = Math.min(k.w, k.h);
  const m = Math.max(2 * lado, 24);
  const rx0 = Math.max(0, Math.floor((k.x - m) * escala));
  const rx1 = Math.min(largura, Math.ceil((k.x + k.w + m) * escala));
  const ry0 = Math.max(0, Math.floor((k.y - m) * escala));
  const ry1 = Math.min(altura, Math.ceil((k.y + k.h + m) * escala));
  const sob = imagens
    .map((r) => ({ x0: Math.max(rx0, r.x0), y0: Math.max(ry0, r.y0), x1: Math.min(rx1, r.x1), y1: Math.min(ry1, r.y1) }))
    .filter((r) => r.x1 > r.x0 && r.y1 > r.y0);
  if (!sob.length) return true;
  const naImagem = (x, y) => sob.some((r) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1);
  // o fundo é a luminosidade do meio da imagem na região
  const conta = new Uint32Array(256);
  let n = 0;
  for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) if (naImagem(x, y)) { conta[lum[y * largura + x]]++; n++; }
  let fundo = 0;
  for (let s = 0; fundo < 255 && (s += conta[fundo]) < n / 2;) fundo++;
  const f = 0.15 * lado;
  const kx0 = (k.x - f) * escala;
  const kx1 = (k.x + k.w + f) * escala;
  const ky0 = (k.y - f) * escala;
  const ky1 = (k.y + k.h + f) * escala;
  const deitada = k.w >= k.h;
  const quartos = [0, 0, 0, 0];
  let dentro = 0;
  let fora = 0;
  let p0 = Infinity;
  let p1 = -Infinity;
  for (let y = ry0; y < ry1; y++) {
    for (let x = rx0; x < rx1; x++) {
      if (Math.abs(lum[y * largura + x] - fundo) < 40 || !naImagem(x, y)) continue;
      if (x < kx0 || x >= kx1 || y < ky0 || y >= ky1) { fora++; continue; }
      dentro++;
      const t = deitada ? (x - kx0) / (kx1 - kx0) : (y - ky0) / (ky1 - ky0);
      quartos[Math.min(3, Math.floor(4 * t))]++;
      const p = deitada ? y : x;
      p0 = Math.min(p0, p);
      p1 = Math.max(p1, p + 1);
    }
  }
  if (!dentro && !fora) return true;
  if (fora > Math.max(8, 0.1 * dentro)) return false;
  const area = (kx1 - kx0) * (ky1 - ky0);
  const minimo = Math.max(2, (0.01 * area) / 4);
  if (!quartos.every((q) => q >= minimo)) return false;
  return p1 - p0 >= 0.4 * lado * escala;
}

// A página desenhada sem texto tem imagem ou desenho? semTexto como em bateComImagem. Toda imagem que o PDF.js desenha
// (semTexto.imagens) conta, seja qual for a tinta (revisão independente da gestão na rc.7, t3). Fora da imagem, conta
// toda tinta que não é texto: linha de tabela, sublinhado, moldura, curva, bloco, letra desenhada. O programa não
// distingue um desenho inofensivo de um dado desenhado (as exceções de grade e de traço fino caíram na revisão da
// rc.9, v1, por decisão do professor). A cor conta pela distância ao branco em cada canal (semTexto.afasta, 255 menos
// o menor canal): qualquer canal mais de DIF_FUNDO níveis abaixo do branco é tinta, o amarelo-pálido e o cinza 0,98
// inclusive (rc.9, v2). Sobrando mais de 20 pixels de tinta, a página tem desenho: todas as sugestões dela ganham
// "confira", a página entra no aviso e volta a "não vista". Na dúvida, tem.
// passosDesenho faz a conta em pedaços (cede a vez a cada tantas linhas, para a tela não travar numa página grande);
// temDesenho faz de uma vez e temDesenhoAos(sem, pausa) espera pausa() entre os pedaços.
export const DIF_FUNDO = 3;
const LINHAS_POR_PASSO = 48;
export function* passosDesenho(semTexto) {
  if (!semTexto) return true;
  if (semTexto.imagens?.length) return true;
  const { largura: w, altura: h, lum } = semTexto;
  // sem a distância por canal (página em tons de cinza), a luminosidade faz as vezes dela
  const afasta = semTexto.afasta || Uint8Array.from(lum, (v) => 255 - v);
  const LIMITE = 20;
  let conta = 0;
  for (let y = 0; y < h; y++) {
    for (let i = y * w, f = i + w; i < f; i++) if (afasta[i] > DIF_FUNDO && ++conta > LIMITE) return true;
    if (y % LINHAS_POR_PASSO === 0) yield;
  }
  return false;
}
export function temDesenho(semTexto) {
  const g = passosDesenho(semTexto);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
export async function temDesenhoAos(semTexto, pausa) {
  const g = passosDesenho(semTexto);
  let r = g.next();
  while (!r.done) { await pausa(); r = g.next(); }
  return r.value;
}

// Caixas do mesmo achado na mesma linha e quase encostadas (palavras de um nome, pedaços de um número) viram um
// retângulo só: sem fresta entre as palavras nem degrau quando uma delas é mais alta.
function juntarVizinhas(lista) {
  const restantes = lista.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const juntas = [];
  for (const k of restantes) {
    const u = juntas.find((j) => {
      const sobreV = Math.min(j.y + j.h, k.y + k.h) - Math.max(j.y, k.y);
      const vao = Math.max(k.x - (j.x + j.w), j.x - (k.x + k.w));
      return sobreV > 0.5 * Math.min(j.h, k.h) && vao < 0.6 * Math.max(j.h, k.h);
    });
    if (!u) {
      juntas.push({ ...k });
      continue;
    }
    const x = Math.min(u.x, k.x);
    const y = Math.min(u.y, k.y);
    u.w = Math.max(u.x + u.w, k.x + k.w) - x;
    u.h = Math.max(u.y + u.h, k.y + k.h) - y;
    u.x = x;
    u.y = y;
  }
  return juntas;
}

// Texto girado: a conta é feita no "quadro da linha" (o texto deitado) e a caixa volta para a página como o menor
// retângulo em pé que cobre a caixa girada.
function girar(x, y, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [x * c - y * s, x * s + y * c];
}

function noQuadroDaLinha(p) {
  if (!p.ang) return p;
  const [x, y] = girar(p.x, p.y, -p.ang);
  return { ...p, x, y };
}

function desgirar(k, ang) {
  const cantos = [[k.x, k.y], [k.x + k.w, k.y], [k.x, k.y + k.h], [k.x + k.w, k.y + k.h]].map(([x, y]) => girar(x, y, ang));
  const xs = cantos.map((c) => c[0]);
  const ys = cantos.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// pedacos: [{str, x, y, w, h, eol, ang?}], ang = direção do texto em radianos (0 = deitado, da esquerda para a
// direita); tipos: lista de chaves de TIPOS a procurar; medir(texto, pedaço): ver caixas().
// Devolve [{tipo, ini, fim, caixas}] sem trechos repetidos.
// termos (opcional): { lista, palavraInteira, semAcento }, a lista de nomes e endereços do usuário.
// Um achado só é descartado se estiver inteiro dentro de outro (um CPF não vira também telefone). Se só encostar
// num já achado, entra também: o nome "Ana" no começo de um e-mail não pode impedir que o e-mail inteiro seja tarjado.
function dentroDeOutro(tomados, ini, fim) {
  return tomados.some(([a, b]) => ini >= a && fim <= b);
}

export function procurar(pedacosPagina, tipos = Object.keys(TIPOS), medir = null, termos = null) {
  const pedacos = pedacosPagina.map(noQuadroDaLinha);
  const { texto, origem } = juntarTexto(pedacos);
  const tomados = [];
  const achados = [];
  if (termos?.lista?.length) {
    for (const [ini, fim, falta] of acharTermos(texto, termos)) {
      if (dentroDeOutro(tomados, ini, fim)) continue;
      tomados.push([ini, fim]);
      achados.push({ tipo: 'termo', ini, fim, trecho: texto.slice(ini, fim), caixas: caixas(pedacos, origem, ini, fim, medir, falta) });
    }
  }
  // página lida pelo OCR (os pedaços vêm marcados por lerComOcr): o e-mail também pode ter o "@" lido errado
  const ocr = pedacosPagina.some((p) => p.ocr);
  // os tipos procuram no texto com as sósias e as formas de compatibilidade trocadas pela letra comum
  const procuravel = textoDeProcura(texto);
  for (const tipo of ORDEM) {
    if (!tipos.includes(tipo)) continue;
    if (tipo === 'email' && ocr) {
      for (const [ini, fim] of emailsDoOcr(texto)) {
        if (dentroDeOutro(tomados, ini, fim)) continue;
        tomados.push([ini, fim]);
        achados.push({ tipo, ini, fim, trecho: texto.slice(ini, fim), caixas: caixas(pedacos, origem, ini, fim, medir) });
      }
    }
    const re = new RegExp(PADROES[tipo].source, PADROES[tipo].flags);
    for (const m of procuravel.matchAll(re)) {
      let ini = m.index;
      let fim = ini + m[0].length;
      if (m[1]) {
        // com a palavra antes ("RG", "PIS", "CNH"...), tarja só o número; a palavra pode ficar visível
        ini = ini + m[0].lastIndexOf(m[1]);
        fim = ini + m[1].length;
      }
      const trecho = texto.slice(ini, fim);
      if (CONFERIR[tipo] && !CONFERIR[tipo](procuravel.slice(ini, fim))) continue;
      if (dentroDeOutro(tomados, ini, fim)) continue;
      tomados.push([ini, fim]);
      achados.push({ tipo, ini, fim, trecho, caixas: caixas(pedacos, origem, ini, fim, medir) });
    }
  }
  return achados.sort((a, b) => a.ini - b.ini);
}

// Seleção de texto com o cursor: as letras do ponto a até o ponto b ([x, y] em pontos), na ordem de leitura, viram
// caixas (uma por linha). Só texto deitado; página sem texto devolve lista vazia.
export function selecionar(pedacosPagina, a, b, medir = null) {
  const pedacos = pedacosPagina.filter((p) => !p.ang && p.str);
  if (!pedacos.length) return [];
  const { origem } = juntarTexto(pedacos);
  const letras = [];
  origem.forEach((o, j) => {
    if (!o) return;
    const [i, k] = o;
    const p = pedacos[i];
    const total = medir ? medir(p.str, p) : p.str.length;
    const frac = (n) => (total > 0 ? (medir ? medir(p.str.slice(0, n), p) : n) / total : 0);
    letras.push({ j, x0: p.x + p.w * frac(k), x1: p.x + p.w * frac(k + 1), y0: p.y - p.h * 0.95, y1: p.y + p.h * 0.3 });
  });
  // a letra do ponto: a da mesma linha mais perto na horizontal; fora de qualquer linha, a da linha mais perto
  const letraEm = ([x, y]) => {
    let melhor = null;
    let nota = Infinity;
    for (const l of letras) {
      const dy = y < l.y0 ? l.y0 - y : y > l.y1 ? y - l.y1 : 0;
      const dx = x < l.x0 ? l.x0 - x : x > l.x1 ? x - l.x1 : 0;
      const n = dy * 1000 + dx;
      if (n < nota) { nota = n; melhor = l; }
    }
    return melhor.j;
  };
  const ja = letraEm(a);
  const jb = letraEm(b);
  return caixas(pedacos, origem, Math.min(ja, jb), Math.max(ja, jb) + 1, medir);
}

// Uma caixa já está coberta por tarjas só se ficar inteira embaixo delas (uma ou várias juntas). "Quase toda" não
// serve: 90% de um e-mail coberto ainda deixa letras à vista (auditoria de 29/10/2026). A folga de 0,01 é só para o
// arredondamento das contas.
export function coberta(caixa, tarjas) {
  const FOLGA = 0.01;
  const x0 = caixa.x + FOLGA, y0 = caixa.y + FOLGA, x1 = caixa.x + caixa.w - FOLGA, y1 = caixa.y + caixa.h - FOLGA;
  if (x1 <= x0 || y1 <= y0) return true;
  const por = tarjas.filter((t) => t.x < x1 && t.x + t.w > x0 && t.y < y1 && t.y + t.h > y0);
  if (!por.length) return false;
  // divide a caixa pelas bordas das tarjas: cada pedaço tem de ter o centro dentro de alguma tarja
  const cortes = (a, b, bordas) => [...new Set([a, b, ...bordas.filter((v) => v > a && v < b)])].sort((m, n) => m - n);
  const xs = cortes(x0, x1, por.flatMap((t) => [t.x, t.x + t.w]));
  const ys = cortes(y0, y1, por.flatMap((t) => [t.y, t.y + t.h]));
  for (let i = 0; i + 1 < xs.length; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2;
    for (let j = 0; j + 1 < ys.length; j++) {
      const cy = (ys[j] + ys[j + 1]) / 2;
      if (!por.some((t) => cx >= t.x && cx <= t.x + t.w && cy >= t.y && cy <= t.y + t.h)) return false;
    }
  }
  return true;
}
