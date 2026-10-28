// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Testes da procura de dados pessoais. Todos os números são de exemplo, gerados só para o teste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { procurar, cpfValido, cnpjValido, coberta, juntarTexto, prepararTermos, corrigirOcr, selecionar } from '../src/achados.js';

// uma linha de texto como um único pedaço, com 6 pt por letra
function linha(str, y = 100) {
  return { str, x: 50, y, w: str.length * 6, h: 10, eol: true };
}
const tipos = (pedacos, filtro) => procurar(pedacos, filtro).map((a) => a.tipo);

test('dígito verificador do CPF e do CNPJ', () => {
  assert.ok(cpfValido('831.975.872-60'));
  assert.ok(cpfValido('83197587260'));
  assert.ok(!cpfValido('831.975.872-61'));
  assert.ok(!cpfValido('111.111.111-11'));
  assert.ok(cnpjValido('19.808.456/0001-00'));
  assert.ok(!cnpjValido('19.808.456/0001-01'));
  assert.ok(!cnpjValido('00.000.000/0000-00'));
});

test('acha CPF válido e ignora CPF com dígito errado', () => {
  assert.deepEqual(tipos([linha('Aluno com CPF 831.975.872-60 matriculado')]), ['cpf']);
  assert.deepEqual(tipos([linha('Número 831.975.872-61 não é CPF')]), []);
});

test('acha CNPJ, e-mail, CEP e telefone', () => {
  const p = [linha('Empresa 19.808.456/0001-00, contato ana.exemplo@escola.test, CEP 00012-345, fone (00) 91234-5678')];
  assert.deepEqual(tipos(p), ['cnpj', 'email', 'cep', 'telefone']);
});

test('telefone em formatos comuns', () => {
  for (const t of ['(00) 3123-4567', '00 91234-5678', '+55 00 91234-5678', '3123-4567', '91234 5678']) {
    assert.deepEqual(tipos([linha(`Ligue ${t} hoje`)], ['telefone']), ['telefone'], t);
  }
  // sequência longa sem separador não é telefone
  assert.deepEqual(tipos([linha('Processo 00000012345202611')], ['telefone']), []);
});

test('RG formatado e RG depois da palavra', () => {
  assert.deepEqual(tipos([linha('Identidade 00.000.123-4 SSP')], ['rg']), ['rg']);
  const [a] = procurar([linha('RG nº 0000000123456 SSP-CE')], ['rg']);
  assert.equal(a.tipo, 'rg');
  // só o número entra na tarja, a palavra "RG" fica visível
  const { texto } = juntarTexto([linha('RG nº 0000000123456 SSP-CE')]);
  assert.equal(texto.slice(a.ini, a.fim), '0000000123456');
});

test('um CPF não vira telefone nem RG', () => {
  assert.deepEqual(tipos([linha('CPF 831.975.872-60')]), ['cpf']);
});

test('só os tipos pedidos', () => {
  const p = [linha('CPF 831.975.872-60 e ana@exemplo.test')];
  assert.deepEqual(tipos(p, ['email']), ['email']);
  assert.deepEqual(tipos(p, []), []);
});

test('número quebrado em dois pedaços na mesma linha vira um achado com uma caixa só, sem fresta', () => {
  const p = [
    { str: 'CPF 831.975', x: 50, y: 100, w: 66, h: 10, eol: false },
    { str: '.872-60', x: 116, y: 100, w: 42, h: 10, eol: true },
  ];
  const [a] = procurar(p, ['cpf']);
  assert.equal(a.tipo, 'cpf');
  assert.equal(a.caixas.length, 1);
  // do começo do número (letra 4 do primeiro pedaço, x = 74) ao fim do segundo pedaço (x = 158)
  const [c] = a.caixas;
  assert.ok(c.x <= 74 && c.x + c.w >= 158, `x de ${c.x} a ${c.x + c.w}`);
});

