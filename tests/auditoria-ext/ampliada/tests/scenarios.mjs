import assert from 'node:assert/strict';
import {PDFDocument,PDFName,rgb} from 'pdf-lib';
import {setup,install,openBytes,save,evidence,artifact,pdfjs,render,patterns,readStore,putStore,IDBFactory,flush} from './harness.mjs';
import {simple,activeContent,croppedRotations} from './fixtures.mjs';
export const tests=[];
function add(id,category,title,assertion,execution_level,run){tests.push({id,category,title,assertion,execution_level,run})}
const mark={tipo:'tarja',cor:'#000000',x:10,y:10,w:40,h:20};
function snapshot(marks=[mark],when=Date.now()){return {quando:when,paginas:[{vista:false,marcas:marks}]}}
const clone=v=>JSON.parse(JSON.stringify(v));
async function activate(h,d){h.s.__target=d;await h.run('ativar(__target)');await flush()}
async function loadedTwo(h){const a=await openBytes(h,await simple({label:'DOCUMENT A'}),'A.pdf');h.run('guardarEstado()');const b=await openBytes(h,await simple({label:'DOCUMENT B'}),'B.pdf');return {a,b}}

add('TL-X01','seguranca/exportacao','Exportação elimina JavaScript, anexos, links, formulários e metadados sensíveis',
 'Fixture positiva contém cada classe de conteúdo; o PDF real exportado não mantém essas estruturas nem os marcadores secretos.',
 'exportacao_pdf_real + PDF.js/jsPDF + canvas nativo + DOM simulado',async()=>{
 const h=setup();const input=await activeContent();artifact('TL-X01-input.pdf',input);const d=await openBytes(h,input,'SECRET_FILENAME_914.pdf');
 const pre={attachments:Object.keys(await d.pdf.getAttachments()||{}),js:await d.pdf.getJSActions(),metadata:(await d.pdf.getMetadata()).info,annotations:(await(await d.pdf.getPage(1)).getAnnotations()).map(a=>a.subtype)};
 assert.ok(pre.attachments.length>0);assert.ok(pre.js);assert.ok(pre.annotations.includes('Widget'));assert.ok(pre.annotations.includes('Link'));assert.equal(pre.metadata.Author,'SECRET_AUTHOR_914');
 await h.run("procurarEm(doc,['email'],()=>{})");assert.ok(h.run('doc.paginas[0].sugestoes.length')>0);h.run('aceitarTodas()');
 const bytes=await save(h);assert.ok(bytes);artifact('TL-X01-export.pdf',bytes);
 const parsed=await pdfjs.getDocument({data:bytes.slice()}).promise;const post={attachments:await parsed.getAttachments(),js:await parsed.getJSActions(),metadata:(await parsed.getMetadata()).info,annotations:await(await parsed.getPage(1)).getAnnotations(),text:(await(await parsed.getPage(1)).getTextContent()).items.map(x=>x.str).join('')};
 const structure=await PDFDocument.load(bytes);post.catalog=structure.catalog.keys().map(String);
 evidence('TL-X01',{pre,post,alerts:h.s.__alerts});assert.equal(post.attachments,null);assert.equal(post.js,null);assert.equal(post.annotations.length,0);assert.equal(post.text,'');assert.doesNotMatch(JSON.stringify(post),/SECRET_/);assert.equal(structure.catalog.has(PDFName.of('AcroForm')),false);await parsed.destroy();await h.close();
});

