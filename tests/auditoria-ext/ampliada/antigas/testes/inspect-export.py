# Verificação independente com PyMuPDF e pypdf, não com o leitor do programa.
from pathlib import Path
import json,sys,hashlib,re
import fitz
from pypdf import PdfReader
from PIL import Image
base=Path(sys.argv[1] if len(sys.argv)>1 else 'testes/export-real-baseline')
rows=[]
for f in sorted(base.glob('*.pdf')):
 r=PdfReader(f);d=fitz.open(f)
 row={'file':str(f),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'pages':len(r.pages),'dimensions':[[float(p.mediabox.width),float(p.mediabox.height)]for p in r.pages],'text':''.join(p.extract_text() or '' for p in r.pages),'metadata':dict(r.metadata or {}),'attachments':list(r.attachments),'hasAcroForm':'/AcroForm'in r.trailer['/Root'],'annotations':sum(len(p.get('/Annots',[]))for p in r.pages),'javascriptNames':'/JavaScript'in r.trailer['/Root'].get('/Names',{}),'rawForbidden':[]}
 for s in [b'SEGREDO_METADATA_TESTE',b'AUTOR_FICTICIO_TESTE',b'SEGREDO_ANEXO_TESTE',b'SEGREDO_COMENTARIO_TESTE',b'SEGREDO_SCRIPT_TESTE',b'sintetico@exemplo.test']:
  if s in f.read_bytes():row['rawForbidden'].append(s.decode())
 if f.stem in ('total-png','total-jpeg'):
  pix=d[0].get_pixmap(matrix=fitz.Matrix(1,1),alpha=False);samples=pix.samples;row['nonblackPixels']=sum(any(samples[k+j]>0 for j in range(3))for k in range(0,len(samples),3))
 if f.stem=='partial-90':
  pix=d[0].get_pixmap(matrix=fitz.Matrix(3,3),clip=fitz.Rect(45,80,300,130),alpha=False);pix.save(str(base/'partial-visible-suffix.png'))
 if f.stem=='fixture-project':
  d[0].get_pixmap(matrix=fitz.Matrix(1,1),alpha=False).save(str(base/'fixture-page1.png'))
 rows.append(row)
(base/'independent-inspection.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print(json.dumps(rows,ensure_ascii=False,indent=2))
