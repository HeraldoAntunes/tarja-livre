# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
"""Gera o PDF de teste padronizado e o PDF máscara, byte a byte, sem biblioteca nenhuma.

tarja-teste.pdf: documento fictício com os casos difíceis (dado no meio da linha, três fontes, letra espaçada e
apertada, número quebrado em dois pedaços, kerning, origem da página deslocada, página girada, texto na vertical,
campo de formulário, comentário escondido, texto invisível, metadados com nome, JavaScript ao abrir).
tarja-teste-dados.pdf: as mesmas páginas, mas só os dados pessoais aparecem, no mesmo lugar exato (o resto do texto
é escrito invisível, para a posição não mudar). O teste de ponta a ponta exige que todo pixel escuro da máscara
esteja preto no PDF salvo. tarja-teste.json: o que a procura deve achar.

Todos os dados são inventados para o teste; os CPF e CNPJ têm dígito verificador válido para a procura achar.
Uso: python tests/fixtures/gerar_pdf_teste.py
"""

import json
from pathlib import Path

PASTA = Path(__file__).resolve().parent


def cpf(base9: str) -> str:
    d = [int(c) for c in base9]
    for n in (9, 10):
        soma = sum(d[i] * (n + 1 - i) for i in range(n))
        d.append((soma * 10 % 11) % 10)
    s = "".join(map(str, d))
    return f"{s[:3]}.{s[3:6]}.{s[6:9]}-{s[9:]}"


CPF_A = cpf("831975872")      # 831.975.872-60
CPF_B = cpf("514334988")
CPF_C = cpf("833311475")
CNPJ = "19.808.456/0001-00"


def esc(t: str) -> bytes:
    b = t.encode("cp1252")
    return b.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


# Uma linha: (fonte, tamanho, x, y, segmentos, extras). Segmento: (texto, é_dado). extras: Tc, Tz, matriz, kerning.
# Na página normal a linha sai inteira num Tj só (o caso comum: o dado no meio de um pedaço de texto).
def linha(fonte, tam, x, y, segs, tc=0, tz=100, matriz=None, invisivel=False):
    return {"fonte": fonte, "tam": tam, "x": x, "y": y, "segs": segs, "tc": tc, "tz": tz, "matriz": matriz,
            "invisivel": invisivel}


def texto_linha(L, mascara: bool) -> bytes:
    pos = L["matriz"] or [1, 0, 0, 1, L["x"], L["y"]]
    out = [b"BT", f"/{L['fonte']} {L['tam']} Tf".encode(), f"{L['tc']} Tc {L['tz']} Tz".encode(),
           (" ".join(str(v) for v in pos) + " Tm").encode()]
    segs = L["segs"]
    if L.get("kern"):
        # TJ com ajuste entre pedaços: a mesma lista na página e na máscara
        if mascara:
            for item in L["kern"]:
                if isinstance(item, tuple):
                    out.append(b"%d Tr [(" % (0 if item[1] else 3) + esc(item[0]) + b")] TJ")
                else:
                    out.append(b"3 Tr [() %d] TJ" % item)
        else:
            partes = [b"(" + esc(i[0]) + b")" if isinstance(i, tuple) else str(i).encode() for i in L["kern"]]
            out.append(b"[" + b" ".join(partes) + b"] TJ")
    elif mascara:
        for t, dado in segs:
            out.append(b"%d Tr (" % (0 if dado and not L["invisivel"] else 3) + esc(t) + b") Tj")
    else:
        out.append(b"%d Tr (" % (3 if L["invisivel"] else 0) + esc("".join(t for t, _ in segs)) + b") Tj")
    out.append(b"ET")
    return b"\n".join(out)


def pedacos(L, mascara: bool) -> bytes:
    """Linha escrita em vários Tj seguidos, como fazem muitos programas (o número fica partido em dois itens)."""
    out = [b"BT", f"/{L['fonte']} {L['tam']} Tf".encode(), f"1 0 0 1 {L['x']} {L['y']} Tm".encode()]
    for t, dado in L["segs"]:
        modo = (0 if dado else 3) if mascara else 0
        out.append(b"%d Tr (" % modo + esc(t) + b") Tj")
    out.append(b"ET")
    return b"\n".join(out)


def desenho() -> bytes:
    return b"q 0.75 0.85 1 rg 120 300 300 180 re f 0 0.4 0.2 RG 3 w 140 320 m 400 460 l S Q"


