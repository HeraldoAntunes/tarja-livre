// Auditoria independente, somente dados sintéticos. Não altera o repositório.
// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const ROOT = resolve(process.env.TARJA_REPO || '../../repos/tarja-livre');
const OUT = resolve(process.env.TARJA_OUT || 'testes/saidas-baseline');
mkdirSync(OUT, {recursive:true});
const awaitedVersion = (await import(pathToFileURL(join(ROOT,'src/versao.js')))).VERSAO;
const patterns = await import(pathToFileURL(join(ROOT,'src/achados.js')));
const onePixel = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC','base64'));
function setup() {
 const els = new Map(), events = new Map(), warnings=[];
 function el(id='') {
  if(els.has(id)) return els.get(id);
  const cls=new Set();
  const e={id,value:'',checked:false,disabled:false,hidden:false,textContent:'',dataset:{},style:{},children:[],
   classList:{contains:k=>cls.has(k),add:k=>cls.add(k),remove:k=>cls.delete(k),toggle:(k,v)=>v?cls.add(k):cls.delete(k)},
   addEventListener:(k,f)=>events.set(id+':'+k,f),querySelectorAll:()=>[],querySelector:()=>null,
   append(){},replaceChildren(){},remove(){},setAttribute(){},setPointerCapture(){},scrollIntoView(){},
   getBoundingClientRect:()=>({left:0,top:0,right:1000,bottom:1000,width:1000,height:1000}),
   getContext:()=>new Proxy({measureText:t=>({width:String(t).length*6}),getImageData:()=>({data:new Uint8Array(4)})},{get:(o,k)=>o[k]??(()=>{})}),
   toBlob:f=>f(new Blob([onePixel],{type:'image/png'})),click(){},clientWidth:1000,clientHeight:1000};
  els.set(id,e);return e;
 }
 const s={exports:{},module:{exports:{}},navigator:{userAgent:'node-audit'},console:{...console,warn:(...a)=>warnings.push(a.join(' '))},
  TextEncoder,TextDecoder,Blob,atob,btoa,Uint8Array,ArrayBuffer,Promise,crypto:webcrypto,URL,
  setTimeout:()=>0,clearTimeout(){},confirm:()=>false,
  document:{getElementById:el,querySelectorAll:()=>[],createElement:t=>el(t+':'+Math.random()),body:el('body')},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  pdfjsLib:{AnnotationMode:{ENABLE:1}},VERSAO:(awaitedVersion),...patterns};
 s.window=s;s.self=s;s.globalThis=s;s.addEventListener=()=>{};
 vm.createContext(s);
 vm.runInContext(readFileSync(join(ROOT,'vendor/jspdf/jspdf.umd.min.js'),'utf8'),s);
 s.jspdf=s.exports;
 let source=readFileSync(join(ROOT,'src/app.js'),'utf8').replace(/^import .*;$/gm,'');
 const cutoff=source.indexOf('// worker do PDF.js a partir do texto guardado');
 if(cutoff<0)throw Error('HARNESS_UNSUPPORTED: bootstrap boundary missing');
 source=source.slice(0,cutoff);
 vm.runInContext(source,s);
 const run=code=>vm.runInContext(code,s);
 run(`globalThis.__alerts=[]; avisar=(text)=>__alerts.push(text); atualizar=()=>{}; montarAbas=()=>{}; desenharTela=()=>{}; redesenharMiniatura=()=>{};`);
 return {s,els,events,run,warnings,el};
}
function installDoc(h,w=595,hgt=842,pages=1){
 h.run(`doc={nome:'sintetico.pdf', hash:'0'.repeat(64), salvo:false, paginas:Array.from({length:${pages}},()=>({w:${w},h:${hgt},vista:false,marcas:[],sugestoes:[]})),pdf:{getPage:async()=>({getViewport:()=>({width:${w},height:${hgt}}),render:()=>({promise:Promise.resolve()})})}}; docs.push(doc);`);
}

test('TL-01: cobertura parcial de 90% não deve eliminar sugestão',()=>{
 const p={str:'sintetico@exemplo.test',x:50,y:100,w:126,h:10,eol:true};
 const k=patterns.procurar([p],['email'])[0].caixas[0];
 const partial={...k,w:k.w*0.905};
 const remaining=(k.x+k.w)-(partial.x+partial.w);
 writeFileSync(join(OUT,'TL-01-cobertura.json'),JSON.stringify({suggestion:k,partial,remainingPoints:remaining,result:patterns.coberta(k,[partial])},null,2));
 assert.equal(patterns.coberta(k,[partial]),false,`ainda sobram ${remaining.toFixed(2)} pt na extremidade direita`);
});

