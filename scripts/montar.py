# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
"""Junta src/ e vendor/ num arquivo só, dist/Tarja Livre.html, que abre com dois cliques e funciona sem internet.

Os scripts entram escritos dentro da página e a política de segurança (CSP) libera cada um pelo seu SHA-256: nada de
fora pode rodar. O worker do PDF.js vai como texto e vira um worker blob: na hora, porque módulo carregado de
arquivo (file://) é barrado pelo navegador.

Uso: python scripts/montar.py [--release]
     --release também gera dist/release/ com TarjaLivre-<versão>.html, TarjaLivre-OCR-<versão>.html,
     Instalar-TarjaLivre-<versão>.zip (o exe de janela própria, com OCR, que se instala sozinho, mais a LICENSE, os
     avisos de terceiros e o LEIA-ME; precisa do Rust), Criar-atalho-TarjaLivre.cmd (com o ícone docs/img/icone.ico
     embutido) e SHA256SUMS.txt, os anexos da release. O exe solto fica em dist/, só para os testes. --sem-exe pula o
     exe e o zip.
"""

import base64
import os
import hashlib
import json
import html as html_lib
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ / "src"
VENDOR = RAIZ / "vendor"
SAIDA = RAIZ / "dist" / "Tarja Livre.html"
SAIDA_OCR = RAIZ / "dist" / "Tarja Livre com OCR.html"
TESSERACT = VENDOR / "tesseract"

LICENCAS = [
    ("Tarja Livre: licença MIT", RAIZ / "LICENSE"),
    ("PDF.js 4.10.38 (Mozilla): Apache License 2.0", VENDOR / "pdfjs" / "LICENSE"),
    ("OpenJPEG, dentro do PDF.js: licença BSD de 2 cláusulas", VENDOR / "pdfjs" / "OPENJPEG-LICENSE.txt"),
    ("jsPDF 4.2.1: licença MIT", VENDOR / "jspdf" / "LICENSE"),
]
LICENCAS_OCR = [
    ("Tesseract.js 7.0.0: Apache License 2.0", TESSERACT / "LICENSE-tesseract.js.md"),
    ("Tesseract.js-core 7.0.0 (Tesseract OCR): Apache License 2.0", TESSERACT / "LICENSE-tesseract.js-core.txt"),
    ("Partes incluídas no Tesseract.js (buffer, ieee754, regenerator-runtime, zlib.js): avisos",
     TESSERACT / "worker.min.js.LICENSE.txt"),
]
SOBRE_OCR = ("<p>Esta é a versão com leitura de páginas digitalizadas (OCR): usa Tesseract.js 7.0.0 e os dados de "
             "português do projeto Tesseract (licença Apache 2.0), tudo dentro do arquivo e sem internet.</p>")

# ordem importa: quem é importado vem antes de quem importa
MODULOS = ["versao.js", "achados.js", "app.js"]


def ler(caminho: Path) -> str:
    return caminho.read_text(encoding="utf-8")


def modulo_sem_import(texto: str) -> str:
    """Tira import/export dos módulos próprios para que fiquem num script só."""
    texto = re.sub(r"^import\s[^;]+;\s*$", "", texto, flags=re.M)
    return re.sub(r"^export\s+(?=(const|let|function|async function|class)\b)", "", texto, flags=re.M)


def pdfjs_global(texto: str) -> str:
    """Troca o export{a as b,...} final do pdf.min.mjs por globalThis.pdfjsLib = {b: a, ...}."""
    m = re.search(r"export\{([^}]*)\};?\s*$", texto)
    if not m:
        sys.exit("pdf.min.mjs: export final não encontrado (versão diferente da esperada?)")
    pares = []
    for parte in m.group(1).split(","):
        local, _, nome = parte.strip().partition(" as ")
        pares.append(f"{(nome or local).strip()}:{local.strip()}")
    return texto[: m.start()] + "globalThis.pdfjsLib={" + ",".join(pares) + "};\n"


def conferir_script(nome: str, texto: str) -> None:
    # dentro de <script>, estas sequências encerrariam o bloco antes da hora
    if re.search(r"</script|<script|<!--", texto, flags=re.I):
        sys.exit(f"{nome}: contém </script, <script ou <!--; não dá para pôr dentro da página")


