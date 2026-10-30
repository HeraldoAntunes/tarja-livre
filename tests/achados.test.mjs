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

// ---- e-mail em página lida pelo OCR (docs/PROPOSTA-OCR-EMAIL.md) ----
// Linha como o OCR entrega: uma palavra por pedaço, passada por corrigirOcr, com a marca "ocr" de lerComOcr.
function lidaPeloOcr(texto, ocr = true) {
  let x = 50;
  const p = texto.split(' ').map((str) => {
    const q = { str: corrigirOcr(str), x, y: 100, w: str.length * 6, h: 10, eol: false, ocr };
    x += str.length * 6 + 4;
    return q;
  });
  p[p.length - 1].eol = true;
  return p;
}
const emailsOcr = (texto, ocr = true) => procurar(lidaPeloOcr(texto, ocr), ['email']).map((a) => a.trecho);

test('OCR: e-mail com o "@" lido como "&", "(D", "ê", " Q"... vira sugestão do e-mail inteiro', () => {
  // leituras de verdade do OCR do programa, tiradas do estudo (ramo estudo-ocr-email): [linha lida, e-mail lido]
  const lidas = [
    ['Envie para fulana.de.tal&exemplo.test até sexta.', 'fulana.de.tal&exemplo.test'],
    ['maria.teste3G&exemplo.test', 'maria.teste3G&exemplo.test'],
    ['Contato: coord-ti&Qexemplo.test', 'coord-ti&Qexemplo.test'],
    ['Contato: fulana.de.talQ&exemplo.test', 'fulana.de.talQ&exemplo.test'],
    ['Responsável: Fulano de Teste, maria.teste3(&exemplo.test', 'maria.teste3(&exemplo.test'],
    ['Responsável: Fulano de Teste, secretaria(Dexemplo.test', 'secretaria(Dexemplo.test'],
    ['Dúvidas: turma-2b(Oexemplo.test; telefone (00) 91234-5678', 'turma-2b(Oexemplo.test'],
    ['Dúvidas: fulano.teste(Qmail2.exemplo.test; telefone (00) 91234-5678', 'fulano.teste(Qmail2.exemplo.test'],
    ['Envie para beltrana-souza(omail2.exemplo.test até sexta.', 'beltrana-souza(omail2.exemplo.test'],
    ['Responsável: Fulano de Teste, ciclano(dexemplo.test', 'ciclano(dexemplo.test'],
    ['teste2026(Pexemplo.test', 'teste2026(Pexemplo.test'],
    ['Correio eletrônico turma-2b(Eexemplo.test (institucional)', 'turma-2b(Eexemplo.test'],
    ['Envie para fulana.de.tal(&Dexemplo.test até sexta.', 'fulana.de.tal(&Dexemplo.test'],
    ['Responsável: Fulano de Teste, ciclano&&exemplo.test', 'ciclano&&exemplo.test'],
    ['e-mail coord-tiêmail2.exemplo.test', 'coord-tiêmail2.exemplo.test'],
    // com um espaço de um lado da sequência: o e-mail vem em duas palavras
    ['Correio eletrônico turma-2b &mail2.exemplo.test (institucional)', 'turma-2b &mail2.exemplo.test'],
    ['e-mail beltranaQ& mail2.exemplo.test', 'beltranaQ& mail2.exemplo.test'],
    ['Envie para secretaria (Omail2.exemplo.test até sexta.', 'secretaria (Omail2.exemplo.test'],
    // a página de tests/e2e_ocr.mjs no Linux ("Arial" vira Liberation Sans)
    ['E-mail: fulano.teste Qexemplo.test', 'fulano.teste Qexemplo.test'],
  ];
  for (const [texto, email] of lidas) assert.deepEqual(emailsOcr(texto), [email], texto);
  // o OCR separa "fulano.teste" e "Qexemplo.test", mas tão perto que juntarTexto cola de novo as duas palavras
  const p = [{ str: 'E-mail:', x: 50, y: 100, w: 40, h: 10, eol: false, ocr: true },
    { str: 'fulano.teste', x: 94, y: 100, w: 72, h: 10, eol: false, ocr: true },
    { str: 'Qexemplo.test', x: 167, y: 100, w: 78, h: 10, eol: true, ocr: true }];
  assert.deepEqual(procurar(p, ['email']).map((a) => a.trecho), ['fulano.testeQexemplo.test']);
});