add('TL-X02','geometria/pdf','Tarjas em CropBox deslocado com /Rotate 0/90/180/270 preservam conteúdo público',
 'Todos os pixels vermelhos do segredo devem ficar pretos; marcador azul de controle permanece; dimensões de cada CropBox/rotação preservadas.',
 'exportacao_pdf_real + verificacao_pixels + PDF.js/jsPDF/canvas nativo',async()=>{
 const h=setup();const input=await croppedRotations();artifact('TL-X02-input.pdf',input);const d=await openBytes(h,input);
 const before=[];for(let i=1;i<=4;i++)before.push(await render(d.pdf,i));
 await h.run("procurarEm(doc,[],()=>{},{lista:['SYNTHETICSECRET'],palavraInteira:true,semAcento:true})");
 assert.deepEqual(Array.from(h.run('doc.paginas.map(p=>p.sugestoes.length)')),[1,1,1,1]);h.run('aceitarTodas()');const bytes=await save(h);assert.ok(bytes);artifact('TL-X02-export.pdf',bytes);
 const parsed=await pdfjs.getDocument({data:bytes.slice()}).promise,checks=[];
 for(let i=1;i<=4;i++){
  const a=before[i-1],b=await render(parsed,i);assert.equal(b.width,a.width);assert.equal(b.height,a.height);
  const ai=a.getContext('2d').getImageData(0,0,a.width,a.height).data,bi=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
  let red=0,redHidden=0,blue=0,blueKept=0;
  for(let p=0;p<ai.length;p+=4){if(ai[p]>150&&ai[p+1]<80&&ai[p+2]<80){red++;if(bi[p]<50&&bi[p+1]<50&&bi[p+2]<50)redHidden++}if(ai[p]<50&&ai[p+1]<50&&ai[p+2]>180){blue++;if(bi[p]<70&&bi[p+1]<70&&bi[p+2]>150)blueKept++}}
  checks.push({page:i,rotation:(i-1)*90,width:a.width,height:a.height,red,redHidden,blue,blueKept});artifact(`TL-X02-page${i}-input.png`,a.toBuffer('image/png'));artifact(`TL-X02-page${i}-export.png`,b.toBuffer('image/png'));
 }
 evidence('TL-X02',{checks});for(const c of checks){assert.ok(c.red>30);assert.ok(c.blue>30);assert.ok(c.redHidden/c.red>=0.995,JSON.stringify(c));assert.ok(c.blueKept/c.blue>=0.98,JSON.stringify(c))}await parsed.destroy();await h.close();
});

add('TL-X03','unicode/termos','Termos Unicode não-BMP e acentos decompostos mantêm o intervalo e os limites de palavra',
 'Pesquisa após prefixo emoji e entre caracteres CJK não desloca caixas e não aceita substring no interior da palavra; NFC/NFD com ignorar acento mantêm acerto.',
 'core_JS_real sem PDF/DOM',async()=>{
 const str='🔒 Jose\u0301 da Silva | José da Silva | 漢Ana字 | Ana';
 const terms={lista:['José da Silva','Ana'],palavraInteira:true,semAcento:true};
 const hits=patterns.procurar([{str,x:10,y:30,w:str.length*6,h:12,eol:true}],[],null,terms);
 evidence('TL-X03',{str,hits});assert.equal(hits.length,3);assert.equal(hits.filter(x=>x.trecho==='Ana').length,1);assert.equal(hits[0].ini,str.indexOf('Jose'));assert.ok(hits.every(x=>x.caixas.every(k=>Object.values(k).every(Number.isFinite))));
 assert.equal(hits.find(x=>x.trecho==='Ana').ini,str.lastIndexOf('Ana'));
});

add('TL-X04','recuperacao/IndexedDB','Abort de transação não envenena a fila e nova alteração pode ser salva',
 'Snapshot anterior permanece após abort real do emulador; erro é observável; transação posterior confirma a geometria nova.',
 'core_JS_real + fake-indexeddb (abort real do emulador)',async()=>{
 const h=setup();install(h);h.el('guardarAndamento').checked=true;h.run('doc.paginas[0].marcas=[{tipo:"tarja",cor:"#000",x:10,y:10,w:40,h:20}]');await h.run('gravarAndamento()');
 const db=await h.run('banco()');const original=db.transaction.bind(db);let aborted=false;
 db.transaction=(...args)=>{const tx=original(...args);if(args[1]==='readwrite'&&!aborted){aborted=true;queueMicrotask(()=>tx.abort())}return tx};
 h.run('doc.paginas[0].marcas[0].x=30');await h.run('gravarAndamento()');const afterAbort=await readStore(h,'a'.repeat(64));assert.equal(afterAbort.paginas[0].marcas[0].x,10);assert.ok(h.warnings.length>0);
 await h.run('gravarAndamento()');const afterRetry=await readStore(h,'a'.repeat(64));evidence('TL-X04',{aborted,afterAbort,afterRetry,warnings:h.warnings});assert.equal(afterRetry.paginas[0].marcas[0].x,30);await h.close();
});

