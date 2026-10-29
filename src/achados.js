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

const MAX_TERMOS = 500;
const MAX_LETRAS_TERMO = 200;

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

// Tira acentos e maiúsculas guardando, para cada letra do resultado, a posição dela no texto original.
function normalizar(texto, semAcento) {
  if (!semAcento) return { norm: texto, mapa: null };
  let norm = '';
  const mapa = [];
  for (let i = 0; i < texto.length; i++) {
    const base = texto[i].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (const c of base) {
      norm += c;
      mapa.push(i);
    }
  }
  return { norm, mapa };
}

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Trechos [ini, fim) do texto juntado que casam com algum termo da lista. Entre as palavras de um termo vale
// qualquer espaço (inclusive a quebra de linha, que juntarTexto transforma em espaço).
function acharTermos(texto, { lista = [], palavraInteira = true, semAcento = true } = {}) {
  const { norm, mapa } = normalizar(texto, semAcento);
  const borda = palavraInteira ? ['(?<![\\p{L}\\p{N}])', '(?![\\p{L}\\p{N}])'] : ['', ''];
  const trechos = [];
  for (const termo of lista) {
    const palavras = normalizar(termo, semAcento).norm.split(/\s+/).filter(Boolean).map(escaparRegex);
    if (!palavras.length) continue;
    const re = new RegExp(borda[0] + palavras.join('\\s+') + borda[1], 'gu');
    for (const m of norm.matchAll(re)) {
      if (!m[0].length) continue;
      const a = m.index;
      const b = a + m[0].length;
      trechos.push(mapa ? [mapa[a], mapa[b - 1] + 1] : [a, b]);
    }
  }
  // o termo mais longo primeiro: "Fulano de Teste" ganha de "Fulano" no mesmo lugar
  return trechos.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]) || x[0] - y[0]);
}

// Palavra lida pelo OCR, com as trocas de letra mais comuns desfeitas para a procura (o tamanho não muda, então a
// posição de cada letra continua valendo): "@" que sai como "Q" ou "©" antes de um domínio, e letras parecidas com
// algarismos dentro de um número (O e o viram 0, l, I e | viram 1, S e s viram 5, B vira 8).
export function corrigirOcr(palavra) {
  let s = String(palavra);
  if (!s.includes('@')) {
    const m = s.match(/^(.*[A-Za-z0-9._%+-])[Q©®](?=[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}[.,;:)]*$)/);
    if (m) s = m[1] + '@' + s.slice(m[1].length + 1);
  }
  const algarismos = (s.match(/[0-9]/g) || []).length;
  const resto = s.replace(/[.\-/()\s]/g, '').length;
  if (algarismos >= 4 && algarismos / resto >= 0.6) {
    s = s.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8');
  }
  return s;
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
function caixas(pedacos, origem, ini, fim, medir) {
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
    const folgaX = p.h * 0.3;
    const folgaY = p.h * 0.12;
    const k = { x: x0 - folgaX, y: p.y - p.h * 0.95 - folgaY, w: x1 - x0 + 2 * folgaX, h: p.h * 1.25 + 2 * folgaY };
    lista.push(p.ang ? desgirar(k, p.ang) : k);
  }
  return juntarVizinhas(lista);
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
    for (const [ini, fim] of acharTermos(texto, termos)) {
      if (dentroDeOutro(tomados, ini, fim)) continue;
      tomados.push([ini, fim]);
      achados.push({ tipo: 'termo', ini, fim, trecho: texto.slice(ini, fim), caixas: caixas(pedacos, origem, ini, fim, medir) });
    }
  }
  for (const tipo of ORDEM) {
    if (!tipos.includes(tipo)) continue;
    const re = new RegExp(PADROES[tipo].source, PADROES[tipo].flags);
    for (const m of texto.matchAll(re)) {
      let ini = m.index;
      let fim = ini + m[0].length;
      if (m[1]) {
        // com a palavra antes ("RG", "PIS", "CNH"...), tarja só o número; a palavra pode ficar visível
        ini = ini + m[0].lastIndexOf(m[1]);
        fim = ini + m[1].length;
      }
      const trecho = texto.slice(ini, fim);
      if (CONFERIR[tipo] && !CONFERIR[tipo](trecho)) continue;
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
