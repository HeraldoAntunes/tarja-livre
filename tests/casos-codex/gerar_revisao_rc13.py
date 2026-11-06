"""Contornos da rc.13. So dados inventados. Uso: python gerar_rc13.py <pasta>"""
import json
import sys
from pathlib import Path

import pymupdf

RAIZ = Path(sys.argv[1])
ARIAL = "C:/Windows/Fonts/arial.ttf"


def salvar(nome, montar, termos, nota, mapa=None):
    q = RAIZ / nome
    q.mkdir(parents=True, exist_ok=True)
    for arq, o in (("original.pdf", True), ("sem-dados.pdf", False)):
        d = pymupdf.open()
        montar(d, o)
        if o and mapa:
            refazer_tounicode(d, mapa)
        d.save(q / arq, garbage=3, deflate=True)
    (q / "caso.json").write_text(json.dumps({"termos": list(termos), "nota": nota}, ensure_ascii=False))
    print(nome, "extrai:", ascii(pymupdf.open(q / "original.pdf")[0].get_text().replace("\n", " | ")[:140]))


def refazer_tounicode(d, trocar):
    """ToUnicode novo, glifo a glifo, com o texto real; as letras em `trocar` viram espaco"""
    p = d[0]
    pares = {}
    for sp in p.get_texttrace():
        if "F0" not in str(sp.get("font", "")) and "Arial" not in str(sp.get("font", "")):
            continue
        for ch in sp["chars"]:
            u, g = chr(ch[0]), ch[1]
            pares[g] = " " if u in trocar else u
    linhas = [f"{len(pares)} beginbfchar"] + [f"<{g:04x}> <{ord(u):04x}>" for g, u in sorted(pares.items())] + ["endbfchar"]
    cmap = chr(10).join(["/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap",
                         "/CIDSystemInfo <</Registry(Ado" "be)/Ordering(UCS)/Supplement 0>> def", "/CMapName /Ado" "be-Identity-UCS def",
                         "/CMapType 2 def", "1 begincodespacerange", "<0000> <FFFF>", "endcodespacerange"] + linhas +
                        ["endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end", ""]).encode()
    for x in range(1, d.xref_length()):
        o = d.xref_object(x)
        if "/Type0" in o and "/ToUnicode" in o:
            d.update_stream(int(o.split("/ToUnicode")[1].split()[0]), cmap)


def doc(linhas_dado, linhas_sem):
    def montar(d, o):
        p = d.new_page(width=595, height=300)
        p.insert_font(fontname="F0", fontfile=ARIAL)
        for i, t in enumerate(linhas_dado if o else linhas_sem):
            p.insert_text((60, 60 + 24 * i), t, fontname="F0", fontsize=12)
    return montar


TOPO = ["Ofício nº 9/2026 — Secretaria Fictícia", "Assunto: cadastro de pessoa fictícia"]
FIM = ["Atenciosamente, a coordenação."]

# y1: nome com alfa grego (lista branca de formula) no lugar do "a" latino: mαriαnα fictíciα
salvar("y1-alfa-no-lugar-do-a", doc(TOPO + ["Interessada: m\u03b1ri\u03b1n\u03b1 fict\u00edci\u03b1"] + FIM, TOPO + ["Interessada:"] + FIM),
       ("mariana",), "nome com alfa grego (lista branca) no lugar do a")
# y2: camada parcial: na mesma linha, "Processo:" sai certo e as maiusculas do dado viram espaco
salvar("y2-camada-parcial", doc(TOPO + ["Processo: SIGILOCODIGO"] + FIM, TOPO + ["Processo:"] + FIM),
       ("SIGILOCODIGO",), "letras S I G L O C D do dado com ToUnicode para espaco; resto da linha certo", mapa=set("SIGLOCD"))
# y3: so 2 glifos do dado fora da camada: o dado inteiro na mesma linha de texto certo, e so o S e o D viram espaco
salvar("y3-dois-glifos", doc(TOPO + ["Processo: SIGILOCODIGO"] + FIM, TOPO + ["Processo:"] + FIM),
       ("SIGILOCODIGO",), "so S e D com ToUnicode para espaco", mapa=set("SD"))
# y4: CPF VALIDO com hifen num PDF comum (Arial embutida: o hifen sai como U+00AD, que o PDF.js tira)
salvar("y4-cpf-valido-hifen", doc(TOPO + ["CPF: 831.975.872-60"] + FIM, TOPO + ["CPF:"] + FIM),
       ("831.975.872-60",), "CPF valido ficticio com hifen, documento comum")
