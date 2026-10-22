// shortcut: library loaded from jsDelivr because Metro can't bundle workers or onnxruntime-web; vendor into public/ if offline-first web matters.
import {
  AutoProcessor,
  Gemma4ForConditionalGeneration,
  InterruptableStoppingCriteria,
  RawImage,
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';

let processor;
let model;
let stopper = new InterruptableStoppingCriteria();

async function load(MODEL) {
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
