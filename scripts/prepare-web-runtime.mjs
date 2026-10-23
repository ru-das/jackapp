import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';

const assets = JSON.parse(await readFile(new URL('./web-runtime-assets.json', import.meta.url), 'utf8'));
const directory = new URL('../public/vendor/', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
await mkdir(directory, { recursive: true });
for (const { file, url, sha256 } of assets) {
  const target = new URL(file, directory);
  const existing = await readFile(target).catch(() => null);
  if (existing && hash(existing) === sha256) continue;
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (hash(bytes) !== sha256) throw new Error(`${file}: checksum mismatch; refusing asset`);
  const temporary = new URL(`${file}.tmp`, directory);
  await writeFile(temporary, bytes);
  await rename(temporary, target);
  console.log(`Prepared ${file}`);
}
console.log('Web runtime assets verified (Transformers.js 4.3.1 / ONNX 1.31.0-dev.20260914-8d85527a0).');
