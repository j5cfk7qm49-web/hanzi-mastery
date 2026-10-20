import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { zipSync, unzipSync } from 'fflate';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('dist/data', { recursive: true });
const dataFiles = (await readdir('node_modules/hanzi-writer-data')).filter(f => /^\p{Script=Han}\.json$/u.test(f)).sort();
for (const file of dataFiles) {
  const hex = file.codePointAt(0).toString(16);
  await copyFile('node_modules/hanzi-writer-data/' + file, 'dist/data/' + hex + '.json');
}
await mkdir('dist/licenses', { recursive: true });
await copyFile('node_modules/hanzi-writer-data/ARPHICPL.TXT', 'dist/licenses/ARPHICPL.TXT');
const seen = new Set();
const notices = [];
async function license(name) {
  if (seen.has(name)) return;
  seen.add(name);
  const dir = 'node_modules/' + name;
  const meta = JSON.parse(await readFile(dir + '/package.json', 'utf8'));
  const candidates = (await readdir(dir)).filter(f => /^(licen[cs]e|copying|notice)/i.test(f));
  notices.push(`${name}@${meta.version} — ${meta.license || 'See license'}\n${meta.homepage || ''}`);
  for (const f of candidates) {
    try { await copyFile(dir + '/' + f, `dist/licenses/${name.replaceAll('/', '__')}-${f}`); } catch { /* directories are not license texts */ }
  }
  for (const dep of Object.keys(meta.dependencies || {})) await license(dep);
}
for (const dep of Object.keys(pkg.dependencies)) await license(dep);
await writeFile('dist/THIRD_PARTY_NOTICES.txt', notices.join('\n\n') + '\n\nWebpack setup follows the MIT-licensed RemNote React template.\nCopyright (c) 2023 RemNote Inc.\n');
await writeFile('dist/data/manifest.json', JSON.stringify({ version: 1, source: 'hanzi-writer-data@2.0.1', count: dataFiles.length }));
const files = {};
async function collect(dir) {
  for (const item of (await readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const filename = path.join(dir, item.name);
    if (item.isDirectory()) await collect(filename);
    else files[path.relative('dist', filename).replaceAll('\\', '/')] = [new Uint8Array(await readFile(filename)), { mtime: new Date(2026, 0, 1, 0, 0, 0) }];
  }
}
await collect('dist');
for (const required of ['manifest.json', 'index.html', 'index.js', 'index-sandbox.js', 'hanzi_review-sandbox.js', 'recall_review-sandbox.js', 'licenses/ARPHICPL.TXT']) assert(files[required], `Missing ${required}`);
assert(dataFiles.length > 9000);
assert(!Object.keys(files).some(name => /preview|harness|node_modules|\.tsx?$/.test(name)), 'Development source leaked into upload package');
for (const ch of '學國書語聽體愛') assert(files[`data/${ch.codePointAt(0).toString(16)}.json`]);
for (const [name, [content]] of Object.entries(files)) if (name.endsWith('.js')) {
  const js = new TextDecoder().decode(content);
  assert(!/import\s*\(?\s*['"]https?:/.test(js), `Runtime remote import: ${name}`);
}
const zip = zipSync(files, { level: 9 });
const extracted = unzipSync(zip);
assert.equal(Object.keys(extracted).length, Object.keys(files).length);
const manifest = JSON.parse(new TextDecoder().decode(extracted['manifest.json']));
assert.equal([manifest.version.major, manifest.version.minor, manifest.version.patch].join('.'), pkg.version,
  'Upload manifest and package.json versions must match');
await mkdir('release', { recursive: true });
const output = `release/HanziMastery-${pkg.version}-plugin.zip`;
await writeFile(output, zip);
console.log(`Validated ${Object.keys(files).length} archive entries, ${dataFiles.length} exact-script characters. ${output} (${(zip.length / 1048576).toFixed(2)} MiB)`);
