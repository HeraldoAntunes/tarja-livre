// Tarja Livre: regressões do e-mail lido pelo OCR
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { procurar, corrigirOcr, escaparRegex } from '../src/achados.js';

test('escaparRegex: todo caractere especial vira literal, a barra invertida inclusive (alerta 16 do CodeQL)', () => {
  const especiais = '\\.*+?^$' + '{}()|[]&ê';
  const re = new RegExp('^' + escaparRegex(especiais) + '$');
  assert.ok(re.test(especiais));
  assert.ok(!re.test(especiais.slice(1)));
  for (const c of especiais) assert.ok(new RegExp(`^${escaparRegex(c)}$`).test(c), `"${c}" não ficou literal`);
});

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


test('lerComOcr marca os pedaços para a procura distinguir OCR de texto digital', async () => {
  const fonte = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const inicio = fonte.indexOf('async function lerComOcr(pg, p) {');
  // até o fim de reconhecer, que lê as palavras do desenho (lerComOcr chama ela)
  const fim = fonte.indexOf('\n}\n', fonte.indexOf('async function reconhecer(c, s) {')) + 2;
  assert.ok(inicio >= 0 && fim > inicio);
  const ler = vm.runInNewContext(fonte.slice(inicio, fim) + '\nlerComOcr', {
    DPI_OCR: 72, escalaSegura: () => 1, OPCOES_DESENHO: {}, corrigirOcr,
    document: { createElement: () => ({ getContext: () => ({ fillRect() {} }) }) },
    obterOcr: async () => ({ recognize: async () => ({ data: { blocks: [{ paragraphs: [{ lines: [{
      words: [{ text: 'contato&exemplo.test', bbox: { x0: 10, y0: 20, x1: 150, y1: 32 } }],
    }] }] }] } }) }),
  });
  const pedacos = await ler({ render: () => ({ promise: Promise.resolve() }), getViewport: () => ({}) }, { w: 600, h: 800 });
  assert.equal(pedacos.length, 1);
  assert.equal(pedacos[0].ocr, true);
  assert.deepEqual(procurar(Array.from(pedacos), ['email']).map(a => a.trecho), ['contato&exemplo.test']);
});
