"""PDFs para tentar quebrar a rc.6 (temDesenho). So dados inventados. Uso: python gerar_rc6.py <pasta>"""
import json
import sys
from pathlib import Path

import pymupdf

RAIZ = Path(sys.argv[1])
DADO = "SIGILOCODIGO"
# fonte de blocos 3x5 (cada celula vira um quadrado; toda borda corre reta por uma celula inteira)
F = {
    "S": ["###", "#..", "###", "..#", "###"], "I": ["###", ".#.", ".#.", ".#.", "###"],
    "G": ["###", "#..", "#.#", "#.#", "###"], "L": ["#..", "#..", "#..", "#..", "###"],
    "O": ["###", "#.#", "#.#", "#.#", "###"], "C": ["###", "#..", "#..", "#..", "###"],
    "D": ["##.", "#.#", "#.#", "#.#", "##."],
    "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["###", "..#", "###", "#..", "###"],
    "3": ["###", "..#", "###", "..#", "###"], "4": ["#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "###", "..#", "###"], "6": ["###", "#..", "###", "#.#", "###"],
    "7": ["###", "..#", "..#", "..#", "..#"], "8": ["###", "#.#", "###", "#.#", "###"],
    "9": ["###", "#.#", "###", "..#", "###"], "0": ["###", "#.#", "#.#", "#.#", "###"],
    ".": ["...", "...", "...", "...", ".#."], "-": ["...", "...", "###", "...", "..."],
}


def blocos(p, txt, x0, y0, c, cor=(0.08,) * 3):
    """desenha txt em blocos vetoriais (retangulos), celula c pt; junta as celulas de cada linha"""
    x = x0
    for ch in txt:
        g = F[ch]
        for r, linha in enumerate(g):
            j = 0
            while j < 3:
                if linha[j] == "#":
                    k = j
                    while k < 3 and linha[k] == "#":
                        k += 1
                    p.draw_rect(pymupdf.Rect(x + j * c, y0 + r * c, x + k * c, y0 + (r + 1) * c), color=None, fill=cor, overlay=True)
                    j = k
                else:
                    j += 1
        x += 4 * c


def pix(W, H, desenhar, dpi=300):
    d = pymupdf.open()
    p = d.new_page(width=W, height=H)
    desenhar(p)
    return p.get_pixmap(dpi=dpi)


def salvar(nome, montar, termos=(DADO,), nota=""):
    q = RAIZ / nome
    q.mkdir(parents=True, exist_ok=True)
    for arq, orig in (("original.pdf", True), ("sem-dados.pdf", False)):
        d = pymupdf.open()
        montar(d, orig)
        d.save(q / arq)
    (q / "caso.json").write_text(json.dumps({"termos": list(termos), "nota": nota}, ensure_ascii=False))


def publico(p, y=170):
    p.insert_text((40, y), "CONTROLE PUBLICO", fontname="cour", fontsize=12, color=(0, 0, 0))


# r1: dado em blocos vetoriais (celula 5 pt) + isca visivel de 2 pt logo abaixo
def r1(d, o):
    p = d.new_page(width=330, height=185)
    if o:
        blocos(p, DADO, 40, 40, 5)
        p.insert_text((40, 72), DADO, fontname="cour", fontsize=2, color=(0, 0, 0))
    publico(p)
salvar("r1-blocos-vetor-isca", r1, nota="dado em blocos vetoriais de 5 pt; camada preta 2 pt")


# r2: ocorrencia certa em texto visivel embaixo; o mesmo dado so numa IMAGEM em blocos no alto (sem camada)
def r2(d, o):
    p = d.new_page(width=330, height=260)
    if o:
        pm = pix(260, 40, lambda q: blocos(q, DADO, 6, 6, 5))
        p.insert_image(pymupdf.Rect(30, 10, 290, 50), pixmap=pm)
        p.insert_text((40, 200), DADO, fontname="cour", fontsize=18, color=(0, 0, 0))
    publico(p, 240)
salvar("r2-blocos-imagem-selo", r2, nota="texto visivel certo; mesmo dado so numa imagem em blocos")


# r3: dado em cinza claro numa imagem (Courier 18), isca preta de 2 pt; cinzas 0,80 e 0,84
for cinza in (0.80, 0.84):
    def r3(d, o, cinza=cinza):
        p = d.new_page(width=330, height=185)
        if o:
            pm = pix(330, 185, lambda q: q.insert_text((60, 72), DADO, fontname="cour", fontsize=18, color=(cinza,) * 3))
            p.insert_image(p.rect, pixmap=pm)
            p.insert_text((60, 77), DADO, fontname="cour", fontsize=2, color=(0, 0, 0))
        publico(p)
    salvar(f"r3-imagem-cinza-{cinza:.2f}", r3, nota=f"dado na imagem em cinza {cinza}; camada preta 2 pt")


# r3v: dado em cinza 0,84 em curvas vetoriais, isca de 2 pt
def r3v(d, o):
    p = d.new_page(width=330, height=185)
    if o:
        q = pymupdf.open().new_page(width=330, height=185)
        q.insert_text((60, 72), DADO, fontname="cour", fontsize=18, color=(0.84,) * 3)
        svg = pymupdf.open(stream=q.get_svg_image(text_as_path=True).encode(), filetype="svg")
        p.show_pdf_page(p.rect, pymupdf.open("pdf", svg.convert_to_pdf()), 0)
        p.insert_text((60, 77), DADO, fontname="cour", fontsize=2, color=(0, 0, 0))
    publico(p)
salvar("r3v-curvas-cinza-0.84", r3v, nota="dado em curvas cinza 0,84; camada preta 2 pt")


# r4: dado so na imagem da pagina 2 (que tem camada normal com outro texto); pagina 1 com o dado em texto
def r4(d, o):
    p = d.new_page(width=330, height=185)
    if o:
        p.insert_text((40, 60), DADO, fontname="cour", fontsize=18, color=(0, 0, 0))
    publico(p)
    p2 = d.new_page(width=330, height=185)
    if o:
        pm = pix(330, 185, lambda q: q.insert_text((60, 72), DADO, fontname="cour", fontsize=18, color=(0.08,) * 3))
        p2.insert_image(p2.rect, pixmap=pm)
    publico(p2)
salvar("r4-outra-pagina", r4, nota="p1: dado em texto; p2: dado so na imagem, camada com outro texto")
