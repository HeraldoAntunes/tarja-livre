// Tarja Livre: a caixa da camada de texto invisível vai até as letras da imagem (prova da tarja da 1.2.2, achado 1),
// com limite: não engole a linha de cima ou de baixo, nem a coluna vizinha, nem uma página escura ou com foto; e diz
// o que a pessoa deve conferir (revisão do Codex na 1.2.3-rc.1: letra cinza-clara, camada longe, vizinha colada)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ajustarATinta, textoAparece, bateComImagem, temDesenho } from '../src/achados.js';

// página de 600 × 300 pontos, 2 pixels por ponto, fundo quase branco (250); cada mancha é um retângulo em pontos
// [x, y, w, h, luminosidade (20 se faltar)]
function pagina(manchas, fundo = 250) {
  const escala = 2;
  const largura = 1200;
  const altura = 600;
  const lum = new Uint8Array(largura * altura).fill(fundo);
  for (const [x, y, w, h, cor = 20] of manchas) {
    for (let py = Math.round(y * escala); py < Math.round((y + h) * escala); py++) {
      for (let px = Math.round(x * escala); px < Math.round((x + w) * escala); px++) lum[py * largura + px] = cor;
    }
  }
  return { largura, altura, escala, lum };
}
const cobre = (k, [x, y, w, h]) => k.x <= x && k.y <= y && k.x + k.w >= x + w && k.y + k.h >= y + h;
const cobrem = (caixas, l) => caixas.some((k) => cobre(k, l));
const toca = (k, [x, y, w, h]) => k.x < x + w && k.x + k.w > x && k.y < y + h && k.y + k.h > y;
// letras de 8 × 10 pontos (texto de 14 pontos), 1,5 ponto de vão: uma palavra de 6 letras a partir de x0, topo em y0
const palavra = (x0 = 100, y0 = 50, n = 6, cor = 20) => Array.from({ length: n }, (_, i) => [x0 + i * 9.5, y0, 8, 10, cor]);
// a caixa que a camada daria para a palavra, de 14 pontos de altura de letra (como caixas() em achados.js)
const daCamada = (x, base, w) => ({ x: x - 4.2, y: base - 14 * 1.07, w: w + 8.4, h: 14 * 1.49 });

test('camada mais estreita que a imagem: a caixa cresce até a última letra', () => {
  const letras = palavra();
  const { caixas } = ajustarATinta(daCamada(100, 60, 30), pagina(letras), 14);
  for (const l of letras) assert.ok(cobrem(caixas, l), `letra em ${l[0]} à mostra`);
});

test('camada abaixo das letras: a caixa sobe até o topo delas', () => {
  const letras = palavra();
  const { caixas } = ajustarATinta(daCamada(100, 66, 55), pagina(letras), 14);
  for (const l of letras) assert.ok(cobrem(caixas, l), `letra em ${l[0]} à mostra`);
});

test('letras cinza-claras, com texto preto perto: o limiar sai do fundo, e a caixa cobre todas', () => {
  // cinza 168 (o cenário cinza-claro do Codex): o limiar fixo em 160 da rc.1 não via essas letras
  const letras = palavra(100, 50, 6, 168);
  const tinta = pagina([...letras, ...palavra(100, 90, 10)]);
  const { caixas } = ajustarATinta(daCamada(100, 64, 30), tinta, 14);
  for (const l of letras) assert.ok(cobrem(caixas, l), `letra cinza em ${l[0]} à mostra`);
});

test('a outra palavra, depois do espaço, não entra; a caixa nunca encolhe', () => {
  const outra = [175, 50, 8, 10];   // 17 pontos depois da última letra: um espaço
  const k = daCamada(100, 60, 55);
  const { caixas } = ajustarATinta(k, pagina([...palavra(), outra]), 14);
  assert.ok(caixas.every((c) => !toca(c, outra)), 'a palavra seguinte não pode ser coberta');
  assert.ok(cobre(caixas[0], [k.x, k.y, k.w, k.h]), 'a caixa encolheu');
});

