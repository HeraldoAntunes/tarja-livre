"""PDFs da 6a revisao independente da gestao, na rc.9 (reticulado regular; limiar 250). So dados inventados.
Uso: python gerar_rc9.py <pasta>"""
import json
import sys
from pathlib import Path

import pymupdf

RAIZ = Path(sys.argv[1])
PRETO = (0.08,) * 3
CPF = "178.031.380-07"   # ficticio, so com digitos que fecham reticulado (0, 1, 3, 7, 8)
DADO = "SIGILOCODIGO"
# digitos cujos segmentos atravessam o glifo inteiro: a, g, d na largura; b+c e e+f na altura
SEG = {"0": "abcdef", "1": "bc", "3": "abgcd", "7": "abc", "8": "abcdefg", "-": "g"}


def salvar(nome, montar, termos, nota):
    q = RAIZ / nome
    q.mkdir(parents=True, exist_ok=True)
    for arq, o in (("original.pdf", True), ("sem-dados.pdf", False)):
        d = pymupdf.open()
        montar(d, o)
        d.save(q / arq)
    (q / "caso.json").write_text(json.dumps({"termos": list(termos), "nota": nota}, ensure_ascii=False))


def grade(p, txt, x0, y0, w=60, h=52, passo=80, esp=1.0):
    x = x0
    for ch in txt:
        if ch == ".":
            x += 25
            continue
        a, m, b = y0, y0 + h, y0 + 2 * h
        segs = {"a": ((x, a), (x + w, a)), "g": ((x, m), (x + w, m)), "d": ((x, b), (x + w, b)),
                "f": ((x, a), (x, m)), "e": ((x, m), (x, b)), "b": ((x + w, a), (x + w, m)), "c": ((x + w, m), (x + w, b))}
        ss = set(SEG[ch])
        if {"b", "c"} <= ss:
            ss -= {"b", "c"}
            p.draw_line((x + w, a), (x + w, b), color=PRETO, width=esp)
        if {"e", "f"} <= ss:
            ss -= {"e", "f"}
            p.draw_line((x, a), (x, b), color=PRETO, width=esp)
        for s in sorted(ss):
            p.draw_line(*segs[s], color=PRETO, width=esp)
        x += passo


def isca(p, txt, x, y):
    p.insert_text((x, y), txt, fontname="cour", fontsize=2, color=(0, 0, 0))


# v1: CPF em digitos grandes (104 pt de altura) feitos so de linhas que atravessam o glifo: cada digito e um
# reticulado regular de mais de 100 pt; isca de 2 pt
def v1(d, o):
    p = d.new_page(width=1100, height=220)
    if o:
        grade(p, CPF, 30, 30)
        isca(p, CPF, 30, 150)
    p.insert_text((30, 200), "CONTROLE PUBLICO", fontname="cour", fontsize=12, color=(0, 0, 0))
salvar("v1-reticulado-cpf", v1, (CPF,), "CPF ficticio em digitos de reticulado regular (104 pt), traco 1 pt; isca 2 pt")


def curvas(txt, x, y, tam, cor, W, H):
    q = pymupdf.open().new_page(width=W, height=H)
    q.insert_text((x, y), txt, fontname="helv", fontsize=tam, color=cor)
    s = pymupdf.open(stream=q.get_svg_image(text_as_path=True).encode(), filetype="svg")
    return pymupdf.open("pdf", s.convert_to_pdf())


# v2: dado em curvas vetoriais em cinza 0,98 e 0,99 e em amarelo-palido (255,255,215); isca de 2 pt
for nome, cor in (("v2-cinza-0.98", (0.98,) * 3), ("v2-cinza-0.99", (0.99,) * 3), ("v2-amarelo-palido", (1, 1, 215 / 255))):
    def v2(d, o, cor=cor):
        p = d.new_page(width=330, height=185)
        if o:
            p.show_pdf_page(p.rect, curvas(DADO, 60, 72, 26, cor, 330, 185), 0)
            isca(p, DADO, 60, 77)
        p.insert_text((40, 170), "CONTROLE PUBLICO", fontname="cour", fontsize=12, color=(0, 0, 0))
    salvar(nome, v2, (DADO,), f"dado em curvas na cor {cor}; isca 2 pt")
