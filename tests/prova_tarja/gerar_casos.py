# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
"""PDFs sintéticos, só com dados fictícios, para a prova de que a tarja apaga (docs/PROVA-TARJA-1.2.2.md).

Cada caso sai numa pasta com:
  original.pdf      o PDF de teste
  sem-dados.pdf     o mesmo, sem os dados que vão ser tarjados (a diferença de pixels entre os dois mostra onde os
                    dados aparecem na página, para conferir pixel a pixel que ficaram pretos no PDF tarjado)
  caso.json         os dados (segredos) a procurar depois, os termos para a lista do programa, as tarjas à mão
                    (em pontos do PDF, origem no canto de cima) e qual HTML usar (normal ou com OCR)

Precisa do PyMuPDF (pip install pymupdf). Uso: python gerar_casos.py <pasta de saída>
"""

import os
import io
import json
import sys
from pathlib import Path

import pymupdf

# a DejaVu Sans do Linux; noutro sistema, PROVA_FONTE aponta para uma cópia dela (a do matplotlib serve)
FONTE = os.environ.get("PROVA_FONTE", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
NOME = "Fulano de Teste"
NOME2 = "Beltrana Ficticia"
CPF = "831.975.872-60"
CPF2 = "514.334.988-55"
EMAIL = "fulano.teste@exemplo.test"
MATRICULA = "MAT-2026-4471"


def novo() -> pymupdf.Document:
    d = pymupdf.open()
    d.new_page(width=595, height=842)
    return d


def salvar(d: pymupdf.Document, caminho: Path, **kw) -> None:
    d.save(caminho, garbage=kw.pop("garbage", 0), deflate=kw.pop("deflate", True), **kw)


def largura(t: str, tam: float, fontname: str = "helv") -> float:
    if fontname == "dvs":
        return pymupdf.Font(fontfile=FONTE).text_length(t, fontsize=tam)
    return pymupdf.get_text_length(t, fontname=fontname, fontsize=tam)


def trecho(p: pymupdf.Page, x: float, y: float, a: str, dado: str, b: str, com_dados: bool, tam: float, **kw):
    """Escreve "a dado b" numa linha, cada parte no seu lugar: sem o dado, nada mais se mexe. Devolve a caixa do
    dado [x, y, largura, altura] em pontos, com 2 pontos de folga (a tarja que uma pessoa faria à mão)."""
    fn = kw.get("fontname", "helv")
    for t, eh_dado, dx in ((a, False, 0), (dado, True, largura(a, tam, fn)), (b, False, largura(a + dado, tam, fn))):
        if t and (com_dados or not eh_dado):
            p.insert_text((x + dx, y), t, fontsize=tam, **kw)
    x0 = x + largura(a, tam, fn)
    return [x0 - 2, y - tam * 0.95 - 2, largura(dado, tam, fn) + 4, tam * 1.2 + 4]


def linhas(p: pymupdf.Page, lista, com_dados: bool, x=60, y=100, tam=13, **kw):
    """lista: [(texto antes, dado, texto depois)]; devolve as caixas dos dados."""
    return [trecho(p, x, y + i * 26, a, dado, b, com_dados, tam, **kw) for i, (a, dado, b) in enumerate(lista)]


# ---------- os casos: cada função desenha o caso com ou sem os dados ----------

def texto_simples(com: bool, pasta: Path):
    d = novo()
    linhas(d[0], [("Ficha fictícia de matrícula", "", ""), ("Aluno: ", NOME, ""), ("CPF: ", CPF, ""),
                  ("Matrícula: ", MATRICULA, ""), ("E-mail: ", EMAIL, "")], com)
    return d


CAIXAS = {}   # caso -> caixas dos dados, para as tarjas à mão


def fonte_subconjunto(com: bool, pasta: Path):
    d = novo()
    p = d[0]
    p.insert_font(fontname="dvs", fontfile=FONTE)
    caixas = linhas(p, [("Fonte embutida, só com as letras usadas", "", ""), ("Responsável: ", NOME2, ""), ("CPF: ", CPF2, "")],
                    com, fontname="dvs")
    CAIXAS["fonte-sem-tounicode"] = [[0, *c] for c in caixas[1:]]
    d.subset_fonts()
    return d


def fonte_sem_tounicode(com: bool, pasta: Path):
    """Subconjunto sem o mapa de volta para Unicode: o texto não sai certo na extração (nem a procura acha)."""
    d = fonte_subconjunto(com, pasta)
    for x in range(1, d.xref_length()):
        if d.xref_get_key(x, "ToUnicode")[0] != "null":
            d.xref_set_key(x, "ToUnicode", "null")
    return d


def texto_girado(com: bool, pasta: Path):
    d = novo()
    p = d[0]
    p.insert_text((60, 90), "Texto girado (30 e 90 graus)", fontsize=13)
    for ang, ponto, (a, dado) in ((30, (80, 300), ("Aluno: ", NOME)), (90, (420, 700), ("CPF: ", CPF))):
        t = a + (dado if com else " " * len(dado))
        p.insert_text(ponto, t, fontsize=14, morph=(pymupdf.Point(*ponto), pymupdf.Matrix(ang)))
    return d


def duas_colunas(com: bool, pasta: Path):
    d = novo()
    p = d[0]
    esq = ["Coluna da esquerda com texto", "corrido de exemplo. O aluno", ("", NOME, " fez"), "a prova no dia marcado."]
    dir_ = ["Coluna da direita, na mesma", "altura. A responsável", ("", NOME2, ""), ("tem CPF ", CPF2, ".")]
    for col, x in ((esq, 60), (dir_, 320)):
        for i, l in enumerate(col):
            trecho(p, x, 120 + i * 18, *(l if isinstance(l, tuple) else (l, "", "")), com, 12)
    return d


def imagem_da_pagina(com: bool, ppp=200):
    """Uma página digitalizada: o texto desenhado numa imagem (sem texto no PDF)."""
    from PIL import Image, ImageDraw, ImageFont
    esc = ppp / 72
    img = Image.new("L", (round(595 * esc), round(842 * esc)), 250)
    g = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONTE, round(14 * esc))
    pos = []
    for i, (a, dado) in enumerate((("Declaração digitalizada (fictícia)", ""), ("Nome: ", NOME), ("CPF: ", CPF))):
        x, y = 60 * esc, (90 + i * 30) * esc
        g.text((x, y), a, fill=20, font=f)
        x2 = x + g.textlength(a, font=f)
        if dado and com:
            g.text((x2, y), dado, fill=20, font=f)
        if dado:
            pos.append((dado, x2 / esc, y / esc, g.textlength(dado, font=f) / esc, 14 * 1.2))
    b = io.BytesIO()
    img.save(b, "PNG")
    return b.getvalue(), pos


