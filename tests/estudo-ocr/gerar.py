# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
"""Estudo do OCR do @ (docs/ESTUDO-OCR-EMAIL.md), passo 1: gera as páginas digitalizadas fictícias.

Cada página A4 tem 20 linhas: 10 com um e-mail inventado e 10 com textos comuns de documento (os contraexemplos,
que a regra nova não pode transformar em e-mail). Todos os dados são inventados. As páginas variam em fonte,
tamanho, resolução da digitalização e estado (limpa, ou com ruído e inclinação leve).

Há dois desenhos. "pil": a página é desenhada aqui, com o Pillow, e gravada em JPEG em files/estudo-ocr/paginas/
(fora do Git; sai igual de novo com a mesma semente). "navegador": só a lista das linhas; ler.mjs desenha a página
no canvas do Chromium, como faz tests/e2e_ocr.mjs (o caso do defeito 3 de docs/LINUX.md), só limpa e sem as
fontes Type 1, que o Chromium não usa. As listas vão para tests/estudo-ocr/paginas.csv e tests/estudo-ocr/linhas.csv.

Uso: python3 tests/estudo-ocr/gerar.py
"""

import csv
import random
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
SAIDA = RAIZ / "files" / "estudo-ocr" / "paginas"
SEMENTE = 20261030

# família, tipo (serifa, sem serifa ou mono)
FONTES = [
    ("DejaVu Sans", "sem serifa"), ("DejaVu Serif", "serifa"), ("DejaVu Sans Mono", "mono"),
    ("Liberation Sans", "sem serifa"), ("Liberation Serif", "serifa"), ("Liberation Mono", "mono"),
    ("FreeSans", "sem serifa"), ("FreeSerif", "serifa"), ("FreeMono", "mono"),
    ("Noto Sans", "sem serifa"), ("Noto Serif", "serifa"), ("Noto Sans Mono", "mono"),
    ("Carlito", "sem serifa"), ("Caladea", "serifa"), ("Roboto", "sem serifa"), ("Open Sans", "sem serifa"),
    ("Ubuntu", "sem serifa"), ("Ubuntu Mono", "mono"), ("Inter", "sem serifa"), ("JetBrains Mono", "mono"),
    ("Courier 10 Pitch", "mono"), ("Bitstream Charter", "serifa"),
]
TAMANHOS = [8, 10, 12, 14, 16]          # pontos
DPIS = [150, 200, 300]
ESTADOS = ["limpa", "ruido"]            # ruído também leva inclinação leve e JPEG mais forte
TYPE1 = {"Courier 10 Pitch", "Bitstream Charter"}  # o Chromium não desenha fontes Type 1

# partes inventadas dos e-mails: com e sem ponto, hífen e números
LOCAIS = [
    "fulano", "ciclano", "beltrana", "secretaria",                              # simples
    "fulano.teste", "ciclano.silva", "fulana.de.tal", "ana.b.lima",              # com ponto
    "beltrana-souza", "coord-ti", "joao-p.teste", "maria-clara",                 # com hífen
    "teste2026", "aluno123", "maria.teste3", "turma-2b",                         # com números
]
DOMINIOS = [
    "exemplo.com.br", "teste.com.br",
    "exemplo.gov.br", "orgao-teste.gov.br",
    "exemplo.edu.br", "campus.exemplo.edu.br",
    "exemplo.test", "mail2.exemplo.test",
]
MOLDES_EMAIL = [
    "E-mail: {}", "Contato: {}", "Envie para {} até sexta.", "{}", "Correio eletrônico {} (institucional)",
    "Responsável: Fulano de Teste, {}", "e-mail {}", "Dúvidas: {}; telefone (00) 91234-5678",
]
# textos comuns de documento que a regra NÃO pode transformar em e-mail (dados fictícios)
CONTRA = [
    "CPF: 831.975.872-60", "CPF 514.334.988-55, RG 12.345.678-9", "Data: 30/10/2026", "Fortaleza, 12 de março de 2025",
    "Nome: Fulano de Teste", "Endereço: QD 05 Lote 12, Setor Teste", "Quadra QD 12 Conjunto B, casa 4",
    "SQS 308 Bloco WO, apto. 101", "Modelo WO-2024 em teste", "Q&A do edital 3/2026", "P&D e inovação no campus",
    "Silva & Souza Ltda.", "Ofício nº 12/2026-QD", "Processo 23000.000000/2026-00", "Acesse www.exemplo.gov.br",
    "Site: exemplo.edu.br/edital", "Arquivo relatorio.final.pdf", "Q.E. 32 Conjunto Q, casa 7",
    "Turma Q1 e Q2 do curso", "Rua QD Dez, 100, Bairro Teste", "Lei nº 13.709/2018 (LGPD)", "R$ 1.234,56 pagos em 05/11/2026",
    "art. 5º, § 2º, da Resolução 7/2026", "WO 1234 Ordem de serviço", "Pesquisa & Extensão: exemplo.edu.br",
    "Veja G&Q em exemplo.test", "Matrícula 2026.1.0042", "CEP 00010-000, Fortaleza", "Bloco Q, sala 12.3",
    "AT&T e Q&A são siglas", "Consulte exemplo.gov.br ou exemplo.edu.br", "Assinado: Fulano de Teste QD",
    "Item QD.3.2 do anexo", "Telefone (00) 91234-5678", "Campus Q@ exemplo", "Versão 1.2.1 de 30/10/2026",
]

