// Test harness only; production sources are loaded read-only into a Node VM.
// UI DOM/events are minimal test doubles. PDF.js/jsPDF are repository versions.
// Canvas is native Skia; IndexedDB is fake-indexeddb, not browser/disk durability.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {createCanvas,DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
import {IDBFactory} from 'fake-indexeddb';
export const root=resolve(process.env.TARJA_REPO);
export const out=resolve(process.env.TARJA_OUT);
const releaseVersion=(await import(pathToFileURL(join(root,'src/versao.js')))).VERSAO;
export const version={name:'Tarja Livre',version:releaseVersion,expected_commit:'cc8b0f38e73e7d3983064f2b6affc6e4039be287'};
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
export const patterns=await import(pathToFileURL(join(root,'src/achados.js')));
const lib=await import(pathToFileURL(join(root,'vendor/pdfjs/pdf.min.mjs')));
lib.GlobalWorkerOptions.workerSrc=pathToFileURL(join(root,'vendor/pdfjs/pdf.worker.min.mjs')).href;
const fontUrl=fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/',import.meta.url));
export const pdfjs={...lib,getDocument:o=>lib.getDocument({...o,useSystemFonts:false,disableFontFace:true,standardFontDataUrl:fontUrl})};
export function setup({idb=new IDBFactory()}={}) {
 const els=new Map(),events=new Map(),warnings=[],downloads=[],tasks=[];
 function el(id='') {
  if(els.has(id))return els.get(id);
  const classes=new Set();
  const e={id,value:'',checked:false,disabled:false,hidden:false,textContent:'',dataset:{},style:{},children:[],
   classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:k=>classes.delete(k),toggle:(k,v)=>v?classes.add(k):classes.delete(k)},
   addEventListener:(k,f)=>events.set(id+':'+k,f),querySelectorAll:()=>[],querySelector:()=>null,
   append(...a){this.children.push(...a)},replaceChildren(...a){this.children=a},remove(){},setAttribute(){},setPointerCapture(){},scrollIntoView(){},
   getBoundingClientRect:()=>({left:0,top:0,right:1000,bottom:1000,width:1000,height:1000}),
   getContext:()=>createCanvas(1,1).getContext('2d'),click(){},clientWidth:1000,clientHeight:1000};
  els.set(id,e);return e;
 }
 const s={exports:{},module:{exports:{}},navigator:{userAgent:'Node-cloud-audit'},
  console:{...console,warn:(...a)=>warnings.push(a.map(String).join(' '))},
  TextEncoder,TextDecoder,Blob,atob,btoa,Uint8Array,ArrayBuffer,Promise,crypto:webcrypto,URL,structuredClone,
  setTimeout:(f,ms)=>{tasks.push({f,ms});return tasks.length},clearTimeout(){},confirm:()=>false,indexedDB:idb,
  document:{getElementById:el,querySelectorAll:()=>[],createElement:t=>{if(t==='canvas'){
   const c=createCanvas(1,1);c.style={};c.toBlob=(f,type,quality)=>c.encode(type==='image/jpeg'?'jpeg':'png',Math.round((quality||0.88)*100)).then(b=>f(new Blob([b],{type})));return c;
  }return el(t+':'+Math.random())},body:el('body')},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},pdfjsLib:{...pdfjs},VERSAO:releaseVersion,...patterns};
 s.window=s;s.self=s;s.globalThis=s;s.addEventListener=(k,f)=>events.set('window:'+k,f);
 vm.createContext(s);vm.runInContext(readFileSync(join(root,'vendor/jspdf/jspdf.umd.min.js'),'utf8'),s);
 s.jspdf=s.exports;
 let source=readFileSync(join(root,'src/app.js'),'utf8').replace(/^import .*;$/gm,'');
 const cutoff=source.indexOf('// worker do PDF.js a partir do texto guardado');
 if(cutoff<0){const e=new Error('Harness boundary missing; update adapter after source review');e.code='HARNESS_UNSUPPORTED';throw e;}
 vm.runInContext(source.slice(0,cutoff),s,{filename:'production/src/app.js'});
 const run=code=>vm.runInContext(code,s);
 s.__download=(bytes,name)=>downloads.push({bytes:new Uint8Array(bytes),name});
 run(`globalThis.__alerts=[];avisar=t=>__alerts.push(t);atualizar=()=>{};montarAbas=()=>{};montarMiniaturas=()=>{};desenharTela=()=>{};redesenharMiniatura=()=>{};desenharBase=async()=>atual;baixar=__download;`);
 el('formato').value='png';
 return {s,el,events,warnings,downloads,tasks,run,idb,async close(){await run('filaAndamento');const db=await run('banco()').catch(()=>null);db?.close();for(const d of run('docs'))await d.pdf?.destroy?.()}};
}
export function install(h,{hash='a'.repeat(64),name='sintetico.pdf',pages=1,w=240,height=180}={}) {
 h.s.__config={hash,name,pages,w,height};
 return h.run(`(()=>{const c=__config;const d={nome:c.name,hash:c.hash,salvo:false,revisado:false,hashSaida:'',aceitas:0,procurou:null,atual:0,zoom:1,historico:[],refazer:[],carimboPagina:0,paginas:Array.from({length:c.pages},()=>({w:c.w,h:c.height,vista:false,marcas:[],sugestoes:[]})),pdf:{destroy(){},getPage:async()=>({getViewport:()=>({width:c.w,height:c.height}),render:()=>({promise:Promise.resolve()})})}};docs.push(d);doc=d;historico=d.historico;refazer=d.refazer;atual=0;base.pagina=0;return d})()`);
}
export async function openBytes(h,bytes,name='sintetico.pdf') {
 h.s.__file={name,arrayBuffer:async()=>new Uint8Array(bytes).buffer};
 const d=await h.run('carregarArquivo(__file)');if(!d)throw Error(h.s.__alerts.join(';'));
 h.s.__loaded=d;h.run('docs.push(__loaded);doc=__loaded;historico=doc.historico;refazer=doc.refazer;base.pagina=0');return d;
}
export async function save(h,{sheet=false}={}){h.el('revisei').checked=true;h.el('folha').checked=sheet;await h.run('salvar()');return h.downloads.at(-1)?.bytes;}
export function evidence(id,value){mkdirSync(join(out,'evidence'),{recursive:true});writeFileSync(join(out,'evidence',id+'.json'),JSON.stringify(value,null,2));return 'evidence/'+id+'.json'}
export function artifact(name,bytes){mkdirSync(join(out,'evidence'),{recursive:true});writeFileSync(join(out,'evidence',name),bytes);return 'evidence/'+name}
export async function render(pdf,pageNumber=1,scale=1){const p=await pdf.getPage(pageNumber);const v=p.getViewport({scale});const c=createCanvas(Math.ceil(v.width),Math.ceil(v.height));await p.render({canvasContext:c.getContext('2d'),viewport:v,intent:'print',annotationMode:lib.AnnotationMode.ENABLE}).promise;return c}
export async function readStore(h,key){h.s.__key=key;return h.run(`noAndamento('readonly',(s,done)=>{s.get(__key).onsuccess=e=>done(e.target.result)})`)}
export async function putStore(h,key,value){h.s.__key=key;h.s.__value=value;await h.run(`noAndamento('readwrite',s=>s.put(__value,__key))`)}
export const flush=()=>new Promise(r=>setImmediate(r));
export {IDBFactory,createCanvas};
