# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
"""Roda, como regressão, os testes da auditoria externa da rc.1 da 1.2.1 (29/10/2026) contra o código atual:

  ampliada/            os 18 cenários novos (TL-X01 a TL-X18), runner e harness do auditor, sem mudança;
  ampliada/antigas/    as 27 regressões das rodadas anteriores e a exportação real, com uma adaptação para o
                       Windows (ver ampliada/antigas/testes/README.md).

Este script só prepara o lugar:
- o runner do auditor confere um manifesto de hashes de toda a árvore que recebe (aqui seria app/target, gigas), por
  isso ele recebe uma cópia de src/, vendor/ e do PDF de teste, que é o que os harness carregam;
- a cópia fica dentro de ampliada/ para o pdf.min.mjs achar o @napi-rs/canvas na node_modules de lá;
- as fixtures das regressões antigas são as de tests/fixtures/auditoria (as mesmas, conferidas pelo SHA-256),
  copiadas na hora;
- antes, uma vez: `npm ci --ignore-scripts` em tests/auditoria-ext/ampliada.

Uso: python -X utf8 tests/auditoria-ext/rodar.py [pasta de saída]. Saída 0: tudo passa; 1: algum falhou; 2: bloqueio.
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
AMPLIADA = Path(__file__).resolve().parent / "ampliada"
ANTIGAS = AMPLIADA / "antigas"


def main() -> int:
    if not (AMPLIADA / "node_modules" / "pdf-lib").exists():
        print("falta instalar: npm ci --ignore-scripts em tests/auditoria-ext/ampliada", file=sys.stderr)
        return 2
    saida = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "files" / "auditoria-ext"
    copia = AMPLIADA / "fonte-copia"
    fixtures = ANTIGAS / "testes" / "fixtures"
    for p in (copia, fixtures):
        shutil.rmtree(p, ignore_errors=True)
    try:
        for pasta in ("src", "vendor"):
            shutil.copytree(RAIZ / pasta, copia / pasta)
        (copia / "tests" / "fixtures").mkdir(parents=True)
        shutil.copy2(RAIZ / "tests" / "fixtures" / "tarja-teste.pdf", copia / "tests" / "fixtures")
        shutil.copytree(RAIZ / "tests" / "fixtures" / "auditoria", fixtures, ignore=shutil.ignore_patterns("*.md", "*.py"))
        env = {**os.environ, "TARJA_REPO": str(copia), "CODEX_PRIMARY_RUNTIME_NODE_MODULES": str(AMPLIADA / "node_modules")}
        etapas = [
            ("ampliada (18 cenários)", ["node", "runner.mjs"], AMPLIADA, saida / "ampliada"),
            ("regressões antigas (27)", ["node", "--test", "testes/audit-regressions.mjs", "testes/audit-additional.mjs",
                                         "testes/audit-round2.mjs"], ANTIGAS, saida / "regressoes"),
            ("exportação real do auditor", ["node", "testes/audit-export-real.mjs"], ANTIGAS, saida / "export-real"),
        ]
        pior = 0
        for nome, comando, onde, out in etapas:
            out.mkdir(parents=True, exist_ok=True)
            r = subprocess.run(comando, cwd=onde, env={**env, "TARJA_OUT": str(out)})
            print(f"== {nome}: {'passou' if r.returncode == 0 else f'FALHOU (saída {r.returncode})'}")
            pior = max(pior, min(r.returncode, 2))
        return pior
    finally:
        for p in (copia, fixtures):
            shutil.rmtree(p, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
