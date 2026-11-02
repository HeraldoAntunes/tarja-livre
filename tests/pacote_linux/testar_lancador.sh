#!/bin/sh
# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-License-Identifier: MIT
# Teste do comando tarja-livre com navegadores de mentira (scripts que só anotam com o que foram chamados): qual
# navegador ele escolhe, a cópia para a pasta do snap, o --ocr e a opção errada. Não abre navegador de verdade, e o
# "snap" daqui é só uma pasta chamada snap/bin: o snap de verdade não foi testado.
# Uso: testar_lancador.sh <caminho do tarja-livre instalado>
set -eu
LANCADOR=$1
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
falhas=0
ok() { echo "PASSOU  lançador: $*"; }
falhou() { echo "FALHOU  lançador: $*"; falhas=$((falhas + 1)); }
falso() {   # falso <pasta> <nome>: um navegador que anota os argumentos em $T/chamado
  mkdir -p "$1"
  printf '#!/bin/sh\necho "%s $*" > %s/chamado\n' "$2" "$T" > "$1/$2"
  chmod 755 "$1/$2"
}
rodar() {   # rodar <PATH> [argumentos]: roda com HOME de teste e espera o navegador anotar
  p=$1; shift
  rm -f "$T/chamado"
  HOME=$T/casa PATH=$p:/usr/bin:/bin "$LANCADOR" "$@" || return $?
  for i in 1 2 3 4 5 6 7 8 9 10; do [ -f "$T/chamado" ] && break; sleep 0.2; done
}
mkdir -p "$T/casa"
falso "$T/normal" chromium
falso "$T/snap/bin" firefox
falso "$T/escolhido" meu-navegador

rodar "$T/normal:$T/snap/bin"
case "$(cat "$T/chamado")" in "chromium /"*"/TarjaLivre.html") ok "prefere o navegador fora do snap";; *) falhou "escolheu: $(cat "$T/chamado")";; esac

rodar "$T/snap/bin"
copia=$T/casa/snap/firefox/common/tarja-livre/TarjaLivre.html
if [ "$(cat "$T/chamado")" = "firefox $copia" ] && [ -s "$copia" ]; then ok "navegador em snap recebe a cópia em ~/snap/firefox/common"
else falhou "snap: $(cat "$T/chamado" 2>/dev/null)"; fi

rodar "$T/normal" --ocr
case "$(cat "$T/chamado")" in *"/TarjaLivre-OCR.html") ok "--ocr abre a versão com OCR";; *) falhou "--ocr: $(cat "$T/chamado")";; esac

rm -f "$T/chamado"
HOME=$T/casa PATH=$T/normal:/usr/bin:/bin TARJA_NAVEGADOR=$T/escolhido/meu-navegador "$LANCADOR"
sleep 1
case "$(cat "$T/chamado" 2>/dev/null)" in "meu-navegador /"*) ok "TARJA_NAVEGADOR escolhe o navegador";; *) falhou "TARJA_NAVEGADOR";; esac

if HOME=$T/casa "$LANCADOR" --errado 2>/dev/null; then falhou "opção errada devia dar erro"; else ok "opção errada dá erro"; fi
echo "falhas do lançador: $falhas"
[ "$falhas" -eq 0 ]
