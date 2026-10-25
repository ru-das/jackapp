import fs from 'fs';
import os from 'os';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildPrecache, stamp } = require('../../scripts/precache.js');

let dist: string;
const put = (rel: string, body: string) => {
  fs.mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true });
  fs.writeFileSync(path.join(dist, rel), body);
};

beforeEach(() => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'precache-'));
  put('index.html', '<html>');
  put('404.html', '<html>');
  put('manifest.webmanifest', '{}');
  put('_expo/static/js/web/entry-abc.js', 'a');
  put('sw.js', "const VERSION = '__VERSION__';\nconst PRECACHE = '__PRECACHE__';\n");
});
afterEach(() => fs.rmSync(dist, { recursive: true, force: true }));

test('lists app files relative to the scope, without the worker and the 404 copy', () => {
  const { files } = buildPrecache(dist);
  expect(files).toEqual(['_expo/static/js/web/entry-abc.js', 'index.html', 'manifest.webmanifest']);
});

test('the version changes when any file changes, and not otherwise', () => {
  const v1 = buildPrecache(dist).version;
  expect(buildPrecache(dist).version).toBe(v1);
  put('_expo/static/js/web/entry-abc.js', 'b');
  expect(buildPrecache(dist).version).not.toBe(v1);
});

test('stamp fills both placeholders in sw.js', () => {
  const { version } = stamp(dist);
  const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
  expect(sw).toContain(`const VERSION = "${version}";`);
  expect(sw).toContain('const PRECACHE = ["_expo/static/js/web/entry-abc.js","index.html","manifest.webmanifest"];');
  expect(sw).not.toContain('__');
});