# as linhas da página de tests/e2e_ocr.mjs
E2E_OCR = ["Declaração de exemplo (página digitalizada)", "Nome: Fulano de Teste", "CPF: 831.975.872-60",
           "E-mail: fulano.teste@exemplo.test", "Telefone: (00) 91234-5678 (recado)"]


def arquivo_da_fonte(familia):
    saida = subprocess.run(["fc-match", "-f", "%{family[0]}|%{file}", f"{familia}:style=Regular"],
                           capture_output=True, text=True, check=True).stdout
    achada, arquivo = saida.split("|", 1)
    if achada != familia:
        raise SystemExit(f"fonte {familia!r} não instalada (o fc-match deu {achada!r})")
    return arquivo


def caracteristicas(email):
    local, dominio = email.split("@")
    tld = next(t for t in (".com.br", ".gov.br", ".edu.br", ".test") if dominio.endswith(t))
    return {"ponto": int("." in local), "hifen": int("-" in local or "-" in dominio),
            "numero": int(any(c.isdigit() for c in email)), "final": tld}


def desenhar(linhas, fonte, tamanho, dpi, estado, rnd):
    larg, alt = round(8.27 * dpi), round(11.69 * dpi)          # A4
    img = Image.new("L", (larg, alt), 255)
    d = ImageDraw.Draw(img)
    px = round(tamanho * dpi / 72)
    f = ImageFont.truetype(fonte, px)
    entrelinha = tamanho * 1.9
    posicoes = []
    for i, texto in enumerate(linhas):
        base_pt = 90 + i * entrelinha                          # linha de base, em pontos do PDF
        x_pt = 72
        d.text((x_pt * dpi / 72, base_pt * dpi / 72), texto, font=f, fill=17, anchor="ls")
        posicoes.append((x_pt, base_pt))
    angulo = 0.0
    if estado == "ruido":
        angulo = rnd.choice([-1, 1]) * rnd.uniform(0.3, 1.5)
        img = img.filter(ImageFilter.GaussianBlur(0.6 * dpi / 200))
        img = img.rotate(angulo, resample=Image.BICUBIC, fillcolor=255)
        # ruído do sensor e pontos soltos (sujeira do vidro), com a mesma semente
        a = np.asarray(img, dtype=np.float32)
        gerador = np.random.default_rng(rnd.randrange(2**32))
        a = a + gerador.normal(0, 12, a.shape)
        sujeira = gerador.random(a.shape)
        a[sujeira < 0.0004] = 30
        a[sujeira > 0.9996] = 255
        img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return img, posicoes, angulo


