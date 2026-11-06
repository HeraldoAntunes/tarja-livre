"""Papel timbrado só com fundo claro e faixa escura, em imagem, sem letras (controle da regra da rc.6: imagem só de
retângulos não dá "confira"). O mesmo texto do c3 de gerar_revisao_rc5.py. Só dados inventados.
Uso: uv run --with pymupdf python -I gerar_papel_faixa.py <pasta>"""
import json
import sys
from pathlib import Path

import pymupdf

PASTA = Path(sys.argv[1]) / 'comum-papel-faixa'
DADO = 'SIGILOCODIGO'
PASTA.mkdir(parents=True, exist_ok=True)
for arq, original in (('original.pdf', True), ('sem-dados.pdf', False)):
    d = pymupdf.open()
    p = d.new_page(width=595, height=842)
    f = pymupdf.open()
    q = f.new_page(width=595, height=842)
    q.draw_rect(q.rect, color=None, fill=(0.97, 0.96, 0.93))
    q.draw_rect(pymupdf.Rect(0, 0, 595, 70), color=None, fill=(0.1, 0.2, 0.4))
    p.insert_image(p.rect, pixmap=q.get_pixmap(dpi=150))
    linhas = ['Oficio 12/2026 - Secretaria Ficticia', 'Interessado: Fulano de Tal Ficticio',
              'Codigo do processo: ' + (DADO if original else ''), 'CPF: ' + ('123.456.789-00' if original else ''),
              'Texto corrido de exemplo, sem dado nenhum, so para encher a pagina.']
    for i, t in enumerate(linhas):
        p.insert_text((72, 160 + 22 * i), t, fontname='helv', fontsize=11, color=(0, 0, 0))
    d.save(PASTA / arq)
(PASTA / 'caso.json').write_text(json.dumps({'termos': [DADO, '123.456.789-00'], 'semConfira': True}) + '\n', encoding='utf-8')
print('ok')