test('linhas de cima e de baixo coladas (entrelinha de 1,15) não entram, nem com a camada deslocada', () => {
  // texto de 14 pontos com entrelinha de 16: a linha de cima termina 6 pontos acima, a de baixo começa 6 abaixo
  const cima = palavra(90, 34, 10);
  const meio = palavra();
  const baixo = palavra(90, 66, 10);
  const tinta = pagina([...cima, ...meio, ...baixo]);
  for (const [rotulo, base] of [['camada certa', 60], ['camada 6 pontos abaixo', 66], ['camada 4 pontos acima', 56]]) {
    const { caixas } = ajustarATinta(daCamada(100, base, 55), tinta, 14);
    for (const l of meio) assert.ok(cobrem(caixas, l), `${rotulo}: letra em ${l[0]} à mostra`);
    const outras = [...cima, ...baixo].filter((l) => cobrem(caixas, l));
    assert.deepEqual(outras, [], `${rotulo}: engoliu letras da linha de cima ou de baixo`);
  }
});

test('rótulo antes do dado ("Nome: "), que só a folga da caixa toca, não entra', () => {
  // "Nome" e os dois-pontos terminam 4 pontos antes do dado (um espaço); a caixa da camada, com folga, corta os
  // dois-pontos (na prova da tarja, camada-ocr, a rc.1 cobria quase todo o "Nome:")
  const rotulo = [...palavra(55, 50, 4), [93, 52, 3, 8]];
  const r = ajustarATinta(daCamada(100, 60, 55), pagina([...rotulo, ...palavra()]), 14);
  for (const l of palavra()) assert.ok(cobrem(r.caixas, l), `letra em ${l[0]} à mostra`);
  assert.ok(rotulo.slice(0, 4).every((l) => r.caixas.every((c) => !toca(c, l))), 'cobriu o rótulo');
  assert.equal(r.nota, 'ajustada');
});

test('coluna vizinha, a um vão de coluna, não entra', () => {
  const vizinha = palavra(178, 50, 8);   // 21 pontos depois: o vão entre duas colunas
  const { caixas } = ajustarATinta(daCamada(100, 60, 30), pagina([...palavra(), ...vizinha]), 14);
  assert.ok(vizinha.every((l) => caixas.every((c) => !toca(c, l))), 'a coluna vizinha foi coberta');
});

test('linha de tabela, foto ou fundo escuro em volta: a caixa fica como veio, e a nota manda tarjar à mão', () => {
  const k = daCamada(100, 60, 55);
  for (const [rotulo, mancha] of [['linha de tabela', [20, 62, 560, 1]], ['foto', [60, 20, 200, 120]], ['fundo escuro', [0, 0, 600, 300]]]) {
    assert.deepEqual(ajustarATinta(k, pagina([mancha]), 14), { caixas: [k], nota: 'sem-letras' }, rotulo);
  }
});

test('o crescimento tem limite, e crescer além da camada pede para conferir as vizinhas', () => {
  // 30 letras coladas depois da caixa (sem espaço): a caixa não passa de 3 letras de altura para o lado
  const k = daCamada(100, 60, 30);
  const { caixas, nota } = ajustarATinta(k, pagina(palavra(100, 50, 30)), 14);
  assert.ok(caixas[0].x + caixas[0].w <= k.x + k.w + 3 * 14 + 2, `cresceu até ${caixas[0].x + caixas[0].w}`);
  assert.equal(nota, 'cresceu');
  assert.equal(ajustarATinta(daCamada(100, 60, 55), pagina(palavra()), 14).nota, 'ajustada', 'a camada certa');
});

test('letra pública colada no dado (o vizinho-colado do Codex): coberta, mas a nota diz que pode ser vizinha', () => {
  // a camada só tem as 6 letras do dado; a sétima, colada, não está nela
  const { nota } = ajustarATinta(daCamada(100, 60, 55), pagina(palavra(100, 50, 7)), 14);
  assert.equal(nota, 'cresceu');
});

test('camada longe das letras: acha a palavra da largura dela, mesmo com outra linha mais perto', () => {
  // o dado 32 pontos acima da camada; uma linha pública mais curta, mais perto, embaixo (o ocr-longe do Codex)
  const dado = palavra(100, 50, 12);
  const publica = [...palavra(100, 104, 3), ...palavra(140, 104, 3)];
  const r = ajustarATinta(daCamada(100, 92, 112), pagina([...dado, ...publica]), 14);
  assert.equal(r.nota, 'longe');
  for (const l of dado) assert.ok(cobrem(r.caixas, l), `letra em ${l[0]} à mostra`);
  assert.ok(publica.every((l) => r.caixas.every((c) => !toca(c, l))), 'cobriu a linha pública');
});

