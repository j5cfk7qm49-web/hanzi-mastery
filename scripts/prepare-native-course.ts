/** Private seed preparation; no source data is bundled. Usage: tsx ... <handoff> <guru.json> <output>. */
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {compileClassicalChinese} from '../src/studyPacks/classicalChinese';
import {digest,audioManifestVersion} from '../src/studyPacks/import';
import {itemMarkdown,listMetadata,exerciseConfig,nativeBack} from '../src/studyPacks/nativeRems';
import type {StudyItem} from '../src/studyPacks/model';
async function main(){
  const [root,guruFile,dest]=process.argv.slice(2);if(!dest)throw new Error('Usage: tsx scripts/prepare-native-course.ts <handoff> <selected-lists-and-history.json> <private output>');
  const data=Object.fromEntries(await Promise.all((await readdir(join(root,'data'))).filter(n=>n.endsWith('.json')).map(async n=>[n,JSON.parse(await readFile(join(root,'data',n),'utf8'))])));
  const pack=compileClassicalChinese(data), guru=JSON.parse(await readFile(guruFile,'utf8'));
  pack.sourceVersion=await digest(new TextEncoder().encode(JSON.stringify(data)));pack.audioVersion=await audioManifestVersion(pack.audio);
  const radicals=pack.items.filter(i=>i.mode==='radical-identity'), canonical=new Set(radicals.map(i=>i.glyph));
  const entries=guru.entries.filter((e:any)=>e.memberships.some((m:any)=>m.list==='57')).map((e:any)=>({...e,radical:e.radical || {meaning:e.meanings.join('; ')}}));
  for(const item of radicals){const e=entries.find((e:any)=>e.id===item.glyph);if(!e)throw new Error('Missing Guru radical: '+item.glyph);
    const course=item.answers[0];item.answers=[e.pinyin];item.reveal=`${e.id} ${e.pinyin} — ${e.radical.meaning}. `+item.reveal+` Chinese Guru import reading: ${e.pinyin}.`+(course!==e.pinyin ? ` Course reading ${course} is retained for comparison; check the instructor’s naming.`:'');
    item.source+='; Chinese Guru selected-list export; CC-CEDICT / MDBG (CC BY-SA 4.0), Unicode radical supplement';
    const meaning=pack.items.find(i=>i.id==='meaning-'+item.id);if(meaning){meaning.answers=[e.radical.meaning];meaning.reveal=e.radical.meaning;meaning.source=item.source;}
  }
  for(const e of entries.filter((e:any)=>!canonical.has(e.id))){
    const item:StudyItem={id:'guru-variant-'+[...e.id].map((c:any)=>c.codePointAt(0).toString(16)).join('-'),section:3,mode:'radical-variants',kind:'text',glyph:e.id,prompt:'Recall this Chinese Guru radical variant’s Pinyin and meaning.',answers:[e.pinyin],reveal:`${e.id} ${e.pinyin} — ${e.radical.meaning}. `+(e.id==='阝'?'Left 阝 is 阜 fù (mound); right 阝 is 邑 yì (city). Position determines the canonical radical.':e.id==='糹'?'Variant reading sī; the course canonical 糸 is mì.':e.id==='毋'?'wú means do not; distinguish 母 mǔ (mother).':''),source:'Chinese Guru list 57; CC-CEDICT / MDBG (CC BY-SA 4.0), Unicode radical supplement',selfGrade:true};pack.items.push(item);
  }
  const add=(id:string,section:number,prompt:string,answer:string,source:string)=>pack.items.push({id,section,mode:'rules',kind:'text',prompt,answers:[answer],reveal:answer,source,selfGrade:true});
  data['pinyin.json'].mark_placement_rules.forEach((r:string,i:number)=>add('pinyin-rule-'+i,2,'State Pinyin tone-mark placement rule '+(i+1)+'.',r,data['pinyin.json'].source));
  data['grammar.json'].empty_words.forEach((p:any)=>add('particle-rule-'+p.character,7,'Recall the taught functions of '+p.character+'.',p.functions.join('; '),data['grammar.json'].source));
  const out=resolve(dest);await mkdir(out,{recursive:true});await writeFile(join(out,'native-pack.json'),JSON.stringify(pack,null,2));
  await writeFile(join(out,'root-metadata.md'),'- '+listMetadata(pack));
  for(const section of pack.sections)await writeFile(join(out,`section-${section.id}.md`),'- '+section.id+'. '+section.title+'\n'+pack.items.filter(i=>i.section===section.id && !['radical-identity','radical-variants'].includes(i.mode)).map(i=>itemMarkdown(i).split('\n').map(l=>'  '+l).join('\n')).join('\n'));
  const imported=pack.items.filter(i=>['radical-identity','radical-variants'].includes(i.mode)).map((i,index)=>({item:i,key:'HM-R'+String(index+1).padStart(2,'0'),front:`HM-R${String(index+1).padStart(2,'0')} · ${i.prompt} [${i.glyph}]`,back:nativeBack(i),metadata:'- Hanzi Mastery exercise: '+JSON.stringify(exerciseConfig(i)),history:entries.find((e:any)=>e.id===i.glyph).history}));
  await writeFile(join(out,'radical-import.json'),JSON.stringify(imported,null,2));
  console.log(JSON.stringify({total:pack.items.length,radicalCards:imported.length,sections:pack.sections.map(s=>({section:s.id,count:pack.items.filter(i=>i.section===s.id).length}))}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
