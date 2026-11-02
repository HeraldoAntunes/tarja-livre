# Tarja Livre: confere que a suíte sem janela não deixa temporários
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
"""Executa rápidos/propriedades e os testes Rust; compara os nomes temporários antes/depois.

Uso: python -X utf8 tests/temporarios.py
Só lista metadados; não apaga sobras nem arquivos que já existiam. Se houver sobra, o teste que a criou
deve ser corrigido. E2E, scripts com janela e perfil real do WebView2 ficam fora desta conferência.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PREFIXOS = ("tarja-", "tmp", "TarjaLivre-antigo-")


def listar(pasta: Path) -> list[str]:
    prefixos = tuple(p.casefold() for p in PREFIXOS)
    return sorted(p.name for p in pasta.iterdir() if p.name.casefold().startswith(prefixos))


def main() -> int:
    pasta = Path(tempfile.gettempdir())
    antes = listar(pasta)
    falhas = []
    comandos = [
        ("sem janela", [sys.executable, "-X", "utf8", "tests/todos.py", "--sem-janela"], RAIZ, 600),
        ("Rust", ["cargo", "test", "--locked"], RAIZ / "app", 900),
    ]
    try:
        for nome, comando, cwd, limite in comandos:
            print(f"== temporários: executando {nome}", flush=True)
            try:
                resultado = subprocess.run(
                    comando, cwd=cwd, timeout=limite,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, encoding="utf-8", errors="replace",
                )
                print(resultado.stdout, end="", flush=True)
                print(f"== temporários: {nome}, saída {resultado.returncode}", flush=True)
                if resultado.returncode:
                    falhas.append(f"{nome}: saída {resultado.returncode}")
            except (OSError, subprocess.TimeoutExpired) as erro:
                falhas.append(f"{nome}: {erro}")
    finally:
        depois = listar(pasta)
        novos = sorted(set(depois) - set(antes))
        removidos = sorted(set(antes) - set(depois))
        print(json.dumps({"antes": antes, "depois": depois, "novos": novos, "removidos": removidos},
                         ensure_ascii=False), flush=True)
        print(f"TEMP: {len(antes)} antes, {len(depois)} depois; "
              f"{len(novos)} novos, {len(removidos)} removidos", flush=True)
    if novos:
        falhas.append("temporários novos permaneceram: " + ", ".join(novos))
    if falhas:
        print("TEMP: FALHOU: " + "; ".join(falhas), file=sys.stderr)
        return 1
    print("TEMP: sem sobras novas; os arquivos anteriores não foram apagados pela conferência.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