def main():
    rnd = random.Random(SEMENTE)
    SAIDA.mkdir(parents=True, exist_ok=True)
    arquivos = {fam: arquivo_da_fonte(fam) for fam, _ in FONTES}
    paginas, linhas_csv = [], []
    n = 0
    combinacoes = [("pil", fam, tipo, tam, dpi, est) for fam, tipo in FONTES for tam in TAMANHOS for dpi in DPIS for est in ESTADOS]
    combinacoes += [("navegador", fam, tipo, tam, dpi, "limpa") for fam, tipo in FONTES if fam not in TYPE1
                    for tam in TAMANHOS for dpi in DPIS]
    for desenho, fam, tipo, tamanho, dpi, estado in combinacoes:
        pid = f"{'p' if desenho == 'pil' else 'n'}{n:04d}"
        textos = []
        for k in range(10):
            j = n * 10 + k
            email = f"{LOCAIS[j % len(LOCAIS)]}@{DOMINIOS[(j // len(LOCAIS) + j) % len(DOMINIOS)]}"
            molde = MOLDES_EMAIL[(j * 7 + n) % len(MOLDES_EMAIL)]
            textos.append(("email", email, molde.format(email)))
            contra = CONTRA[(n * 10 + k * 3) % len(CONTRA)]
            textos.append(("contra", "", contra))
        entrelinha = tamanho * 1.9
        posicoes = [(72, 90 + i * entrelinha) for i in range(len(textos))]
        angulo = 0.0
        larg, alt = round(8.27 * dpi), round(11.69 * dpi)
        if desenho == "pil":
            img, posicoes, angulo = desenhar([t for _, _, t in textos], arquivos[fam], tamanho, dpi, estado, rnd)
            img.save(SAIDA / f"{pid}.jpg", quality=95 if estado == "limpa" else 70)
            larg, alt = img.width, img.height
        paginas.append({"pagina": pid, "desenho": desenho, "fonte": fam, "tipo_fonte": tipo, "tamanho_pt": tamanho,
                        "dpi": dpi, "estado": estado, "angulo_graus": f"{angulo:.3f}", "largura_px": larg, "altura_px": alt})
        for i, ((tipo_l, email, texto), (x, base)) in enumerate(zip(textos, posicoes)):
            c = caracteristicas(email) if email else {"ponto": "", "hifen": "", "numero": "", "final": ""}
            linhas_csv.append({"pagina": pid, "linha": i, "tipo": tipo_l, "email": email, "texto": texto,
                               "x_pt": x, "base_pt": f"{base:.2f}", **c})
        n += 1
    # reprodução do defeito 3 de docs/LINUX.md: a página de tests/e2e_ocr.mjs (36 px a 150 ppp, x = 150 px, linhas
    # a 220 + 90·i px), nas seis fontes da tabela de lá
    for fam in ["Liberation Sans", "DejaVu Sans", "FreeSans", "Carlito", "Caladea", "DejaVu Serif"]:
        pid = f"r{n:04d}"
        paginas.append({"pagina": pid, "desenho": "reproducao", "fonte": fam, "tipo_fonte": dict(FONTES)[fam],
                        "tamanho_pt": 36 * 72 / 150, "dpi": 150, "estado": "limpa", "angulo_graus": "0.000",
                        "largura_px": 1240, "altura_px": 1754})
        for i, texto in enumerate(E2E_OCR):
            email = "fulano.teste@exemplo.test" if "@" in texto else ""
            c = caracteristicas(email) if email else {"ponto": "", "hifen": "", "numero": "", "final": ""}
            linhas_csv.append({"pagina": pid, "linha": i, "tipo": "email" if email else "contra", "email": email,
                               "texto": texto, "x_pt": 72, "base_pt": f"{(220 + i * 90) * 72 / 150:.2f}", **c})
        n += 1
    with open(AQUI / "paginas.csv", "w", newline="", encoding="utf-8") as s:
        w = csv.DictWriter(s, fieldnames=list(paginas[0]))
        w.writeheader()
        w.writerows(paginas)
    with open(AQUI / "linhas.csv", "w", newline="", encoding="utf-8") as s:
        w = csv.DictWriter(s, fieldnames=list(linhas_csv[0]))
        w.writeheader()
        w.writerows(linhas_csv)
    print(f"{len(paginas)} páginas, {sum(1 for l in linhas_csv if l['tipo'] == 'email')} e-mails, em {SAIDA}")


if __name__ == "__main__":
    main()
