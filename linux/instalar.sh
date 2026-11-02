#!/bin/sh
# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-License-Identifier: MIT
# Instala o Tarja Livre só para você, sem administrador: copia os arquivos para ~/.local/share/tarja-livre e põe os
# atalhos no menu de aplicativos. Nada vai para fora da pasta pessoal. Para tirar: ./desinstalar.sh
set -eu
aqui=$(dirname "$(readlink -f "$0")")
dados=${XDG_DATA_HOME:-$HOME/.local/share}
pasta=$dados/tarja-livre
mkdir -p "$pasta" "$dados/applications" "$dados/icons/hicolor/scalable/apps"
for a in TarjaLivre.html TarjaLivre-OCR.html tarja-livre desinstalar.sh LEIA-ME.txt LICENSE THIRD-PARTY-NOTICES.md VERSAO; do
  cp -f "$aqui/$a" "$pasta/$a"
done
chmod 755 "$pasta/tarja-livre" "$pasta/desinstalar.sh"
cp -f "$aqui/tarja-livre.svg" "$dados/icons/hicolor/scalable/apps/tarja-livre.svg"
for d in br.tarjalivre.TarjaLivre br.tarjalivre.TarjaLivreOCR; do
  # o atalho chama o tarja-livre pelo caminho inteiro (a pasta pode não estar no PATH)
  sed "s|^Exec=tarja-livre|Exec=\"$pasta/tarja-livre\"|" "$aqui/$d.desktop" > "$dados/applications/$d.desktop"
done
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$dados/applications" 2>/dev/null || true
echo "Tarja Livre $(cat "$aqui/VERSAO") instalado em $pasta."
echo "Procure \"Tarja Livre\" no menu de aplicativos, ou rode: \"$pasta/tarja-livre\""