PAGINAS = [
    {   # 1: A4, três fontes, o dado no meio da linha
        "caixa": [0, 0, 595, 842],
        "linhas": [
            linha("F1", 16, 60, 780, [("Declaração de exemplo (dados fictícios)", False)]),
            linha("F1", 12, 60, 740, [("Nome: ", False), ("Fulano de Teste", True)]),
            linha("F1", 12, 60, 715, [("CPF: ", False), (CPF_A, True), (" (titular)", False)]),
            linha("F1", 12, 60, 690, [("E-mail: ", False), ("fulano.teste@exemplo.test", True), (" ou telefone ", False),
                                      ("(00) 91234-5678", True)]),
            linha("F2", 11, 60, 665, [("CNPJ da empresa: ", False), (CNPJ, True)]),
            linha("F3", 12, 60, 640, [("Endereço com CEP ", False), ("00012-345", True), (" e RG ", False),
                                      ("00.000.123-4", True), (" SSP", False)]),
            linha("F1", 12, 60, 590, [("Fone apertado: ", False), ("(00) 3123-4567", True)], tz=70),
            linha("F1", 11, 60, 565, [("E-mail espaçado: ", False), ("ana.exemplo@escola.test", True)], tc=1.2),
            linha("F1", 12, 60, 515, [("Protocolo 123.456.789-00 (não é CPF)", False)]),
            linha("F3", 13, 60, 490, [("Linha em Times com CPF ", False), (CPF_C, True), (" no fim", False)]),
            # nomes da lista de termos do usuário: um quebrado em duas linhas, e "Ana" ao lado de "banana"
            linha("F1", 12, 60, 440, [("Documento assinado por ", False), ("Beltrana de", True)]),
            linha("F1", 12, 60, 424, [("Exemplo Teste", True), (", servidora.", False)]),
            linha("F1", 12, 60, 400, [("A banana é de ", False), ("Ana", True), (".", False)]),
        ],
        "pedacos": [linha("F1", 12, 60, 540, [("CPF partido: ", False), (CPF_B[:7], True), (CPF_B[7:], True)])],
        "kern": [linha("F1", 12, 60, 465, [])],
    },
    {   # 2: carta deitada
        "caixa": [0, 0, 792, 612],
        "linhas": [linha("F1", 14, 72, 520, [("Contato: ", False), ("(00) 91234-5678", True), (" e ", False),
                                              ("joana.exemplo@exemplo.test", True)])],
    },
    {   # 3: origem da página deslocada (MediaBox não começa em zero)
        "caixa": [100, 100, 695, 942],
        "linhas": [linha("F1", 12, 160, 860, [("Página com origem deslocada, CPF ", False), (CPF_A, True)])],
    },
    {   # 4: página girada 90 graus pelo /Rotate
        "caixa": [0, 0, 595, 842], "girar": 90,
        "linhas": [linha("F1", 12, 60, 780, [("E-mail na página girada: ", False), ("beltrano@exemplo.test", True)])],
    },
    {   # 5: texto escrito na vertical, numa página normal
        "caixa": [0, 0, 595, 842],
        "linhas": [linha("F1", 12, 0, 0, [("CPF na vertical ", False), (CPF_A, True)], matriz=[0, 1, -1, 0, 300, 200])],
    },
    {   # 6: campo de formulário com CPF, comentário escondido, texto invisível
        "caixa": [0, 0, 595, 842], "campo": True,
        "linhas": [linha("F1", 12, 72, 700, [("CPF no campo abaixo (formulário):", False)]),
                   linha("F1", 12, 72, 500, [("CPF invisível ", False), (CPF_A, True)], invisivel=True)],
    },
    {   # 7: sem texto (como um documento digitalizado)
        "caixa": [0, 0, 595, 842], "desenho": True, "linhas": [],
    },
    {   # 8: /UserUnit 2 (cada unidade vale dois pontos): a página tem o tamanho de uma A4, com a caixa pela metade
        "caixa": [0, 0, 298, 421], "unidade": 2,
        "linhas": [linha("F1", 8, 30, 380, [("CPF em UserUnit ", False), (CPF_A, True)])],
    },
]
# kerning: "RG nº " e o número com ajustes entre os pedaços
PAGINAS[0]["kern"][0]["kern"] = [("RG nº ", False), -250, ("000000012", True), 40, ("3456", True)]

TERMOS = ["Fulano de Teste", "Beltrana de Exemplo Teste", "Ana"]
ESPERADO = {"termo": 4, "cpf": 8, "email": 4, "telefone": 3, "cnpj": 1, "cep": 1, "rg": 2}

CAMPO_RECT = [72, 640, 300, 668]


