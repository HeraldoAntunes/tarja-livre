import {mkdirSync,readFileSync,writeFileSync,readdirSync,lstatSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const repo=process.env.TARJA_REPO||process.argv[2];
const output=resolve(process.env.TARJA_OUT||'.');mkdirSync(output,{recursive:true});mkdirSync(join(output,'evidence'),{recursive:true});
const write=(name,value)=>writeFileSync(join(output,name),JSON.stringify(value,null,2)+'\n');
function blocker(error){const r={status:'blocked',summary:{total:0,passed:0,failed:0,blocked:1},error};write('results.json',r);write('resultados.json',r);write('scenarios.json',[]);console.error(error);process.exit(2)}
if(!repo)blocker('Set TARJA_REPO or provide repository path as first argument');
process.env.TARJA_REPO=resolve(repo);process.env.TARJA_OUT=output;
// Audit copy: extracted source has no Git; hash every regular source artifact.
function sourceManifest(dir,prefix='') {
 const entries={};
 for(const name of readdirSync(dir).sort()) {
  if(name==='.git')continue;
  const file=join(dir,name),rel=prefix+name,st=lstatSync(file);
  if(st.isSymbolicLink())throw Error('Source symlink requires explicit review: '+rel);
  if(st.isDirectory())Object.assign(entries,sourceManifest(file,rel+'/'));
  else if(st.isFile())entries[rel]=createHash('sha256').update(readFileSync(file)).digest('hex');
 }
 return entries;
}
let tests,h,source,baseline;
try{
 source={expected_version:'1.2.0',expected_commit:'cc8b0f38e73e7d3983064f2b6affc6e4039be287',commit:null,provenance:'extracted artifact; SHA-256 manifest, no Git claim',archive_sha256:process.env.TARJA_ARCHIVE_SHA256||null};
 source.matches_audited_commit=source.commit===source.expected_commit;
 source.observed_version=readFileSync(join(repo,'src/versao.js'),'utf8').match(/VERSAO\s*=\s*['\"]([^'\"]+)/)?.[1]||'unknown';
 source.version=source.observed_version;
 if(!source.matches_audited_commit)console.warn('Different source commit: adapter compatibility will be checked; expected/observed recorded.');
 baseline=JSON.stringify(sourceManifest(resolve(repo)));write('source-manifest-before.json',JSON.parse(baseline));
 source.sha256=Object.fromEntries(['src/app.js','src/achados.js','vendor/pdfjs/pdf.min.mjs','vendor/jspdf/jspdf.umd.min.js'].map(f=>[f,createHash('sha256').update(readFileSync(join(repo,f))).digest('hex')]));
 h=await import('./tests/harness.mjs');tests=(await import('./tests/scenarios.mjs')).tests;
 // Source/adapter incompatibility is not a product regression. Fail before counting cases.
 const probe=h.setup();
 const required=['carregarArquivo','abrirArquivos','salvar','ativar','mostrarAndamento','andamentoDe','gravarAndamento','noAndamento','banco','limparAndamentoVelho','soltarTexto','aceitarTodas','desfazer','refazerUltimo','escalaSegura','procurarArquivos'];
 for(const symbol of required)if(probe.run(`typeof ${symbol}`)!=='function')throw Error('Harness adaptation required: missing '+symbol);
}catch(e){blocker(e.stack)}
const started=new Date().toISOString(),results=[];
let stopped=false;
for(const t of tests){
 const before=performance.now();const result={...t};delete result.run;
 result.evidence=[`evidence/${t.id}.json`];write(result.evidence[0],{running:true});
 if(stopped){result.status='blocked';result.error={message:'Not run after preceding timeout/adapter blocker'}}
 else try{
  let timeout;
  try{await Promise.race([t.run(),new Promise((_,reject)=>{timeout=setTimeout(()=>{const e=new Error('Scenario exceeded 45s: inconclusive execution; remaining suite stopped');e.code='SCENARIO_TIMEOUT';reject(e)},45000)})])}
  finally{clearTimeout(timeout)}
  result.status='passed';
 }catch(e){
  const blocked=['SCENARIO_TIMEOUT','HARNESS_UNSUPPORTED'].includes(e.code);
  result.status=blocked?'blocked':'failed';stopped=blocked;
  result.error={name:e.name,message:e.message,stack:e.stack};console.error(`${t.id}: ${e.message}`);
 }
 result.duration_ms=Math.round(performance.now()-before);result.source_version=source;
 result.platform_scope=`Core JS portável Linux/Windows; executado em ${process.platform} Node, não desktop`;
 if(JSON.parse(readFileSync(join(output,result.evidence[0]),'utf8')).running)write(result.evidence[0],{status:result.status,error:result.error});
 results.push(result);console.log(`${result.status.toUpperCase()} ${t.id}: ${t.title}`);
}
const after=JSON.stringify(sourceManifest(resolve(repo)));write('source-manifest-after.json',JSON.parse(after));
const report={suite:'Tarja Livre bateria ampliada (somente cenários novos)',started,finished:new Date().toISOString(),environment:{platform:process.platform,arch:process.arch,node:process.version,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},source_version:source,checkout_unchanged:baseline===after,source_files_unchanged:baseline===after,summary:{total:results.length,passed:results.filter(t=>t.status==='passed').length,failed:results.filter(t=>t.status==='failed').length,blocked:results.filter(t=>t.status==='blocked').length},limitations:['DOM minimal mock','IndexedDB fake-indexeddb em memória; sem comprovação de fsync/crash/quotas reais','PDF.js/jsPDF reais com canvas Skia nativo; sem navegador','Windows não executado nesta auditoria; comandos portáveis fornecidos','OCR/Tauri/instaladores/rede/GUI desktop fora do escopo'],scenarios:results};
write('results.json',report);write('resultados.json',report);write('scenarios.json',results);
console.log(JSON.stringify(report.summary));
// Explicit exit also cancels leftover promises after timeout; no subsequent scenario runs after it.
process.exit(report.summary.blocked||!report.checkout_unchanged?2:report.summary.failed?1:0);
