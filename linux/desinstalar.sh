#!/bin/sh
# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-License-Identifier: MIT
# Tira o Tarja Livre instalado pelo instalar.sh: os arquivos, os atalhos, o ícone e as cópias feitas para navegador
# em snap. O que o programa guardou dentro do navegador (escolhas, lista de nomes, andamento) fica no perfil do
# navegador: antes de desinstalar, use o botão "Apagar tudo o que o Tarja Livre guardou", no próprio programa.
set -eu
dados=${XDG_DATA_HOME:-$HOME/.local/share}
rm -f "$dados/applications/br.tarjalivre.TarjaLivre.desktop" "$dados/applications/br.tarjalivre.TarjaLivreOCR.desktop"
rm -f "$dados/icons/hicolor/scalable/apps/tarja-livre.svg"
rm -rf "$dados/tarja-livre"
for s in "$HOME"/snap/*/common/tarja-livre; do [ -d "$s" ] && rm -rf "$s"; done
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$dados/applications" 2>/dev/null || true
echo "Tarja Livre desinstalado."