test('linhas diferentes não se juntam num número só', () => {
  const p = [linha('831.975', 100), linha('247-25', 120)];
  assert.deepEqual(tipos(p, ['cpf']), []);
});

test('caixa cobre o trecho achado, com folga', () => {
  const [a] = procurar([linha('CPF 831.975.872-60')], ['cpf']);
  const [c] = a.caixas;
  // o número começa na letra 4 (x = 50 + 4*6 = 74) e tem 14 letras (84 pt)
  assert.ok(c.x <= 74 && c.x + c.w >= 74 + 84);
  assert.ok(c.y <= 100 - 9 && c.y + c.h >= 100 + 1);
});

test('texto na vertical (de baixo para cima): a caixa fica em pé, sobre o número', () => {
  // começa em (300, 600) e sobe pela página; o "alto" das letras aponta para a esquerda
  const p = { str: 'CPF 831.975.872-60', x: 300, y: 600, w: 108, h: 10, eol: true, ang: -Math.PI / 2 };
  const [a] = procurar([p], ['cpf']);
  assert.equal(a.tipo, 'cpf');
  const [c] = a.caixas;
  // número da letra 4 à 17: de y = 600 - 24 = 576 subindo até 576 - 84 = 492; letras entre x = 290,5 e 300
  assert.ok(c.y <= 492 && c.y + c.h >= 576, `y de ${c.y} a ${c.y + c.h}`);
  assert.ok(c.x <= 290.5 && c.x + c.w >= 300, `x de ${c.x} a ${c.x + c.w}`);
  assert.ok(c.w < 20, 'caixa estreita, não deitada');
});

test('medida pela fonte: prefixo de letras estreitas não empurra a caixa', () => {
  // medida falsa: "i", "l" e ":" valem 1, o resto vale 3
  const medir = (t) => [...t].reduce((n, ch) => n + ('il:'.includes(ch) ? 1 : 3), 0);
  const str = 'il:il:il:831.975.872-60';
  const p = { str, x: 0, y: 100, w: medir(str), h: 10, eol: true };
  const [c] = procurar([p], ['cpf'], medir)[0].caixas;
  assert.ok(c.x <= 9 && c.x + c.w >= 9 + 14 * 3, `x de ${c.x} a ${c.x + c.w}`);
});

test('texto com letras espaçadas ("a n a @ ...") ainda é achado', () => {
  const str = [...'E-mail:ana.exemplo@escola.test'].join(' ');
  const [a] = procurar([linha(str)], ['email']);
  assert.equal(a?.tipo, 'email');
  const [c] = a.caixas;
  // "ana" começa na letra 7 do texto sem espaços, que é a letra 14 do pedaço (6 pt cada)
  assert.ok(c.x <= 50 + 14 * 6 && c.x + c.w >= 50 + str.length * 6, `x de ${c.x} a ${c.x + c.w}`);
  // palavra comum com espaço não é tratada como espaçada
  assert.deepEqual(procurar([linha('ligue a b c 3123-4567')], ['telefone']).length, 1);
});

// ---- lista de termos do usuário (nomes, endereços) ----
const termos = (lista, op = {}) => ({ lista, palavraInteira: true, semAcento: true, ...op });
const trechos = (pedacos, t) => {
  const { texto } = juntarTexto(pedacos);
  return procurar(pedacos, [], null, t).map((a) => texto.slice(a.ini, a.fim));
};

test('lista de termos: um por linha, sem repetidos nem vazios', () => {
  assert.deepEqual(prepararTermos('Fulano de Teste\n\n  fulano de teste \r\nRua das Flores; A\nCasa'),
    ['Fulano de Teste', 'Rua das Flores', 'Casa']);
});

test('termo acha nome no meio da frase, sem diferença de maiúscula e acento', () => {
  const p = [linha('Declaramos que FULANO DE TESTE e Joao Exemplo moram na Rua das Flores.')];
  assert.deepEqual(trechos(p, termos(['Fulano de Teste', 'João Exemplo', 'rua das flores'])),
    ['FULANO DE TESTE', 'Joao Exemplo', 'Rua das Flores']);
});

