# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
"""Tenta recuperar os dados de cada caso (docs/PROVA-TARJA-1.2.2.md) com as ferramentas de sempre, no original.pdf
(controle: as ferramentas têm de achar) e no tarjado.pdf (não podem achar):

  pdftotext        o texto da página (Poppler)
  qpdf --qdf       o arquivo descomprimido, todos os objetos à vista, procurado byte a byte
  mutool extract   imagens, fontes e anexos tirados do arquivo, procurados byte a byte (as imagens, pixel a pixel,
                   ficam com o tarjar.mjs)
  strings          o arquivo cru, em ASCII, UTF-16 (LE e BE)
  versões          cada versão guardada por atualização incremental (o arquivo cortado em cada %%EOF), com pdftotext
                   e byte a byte
  metadados        pdfinfo e o XMP (pdfinfo -meta)
  anexos           pdfdetach: os nomes e o conteúdo de cada anexo

Um dado conta como achado se aparecer qualquer pedaço dele que o identifique (ver pedacos()), sem diferença de
maiúsculas e acentos. Grava resultado-recuperacao.json na pasta dos casos e escreve a tabela em Markdown.
Uso: python3 recuperar.py <pasta dos casos>
"""

import json
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

FERRAMENTAS = ["pdftotext", "qpdf --qdf", "mutool extract", "strings", "versões", "metadados", "anexos"]


def sem_acento(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)).lower()


def pedacos(segredo: str) -> list[str]:
    """O que identifica o dado: ele inteiro, cada palavra com 5 letras ou mais, e os números sem pontuação."""
    p = {sem_acento(segredo)}
    p |= {sem_acento(w) for w in re.findall(r"[^\W\d_]{5,}", segredo) if sem_acento(w) not in ("teste", "ficticia")}
    digitos = re.sub(r"\D", "", segredo)
    if len(digitos) >= 6:
        p |= {digitos, segredo[:7]}
    return sorted(p)


def achar(textos: list[str], segredos: list[str]) -> list[str]:
    juntos = sem_acento("\n".join(textos))
    compacto = re.sub(r"\s+", "", juntos)
    return sorted({s for s in segredos for p in pedacos(s) if p in juntos or p.replace(" ", "") in compacto})


def rodar(*cmd: str) -> str:
    r = subprocess.run(cmd, capture_output=True)
    return r.stdout.decode("utf-8", "replace")


def bytes_como_texto(b: bytes) -> list[str]:
    return [b.decode("latin-1"), b.decode("utf-16-be", "ignore"), b.decode("utf-16-le", "ignore"),
            b[1:].decode("utf-16-be", "ignore")]


def examinar(pdf: Path, segredos: list[str]) -> dict:
    r = {}
    r["pdftotext"] = achar([rodar("pdftotext", "-layout", str(pdf), "-")], segredos)
    with tempfile.TemporaryDirectory() as t:
        t = Path(t)
        subprocess.run(["qpdf", "--qdf", "--object-streams=disable", str(pdf), str(t / "qdf.pdf")], capture_output=True)
        qdf = (t / "qdf.pdf").read_bytes() if (t / "qdf.pdf").exists() else b""
        r["qpdf --qdf"] = achar(bytes_como_texto(qdf), segredos)
        ext = t / "extraidos"
        ext.mkdir()
        subprocess.run(["mutool", "extract", "-a", str(pdf.resolve())], cwd=ext, capture_output=True)
        tirados = [f.read_bytes() for f in ext.iterdir()]
        r["mutool extract"] = achar([x for b in tirados for x in bytes_como_texto(b)], segredos)
        r["mutool extract (arquivos)"] = sorted(f.name for f in ext.iterdir())
        anexos = t / "anexos"
        anexos.mkdir()
        lista = rodar("pdfdetach", "-list", str(pdf))
        subprocess.run(["pdfdetach", "-saveall", "-o", str(anexos), str(pdf)], capture_output=True)
        r["anexos"] = achar([lista] + [x for f in anexos.iterdir() for x in bytes_como_texto(f.read_bytes())], segredos)
        r["anexos (lista)"] = lista.strip()
    cru = pdf.read_bytes()
    r["strings"] = achar([rodar("strings", "-a", "-n", "4", str(pdf)), rodar("strings", "-a", "-n", "4", "-e", "l", str(pdf)),
                          rodar("strings", "-a", "-n", "4", "-e", "b", str(pdf))], segredos)
    # versões: cada %%EOF que não é o último fecha uma versão anterior
    fins = [m.end() for m in re.finditer(rb"%%EOF", cru)]
    antigas = []
    with tempfile.TemporaryDirectory() as t:
        for k, fim in enumerate(fins[:-1]):
            v = Path(t) / f"v{k + 1}.pdf"
            v.write_bytes(cru[:fim])
            antigas += [rodar("pdftotext", str(v), "-")] + bytes_como_texto(cru[:fim])
    r["versões"] = achar(antigas, segredos)
    r["versões (quantas)"] = len(fins)
    r["metadados"] = achar([rodar("pdfinfo", str(pdf)), rodar("pdfinfo", "-meta", str(pdf))], segredos)
    r["anotações e campos"] = {"Annots": len(re.findall(rb"/Annots", cru)) + len(re.findall(rb"/Annots", qdf)),
                               "AcroForm": int(b"/AcroForm" in qdf)}
    return r


def main() -> int:
    casos = Path(sys.argv[1])
    tudo = {}
    for pasta in sorted(p for p in casos.iterdir() if (p / "caso.json").exists()):
        caso = json.loads((pasta / "caso.json").read_text(encoding="utf-8"))
        tudo[pasta.name] = {q: examinar(pasta / f"{q}.pdf", caso["segredos"]) for q in ("original", "tarjado")
                            if (pasta / f"{q}.pdf").exists()}
        px = json.loads((pasta / "resultado.json").read_text()) if (pasta / "resultado.json").exists() else {}
        tudo[pasta.name]["pixels"] = px.get("pixels")
        tudo[pasta.name]["sugestoes"] = px.get("sugestoes")
    (casos / "resultado-recuperacao.json").write_text(json.dumps(tudo, ensure_ascii=False, indent=1), encoding="utf-8")
    cab = "| Caso | " + " | ".join(FERRAMENTAS) + " | pixels descobertos |"
    print(cab)
    print("|" + "---|" * (len(FERRAMENTAS) + 2))
    vazou = 0
    for nome, r in tudo.items():
        celulas = []
        for f in FERRAMENTAS:
            o = len(r.get("original", {}).get(f, []))
            t = r.get("tarjado", {}).get(f)
            vazou += bool(t)
            celulas.append(f"{o} → **{len(t)}: {', '.join(t)}**" if t else f"{o} → 0")
        px = r.get("pixels") or []
        desc = sum(p["descobertos"] for p in px)
        vazou += bool(desc)
        celulas.append(f"**{desc}** de {sum(p['dados'] for p in px)}" if desc else f"0 de {sum(p['dados'] for p in px)}")
        print(f"| {nome} | " + " | ".join(celulas) + " |")
    print(f"\n(cada célula: dados achados no original → no tarjado; células com vazamento: {vazou})")
    return 1 if vazou else 0


if __name__ == "__main__":
    sys.exit(main())
