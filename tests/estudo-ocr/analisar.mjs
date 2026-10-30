// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Estudo do OCR do @ (docs/ESTUDO-OCR-EMAIL.md), passo 3: junta o que o OCR leu (palavras.csv) com o que a página
// tinha (linhas.csv), separa a leitura do @ de cada e-mail e mede a procura antes e depois da regra proposta.
// "Antes" é a procura de verdade: corrigirOcr() e procurar() de src/achados.js, nos pedaços montados como em
// lerComOcr(). "Depois" é a mesma procura mais a regra proposta, simulada aqui (src/ não muda).
// Saída: leituras.csv (uma linha por e-mail), contraexemplos.csv (uma linha por texto que não é e-mail, lido pelo
// OCR ou escrito direto) e as tabelas do relatório em resultados.md.
// Uso: node tests/estudo-ocr/analisar.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corrigirOcr, juntarTexto, procurar } from '../../src/achados.js';
import { lerCsv as lerCsvEm, gravarCsv as gravarCsvEm } from './csv.mjs';
import { REGRA, emailsPelaRegra, criarRegra, SEQUENCIAS, SEQUENCIA_ESPACO_Q } from './regra.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const lerCsv = (arq) => lerCsvEm(join(AQUI, arq));
const gravarCsv = (arq, linhas) => gravarCsvEm(join(AQUI, arq), linhas);

// ---------- alinhamento: o pedaço lido que ficou no lugar do @ ----------
// Distância de edição com o caminho de volta; devolve, para cada letra esperada, a posição lida casada com ela
// (ou -1 se a letra sumiu).
function alinhar(esp, lido) {
  const n = esp.length, m = lido.length;
  const d = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (esp[i - 1] === lido[j - 1] ? 0 : 1));
    }
  }
  const par = new Array(n).fill(-1);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (d[i][j] === d[i - 1][j - 1] + (esp[i - 1] === lido[j - 1] ? 0 : 1)) { par[i - 1] = j - 1; i--; j--; }
    else if (d[i][j] === d[i - 1][j] + 1) i--;
    else j--;
  }
  return par;
}
function leituraDoArroba(esperado, posArroba, lido) {
  const par = alinhar(esperado, lido);
  let esq = -1, dir = lido.length;
  for (let k = posArroba - 1; k >= 0; k--) if (par[k] >= 0) { esq = par[k]; break; }
  for (let k = posArroba + 1; k < esperado.length; k++) if (par[k] >= 0) { dir = par[k]; break; }
  return dir > esq ? { leitura: lido.slice(esq + 1, dir), ini: esq + 1, fim: dir } : { leitura: '', ini: esq + 1, fim: esq + 1 };
}
// O trecho lido que corresponde ao e-mail inteiro (de [ini, fim) do texto esperado), ou '' se nada casou.
function regiaoLida(esperado, ini, fim, lido) {
  const par = alinhar(esperado, lido);
  let a = -1, b = -1;
  for (let k = ini; k < fim && a < 0; k++) a = par[k];
  for (let k = fim - 1; k >= ini && b < 0; k--) b = par[k];
  return a >= 0 && b >= a ? { regiao: lido.slice(a, b + 1), a, b: b + 1 } : { regiao: '', a: -1, b: -1 };
}

// ---------- pedaços de cada linha da página ----------
const paginas = lerCsv('paginas.csv');
const linhas = lerCsv('linhas.csv');
const palavras = lerCsv('palavras.csv');
const porPagina = new Map();
for (const w of palavras) {
  if (!porPagina.has(w.pagina)) porPagina.set(w.pagina, []);
  porPagina.get(w.pagina).push(w);
}
const linhasDa = new Map();
for (const l of linhas) {
  if (!linhasDa.has(l.pagina)) linhasDa.set(l.pagina, []);
  linhasDa.get(l.pagina).push(l);
}

