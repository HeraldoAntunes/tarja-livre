# Reproduzir os testes independentes

Execute a partir da pasta `tarja-livre/` que contém `repo/`, `logs/` e `testes/`.
O checkout esperado é tag v1.2.0, commit cc8b0f38e73e7d3983064f2b6affc6e4039be287.

## Ambiente usado

- Node v24.22.1; Python3.12.14.
- @napi-rs/canvas0.1.100, pdfjs-dist5.6.205 (somente fontes padrão de renderização do harness).
- pypdf6.10.0, PyMuPDF1.26.6, numpy2.3.5.
- O leitor de PDF efetivamente executado é o PDF.js vendorizado do aplicativo, não o pacote pdfjs-dist usado para fontes.

Esses módulos já existiam num diretório ancestral no executor da auditoria. **Não estão incluídos no relatório**. Num ambiente independente, instale dependências dos registries oficiais conforme suas permissões, em pasta isolada, sem sobrescrever dependências do produto. Exemplo na pasta deste relatório:

```bash
npm install --no-save --package-lock=false @napi-rs/canvas@0.1.100 pdfjs-dist@5.6.205
python -m venv .venv
. .venv/bin/activate
python -m pip install pypdf==6.10.0 PyMuPDF==1.26.6 numpy==2.3.5
export CODEX_PRIMARY_RUNTIME_NODE_MODULES="$PWD/node_modules"
python repo/scripts/montar.py --release --sem-exe
(cd repo && node --test tests/*.test.mjs)
TARJA_REPO="$PWD/repo" TARJA_OUT="$PWD/testes/saidas" node --test testes/audit-regressions.mjs
TARJA_REPO="$PWD/repo" TARJA_OUT="$PWD/testes/saidas" node --test testes/audit-additional.mjs
TARJA_REPO="$PWD/repo" node --test testes/audit-round2.mjs
TARJA_REPO="$PWD/repo" TARJA_OUT="$PWD/testes/export-real" node testes/audit-export-real.mjs
python testes/inspect-export.py testes/export-real
python testes/check-pixels.py testes/export-real
```

O teste round2 tem resultado esperado 6PASS/4FAIL nesta versão publicada: falha é a reprodução dos defeitos, não defeito do harness. OBS2-01 é controle do comportamento atual, não aprovação de design.

O harness executa fonte real em Node VM; DOM, eventos, timers de crash-contínuo e fronteiras de gravação são controlados. No exportador real PDF.js/jsPDF/canvas realmente processam PDFs. IndexedDB não existe nesse harness: avisos de sua ausência são limitação do ambiente, não defeito do aplicativo. Não há simulação de queda física, nem Windows/WebView2/OCR completo validado.

Fixtures são sintéticas e estão preservadas; `generate-independent.py` documenta sua geração. `inspect-export.py` produz dados e recortes; `check-pixels.py` compara renderizadores diferentes e exige interpretação das divergências, não simplesmente zero pixels.

## Adaptação do Tarja Livre (29/10/2026)

Cópia dos testes da auditoria externa da rc.1 da 1.2.1, trazida como regressão. Uma mudança só, para rodar no
Windows: em `audit-additional.mjs`, o `workerSrc` do PDF.js passou a ser uma URL `file://` (`pathToFileURL(...)`),
porque no Windows um caminho `C:\...` não é aceito. As fixtures vêm de `tests/fixtures/auditoria` (as mesmas, pelo
SHA-256), copiadas na hora por `tests/auditoria-ext/rodar.py`.
