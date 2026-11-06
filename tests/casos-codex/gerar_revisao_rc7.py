"""PDFs para tentar quebrar a rc.7 (temDesenho por tinta, excecao do traco fino e comprido; decisao do OCR inteiro).
So dados inventados. Uso: python gerar_rc7.py <pasta>"""
import json
import sys
from pathlib import Path

import pymupdf

import ast
_fonte = (Path(__file__).parent / "gerar_revisao_rc6.py").read_text(encoding="utf8")
F = next(ast.literal_eval(n.value) for n in ast.parse(_fonte).body if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "F")

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


def rajado(p, txt, x0, y0, c, passo=3.0, esp=1.0, cor=PRETO):
    """letras de blocos (celula c pt) preenchidas so por linhas horizontais finas (esp pt), uma a cada passo pt:
    toda linha corre reta por uma ou mais celulas inteiras (c >= 10 pt)"""
    x = x0
    for ch in txt:
        for r, linha in enumerate(F[ch]):
            j = 0
            while j < 3:
                if linha[j] != "#":
                    j += 1
                    continue
                k = j
                while k < 3 and linha[k] == "#":
                    k += 1
                y = y0 + r * c + 0.5
                while y < y0 + (r + 1) * c - 0.2:
                    p.draw_line((x + j * c, y), (x + k * c, y), color=cor, width=esp)
                    y += passo
                j = k
        x += 4 * c


# sete segmentos de traco fino: segmentos a(topo) b(dir. alto) c(dir. baixo) d(base) e(esq. baixo) f(esq. alto) g(meio)
SEG = {"0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc",
       "8": "abcdefg", "9": "abcdfg", "-": "g", "S": "afgcd", "I": "bc", "G": "afedc", "L": "fed", "O": "abcdef",
       "C": "afed", "D": "bcdeg"}


def sete(p, txt, x0, y0, w=12, h=12, esp=1.0, cor=PRETO, passo=None):
    passo = passo or w + 8
    x = x0
    for ch in txt:
        if ch == ".":
            x += 6
            continue
        a, m, b = y0, y0 + h, y0 + 2 * h
        segs = {"a": ((x, a), (x + w, a)), "g": ((x, m), (x + w, m)), "d": ((x, b), (x + w, b)),
                "f": ((x, a), (x, m)), "e": ((x, m), (x, b)), "b": ((x + w, a), (x + w, m)), "c": ((x + w, m), (x + w, b))}
        for s in SEG[ch]:
            p.draw_line(*segs[s], color=cor, width=esp)
        x += passo


def isca(p, txt, x, y):
    p.insert_text((x, y), txt, fontname="cour", fontsize=2, color=(0, 0, 0))


def publico(p, x=40, y=None):
    p.insert_text((x, y or p.rect.height - 15), "CONTROLE PUBLICO", fontname="cour", fontsize=12, color=(0, 0, 0))


# t1: letras rajadas (celula 10 pt, linhas de 1 pt a cada 3 pt) + isca de 2 pt
def t1(d, o):
    p = d.new_page(width=520, height=150)
    if o:
        rajado(p, DADO, 30, 30, 10)
        isca(p, DADO, 30, 86)
    publico(p)
salvar("t1-rajado-isca", t1, nota="dado em blocos de 10 pt rajados por linhas de 1 pt; isca 2 pt")

# t1b: idem sem isca, com o dado tambem em texto visivel certo noutra linha (a sugestao da camada fica certa)
def t1b(d, o):
    p = d.new_page(width=520, height=200)
    if o:
        rajado(p, DADO, 30, 20, 10)
        p.insert_text((30, 140), DADO, fontname="cour", fontsize=14, color=(0, 0, 0))
    publico(p)
salvar("t1b-rajado-e-texto", t1b, nota="texto visivel certo + o mesmo dado em letras rajadas")

# t2: CPF em sete segmentos de traco fino (1 pt, segmentos de 12 pt) + isca de 2 pt
def t2(d, o):
    p = d.new_page(width=330, height=120)
    if o:
        sete(p, CPF, 20, 20)
        isca(p, CPF, 20, 58)
    publico(p)
salvar("t2-sete-segmentos-cpf", t2, termos=(CPF,), nota="CPF em sete segmentos de 1 pt; isca 2 pt")

# t2b: palavra em sete segmentos de traco fino + isca
def t2b(d, o):
    p = d.new_page(width=330, height=120)
    if o:
        sete(p, DADO, 20, 20, w=10, h=10, passo=18)
        isca(p, DADO, 20, 48)
    publico(p)
salvar("t2b-sete-segmentos-palavra", t2b, nota="SIGILOCODIGO em sete segmentos de 1 pt (10 pt); isca 2 pt")

def _pix(desenhar, W=330, H=185):
    d = pymupdf.open()
    q = d.new_page(width=W, height=H)
    desenhar(q)
    return q.get_pixmap(dpi=300)


# t3: dado em cinza bem claro, logo acima do limiar 235 (lum ~237 e ~240), curvas vetoriais (sem imagem) + isca
for cinza in (0.93, 0.945):
    def t3(d, o, cinza=cinza):
        p = d.new_page(width=330, height=185)
        if o:
            p.insert_image(p.rect, pixmap=_pix(lambda q: q.insert_text((60, 72), DADO, fontname="helv", fontsize=22, color=(cinza,) * 3)))
            isca(p, DADO, 60, 77)
        publico(p)
    salvar(f"t3-claro-{cinza}", t3, nota=f"dado em imagem cinza {cinza}; isca 2 pt")


# t4: pagina digitalizada (so imagem), o dado duas vezes: grande e escuro (o OCR le) e pequeno/claro (o OCR pode nao ler)
def t4(d, o):
    p = d.new_page(width=330, height=185)
    def desenhar(q):
        q.insert_text((40, 60), DADO, fontname="helv", fontsize=20, color=PRETO)
        if o:
            q.insert_text((40, 120), "ref. " + DADO, fontname="helv", fontsize=7, color=(0.55,) * 3)
        q.insert_text((40, 160), "CONTROLE PUBLICO", fontname="helv", fontsize=12, color=PRETO)
    if o:
        p.insert_image(p.rect, pixmap=_pix(desenhar))
    else:
        p.insert_image(p.rect, pixmap=_pix(lambda q: q.insert_text((40, 160), "CONTROLE PUBLICO", fontname="helv", fontsize=12, color=PRETO)))
salvar("t4-digitalizada-duas", t4, nota="pagina so imagem: dado grande e o mesmo dado pequeno e cinza")

# t5: pagina digitalizada em que o OCR le o dado com a caixa curta (letras bem espacadas, uma letra mais alta)
def t5(d, o):
    p = d.new_page(width=330, height=185)
    def desenhar(q):
        if o:
            q.insert_text((40, 80), "S I G I L O C O D I G O", fontname="helv", fontsize=16, color=PRETO)
        q.insert_text((40, 160), "CONTROLE PUBLICO", fontname="helv", fontsize=12, color=PRETO)
    p.insert_image(p.rect, pixmap=_pix(desenhar))
salvar("t5-digitalizada-espacada", t5, nota="pagina so imagem: dado com letras espacadas")
