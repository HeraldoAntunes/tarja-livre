#!/bin/sh
# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-License-Identifier: MIT
# Teste do pacote Linux dentro de um contêiner limpo (Ubuntu ou Debian), como root. Para cada pacote (.deb e
# .tar.gz): instala, abre pelo comando tarja-livre no Chromium com janela (Xvfb), tarja um PDF fictício, salva,
# confere com o pdftotext que o texto saiu, desinstala e confere que nada ficou fora da pasta pessoal.
# Pastas montadas: /pacote (dist/linux), /testes (tests/pacote_linux, com node_modules), /node (Node 22), /navegador
# (Chromium), /resultados (saída). Sem /navegador, testa só instalar e desinstalar (para onde não há como
# instalar as bibliotecas do navegador). Uso: testar_pacote.sh <rótulo>
set -eu
ROTULO=$1
OUT=/resultados/$ROTULO
# os arquivos do próprio teste ficam em $OUT, fora do que é conferido
mkdir -p "$OUT"
MARCA=$OUT/.marca
TMP=$OUT/tmp
mkdir -p "$TMP"
chmod 777 "$TMP"
exec > "$OUT/registro.txt" 2>&1
VERSAO=$(cat /pacote/VERSAO)
DEB=/pacote/tarja-livre_${VERSAO}_all.deb
TGZ=/pacote/TarjaLivre-${VERSAO}-linux.tar.gz
COM_NAVEGADOR=no
[ -d /navegador ] && COM_NAVEGADOR=sim
falhas=0
ok() { echo "PASSOU  $*"; }
falhou() { echo "FALHOU  $*"; falhas=$((falhas + 1)); }
conferir() { if eval "$2"; then ok "$1"; else falhou "$1"; fi; }

echo "== sistema: $(. /etc/os-release; echo "$PRETTY_NAME") ($(uname -m)), dpkg $(dpkg-query -W -f '${Version}' dpkg)"
if [ "$COM_NAVEGADOR" = sim ]; then
  # /preparar-apt.sh (opcional): ajuste do apt para a rede da máquina, por exemplo um proxy
  if [ -x /preparar-apt.sh ]; then /preparar-apt.sh; else apt-get update -q >/dev/null; fi
  export DEBIAN_FRONTEND=noninteractive
  # Xvfb, pdftotext, a conferência dos atalhos e as bibliotecas do Chromium
  apt-get install -y -q --no-install-recommends xvfb poppler-utils desktop-file-utils fonts-liberation libnss3 \
    libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libgtk-3-0 >/dev/null
  apt-get install -y -q --no-install-recommends libasound2t64 >/dev/null 2>&1 || apt-get install -y -q --no-install-recommends libasound2 >/dev/null
  echo "== navegador: $(/navegador/chrome-linux64/chrome --version)"
fi
useradd -m -s /bin/sh professor
H=/home/professor
mkdir -p $H/bin $H/Downloads
cat > $H/bin/chromium <<'EOF'
#!/bin/sh
# o Chromium do teste, com a porta de depuração; --no-sandbox porque o contêiner não tem o que o sandbox usa
exec /navegador/chrome-linux64/chrome --no-sandbox --remote-debugging-port=9222 --user-data-dir="$HOME/.cache/chromium-teste" \
  --no-first-run --no-default-browser-check --password-store=basic --window-size=1400,900 "$@"
EOF
chmod 755 $H/bin/chromium
chown -R professor:professor $H

# lista de tudo fora da pasta pessoal (e fora do que é do sistema em execução)
retrato() {
  find / -xdev \( -path /proc -o -path /sys -o -path /dev -o -path /home -o -path /tmp -o -path /run -o -path /var/tmp \
    -o -path /resultados -o -path /pacote -o -path /testes -o -path /node -o -path /navegador \) -prune -o -print | sort
}
# o que mudou (criado ou modificado) fora da pasta pessoal desde a marca
mudou_desde() {
  find / -xdev \( -path /proc -o -path /sys -o -path /dev -o -path /home -o -path /run -o -path /resultados -o -path /pacote \
    -o -path /testes -o -path /node -o -path /navegador -o -path /tmp/.X11-unix -o -path "/tmp/.X99-lock" \) -prune \
    -o -newer "$MARCA" -print | sort
}