def escaneado(com: bool, pasta: Path):
    d = novo()
    png, _ = imagem_da_pagina(com)
    d[0].insert_image(d[0].rect, stream=png)
    return d


def camada_ocr(com: bool, pasta: Path, deslocar: float = 0, ajustar: bool = True):
    """Imagem com uma camada de texto invisível por cima (como o OCR das impressoras faz). Com ajustar, cada linha
    invisível é esticada até a largura das letras da imagem, como fazem os programas de OCR; sem ajustar, ela fica
    com a largura da fonte dela. Com deslocar, a camada fica abaixo das letras da imagem, como num OCR malfeito."""
    d = escaneado(com, pasta)
    _, pos = imagem_da_pagina(True)
    p = d[0]
    linhas_ocr = [("Declaração digitalizada (fictícia)", 90)] + [(("Nome: " if dado == NOME else "CPF: ") + dado, y)
                                                                for dado, x, y, w, h in pos]
    for texto, y in linhas_ocr:
        ponto = pymupdf.Point(60, y + 14 * 0.95 + deslocar)
        escala = largura_na_imagem(texto) / largura(texto, 14) if ajustar else 1
        p.insert_text(ponto, texto, fontsize=14, render_mode=3, morph=(ponto, pymupdf.Matrix(escala, 1)))
    return d


def largura_na_imagem(texto: str) -> float:
    from PIL import ImageFont
    return ImageFont.truetype(FONTE, round(14 * 200 / 72)).getlength(texto) / (200 / 72)


def camada_ocr_largura(com: bool, pasta: Path):
    return camada_ocr(com, pasta, ajustar=False)


def camada_ocr_deslocada(com: bool, pasta: Path):
    return camada_ocr(com, pasta, deslocar=6)


CODIGO = "SIGILOCODIGO"


def cartao_ocr(com: bool, dado: str, cinza: int = 20, deslocar: float = 0, fator: float = 1, depois: str = ""):
    """Os cenários da revisão do Codex na 1.2.3-rc.1 (Ordem 24): um cartão digitalizado (imagem a 216 ppp, letra de
    largura fixa) com o dado em cima e uma linha pública embaixo, e a camada de texto invisível só do dado. cinza é a
    cor das letras do dado na imagem (168: cinza-claro); deslocar, quantos pontos a camada fica abaixo das letras;
    fator, a largura da camada sobre a largura das letras (0,72: camada estreita); depois, letras públicas coladas
    logo depois do dado, que não estão na camada (a vizinha que a tarja não pode apagar sem avisar)."""
    from PIL import Image, ImageDraw, ImageFont
    mono = str(Path(FONTE).with_name("DejaVuSansMono.ttf"))
    esc = 3
    img = Image.new("L", (330 * esc, 185 * esc), 250)
    g = ImageDraw.Draw(img)
    f = ImageFont.truetype(mono, 18 * esc)
    x, y = 60 * esc, 72 * esc
    if com:
        g.text((x, y), dado, fill=cinza, font=f)
    if depois:
        g.text((x + g.textlength(dado, font=f), y), depois, fill=20, font=f)
    g.text((x, 135 * esc), "CONTROLE PUBLICO", fill=20, font=ImageFont.truetype(mono, 12 * esc))
    b = io.BytesIO()
    img.save(b, "PNG")
    d = pymupdf.open()
    p = d.new_page(width=330, height=185)
    p.insert_image(p.rect, stream=b.getvalue())
    ponto = pymupdf.Point(60, 72 + f.getbbox("S")[3] / esc + deslocar)
    escala = fator * (g.textlength(dado, font=f) / esc) / pymupdf.get_text_length(dado, fontname="cour", fontsize=18)
    p.insert_text(ponto, dado, fontsize=18, fontname="cour", render_mode=3, morph=(ponto, pymupdf.Matrix(escala, 1)))
    return d


