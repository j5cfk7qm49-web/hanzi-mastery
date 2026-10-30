import { vi } from 'vitest';
import type { RNPlugin } from '@remnote/plugin-sdk';
export function memoryRemNote() {
  const saved = new Map<string, unknown>([['hm:v2:collection', 'collection'], ['hm:v6:library', 'collection']]);
  let next = 0, failSkill = '';
  const rems = new Map<string, ReturnType<typeof rem>>();
  const children = new Map<string, string[]>();
  function rem(id: string) {
    const metadata = new Map<string,string>(), tags = new Set<string>();
    let parent: string | null = null, text: string[] = [], backText: string[] = [], direction = 'none', enabled=true;
    return { _id:id, get parent() { return parent; }, get text() { return text; }, get backText() { return backText; },
      setParent:vi.fn(async (target:string, position?:number) => {
        if (parent) children.set(parent, (children.get(parent) || []).filter(child => child !== id));
        const siblings = (children.get(target) || []).filter(child => child !== id);
        siblings.splice(position ?? 0, 0, id); children.set(target, siblings); parent = target;
      }),
      getParentRem:async ():Promise<unknown> => parent ? rems.get(parent) : undefined,
      getChildrenRem:vi.fn(async ():Promise<{_id:string}[]> => (children.get(id) || []).map(child => rems.get(child)!)),
      getDescendants:vi.fn(async ():Promise<{_id:string}[]> => {
        const found:string[]=[],visit=(parent:string)=>{for(const child of children.get(parent)||[]){found.push(child);visit(child);}};visit(id);return found.map(child=>rems.get(child)!);
      }),
      setText:vi.fn(async (value:string[]) => { text=value; }), setBackText:vi.fn(async (value:string[]) => { backText=value; }),
      setPracticeDirection:vi.fn(async (value:string) => { direction=value; }), getPracticeDirection:async()=>direction, setIsDocument:vi.fn(),
      getEnablePractice:vi.fn(async()=>enabled),setEnablePractice:vi.fn(async(value:boolean)=>{enabled=value;}),
      addTag:vi.fn(async (tag:string)=>{tags.add(tag);}), removeTag:vi.fn(async(tag:string)=>{tags.delete(tag);}),
      getTagRems:async()=>[...tags].map(tag=>rems.get(tag)||{_id:tag}),
      addPowerup:vi.fn(async (tag:string) => { tags.add(tag); }), hasPowerup:async (tag:string) => tags.has(tag),
      taggedRem:async ():Promise<{_id:string}[]> => [...rems.values()].filter(r => r.hasTag(id) || tagsForPowerup(id).some(code => r.hasTag(code))),
      hasTag:(tag:string) => tags.has(tag),
      getPowerupProperty:async (code?:string) => code ? metadata.get(code) || '' : [...metadata.values()][0] || '',
      setPowerupProperty:vi.fn(async (code:string, _slot:string, value:string[]) => {
        if (JSON.parse(value[0]).skill === failSkill) { failSkill=''; throw new Error('temporary host failure'); }
        metadata.set(code,value[0]);
      }),
    };
  }
  const powerups = new Map<string,string>();
  function tagsForPowerup(id:string) { return [...powerups].filter(([,value])=>value===id).map(([code])=>code); }
  function add(id:string) { const value=rem(id); rems.set(id,value); return value; }
  add('collection');
  const createRem = vi.fn(async () => add(`r${++next}`));
  const plugin = { storage:{ getSynced:async(key:string)=>saved.get(key),setSynced:async(key:string,value:unknown)=>{saved.set(key,value);} },
    rem:{createRem,findOne:async(id:string)=>rems.get(id),findByName:async(name:string[],parent:string)=>[...rems.values()].find(r=>r.parent===parent && r.text.join('')===name.join(''))}, richText:{toString:async(value:string[])=>value.join('')},
    powerup:{getPowerupByCode:async(code:string)=>{
      if (!powerups.has(code)) { const id=`powerup:${code}`; add(id); powerups.set(code,id); }
      return rems.get(powerups.get(code)!);
    }} } as unknown as RNPlugin;
  return {plugin,rems,saved,createRem,add,fail:(skill:string)=>{failSkill=skill;}};
}