add('TL-X05','recuperacao/validacao','Snapshot malformado deve ser recusado sem quebrar a oferta de recuperação',
 'Mesmo hash e contagem de páginas não bastam: marcas:null não pode causar TypeError nem virar oferta recuperável.',
 'core_JS_real + fake-indexeddb + DOM simulado',async()=>{
 const h=setup();const d=install(h);await putStore(h,d.hash,snapshot());await h.run('mostrarAndamento()');assert.equal(d.andamentoPendente,true,'controle positivo válido');
 d.andamentoPendente=false;d.andamentoGuardado=null;await putStore(h,d.hash,{quando:Date.now(),paginas:[{vista:true,marcas:null}]});
 let error=null;try{await h.run('mostrarAndamento()')}catch(e){error={name:e.name,message:e.message}}
 evidence('TL-X05',{error,pending:d.andamentoPendente,guarded:d.andamentoGuardado,alerts:h.s.__alerts});await h.close();assert.equal(error,null,'snapshot malformado derruba mostrarAndamento');assert.equal(d.andamentoPendente,false);
});

add('TL-X06','recuperacao/disponibilidade','Falha transitória ao abrir IndexedDB deve permitir tentativa posterior',
 'Após uma falha de abertura, a próxima edição tenta abrir o banco novamente e grava; promessa rejeitada não pode ficar cacheada para sempre.',
 'core_JS_real + primeira open falha injetada + fake-indexeddb na retentativa',async()=>{
 const actual=new IDBFactory();let calls=0;const idb={open(...args){calls++;if(calls===1){const q={error:new Error('transient synthetic IndexedDB opening failure')};queueMicrotask(()=>q.onerror?.({target:q}));return q}return actual.open(...args)}};
 const h=setup({idb});install(h);h.el('guardarAndamento').checked=true;h.run('doc.paginas[0].marcas=[{tipo:"tarja",cor:"#000",x:1,y:2,w:3,h:4}]');await h.run('gravarAndamento()');await h.run('gravarAndamento()');
 const healthy=setup({idb:actual});install(healthy,{hash:'b'.repeat(64)});await putStore(healthy,'b'.repeat(64),snapshot());const freshContextWorks=!!(await readStore(healthy,'b'.repeat(64)));await healthy.close();assert.ok(freshContextWorks);
 evidence('TL-X06',{openCalls:calls,freshContextWorks,warnings:h.warnings});assert.ok(calls>=2,'a Promise rejeitada em bancoAndamento impede nova abertura');assert.ok(await readStore(h,'a'.repeat(64)));await h.close();
});

add('TL-X07','recuperacao/retencao','Limpeza por sete dias remove vencidos sem apagar hash vizinho recente',
 'Cursor IndexedDB remove timestamp vencido/inválido, conserva recente e só oferece recuperação ao hash correspondente.',
 'core_JS_real + fake-indexeddb (cursor/transacoes)',async()=>{
 const h=setup();const d=install(h);await putStore(h,'a'.repeat(64),snapshot([mark],Date.now()-8*86400000));await putStore(h,'b'.repeat(64),snapshot());await putStore(h,'c'.repeat(64),{quando:'not-a-date',paginas:[]});
 await h.run('limparAndamentoVelho()');const expired=await readStore(h,d.hash),recent=await readStore(h,'b'.repeat(64)),invalid=await readStore(h,'c'.repeat(64));const offer=await h.run('andamentoDe(doc)');evidence('TL-X07',{expired:expired??null,recent,invalid:invalid??null,offer});assert.equal(expired,undefined);assert.equal(invalid,undefined);assert.ok(recent);assert.equal(offer,null);await h.close();
});

add('TL-X08','usabilidade/concorrencia','Dois abrir simultâneos do mesmo PDF não podem criar abas duplicadas',
 'Ambas leituras concorrentes do mesmo SHA convergem para um único documento, mantendo o controle sequencial de deduplicação.',
 'importacao_PDF_real + chamadas concorrentes Node/DOM simulado',async()=>{
 const h=setup();const bytes=await simple();const control=setup();const existing=await openBytes(control,bytes);const sequential=await control.run('carregarArquivo(__file)');assert.equal(sequential,existing);await control.close();h.s.__file={name:'duplicado.pdf',arrayBuffer:async()=>bytes.slice().buffer};
 let release;const gate=new Promise(r=>release=r),original=h.s.pdfjsLib.getDocument;let parsed=0;
 // A fixed implementation may coalesce/serialize imports. The gate MUST also open with one parser.
 const gateTimeout=setTimeout(release,250);
 h.s.pdfjsLib.getDocument=opts=>({promise:original(opts).promise.then(async d=>{parsed++;if(parsed===2){clearTimeout(gateTimeout);release()}await gate;return d})});
 await Promise.all([h.run('abrirArquivos([__file])'),h.run('abrirArquivos([__file])')]);const state=h.run('docs.map(d=>({nome:d.nome,hash:d.hash}))');
 evidence('TL-X08',{sequentialDedupPassed:true,interleaving:'both real parsers finish after both SHA duplicate checks (gate also releases after 250ms)',documents:state,alerts:h.s.__alerts});await h.close();assert.equal(state.length,1,'duas aberturas concorrentes criaram duas abas do mesmo SHA');
});