const CX = 595.28 / 2, CY = 841.89 / 2;
const leituras = [];
const contra = [];
for (const pag of paginas) {
  const esperadas = linhasDa.get(pag.pagina);
  const entrelinha = +pag.tamanho_pt * 1.9;
  const ang = (+pag.angulo_graus * Math.PI) / 180;
  const grupos = new Map(); // linha esperada → pedaços (crus e corrigidos)
  // as palavras na ordem do OCR, como lerComOcr: só as com texto; a última da linha do OCR leva eol
  const ws = (porPagina.get(pag.pagina) || []).filter((w) => w.texto && w.texto.trim());
  ws.forEach((w, k) => {
    const s = +w.escala;
    const prox = ws[k + 1];
    const eol = !prox || prox.bloco !== w.bloco || prox.paragrafo !== w.paragrafo || prox.linha_ocr !== w.linha_ocr;
    const x = +w.x0_px / s, y = +w.y1_px / s, wd = (+w.x1_px - +w.x0_px) / s, h = Math.max(3, (+w.y1_px - +w.y0_px) / s);
    // a página com ruído foi girada (PIL, sentido anti-horário): o centro da palavra volta ao lugar de antes do giro
    const xc = x + wd / 2 - CX, yc = y - h / 2 - CY;
    const yOrig = CY + xc * Math.sin(ang) + yc * Math.cos(ang);
    let melhor = null, dist = Infinity;
    for (const e of esperadas) {
      const centro = +e.base_pt - 0.3 * +pag.tamanho_pt;
      const dd = Math.abs(yOrig - centro);
      if (dd < dist) { dist = dd; melhor = e; }
    }
    if (dist > entrelinha / 2) return; // sujeira solta lida como letra
    if (!grupos.has(melhor.linha)) grupos.set(melhor.linha, { crus: [], corr: [] });
    const base = { x, y, w: wd, h, eol, ang: 0, familia: 'sans' };
    grupos.get(melhor.linha).crus.push({ ...base, str: w.texto.trim() });
    grupos.get(melhor.linha).corr.push({ ...base, str: corrigirOcr(w.texto.trim()) });
  });
  for (const e of esperadas) {
    const g = grupos.get(e.linha) || { crus: [], corr: [] };
    const cru = juntarTexto(g.crus).texto;
    const texto = juntarTexto(g.corr).texto;
    const antes = procurar(g.corr, ['email']).map((a) => a.trecho);
    const depois = [...new Set([...antes, ...emailsPelaRegra(texto)])];
    const comum = { pagina: pag.pagina, linha: e.linha, desenho: pag.desenho, fonte: pag.fonte, tipo_fonte: pag.tipo_fonte,
                    tamanho_pt: pag.tamanho_pt, dpi: pag.dpi, estado: pag.estado };
    if (e.tipo === 'email') {
      const ini = e.texto.indexOf(e.email);
      const { leitura: arroba, ini: ai, fim: af } = leituraDoArroba(e.texto, ini + e.email.indexOf('@'), cru);
      // o e-mail inteiro foi sugerido se alguma sugestão contém todo o trecho lido no lugar dele
      const { regiao, a, b } = regiaoLida(e.texto, ini, ini + e.email.length, texto);
      const inteiro = (lista) => regiao !== '' && lista.some((t) => t.includes(regiao));
      // teto: se o OCR tivesse lido o @ certo (o resto como foi lido), a procura de hoje acharia o e-mail inteiro?
      let teto = 0;
      if (regiao !== '' && a <= ai && af <= b) {
        const certo = texto.slice(a, ai) + '@' + texto.slice(af, b);
        const linhaCerta = texto.slice(0, ai) + '@' + texto.slice(af);
        teto = +[...linhaCerta.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)].some((m) => m[0].includes(certo));
      }
      leituras.push({ ...comum, email: e.email, ponto: e.ponto, hifen: e.hifen, numero: e.numero, final: e.final,
                      esperado: e.texto, lido: cru, leitura_arroba: arroba, regiao,
                      antes: antes.join(' | '), antes_sugere: +(antes.length > 0), antes_exato: +inteiro(antes),
                      depois: depois.join(' | '), depois_sugere: +(depois.length > 0), depois_exato: +inteiro(depois),
                      teto_arroba_certo: teto, _texto: texto, _antes: antes });
    } else {
      contra.push({ origem: 'ocr', ...comum, esperado: e.texto, lido: cru, antes: antes.join(' | '),
                    depois: depois.join(' | '), falso_antes: +(antes.length > 0), falso_depois: +(depois.length > 0),
                    _texto: texto, _antes: antes });
    }
  }
}

// ---------- contraexemplos escritos direto (sem OCR) ----------
// 1) textos de documento com as sequências da regra, escritos à mão; 2) todas as linhas dos textos do próprio
// repositório (docs/*.md, README, CHANGELOG, avisos e licenças, cheios de endereços de site), sem as que já têm @.
const ESCRITOS = readFileSync(join(AQUI, 'contraexemplos.txt'), 'utf8').split('\n')
  .filter((l) => l.trim() && !l.startsWith('#'));