def ocr_cinza_claro(com: bool, pasta: Path):
    return cartao_ocr(com, CODIGO, cinza=168, deslocar=5, fator=0.72)


def ocr_longe(com: bool, pasta: Path):
    return cartao_ocr(com, CODIGO, deslocar=32)


def ocr_vizinho_colado(com: bool, pasta: Path):
    return cartao_ocr(com, "SIGILO", depois="X")


def formulario(com: bool, pasta: Path):
    d = novo()
    p = d[0]
    p.insert_text((60, 90), "Formulário fictício", fontsize=14)
    for i, (rotulo, valor, escondido) in enumerate((("Nome", NOME, False), ("CPF", CPF, False), ("Observação interna", NOME2, True))):
        y = 130 + i * 40
        p.insert_text((60, y + 14), rotulo + ":", fontsize=12)
        w = pymupdf.Widget()
        w.field_type = pymupdf.PDF_WIDGET_TYPE_TEXT
        w.field_name = f"campo{i}"
        w.rect = pymupdf.Rect(200, y, 450, y + 20)
        w.field_value = valor if com else ""
        w.text_fontsize = 12
        if escondido:
            w.field_flags = 0
            w.field_display = pymupdf.PDF_WIDGET_DISPLAY_HIDDEN if hasattr(pymupdf, "PDF_WIDGET_DISPLAY_HIDDEN") else 1
        p.add_widget(w)
    return d


def anotacoes(com: bool, pasta: Path):
    d = novo()
    p = d[0]
    p.insert_text((60, 90), "Documento com comentários (fictício)", fontsize=14)
    p.insert_text((60, 130), "Parecer sobre o caso do aluno.", fontsize=12)
    # caixa de texto anotada, que aparece na página (e é impressa)
    a = p.add_freetext_annot(pymupdf.Rect(60, 160, 360, 190), "Aluno: " + (NOME if com else ""), fontsize=12)
    a.set_flags(pymupdf.PDF_ANNOT_IS_PRINT)
    a.update()
    # nota adesiva: só o ícone aparece; o texto fica guardado no PDF
    n = p.add_text_annot((400, 130), ("CPF do aluno: " + CPF + ", conferir com " + NOME2) if com else "conferir")
    n.set_info(title=NOME2 if com else "secretaria")
    n.update()
    # marca-texto com comentário
    h = p.add_highlight_annot(pymupdf.Rect(60, 118, 250, 134))
    h.set_info(content=("Comentário: falar com " + NOME2) if com else "Comentário")
    h.update()
    return d


def metadados_anexos(com: bool, pasta: Path):
    d = novo()
    p = d[0]
    p.insert_text((60, 90), "Ficha com metadados e anexos (fictícia)", fontsize=14)
    linhas(p, [("CPF: ", CPF, "")], com, y=130)
    # o ícone do anexo aparece na página nos dois; só o conteúdo dele (e os metadados) muda
    p.add_file_annot((500, 120), (f"Laudo de {NOME2}" if com else "Laudo").encode("utf-8"), "laudo.txt")
    if com:
        d.set_metadata({"title": "Ficha de " + NOME, "author": NOME2, "subject": "CPF " + CPF2, "keywords": MATRICULA,
                        "creator": "Gerador de teste", "producer": "Gerador de teste"})
        d.set_xml_metadata(f'<x:xmpmeta xmlns:x="ado' f'be:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
                           f'<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>{NOME2}</dc:creator>'
                           f'<dc:description>matricula {MATRICULA}</dc:description></rdf:Description></rdf:RDF></x:xmpmeta>')
        d.embfile_add("boletim.txt", f"Boletim de {NOME}\nCPF {CPF2}\n".encode("utf-8"), filename="boletim.txt")
    return d