add('TL-X09','limites/concorrencia','Limite de 20 arquivos continua válido com importações concorrentes',
 'Partindo de 19 abas, duas importações válidas concorrentes não podem elevar docs.length a 21.',
 'importacao_PDF_real (2 entradas) + 19 docs mínimos + barreira de interleaving',async()=>{
 const h=setup();for(let i=0;i<19;i++)install(h,{hash:String(i).padStart(64,'0'),name:`existing-${i}.pdf`});
 let release;const gate=new Promise(r=>release=r),original=h.s.pdfjsLib.getDocument;let parsed=0;
 // A fixed implementation may coalesce/serialize imports. The gate MUST also open with one parser.
 const gateTimeout=setTimeout(release,250);
 h.s.pdfjsLib.getDocument=opts=>({promise:original(opts).promise.then(async d=>{parsed++;if(parsed===2){clearTimeout(gateTimeout);release()}await gate;return d})});
 const ba=await simple({label:'NEW A'}),bb=await simple({label:'NEW B'});h.s.__files=[{name:'new-A.pdf',arrayBuffer:async()=>ba.slice().buffer},{name:'new-B.pdf',arrayBuffer:async()=>bb.slice().buffer}];
 await Promise.all([h.run('abrirArquivos([__files[0]])'),h.run('abrirArquivos([__files[1]])')]);
 const count=h.run('docs.length');evidence('TL-X09',{initialCount:19,concurrentRequests:2,realParsedPdfCount:parsed,finalCount:count,alerts:h.s.__alerts});await h.close();assert.ok(count<=20,`limite excedido: ${count}`);
});

add('TL-X10','seguranca/salvar-contexto','Importação já pendente não pode trocar o PDF associado a Salvar como',
 'Importação B iniciada antes de salvar A termina durante o picker; destino escolhido para A deve receber A ou ser cancelado, nunca B.',
 'exportacao_PDF_real + SaveFilePicker Promise controlada + DOM simulado',async()=>{
 const h=setup();const inputA=await simple({label:'DOCUMENT A'}),bDoc=await PDFDocument.load(await simple({label:'DOCUMENT B'}));
 bDoc.getPage(0).drawRectangle({x:100,y:70,width:40,height:40,color:rgb(1,0,0)});const inputB=await bDoc.save();artifact('TL-X10-A-input.pdf',inputA);artifact('TL-X10-B-input.pdf',inputB);
 const a=await openBytes(h,inputA,'A.pdf');h.run('cobrirPagina()');h.el('revisei').checked=true;
 let releaseRead;h.s.__incoming={name:'B.pdf',arrayBuffer:()=>new Promise(r=>releaseRead=r)};
 const opening=h.run('abrirArquivos([__incoming])');
 let releasePicker;const writes=[];h.s.showSaveFilePicker=()=>new Promise(r=>releasePicker=r);const pending=h.run('salvar()');
 releaseRead(inputB.slice().buffer);await opening;
 const b=h.run("docs.find(d=>d.nome==='B.pdf')");const activeBeforePickerResolution=h.run('doc.nome');
 releasePicker({name:'A-tarjado.pdf',createWritable:async()=>({write:async bytes=>writes.push(new Uint8Array(bytes)),close:async()=>{}})});await pending;
 let sample=null;if(writes.length){artifact('TL-X10-written-as-A.pdf',writes[0]);const pd=await pdfjs.getDocument({data:writes[0].slice()}).promise;const c=await render(pd);sample=Array.from(c.getContext('2d').getImageData(120,90,1,1).data);artifact('TL-X10-written-as-A.png',c.toBuffer('image/png'));await pd.destroy()}
 evidence('TL-X10',{interleaving:['open B starts, File.arrayBuffer pending','save A starts, picker pending','B read resolves, abrirArquivos completes and activates B','picker for A resolves, salvar uses current doc'],activeBeforePickerResolution,writes:writes.length,centerPixel:sample,expectedA:[0,0,0,255],expectedB:[255,0,0,255],aSaved:a.hashSaida,bSaved:b.hashSaida,alerts:h.s.__alerts});await h.close();assert.ok(!writes.length||(sample[0]<30&&sample[1]<30&&sample[2]<30),'destino selecionado para A recebeu B não tarjado');assert.equal(b.hashSaida,'','B não pode ser marcado salvo pela operação de A');
});