test('TL-02: página com 20000 pt deve ser recusada, não cortada silenciosamente',async()=>{
 const h=setup();
 h.s.pdfjsLib.getDocument=()=>({promise:Promise.resolve({numPages:1,destroy(){},getPage:async()=>({getViewport:()=>({width:20000,height:1000})})})});
 h.s.__fakefile={name:'pagina-larga.pdf',arrayBuffer:async()=>new TextEncoder().encode('%PDF-1.7 sintetico').buffer};
 const loaded=await h.run('carregarArquivo(__fakefile)');
 if(loaded) {
  installDoc(h,20000,1000);h.el('revisei').checked=true;h.el('formato').value='png';h.el('folha').checked=false;
  h.run(`contarTexto=async()=>0; baixar=(bytes)=>{globalThis.__bytes=bytes};`);
  await h.run('salvar()');
  assert.ok(h.s.__bytes,'exportação produziu bytes: '+JSON.stringify(h.warnings)+' / '+JSON.stringify(h.s.__alerts));
  writeFileSync(join(OUT,'TL-02-exportacao-recortada.pdf'),h.s.__bytes);
  const media=Buffer.from(h.s.__bytes).toString('latin1').match(/\/MediaBox\s*\[([^\]]+)\]/)?.[1];
  writeFileSync(join(OUT,'TL-02-dimensoes.json'),JSON.stringify({input:[20000,1000],outputMediaBox:media,alerts:h.s.__alerts,warnings:h.warnings,limit:'canvas sintético 1px; exportador salvar e jsPDF reais'},null,2));
 }
 assert.equal(loaded,null,'o carregador aceitou dimensões que jsPDF recorta em 14400 pt');
});

test('TL-03: falha de procura não pode virar mensagem Nada encontrado',async()=>{
 const h=setup();installDoc(h);
 h.el('tipos').querySelectorAll=()=>[{value:'email'}];
 h.run(`procurarEm=async()=>{throw new Error('falha sintética do leitor/OCR')};`);
 await h.run('procurarArquivos(docs.slice())');
 writeFileSync(join(OUT,'TL-03-avisos.json'),JSON.stringify(h.s.__alerts,null,2));
 assert.doesNotMatch(h.s.__alerts.at(-1),/Nada encontrado/);
 assert.match(h.s.__alerts.at(-1),/não terminou|falha|erro/i);
});

test('TL-04: página ampliada fora da área visível não deve contar como integralmente vista',async()=>{
 const h=setup();installDoc(h,595,842,2);
 h.run(`desenharBase=async()=>1; zoom=3;`);
 h.el('tela').getBoundingClientRect=()=>({left:0,top:0,right:1800,bottom:2500,width:1800,height:2500});
 h.el('palco').getBoundingClientRect=()=>({left:0,top:0,right:600,bottom:800,width:600,height:800});
 await h.run('mostrar(1)');
 const seen=h.run('doc.paginas[1].vista');
 writeFileSync(join(OUT,'TL-04-vista.json'),JSON.stringify({zoom:3,canvas:[1800,2500],palco:[600,800],vista:seen},null,2));
 assert.equal(seen,false);
});

test('TL-05: mudar página durante arrasto deve cancelar a marca pendente',async()=>{
 const h=setup();installDoc(h,595,842,2);
 h.run(`desenharBase=async()=>atual; arrasto={tipo:'tarja',inicio:[20,30],fim:[100,50]};`);
 await h.run('mostrar(1)');
 h.run('soltar({})');
 const marks=h.run('doc.paginas.map(p=>p.marcas.length)');
 writeFileSync(join(OUT,'TL-05-marcas.json'),JSON.stringify({pageChange:'0 -> 1 while pointer is held',marksPerPage:marks},null,2));
 assert.deepEqual(Array.from(marks),[0,0],'a marca começou na página 1 e foi aplicada indevidamente na página 2');
});

test('TL-06: cancelar arrasto de carimbo não pode alterar sem invalidar revisão',()=>{
 const h=setup();installDoc(h);h.el('revisei').checked=true;
 h.run(`carimbo.ativo=true;arrasto={tipo:'carimbo',dx:0,dy:0};`);
 h.events.get('tela:pointermove')({clientX:500,clientY:500});
 h.events.get('tela:pointercancel')({});
 const state=h.run('({fx:carimbo.fx,fy:carimbo.fy,revised:el.revisei.checked})');
 writeFileSync(join(OUT,'TL-06-carimbo.json'),JSON.stringify(state,null,2));
 assert.ok(!state.revised || (state.fx===0.06&&state.fy===0.86),'cancel mudou carimbo e manteve Revisei ativo');
});

test('controle: cobertura total e undo/redo de tarja funcionam',()=>{
 assert.equal(patterns.coberta({x:0,y:0,w:10,h:10},[{x:0,y:0,w:10,h:10}]),true);
 const h=setup();installDoc(h);h.run('cobrirPagina()');assert.equal(h.run('doc.paginas[0].marcas.length'),1);
 h.run('desfazer()');assert.equal(h.run('doc.paginas[0].marcas.length'),0);
 h.run('refazerUltimo()');assert.equal(h.run('doc.paginas[0].marcas.length'),1);
});