test('OCR: o e-mail em duas palavras ganha uma caixa só, cobrindo as duas', () => {
  const p = lidaPeloOcr('E-mail: fulano.teste Qexemplo.test');
  const [a] = procurar(p, ['email']);
  assert.equal(a.caixas.length, 1);
  assert.ok(a.caixas[0].x <= p[1].x && a.caixas[0].x + a.caixas[0].w >= p[2].x + p[2].w, 'cobre as duas palavras');
});

test('OCR: textos comuns de documento não viram e-mail', () => {
  const comuns = [
    'CPF: 831.975.872-60', 'Data: 30/10/2026', 'Nome: Fulano de Teste', 'Endereço: QD 05 Lote 12, Setor Teste',
    'QD05 LT12 Setor Teste', 'SQS 308 Bloco WO, apto. 101', 'WO 1234 Ordem de serviço', 'Fiz o QD da turma e o WO do setor',
    'Q&A do edital 3/2026', 'P&D e inovação no campus', 'Silva & Souza Ltda.', 'Barros&Lima Advogados',
    'AT&T e Q&A são siglas', 'M&M.com.br', 'Q&A.exemplo.test', 'Pesquisa & Extensão: exemplo.edu.br',
    'Veja G&Q em exemplo.test', 'Veja G&Q-emexemplo.test', 'Acesse www.exemplo.gov.br', 'Portal Gov.br',
    'Portal (exemplo.gov.br)', 'Portal(exemplo.gov.br)', 'Ata(Original.pdf', 'Fulano(Diretor)de Teste',
    'Anexo Edital&Anexo.pdf', 'Planilha G&Q.xlsx', 'https://exemplo.gov.br/sei/consulta&id=5',
    'https://www.exemplo.edu.br/edital?ano=2026&fase=2', 'C:\\Documentos\\Q&A\\edital.pdf', '/home/teste/P&D/relatorio.odt',
    'Acesse Qualidade.gov.br', 'Consulte o QEdu.org.br', 'Campus Q exemplo.edu.br', 'Bloco Q, sala 12.3',
    'Você também pode ver exemplo.gov.br', 'Arquivo relatorio.final.pdf', 'Lei nº 13.709/2018 (LGPD)',
  ];
  for (const t of comuns) assert.deepEqual(emailsOcr(t), [], t);
});

test('OCR: nome de arquivo com Q não vira e-mail ("ARQUITETURA.md" não ganha um "@" no lugar do Q)', () => {
  assert.equal(corrigirOcr('ARQUITETURA.md'), 'ARQUITETURA.md');
  assert.equal(corrigirOcr('RelatorioQAnexo.pdf'), 'RelatorioQAnexo.pdf');
  assert.deepEqual(emailsOcr('[docs/ARQUITETURA.md](docs/ARQUITETURA.md);'), []);
  // o "Q" antes de um domínio de verdade continua virando "@"
  assert.equal(corrigirOcr('fulano.testeQexemplo.test'), 'fulano.teste@exemplo.test');
});

test('as leituras do "@" pelo OCR só valem em página lida pelo OCR', () => {
  assert.deepEqual(emailsOcr('fulano.teste&exemplo.test', false), []);
  assert.deepEqual(emailsOcr('fulano.teste(Dexemplo.test', false), []);
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

// auditoria de 29/10/2026: 90,5% coberto deixava "st" de um e-mail visível e a sugestão sumia
test('caixa só conta como coberta se ficar inteira embaixo das tarjas', () => {
  const caixa = { x: 10, y: 10, w: 50, h: 10 };
  assert.ok(!coberta(caixa, [{ x: 10, y: 10, w: 45.25, h: 10 }]), '90,5% da largura não é coberta');
  assert.ok(!coberta(caixa, [{ x: 10, y: 10.5, w: 50, h: 9.5 }]), 'uma faixa de cima de fora não é coberta');
  assert.ok(coberta(caixa, [{ x: 0, y: 0, w: 35, h: 30 }, { x: 34, y: 0, w: 40, h: 30 }]), 'duas tarjas que juntas cobrem');
  assert.ok(!coberta(caixa, [{ x: 0, y: 0, w: 35, h: 30 }, { x: 36, y: 0, w: 40, h: 30 }]), 'fresta entre duas tarjas');
  assert.ok(!coberta(caixa, [{ x: 0, y: 0, w: 80, h: 14 }, { x: 0, y: 16, w: 80, h: 14 }]), 'fresta na altura');
});
