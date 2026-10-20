import { it, expect, vi } from 'vitest';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { readReviewContext, stillCurrent, subscribeReview, createWritingCard, ensureCollection } from '../src/services/remnote';
import { DEFAULT_SETTINGS } from '../src/core/config';
const schema={version:2 as const,skill:'writing' as const,vocabularyId:'v',traditional:'學',prompt:'study'};
function host() {
  const rem={hasPowerup:async()=>true,getPowerupProperty:async()=>JSON.stringify(schema)};
  const card={_id:'c',remId:'r',type:'forward',repetitionHistory:[] as {date:number}[],getRem:async()=>({_id:'r',text:['ordinary answer data']})};
  const api={rem:{findOne:vi.fn(async()=>rem)},queue:{getCurrentCard:vi.fn(async()=>card),hasRevealedAnswer:async()=>false,inLookbackMode:async()=>false},
    widget:{getWidgetContext:async():Promise<{cardId?:string;remId:string;revealed:boolean}>=>({cardId:'c',remId:'r',revealed:false})},event:{addListener:vi.fn(),removeListener:vi.fn()}};
  return {api,plugin:api as unknown as RNPlugin};
}
it('uses matching widget card identity and explicit metadata, never ordinary card parsing',async()=>{
  const {plugin,api}=host();expect(await readReviewContext(plugin,DEFAULT_SETTINGS)).toMatchObject({cardId:'c',chars:['學'],prompt:'study'});
  expect(api.rem.findOne).toHaveBeenCalledWith('r');
});
it('rejects stale widget context, backwards cards and lookback',async()=>{
  const {plugin,api}=host();api.widget.getWidgetContext=async()=>({cardId:'wrong',remId:'r',revealed:false});
  expect(await readReviewContext(plugin,DEFAULT_SETTINGS)).toBeNull();
  expect(await stillCurrent(plugin,'wrong')).toBe(false);
  api.queue.inLookbackMode=async()=>true;expect(await stillCurrent(plugin,'c')).toBe(false);
});
it('accepts an SDK context without optional cardId only for the matching forward Rem outside lookback',async()=>{
  const {plugin,api}=host();api.widget.getWidgetContext=async()=>({remId:'r',revealed:false});
  expect(await readReviewContext(plugin,DEFAULT_SETTINGS)).toMatchObject({cardId:'c',chars:['學'],prompt:'study'});
  api.widget.getWidgetContext=async()=>({remId:'another-rem',revealed:false});
  expect(await readReviewContext(plugin,DEFAULT_SETTINGS)).toBeNull();
  api.widget.getWidgetContext=async()=>({remId:'r',revealed:false});
  const card=await api.queue.getCurrentCard();card.type='backward';
  expect(await readReviewContext(plugin,DEFAULT_SETTINGS)).toBeNull();
  card.type='forward';api.queue.inLookbackMode=async()=>true;
  expect(await readReviewContext(plugin,DEFAULT_SETTINGS)).toBeNull();
});
it('removes subscriptions on unmount and never replaces native controls',()=>{
  const {plugin,api}=host();const unsubscribe=subscribeReview(plugin,()=>{},()=>{});
  expect(api.event.addListener).toHaveBeenCalledTimes(4);unsubscribe();expect(api.event.removeListener).toHaveBeenCalledTimes(4);
});
it('blocks stale work when the same card is presented again after a native rating',async()=>{
  const {plugin,api}=host();expect(await stillCurrent(plugin,'c',true,0)).toBe(true);
  const card=await api.queue.getCurrentCard();card.repetitionHistory.push({date:123});
  expect(await stillCurrent(plugin,'c',true,0)).toBe(false);
  expect(await readReviewContext(plugin,DEFAULT_SETTINGS)).toMatchObject({reviewAt:123});
});
it('creates a forward-only card with a safe front, a real back and hidden structured linkage',async()=>{
  const rem={_id:'new',setText:vi.fn(),setBackText:vi.fn(),setPracticeDirection:vi.fn(),addPowerup:vi.fn(),setPowerupProperty:vi.fn()};
  const plugin={rem:{createRem:async()=>rem}} as unknown as RNPlugin;
  expect(await createWritingCard(plugin,schema)).toBe('new');
  expect(rem.setText.mock.calls[0][0].join('')).not.toContain('學');expect(rem.setBackText).toHaveBeenCalledWith(['學']);
  expect(rem.setPracticeDirection).toHaveBeenCalledWith('forward');
  expect(rem.setPowerupProperty.mock.calls[0][2]).toEqual([JSON.stringify(schema)]);
});
it('keeps incomplete cards out of the queue and resumes an authoring retry using the same Rem',async()=>{
  const rem={_id:'draft',setText:vi.fn(),setBackText:vi.fn(),setParent:vi.fn(),setPracticeDirection:vi.fn(),addPowerup:vi.fn(),setPowerupProperty:vi.fn()};
  const create=vi.fn();const plugin={rem:{findOne:async()=>rem,createRem:create}} as unknown as RNPlugin;
  await createWritingCard(plugin,schema,{resumeId:'draft',parentId:'collection'});
  expect(create).not.toHaveBeenCalled();expect(rem.setPracticeDirection.mock.calls.map(c=>c[0])).toEqual(['none','forward']);
  expect(rem.setParent).toHaveBeenCalledWith('collection');
});
it('reuses a real neutral collection document rather than creating orphan writing cards',async()=>{
  const rem={_id:'collection',setText:vi.fn(),setIsDocument:vi.fn()};let saved:string|undefined;
  const create=vi.fn(async()=>rem);
  const plugin={storage:{getSynced:async()=>saved,setSynced:async(_k:string,v:string)=>{saved=v;}},
    rem:{findOne:async()=>rem,createRem:create}} as unknown as RNPlugin;
  expect(await ensureCollection(plugin)).toBe('collection');expect(await ensureCollection(plugin)).toBe('collection');
  expect(create).toHaveBeenCalledTimes(1);expect(rem.setIsDocument).toHaveBeenCalledWith(true);
});
