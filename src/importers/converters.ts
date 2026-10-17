import { characters, type Vocabulary } from '../core/schema';
export interface Provenance { format: 'pleco-text' | 'mapped-csv'; file: string; row: number; raw: Record<string,string> }
export interface ImportedVocabulary extends Vocabulary { importKey: string; provenance: Provenance[] }
const list = (s = '') => s.split(';').map(v => v.trim()).filter(Boolean);
const key = (v: Vocabulary) => JSON.stringify([v.traditional, v.simplified || '', v.pinyin.normalize('NFC')]);
function merge(entries: ImportedVocabulary[]): ImportedVocabulary[] {
  const map=new Map<string,ImportedVocabulary>();
  for(const v of entries){
    const old=map.get(v.importKey);
    if(!old){map.set(v.importKey,structuredClone(v));continue;}
    old.meanings=[...new Set([...old.meanings,...v.meanings])];
    old.categories=[...new Set([...old.categories,...v.categories])];
    old.tags=[...new Set([...(old.tags || []),...(v.tags || [])])];
    old.audio=[...new Set([...(old.audio || []),...(v.audio || [])])];
    old.provenance.push(...v.provenance);
  }
  return [...map.values()];
}
export function convertPleco(text: string, file = 'pleco.txt', bareScript?: 'traditional'): ImportedVocabulary[] {
  if (/^\s*</.test(text)) throw new Error('Pleco XML is not supported. Export a UTF-8 Traditional or Both text file.');
  const entries:ImportedVocabulary[]=[];let category='';
  for(const [index,line] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
    if(!line.trim())continue;
    if(line.startsWith('//')){category=line.slice(2).trim();continue;}
    const fields=line.split('\t');
    if(fields.length>3)throw new Error(`Row ${index+1}: unexpected extra tabs. Export Mandarin text without extra pronunciation columns.`);
    const [headword,pinyin='',definition='']=fields;
    const pair=headword.trim().match(/^([^\[\]]+)\[([^\[\]]+)\]$/u);
    if(!pair&&!bareScript)throw new Error(`Row ${index+1}: unbracketed headword has no verified script. Export Traditional and pass --bare-script traditional, or export Both.`);
    const traditional=pair?pair[2]:headword.trim(),simplified=pair?pair[1]:undefined;
    characters(traditional);if(simplified)characters(simplified);
    const v:Vocabulary={version:2,traditional,...(simplified?{simplified}:{}),pinyin:pinyin.trim(),meanings:definition?[definition]:[],
      categories:category?[category]:[],source:`Pleco text: ${file}`};
    entries.push({...v,importKey:key(v),provenance:[{format:'pleco-text',file,row:index+1,raw:{headword,pinyin,definition,category}}]});
  }
  return merge(entries);
}
/** RFC 4180-style quoted fields, including doubled quotes and embedded newlines. */
export function parseDelimited(text:string, delimiter=','):string[][]{
  const rows:string[][]=[];let row:string[]=[],field='',quoted=false,afterQuote=false;
  const finishField=()=>{row.push(field);field='';afterQuote=false;};
  const finishRow=()=>{finishField();if(row.some(v=>v!==''))rows.push(row);row=[];};
  const data=text.replace(/^\uFEFF/,'');
  for(let i=0;i<data.length;i++){
    const c=data[i];
    if(quoted){
      if(c==='"'){if(data[i+1]==='"'){field+='"';i++;}else{quoted=false;afterQuote=true;}}
      else field+=c;
    }else if(c==='"'){
      if(field||afterQuote)throw new Error('Malformed quoted CSV field.');quoted=true;
    }else if(c===delimiter)finishField();
    else if(c==='\n'||c==='\r'){finishRow();if(c==='\r'&&data[i+1]==='\n')i++;}
    else{if(afterQuote)throw new Error('Unexpected text after a closing CSV quote.');field+=c;}
  }
  if(quoted)throw new Error('Unclosed quoted CSV field.');
  if(field||row.length||afterQuote)finishRow();
  return rows;
}
export type ColumnMapping=Partial<Record<'traditional'|'simplified'|'pinyin'|'meanings'|'categories'|'source'|'partOfSpeech'|'audio'|'tocflLevel'|'tocflSource'|'tags',string>>;
export function convertCSV(text:string,file='vocabulary.csv',mapping:ColumnMapping={},delimiter=','):ImportedVocabulary[]{
  const [headers,...rows]=parseDelimited(text,delimiter);
  if(!headers||new Set(headers).size!==headers.length)throw new Error('CSV requires unique column headers.');
  const column=(name:keyof ColumnMapping)=>headers.indexOf(mapping[name] || name);
  if(column('traditional')<0)throw new Error('Map an explicit Traditional column. Script conversion is never inferred.');
  const entries=rows.map((cells,i)=>{
    if(cells.length!==headers.length)throw new Error(`Row ${i+2}: column count does not match the header.`);
    const get=(name:keyof ColumnMapping)=>cells[column(name)] || '';
    const traditional=get('traditional').trim(),simplified=get('simplified').trim();
    characters(traditional);if(simplified)characters(simplified);
    const level=get('tocflLevel'),levelSource=get('tocflSource');
    const v:Vocabulary={version:2,traditional,...(simplified?{simplified}:{}),pinyin:get('pinyin').trim(),meanings:list(get('meanings')),
      source:get('source') || `Mapped CSV: ${file}`,categories:list(get('categories')),tags:list(get('tags')),audio:list(get('audio')),
      ...(get('partOfSpeech')?{partOfSpeech:get('partOfSpeech')}:{}),
      ...(level?{tocfl:{level,source:levelSource || 'Unverified imported label',verified:false}}:{})};
    return {...v,importKey:key(v),provenance:[{format:'mapped-csv' as const,file,row:i+2,raw:Object.fromEntries(headers.map((h,j)=>[h,cells[j]]))}]};
  });
  return merge(entries);
}
export function vocabularyMarkdown(entries:ImportedVocabulary[]):string{
  // Plain notes only: never generate guessed hidden Powerup metadata or scheduling history.
  const escape=(s:string)=>s.replaceAll('\n',' ').replaceAll('\r',' ').replaceAll('::','∶∶').replaceAll('>>','››').replaceAll('<<','‹‹');
  return '# Imported Chinese vocabulary\n\n'+entries.map(v=>{
    const lines=[`- ${escape(v.traditional)} — ${escape(v.pinyin)}`,`  - Meanings: ${v.meanings.map(escape).join('; ')}`,
      `  - Source: ${escape(v.source)}`,`  - Categories: ${v.categories.map(escape).join('; ')}`];
    if(v.simplified)lines.push(`  - Explicit Simplified: ${escape(v.simplified)}`);
    if(v.tocfl)lines.push(`  - TOCFL label (unverified): ${escape(v.tocfl.level)}`);
    return lines.join('\n');
  }).join('\n')+'\n';
}