def hash_csp(texto: str) -> str:
    return "'sha256-" + base64.b64encode(hashlib.sha256(texto.encode("utf-8")).digest()).decode() + "'"


def worker_ocr() -> str:
    """Worker do OCR num texto só: a parte nossa com os dados do português, o núcleo e o worker do Tesseract."""
    dados = base64.b64encode((TESSERACT / "por.traineddata.gz").read_bytes()).decode()
    prefixo = ler(SRC / "ocr-worker.js")
    if prefixo.count("__DADOS_POR__") != 1:
        sys.exit("ocr-worker.js: marcador __DADOS_POR__ ausente ou repetido")
    return "\n".join([prefixo.replace("__DADOS_POR__", dados), ler(TESSERACT / "tesseract-core-simd-lstm.wasm.js"),
                      ler(TESSERACT / "worker.min.js")])


def montar(ocr: bool = False) -> Path:
    html = ler(SRC / "index.html")
    estilo = "\n" + ler(SRC / "estilo.css")
    jspdf = ler(VENDOR / "jspdf" / "jspdf.umd.min.js")
    pdfjs = pdfjs_global(ler(VENDOR / "pdfjs" / "pdf.min.mjs"))
    # worker blob: de página aberta por file:// só roda como script comum, não como módulo; o worker do PDF.js
    # não usa import nem import.meta, então basta tirar o export final
    worker, n = re.subn(r"export\{[^}]*\};?\s*$", "", ler(VENDOR / "pdfjs" / "pdf.worker.min.mjs"))
    if n != 1 or re.search(r"\bimport\.meta\b|^import\s", worker, flags=re.M):
        sys.exit("pdf.worker.min.mjs: formato diferente do esperado")
    app = "\n" + "\n".join(modulo_sem_import(ler(SRC / m)) for m in MODULOS)

    tesseract = ler(TESSERACT / "tesseract.min.js") if ocr else ""
    trabalho_ocr = worker_ocr() if ocr else ""

    for nome, texto in [("jspdf", jspdf), ("pdf.js", pdfjs), ("worker", worker), ("app", app),
                        ("tesseract", tesseract), ("worker do OCR", trabalho_ocr)]:
        conferir_script(nome, texto)

    executados = (jspdf, pdfjs, tesseract, app) if ocr else (jspdf, pdfjs, app)
    csp = "; ".join([
        "default-src 'none'",
        # só a versão com OCR libera WebAssembly (o núcleo do Tesseract); nenhuma das duas libera eval de texto
        "script-src " + " ".join(hash_csp(t) for t in executados) + (" 'wasm-unsafe-eval'" if ocr else ""),
        "style-src " + hash_csp(estilo),
        # só o favicon embutido (data:); as páginas do PDF passam por canvas, nenhuma imagem vem de fora
        "img-src data:",
        "font-src data:",
        "worker-src blob:",
        "connect-src 'none'",
        "object-src 'none'",
        "frame-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
    ])
    scripts = "\n".join([
        f'<script type="text/plain" id="pdfjs-worker">{worker}</script>',
        *([f'<script type="text/plain" id="ocr-worker">{trabalho_ocr}</script>', f"<script>{tesseract}</script>"]
          if ocr else []),
        f"<script>{jspdf}</script>",
        f'<script type="module">{pdfjs}</script>',
        f'<script type="module">{app}</script>',
    ])
    # textos das licenças dentro do Sobre: quem baixa só o HTML recebe as licenças junto (a Apache 2.0 do PDF.js exige)
    licencas = "\n".join(
        f'<details class="licenca"><summary>{titulo}</summary><pre>{html_lib.escape(ler(caminho).strip())}</pre></details>'
        for titulo, caminho in LICENCAS + (LICENCAS_OCR if ocr else [])
    )
    html = html.replace("<!--LICENCAS-->", licencas)
    html = html.replace("<!--SOBRE_OCR-->", SOBRE_OCR if ocr else "")
    for marca in ("<!--CSP-->", "<!--ICONE-->", "<!--ESTILO-->", "<!--SCRIPTS-->"):
        if html.count(marca) != 1:
            sys.exit(f"index.html: marcador {marca} ausente ou repetido")
    html = html.replace("<!--CSP-->", f'<meta http-equiv="Content-Security-Policy" content="{csp}">')
    # favicon embutido, feito do mesmo docs/img/icone.svg do README (nada buscado na rede)
    icone = base64.b64encode((RAIZ / "docs" / "img" / "icone.svg").read_bytes()).decode("ascii")
    html = html.replace("<!--ICONE-->", f'<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,{icone}">')
    html = html.replace("<!--ESTILO-->", f"<style>{estilo}</style>")
    html = html.replace("<!--SCRIPTS-->", scripts)

    saida = SAIDA_OCR if ocr else SAIDA
    saida.parent.mkdir(exist_ok=True)
    saida.write_text(html, encoding="utf-8", newline="\n")
    return saida