const textosRepo = [join(RAIZ, 'README.md'), join(RAIZ, 'CHANGELOG.md'), join(RAIZ, 'THIRD-PARTY-NOTICES.md'), join(RAIZ, 'LICENSE'),
  ...readdirSync(join(RAIZ, 'docs')).filter((f) => f.endsWith('.md') && !f.startsWith('ESTUDO-OCR')).map((f) => join(RAIZ, 'docs', f)),
  ...['jspdf', 'pdfjs', 'tesseract'].flatMap((d) => readdirSync(join(RAIZ, 'vendor', d)).filter((f) => /LICENSE|\.txt$/i.test(f))
    .map((f) => join(RAIZ, 'vendor', d, f)))];
const DO_REPO = textosRepo.flatMap((f) => readFileSync(f, 'utf8').split('\n')).map((l) => l.trim())
  .filter((l) => l && !l.includes('@'));
// texto escrito → palavras soltas, como o OCR entrega, cada uma passada por corrigirOcr, e a procura antes e depois
function procurarEscrito(t, regra = REGRA) {
  let x = 0;
  const pedacos = t.split(/\s+/).filter(Boolean).map((str) => {
    const p = { str: corrigirOcr(str), x, y: 10, w: str.length * 5, h: 10, eol: false, ang: 0 };
    x += str.length * 5 + 4;
    return p;
  });
  if (!pedacos.length) return null;
  pedacos[pedacos.length - 1].eol = true;
  const texto = juntarTexto(pedacos).texto;
  const antes = procurar(pedacos, ['email']).map((a) => a.trecho);
  return { texto, antes, depois: [...new Set([...antes, ...regra.emails(texto)])] };
}
for (const [origem, lista] of [['escrito', ESCRITOS], ['repositorio', DO_REPO]]) {
  for (const t of lista) {
    const r = procurarEscrito(t);
    if (!r) continue;
    contra.push({ origem, pagina: '', linha: '', desenho: '', fonte: '', tipo_fonte: '', tamanho_pt: '', dpi: '', estado: '', esperado: t,
                  lido: t, antes: r.antes.join(' | '), depois: r.depois.join(' | '),
                  falso_antes: +(r.antes.length > 0), falso_depois: +(r.depois.length > 0), _texto: r.texto, _antes: r.antes });
  }
}

const semInternos = (l) => Object.fromEntries(Object.entries(l).filter(([k]) => !k.startsWith('_')));
gravarCsv('leituras.csv', leituras.map(semInternos));
gravarCsv('contraexemplos.csv', contra.map(semInternos));

// ---------- tabelas ----------
const pct = (a, b) => (b ? (100 * a / b).toFixed(1).replace('.', ',') + '%' : '-');
// a procura com a regra aceita a leitura? Testado de verdade: "fulano.teste" + leitura + "exemplo.gov.br" vira e-mail inteiro?
// (com corrigirOcr, que já troca o "Q" colado, e a procura de hoje)
const aceita = (regra, leitura) => procurarEscrito('Contato: fulano.teste' + leitura + 'exemplo.gov.br', regra).depois
  .some((t) => t.startsWith('fulano.teste') && t.endsWith('exemplo.gov.br'));
// Nas tabelas, o @ de um e-mail fora do domínio .test sai como ＠ (o @ largo): tests/ficticios.test.mjs não aceita
// e-mail de verdade nos textos do repositório. Os CSV guardam o @ normal.
const largo = (s) => s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
  (e) => (/\.test$/.test(e) ? e : e.replace('@', '＠')));
const mostrar = (s) => '`' + (s === '' ? '(nada)' : largo(s).replace(/ /g, '␣')) + '`';
const soma = (l, k) => l.reduce((n, x) => n + +x[k], 0);
const out = [];
const tabela = (cab, linhasT) => {
  out.push('| ' + cab.join(' | ') + ' |', '|' + cab.map((_, i) => (i ? '---:' : '---')).join('|') + '|');
  for (const l of linhasT) out.push('| ' + l.join(' | ') + ' |');
  out.push('');
};

out.push(`# Resultados (gerado por analisar.mjs)`, '', `Regra simulada: ${REGRA.descricao}`, '');
out.push(`E-mails lidos: ${leituras.length}, em ${paginas.length} páginas. Contraexemplos: ${contra.length} ` +
  `(${contra.filter((c) => c.origem === 'ocr').length} lidos pelo OCR, ${contra.filter((c) => c.origem === 'escrito').length} escritos à mão, ` +
  `${contra.filter((c) => c.origem === 'repositorio').length} linhas dos textos do repositório).`, '');

