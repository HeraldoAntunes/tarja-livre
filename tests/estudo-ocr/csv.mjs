// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
// Estudo do OCR do @: ler e gravar os CSV do estudo (com aspas, porque os textos têm vírgula).
import { readFileSync, writeFileSync } from 'node:fs';

export function lerCsv(arq) {
  const s = readFileSync(arq, 'utf8');
  const linhas = [];
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (aspas) {
      if (c === '"' && s[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const [cab, ...resto] = linhas;
  return resto.map((l) => Object.fromEntries(cab.map((k, i) => [k, l[i]])));
}

export const aspas = (v) => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));

export function gravarCsv(arq, linhas) {
  const cab = Object.keys(linhas[0]);
  writeFileSync(arq, [cab.join(','), ...linhas.map((l) => cab.map((k) => aspas(l[k])).join(','))].join('\n') + '\n');
}
