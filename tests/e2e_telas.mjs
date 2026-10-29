// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Tela pequena e projetor (computador de escola): em 1366×768, 1280×720 e 1024×768, com um PDF aberto, a página não
// pode transbordar para os lados e cada botão do caminho principal (abrir, procurar, aceitar, revisar, salvar, ajuda)
// tem de dar para alcançar: rolado para a vista, fica inteiro dentro da janela e não coberto por outra coisa.
// Uso: node tests/e2e_telas.mjs [pasta]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RAIZ, montar, abrirNavegador } from './navegador.mjs';

const CAPTURAS = process.argv[2] || join(RAIZ, 'files', 'e2e-telas');
const PDF = readFileSync(join(RAIZ, 'tests', 'fixtures', 'tarja-teste.pdf'));
const TELAS = [[1366, 768], [1280, 720], [1024, 768]];
const BOTOES = ['btAbrir', 'btSobre', 'btProcurar', 'btAceitarTodas', 'revisei', 'btSalvar', 'btProxima', 'btAnterior'];

montar();
for (const [largura, altura] of TELAS) {
  const n = await abrirNavegador(CAPTURAS, { largura, altura });
  await n.abrirPrograma();
  await n.cdp('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: false });
  await n.enviarArquivo(PDF, 'teste.pdf');
  await n.ate(`document.getElementById('tela').dataset.pagina === '1'`, 'abrir o PDF de teste', 30000);
  const r = await n.js(`(() => {
    const vazaLado = document.documentElement.scrollWidth > innerWidth + 1;
    const ruins = [];
    for (const id of ${JSON.stringify(BOTOES)}) {
      const b = document.getElementById(id);
      b.scrollIntoView({ block: 'center', inline: 'nearest' });
      const q = b.getBoundingClientRect();
      const dentro = q.width > 0 && q.left >= 0 && q.top >= 0 && q.right <= innerWidth && q.bottom <= innerHeight;
      const no = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      const livre = !!no && (no === b || b.contains(no) || no.contains(b) || (b.labels && [...b.labels].some((l) => l.contains(no))));
      if (!dentro || !livre) ruins.push(id + (dentro ? ' coberto por ' + (no?.id || no?.className || no?.tagName) : ' fora da janela'));
    }
    return { vazaLado, ruins, janela: [innerWidth, innerHeight] };
  })()`);
  await n.js(`document.getElementById('tela').scrollIntoView({ block: 'start' })`);
  await n.captura(`tela-${largura}x${altura}.png`);
  assert.deepEqual(r.janela, [largura, altura], 'tamanho da janela');
  assert.equal(r.vazaLado, false, `${largura}×${altura}: a página transborda para os lados`);
  assert.deepEqual(r.ruins, [], `${largura}×${altura}: botões que não dá para alcançar`);
  assert.deepEqual(n.erros, [], 'console limpo');
  await n.fechar();
}
console.log(`telas: tudo certo (${TELAS.map((t) => t.join('×')).join(', ')}: sem transbordar, botões alcançáveis)`);