add('TL-X11','usabilidade/acoes-repetidas','Reentrada direta de salvar durante picker deve ter exclusão de operação',
 'Enquanto existe salvar pendente, segunda invocação direta deve ser rejeitada; exclusão da função JS, não afirmação de dois cliques alcançáveis em diálogo nativo.',
 'exportacao_PDF_real + reentrada programatica + picker simulado (nao prova alcance UI)',async()=>{
 const h=setup();await openBytes(h,await simple());h.run('cobrirPagina()');h.el('revisei').checked=true;const waiters=[],writes=[];
 h.s.showSaveFilePicker=()=>new Promise(r=>waiters.push(r));const first=h.run('salvar()'),second=h.run('salvar()');const pickerCalls=waiters.length;
 for(const r of waiters)r({name:'output.pdf',createWritable:async()=>({write:async bytes=>writes.push(new Uint8Array(bytes)),close:async()=>{}})});await Promise.all([first,second]);
 evidence('TL-X11',{pickerCalls,writes:writes.length,alerts:h.s.__alerts});await h.close();assert.equal(pickerCalls,1,'duas invocações da API simulada foram admitidas pela função salvar');assert.equal(writes.length,1);
});

add('TL-X12','usabilidade/assincrono','Seleção de texto suspensa é descartada após trocar de documento',
 'Resultado de getTextContent de A que termina com B ativo não cria tarja em B nem A; nova seleção no documento atual continua funcional.',
 'core_JS_real + Promise de texto controlada + DOM simulado',async()=>{
 const h=setup();const a=install(h,{hash:'a'.repeat(64)});h.run('guardarEstado()');const b=install(h,{hash:'b'.repeat(64)});await activate(h,a);
 let release;h.s.__pending=new Promise(r=>release=r);h.s.__selection={inicio:[0,15],fim:[100,15],pronto:h.s.__pending};const work=h.run('soltarTexto(__selection)');await activate(h,b);release([{str:'SYNTHETIC',x:0,y:20,w:100,h:15,eol:true}]);await work;
 assert.equal(a.paginas[0].marcas.length,0);assert.equal(b.paginas[0].marcas.length,0);h.s.__selection={inicio:[0,15],fim:[100,15],pronto:Promise.resolve([{str:'SYNTHETIC',x:0,y:20,w:100,h:15,eol:true}])};await h.run('soltarTexto(__selection)');evidence('TL-X12',{marksA:a.paginas[0].marcas,marksBAfterFresh:b.paginas[0].marcas});assert.ok(b.paginas[0].marcas.length>0);await h.close();
});

add('TL-X13','usabilidade/historico','Aceite multipágina, undo, edição divergente e troca de aba não ressuscitam redo antigo',
 'Aceites/counters/sugestões voltam juntos; nova edição invalida o redo; histórico independente por documento após alternar abas.',
 'core_JS_real + DOM simulado',async()=>{
 const h=setup();const a=install(h,{pages:2});for(const p of a.paginas)p.sugestoes=[{tipo:'email',trecho:'synthetic@example.test',caixas:[{x:10,y:10,w:80,h:10}]}];
 h.run('aceitarTodas()');assert.equal(a.aceitas,2);assert.deepEqual(Array.from(a.paginas,p=>p.marcas.length),[1,1]);h.run('desfazer()');assert.equal(a.aceitas,0);assert.deepEqual(Array.from(a.paginas,p=>p.sugestoes.length),[1,1]);
 h.run('cobrirPagina()');assert.equal(h.run('refazer.length'),0);h.run('guardarEstado()');const b=install(h,{hash:'b'.repeat(64)});h.run('cobrirPagina();desfazer()');await activate(h,a);h.run('refazerUltimo()');assert.equal(a.paginas[1].marcas.length,0);assert.equal(a.aceitas,0);await activate(h,b);h.run('refazerUltimo()');
 evidence('TL-X13',{a:clone(a.paginas),b:clone(b.paginas),acceptedA:a.aceitas,acceptedB:b.aceitas});assert.equal(b.paginas[0].marcas.length,1);assert.equal(a.paginas[1].marcas.length,0);await h.close();
});