test('camada longe e duas palavras parecidas: não escolhe, a nota manda tarjar à mão', () => {
  const k = daCamada(100, 92, 55);
  const r = ajustarATinta(k, pagina([...palavra(100, 50), ...palavra(100, 110)]), 14);
  assert.deepEqual(r, { caixas: [k], nota: 'sem-letras' });
});

test('sem tinta perto, a caixa fica como veio, e a nota manda tarjar à mão', () => {
  const k = { x: 300, y: 200, w: 50, h: 20 };
  assert.deepEqual(ajustarATinta(k, pagina(palavra()), 14), { caixas: [k], nota: 'sem-letras' });
});

// Revisão do Codex na 1.2.3-rc.2: no cinza-claro da Ordem 24 (fonte de largura fixa), o I estreito deixa vão de quase
// um quarto da altura da letra, e um quinto fixo parava a caixa antes do "IGO". Letras de 14 pontos, com vãos de 1,3 a
// 3,4 pontos (0,09 a 0,24 da altura), como as medidas no PDF original
const larguraFixa = (x0 = 100, y0 = 50) => {
  const larguras = [7.5, 3.2, 8.9, 3.2, 8.6, 9.0, 8.7, 9.0, 3.2, 8.9, 9.0];
  const vaos = [3.4, 2.9, 2.3, 2.9, 1.7, 1.7, 2.3, 1.3, 3.4, 2.9, 1.3];
  let x = x0;
  return larguras.map((w, i) => { const l = [x, y0, w, 10]; x += w + vaos[i]; return l; });
};

test('fonte de largura fixa: a caixa atravessa o vão do I estreito e cobre a palavra inteira', () => {
  const letras = larguraFixa();
  const fim = letras.at(-1)[0] + letras.at(-1)[2];
  const r = ajustarATinta(daCamada(100, 60, 0.72 * (fim - 100)), pagina(letras), 14);
  for (const l of letras) assert.ok(cobrem(r.caixas, l), `letra em ${l[0].toFixed(1)} à mostra`);
  assert.equal(r.nota, 'cresceu');
});

test('letra logo depois da tarja, a um vão pouco maior que os da palavra: a nota diz que pode estar curta', () => {
  // 6 letras com vão de 1,5 ponto e, a 3,2 pontos (mais que um quinto da altura, menos que 1,25 disso), mais uma
  const letras = [...palavra(), [100 + 5 * 9.5 + 8 + 3.2, 50, 8, 10]];
  const r = ajustarATinta(daCamada(100, 60, 55), pagina(letras), 14);
  assert.equal(r.nota, 'curta');
});

test('textoAparece: o texto visível muda os pixels da caixa; o escondido, não', () => {
  const caixa = daCamada(100, 60, 55);
  const semTexto = pagina([]);
  assert.equal(textoAparece(caixa, pagina(palavra()), semTexto), true, 'letra escura no fundo claro');
  const escuro = [[0, 0, 600, 300, 30]];
  assert.equal(textoAparece(caixa, pagina([...escuro, ...palavra(100, 50, 6, 230)]), pagina(escuro)), true, 'letra clara no fundo escuro');
  assert.equal(textoAparece(caixa, semTexto, semTexto), false, 'texto que não muda nada');
});

test('textoAparece: palavra pública da imagem embaixo da camada escondida não faz o texto aparecer', () => {
  // revisão do Codex na 1.2.3-rc.3 (recorte-publico, branco-publico): a imagem tem outra palavra no lugar da camada
  const caixa = daCamada(100, 60, 55);
  const imagem = pagina(palavra(100, 50, 6));
  assert.equal(textoAparece(caixa, imagem, imagem), false, 'recorte: o texto não pinta nada');
  // tinta branca: pinta branco sobre pedaços das letras da imagem; muda pixels, mas deixa branco no branco
  const branco = pagina([...palavra(100, 50, 6), ...palavra(101, 52, 6, 250)]);
  assert.equal(textoAparece(caixa, branco, imagem), false, 'tinta branca');
});

test('textoAparece: texto coberto pela metade não aparece todo', () => {
  const caixa = daCamada(100, 60, 55);
  assert.equal(textoAparece(caixa, pagina(palavra(100, 50, 3)), pagina([])), false);
});

test('textoAparece: palavra na vertical (página girada) é dividida em quartos no comprimento', () => {
  const caixa = { x: 96, y: 40, w: 22, h: 70 };
  const letras = Array.from({ length: 6 }, (_, i) => [100, 45 + i * 10, 10, 8]);
  assert.equal(textoAparece(caixa, pagina(letras), pagina([])), true);
  assert.equal(textoAparece(caixa, pagina(letras.slice(0, 3)), pagina([])), false, 'metade de baixo coberta');
});

