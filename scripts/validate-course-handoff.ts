// Reproducible private check. Arguments/files are never added to the plugin build.
import { readFile,readdir } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { createHash } from 'node:crypto';
import { compileClassicalChinese } from '../src/studyPacks/classicalChinese';
import { importHandoff } from '../src/studyPacks/import';

async function main() {
  const root=process.argv[2];if(!root)throw new Error('Usage: npx tsx scripts/validate-course-handoff.ts <private extracted handoff directory or ZIP>');
  if(root.toLowerCase().endsWith('.zip')) {
    const imported=await importHandoff(new Uint8Array(await readFile(root)));
    console.log(JSON.stringify({studyPackId:imported.pack.studyPackId,items:imported.pack.items.length,audioVerified:imported.audio.size,warnings:imported.warnings},null,2));return;
  }
  const files=Object.fromEntries(await Promise.all((await readdir(join(root,'data'))).filter(n=>n.endsWith('.json')).map(async name=>[name,JSON.parse(await readFile(join(root,'data',name),'utf8'))])));
  const pack=compileClassicalChinese(files);
  let audioVerified=0,pdfVerified=0;
  for(const asset of [...pack.audio,...files['source_manifest.json'].course_pdfs.map((p:{relative_path:string;sha256:string;bytes:number})=>({...p,path:p.relative_path}))]) {
    const path=resolve(root,asset.path);if(!path.startsWith(resolve(root)+'\\') && !path.startsWith(resolve(root)+'/'))throw new Error('Source path escaped handoff.');
    const bytes=await readFile(path);if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256 || bytes.length!==asset.bytes)throw new Error('Private asset checksum/size mismatch.');
    if(asset.path.startsWith('private_assets/'))audioVerified++;else pdfVerified++;
  }
  console.log(JSON.stringify({studyPackId:pack.studyPackId,totalActivities:pack.items.length,sections:pack.sections.map(s=>({section:s.id,activities:pack.items.filter(i=>i.section===s.id).length})),radicals:pack.items.filter(i=>i.mode==='radical-identity').length,radicalWritingExamples:pack.items.filter(i=>i.mode==='radical-writing').length,writingTargets:pack.items.filter(i=>i.kind==='writing'&&i.section===4).length,audioVerified,pdfVerified},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
