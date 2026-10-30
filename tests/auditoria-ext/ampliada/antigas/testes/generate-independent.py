# Dados exclusivamente fictícios, fixture independente da auditoria.
from reportlab.pdfgen import canvas
from reportlab.lib.colors import black
from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Text
from pathlib import Path
p=Path(__file__).resolve().parent/'fixtures';p.mkdir(exist_ok=True)
c=canvas.Canvas(str(p/'simple-original.pdf'),pagesize=(595,842),pageCompression=0)
c.setFont('Helvetica',20);c.drawString(60,730,'sintetico@exemplo.test');c.drawString(60,680,'Conteudo publico para comparacao');c.save()
r=PdfReader(p/'simple-original.pdf');w=PdfWriter();w.append(r)
w.add_metadata({'/Title':'SEGREDO_METADATA_TESTE','/Author':'AUTOR_FICTICIO_TESTE'})
w.add_js("app.alert('SEGREDO_SCRIPT_TESTE')")
w.add_attachment('segredo-ficticio.txt',b'SEGREDO_ANEXO_TESTE')
w.add_annotation(page_number=0,annotation=Text(text='SEGREDO_COMENTARIO_TESTE',rect=(40,40,60,60)))
with open(p/'simple.pdf','wb') as f:w.write(f)
# /UserUnit preserva caixa válida, mas expõe limite do exportador em pontos físicos.
w=PdfWriter();w.add_blank_page(width=1000,height=50)
from pypdf.generic import NameObject,NumberObject
w.pages[0][NameObject('/UserUnit')]=NumberObject(20)
with open(p/'wide-userunit.pdf','wb') as f:w.write(f)
# Limites/erro: reproduzíveis, sem input externo.
w=PdfWriter();w.append(PdfReader(p/'simple.pdf'));w.encrypt('senha-ficticia');w.write(p/'password.pdf')
w=PdfWriter()
for i in range(1001):w.add_blank_page(width=72,height=72)
w.write(p/'1001-pages.pdf')
