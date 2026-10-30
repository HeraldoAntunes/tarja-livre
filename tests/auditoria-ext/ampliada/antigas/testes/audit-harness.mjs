// Auditoria independente, somente dados sintéticos. Não altera o repositório.
// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas,DOMMatrix,ImageData,Path2D}=require('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
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
export function setup(pdfjs=null) {
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
  document:{getElementById:el,querySelectorAll:()=>[],createElement:t=>{if(t==='canvas'&&pdfjs){const c=createCanvas(1,1);c.style={};c.toBlob=(fn,type,quality)=>{c.encode(type==='image/jpeg'?'jpeg':'png',Math.round((quality||0.88)*100)).then(buf=>fn(new Blob([buf],{type})));};return c;}return el(t+':'+Math.random());},body:el('body')},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  pdfjsLib:pdfjs||{AnnotationMode:{ENABLE:1}},VERSAO:(awaitedVersion),...patterns};
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