test('palavra inteira: "Ana" não pega "Banana", e pode ser desligado', () => {
  const p = [linha('Ana comeu banana com Anaí.')];
  assert.deepEqual(trechos(p, termos(['Ana'])), ['Ana']);
  assert.deepEqual(trechos(p, termos(['Ana'], { palavraInteira: false })), ['Ana', 'ana', 'Ana']);
});

test('com acento e maiúscula valendo, só o idêntico é achado', () => {
  const p = [linha('João e joão e Joao')];
  assert.deepEqual(trechos(p, termos(['João'], { semAcento: false })), ['João']);
});

test('nome quebrado em duas linhas vira um achado com duas caixas', () => {
  const p = [linha('assinado por Fulano de', 100), linha('Teste, servidor', 115)];
  const [a] = procurar(p, [], null, termos(['Fulano de Teste']));
  assert.equal(a.tipo, 'termo');
  assert.equal(a.caixas.length, 2);
});

test('termo com ponto e outros sinais é procurado ao pé da letra', () => {
  const p = [linha('Responsável: F. de Teste (diretor)')];
  assert.deepEqual(trechos(p, termos(['F. de Teste'])), ['F. de Teste']);
  assert.deepEqual(trechos(p, termos(['F.? de'])), []);
});

test('o termo mais longo ganha no mesmo lugar, e o termo não divide um CPF', () => {
  const p = [linha('Fulano de Teste, CPF 831.975.872-60')];
  assert.deepEqual(trechos(p, termos(['Fulano', 'Fulano de Teste'])), ['Fulano de Teste']);
  const { texto } = juntarTexto(p);
  const tipos = procurar(p, ['cpf'], null, termos(['Fulano de Teste'])).map((a) => [a.tipo, texto.slice(a.ini, a.fim)]);
  assert.deepEqual(tipos, [['termo', 'Fulano de Teste'], ['cpf', '831.975.872-60']]);
});

test('nome da lista no começo de um e-mail não impede o e-mail inteiro de ser sugerido', () => {
  const p = [linha('Contato: ana.exemplo@escola.test')];
  const { texto } = juntarTexto(p);
  const achados = procurar(p, ['email'], null, termos(['Ana'])).map((a) => [a.tipo, texto.slice(a.ini, a.fim)]);
  assert.deepEqual(achados, [['termo', 'ana'], ['email', 'ana.exemplo@escola.test']]);
});

test('OCR: "@" lido como Q ou © antes do domínio, e letras parecidas com algarismos dentro de números', () => {
  assert.equal(corrigirOcr('fulano.testeQexemplo.test'), 'fulano.teste@exemplo.test');
  assert.equal(corrigirOcr('anaQescola.test,'), 'ana@escola.test,');
  assert.equal(corrigirOcr('beltrano©exemplo.test'), 'beltrano@exemplo.test');
  assert.equal(corrigirOcr('831.975.87Z-6O'), '831.975.87Z-60');
  assert.equal(corrigirOcr('8l3.3ll.475-O8'), '813.311.475-08');
  // palavras comuns ficam como estão
  for (const p of ['Quintal', 'QUALQUER', 'Sala', 'Brasil', 'e-mail', 'ana@escola.test']) assert.equal(corrigirOcr(p), p);
  // o tamanho nunca muda (a caixa de cada letra continua no lugar)
  for (const p of ['fulano.testeQexemplo.test', '8l3.3ll.475-O8']) assert.equal(corrigirOcr(p).length, p.length);
});

// ---- PIS/NIS, título de eleitor, CNH e processo (números de exemplo, sem dono) ----
const achado = (s, tipos) => procurar([linha(s)], tipos).map((a) => [a.tipo, a.trecho]);

