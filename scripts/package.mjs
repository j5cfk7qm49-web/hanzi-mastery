import { readFile, readdir, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { zipSync, unzipSync } from 'fflate';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const dataDir = path.resolve('dist/data');
assert.equal(dataDir, path.join(process.cwd(), 'dist', 'data'));
await rm(dataDir, { recursive: true, force: true });
await mkdir(dataDir, { recursive: true });
const dataFiles = (await readdir('node_modules/hanzi-writer-data')).filter(f => /^\p{Script=Han}\.json$/u.test(f)).sort();
const groups = new Map();
for (const file of dataFiles) {
  const character = file.slice(0, -5);
  const group = (character.codePointAt(0) >>> 6).toString(16);
  if (!groups.has(group)) groups.set(group, {});
  groups.get(group)[character] = JSON.parse(await readFile('node_modules/hanzi-writer-data/' + file, 'utf8'));
}
for (const [group, data] of groups) await writeFile(path.join(dataDir, group + '.json'), JSON.stringify(data));
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
await writeFile('dist/data/manifest.json', JSON.stringify({ version: 2, source: 'hanzi-writer-data@2.0.1', count: dataFiles.length, codePointsPerGroup: 64, groups: groups.size }));
const files = {};
async function collect(dir) {
  for (const item of (await readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const filename = path.join(dir, item.name);
    if (item.isDirectory()) await collect(filename);
    else files[path.relative('dist', filename).replaceAll('\\', '/')] = [new Uint8Array(await readFile(filename)), { mtime: new Date(2026, 0, 1, 0, 0, 0) }];
  }
}
await collect('dist');
assert(files['dictionary/cedict.txt.gz'] && files['dictionary/SOURCE.md'], 'Dictionary data or attribution is missing');
assert.equal(createHash('sha256').update(files['dictionary/cedict.txt.gz'][0]).digest('hex'),
  '2680af828c0d949b544c9399b4dc8503788c99150ab73887600fed6b4f880b26', 'Bundled CC-CEDICT source changed');
for (const required of ['manifest.json', 'index.html', 'index.js', 'index-sandbox.js', 'hanzi_review-sandbox.js', 'recall_review-sandbox.js', 'licenses/ARPHICPL.TXT']) assert(files[required], `Missing ${required}`);
assert(dataFiles.length > 9000);
assert(!Object.keys(files).some(name => /preview|harness|APP_ACCEPTANCE_|REVIEW_UI_REFRESH_|node_modules|\.tsx?$/.test(name)), 'Development source or local acceptance report leaked into upload package');
for (const [group, data] of groups) {
  const packed = JSON.parse(new TextDecoder().decode(files[`data/${group}.json`][0]));
  assert.deepEqual(packed, data, `Character group ${group} changed during packaging`);
}
assert.equal([...groups.values()].reduce((count, data) => count + Object.keys(data).length, 0), dataFiles.length);
for (const ch of '學國書語聽體愛') assert(groups.get((ch.codePointAt(0) >>> 6).toString(16))[ch]);
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
console.log(`Validated ${Object.keys(files).length} archive entries, ${dataFiles.length} exact-script characters in ${groups.size} data groups. ${output} (${(zip.length / 1048576).toFixed(2)} MiB)`);
