# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
"""Pacotes para Linux do Tarja Livre em HTML (o mesmo programa, que abre num navegador do computador):

  dist/linux/tarja-livre_<versão>_all.deb        instala com o apt ou o dpkg (pede administrador): os HTML em
                                                 /usr/share/tarja-livre, o comando tarja-livre e os atalhos do menu
  dist/linux/TarjaLivre-<versão>-linux.tar.gz    por conta, sem administrador: extrair e rodar ./instalar.sh, que
                                                 instala só na pasta pessoal (~/.local/share)
  dist/linux/SHA256SUMS-linux.txt

Feito só com Python (sem dpkg-deb nem tar), para montar também no Windows. Os dois saem iguais byte a byte a cada
montagem: cada arquivo leva a data da versão no CHANGELOG, dono root, ordem fixa e gzip sem data nem nome. Usa os
arquivos de linux/ e os dois HTML de scripts/montar.py, montados de novo aqui (com --sem-montar, usa os de dist/).

Uso: python scripts/pacote_linux.py [--sem-montar]
"""

import calendar
import gzip
import hashlib
import io
import re
import sys
import tarfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import montar  # noqa: E402

RAIZ = montar.RAIZ
LINUX = RAIZ / "linux"
SAIDA = RAIZ / "dist" / "linux"
PACOTE = "tarja-livre"
MANTENEDOR = "Heraldo Antunes <73407236+HeraldoAntunes@users.noreply.github.com>"
DESKTOPS = ("br.tarjalivre.TarjaLivre.desktop", "br.tarjalivre.TarjaLivreOCR.desktop")


def versao_e_data() -> tuple[str, int]:
    versao = re.search(r"VERSAO = '([^']+)'", montar.ler(montar.SRC / "versao.js")).group(1)
    data = re.search(rf"^## \[{re.escape(versao)}\] - (\d{{4}})-(\d\d)-(\d\d)", montar.ler(RAIZ / "CHANGELOG.md"), flags=re.M)
    if not data:
        sys.exit(f"CHANGELOG.md sem a data da versão {versao}")
    a, m, d = (int(x) for x in data.groups())
    return versao, calendar.timegm((a, m, d, 12, 0, 0))


def gz(dados: bytes) -> bytes:
    """gzip sem data e sem nome de arquivo dentro: o mesmo conteúdo dá os mesmos bytes."""
    saida = io.BytesIO()
    with gzip.GzipFile(filename="", mode="wb", fileobj=saida, mtime=0, compresslevel=9) as g:
        g.write(dados)
    return saida.getvalue()


def tar_gz(arquivos: list[tuple[str, bytes, int]], quando: int, pastas: bool) -> bytes:
    """arquivos: (caminho, conteúdo, modo). Com pastas=True, põe também cada pasta (como o dpkg espera no .deb)."""
    nomes = {c for c, _, _ in arquivos}
    todas = set()
    if pastas:
        for c in nomes:
            partes = c.split("/")[:-1]
            for i in range(1, len(partes) + 1):
                todas.add("/".join(partes[:i]))
    bruto = io.BytesIO()
    with tarfile.open(fileobj=bruto, mode="w", format=tarfile.GNU_FORMAT) as t:
        def base(nome: str, tipo: bytes, modo: int, tamanho: int = 0) -> tarfile.TarInfo:
            i = tarfile.TarInfo(nome)
            i.type, i.mode, i.size, i.mtime = tipo, modo, tamanho, quando
            i.uid = i.gid = 0
            i.uname = i.gname = "root"
            return i
        for p in sorted(todas):
            t.addfile(base(p + "/", tarfile.DIRTYPE, 0o755))
        for c, dados, modo in sorted(arquivos):
            t.addfile(base(c, tarfile.REGTYPE, modo, len(dados)), io.BytesIO(dados))
    return gz(bruto.getvalue())


def ar(membros: list[tuple[str, bytes]], quando: int) -> bytes:
    """Arquivo ar no formato que o dpkg lê: o .deb é debian-binary, control.tar.gz e data.tar.gz, nesta ordem."""
    saida = bytearray(b"!<arch>\n")
    for nome, dados in membros:
        cab = f"{nome:<16}{quando:<12}{0:<6}{0:<6}{'100644':<8}{len(dados):<10}`\n".encode("ascii")
        assert len(cab) == 60
        saida += cab + dados + (b"\n" if len(dados) % 2 else b"")
    return bytes(saida)


def arquivos_comuns(versao: str, html: Path, html_ocr: Path) -> dict[str, tuple[bytes, int]]:
    leia = montar.ler(LINUX / "LEIA-ME.txt").replace("__VERSAO__", versao).encode("utf-8")
    return {
        "TarjaLivre.html": (html.read_bytes(), 0o644),
        "TarjaLivre-OCR.html": (html_ocr.read_bytes(), 0o644),
        "tarja-livre": ((LINUX / "tarja-livre").read_bytes(), 0o755),
        "tarja-livre.svg": ((RAIZ / "docs" / "img" / "icone.svg").read_bytes(), 0o644),
        "LEIA-ME.txt": (leia, 0o644),
        "LICENSE": ((RAIZ / "LICENSE").read_bytes(), 0o644),
        "THIRD-PARTY-NOTICES.md": ((RAIZ / "THIRD-PARTY-NOTICES.md").read_bytes(), 0o644),
        **{d: ((LINUX / d).read_bytes(), 0o644) for d in DESKTOPS},
    }


