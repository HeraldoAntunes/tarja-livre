// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Testes de propriedade (fuzzing por geração aleatória, fast-check): em vez de exemplos fixos, milhares de entradas
// geradas, e a regra tem de valer em todas. Números gerados aqui são calculados na hora, nunca de pessoa real.
// Em .js, não .mjs: o Scorecard (Fuzzing) só procura o fast-check em *.js e *.jsx; o package.json daqui é "type": "module".
// Uso: npm ci --ignore-scripts --prefix tests/propriedades && node --test tests/propriedades/propriedades.test.js
import { test } from 'node:test';
import fc from 'fast-check';
import { procurar, cpfValido, cnpjValido, juntarTexto, prepararTermos, MAX_TERMOS, MAX_LETRAS_TERMO } from '../../src/achados.js';

const VEZES = { numRuns: 2000 };
const digito = fc.integer({ min: 0, max: 9 });

// dígitos verificadores calculados como no programa (o teste confere o programa contra a regra, não contra ele mesmo)
function comDvCpf(base) {
  const d = [...base];
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += d[i] * (n + 1 - i);
    d.push(((soma * 10) % 11) % 10);
  }
  return d;
}
function comDvCnpj(base) {
  const d = [...base];
  const pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (const n of [12, 13]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += d[i] * pesos[i + 13 - n];
    const resto = soma % 11;
    d.push(resto < 2 ? 0 : 11 - resto);
  }
  return d;
}
const naoRepetido = (d) => new Set(d).size > 1;
const cpf = fc.array(digito, { minLength: 9, maxLength: 9 }).map(comDvCpf).filter(naoRepetido);
const cnpj = fc.array(digito, { minLength: 12, maxLength: 12 }).map(comDvCnpj).filter(naoRepetido);
const formatarCpf = (d) => `${d.slice(0, 3).join('')}.${d.slice(3, 6).join('')}.${d.slice(6, 9).join('')}-${d.slice(9).join('')}`;
const linha = (str) => ({ str, x: 50, y: 100, w: str.length * 6, h: 10, eol: true });

test('CPF com dígitos certos é aceito, com ou sem pontuação', () => {
  fc.assert(fc.property(cpf, (d) => cpfValido(d.join('')) && cpfValido(formatarCpf(d))), VEZES);
});

// Um dígito trocado nem sempre é recusado: a própria regra junta os restos 10 e 0 (CPF) ou 0 e 1 (CNPJ) num dígito
// só, e há trocas que continuam válidas (achado pelo fast-check em 30/10/2026). Então a propriedade é concordar com o
// cálculo da regra em qualquer sequência, inclusive nas trocadas a partir de um número certo.
const concordaCpf = (e) => cpfValido(e.join('')) === (naoRepetido(e) && comDvCpf(e.slice(0, 9)).join('') === e.join(''));
const concordaCnpj = (e) => cnpjValido(e.join('')) === (naoRepetido(e) && comDvCnpj(e.slice(0, 12)).join('') === e.join(''));
const trocar = (d, i, soma) => d.map((x, k) => (k === i ? (x + soma) % 10 : x));

test('CPF: o programa concorda com a regra, em número certo, trocado ou qualquer', () => {
  fc.assert(fc.property(cpf, fc.integer({ min: 0, max: 10 }), fc.integer({ min: 1, max: 9 }), fc.array(digito, { minLength: 11, maxLength: 11 }),
    (d, i, soma, qualquer) => cpfValido(d.join('')) && concordaCpf(trocar(d, i, soma)) && concordaCpf(qualquer)), VEZES);
});

test('CNPJ: o programa concorda com a regra, em número certo, trocado ou qualquer', () => {
  fc.assert(fc.property(cnpj, fc.integer({ min: 0, max: 13 }), fc.integer({ min: 1, max: 9 }), fc.array(digito, { minLength: 14, maxLength: 14 }),
    (d, i, soma, qualquer) => cnpjValido(d.join('')) && concordaCnpj(trocar(d, i, soma)) && concordaCnpj(qualquer)), VEZES);
});

test('CPF válido no meio de texto qualquer é achado, e o trecho achado é ele', () => {
  const palavra = fc.stringMatching(/^[A-Za-zÀ-ú]{1,12}$/);
  fc.assert(fc.property(cpf, palavra, palavra, (d, antes, depois) => {
    const numero = formatarCpf(d);
    const achados = procurar([linha(`${antes} ${numero} ${depois}`)], ['cpf']);
    return achados.length === 1 && achados[0].trecho === numero && achados[0].caixas.length >= 1;
  }), VEZES);
});

test('juntarTexto: cada letra do texto sabe de que pedaço veio, e veio igual', () => {
  const pedaco = fc.record({
    str: fc.string({ minLength: 1, maxLength: 20 }), x: fc.integer({ min: 0, max: 600 }), y: fc.integer({ min: 0, max: 800 }),
    w: fc.integer({ min: 1, max: 200 }), h: fc.integer({ min: 1, max: 30 }), eol: fc.boolean(),
  });
  fc.assert(fc.property(fc.array(pedaco, { maxLength: 15 }), (pedacos) => {
    const { texto, origem } = juntarTexto(pedacos);
    return origem.length === texto.length &&
      origem.every((o, k) => (o === null ? texto[k] === ' ' : pedacos[o[0]].str[o[1]] === texto[k]));
  }), VEZES);
});

test('prepararTermos: no máximo 500 termos, cada um aparado, de 2 a 200 letras e sem repetido', () => {
  fc.assert(fc.property(fc.string({ maxLength: 3000 }), (texto) => {
    const lista = prepararTermos(texto);
    const chaves = lista.map((t) => t.toLocaleLowerCase('pt-BR'));
    return lista.length <= MAX_TERMOS && new Set(chaves).size === lista.length &&
      lista.every((t) => t === t.trim() && t.length >= 2 && t.length <= MAX_LETRAS_TERMO && !/\s{2}|[\r\n;]/.test(t));
  }), VEZES);
});