test('PIS/NIS: formato com pontos e traço, ou o número depois da sigla', () => {
  assert.deepEqual(achado('PIS 000.12345.67-8 do servidor', ['pis']), [['pis', '000.12345.67-8']]);
  assert.deepEqual(achado('NIS: 00012345678', ['pis']), [['pis', '00012345678']]);
  assert.deepEqual(achado('PIS/PASEP nº 000 12345 67 8', ['pis']), [['pis', '000 12345 67 8']]);
  assert.deepEqual(achado('PIS 0001234567', ['pis']), [], 'dez algarismos não é PIS');
});

test('título de eleitor: três grupos de quatro com código de estado, ou depois das palavras', () => {
  assert.deepEqual(achado('Título de eleitor 0000 1234 0701', ['titulo']), [['titulo', '0000 1234 0701']]);
  assert.deepEqual(achado('inscrição eleitoral nº 000012340701', ['titulo']), [['titulo', '000012340701']]);
  // código de estado 56 não existe: três grupos de quatro sem palavra antes não bastam
  assert.deepEqual(achado('Lote 0000 1234 5601', ['titulo']), []);
});

test('CNH: só depois da sigla ou do nome do documento, e ganha do CPF quando a palavra diz que é CNH', () => {
  assert.deepEqual(achado('CNH nº 00012345678', ['cnh']), [['cnh', '00012345678']]);
  assert.deepEqual(achado('Carteira Nacional de Habilitação 000123456', ['cnh']), [['cnh', '000123456']]);
  assert.deepEqual(achado('número 00012345678 sem palavra', ['cnh']), []);
  assert.deepEqual(achado('Habilitação técnica em 2026', ['cnh']), []);
});

test('processo (NUP): o formato com ponto, barra e traço basta', () => {
  assert.deepEqual(achado('Processo 00000.000123/2026-11 em andamento', ['processo']), [['processo', '00000.000123/2026-11']]);
  assert.deepEqual(achado('Processo 00000.000123/2026-11', ['cpf', 'cnpj', 'telefone']), [], 'só com o tipo ligado');
});

// ---- seleção de texto com o cursor ----
test('selecionar: do ponto a ao ponto b cobre só aquelas letras, uma caixa por linha', () => {
  // "Declaração de exemplo" com 6 pt por letra a partir de x = 50: "exemplo" vai de 50 + 14*6 = 134 a 176
  const p = [linha('Declaração de exemplo')];
  const [c] = selecionar(p, [135, 97], [175, 97]);
  assert.ok(c.x <= 134 && c.x + c.w >= 176, `cobre "exemplo": ${c.x} a ${c.x + c.w}`);
  assert.ok(c.x > 50 + 13 * 6 - 5, 'não cobre "Declaração de"');
  // de trás para a frente dá o mesmo
  assert.deepEqual(selecionar(p, [175, 97], [135, 97]), selecionar(p, [135, 97], [175, 97]));
});

test('selecionar em duas linhas: do meio da primeira ao meio da segunda', () => {
  const p = [linha('primeira linha toda', 100), linha('segunda linha toda', 120)];
  const caixasSel = selecionar(p, [50 + 9 * 6, 97], [50 + 7 * 6, 117]);
  assert.equal(caixasSel.length, 2, 'uma caixa por linha');
  const [c1, c2] = caixasSel.sort((a, b) => a.y - b.y);
  assert.ok(c1.x + c1.w >= 50 + 19 * 6, 'a primeira vai até o fim da linha');
  assert.ok(c2.x <= 50, 'a segunda começa no começo da linha');
});

test('selecionar sem texto (página digitalizada) devolve nada', () => {
  assert.deepEqual(selecionar([], [0, 0], [10, 10]), []);
});

test('caixa já coberta por tarja', () => {
  const caixa = { x: 10, y: 10, w: 50, h: 10 };
  assert.ok(coberta(caixa, [{ x: 5, y: 5, w: 60, h: 20 }]));
  assert.ok(!coberta(caixa, [{ x: 5, y: 5, w: 20, h: 20 }]));
  assert.ok(!coberta(caixa, []));
});
