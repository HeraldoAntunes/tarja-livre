// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Estudo do OCR do @ (docs/ESTUDO-OCR-EMAIL.md): a regra proposta, só para simular. Não é usada pelo programa.
//
// O português do Tesseract embutido não tem o @ entre os caracteres que sabe escrever: no lugar dele sai sempre
// outra coisa ("&", "(D", "G&"...). A regra procura, no texto juntado da linha (o de juntarTexto, onde as palavras
// estão separadas por um espaço), uma parte com cara de usuário, uma das sequências da lista e uma parte com cara de
// domínio, e sugere o trecho todo como e-mail. Quando aceitar:
//  1. a sequência é uma da lista, com maiúsculas e minúsculas como estão;
//  2. pode haver um espaço antes ou depois da sequência, nunca dos dois lados;
//  3. a parte antes tem 2 letras ou mais, termina em letra ou algarismo e não vem logo depois de /, \, =, ? ou #
//     (pedaço de caminho ou de endereço de site);
//  4. o domínio tem ponto, o primeiro pedaço dele tem 2 letras ou mais e o último é só de letras (2 ou mais);
//  5. o último pedaço do domínio não é extensão de arquivo (pdf, docx, jpg...);
//  6. se a sequência tem "(", não há ")" no resto da palavra (parêntese que fecha é texto comum, não e-mail);
//  7. sequência que começa com espaço (" Q", opcional) só vale com o domínio começando em minúscula ou algarismo.

const EXTENSOES = new Set(['pdf', 'doc', 'docx', 'odt', 'ods', 'odp', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg',
  'png', 'gif', 'bmp', 'tif', 'tiff', 'txt', 'md', 'rtf', 'csv', 'xml', 'json', 'zip', 'rar', 'html', 'htm', 'mp3', 'mp4']);

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Segunda camada, opcional: uma ou duas letras maiúsculas coladas entre a parte antes, toda em minúsculas ou
// algarismos, e o domínio, também em minúsculas ("fulanoGexemplo.gov.br"). Endereço de site com maiúscula no meio
// ("portalEducacao.gov.br") vira falso positivo; por isso fica separada, para a equipe decidir.
const MAIUSCULAS = /(?<![A-Za-z0-9._%+\-\/\\=?#])((?!www\.)[a-z0-9][a-z0-9._%+\-]*[a-z0-9])([A-Z][A-Z0kp]?)([a-z0-9][a-z0-9\-]+(?:\.[a-z0-9\-]+)*\.([a-z]{2,}))(?![A-Za-z0-9\-]|\.[A-Za-z0-9]|\/)/g;
const LETRAS_ACEITAS = /^(?:[GOEQDBP]|E[kpP]|G[0OQ]|Q[DO])$/;

export function criarRegra(sequencias, descricao, { maiusculas = false } = {}) {
  // a mais longa primeiro: em "teste&Qexemplo" vale "&Q", não "&" seguido de um domínio "Qexemplo"
  const lista = [...sequencias].sort((a, b) => b.length - a.length);
  const re = lista.length ? new RegExp(
    String.raw`(?<![A-Za-z0-9._%+\-\/\\=?#])([A-Za-z0-9._%+\-]*[A-Za-z0-9])( ?)(${lista.map(escapar).join('|')})( ?)` +
    String.raw`([A-Za-z0-9][A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.([A-Za-z]{2,}))(?![A-Za-z0-9\-]|\.[A-Za-z0-9])`, 'g') : null;
  return {
    descricao,
    sequencias,
    emails(texto) {
      const achados = [];
      for (const m of re ? texto.matchAll(re) : []) {
        const [tudo, usuario, esp1, seq, esp2, dominio, final] = m;
        if ((esp1 || seq.startsWith(' ')) && esp2) continue;               // 2
        if (seq.startsWith(' ') && !/^[a-z0-9]/.test(dominio)) continue;    // 7
        if (usuario.length < 2) continue;                                   // 3
        if (EXTENSOES.has(final.toLowerCase())) continue;                   // 5
        if (seq.includes('(')) {                                            // 6
          const resto = texto.slice(m.index + tudo.length).split(/\s/)[0];
          if (dominio.includes(')') || resto.includes(')')) continue;
        }
        achados.push(tudo);
      }
      if (maiusculas) {
        for (const m of texto.matchAll(MAIUSCULAS)) {
          const [tudo, usuario, seq, , final] = m;
          if (usuario.length < 2 || !LETRAS_ACEITAS.test(seq) || EXTENSOES.has(final)) continue;
          if (!achados.some((a) => a.includes(tudo))) achados.push(tudo);
        }
      }
      return achados;
    },
  };
}

// A proposta: a lista curta. O "&" sozinho já cobre as leituras em que ele vem colado a uma letra ("G&", "&Q",
// "t&", "&M"...), porque a letra fica na parte antes ou no domínio e o trecho sugerido é o mesmo. O "(" só vale
// seguido de uma das letras que o OCR tira do desenho do @ (ou de "&"), nunca sozinho: "Portal(exemplo.gov.br)".
// As letras sozinhas ("G", "g", "O", "E"...) ficam de fora: "fulanogexemplo.com.br" não se distingue de um
// endereço de site. O "ê" (das fontes mono) entra porque não existe em endereço de site nem em usuário de e-mail.
// O "Q" colado já é trocado por corrigirOcr() hoje.
export const SEQUENCIAS = ['&', '&&', '(D', '(Q', '(O', '(o', '(d', '(P', '(E', '(&', 'ê'];

// Opcional: "Q" depois de um espaço e colado no domínio ("fulano.teste Qexemplo.test"), a leitura do e2e_ocr no Linux.
export const SEQUENCIA_ESPACO_Q = ' Q';

export const REGRA = criarRegra(SEQUENCIAS, 'a proposta (tests/estudo-ocr/regra.mjs)');
export const emailsPelaRegra = (texto) => REGRA.emails(texto);
