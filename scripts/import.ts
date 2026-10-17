import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { convertCSV, convertPleco, vocabularyMarkdown, type ColumnMapping } from '../src/importers/converters';
async function main(){
  const args=process.argv.slice(2),options=new Map<string,string>();
  for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--')||!args[i+1])throw new Error('Arguments must be --name value pairs.');options.set(args[i].slice(2),args[i+1]);}
  const input=options.get('input'),output=options.get('output'),format=options.get('format');
  if(!input||!output||!['pleco','csv','tsv'].includes(format||''))throw new Error('Usage: npm run import -- --format pleco|csv|tsv --input source.txt --output vocabulary.json [--bare-script traditional] [--mapping columns.json]');
  if(path.resolve(input)===path.resolve(output))throw new Error('Input and output must be different files.');
  const text=await readFile(input,'utf8');
  const mapping:ColumnMapping=options.has('mapping')?JSON.parse(await readFile(options.get('mapping')!,'utf8')):{};
  const bare=options.get('bare-script');if(bare&&bare!=='traditional')throw new Error('Bare Simplified exports have no verified Traditional form. Export Both instead.');
  const entries=format==='pleco'?convertPleco(text,path.basename(input),bare as 'traditional'|undefined):convertCSV(text,path.basename(input),mapping,format==='tsv'?'\t':',');
  await writeFile(output,JSON.stringify({schema:'hanzi-mastery-vocabulary',version:2,schedulingImported:false,entries},null,2)+'\n',{flag:'wx'});
  if(options.has('markdown'))await writeFile(options.get('markdown')!,vocabularyMarkdown(entries),{flag:'wx'});
  console.log(`Converted ${entries.length} unique entries. Categories and provenance preserved; no SRS history imported. Output files were created without overwriting existing files.`);
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Import failed.');process.exitCode=1;});
