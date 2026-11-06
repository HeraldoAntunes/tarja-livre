"""PDFs novos para tentar quebrar a rc.5 (bateComImagem) e PDFs comuns para medir excesso de "confira".
So dados inventados. Uso: python gerar_rc5.py <pasta ataques> <pasta comuns>"""
import json
import sys
from pathlib import Path

import pymupdf

ATQ, COM = Path(sys.argv[1]), Path(sys.argv[2])
DADO = "SIGILOCODIGO"


def imagem(linhas, W, H, fundo=0.98):
    d = pymupdf.open()
    p = d.new_page(width=W, height=H)
    p.draw_rect(p.rect, color=None, fill=(fundo,) * 3)
    for txt, x, y, tam, fonte in linhas:
        p.insert_text((x, y), txt, fontname=fonte, fontsize=tam, color=(0.08,) * 3)
    return p.get_pixmap(dpi=300)


def em_curvas(linhas, W, H):
    """pagina so com as linhas em CURVAS (texto convertido em caminho, sem fonte e sem imagem)"""
    d = pymupdf.open()
    p = d.new_page(width=W, height=H)
    for txt, x, y, tam, fonte in linhas:
        p.insert_text((x, y), txt, fontname=fonte, fontsize=tam, color=(0.08,) * 3)
    svg = p.get_svg_image(text_as_path=True)
    s = pymupdf.open(stream=svg.encode(), filetype="svg")
    return pymupdf.open("pdf", s.convert_to_pdf())


def salvar(pasta, nome, montar, termos=(DADO,), nota=""):
    q = pasta / nome
    q.mkdir(parents=True, exist_ok=True)
    for arq, original in (("original.pdf", True), ("sem-dados.pdf", False)):
        d = pymupdf.open()
        montar(d, original)
        d.save(q / arq)
    (q / "caso.json").write_text(json.dumps({"termos": list(termos), "nota": nota}, ensure_ascii=False))


def pagina_img(W, H, com, sem, camada=(), girar=0, fundo=0.98):
    def montar(d, original):
        p = d.new_page(width=W, height=H)
        p.insert_image(p.rect, pixmap=imagem(com if original else sem, W, H, fundo))
        if original:
            for c in camada:
                p.insert_text(**c)
        if girar:
            p.set_rotation(girar)
    return montar


PUB = ("CONTROLE PUBLICO", 60, 150, 12, "cour")

# N1. dado em CURVAS (sem imagem) + camada preta visivel de 2 pt sob ele (s1 sem imagem)
def n1(d, original):
    p = d.new_page(width=330, height=185)
    p.show_pdf_page(p.rect, em_curvas([(DADO, 60, 72, 18, "cour"), PUB] if original else [PUB], 330, 185), 0)
    if original:
        p.insert_text((60, 77), DADO, fontname="cour", fontsize=2, color=(0, 0, 0))
salvar(ATQ, "n1-curvas-minusculo", n1, nota="dado em curvas 18 pt (sem imagem), camada preta 2 pt")

# N2. isca longe: camada cinza 0,84 sobre PUBLICODADO do mesmo tamanho; dado na imagem 110 pt acima (fora da regiao)
salvar(ATQ, "n2-isca-longe", pagina_img(330, 260, [(DADO, 60, 40, 18, "cour"), ("PUBLICODADO", 60, 150, 18, "cour"), ("CONTROLE PUBLICO", 60, 230, 12, "cour")],
       [("PUBLICODADO", 60, 150, 18, "cour"), ("CONTROLE PUBLICO", 60, 230, 12, "cour")],
       [dict(point=(60, 150), text=DADO, fontname="cour", fontsize=18, color=(0.84,) * 3)]),
       nota="camada cinza 0,84 sobre PUBLICODADO; dado na imagem 110 pt acima")

# N3. Helvetica na imagem, camada INVISIVEL (modo 3) em Courier no mesmo ponto
salvar(ATQ, "n3-helvetica-courier", pagina_img(330, 185, [(DADO, 60, 72, 18, "helv"), PUB], [PUB],
       [dict(point=(60, 72), text=DADO, fontname="cour", fontsize=18, render_mode=3)]),
       nota="imagem Helvetica 18, camada modo 3 Courier 18")

# N4. pagina girada 90 graus, s1 (camada visivel 2 pt) e variante OCR invisivel
salvar(ATQ, "n4-girada-minusculo", pagina_img(330, 185, [(DADO, 60, 72, 18, "cour"), PUB], [PUB],
       [dict(point=(60, 77), text=DADO, fontname="cour", fontsize=2, color=(0, 0, 0))], girar=90),
       nota="s1 em pagina /Rotate 90")