// leituras do @ por frequência
const freq = new Map();
for (const l of leituras) freq.set(l.leitura_arroba, (freq.get(l.leitura_arroba) || 0) + 1);
const ordenadas = [...freq].sort((a, b) => b[1] - a[1]);
out.push('## Leituras do @ por frequência', '');
let acum = 0;
tabela(['Leitura (␣ = espaço)', 'Vezes', '%', '% acumulado', 'A regra aceita?'], ordenadas.slice(0, 40).map(([k, n]) => {
  acum += n;
  return [mostrar(k), n, pct(n, leituras.length), pct(acum, leituras.length), aceita(REGRA, k) ? 'sim' : 'não'];
}));
const cobertas = leituras.filter((l) => aceita(REGRA, l.leitura_arroba)).length;
out.push(`Leituras aceitas pela regra: ${cobertas} de ${leituras.length} (${pct(cobertas, leituras.length)}).`, '');
out.push(`Leituras diferentes: ${ordenadas.length}. As ${Math.min(40, ordenadas.length)} mais comuns somam ${pct(acum, leituras.length)}.`, '');

// sem espaço: só a sequência no meio
const nucleo = new Map();
for (const l of leituras) {
  const k = l.leitura_arroba.trim();
  nucleo.set(k, (nucleo.get(k) || 0) + 1);
}
out.push('## Leituras sem os espaços em volta', '');
tabela(['Sequência', 'Vezes', '%', 'A regra aceita?'], [...nucleo].sort((a, b) => b[1] - a[1]).slice(0, 30)
  .map(([k, n]) => [mostrar(k), n, pct(n, leituras.length), aceita(REGRA, k) ? 'sim' : 'não']));

// cada sequência aparece em outro lugar, fora do @?
out.push('## Onde cada sequência aparece', '');
out.push('Para cada sequência aceita: quantas vezes ela aparece entre duas partes com cara de e-mail (no lugar do @) e ' +
  'quantas vezes aparece no texto lido dos contraexemplos (como palavra solta ou dentro de palavra).', '');
const textoContra = contra.map((c) => c.lido);
tabela(['Sequência da lista', 'No lugar do @ (sem os espaços em volta)', 'Linhas de contraexemplo que a contêm', 'Contraexemplos que viraram e-mail com a regra'],
  REGRA.sequencias.map((sq) => {
    const noLugar = leituras.filter((l) => l.leitura_arroba.trim().includes(sq)).length;
    const fora = textoContra.filter((t) => t.includes(sq)).length;
    const viraram = contra.filter((c) => c.falso_depois === 1 && c.lido.includes(sq)).length;
    return [mostrar(sq), noLugar, fora, viraram];
  }));

// cada leitura comum: aparece também nos textos que não são e-mail, no mesmo formato (colada entre uma parte com
// cara de usuário e uma parte com cara de domínio)? Se aparece, aceitá-la cria falso positivo.
out.push('## Leituras que só aparecem no lugar do @', '');
out.push('Para as 30 leituras mais comuns (sem os espaços em volta): quantos contraexemplos têm a mesma sequência no ' +
  'mesmo formato, colada entre uma parte com cara de usuário e uma parte com cara de domínio (`algo` + sequência + `dominio.xx`).', '');
const escaparRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
tabela(['Sequência', 'No lugar do @', 'Contraexemplos com a sequência nesse formato', 'Exemplo'],
  [...nucleo].sort((a, b) => b[1] - a[1]).filter(([k]) => k !== '').slice(0, 30).map(([k, n]) => {
    const re = new RegExp(String.raw`(?<![A-Za-z0-9._%+\-])[A-Za-z0-9._%+\-]*[A-Za-z0-9]` + escaparRe(k) +
      String.raw`[A-Za-z0-9][A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}`);
    const com = contra.filter((c) => re.test(c._texto));
    return [mostrar(k), n, com.length, com.length ? mostrar(com[0]._texto.match(re)[0]) : ''];
  }));

