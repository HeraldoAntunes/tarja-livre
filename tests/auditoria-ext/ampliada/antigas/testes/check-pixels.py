# Comparador independente: PyMuPDF, não o leitor usado pelo programa.
from pathlib import Path
import json,sys,os
import fitz,numpy as np
root=Path(os.environ['TARJA_REPO']);out=Path(sys.argv[1]if len(sys.argv)>1 else 'testes/export-real-baseline')
saved=fitz.open(out/'fixture-project.pdf');mask=fitz.open(root/'tests/fixtures/tarja-teste-dados.pdf');rows=[]
for i in range(len(mask)):
 a=mask[i].get_pixmap(matrix=fitz.Matrix(2,2),alpha=False);b=saved[i].get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
 aa=np.frombuffer(a.samples,np.uint8).reshape(a.height,a.width,3).astype(int);bb=np.frombuffer(b.samples,np.uint8).reshape(b.height,b.width,3).astype(int)
 hh=min(a.height,b.height);ww=min(a.width,b.width);bad=(aa[:hh,:ww].sum(2)<300)&(bb[:hh,:ww].sum(2)>150)
 coords=np.argwhere(bad)
 rows.append({'page':i+1,'darkMaskPixels':int((aa.sum(2)<300).sum()),'uncoveredPixels':int(bad.sum()),'firstYX':coords[0].tolist() if coords.size else None})
for name in ['total-png','total-jpeg']:
 d=fitz.open(out/(name+'.pdf'));p=d[0].get_pixmap(alpha=False);a=np.frombuffer(p.samples,np.uint8).reshape(p.height,p.width,3)
 rows.append({'name':name,'interiorNonblackPixels':int((a[2:-2,2:-2]>0).any(2).sum()),'maxInteriorChannel':int(a[2:-2,2:-2].max()),'note':'borda de 2px excluída: antialias/rounding no limite da página, não texto recuperado'})
(out/'pixel-check.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows,indent=2))
