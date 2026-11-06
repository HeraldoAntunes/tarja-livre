# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
"""Outros jeitos de esconder a camada de texto sobre a imagem, a partir do ocr-longe ORIGINAL da Ordem 24 do Codex
(revisão da 1.2.3-rc.2, achado 2). A imagem é a mesma; a camada SIGILOCODIGO fica fora do lugar das letras da imagem
(como no ocr-longe) e é escondida de um jeito diferente em cada caso:

- opacidade-zero: modo 0 com opacidade de preenchimento zero (o caso do Codex, como o evidence/gerar-adicionais.py dele);
- modo-7: modo 7, só recorte (o clip-invisible do Codex, o controle que já passava);
- recorte-vazio: modo 0 dentro de um recorte de área zero (q 0 0 0 0 re W n ... Q);
- recorte-fora: modo 0 dentro de um recorte de 10 x 10 pontos no canto, longe do texto (só a conferência de tinta pega);
- branco: modo 0 em branco sobre o fundo branco da imagem;
- sob-a-imagem: modo 0 desenhado antes da imagem, que o cobre.

Uso: python -I tests/casos-codex/gerar_escondidos.py   (grava em tests/casos-codex/<caso>/; precisa do PyMuPDF)
Só dados fictícios.
"""
import json
from pathlib import Path

import fitz

AQUI = Path(__file__).resolve().parent
BASE = AQUI / 'ocr-longe'
CASO = {'termos': ['SIGILOCODIGO'], 'confira': True}


def imagem():
    src = fitz.open(BASE / 'original.pdf')
    return src.extract_image(src[0].get_images(full=True)[0][0])['image']


def gravar(nome, montar):
    pasta = AQUI / nome
    pasta.mkdir(exist_ok=True)
    out = fitz.open()
    pagina = out.new_page(width=330, height=185)
    montar(pagina, imagem())
    out.save(pasta / 'original.pdf', garbage=3, deflate=True, no_new_id=True)
    (pasta / 'sem-dados.pdf').write_bytes((BASE / 'sem-dados.pdf').read_bytes())
    (pasta / 'caso.json').write_text(json.dumps(CASO), encoding='utf-8')


def texto(pagina, **opcoes):
    pagina.insert_text((60, 122), 'SIGILOCODIGO', fontname='cour', fontsize=18, **opcoes)


def recortado(retangulo):
    def montar(pagina, img):
        pagina.insert_image(pagina.rect, stream=img)
        texto(pagina, render_mode=0)
        # envolve o último conteúdo (o texto) no recorte
        xref = pagina.get_contents()[-1]
        doc = pagina.parent
        doc.update_stream(xref, b'q ' + retangulo + b' re W n\n' + doc.xref_stream(xref) + b'\nQ')
    return montar


gravar('opacidade-zero', lambda p, img: (p.insert_image(p.rect, stream=img), texto(p, fill_opacity=0, render_mode=0)))
gravar('modo-7', lambda p, img: (p.insert_image(p.rect, stream=img), texto(p, render_mode=7)))
gravar('recorte-vazio', recortado(b'0 0 0 0'))
gravar('recorte-fora', recortado(b'0 0 10 10'))
gravar('branco', lambda p, img: (p.insert_image(p.rect, stream=img), texto(p, color=(1, 1, 1), render_mode=0)))
gravar('sob-a-imagem', lambda p, img: (texto(p, render_mode=0), p.insert_image(p.rect, stream=img)))
print('ok')
