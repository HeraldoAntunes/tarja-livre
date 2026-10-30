// Exportador real e PDF.js vendorizado, canvas nativo Linux: não é navegador.
// SPDX-License-Identifier: MIT
import {setup} from './audit-harness.mjs';
import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import assert from 'node:assert/strict';
const ROOT=resolve(process.env.TARJA_REPO||'../../repos/tarja-livre');const OUT=resolve(process.env.TARJA_OUT||'testes/export-real-baseline');mkdirSync(OUT,{recursive:true});
const lib=await import(pathToFileURL(ROOT+'/vendor/pdfjs/pdf.min.mjs'));lib.GlobalWorkerOptions.workerSrc=ROOT+'/vendor/pdfjs/pdf.worker.min.mjs';
const pdfjs={...lib,getDocument:opts=>lib.getDocument({...opts,useSystemFonts:false,disableFontFace:true,standardFontDataUrl:process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/pdfjs-dist/standard_fonts/'})};
const results=[];
for(const [name,filename,mode] of [['total-png','simple.pdf','full'],['total-jpeg','simple.pdf','jpeg'],['partial-90','simple.pdf','partial'],['wide','wide-userunit.pdf','wide'],['fixture-project','../repo/tests/fixtures/tarja-teste.pdf','fixture']]) {
 const h=setup(pdfjs);const file=filename.startsWith('../')?join(ROOT,'tests/fixtures/tarja-teste.pdf'):resolve('testes/fixtures',filename);const bytes=new Uint8Array(readFileSync(file));
 h.s.__file={name:name+'.pdf',arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 h.s.__doc=await h.run('carregarArquivo(__file)');
 if(!h.s.__doc){results.push({name,rejected:true,alerts:h.s.__alerts,warnings:h.warnings});continue;}
 h.run('doc=__doc;docs.push(doc);');
 let suggestion=null;
 if(mode==='full'||mode==='jpeg')h.run('cobrirPagina()');
 if(mode==='partial'||mode==='fixture') {
   h.s.__terms=mode==='fixture'?{lista:['Fulano de Teste','Beltrana de Exemplo Teste','Ana'],palavraInteira:true,semAcento:true}:null;
   await h.run("procurarEm(doc,Object.keys(TIPOS),()=>{},__terms)");
   if(mode==='partial'){
    suggestion=h.run('JSON.parse(JSON.stringify(doc.paginas[0].sugestoes[0]))');
    h.run(`{const c=doc.paginas[0].sugestoes[0].caixas[0]; registrar([{pagina:0,antes:[],depois:[{tipo:'tarja',cor:'#000000',...c,w:c.w*0.905}]}]);}`);
   }else h.run('aceitarTodas()');
 }
 h.el('revisei').checked=true;h.el('formato').value=mode==='jpeg'?'jpeg':'png';h.el('folha').checked=false;
 h.run('baixar=(bytes)=>{globalThis.__bytes=bytes};');
 const pendingBeforeSave=h.run('doc.paginas.reduce((n,p)=>n+p.sugestoes.length,0)');
 await h.run('salvar()');
 const saveInitiallyBlocked=!h.s.__bytes;
 if(saveInitiallyBlocked&&mode==='partial'&&pendingBeforeSave){h.run('aceitarTodas()');h.el('revisei').checked=true;await h.run('salvar()');}
 assert.ok(h.s.__bytes,name+': '+h.warnings.join('\n'));
 writeFileSync(join(OUT,name+'.pdf'),h.s.__bytes);
 const docOut=await pdfjs.getDocument({data:h.s.__bytes.slice()}).promise;
 const p=await docOut.getPage(1);const v=p.getViewport({scale:1});
 results.push({name,pendingBeforeSave,saveInitiallyBlocked,input:[h.s.__doc.paginas[0].w,h.s.__doc.paginas[0].h],output:[v.width,v.height],suggestion,remainingSuggestions:h.run('doc.paginas.reduce((n,p)=>n+p.sugestoes.length,0)'),warnings:h.warnings,alerts:h.s.__alerts,textFirstPage:(await p.getTextContent()).items.map(x=>x.str).join(''),bytes:h.s.__bytes.length});
 await docOut.destroy();await h.s.__doc.pdf.destroy();
}
writeFileSync(join(OUT,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