// taxa de acerto
const grupoTaxa = (titulo, chave) => {
  const g = new Map();
  for (const l of leituras) {
    const k = chave(l);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(l);
  }
  out.push(`### Por ${titulo}`, '');
  tabela([titulo, 'E-mails', 'Antes: inteiro', 'Antes: algum', 'Depois: inteiro', 'Depois: algum'],
    [...g].sort((a, b) => (isNaN(a[0]) ? String(a[0]).localeCompare(b[0]) : a[0] - b[0])).map(([k, l]) => [k, l.length,
      pct(soma(l, 'antes_exato'), l.length), pct(soma(l, 'antes_sugere'), l.length),
      pct(soma(l, 'depois_exato'), l.length), pct(soma(l, 'depois_sugere'), l.length)]));
};
out.push('## Taxa de acerto, antes e depois da regra', '');
out.push('"Inteiro": a sugestão é o e-mail inteiro, letra por letra. "Algum": houve alguma sugestão de e-mail na linha ' +
  '(pode cobrir só parte dele, quando o OCR errou outra letra).', '');
tabela(['', 'E-mails', 'Antes: inteiro', 'Antes: algum', 'Depois: inteiro', 'Depois: algum'],
  [['Todos', leituras.length, pct(soma(leituras, 'antes_exato'), leituras.length), pct(soma(leituras, 'antes_sugere'), leituras.length),
    pct(soma(leituras, 'depois_exato'), leituras.length), pct(soma(leituras, 'depois_sugere'), leituras.length)]]);
out.push(`Teto: se o OCR lesse o @ certo e o resto do e-mail como leu, a procura de hoje acharia o e-mail inteiro em ` +
  `${soma(leituras, 'teto_arroba_certo')} de ${leituras.length} (${pct(soma(leituras, 'teto_arroba_certo'), leituras.length)}). ` +
  'O que falta até o teto é o @ lido como outra coisa que a regra não aceita; o que falta depois do teto são erros do OCR em outras letras do e-mail.', '');
grupoTaxa('desenho', (l) => l.desenho);
grupoTaxa('fonte', (l) => l.fonte);
grupoTaxa('tipo de fonte', (l) => l.tipo_fonte);
grupoTaxa('tamanho (pt)', (l) => +l.tamanho_pt);
grupoTaxa('dpi', (l) => +l.dpi);
grupoTaxa('estado', (l) => l.estado);
grupoTaxa('final do domínio', (l) => l.final);
grupoTaxa('parte antes do @', (l) => (+l.numero ? 'com número' : +l.hifen ? 'com hífen' : +l.ponto ? 'com ponto' : 'simples'));

// regras candidatas: a mesma medida com outras listas de sequências
out.push('## Comparação de listas de sequências', '');
const LETRAS = ['G', 'g', 'Q', 'O', 'E', 'e', 'd', 'k', 'D', 'gG', 'GQ', 'Gg', 'Ek', 'o', 'QD', 'WO', 'OD', 'G0', 'GO'];
const CANDIDATAS = [
  ['hoje (só corrigirOcr)', criarRegra([], '')],
  ['a proposta', REGRA],
  ['a proposta + ␣Q (Q depois de um espaço, colado no domínio)', criarRegra([...SEQUENCIAS, SEQUENCIA_ESPACO_Q], '')],
  ['a proposta + ␣Q, ␣O, ␣G', criarRegra([...SEQUENCIAS, ' Q', ' O', ' G'], '')],
  ['a proposta + letras sozinhas (G, g, O, E...)', criarRegra([...SEQUENCIAS, ...LETRAS], '')],
  ['só "&" e "(D"', criarRegra(['&', '(D'], '')],
  ['a proposta + maiúsculas coladas entre minúsculas', criarRegra(SEQUENCIAS, '', { maiusculas: true })],
  ['a proposta + ␣Q + maiúsculas coladas', criarRegra([...SEQUENCIAS, SEQUENCIA_ESPACO_Q], '', { maiusculas: true })],
];
const medir = (regra) => {
  let inteiro = 0, falso = 0, falsoOcr = 0;
  for (const l of leituras) {
    const lista = [...l._antes, ...regra.emails(l._texto)];
    if (l.regiao !== '' && lista.some((t) => t.includes(l.regiao))) inteiro++;
  }
  for (const c of contra) {
    if (c._antes.length || regra.emails(c._texto).length) { falso++; if (c.origem === 'ocr') falsoOcr++; }
  }
  return [inteiro, falso, falsoOcr];
};
const nOcr = contra.filter((c) => c.origem === 'ocr').length;
tabela(['Lista', 'E-mail inteiro sugerido', 'Contraexemplos que viram e-mail (todos)', 'Só os lidos pelo OCR'],
  CANDIDATAS.map(([nome, r]) => { const [i, f, fo] = medir(r); return [nome, `${i} (${pct(i, leituras.length)})`, `${f} de ${contra.length} (${pct(f, contra.length)})`, `${fo} de ${nOcr} (${pct(fo, nOcr)})`]; }));

