"""PDFs para tentar quebrar a rc.11 (toda tinta que nao e texto conta). So dados inventados.
Uso: python gerar_rc11.py <pasta>"""
import json
import re
import sys
from pathlib import Path

import pymupdf

RAIZ = Path(sys.argv[1])
DADO = "SIGILOCODIGO"
ARIAL = "C:/Windows/Fonts/arial.ttf"


def salvar(nome, montar, termos, nota):
    q = RAIZ / nome
    q.mkdir(parents=True, exist_ok=True)
    for arq, o in (("original.pdf", True), ("sem-dados.pdf", False)):
        d = pymupdf.open()
        montar(d, o)
        d.save(q / arq, garbage=3, deflate=True)
    (q / "caso.json").write_text(json.dumps({"termos": list(termos), "nota": nota}, ensure_ascii=False))


def comum(p):
    p.insert_text((40, 40), "Oficio 7/2026 - Secretaria Ficticia", fontname="helv", fontsize=11)
    p.insert_text((40, 170), "CONTROLE PUBLICO", fontname="helv", fontsize=11)


# w1: o dado e TEXTO visivel em Arial embutida, mas o ToUnicode da fonte mapeia as letras para outras (X): a camada
# diz XXXXXXXXXXXX, a pagina mostra SIGILOCODIGO. Nao ha imagem nem desenho. Comum em PDF com fonte sem ToUnicode certo.
def w1(d, o):
    p = d.new_page(width=330, height=185)
    comum(p)
    if o:
        p.insert_font(fontname="F0", fontfile=ARIAL)
        p.insert_text((40, 100), DADO, fontname="F0", fontsize=20)
salvar("w1-tounicode-errado", w1, (DADO,), "dado em texto Arial com ToUnicode trocado (extrai X)")


# w2: o dado em letras parecidas de outros alfabetos (cirilico S, I, O, C; numeral romano L; G e D latinos trocados)
SOSIA = "\u0405\u0406G\u0406L\u041E\u0421\u041ED\u0406G\u041E"   # S I G I L O C O D I G O
def w2(d, o):
    p = d.new_page(width=330, height=185)
    comum(p)
    if o:
        p.insert_font(fontname="F0", fontfile=ARIAL)
        p.insert_text((40, 100), SOSIA, fontname="F0", fontsize=20)
salvar("w2-letras-sosias", w2, (DADO,), "dado com letras cirilicas e numeral romano que parecem latinas")


# w3: inversao: o dado em texto branco sobre um retangulo escuro (a camada tem o dado)
def w3(d, o):
    p = d.new_page(width=330, height=185)
    comum(p)
    p.draw_rect(pymupdf.Rect(30, 80, 280, 110), color=None, fill=(0.1, 0.1, 0.1))
    if o:
        p.insert_text((40, 102), DADO, fontname="helv", fontsize=20, color=(1, 1, 1))
salvar("w3-branco-no-escuro", w3, (DADO,), "dado em texto branco sobre retangulo escuro")


# w4: pagina inteira amarela-clara (vetor), dado em curvas num amarelo vizinho, isca de 2 pt
def curvas(txt, x, y, tam, cor, W, H):
    q = pymupdf.open().new_page(width=W, height=H)
    q.insert_text((x, y), txt, fontname="helv", fontsize=tam, color=cor)
    s = pymupdf.open(stream=q.get_svg_image(text_as_path=True).encode(), filetype="svg")
    return pymupdf.open("pdf", s.convert_to_pdf())
def w4(d, o):
    p = d.new_page(width=330, height=185)
    p.draw_rect(p.rect, color=None, fill=(1, 0.97, 0.80))
    comum(p)
    if o:
        p.show_pdf_page(p.rect, curvas(DADO, 60, 72, 26, (0.93, 0.88, 0.65), 330, 185), 0)
        p.insert_text((60, 77), DADO, fontname="cour", fontsize=2, color=(0, 0, 0))
salvar("w4-fundo-amarelo", w4, (DADO,), "pagina amarela-clara, dado em amarelo vizinho, isca 2 pt")


def pos_tounicode(pasta):
    """troca o ToUnicode da fonte F0 (w1) por um que manda cada glifo para outro caractere (ideogramas)"""
    f = pasta / "original.pdf"
    d = pymupdf.open(f)
    cmap = chr(10).join([
        "/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap",
        "/CIDSystemInfo <</Registry(Ado" "be)/Ordering(UCS)/Supplement 0>> def", "/CMapName /Ado" "be-Identity-UCS def",
        "/CMapType 2 def", "1 begincodespacerange", "<0000> <FFFF>", "endcodespacerange", "1 beginbfrange",
        "<0000> <0fff> <4E00>", "endbfrange", "endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end", ""]).encode()
    for x in range(1, d.xref_length()):
        o = d.xref_object(x)
        if "/Type0" in o and "/ToUnicode" in o:
            tu = int(o.split("/ToUnicode")[1].split()[0])
            d.update_stream(tu, cmap)
    d.save(str(f) + ".tmp", garbage=3, deflate=True)
    d.close()
    Path(str(f) + ".tmp").replace(f)
    print("w1 texto extraido:", ascii(pymupdf.open(f)[0].get_text().strip()[-40:]))


pos_tounicode(RAIZ / "w1-tounicode-errado")
print("w2 texto extraido:", ascii(pymupdf.open(RAIZ / "w2-letras-sosias" / "original.pdf")[0].get_text().strip()[-30:]))
