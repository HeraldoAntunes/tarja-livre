"""Controle da rc.12: documento comum em português, com acentos, cedilha, travessão, aspas curvas, ordinal e
reticências, em Arial embutida; a linha do dado vai em Helvetica (com a Arial embutida pelo PyMuPDF, o hífen do CPF sai
como hífen suave, que o PDF.js descarta). Não pode pedir "confira" (a regra da camada de texto estranha não dá alarme).
Só dados inventados. Uso: python gerar_portugues.py <pasta>"""
import json
import sys
from pathlib import Path

import pymupdf

RAIZ = Path(sys.argv[1])
ARIAL = "C:/Windows/Fonts/arial.ttf"
LINHAS = [
    "Ofício nº 7/2026 — Secretaria Fictícia de Educação",
    "Assunto: solicitação de informações à coordenação…",
    "Prezada senhora, em atenção ao “pedido nº 12”, informamos que a",
    "ação foi concluída em 3 de novembro. O 1º relatório, já revisado,",
    "segue em anexo; a próxima reunião será às 14h30, na sala 2ª.",
    "Atenciosamente, Coordenação Pedagógica (dados fictícios).",
]


def montar(d, com_dado):
    p = d.new_page(width=595, height=300)
    p.insert_font(fontname="F0", fontfile=ARIAL)
    y = 40
    for linha in LINHAS:
        p.insert_text((40, y), linha, fontname="F0", fontsize=11)
        y += 22
    # a linha do dado em pedaços, para o PDF sem dados ter o resto no mesmo lugar
    x = 40
    for pedaco, dado in (("Responsável: ", False), ("SIGILOCODIGO", True), (", CPF ", False), ("123.456.789-00", True), (".", False)):
        if com_dado or not dado:
            p.insert_text((x, y), pedaco, fontname="helv", fontsize=11)
        x += pymupdf.get_text_length(pedaco, fontname="helv", fontsize=11)


q = RAIZ / "comum-portugues-acentos"
q.mkdir(parents=True, exist_ok=True)
for arq, o in (("original.pdf", True), ("sem-dados.pdf", False)):
    d = pymupdf.open()
    montar(d, o)
    d.save(q / arq, garbage=3, deflate=True)
(q / "caso.json").write_text(json.dumps({"termos": ["SIGILOCODIGO", "123.456.789-00"], "semConfira": True,
                                         "semAvisoDesenho": True}, ensure_ascii=False), encoding="utf-8")
print(pymupdf.open(q / "original.pdf")[0].get_text())
