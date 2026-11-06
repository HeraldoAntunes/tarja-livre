"""PDFs para tentar quebrar a rc.8 (traco fino so solto ou em grade de 100 pt; imagem sempre conta).
So dados inventados. Uso: python gerar_rc8.py <pasta>"""
import ast
import json
import sys
from pathlib import Path

import pymupdf

_f = (Path(__file__).parent / "gerar_revisao_rc7.py").read_text(encoding="utf8")
SEG = next(ast.literal_eval(n.value) for n in ast.parse(_f).body if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "SEG")
RAIZ = Path(sys.argv[1])
DADO = "SIGILOCODIGO"
CPF = "123.456.789-00"
PRETO = (0.08,) * 3


def salvar(nome, montar, termos=(DADO,), nota=""):
    q = RAIZ / nome
    q.mkdir(parents=True, exist_ok=True)
    for arq, o in (("original.pdf", True), ("sem-dados.pdf", False)):
        d = pymupdf.open()
        montar(d, o)
        d.save(q / arq)
    (q / "caso.json").write_text(json.dumps({"termos": list(termos), "nota": nota}, ensure_ascii=False))


def sete(p, txt, x0, y0, w, h, passo, esp=1.0, cor=PRETO):
    """sete segmentos de traco fino; segmentos de w (horizontal) e h (vertical) pt"""
    x = x0
    for ch in txt:
        if ch == ".":
            x += passo / 3
            continue
        a, m, b = y0, y0 + h, y0 + 2 * h
        segs = {"a": ((x, a), (x + w, a)), "g": ((x, m), (x + w, m)), "d": ((x, b), (x + w, b)),
                "f": ((x, a), (x, m)), "e": ((x, m), (x, b)), "b": ((x + w, a), (x + w, m)), "c": ((x + w, m), (x + w, b))}
        for s in SEG[ch]:
            p.draw_line(*segs[s], color=cor, width=esp)
        x += passo


def isca(p, txt, x, y):
    p.insert_text((x, y), txt, fontname="cour", fontsize=2, color=(0, 0, 0))


# u1: CPF em sete segmentos finos GRANDES (34 x 34 pt por segmento) dentro de uma tabela: moldura e linha da tabela
# ligadas aos digitos (todos tocam a linha de base), uma peca so de retas longas com mais de 100 pt; isca de 2 pt
def u1(d, o):
    p = d.new_page(width=842, height=260)
    x0, y0, x1, base = 30, 30, 812, 30 + 2 * 34 + 20
    p.draw_rect(pymupdf.Rect(x0, y0 - 15, x1, base + 60), color=(0, 0, 0), width=1.0)   # moldura
    p.draw_line((x0, base), (x1, base), color=(0, 0, 0), width=1.0)                        # linha da tabela
    if o:
        sete(p, CPF, 50, base - 2 * 34, 34, 34, 58)
        isca(p, CPF, 50, base + 10)
    p.insert_text((50, base + 40), "CONTROLE PUBLICO", fontname="cour", fontsize=12, color=(0, 0, 0))
salvar("u1-tabela-sete-grande-cpf", u1, termos=(CPF,), nota="CPF em sete segmentos de 1 pt e 34 pt, ligados a moldura e a linha da tabela; isca 2 pt")


# u1b: idem com a palavra (letras de sete segmentos sobre a linha da tabela)
def u1b(d, o):
    p = d.new_page(width=842, height=260)
    x0, y0, x1, base = 20, 30, 822, 30 + 2 * 30 + 20
    p.draw_rect(pymupdf.Rect(x0, y0 - 15, x1, base + 60), color=(0, 0, 0), width=1.0)
    p.draw_line((x0, base), (x1, base), color=(0, 0, 0), width=1.0)
    if o:
        sete(p, DADO, 35, base - 2 * 32, 32, 32, 64)
        isca(p, DADO, 35, base + 10)
    p.insert_text((35, base + 40), "CONTROLE PUBLICO", fontname="cour", fontsize=12, color=(0, 0, 0))
salvar("u1b-tabela-sete-grande-palavra", u1b, nota="SIGILOCODIGO em sete segmentos de 1 pt e 32 pt sobre a linha da tabela; isca 2 pt")


# u1c: CPF em sete segmentos grandes SEM moldura e sem linha (pecas soltas por digito)
def u1c(d, o):
    p = d.new_page(width=842, height=200)
    if o:
        sete(p, CPF, 50, 30, 34, 34, 58)
        isca(p, CPF, 50, 120)
    p.insert_text((50, 170), "CONTROLE PUBLICO", fontname="cour", fontsize=12, color=(0, 0, 0))
salvar("u1c-sete-grande-solto", u1c, termos=(CPF,), nota="CPF em sete segmentos de 34 pt, sem moldura; isca 2 pt")


def curvas(txt, x, y, tam, cor, W, H, fonte="helv"):
    q = pymupdf.open().new_page(width=W, height=H)
    q.insert_text((x, y), txt, fontname=fonte, fontsize=tam, color=cor)
    s = pymupdf.open(stream=q.get_svg_image(text_as_path=True).encode(), filetype="svg")
    return pymupdf.open("pdf", s.convert_to_pdf())


# u2: dado em CURVAS vetoriais em cinza 0,93 (sem imagem: a regra nova da imagem nao vale) + isca
def u2(d, o):
    p = d.new_page(width=330, height=185)
    if o:
        p.show_pdf_page(p.rect, curvas(DADO, 60, 72, 22, (0.93,) * 3, 330, 185), 0)
        isca(p, DADO, 60, 77)
    p.insert_text((40, 170), "CONTROLE PUBLICO", fontname="cour", fontsize=12, color=(0, 0, 0))
salvar("u2-curvas-cinza-0.93", u2, nota="dado em curvas vetoriais cinza 0,93; isca 2 pt")


# u3: dado em contorno: letras em curvas so com o traco (sem preenchimento), cor do fundo por dentro, traco 0,6 pt
def u3(d, o):
    p = d.new_page(width=330, height=185)
    if o:
        p.insert_text((60, 80), DADO, fontname="helv", fontsize=28, color=(0, 0, 0), fill=(1, 1, 1), render_mode=2, border_width=0.02)
    p.insert_text((40, 170), "CONTROLE PUBLICO", fontname="cour", fontsize=12, color=(0, 0, 0))
salvar("u3-contorno-texto", u3, nota="dado como TEXTO em contorno (modo 2, miolo branco) - controle: a camada e o proprio dado")