def deb(versao: str, quando: int, comuns: dict[str, tuple[bytes, int]]) -> bytes:
    dados = [
        ("usr/bin/tarja-livre", *comuns["tarja-livre"]),
        ("usr/share/tarja-livre/TarjaLivre.html", *comuns["TarjaLivre.html"]),
        ("usr/share/tarja-livre/TarjaLivre-OCR.html", *comuns["TarjaLivre-OCR.html"]),
        ("usr/share/icons/hicolor/scalable/apps/tarja-livre.svg", *comuns["tarja-livre.svg"]),
        *[(f"usr/share/applications/{d}", *comuns[d]) for d in DESKTOPS],
        ("usr/share/doc/tarja-livre/copyright", copyright_deb(), 0o644),
        ("usr/share/doc/tarja-livre/THIRD-PARTY-NOTICES.md", *comuns["THIRD-PARTY-NOTICES.md"]),
        ("usr/share/doc/tarja-livre/changelog.gz", gz((RAIZ / "CHANGELOG.md").read_bytes()), 0o644),
    ]
    tamanho = sum((len(d) + 1023) // 1024 for _, d, _ in dados)
    controle = f"""Package: {PACOTE}
Version: {versao}
Architecture: all
Maintainer: {MANTENEDOR}
Installed-Size: {tamanho}
Recommends: xdg-utils
Suggests: firefox | firefox-esr | chromium | chromium-browser
Section: utils
Priority: optional
Homepage: https://github.com/HeraldoAntunes/tarja-livre
Description: tarjar dados pessoais (LGPD) em PDF, sem internet
 O Tarja Livre encontra e cobre CPF, RG, e-mail, telefone, nomes e outros dados
 pessoais em PDF, para a escola publicar ou compartilhar documentos de acordo
 com a LGPD. Tudo acontece no próprio computador: o programa é uma página HTML
 que abre no navegador e não usa a internet. A versão com OCR também lê PDF
 digitalizado. Abra pelo menu de aplicativos ou com o comando tarja-livre.
""".encode("utf-8")
    md5 = "".join(f"{hashlib.md5(d).hexdigest()}  {c}\n" for c, d, _ in sorted(dados)).encode("ascii")
    controle_tar = tar_gz([("./control", controle, 0o644), ("./md5sums", md5, 0o644)], quando, pastas=False)
    dados_tar = tar_gz([("./" + c, d, m) for c, d, m in dados], quando, pastas=True)
    return ar([("debian-binary", b"2.0\n"), ("control.tar.gz", controle_tar), ("data.tar.gz", dados_tar)], quando)


def copyright_deb() -> bytes:
    return ("Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/\n"
            "Upstream-Name: Tarja Livre\nSource: https://github.com/HeraldoAntunes/tarja-livre\n\n"
            "Files: *\nCopyright: 2026 Heraldo Antunes\nLicense: MIT\n"
            "Comment: os componentes de terceiros embutidos nos HTML (PDF.js, jsPDF, Tesseract.js) e as licenças\n"
            " deles estão em /usr/share/doc/tarja-livre/THIRD-PARTY-NOTICES.md.\n\nLicense: MIT\n"
            + "".join(" " + (l if l.strip() else ".") + "\n" for l in montar.ler(RAIZ / "LICENSE").splitlines())
            ).encode("utf-8")


def tar_por_conta(versao: str, quando: int, comuns: dict[str, tuple[bytes, int]]) -> bytes:
    pasta = f"TarjaLivre-{versao}-linux"
    arquivos = [(f"{pasta}/{c}", d, m) for c, (d, m) in comuns.items()]
    arquivos += [(f"{pasta}/instalar.sh", (LINUX / "instalar.sh").read_bytes(), 0o755),
                 (f"{pasta}/desinstalar.sh", (LINUX / "desinstalar.sh").read_bytes(), 0o755),
                 (f"{pasta}/VERSAO", f"{versao}\n".encode("ascii"), 0o644)]
    return tar_gz(arquivos, quando, pastas=True)


def main() -> int:
    if "--sem-montar" in sys.argv:
        html, html_ocr = montar.SAIDA, montar.SAIDA_OCR
    else:
        html, html_ocr = montar.montar(), montar.montar(ocr=True)
    versao, quando = versao_e_data()
    comuns = arquivos_comuns(versao, html, html_ocr)
    SAIDA.mkdir(parents=True, exist_ok=True)
    feitos = {f"{PACOTE}_{versao}_all.deb": deb(versao, quando, comuns),
              f"TarjaLivre-{versao}-linux.tar.gz": tar_por_conta(versao, quando, comuns)}
    linhas = []
    for nome, dados in feitos.items():
        (SAIDA / nome).write_bytes(dados)
        linhas.append(f"{hashlib.sha256(dados).hexdigest()}  {nome}\n")
        print(f"{(SAIDA / nome).relative_to(RAIZ)}: {len(dados) / 1024 / 1024:.2f} MB")
    (SAIDA / "SHA256SUMS-linux.txt").write_text("".join(linhas), encoding="utf-8", newline="\n")
    print("".join(linhas), end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
