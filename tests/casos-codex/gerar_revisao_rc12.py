"""Contornos da regra da rc.12 (camadaEstranha, sosias, NFKC). So dados inventados. Uso: python gerar_rc12.py <pasta>"""
import json
import sys
from pathlib import Path

import pymupdf

RAIZ = Path(sys.argv[1])
DADO = "SIGILOCODIGO"
CPF = "123.456.789-00"
F = "C:/Windows/Fonts/"


def salvar(nome, montar, termos, nota, cmap=None):
    q = RAIZ / nome
    q.mkdir(parents=True, exist_ok=True)
    for arq, o in (("original.pdf", True), ("sem-dados.pdf", False)):
        d = pymupdf.open()
        montar(d, o)
        if o and cmap:
            trocar_tounicode(d, cmap)
        d.save(q / arq, garbage=3, deflate=True)
    (q / "caso.json").write_text(json.dumps({"termos": list(termos), "nota": nota}, ensure_ascii=False))
    print(nome, "extrai:", ascii(pymupdf.open(q / "original.pdf")[0].get_text().replace("\n", " | ")[:120]))


def trocar_tounicode(d, linhas):
    cmap = chr(10).join(["/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap",
                         "/CIDSystemInfo <</Registry(Ado" "be)/Ordering(UCS)/Supplement 0>> def", "/CMapName /Ado" "be-Identity-UCS def",
                         "/CMapType 2 def", "1 begincodespacerange", "<0000> <FFFF>", "endcodespacerange"] + linhas +
                        ["endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end", ""]).encode()
    for x in range(1, d.xref_length()):
        o = d.xref_object(x)
        if "/Type0" in o and "/ToUnicode" in o:
            d.update_stream(int(o.split("/ToUnicode")[1].split()[0]), cmap)


def base(p):
    p.insert_text((40, 40), "Oficio 7/2026 - Secretaria Ficticia", fontname="helv", fontsize=11)
    p.insert_text((40, 170), "CONTROLE PUBLICO", fontname="helv", fontsize=11)


def com_fonte(arquivo, texto, tam=20, y=100):
    def montar(d, o):
        p = d.new_page(width=330, height=185)
        base(p)
        if o:
            p.insert_font(fontname="F0", fontfile=F + arquivo)
            p.insert_text((40, y), texto, fontname="F0", fontsize=tam)
    return montar


# x1: ToUnicode "deslocado" (erro comum de fonte subconjunto): cada glifo vira a letra latina seguinte; so latino
# Arial: os codigos (CID) sao os indices de glifo; mapear a faixa inteira para A em diante da letras latinas erradas
salvar("x1-tounicode-latino-errado", com_fonte("arial.ttf", DADO), (DADO,), "ToUnicode manda os glifos para outras letras latinas",
       cmap=["1 beginbfrange", "<0000> <00ff> <0041>", "endbfrange"])
# x5: camada vazia: o ToUnicode manda todo glifo para espaco
salvar("x5-camada-vazia", com_fonte("arial.ttf", DADO), (DADO,), "ToUnicode manda todo glifo para espaco",
       cmap=["1 beginbfrange", "<0000> <00ff> [" + " ".join(["<0020>"] * 256) + "]", "endbfrange"])
# x2: sosias Cherokee (fora da tabela): S, G, L, D em Cherokee, o resto latino (fonte Gadugi)
salvar("x2-cherokee", com_fonte("gadugi.ttf", "\u13DAI\u13C0I\u13DEOCO\u13A0I\u13C0O"), (DADO,), "SIGILOCODIGO com S, G, L, D Cherokee")
# x3: CPF com espaco de largura zero (U+200B) no meio (Segoe UI)
salvar("x3-zwsp-cpf", com_fonte("segoeui.ttf", "123.456\u200B.789\u200B-00"), (CPF,), "CPF com U+200B no meio")
# x4: CPF em digitos matematicos negritos (U+1D7CF...) (Segoe UI Symbol)
MAT = {str(i): chr(0x1D7CE + i) for i in range(10)}
salvar("x4-digitos-matematicos", com_fonte("seguisym.ttf", "".join(MAT.get(c, c) for c in CPF)), (CPF,), "CPF em digitos matematicos negritos")


# x6: PDF comum em portugues (acentos, ligadura, travessao, aspas, marcador de lista), com o dado comum
def x6(d, o):
    p = d.new_page(width=595, height=842)
    p.insert_font(fontname="F0", fontfile=F + "arial.ttf")
    linhas = ["Ofício nº 12/2026 — Secretaria Fictícia de Educação", "Interessada: Fulana de Tal Fictícia",
              "Código do processo: " + (DADO if o else ""), "CPF: " + (CPF if o else ""),
              "• Atenção: a eficácia da ação depende de “ajustes” e ‘revisões’ — até 5º dia útil.",
              "Coração, ação, informação, órgão, pública, médio, saúde, câmara, irmã."]
    for i, t in enumerate(linhas):
        p.insert_text((72, 160 + 22 * i), t, fontname="F0", fontsize=11)
salvar("x6-comum-portugues", x6, (DADO, CPF), "documento comum em portugues")