def criar_atalho() -> str:
    """O Criar-atalho-TarjaLivre.cmd, com o ícone dentro: um arquivo só, que o usuário põe junto do HTML."""
    modelo = ler(SRC / "criar-atalho.cmd")
    icone = base64.b64encode((RAIZ / "docs" / "img" / "icone.ico").read_bytes()).decode("ascii")
    if modelo.count("__ICONE_BASE64__") != 1:
        sys.exit("criar-atalho.cmd sem o marcador do ícone")
    # o cmd.exe lê melhor com CRLF
    return modelo.replace("__ICONE_BASE64__", icone).replace("\r\n", "\n").replace("\n", "\r\n")


def exe(saida_ocr: Path, versao: str) -> Path:
    """O exe de janela própria (app/, Tauri 2 com o WebView2), com o HTML com OCR dentro."""
    app = RAIZ / "app"
    for arq, padrao in ((app / "Cargo.toml", r'^version = "([^"]+)"'), (app / "tauri.conf.json", r'^  "version": "([^"]+)"')):
        achado = re.search(padrao, ler(arq), flags=re.M)
        if not achado or achado.group(1) != versao:
            sys.exit(f"{arq.relative_to(RAIZ)} com versão diferente de {versao}: rode scripts/nova_versao.py")
    (app / "web").mkdir(exist_ok=True)
    shutil.copyfile(saida_ocr, app / "web" / "index.html")
    (app / "icons").mkdir(exist_ok=True)
    shutil.copyfile(RAIZ / "docs" / "img" / "icone.ico", app / "icons" / "icon.ico")
    # sem caminho do PC dentro do exe (as mensagens de erro do Rust levam o caminho dos fontes: a pasta da pessoa e
    # a do projeto). CARGO_ENCODED_RUSTFLAGS (separado por \x1f) porque o caminho do projeto tem espaço.
    trocas = [f"--remap-path-prefix={RAIZ}=.", f"--remap-path-prefix={Path.home()}=~"]
    ambiente = {**os.environ, "CARGO_ENCODED_RUSTFLAGS": "\x1f".join(trocas)}
    subprocess.run(["cargo", "build", "--release", "--locked"], cwd=app, check=True, env=ambiente)
    feito = app / "target" / "release" / "TarjaLivre.exe"
    dados = feito.read_bytes()
    for pista in (str(Path.home()), str(RAIZ), str(Path.home()).replace("\\", "/"), str(RAIZ).replace("\\", "/")):
        for forma in (pista.encode("utf-8"), pista.encode("utf-16-le")):
            if forma.lower() in dados.lower():
                sys.exit(f"o exe ainda leva o caminho {pista}: confira o --remap-path-prefix")
    return feito