def montar_pdf(mascara: bool) -> bytes:
    objs: list[bytes] = []

    def novo(corpo: bytes) -> int:
        objs.append(corpo)
        return len(objs)

    def fluxo(dados: bytes, extra: bytes = b"") -> bytes:
        return b"<< /Length %d %s>>\nstream\n" % (len(dados), extra) + dados + b"\nendstream"

    fontes = {nome: novo(b"<< /Type /Font /Subtype /Type1 /BaseFont /%s /Encoding /WinAnsiEncoding >>" % base)
              for nome, base in (("F1", b"Helvetica"), ("F2", b"Courier"), ("F3", b"Times-Roman"))}
    recursos = b"<< /Font << " + b" ".join(b"/%s %d 0 R" % (n.encode(), i) for n, i in fontes.items()) + b" >> >>"
    paginas_ref = len(objs) + 1
    novo(b"")  # lugar do /Pages, preenchido no fim
    kids = []
    campos = []
    for P in PAGINAS:
        partes = [texto_linha(L, mascara) for L in P["linhas"]]
        partes += [pedacos(L, mascara) for L in P.get("pedacos", [])]
        partes += [texto_linha(L, mascara) for L in P.get("kern", [])]
        if P.get("desenho") and not mascara:
            partes.append(desenho())
        conteudo = novo(fluxo(b"\n".join(partes)))
        anots = []
        if P.get("campo"):
            w = CAMPO_RECT[2] - CAMPO_RECT[0]
            h = CAMPO_RECT[3] - CAMPO_RECT[1]
            ap_dados = b"/Tx BMC q BT /F1 12 Tf 0 g 4 9 Td (" + esc(CPF_A) + b") Tj ET Q EMC"
            ap = novo(fluxo(ap_dados, b"/Type /XObject /Subtype /Form /BBox [0 0 %d %d] /Resources %s " % (w, h, recursos)))
            campo = novo(b"<< /Type /Annot /Subtype /Widget /FT /Tx /T (cpf_titular) /V (" + esc(CPF_A) +
                         b") /DA (/F1 12 Tf 0 g) /F 4 /Rect [%d %d %d %d] /AP << /N %d 0 R >> >>" % (*CAMPO_RECT, ap))
            campos.append(campo)
            anots.append(campo)
            # comentário sem aparência: não aparece na página, e não pode ir para o PDF salvo
            anots.append(novo(b"<< /Type /Annot /Subtype /Text /Rect [400 700 420 720] /F 4 /Open false "
                              b"/Contents (comentario escondido: segredo.comentario@exemplo.test) >>"))
        girar = b" /Rotate %d" % P["girar"] if P.get("girar") else b""
        girar += b" /UserUnit %d" % P["unidade"] if P.get("unidade") else b""
        anot =b" /Annots [" + b" ".join(b"%d 0 R" % a for a in anots) + b"]" if anots else b""
        kids.append(novo(b"<< /Type /Page /Parent %d 0 R /MediaBox [%d %d %d %d] /Resources %s /Contents %d 0 R%s%s >>"
                         % (paginas_ref, *P["caixa"], recursos, conteudo, girar, anot)))
    objs[paginas_ref - 1] = b"<< /Type /Pages /Count %d /Kids [%s] >>" % (
        len(kids), b" ".join(b"%d 0 R" % k for k in kids))
    js = novo(b"<< /S /JavaScript /JS (app.alert\\('nao deveria rodar'\\);) >>")
    acro = b" /AcroForm << /Fields [%s] /DA (/F1 12 Tf 0 g) /DR %s >>" % (
        b" ".join(b"%d 0 R" % c for c in campos), recursos) if campos else b""
    catalogo = novo(b"<< /Type /Catalog /Pages %d 0 R /OpenAction %d 0 R%s >>" % (paginas_ref, js, acro))
    info = novo(b"<< /Title (Documento secreto de Fulano de Teste) /Author (Fulano de Teste) "
                b"/Subject (CPF " + esc(CPF_A) + b") /Producer (gerador de teste) >>")

    saida = bytearray(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, corpo in enumerate(objs, 1):
        offsets.append(len(saida))
        saida += b"%d 0 obj\n" % i + corpo + b"\nendobj\n"
    xref = len(saida)
    saida += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for o in offsets:
        saida += b"%010d 00000 n \n" % o
    saida += b"trailer\n<< /Size %d /Root %d 0 R /Info %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objs) + 1, catalogo, info, xref)
    return bytes(saida)


def main() -> None:
    (PASTA / "tarja-teste.pdf").write_bytes(montar_pdf(False))
    (PASTA / "tarja-teste-dados.pdf").write_bytes(montar_pdf(True))
    tamanhos = []
    for P in PAGINAS:
        x0, y0, x1, y1 = P["caixa"]
        w, h = (x1 - x0) * P.get("unidade", 1), (y1 - y0) * P.get("unidade", 1)
        tamanhos.append([h, w] if P.get("girar") in (90, 270) else [w, h])
    esperado = {
        "paginas": len(PAGINAS),
        "tamanhos": tamanhos,
        "sugestoes": ESPERADO,
        "total": sum(ESPERADO.values()),
        # o teste digita esta lista antes de procurar (o "ana" do e-mail espaçado também conta)
        "termos": TERMOS,
        "paginas_sem_texto": [i + 1 for i, P in enumerate(PAGINAS) if not P["linhas"]],
        # nada disto pode aparecer nos bytes do PDF salvo
        "proibidos": [CPF_A, CPF_B, CPF_C, CNPJ, "fulano", "Fulano", "Beltrana", "91234", "joana", "beltrano", "segredo",
                      "00012-345", "nao deveria rodar", "Documento secreto"],
    }
    (PASTA / "tarja-teste.json").write_text(json.dumps(esperado, ensure_ascii=False, indent=2) + "\n",
                                            encoding="utf-8", newline="\n")
    print("tarja-teste.pdf, tarja-teste-dados.pdf e tarja-teste.json gerados em", PASTA.name)


if __name__ == "__main__":
    main()
