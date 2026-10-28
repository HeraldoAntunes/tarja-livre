// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
//
// Primeira parte do worker do OCR, antes do núcleo e do worker do Tesseract (só na versão com OCR). O Tesseract
// pede os dados do idioma por fetch; aqui a resposta sai dos dados embutidos neste arquivo, e qualquer outro pedido
// é recusado: o OCR não usa a rede, nem por engano.
(() => {
  const DADOS_POR = '__DADOS_POR__';
  let bytes = null;
  const dados = () => {
    if (!bytes) {
      const s = atob(DADOS_POR);
      bytes = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    }
    return bytes;
  };
  self.fetch = (endereco) => (String(endereco).endsWith('/por.traineddata.gz')
    ? Promise.resolve(new Response(dados()))
    : Promise.reject(new TypeError('O Tarja Livre não usa a rede.')));
})();