add('TL-X14','exportacao/falhas','Falha de renderização na segunda página não publica PDF parcial e permite retentar',
 'Nenhum download parcial/sucesso; UI destrava; tarjas e recuperação continuam; nova tentativa gera todas as páginas e remove recuperação só após salvar.',
 'exportacao_PDF_real + falha controlada em render da página 2',async()=>{
 const h=setup();const d=await openBytes(h,await simple({pages:2}));h.run('cobrirPagina()');h.el('guardarAndamento').checked=true;await h.run('gravarAndamento()');
 const original=d.pdf.getPage.bind(d.pdf);let fail=true;d.pdf.getPage=async n=>{const p=await original(n);if(n===2&&fail)return new Proxy(p,{get(t,k){if(k==='render')return ()=>({promise:Promise.reject(new Error('synthetic renderer failure page 2'))});const v=t[k];return typeof v==='function'?v.bind(t):v}});return p};
 await save(h);const state={downloads:h.downloads.length,saved:d.salvo,busy:h.run('ocupado()'),recovery:await readStore(h,d.hash),alerts:h.s.__alerts.slice()};
 assert.equal(state.downloads,0);assert.equal(state.saved,false);assert.equal(state.busy,false);assert.ok(state.recovery);assert.doesNotMatch(state.alerts.at(-1),/PDF salvo/);
 fail=false;const bytes=await save(h);assert.ok(bytes);artifact('TL-X14-retry.pdf',bytes);const pd=await pdfjs.getDocument({data:bytes.slice()}).promise;assert.equal(pd.numPages,2);await h.run('filaAndamento');const recoveryAfter=await readStore(h,d.hash);evidence('TL-X14',{failedAttempt:state,retry:{pages:pd.numPages,saved:d.salvo,recovery:recoveryAfter??null}});assert.equal(recoveryAfter,undefined);await pd.destroy();await h.close();
});

add('TL-X15','exportacao/persistencia','Falha ao fechar o stream preserva estado não salvo e recuperação para repetir',
 'write bem-sucedido não basta: close rejeitado não marca salvo nem limpa recuperação; retentativa confirmada pode terminar normalmente.',
 'exportacao_PDF_real + stream de destino simulado com close rejeitado',async()=>{
 const h=setup();const d=await openBytes(h,await simple());h.run('cobrirPagina()');h.el('guardarAndamento').checked=true;await h.run('gravarAndamento()');let fail=true,closes=0,writes=0;
 h.s.showSaveFilePicker=async()=>({name:'selected.pdf',createWritable:async()=>({write:async()=>{writes++},close:async()=>{closes++;if(fail)throw Error('synthetic failure flushing file')}})});
 await save(h);const failed={saved:d.salvo,hash:d.hashSaida,recovery:await readStore(h,d.hash),alerts:h.s.__alerts.slice(),writes,closes};assert.equal(d.salvo,false);assert.equal(d.hashSaida,'');assert.ok(failed.recovery);assert.match(h.s.__alerts.at(-1),/Não foi possível gravar/);
 fail=false;await save(h);await h.run('filaAndamento');const after=await readStore(h,d.hash);evidence('TL-X15',{failed,retry:{saved:d.salvo,hash:d.hashSaida,writes,closes,recovery:after??null}});assert.equal(d.salvo,true);assert.equal(writes,2);assert.equal(closes,2);assert.equal(after,undefined);await h.close();
});

