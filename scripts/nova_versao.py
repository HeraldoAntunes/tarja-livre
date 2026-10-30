# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
"""Troca a versão em todos os lugares de uma vez: src/versao.js, CITATION.cff (versão e data), app/ (o exe), README.md
(tabela de downloads) e CHANGELOG.md (a seção "Não publicado" vira a seção da versão, com a data de hoje).

Uso: python scripts/nova_versao.py 1.0.0 [--data AAAA-MM-DD]
Depois: python scripts/montar.py --release e os testes. Publicar continua sendo decisão do mantenedor.
"""

import datetime
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def trocar(caminho: Path, padrao: str, novo: str, obrigatorio: bool = True) -> None:
    texto = caminho.read_text(encoding="utf-8")
    texto2, n = re.subn(padrao, novo, texto, flags=re.M)
    if obrigatorio and n == 0:
        sys.exit(f"{caminho.name}: não achei {padrao!r}")
    caminho.write_text(texto2, encoding="utf-8", newline="\n")


def main(argv: list[str]) -> int:
    if not argv or not re.fullmatch(r"\d+\.\d+\.\d+", argv[0]):
        print(__doc__)
        return 2
    v = argv[0]
    data = argv[argv.index("--data") + 1] if "--data" in argv else datetime.date.today().isoformat()
    trocar(RAIZ / "src" / "versao.js", r"VERSAO = '[^']+'", f"VERSAO = '{v}'")
    trocar(RAIZ / "CITATION.cff", r'^version: "[^"]+"', f'version: "{v}"')
    trocar(RAIZ / "app" / "Cargo.toml", r'^version = "[^"]+"', f'version = "{v}"')
    trocar(RAIZ / "app" / "tauri.conf.json", r'^  "version": "[^"]+"', f'  "version": "{v}"')
    citation = (RAIZ / "CITATION.cff").read_text(encoding="utf-8")
    if "date-released:" in citation:
        trocar(RAIZ / "CITATION.cff", r'^date-released: "[^"]+"', f'date-released: "{data}"')
    else:
        trocar(RAIZ / "CITATION.cff", r'^(version: "[^"]+")$', rf'\1\ndate-released: "{data}"')
    trocar(RAIZ / "README.md", r"releases/download/v[\d.]+/TarjaLivre-(OCR-)?[\d.]+\.html",
           rf"releases/download/v{v}/TarjaLivre-\g<1>{v}.html")
    trocar(RAIZ / "README.md", r"TarjaLivre-(OCR-)?[\d.]+\.html", rf"TarjaLivre-\g<1>{v}.html")
    trocar(RAIZ / "README.md", r"releases/download/v[\d.]+/", f"releases/download/v{v}/")
    trocar(RAIZ / "README.md", r"releases/download/v[\d.]+/TarjaLivre-[\d.]+\.exe", rf"releases/download/v{v}/TarjaLivre-{v}.exe",
           obrigatorio=False)
    trocar(RAIZ / "README.md", r"TarjaLivre-[\d.]+\.exe", rf"TarjaLivre-{v}.exe", obrigatorio=False)
    trocar(RAIZ / "README.md", r"Instalar-TarjaLivre-[\d.]+\.zip", rf"Instalar-TarjaLivre-{v}.zip", obrigatorio=False)
    trocar(RAIZ / "README.md", r"\(versão [\d.]+\)", f"(versão {v})")
    changelog = (RAIZ / "CHANGELOG.md").read_text(encoding="utf-8")
    if f"## [{v}]" not in changelog:
        trocar(RAIZ / "CHANGELOG.md", r"^## Não publicado\n", f"## Não publicado\n\n## [{v}] - {data}\n")
    print(f"Versão {v} ({data}) em versao.js, CITATION.cff, app/, README.md e CHANGELOG.md. Confira o CHANGELOG à mão.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
