# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
"""Gera a página digitalizada de teste dos e-mails no OCR (docs/PROPOSTA-OCR-EMAIL.md).

ocr-email.pdf: uma página A4 só com imagem (200 ppp, a resolução do OCR do programa, para não haver reamostragem),
com e-mails em fontes livres em que o OCR lê o @ de jeitos diferentes ("&", "(D", "G&"...) e, entre eles, textos
comuns de documento que não podem virar e-mail. A imagem é fixa: a leitura não depende das fontes do computador
que roda o teste.
ocr-email-dados.pdf: a mesma página só com os e-mails, no mesmo lugar (a máscara: todo pixel escuro dela tem que
sair preto no PDF tarjado).
ocr-email.json: os e-mails da página e a quantidade que a procura deve sugerir.

Precisa do Pillow e das fontes (no Ubuntu: fonts-dejavu-core, fonts-liberation, fonts-crosextra-caladea,
fonts-freefont-ttf). Todos os dados são inventados; os e-mails usam o domínio .test.
Uso: python3 tests/fixtures/gerar_ocr_email.py
"""

import io
import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PASTA = Path(__file__).resolve().parent
DPI = 200

# [fonte, tamanho em pt, texto antes, e-mail (vazio: linha comum), texto depois]
LINHAS = [
    ["Caladea", 14, "E-mail: ", "fulano.teste@exemplo.test", ""],
    ["DejaVu Sans", 12, "Endereço: QD 05 Lote 12, Bloco WO, apto. 101", "", ""],
    ["DejaVu Serif", 12, "Contato: ", "ciclano.silva@campus.exemplo.test", ""],
    ["Liberation Serif", 14, "Q&A do edital 3/2026 e P&D no campus (Silva & Souza Ltda.)", "", ""],
    ["Liberation Serif", 14, "Envie para ", "beltrana-souza@exemplo.test", " até sexta."],
    ["Caladea", 12, "Acesse www.exemplo.gov.br ou Portal(exemplo.gov.br), anexo Edital&Anexo.pdf", "", ""],
    ["Liberation Sans", 17, "Responsável: Fulano de Teste, ", "maria.teste3@mail2.exemplo.test", ""],
    ["FreeSans", 12, "CPF: 831.975.872-60, Data: 30/10/2026, ARQUITETURA.md", "", ""],
    ["Caladea", 16, "Dúvidas: ", "secretaria@orgao-teste.test", ""],
]


def arquivo_da_fonte(familia):
    saida = subprocess.run(["fc-match", "-f", "%{family[0]}|%{file}", f"{familia}:style=Regular"],
                           capture_output=True, text=True, check=True).stdout
    achada, arquivo = saida.split("|", 1)
    if achada != familia:
        raise SystemExit(f"fonte {familia!r} não instalada (o fc-match deu {achada!r})")
    return arquivo


def desenhar(so_dados):
    img = Image.new("L", (round(8.27 * DPI), round(11.69 * DPI)), 255)
    d = ImageDraw.Draw(img)
    y = 1.2 * DPI
    for familia, tamanho, antes, email, depois in LINHAS:
        f = ImageFont.truetype(arquivo_da_fonte(familia), round(tamanho * DPI / 72))
        x = DPI
        for texto, e_dado in ((antes, False), (email, True), (depois, False)):
            if not texto:
                continue
            if e_dado or not so_dados:
                d.text((x, y), texto, font=f, fill=17, anchor="ls")
            x += d.textlength(texto, font=f)
        y += tamanho * 2.4 * DPI / 72
    return img


def main():
    for nome, so_dados in (("ocr-email.pdf", False), ("ocr-email-dados.pdf", True)):
        saida = io.BytesIO()
        desenhar(so_dados).save(saida, "PDF", resolution=DPI)
        # data fixa (do mesmo tamanho, para os deslocamentos do arquivo continuarem certos): o PDF sai igual,
        # byte a byte, a cada vez
        dados = re.sub(rb"\(D:\d{14}Z?\)", lambda m: b"(D:20261030000000Z)"[:len(m.group(0)) - 1] + b")", saida.getvalue())
        (PASTA / nome).write_bytes(dados)
    emails = [l[3] for l in LINHAS if l[3]]
    (PASTA / "ocr-email.json").write_text(json.dumps({"emails": emails}, ensure_ascii=False, indent=2) + "\n",
                                          encoding="utf-8")
    print(f"ocr-email.pdf e ocr-email-dados.pdf: {len(LINHAS)} linhas, {len(emails)} e-mails")


if __name__ == "__main__":
    main()
