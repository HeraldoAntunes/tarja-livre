#!/bin/sh
# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-License-Identifier: MIT
# Roda o testar_pacote.sh em contêineres limpos do Docker: Ubuntu 22.04 e 24.04 com o navegador, Debian 12 sem.
# Antes: python3 scripts/pacote_linux.py e npm ci --ignore-scripts nesta pasta.
# Variáveis: CHROMIUM_DIR  pasta com chrome-linux64/chrome (por exemplo a do Playwright), obrigatória
#            NODE_DIR      pasta do Node 22 (com bin/node), padrão: a do node no PATH
#            PREPARAR_APT  script que ajusta o apt dentro do contêiner (proxy etc.), opcional
#            DOCKER_EXTRA  argumentos a mais para o docker run (por exemplo --network host e o proxy), opcional
#            IMAGENS       padrão: "ubuntu:22.04 ubuntu:24.04 debian:12"
# Uso: tests/pacote_linux/rodar_conteineres.sh [pasta de saída]   (padrão: files/pacote-linux)
set -eu
AQUI=$(cd "$(dirname "$0")" && pwd)
RAIZ=$(cd "$AQUI/../.." && pwd)
SAIDA=${1:-$RAIZ/files/pacote-linux}
NODE_DIR=${NODE_DIR:-$(dirname "$(dirname "$(readlink -f "$(command -v node)")")")}
IMAGENS=${IMAGENS:-"ubuntu:22.04 ubuntu:24.04 debian:12"}
VERSAO=$(sed -n "s/.*VERSAO = '\([^']*\)'.*/\1/p" "$RAIZ/src/versao.js")
PACOTE=$(mktemp -d)
chmod 755 "$PACOTE"
trap 'rm -rf "$PACOTE"' EXIT
cp "$RAIZ"/dist/linux/*.deb "$RAIZ"/dist/linux/*.tar.gz "$PACOTE"/
echo "$VERSAO" > "$PACOTE/VERSAO"
mkdir -p "$SAIDA"
falhas=0
for img in $IMAGENS; do
  rotulo=$(echo "${img##*/}" | tr : -)
  set -- -v "$PACOTE:/pacote:ro" -v "$AQUI:/testes:ro" -v "$NODE_DIR:/node:ro" -v "$SAIDA:/resultados"
  [ -n "${PREPARAR_APT:-}" ] && set -- "$@" -v "$PREPARAR_APT:/preparar-apt.sh:ro"
  # o Debian 12 roda sem o navegador: testa instalar, o lançador e desinstalar
  case "$img" in *debian*) ;; *) set -- "$@" -v "$CHROMIUM_DIR:/navegador:ro" ;; esac
  # shellcheck disable=SC2086
  if docker run --rm ${DOCKER_EXTRA:-} "$@" "$img" /testes/testar_pacote.sh "$rotulo"; then r=passou; else r=FALHOU; falhas=$((falhas + 1)); fi
  echo "$img: $r ($(grep -c '^PASSOU' "$SAIDA/$rotulo/registro.txt") verificações passaram, $(grep -c '^FALHOU' "$SAIDA/$rotulo/registro.txt") falharam)"
done
[ "$falhas" -eq 0 ]
