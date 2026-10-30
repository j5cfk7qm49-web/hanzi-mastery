// Explicit source-maintenance command. Normal builds never fetch third-party data.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

if (!process.argv[2]) throw new Error('Usage: node scripts/build-audio-index.mjs <Shtooka flac/index.tags.txt>');
const bytes = readFileSync(process.argv[2]), text = bytes.toString('utf8');
if (!text.startsWith('\\Swac_Index_Tags') || !text.includes('SWAC_COLL_LICENSE=Creative Commons BY-SA 3.0 U.S')) {
  throw new Error('Unexpected Shtooka source or licence.');
}
const records = [];
for (const match of text.matchAll(/^\[(cmn-[a-f0-9]+)\.flac\]\r?\n([\s\S]*?)(?=^\[|$(?![\s\S]))/gm)) {
  const fields = Object.fromEntries(match[2].trim().split(/\r?\n/).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  if (/^\p{Script=Han}{1,12}$/u.test(fields.SWAC_TEXT || '') && fields.SWAC_PRON_PHON) {
    records.push([fields.SWAC_TEXT, fields.SWAC_PRON_PHON, match[1]]);
  }
}
if (records.length < 8000 || records.length > 10000) throw new Error('Unexpected source inventory.');
const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
const result = gzipSync(JSON.stringify({ version: 1, sourceSha256, records }), { level: 9 });
mkdirSync('public/audio', { recursive: true });
writeFileSync('public/audio/shtooka-index.json.gz', result);
console.log(JSON.stringify({ records: records.length, bytes: result.length, sourceSha256 }));
