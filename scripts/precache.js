// Run after `expo export -p web`: stamps dist/sw.js with the file list and a version that changes whenever any file does.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SKIP = new Set(['sw.js', '404.html']);

function walk(dir, root = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full, root) : [path.relative(root, full).split(path.sep).join('/')];
  });
}

function buildPrecache(dist) {
  const files = walk(dist).filter((f) => !SKIP.has(f)).sort();
  const hash = crypto.createHash('sha256');
  for (const f of files) hash.update(f).update(fs.readFileSync(path.join(dist, f)));
  return { files, version: `jackapp-${hash.digest('hex').slice(0, 12)}` };
}

function stamp(dist) {
  const swPath = path.join(dist, 'sw.js');
  const { files, version } = buildPrecache(dist);
  const sw = fs.readFileSync(swPath, 'utf8')
    .replace("'__VERSION__'", JSON.stringify(version))
    .replace("'__PRECACHE__'", JSON.stringify(files));
  fs.writeFileSync(swPath, sw);
  return { count: files.length, version };
}

module.exports = { buildPrecache, stamp };

if (require.main === module) {
  const { count, version } = stamp(path.resolve(process.argv[2] ?? 'dist'));
  console.log(`precache: ${count} files, ${version}`);
}
