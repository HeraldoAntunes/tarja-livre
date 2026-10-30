# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
"""Conferência por pixel com OUTRO leitor de PDF (PyMuPDF), e não o PDF.js que o programa usa (ideia e método da
auditoria externa de 29/10/2026, check-pixels.py). Regressão de privacidade: "0 caracteres de texto" não prova que
o dado está coberto na imagem.

  mascara <salvo.pdf> <mascara.pdf>         pixel escuro na máscara (o dado) tem de estar escuro no salvo
  regiao <salvo.pdf> <original.pdf> x0 y0 x1 y1   o mesmo, só dentro do retângulo (em pontos, do canto de cima)
  preto <salvo.pdf> [tolerancia]            página inteira tarjada: o interior é preto (JPEG: até a tolerância)

As anotações não entram no desenho (o PyMuPDF desenha o ícone de comentário, que o PDF.js não desenha e que a página
salva não tem). Sai com 1 e lista as páginas se algo ficou à vista. Precisa do PyMuPDF e do numpy."""

import json
import sys

import fitz
import numpy as np

ESCALA = 2


def imagem(pagina):
    p = pagina.get_pixmap(matrix=fitz.Matrix(ESCALA, ESCALA), alpha=False, annots=False)
    return np.frombuffer(p.samples, np.uint8).reshape(p.height, p.width, 3).astype(int)


def descobertos(dado, salvo, recorte=None):
    h, w = min(dado.shape[0], salvo.shape[0]), min(dado.shape[1], salvo.shape[1])
    ruim = (dado[:h, :w].sum(2) < 300) & (salvo[:h, :w].sum(2) > 150)
    if recorte:
        x0, y0, x1, y1 = (int(v * ESCALA) for v in recorte)
        dentro = np.zeros_like(ruim)
        dentro[y0:y1, x0:x1] = True
        ruim &= dentro
    return ruim


def main(args):
    modo, salvo = args[0], fitz.open(args[1])
    linhas, falhou = [], False
    if modo in ("mascara", "regiao"):
        dado = fitz.open(args[2])
        recorte = [float(v) for v in args[3:7]] if modo == "regiao" else None
        for i in range(len(dado)):
            a = imagem(dado[i])
            ruim = descobertos(a, imagem(salvo[i]), recorte)
            escuros = int((a.sum(2) < 300).sum()) if not recorte else None
            n = int(ruim.sum())
            primeiro = np.argwhere(ruim)[0].tolist() if n else None
            linhas.append({"pagina": i + 1, "pixelsDoDado": escuros, "aVista": n, "primeiroYX": primeiro})
            falhou |= n > 0
    elif modo == "preto":
        tol = int(args[2]) if len(args) > 2 else 0
        for i in range(len(salvo)):
            a = imagem(salvo[i])[2:-2, 2:-2]     # 2 px de borda: arredondamento no limite da página
            maior = int(a.max())
            linhas.append({"pagina": i + 1, "maiorCanal": maior, "tolerancia": tol})
            falhou |= maior > tol
    else:
        raise SystemExit(__doc__)
    print(json.dumps(linhas))
    sys.exit(1 if falhou else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