def zip_instalar(feito: Path, destino: Path, versao: str) -> None:
    """Instalar-TarjaLivre-<versão>.zip, igual nos quatro programas (decisão do professor, 29/10/2026): nenhum exe solto
    na release. Sem data nem dono da máquina: cada arquivo leva a data da versão no CHANGELOG, e o mesmo exe dá o mesmo
    zip nesta máquina, a cada montagem. Não é byte a byte igual em outra: o exe não é reproduzível entre máquinas, e a
    compressão (deflate) depende da versão do zlib do Python que monta (auditoria da rc.2)."""
    data = re.search(rf"^## \[{re.escape(versao)}\] - (\d{{4}})-(\d\d)-(\d\d)", ler(RAIZ / "CHANGELOG.md"), flags=re.M)
    if not data:
        sys.exit(f"CHANGELOG.md sem a data da versão {versao}")
    quando = tuple(int(x) for x in data.groups()) + (12, 0, 0)
    leia = ler(SRC / "LEIA-ME-instalar.txt").replace("__VERSAO__", versao).replace("\r\n", "\n").replace("\n", "\r\n")
    conteudo = [(f"TarjaLivre-{versao}.exe", feito.read_bytes()),
                ("LEIA-ME.txt", "\ufeff".encode("utf-8") + leia.encode("utf-8")),   # BOM: o Bloco de Notas antigo lê certo
                ("LICENSE", (RAIZ / "LICENSE").read_bytes()),
                ("THIRD-PARTY-NOTICES.md", (RAIZ / "THIRD-PARTY-NOTICES.md").read_bytes())]
    with zipfile.ZipFile(destino, "w") as z:
        for nome, dados in conteudo:
            info = zipfile.ZipInfo(nome, quando)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, dados, compresslevel=9)


def release(saida: Path, saida_ocr: Path) -> Path:
    """Arquivos da release, em dist/release/: os dois HTML com a versão no nome, o atalho e o SHA256SUMS.txt."""
    versao = re.search(r"VERSAO = '([^']+)'", ler(SRC / "versao.js")).group(1)
    pasta = saida.parent / "release"
    if pasta.exists():
        shutil.rmtree(pasta)
    pasta.mkdir()
    linhas = []
    for origem, nome in ((saida, f"TarjaLivre-{versao}.html"), (saida_ocr, f"TarjaLivre-OCR-{versao}.html")):
        shutil.copyfile(origem, pasta / nome)
        linhas.append(f"{hashlib.sha256((pasta / nome).read_bytes()).hexdigest()}  {nome}\n")
    if "--sem-exe" not in sys.argv:
        feito = exe(saida_ocr, versao)
        shutil.copyfile(feito, saida.parent / f"TarjaLivre-{versao}.exe")   # para os testes, fora da release
        nome = f"Instalar-TarjaLivre-{versao}.zip"
        zip_instalar(feito, pasta / nome, versao)
        linhas.append(f"{hashlib.sha256((pasta / nome).read_bytes()).hexdigest()}  {nome}\n")
    atalho = pasta / "Criar-atalho-TarjaLivre.cmd"
    atalho.write_bytes(criar_atalho().encode("utf-8"))
    linhas.append(f"{hashlib.sha256(atalho.read_bytes()).hexdigest()}  {atalho.name}\n")
    (pasta / "SHA256SUMS.txt").write_text("".join(linhas), encoding="utf-8", newline="\n")
    return pasta


if __name__ == "__main__":
    saidas = [montar(), montar(ocr=True)]
    for s in saidas:
        print(f"{s.relative_to(RAIZ)}: {s.stat().st_size / 1024 / 1024:.2f} MB")
    if "--release" in sys.argv:
        pasta = release(*saidas)
        print(f"{pasta.relative_to(RAIZ)}: " + ", ".join(sorted(p.name for p in pasta.iterdir())))
        # de que commit saiu esta montagem, com o que estava sem commit (vai para o manifesto do pacote da auditoria)
        git = lambda *a: subprocess.run(["git", "-C", str(RAIZ), *a], capture_output=True, text=True).stdout.strip()
        montagem = {
            "versao": re.search(r"VERSAO = '([^']+)'", ler(SRC / "versao.js")).group(1),
            "commit": git("rev-parse", "HEAD"),
            "sem_commit": [l[3:] for l in subprocess.run(["git", "-C", str(RAIZ), "status", "--porcelain"], capture_output=True,
                           text=True).stdout.splitlines() if l[3:].split("/")[0] not in ("dist", "files", "para-virustotal", "pacote")],
            "arquivos": {l.split("  ", 1)[1]: l.split("  ", 1)[0] for l in (pasta / "SHA256SUMS.txt").read_text(encoding="utf-8").splitlines()},
        }
        (pasta.parent / "MONTAGEM.json").write_text(json.dumps(montagem, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if montagem["sem_commit"]:
            print("atenção: montado com mudanças sem commit: " + ", ".join(montagem["sem_commit"]))