// revisão independente da gestão na 1.2.3-rc.4: a camada visível que não tem o tamanho e o lugar das letras da imagem
const comImagem = (manchas, imagens = [{ x0: 0, y0: 0, x1: 1200, y1: 600 }]) => ({ ...pagina(manchas), imagens });
test('bateComImagem: sem imagem perto, ou com a imagem das mesmas letras na caixa, bate', () => {
  const caixa = daCamada(100, 60, 6 * 9.5);
  assert.equal(bateComImagem(caixa, comImagem(palavra(), [])), true, 'página sem imagem');
  assert.equal(bateComImagem(caixa, comImagem([], [{ x0: 1000, y0: 500, x1: 1200, y1: 600 }])), true, 'imagem longe');
  assert.equal(bateComImagem(caixa, comImagem([])), true, 'imagem lisa');
  assert.equal(bateComImagem(caixa, comImagem(palavra())), true, 'as mesmas letras da imagem embaixo');
});
test('bateComImagem: camada minúscula sob o dado grande, ou sobre outra palavra com o dado na linha de cima, não bate', () => {
  // dado de 18 pt na imagem (letras de 11 × 13 pt) e camada de 2 pt logo abaixo (s1 e s6 da revisão)
  const grande = Array.from({ length: 6 }, (_, i) => [100 + i * 13, 40, 11, 13]);
  assert.equal(bateComImagem({ x: 100, y: 54, w: 78, h: 2.98 }, comImagem(grande)), false, 'camada de 2 pt');
  // palavra pública embaixo da camada e o dado na linha de cima, a 24 pt (s3 e s3b)
  const caixa = daCamada(100, 90, 6 * 9.5);
  assert.equal(bateComImagem(caixa, comImagem([...palavra(100, 80), ...palavra(100, 56)])), false, 'dado na linha de cima');
  assert.equal(bateComImagem(caixa, null), false, 'sem o desenho sem texto');
});

