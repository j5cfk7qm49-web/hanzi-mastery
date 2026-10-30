import { unzip } from 'fflate';
import { sha256 } from '@noble/hashes/sha2.js';
import { compileClassicalChinese } from './classicalChinese';
import type { StudyPack, PackAudio } from './model';

const DATA_FILES = ['exam_manifest','daxue_reading','pinyin','radicals','radical_recognition','writing','formations','basic_knowledge','grammar','audio_manifest','source_manifest'].map(n => n + '.json');
export const MAX_ARCHIVE_BYTES = 85 * 1024 * 1024;
export async function digest(bytes: Uint8Array): Promise<string> {
  const hash=globalThis.crypto?.subtle ? new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)) : sha256(bytes);
  return [...hash].map(b => b.toString(16).padStart(2,'0')).join('');
}
/** Audio identity must survive Rem edits and different JSON/file enumeration orders. */
export async function audioManifestVersion(audio:PackAudio[]):Promise<string> {
  const manifest=[...audio].sort((a,b)=>a.id<b.id ? -1 : a.id>b.id ? 1 : 0).map(a=>[a.id,a.path,a.sha256,a.bytes]);
  return (await digest(new TextEncoder().encode(JSON.stringify(manifest)))).slice(0,24);
}
export interface ImportedPack { pack: StudyPack; audio: Map<string, Blob>; warnings: string[] }
/** PDFs never enter decompression, storage, bundles, or upload packages. */
export async function importHandoff(bytes: Uint8Array): Promise<ImportedPack> {
  if (!bytes.length || bytes.length > MAX_ARCHIVE_BYTES) throw new Error('Choose a handoff ZIP smaller than 85 MB.');
  let expanded = 0;
  const entries = await new Promise<Record<string, Uint8Array>>((resolve,reject) => unzip(bytes, { filter:file => {
    if (file.name.includes('..') || file.name.startsWith('/') || file.name.includes('\\')) return false;
    const data = /(?:^|\/)data\/([^/]+\.json)$/.exec(file.name);
    const sound = /(?:^|\/)private_assets\/audio\/.+\.(mp3|m4a)$/i.test(file.name);
    const wanted = !!(data && DATA_FILES.includes(data[1])) || sound;
    if (!wanted) return false;
    const limit = data ? 1024 * 1024 : 10 * 1024 * 1024;
    expanded += file.originalSize;
    if (file.originalSize > limit || expanded > 40 * 1024 * 1024) { reject(new Error('Archive expands beyond the course import limit.')); return false; }
    return true;
  } }, (error, result) => error ? reject(new Error('The handoff ZIP could not be read.')) : resolve(result)));
  const data: Record<string,unknown> = {};
  for (const name of DATA_FILES) {
    const matches = Object.keys(entries).filter(path => path.endsWith('/data/' + name) || path === 'data/' + name);
    if (matches.length !== 1) throw new Error(`Expected exactly one data/${name}.`);
    try { data[name] = JSON.parse(new TextDecoder('utf-8', { fatal:true }).decode(entries[matches[0]])); }
    catch { throw new Error(`Invalid JSON in ${name}.`); }
  }
  const pack = compileClassicalChinese(data);
  pack.sourceVersion = (await digest(new TextEncoder().encode(JSON.stringify(data)))).slice(0,24);
  pack.audioVersion = await audioManifestVersion(pack.audio);
  const audio = new Map<string,Blob>(), warnings: string[] = [];
  for (const asset of pack.audio) {
    if (!/^private_assets\/audio\//.test(asset.path) || asset.path.includes('..')) throw new Error('Invalid private audio path.');
    const paths = Object.keys(entries).filter(path => path === asset.path || path.endsWith('/' + asset.path));
    if (paths.length > 1) throw new Error('Ambiguous private audio path.');
    const content = entries[paths[0]];
    if (!content) continue;
    if (content.length !== asset.bytes || await digest(content) !== asset.sha256) throw new Error('A private recording failed its size/checksum check. Import stopped; existing data is preserved.');
    audio.set(asset.id, new Blob([content as Uint8Array<ArrayBuffer>], { type:asset.path.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4' }));
  }
  if (audio.size < pack.audio.length) warnings.push(`${audio.size}/${pack.audio.length} private audio files installed. Written activities remain available; unavailable audio exercises are disabled.`);
  return { pack, audio, warnings };
}
