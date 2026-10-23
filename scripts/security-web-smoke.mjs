// Run after npm run export:web; no model weights or inference are used.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist');
const requests = [];
const mock = `
export const env = {backends:{onnx:{wasm:{}}}};
export class InterruptableStoppingCriteria { interrupt() {} }
export const RawImage = {fromURL: async url => {
  if (!url.startsWith('data:image/')) throw Error('remote image reached decoder');
  return {};
}};
export const AutoProcessor = {from_pretrained: async model => {
  await env.fetch('https://huggingface.co/'+model+'/resolve/main/config.json').catch(()=>{});
  await env.fetch(new URL('./vendor/ort-wasm-simd-threaded.asyncify.wasm', import.meta.url), {method:'HEAD'});
  const p = async () => ({input_ids:{dims:[1]}});
  p.apply_chat_template = () => ''; p.batch_decode = () => ['mock result']; return p;
}};
export const Gemma4ForConditionalGeneration = {from_pretrained: async () => ({
  generate: async () => ({slice: () => ({dims:[1]})})
})};
export const Qwen3_5ForConditionalGeneration = Gemma4ForConditionalGeneration;`;
const page = `<!doctype html><meta charset="utf-8"><pre id="result">RUNNING</pre>
<script type="module">
const result = document.querySelector('#result');
const assert = (v,m) => {if(!v) throw Error(m)};
const call = (worker, data) => new Promise((resolve,reject) => {
  const timer=setTimeout(()=>reject(Error('worker timeout')),12000);
  worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))};
  worker.onmessage=({data})=>{if(['ready','done','error'].includes(data.type)){clearTimeout(timer);resolve(data)}};
  worker.postMessage(data);
});
try {
  // Import the real pinned modules, without instantiating WASM or any model.
  const lib = await import('/vendor/transformers.min.js');
  assert(lib.env.version==='4.3.1','runtime version');
  assert(typeof lib.Qwen3_5ForConditionalGeneration.from_pretrained==='function','Qwen runtime export');
  assert(typeof (await import('/vendor/ort-wasm-simd-threaded.asyncify.mjs')).default==='function','ONNX module');
  const real = new Worker('/llm-worker.js',{type:'module'});
  assert((await call(real,{type:'load',model:'attacker/model'})).message==='Unknown model.','real worker import');
  real.terminate();
  const worker=new Worker('/worker-mock.js',{type:'module'});
  for(const model of ['onnx-community/gemma-4-E2B-it-ONNX','onnx-community/gemma-4-E4B-it-ONNX','onnx-community/Qwen3.5-2B-ONNX']) {
    assert((await call(worker,{type:'load',model})).type==='ready','mock load');
  }
  assert((await call(worker,{type:'generate',id:1,system:'safe',messages:[{role:'user',content:'photo',images:['https://evil.example/photo.png']}]})).type==='error','remote image');
  assert((await call(worker,{type:'generate',id:2,system:'safe',messages:[{role:'user',content:'photo',images:['data:image/png;base64,aGVsbG8=']}]})).text==='mock result','mock image generation');
  worker.terminate();
  result.textContent='PASS: real local runtime + worker imports; mock load/image generation; external connections blocked; no inference';
} catch(e) {result.textContent='FAIL: '+e.stack}
</script>`;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  requests.push(path);
  // This policy also applies to workers, blocking external connections during the smoke test.
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'self'; img-src 'self' data:");
  try {
    if (path === '/security-smoke') { res.setHeader('Content-Type','text/html'); return res.end(page); }
    if (path === '/runtime-mock.js') { res.setHeader('Content-Type','text/javascript'); return res.end(mock); }
    if (path === '/worker-mock.js') {
      res.setHeader('Content-Type','text/javascript');
      return res.end((await readFile(resolve(root,'llm-worker.js'),'utf8'))
        .replace("'./vendor/transformers.min.js'", "'./runtime-mock.js'"));
    }
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + sep)) {res.writeHead(403);return res.end();}
    const bytes = await readFile(file);
    res.setHeader('Content-Type', ({'.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.html':'text/html'})[extname(file)] ?? 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch {res.writeHead(404);res.end();}
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const profile = await mkdtemp(resolve(tmpdir(), 'jackapp-security-'));
let browser;
let socket;
try {
  const {port} = server.address();
  browser = spawn(process.argv[2] ?? 'chromium', [
    '--headless','--no-sandbox','--disable-gpu','--disable-background-networking',
    '--remote-debugging-port=0',`--user-data-dir=${profile}`, 'about:blank',
  ], {stdio: ['ignore','ignore','pipe']});
  const endpoint = await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(Error('Browser startup timeout')), 15000);
    browser.on('error', reject);
    browser.stderr.on('data', chunk => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {clearTimeout(timer);resolve(match[1]);}
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise(resolve => socket.addEventListener('open',resolve,{once:true}));
  let next = 0;
  const pending = new Map();
  const events = new Map();
  socket.addEventListener('message', ({data}) => {
    const reply = JSON.parse(data);
    if (reply.id) {
      const entry = pending.get(reply.id); pending.delete(reply.id);
      if (reply.error) entry.reject(Error(JSON.stringify(reply.error))); else entry.resolve(reply.result);
    } else events.get(reply.method)?.(reply);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve,reject) => {
    const id = ++next; pending.set(id,{resolve,reject});
    socket.send(JSON.stringify({id,method,params,sessionId}));
  });
  const {targetId} = await send('Target.createTarget',{url:'about:blank'});
  const {sessionId} = await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Page.enable',{},sessionId);
  const loaded = new Promise(resolve => events.set('Page.loadEventFired',resolve));
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/security-smoke`},sessionId);
  await loaded;
  const reply = await send('Runtime.evaluate', {expression: `new Promise(resolve => {
    const timer = setInterval(() => {
      const value = document.querySelector('#result')?.textContent;
      if(value && value !== 'RUNNING') {clearInterval(timer);resolve(value);}
    },50);
    setTimeout(()=>{clearInterval(timer);resolve('FAIL: page timeout')},20000);
  })`, awaitPromise:true, returnByValue:true}, sessionId);
  const result = reply.result.value;
  assert.ok(result?.startsWith('PASS:'),result ?? JSON.stringify(reply));
  for(const file of ['/llm-worker.js','/vendor/transformers.min.js','/vendor/ort-wasm-simd-threaded.asyncify.mjs','/vendor/ort-wasm-simd-threaded.asyncify.wasm']) {
    assert.ok(requests.includes(file),`asset not requested: ${file}`);
  }
  console.log(result);
  console.log('Served local assets:', [...new Set(requests)].join(', '));
} finally {
  socket?.close();
  if (browser) {
    const stopped = new Promise(resolve => browser.once('exit',resolve));
    browser.kill();
    await stopped;
  }
  server.close();
  await rm(profile,{recursive:true,force:true});
}
