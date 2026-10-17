// Development-only harness; never an entry in the RemNote upload ZIP.
import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { ReviewExercise } from '../src/ui/ReviewExercise';
import { DEFAULT_SETTINGS } from '../src/core/config';
import { MasteryRepository } from '../src/services/persistence';
import '../src/ui/styles.css';
const cards=[...Array.from('學國書語聽體愛'),'學國','學學'].map((target,i)=>({id:`demo-${i}`,target,prompt:['study','country','book','language','listen','body','love','study country','study twice'][i]}));
function Harness(){
  const [index,setIndex]=useState(0),[revealed,setRevealed]=useState(false);
  const [suspended,setSuspended]=useState(false);
  const repository=useMemo(()=>new MasteryRepository({
    getSynced:async<T,>(key:string)=>{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:undefined;},
    setSynced:async(key:string,value:unknown)=>localStorage.setItem(key,JSON.stringify(value))
  }),[]);
  const context=useMemo(()=>({cardId:cards[index].id,vocabularyId:'demo-vocabulary',chars:Array.from(cards[index].target),prompt:cards[index].prompt}),[index]);
  return <><aside className="hm"><p>Development harness — simulated RemNote queue</p>
    <label>Demo card<select aria-label="Demo card" value={index} onChange={e=>{setIndex(Number(e.target.value));setRevealed(false);}}>
      {cards.map((c,i)=><option key={c.id} value={i}>{c.prompt}</option>)}</select></label>
    <button onClick={()=>setRevealed(true)}>Simulate native answer reveal</button>
    <button onClick={()=>setSuspended(v=>!v)}>{suspended ? 'Restore host connection' : 'Simulate host connection loss'}</button></aside>
    <ReviewExercise key={context.cardId} context={context} settings={DEFAULT_SETTINGS} repository={repository}
      suspended={suspended} revealed={revealed} isCurrent={async(allow=true)=>!suspended && (allow || !revealed)}/></>;
}
ReactDOM.render(<Harness/>,document.getElementById('root'));