def incremental(com: bool, pasta: Path):
    """Versão 1 com o nome de um aluno; versão 2 (atualização incremental) troca o texto. A versão 1 continua
    guardada dentro do arquivo. A versão 2 tem outro dado para tarjar."""
    base = pasta / ("v1-com.pdf" if com else "v1-sem.pdf")
    d = novo()
    d[0].insert_text((60, 100), "Versão 1: aluno " + NOME + ", CPF " + CPF, fontsize=13)
    salvar(d, base)
    d = pymupdf.open(base)
    p = d[0]
    p.add_redact_annot(pymupdf.Rect(0, 0, 595, 842))
    p.apply_redactions()   # na versão 2, a página fica sem o texto da versão 1 (o objeto antigo fica no arquivo)
    p.insert_text((60, 100), "Versão 2: responsável " + (NOME2 if com else " " * len(NOME2)), fontsize=13)
    return d, base


def texto_claro_miudo(com: bool, pasta: Path):
    d = novo()
    p = d[0]
    p.insert_text((60, 90), "Texto quase invisível e texto miúdo (fictício)", fontsize=13)
    linhas(p, [("CPF claro: ", CPF, "")], com, y=130, color=(0.93, 0.93, 0.93))
    linhas(p, [("nome miúdo: ", NOME, "")], com, y=170, tam=3)
    return d


CASOS = {
    "texto-simples": (texto_simples, {"termos": [NOME, MATRICULA], "segredos": [NOME, CPF, MATRICULA, EMAIL]}),
    "fonte-subconjunto": (fonte_subconjunto, {"termos": [NOME2], "segredos": [NOME2, CPF2]}),
    "fonte-sem-tounicode": (fonte_sem_tounicode, {"termos": [NOME2], "segredos": [NOME2, CPF2]}),
    "texto-girado": (texto_girado, {"termos": [NOME], "segredos": [NOME, CPF]}),
    "duas-colunas": (duas_colunas, {"termos": [NOME, NOME2], "segredos": [NOME, NOME2, CPF2]}),
    "escaneado": (escaneado, {"termos": [NOME], "segredos": [NOME, CPF], "html": "ocr"}),
    "camada-ocr": (camada_ocr, {"termos": [NOME], "segredos": [NOME, CPF]}),
    "camada-ocr-largura": (camada_ocr_largura, {"termos": [NOME], "segredos": [NOME, CPF]}),
    "camada-ocr-deslocada": (camada_ocr_deslocada, {"termos": [NOME], "segredos": [NOME, CPF]}),
    "formulario": (formulario, {"termos": [NOME, NOME2], "segredos": [NOME, CPF, NOME2]}),
    "anotacoes": (anotacoes, {"termos": [NOME, NOME2], "segredos": [NOME, CPF, NOME2]}),
    "metadados-anexos": (metadados_anexos, {"termos": [], "segredos": [CPF, NOME, NOME2, CPF2, MATRICULA]}),
    "incremental": (incremental, {"termos": [NOME2], "segredos": [NOME2, NOME, CPF]}),
    "texto-claro-miudo": (texto_claro_miudo, {"termos": [NOME], "segredos": [NOME, CPF]}),
    "ocr-cinza-claro": (ocr_cinza_claro, {"termos": [CODIGO], "segredos": [CODIGO]}),
    "ocr-longe": (ocr_longe, {"termos": [CODIGO], "segredos": [CODIGO]}),
    "ocr-vizinho-colado": (ocr_vizinho_colado, {"termos": ["SIGILO"], "segredos": ["SIGILO"]}),
}
# casos com camada de texto invisível sobre a imagem: toda sugestão deles tem de sair com "confira" na lista
CONFIRA = {"camada-ocr", "camada-ocr-largura", "camada-ocr-deslocada", "ocr-cinza-claro", "ocr-longe",
           "ocr-vizinho-colado"}


def main() -> int:
    saida = Path(sys.argv[1])
    for nome, (fazer, info) in CASOS.items():
        pasta = saida / nome
        pasta.mkdir(parents=True, exist_ok=True)
        for com, arq in ((True, "original.pdf"), (False, "sem-dados.pdf")):
            r = fazer(com, pasta)
            if isinstance(r, tuple):   # incremental: grava só a mudança no fim da versão 1
                d, base = r
                d.save(base, incremental=True, encryption=pymupdf.PDF_ENCRYPT_KEEP)
                d.close()
                base.replace(pasta / arq)
            else:
                salvar(r, pasta / arq)
        info = {"html": "normal", "tarjas": [[round(v, 1) for v in c] for c in CAIXAS.get(nome, [])],
                "confira": nome in CONFIRA, **info}
        (pasta / "caso.json").write_text(json.dumps(info, ensure_ascii=False, indent=1),
                                         encoding="utf-8")
        print(nome)
    return 0


if __name__ == "__main__":
    sys.exit(main())
