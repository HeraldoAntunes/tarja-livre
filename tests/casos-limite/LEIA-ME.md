# Casos-limite da 1.2.3 (fora do e2e_prova_ocr)

Limites declarados no Guia e no README, por decisão do professor: a fonte do PDF troca uma letra latina por outra
(x1, da 5ª revisão da rc.12) ou faz uma ou duas letras do dado virarem espaço no texto do PDF (y3, da revisão da
rc.13). O texto que o programa lê não é o que se vê, e só o OCR comparando a imagem com o texto descobriria. Fica para
a 1.2.4, na versão com OCR.

A tentativa de contar letra a letra (rc.14 em preparo, 06/11/2026) está em `tests/calibracao/tentativa-y3-letra-a-letra.diff`:
ela pegava o y3, mas dava ±1 letra em documento comum (ordinal "º", vírgula, hífen suave), e com o limite de 1 letra
isso viraria alarme falso em muito PDF real. Ficou o limite da rc.13 (3 letras pintadas fora da camada).

Os PDFs são só de dados fictícios, gerados por `tests/casos-codex/gerar_revisao_rc12.py` e `gerar_revisao_rc13.py`.