// regra da gestão na revisão da 1.2.3-rc.5: imagem ou desenho fora de linha reta e retângulo, em qualquer lugar
const comCirculo = (base, cx, cy, r, cor = 20) => {
  const pg = pagina(base, 255);
  for (let y = 0; y < pg.altura; y++) for (let x = 0; x < pg.largura; x++) {
    if ((x / 2 - cx) ** 2 + (y / 2 - cy) ** 2 <= r * r) pg.lum[y * pg.largura + x] = cor;
  }
  return pg;
};
// as páginas de temDesenho são sobre branco puro, como o PDF.js pinta a página sem texto
const branca = (manchas) => pagina(manchas, 255);
test('temDesenho: página lisa não tem desenho; tabela e sublinhado agora contam (decisão do professor na rc.9, v1)', () => {
  assert.equal(temDesenho(branca([])), false, 'página em branco');
  // grade de tabela de 1 pt e 0,5 pt, com cruzamentos, e linha de assinatura de 1,5 pt: o programa não distingue
  // uma tabela de um dado desenhado com linhas, então conta
  const grade = [];
  for (let y = 40; y <= 240; y += 25) grade.push([50, y, 500, y === 40 ? 1 : 0.5]);
  for (let x = 50; x <= 550; x += 100) grade.push([x, 40, 1, 200]);
  assert.equal(temDesenho(branca(grade)), true, 'grade de tabela');
  assert.equal(temDesenho(branca([[300, 270, 150, 1.5]])), true, 'linha de assinatura');
  assert.equal(temDesenho(branca([[100, 100, 2, 2]])), false, 'até 20 pixels de tinta não contam');
});
test('temDesenho: área preenchida, faixa e letras de blocos retos contam como desenho (revisão da gestão na rc.6, r1 e r2)', () => {
  assert.equal(temDesenho(branca([[0, 0, 600, 30, 120]])), true, 'faixa escura no topo');
  assert.equal(temDesenho(branca([[300, 200, 80, 40, 200]])), true, 'retângulo cinza');
  // "I" e "L" em blocos de 5 pt: toda borda reta
  const blocos = [[100, 100, 15, 5], [105, 105, 5, 15], [100, 120, 15, 5], [130, 100, 5, 25], [130, 120, 15, 5]];
  assert.equal(temDesenho(branca(blocos)), true, 'letras de blocos de 5 pt');
  // sete segmentos finos (1 pt) e curtos (6 pt)
  const sete = [[100, 100, 6, 1], [100, 100, 1, 6], [105, 100, 1, 6], [100, 105, 6, 1], [100, 105, 1, 6], [105, 105, 1, 6], [100, 110, 6, 1]];
  assert.equal(temDesenho(branca(sete)), true, 'número de sete segmentos finos');
  // revisão da gestão na rc.7 (t2): sete segmentos de traço de 1 pt e segmentos de 12 pt, que correm retos por mais de
  // 10 pt; e um "8" maior, de segmentos de 40 pt, com traços que se juntam em L e T numa peça menor que 100 pt
  const oito = (x, y, c) => [[x, y, c, 1], [x, y + c, c, 1], [x, y + 2 * c, c, 1], [x, y, 1, 2 * c + 1], [x + c, y, 1, 2 * c + 1]];
  assert.equal(temDesenho(branca(oito(100, 50, 12))), true, 'sete segmentos de 12 pt');
  assert.equal(temDesenho(branca(oito(100, 50, 40))), true, 'sete segmentos de 40 pt');
  assert.equal(temDesenho(branca([[100, 100, 10, 0.75], [100, 110, 10, 0.75], [100, 100, 0.75, 10], [110, 100, 0.75, 10.75]])), true,
    'caixinha de marcar de 10 pt (o lado seguro: "confira" a mais)');
});
test('temDesenho: qualquer imagem na página conta, mesmo de tinta clara demais para o limiar (revisão da gestão na rc.7, t3)', () => {
  const pg = branca([[100, 100, 80, 20, 253]]);
  assert.equal(temDesenho(pg), false, 'sem saber da imagem, a tinta quase branca (253) não conta');
  assert.equal(temDesenho({ ...pg, imagens: [{ x0: 200, y0: 200, x1: 360, y1: 240 }] }), true, 'com a imagem desenhada, conta');
});
test('temDesenho: dígitos feitos de linhas que atravessam o glifo contam (revisão da rc.9, v1)', () => {
  // "0" e "8" de 60 x 104 pt com traço de 1 pt: antes passavam como reticulado regular
  const zero = (x) => [[x, 20, 60, 1], [x, 123, 60, 1], [x, 20, 1, 104], [x + 59, 20, 1, 104]];
  const oito = (x) => [...zero(x), [x, 71, 60, 1]];
  assert.equal(temDesenho(branca([...zero(50), ...oito(130), ...zero(210)])), true, 'CPF em reticulado');
});
test('temDesenho: a cor conta por canal; amarelo-pálido e cinza 0,98 contam (revisão da rc.9, v2)', () => {
  const pg = branca([]);
  const amarelo = new Uint8Array(pg.lum.length);
  for (let y = 200; y < 240; y++) for (let x = 200; x < 300; x++) { pg.lum[y * pg.largura + x] = 251; amarelo[y * pg.largura + x] = 40; }
  assert.equal(temDesenho({ ...pg, afasta: amarelo }), true, 'amarelo (255,255,215): luminosidade 251, azul 40 abaixo do branco');
  assert.equal(temDesenho(branca([[100, 100, 30, 6, 250]])), true, 'cinza 0,98 (250)');
  assert.equal(temDesenho(branca([[100, 100, 30, 6, 252]])), false, 'cinza 0,99 (252): 3 níveis, não conta');
});
test('temDesenho: tinta vetorial clara (cinza 0,93 a 0,97) conta (revisão da rc.8, u2)', () => {
  for (const lum of [237, 242, 247]) {
    const pg = branca([[100, 100, 6, 6, lum], [110, 100, 6, 6, lum], [120, 104, 6, 6, lum]]);
    assert.equal(temDesenho(pg), true, `cinza de luminosidade ${lum}`);
  }
});
test('temDesenho: curva, letra pequena ou letra sobre imagem cinza têm desenho', () => {
  assert.equal(temDesenho(comCirculo([], 300, 150, 9)), true, 'círculo (letra O, carimbo)');
  assert.equal(temDesenho(branca(palavra(100, 50, 6).map(([x, y]) => [x, y, 1.2, 1.2]))), true, 'pontinhos (letra miúda)');
  assert.equal(temDesenho(comCirculo([[0, 0, 600, 300, 150]], 300, 150, 6, 30)), true, 'letra escura sobre imagem cinza');
  assert.equal(temDesenho(null), true, 'sem o desenho sem texto');
});
