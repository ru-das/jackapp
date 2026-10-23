import {
  env,
  AutoProcessor,
  Gemma4ForConditionalGeneration,
  InterruptableStoppingCriteria,
  RawImage,
} from './vendor/transformers.min.js';

const MODEL_REPOS = ['onnx-community/gemma-4-E2B-it-ONNX', 'onnx-community/gemma-4-E4B-it-ONNX'];
const runtimeFiles = ['transformers.min.js', 'ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm'];
const vendor = new URL('./vendor/', import.meta.url);
const imageData = (url) => typeof url === 'string' && /^data:image\/[a-zA-Z0-9.+-]+[;,]/.test(url);
const delegatedFetch = globalThis.fetch.bind(globalThis);
// Check the requested URL before delegating. Hugging Face controls signed weight redirects.
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, import.meta.url);
  const method = (init?.method ?? input?.method ?? 'GET').toUpperCase();
  const local = runtimeFiles.some((file) => url.href === new URL(file, vendor).href);
  const modelFile = MODEL_REPOS.some((repo) => {
    const prefix = `https://huggingface.co/${repo}/resolve/main/`;
    if (!url.href.startsWith(prefix)) return false;
    const file = url.href.slice(prefix.length);
    return /^(?:config|generation_config|preprocessor_config|processor_config|tokenizer_config|tokenizer|special_tokens_map|chat_template)\.json$/.test(file)
      || /^(?:tokenizer\.model|vocab\.json|merges\.txt|chat_template\.jinja)$/.test(file)
      || /^onnx\/[a-zA-Z0-9_-]+\.onnx(?:_data(?:_\d+)?)?$/.test(file);
  });
  if (!['GET', 'HEAD'].includes(method) || init?.body || (!local && !modelFile && !imageData(url.href))) {
    return Promise.reject(new Error('Network request is not allowed.'));
  }
  return delegatedFetch(input, { ...init, method, credentials: 'omit', referrerPolicy: 'no-referrer' });
};
env.fetch = globalThis.fetch;
env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths = {
  mjs: new URL('ort-wasm-simd-threaded.asyncify.mjs', vendor).href,
  wasm: new URL('ort-wasm-simd-threaded.asyncify.wasm', vendor).href,
};
// Keep runtime modules on our origin; avoid blob module caching and nested workers.
env.useWasmCache = false;
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.numThreads = 1;

let processor;
let model;
let stopper = new InterruptableStoppingCriteria();

async function load(MODEL) {
  if (!MODEL_REPOS.includes(MODEL)) throw new Error('Unknown model.');
  const gpu = !!navigator.gpu && !!(await navigator.gpu.requestAdapter().catch(() => null));
  const device = gpu ? 'webgpu' : 'wasm';
  // q4f16 needs fp16 shaders, which wasm lacks.
  const dtype = gpu ? 'q4f16' : 'q4';
  processor = await AutoProcessor.from_pretrained(MODEL);
  model = await Gemma4ForConditionalGeneration.from_pretrained(MODEL, {
    dtype,
    device,
    progress_callback: (i) => {
      if (i.status === 'progress_total') postMessage({ type: 'progress', loaded: i.loaded, total: i.total });
    },
  });
  postMessage({ type: 'ready', device });
}

async function generate({ id, system, messages, maxTokens, temperature }) {
  const images = [];
  const chat = [{ role: 'system', content: [{ type: 'text', text: system }] }];
  for (const m of messages) {
    const content = [];
    for (const url of m.images ?? []) {
      if (!imageData(url)) throw new Error('Choose a local image first.');
      images.push(await RawImage.fromURL(url));
      content.push({ type: 'image' });
    }
    content.push({ type: 'text', text: m.content });
    chat.push({ role: m.role, content });
  }
  const prompt = processor.apply_chat_template(chat, { enable_thinking: false, add_generation_prompt: true });
  const inputs = await processor(prompt, images.length ? images : null, null, { add_special_tokens: false });
  stopper = new InterruptableStoppingCriteria();
  const t0 = performance.now();
  const out = await model.generate({
    ...inputs,
    max_new_tokens: maxTokens ?? 1024,
    do_sample: (temperature ?? 0) > 0,
    ...(temperature > 0 && { temperature }),
    stopping_criteria: stopper,
  });
  const fresh = out.slice(null, [inputs.input_ids.dims.at(-1), null]);
  const text = processor.batch_decode(fresh, { skip_special_tokens: true })[0];
  const n = fresh.dims.at(-1);
  postMessage({ type: 'done', id, text, tokensPerSec: n / ((performance.now() - t0) / 1000) });
}

onmessage = async ({ data }) => {
  if (data.type === 'abort') return stopper.interrupt();
  try {
    if (data.type === 'load') await load(data.model);
    else if (data.type === 'generate') await generate(data);
  } catch (e) {
    postMessage({ type: 'error', id: data.id, message: String(e?.message ?? e) });
  }
};
