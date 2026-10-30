# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
"""Roda a suíte inteira, um arquivo de cada vez, e falha se qualquer um falhar (o `node tests/e2e*.mjs` dos
documentos antigos não fazia isso: o Node não expande o *, auditoria da rc.1 da 1.2.1). Usado pelo CI.

  rápidos      node --test: procura, montador, dados fictícios
  e2e          os de ponta a ponta no Edge sem janela (ou dentro do exe, com TARJA_EXE; ou no Chromium ou no Firefox,
               com TARJA_NAVEGADOR, ver docs/E2E-MULTIPLATAFORMA.md), um processo por arquivo
  auditoria    os testes da auditoria externa (tests/auditoria-ext/rodar.py; precisa do npm ci de lá)

Fora daqui, rodados à parte na bateria da versão: e2e_fechar (só no exe), e2e_longo (30 min), e2e_pesado (minutos),
os .ps1 (janela, quedas, instalação e conexões) e o cargo test do app/.
Uso: python -X utf8 tests/todos.py [--sem-auditoria]
"""

import subprocess
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
E2E = ["e2e", "e2e_pdf_teste", "e2e_varios", "e2e_ocr", "e2e_andamento", "e2e_auditoria", "e2e_auditoria2",
       "e2e_export_real", "e2e_telas"]


def rodar(nome: str, comando: list[str], limite: int) -> bool:
    inicio = time.monotonic()
    try:
        r = subprocess.run(comando, cwd=RAIZ, timeout=limite)
        ok = r.returncode == 0
        motivo = "" if ok else f" (saída {r.returncode})"
    except subprocess.TimeoutExpired:
        ok, motivo = False, f" (passou de {limite // 60} min)"
    print(f"== {nome}: {'passou' if ok else 'FALHOU' + motivo} em {time.monotonic() - inicio:.0f} s", flush=True)
    return ok


def main() -> int:
    testes = [("rápidos", ["node", "--test", "tests/achados.test.mjs", "tests/montar.test.mjs", "tests/ficticios.test.mjs"], 600)]
    testes += [(t, ["node", f"tests/{t}.mjs"], 900) for t in E2E]
    if "--sem-auditoria" not in sys.argv:
        testes.append(("auditoria externa", [sys.executable, "-X", "utf8", "tests/auditoria-ext/rodar.py"], 900))
    falhas = [nome for nome, comando, limite in testes if not rodar(nome, comando, limite)]
    print(f"\n{len(testes) - len(falhas)} de {len(testes)} passaram" + (f"; falharam: {', '.join(falhas)}" if falhas else ""))
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
