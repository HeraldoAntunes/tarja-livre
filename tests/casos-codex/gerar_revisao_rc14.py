"""Casos da rc.14 (gregas de formula). So dados inventados. Uso: python gerar_rc14.py <pasta>"""
import json
import sys
from pathlib import Path

import pymupdf

RAIZ = Path(sys.argv[1])
F = "C:/Windows/Fonts/"


def caso(nome, fonte, linha, termo, nota):
    q = RAIZ / nome
    q.mkdir(parents=True, exist_ok=True)
    for arq, o in (("original.pdf", True), ("sem-dados.pdf", False)):
        d = pymupdf.open()
        p = d.new_page(width=595, height=300)
        p.insert_font(fontname="F0", fontfile=F + fonte)
        linhas = ["Of\u00edcio n\u00ba 9/2026 \u2014 Secretaria Fict\u00edcia", ("Interessada: " + linha) if o else "Interessada:",
                  "Atenciosamente, a coordena\u00e7\u00e3o."]
        for i, t in enumerate(linhas):
            p.insert_text((60, 60 + 24 * i), t, fontname="F0", fontsize=12)
        d.save(q / arq, garbage=3, deflate=True)
    (q / "caso.json").write_text(json.dumps({"termos": [termo], "nota": nota}, ensure_ascii=False))
    print(nome, ascii(pymupdf.open(q / "original.pdf")[0].get_text().splitlines()[1]))


caso("z1-nome-inteiro-alfa", "arial.ttf", "M\u03b1ri\u03b1n\u03b1 Silv\u03b1 Fict\u00edci\u03b1", "Mariana Silva Ficticia", "nome inteiro com alfa no lugar do a")
caso("z2-epsilon-eva", "arial.ttf", "\u03b5v\u03b1 Fict\u00edci\u03b1", "Eva", "Eva com epsilon (fora da tabela) e alfa; so 1 latina na palavra")
caso("z3-zwj-separa", "segoeui.ttf", "m\u03b1\u200dri\u03b1\u200dn\u03b1", "mariana", "mariana com alfa e ZWJ separando: cada pedaco com menos de 3 latinas")
caso("z2b-epsilon-eva-so", "arial.ttf", "\u03b5v\u03b1", "Eva", "so 'eva' com epsilon e alfa, sem outra palavra mista na pagina")