# abre pelo comando dado (como a pessoa, com janela no Xvfb) e tarja; $1 rótulo, $2 comando, $3 HTML esperado
abrir_e_tarjar() {
  if [ "$COM_NAVEGADOR" != sim ]; then
    echo "(sem navegador neste sistema: $1 não abre)"
    su - professor -c "PATH=/usr/bin:/bin $2" && falhou "$1: sem navegador, devia avisar e sair com erro" \
      || ok "$1: sem navegador, avisa e sai com erro"
    return
  fi
  rm -rf $H/Downloads/* $H/.cache/chromium-teste
  su - professor -c "nohup Xvfb :99 -screen 0 1400x900x24 >/dev/null 2>&1 & echo \$! > $TMP/xvfb.pid; sleep 1;
    DISPLAY=:99 PATH=\$HOME/bin:/usr/bin:/bin $2" || { falhou "$1: o comando não abriu"; return; }
  if su - professor -c "/node/bin/node /testes/tarjar.mjs 9222 '$3' \$HOME/Downloads $TMP/captura.png"; then
    ok "$1: abriu $3, tarjou e salvou"
    cp $TMP/captura.png "$OUT/$1.png"
  else
    falhou "$1: tarjar e salvar"
  fi
  kill "$(cat $TMP/xvfb.pid)" 2>/dev/null || true
  pkill -u professor -f chrome-linux64 2>/dev/null || true
  sleep 1
  S=$H/Downloads/ficha-ficticia-tarjado.pdf
  if [ -f "$S" ]; then
    cp "$S" "$OUT/$1-tarjado.pdf"
    conferir "$1: pdftotext da página 1 vazio (texto removido)" "[ -z \"\$(pdftotext -f 1 -l 1 '$S' - | tr -d '[:space:]')\" ]"
    conferir "$1: nenhum dado no texto do PDF salvo" "! pdftotext '$S' - | grep -E -q '831\.975|Fulano|fulano|exemplo\.test'"
    conferir "$1: nenhum dado nos bytes do PDF salvo" "! grep -a -E -q '831\.975|Fulano|fulano\.teste' '$S'"
    conferir "$1: folha de conferência no fim" "pdftotext '$S' - | grep -q 'Folha de conferência'"
    echo "   páginas: $(pdfinfo "$S" | grep Pages)"
  fi
}

# ---------- .deb ----------
echo "== .deb: $(sha256sum "$DEB")"
retrato > $TMP/antes-deb.txt
touch "$MARCA"
dpkg -i "$DEB"
conferir "deb: instalado" "dpkg-query -W -f '\${Status}' tarja-livre | grep -q 'install ok installed'"
conferir "deb: comando tarja-livre no PATH" "[ \"\$(command -v tarja-livre)\" = /usr/bin/tarja-livre ]"
if command -v desktop-file-validate >/dev/null; then
  conferir "deb: atalhos do menu válidos (desktop-file-validate)" \
    "desktop-file-validate /usr/share/applications/br.tarjalivre.TarjaLivre.desktop /usr/share/applications/br.tarjalivre.TarjaLivreOCR.desktop"
fi
conferir "deb: HTML iguais aos do pacote .tar.gz" "tar xzOf '$TGZ' TarjaLivre-$VERSAO-linux/TarjaLivre.html | cmp -s - /usr/share/tarja-livre/TarjaLivre.html"
conferir "deb: lançador com navegadores de mentira (ver as linhas acima)" "su - professor -c '/testes/testar_lancador.sh /usr/bin/tarja-livre'"
abrir_e_tarjar deb "tarja-livre" /usr/share/tarja-livre/TarjaLivre.html
abrir_e_tarjar deb-ocr "tarja-livre --ocr" /usr/share/tarja-livre/TarjaLivre-OCR.html
dpkg --purge tarja-livre
conferir "deb: desinstalado (purge)" "! dpkg-query -W tarja-livre >/dev/null 2>&1"
retrato > $TMP/depois-deb.txt
echo "-- caminhos novos ou que sumiram fora da pasta pessoal depois de instalar, usar e desinstalar:"
diff $TMP/antes-deb.txt $TMP/depois-deb.txt | tee "$OUT/deb-diferenca.txt" || true
# o único caminho novo aceito é o registro do próprio dpkg (no Debian limpo, ele nasce na primeira instalação)
conferir "deb: nada novo fora da pasta pessoal depois de desinstalar (fora o registro do dpkg)" \
  "! grep '^>' $OUT/deb-diferenca.txt | grep -v -x '> /var/log/dpkg.log' | grep -q ."
echo "-- arquivos modificados fora da pasta pessoal (do sistema, não do pacote):"
mudou_desde | tee "$OUT/deb-modificados.txt"
echo "-- o que ficou na pasta pessoal:"
find $H -path $H/Downloads -prune -o -newer "$MARCA" -print | grep -v -e chromium-teste -e '/bin' | sort

# ---------- .tar.gz, por conta ----------
echo "== .tar.gz: $(sha256sum "$TGZ")"
touch "$MARCA"
retrato > $TMP/antes-tgz.txt
su - professor -c "cd \$HOME/Downloads && tar xzf '$TGZ' && cd TarjaLivre-$VERSAO-linux && ./instalar.sh"
conferir "tgz: instalado em ~/.local/share/tarja-livre" "[ -x $H/.local/share/tarja-livre/tarja-livre ] && [ -f $H/.local/share/applications/br.tarjalivre.TarjaLivre.desktop ]"
if command -v desktop-file-validate >/dev/null; then
  conferir "tgz: atalhos do menu válidos" "desktop-file-validate $H/.local/share/applications/br.tarjalivre.TarjaLivre*.desktop"
fi
conferir "tgz: o atalho chama o tarja-livre da pasta pessoal" "grep -q '^Exec=\"$H/.local/share/tarja-livre/tarja-livre\"' $H/.local/share/applications/br.tarjalivre.TarjaLivre.desktop"
rm -rf $H/Downloads/TarjaLivre-$VERSAO-linux
abrir_e_tarjar tgz "\$HOME/.local/share/tarja-livre/tarja-livre" $H/.local/share/tarja-livre/TarjaLivre.html
su - professor -c "\$HOME/.local/share/tarja-livre/desinstalar.sh"
conferir "tgz: desinstalado, sem sobra em ~/.local/share" "[ -z \"\$(find $H/.local/share -name '*arja*')\" ]"
# o Chromium deixa em /tmp as travas dele (org.chromium.Chromium.*), em qualquer uso; o resto tem de ficar igual
conferir "tgz: nada mudou fora da pasta pessoal (fora as travas do Chromium em /tmp)" \
  "[ -z \"\$(mudou_desde | grep -v -e '^/tmp\$' -e '^/tmp/org.chromium.Chromium')\" ]"
mudou_desde > "$OUT/tgz-modificados.txt"
retrato > $TMP/depois-tgz.txt
conferir "tgz: nenhum caminho novo fora da pasta pessoal" "diff -q $TMP/antes-tgz.txt $TMP/depois-tgz.txt >/dev/null"

echo
echo "falhas: $falhas"
[ "$falhas" -eq 0 ]