add('TL-X16','importacao/unicode','Leitura .txt interrompida preserva lista; retentativa BOM/CRLF/CJK/emoji é utilizável',
 'Erro de leitura não altera termos atuais; mesma operação posterior importa delimitadores Windows/Linux e Unicode sem perder texto nem criar duplicatas exatas.',
 'core_JS_real + File.text simulado (texto UTF-8 sintético)',async()=>{
 const h=setup();h.el('termos').value='Ana';h.s.__file={size:20,text:async()=>{throw Error('synthetic interrupted file read')}};await h.run('importarTermos(__file)');assert.equal(h.el('termos').value,'Ana');assert.match(h.s.__alerts.at(-1),/Não foi possível ler/);
 const text='\uFEFFANA\r\nMÜLLER\r\n李小龍;🧪 Teste\nMÜLLER';h.s.__file={size:Buffer.byteLength(text),text:async()=>text};await h.run('importarTermos(__file)');const actual=h.el('termos').value.split('\n');
 const hits=patterns.procurar([{str:'李小龍 — 🧪 Teste — Müller',x:0,y:25,w:220,h:15}],[],null,{lista:actual,palavraInteira:true,semAcento:true});evidence('TL-X16',{imported:actual,hits,alerts:h.s.__alerts});assert.deepEqual(actual,['Ana','MÜLLER','李小龍','🧪 Teste']);assert.equal(hits.length,3);await h.close();
});

add('TL-X17','limites/renderizacao','Escala segura limita área/lado sem perder dimensão física no PDF com UserUnit',
 'No envelope aceito, dimensões rasterizadas respeitam 12.000 px e 36M pixels; PDF real com UserUnit=2 mantém dimensão física exportada.',
 'core_JS_real para limite + exportacao_PDF_real pequena com UserUnit',async()=>{
 const h=setup(),checks=[];for(const [w,height] of [[14400,14400],[14400,10],[10,14400],[595,842]]){h.s.__p={w,h:height};const scale=h.run('escalaSegura(__p,150/72)');const pw=Math.round(w*scale),ph=Math.round(height*scale);checks.push({w,h:height,scale,pw,ph,pixels:pw*ph});assert.ok(pw<=12000&&ph<=12000);assert.ok(pw*ph<=36000000+12000,'arredondamento tolerado em uma linha de pixels')}
 const doc=await PDFDocument.create(),page=doc.addPage([120,90]);page.node.set(PDFName.of('UserUnit'),doc.context.obj(2));page.drawText('CONTROL',{x:5,y:40,size:10});const input=await doc.save();artifact('TL-X17-input.pdf',input);const d=await openBytes(h,input);assert.equal(d.paginas[0].w,240);assert.equal(d.paginas[0].h,180);const bytes=await save(h);assert.ok(bytes);artifact('TL-X17-export.pdf',bytes);const pd=await pdfjs.getDocument({data:bytes.slice()}).promise,v=(await pd.getPage(1)).getViewport({scale:1});evidence('TL-X17',{checks,inputSize:[d.paginas[0].w,d.paginas[0].h],outputSize:[v.width,v.height]});assert.deepEqual([v.width,v.height],[240,180]);await pd.destroy();await h.close();
});

add('TL-X18','seguranca/analise-incompleta','Falha ao ler anotações não pode terminar como Nada encontrado',
 'Erro em getAnnotations exige aviso de procura incompleta e nunca resultado negativo confiável; controle positivo mostra dado sensível em formulário.',
 'importacao_PDF_real + falha controlada em getAnnotations + DOM simulado',async()=>{
 const h=setup(),d=await openBytes(h,await activeContent());h.el('tipos').querySelectorAll=()=>[{value:'email'}];await h.run('procurarArquivos(docs.slice())');const positive=d.paginas[0].sugestoes.length;assert.ok(positive>0);d.paginas[0].sugestoes=[];
 const original=d.pdf.getPage.bind(d.pdf);d.pdf.getPage=async n=>new Proxy(await original(n),{get(t,k){if(k==='getAnnotations')return async()=>{throw Error('synthetic annotation parse failure')};const v=t[k];return typeof v==='function'?v.bind(t):v}});
 await h.run('procurarArquivos(docs.slice())');const alert=h.s.__alerts.at(-1);evidence('TL-X18',{positiveSuggestions:positive,afterFailure:d.paginas[0].sugestoes.length,alert,warnings:h.warnings});await h.close();assert.doesNotMatch(alert,/Nada encontrado/,'falha parcial das anotações virou mensagem de nenhum achado');assert.match(alert,/não terminou|incomplet|falha|erro/i);
});