for (const [nome, r] of CANDIDATAS.slice(2)) {
  const f = contra.filter((c) => !c._antes.length && r.emails(c._texto).length);
  out.push(`Contraexemplos que viram e-mail com "${nome}" (${f.length}, até 12): ` +
    f.slice(0, 12).map((c) => mostrar(c._texto) + ' → ' + r.emails(c._texto).map(mostrar).join(', ')).join('; '), '');
}

// os seis casos do defeito 3 de docs/LINUX.md: as leituras de lá e as da reprodução daqui
out.push('## Os seis casos do defeito 3 (docs/LINUX.md)', '');
const LINUX = [['Liberation Sans', 'fulano.teste WOexemplo.test'], ['DejaVu Sans', 'fulano.testeG&Qexemplo.test'],
  ['FreeSans', 'fulano.testeQDexemplo.test'], ['Carlito', 'fulano.teste Qexemplo.test'],
  ['Caladea', 'fulano.teste&Qexemplo.test'], ['DejaVu Serif', 'fulano.testeQ&exemplo.test']];
const pega = (regra, lido) => procurarEscrito('E-mail: ' + lido, regra).depois.some((t) => t.startsWith('fulano.teste') && t.endsWith('exemplo.test'));
const marcar = (b) => (b ? 'sim' : 'não');
tabela(['Fonte', 'Lido no docs/LINUX.md', 'Hoje', 'Proposta', '+ ␣Q', '+ ␣Q + maiúsculas', 'Lido na reprodução daqui', 'Hoje', 'Proposta', '+ ␣Q', '+ ␣Q + maiúsculas'],
  LINUX.map(([fonte, lido]) => {
    const rep = leituras.find((l) => l.desenho === 'reproducao' && l.fonte === fonte);
    const lidoRep = rep ? rep.lido.replace(/^E-mail: /, '') : '';
    const cols = (t) => [CANDIDATAS[0][1], REGRA, CANDIDATAS[2][1], CANDIDATAS[CANDIDATAS.length - 1][1]].map((r) => marcar(pega(r, t)));
    return [fonte, mostrar(lido), ...cols(lido), mostrar(lidoRep), ...cols(lidoRep)];
  }));

// falsos positivos
out.push('## Falsos positivos', '');
const og = new Map();
for (const c of contra) { if (!og.has(c.origem)) og.set(c.origem, []); og.get(c.origem).push(c); }
tabela(['Origem', 'Textos', 'Viram e-mail antes', 'Viram e-mail depois', 'Taxa depois'],
  [...og].map(([k, l]) => [k, l.length, soma(l, 'falso_antes'), soma(l, 'falso_depois'), pct(soma(l, 'falso_depois'), l.length)]));
const falsos = contra.filter((c) => c.falso_depois && !c.falso_antes);
out.push(`Contraexemplos que a regra transforma em e-mail (${falsos.length}):`, '');
for (const c of falsos.slice(0, 50)) out.push(`- ${c.origem}: ${mostrar(c.lido)} vira ${mostrar(c.depois)}`);
out.push('');
const falsosAntes = contra.filter((c) => c.falso_antes);
out.push(`Contraexemplos que já viram e-mail hoje, sem a regra (${falsosAntes.length}):`, '');
for (const c of falsosAntes.slice(0, 30)) out.push(`- ${c.origem}: ${mostrar(c.lido)} vira ${mostrar(c.antes)}`);
out.push('');

// e-mails que continuam sem sugestão
const perdidos = leituras.filter((l) => !+l.depois_exato);
const motivo = new Map();
for (const l of perdidos) {
  const k = !+l.depois_sugere ? 'sem sugestão' : 'sugestão parcial';
  motivo.set(k, (motivo.get(k) || 0) + 1);
}
out.push('## E-mails que continuam sem sugestão inteira depois da regra', '');
tabela(['Situação', 'Vezes'], [...motivo]);
out.push('Exemplos (até 40):', '');
for (const l of perdidos.slice(0, 40)) out.push(`- ${l.fonte} ${l.tamanho_pt} pt ${l.dpi} ppp ${l.estado}: esperado ${mostrar(l.email)}, lido ${mostrar(l.lido)}`);
out.push('');

writeFileSync(join(AQUI, 'resultados.md'), out.join('\n'));
console.log(out.slice(0, 60).join('\n'));