salvar(ATQ, "n4b-girada-ocr", pagina_img(330, 185, [(DADO, 60, 72, 18, "cour"), PUB], [PUB],
       [dict(point=(60, 72), text=DADO, fontname="cour", fontsize=18, render_mode=3)], girar=90),
       nota="camada modo 3 certa, pagina /Rotate 90")

# N5. camada visivel preta, tamanho certo, deslocada meia linha (9 pt) para baixo
salvar(ATQ, "n5-meia-linha", pagina_img(330, 185, [(DADO, 60, 72, 18, "cour"), PUB], [PUB],
       [dict(point=(60, 81), text=DADO, fontname="cour", fontsize=18, color=(0, 0, 0))]),
       nota="camada preta 18 pt deslocada 9 pt")

# N6. duas ocorrencias: uma em texto vetorial visivel e certo (sem imagem embaixo), outra so na imagem (selo) longe
def n6(d, original):
    p = d.new_page(width=330, height=260)
    selo = imagem([(DADO, 10, 30, 18, "cour")] if original else [], 170, 45)
    p.insert_image(pymupdf.Rect(50, 10, 220, 55), pixmap=selo)
    if original:
        p.insert_text((60, 200), DADO, fontname="cour", fontsize=18, color=(0, 0, 0))
    p.insert_text((60, 240), "CONTROLE PUBLICO", fontname="cour", fontsize=12, color=(0, 0, 0))
salvar(ATQ, "n6-duas-ocorrencias", n6, nota="texto visivel certo em baixo; o mesmo dado so na imagem do selo em cima")

# N7. texto escuro com opacidade 0,05 sobre PUBLICODADO; dado na imagem acima
salvar(ATQ, "n7-opacidade-005", pagina_img(330, 185, [(DADO, 60, 72, 18, "cour"), ("PUBLICODADO", 60, 122, 18, "cour"), PUB],
       [("PUBLICODADO", 60, 122, 18, "cour"), PUB],
       [dict(point=(60, 122), text=DADO, fontname="cour", fontsize=18, color=(0, 0, 0), fill_opacity=0.05)]),
       nota="camada preta opacidade 0,05 sobre PUBLICODADO")


# ---- documentos comuns (o dado e texto preto visivel; sem-dados = sem o dado) ----
def comum(nome, extra, termos=(DADO, "123.456.789-00"), helv=True):
    def montar(d, original):
        p = d.new_page(width=595, height=842)
        extra(p)
        f = "helv" if helv else "cour"
        linhas = ["Oficio 12/2026 - Secretaria Ficticia", "Interessado: Fulano de Tal Ficticio",
                  "Codigo do processo: " + (DADO if original else ""), "CPF: " + ("123.456.789-00" if original else ""),
                  "Texto corrido de exemplo, sem dado nenhum, so para encher a pagina."]
        for i, t in enumerate(linhas):
            p.insert_text((72, 160 + 22 * i), t, fontname=f, fontsize=11, color=(0, 0, 0))
    salvar(COM, nome, montar, termos=termos)


comum("c1-texto-simples", lambda p: None)


def logo(p):
    pm = imagem([("LOGO", 8, 40, 30, "helv")], 110, 60, fundo=0.85)
    p.insert_image(pymupdf.Rect(72, 60, 182, 120), pixmap=pm)
    # selo/assinatura em imagem colada ao lado do CPF
    pm2 = imagem([("assinado", 5, 22, 14, "helv")], 90, 30, fundo=1)
    p.insert_image(pymupdf.Rect(230, 205, 320, 235), pixmap=pm2)
comum("c2-logotipo-e-assinatura", logo)


def fundo_papel(p):
    # papel timbrado inteiro em imagem clara, com faixa escura no topo
    d = pymupdf.open()
    q = d.new_page(width=595, height=842)
    q.draw_rect(q.rect, color=None, fill=(0.97, 0.96, 0.93))
    q.draw_rect(pymupdf.Rect(0, 0, 595, 70), color=None, fill=(0.1, 0.2, 0.4))
    q.insert_text((60, 45), "PAPEL TIMBRADO FICTICIO", fontname="helv", fontsize=20, color=(1, 1, 1))
    p.insert_image(p.rect, pixmap=q.get_pixmap(dpi=150))
comum("c3-papel-timbrado", fundo_papel)
