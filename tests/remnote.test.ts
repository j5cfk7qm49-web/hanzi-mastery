import { it, expect, vi } from 'vitest';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { readReviewContext, stillCurrent, subscribeReview, createWritingCard } from '../src/services/remnote';
import { DEFAULT_SETTINGS } from '../src/core/config';
const schema={version:2 as const,skill:'writing' as const,vocabularyId:'v',traditional:'學',prompt:'study'};
function host() {
  const rem={hasPowerup:async()=>true,getPowerupProperty:async()=>JSON.stringify(schema)};
  const card={_id:'c',remId:'r',type:'forward',getRem:async()=>rem};
  const api={queue:{getCurrentCard:vi.fn(async()=>card),hasRevealedAnswer:async()=>false,inLookbackMode:async()=>false},
    widget:{getWidgetContext:async()=>({cardId:'c',remId:'r',revealed:false})},event:{addListener:vi.fn(),removeListener:vi.fn()}};
  return {api,plugin:api as unknown as RNPlugin};
}
it('uses matching widget card identity and explicit metadata, never ordinary card parsing',async()=>{
  const {plugin}=host();expect(await readReviewContext(plugin,DEFAULT_SETTINGS)).toMatchObject({cardId:'c',chars:['學'],prompt:'study'});
});
it('rejects stale widget context, backwards cards and lookback',async()=>{
  const {plugin,api}=host();api.widget.getWidgetContext=async()=>({cardId:'wrong',remId:'r',revealed:false});
  expect(await readReviewContext(plugin,DEFAULT_SETTINGS)).toBeNull();
  expect(await stillCurrent(plugin,'wrong')).toBe(false);
  api.queue.inLookbackMode=async()=>true;expect(await stillCurrent(plugin,'c')).toBe(false);
});
it('removes subscriptions on unmount and never replaces native controls',()=>{
  const {plugin,api}=host();const unsubscribe=subscribeReview(plugin,()=>{},()=>{});
  expect(api.event.addListener).toHaveBeenCalledTimes(4);unsubscribe();expect(api.event.removeListener).toHaveBeenCalledTimes(4);
});
it('creates a forward-only card with a safe front, a real back and hidden structured linkage',async()=>{
  const rem={_id:'new',setText:vi.fn(),setBackText:vi.fn(),setPracticeDirection:vi.fn(),addPowerup:vi.fn(),setPowerupProperty:vi.fn()};
  const plugin={app:{transaction:async(fn:()=>Promise<void>)=>fn()},rem:{createRem:async()=>rem}} as unknown as RNPlugin;
  expect(await createWritingCard(plugin,schema)).toBe('new');
  expect(rem.setText.mock.calls[0][0].join('')).not.toContain('學');expect(rem.setBackText).toHaveBeenCalledWith(['學']);
  expect(rem.setPracticeDirection).toHaveBeenCalledWith('forward');
  expect(rem.setPowerupProperty.mock.calls[0][2]).toEqual([JSON.stringify(schema)]);
});
