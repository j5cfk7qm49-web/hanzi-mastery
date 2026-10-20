// Development-only harness; never an entry in the RemNote upload ZIP.
import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { ReviewExercise } from '../src/ui/ReviewExercise';
import { DEFAULT_SETTINGS } from '../src/core/config';
import { MasteryRepository } from '../src/services/persistence';
import '../src/ui/styles.css';
import { LayoutHost } from './layout-host';
import { RecallExercise } from '../src/ui/RecallExercise';
import { SkillRepository } from '../src/services/recall';
import { RECALL_SKILLS, type RecallSchema } from '../src/core/recall';
const params=new URLSearchParams(location.search);
const embedded=params.get('frame')==='review';
const cards=[...Array.from('學國書語聽體愛'),'學國','學學','人'].map((target,i)=>({id:`demo-${i}`,target,prompt:['study','country','book','language','listen','body','love','study country','study twice','person'][i]}));
function Harness(){
  const [index,setIndex]=useState(0),[revealed,setRevealed]=useState(false);
  const [suspended,setSuspended]=useState(false);
  const repository=useMemo(()=>new MasteryRepository({
    getSynced:async<T,>(key:string)=>{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:undefined;},
    setSynced:async(key:string,value:unknown)=>localStorage.setItem(key,JSON.stringify(value))
  }),[]);
  useEffect(()=>{
    if(!embedded)return;
    const root=document.getElementById('root')!;
    let scheduled:number|undefined,lastHeight=0;
    const report=()=>{
      const height=root.getBoundingClientRect().height;
      if(height!==lastHeight){lastHeight=height;window.parent.postMessage({type:'hm-layout-height',height},location.origin);}
    };
    const schedule=()=>{if(scheduled===undefined)scheduled=requestAnimationFrame(()=>{scheduled=undefined;report();});};
    const observer=new ResizeObserver(schedule);observer.observe(root);report();
    // Keep the fixture's auto-sized frame synchronized through WebKit mutation/layout delivery.
    const mutations=new MutationObserver(schedule);mutations.observe(root,{childList:true,subtree:true,attributes:true});
    window.addEventListener('resize',schedule);
    const receive=(event:MessageEvent)=>{if(event.origin===location.origin && event.source===window.parent && event.data?.type==='hm-layout-reveal')setRevealed(true);};
    window.addEventListener('message',receive);
    return()=>{observer.disconnect();mutations.disconnect();if(scheduled!==undefined)cancelAnimationFrame(scheduled);window.removeEventListener('resize',schedule);window.removeEventListener('message',receive);};
  },[]);
  const context=useMemo(()=>({cardId:cards[index].id,vocabularyId:'demo-vocabulary',chars:Array.from(cards[index].target),
    prompt:params.has('long')?'Write the character for studying a subject at school. '+ 'A deliberatelyLongUnbrokenEnglishPromptToCheckWrapping'.repeat(3):cards[index].prompt}),[index]);
  return <>{!embedded && <aside className="hm"><p>Development harness — simulated RemNote queue</p>
    <label>Demo card<select aria-label="Demo card" value={index} onChange={e=>{setIndex(Number(e.target.value));setRevealed(false);}}>
      {cards.map((c,i)=><option key={c.id} value={i}>{c.prompt}</option>)}</select></label>
    <button onClick={()=>setRevealed(true)}>Simulate native answer reveal</button>
    <button onClick={()=>setSuspended(v=>!v)}>{suspended ? 'Restore host connection' : 'Simulate host connection loss'}</button></aside>}
    <ReviewExercise key={context.cardId} context={context} settings={DEFAULT_SETTINGS} repository={repository}
      suspended={suspended} revealed={revealed} isCurrent={async(allow=true)=>!suspended && (allow || !revealed)}/></>;
}
function SkillHarness() {
  const [revealed, setRevealed] = useState(false), [suspended, setSuspended] = useState(false);
  const repository = useMemo(() => new SkillRepository({
    getSynced: async<T,>(key: string) => { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : undefined; },
    setSynced: async(key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value)),
  }), []);
  const requested = params.get('skill');
  const skill = RECALL_SKILLS.find(s => s === requested) || 'pinyin';
  const schema: RecallSchema = { version: 1, skill, vocabularyId: 'skill-demo', traditional: '人', pinyin: 'rén', meaning: 'person',
    ...(params.has('audioFixture') ? { referenceAudio: 'https://hanzi-audio.test/reference.wav' } : {}) };
  return <><aside className="hm"><p>Development harness — simulated RemNote queue</p>
    <button onClick={() => setRevealed(true)}>Simulate native answer reveal</button>
    <button onClick={() => setSuspended(v => !v)}>{suspended ? 'Restore host connection' : 'Simulate host connection loss'}</button></aside>
    <RecallExercise context={{ cardId: 'skill-demo', schema }} repository={repository} revealed={revealed} suspended={suspended}
      isCurrent={async (allow = true) => !suspended && (allow || !revealed)} /></>;
}
ReactDOM.render(params.has('skill') ? <SkillHarness/> : params.has('host')?<LayoutHost/>:<Harness/>,document.getElementById('root'));
