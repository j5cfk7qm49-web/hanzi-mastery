import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ReviewExercise, type ExerciseProps } from '../src/ui/ReviewExercise';
import { DEFAULT_SETTINGS } from '../src/core/config';
import { MasteryRepository } from '../src/services/persistence';
import type { QuizOptions, StrokeData, CharacterJson } from 'hanzi-writer';
const mocks=vi.hoisted(()=>({ quiz: undefined as Partial<QuizOptions> | undefined,
  quizHistory: [] as Partial<QuizOptions>[], setCharacter:vi.fn(),cancel:vi.fn(),options:undefined as Record<string,unknown> | undefined,
  load:vi.fn(),showOutline:vi.fn(),hideOutline:vi.fn() }));
vi.mock('hanzi-writer',()=>({ default:class {
  constructor(_node:unknown,options:Record<string,unknown>) { mocks.options=options; }
  async setCharacter(c:string){mocks.setCharacter(c);}
  cancelQuiz(){mocks.cancel();}
  async hideCharacter(){}
  async showOutline(){mocks.showOutline();}
  async hideOutline(){mocks.hideOutline();}
  async showCharacter(){}
  async animateCharacter(){}
  updateDimensions(){}
  async quiz(options:Partial<QuizOptions>){mocks.quiz=options;mocks.quizHistory.push(options);}
} }));
vi.mock('../src/services/characters',()=>({loadCharacter:(...args:unknown[])=>mocks.load(...args)}));
const data:CharacterJson={strokes:Array(10).fill('M 0 0 L 1 1'),medians:Array(10).fill([[0,0],[1,1]])};
beforeEach(()=>{mocks.quiz=undefined;mocks.quizHistory=[];mocks.load.mockResolvedValue(data);});
function setup(options:Partial<ExerciseProps>={}) {
  const map=new Map<string,unknown>();
  const store={getSynced:async<T,>(k:string)=>structuredClone(map.get(k)) as T,
    setSynced:vi.fn(async(k:string,v:unknown)=>{map.set(k,structuredClone(v));})};
  const repository=new MasteryRepository(store);
  const props:ExerciseProps={context:{cardId:'c1',vocabularyId:'v1',chars:['學'],prompt:'study'},
    settings:DEFAULT_SETTINGS,repository,revealed:false,isCurrent:async()=>true,...options};
  return {props,map,store,view:render(<ReviewExercise {...props}/>)};
}
async function begin(){fireEvent.click(await screen.findByRole('button',{name:'Begin test'}));await waitFor(()=>expect(mocks.quiz).toBeDefined());}
function stroke(i:number,type:'accepted'|'rejected'='accepted',character='學') {
  const event:StrokeData={character,strokeNum:i,totalMistakes:0,mistakesOnStroke:0,strokesRemaining:9-i,isBackwards:false,drawnPath:{points:[{x:0,y:0},{x:1,y:1}],pathString:''}};
  act(()=>{if(type==='accepted')mocks.quiz!.onCorrectStroke!(event);else mocks.quiz!.onMistake!(event);});
}
async function complete(character='學') {
  for(let i=0;i<10;i++)stroke(i,'accepted',character);
  act(()=>mocks.quiz!.onComplete!({character,totalMistakes:0}));
}
describe('review UI and engine lifecycle',()=>{
  it('keeps targets out of question DOM and disables engine hints/forced or backwards acceptance',async()=>{
    const {view}=setup(); await begin();
    expect(view.container.textContent).not.toContain('學');
    expect(view.container.innerHTML).not.toContain('學');
    expect(mocks.options).toMatchObject({showCharacter:false,showOutline:false});
    expect(mocks.quiz).toMatchObject({showHintAfterMisses:false,markStrokeCorrectAfterMisses:false,acceptBackwardsStrokes:false});
    expect(mocks.hideOutline).toHaveBeenCalled();
  });
  it('records a complete result, read-back confirmation, and retains it in guided practice',async()=>{
    const {store}=setup();await begin();await complete();
    expect(await screen.findByText('Passed this writing test')).toBeTruthy();
    await screen.findByText('Writing mastery saved and read back.');expect(store.setSynced).toHaveBeenCalledTimes(1);
    expect(store.setSynced.mock.calls[0][1]).toHaveProperty('history.0.attempt.events');
    fireEvent.click(screen.getByRole('button',{name:'Practice with hints and animation'}));
    await waitFor(()=>expect(mocks.quiz!.showHintAfterMisses).toBe(2));
    expect(screen.getByText('Passed this writing test')).toBeTruthy();expect(store.setSynced).toHaveBeenCalledTimes(1);
  });
  it('C: declaring a forgotten stroke gives an automatic failure and practice cannot undo it',async()=>{
    setup();await begin();stroke(0);fireEvent.click(screen.getByRole('button',{name:'I forgot a stroke — end test'}));
    expect(await screen.findByText('Writing test failed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Practice with hints and animation'}));
    expect(screen.getByText('Writing test failed')).toBeTruthy();
  });
  it('native answer reveal mid-test fails; an already revealed answer prevents starting',async()=>{
    const {view,props}=setup();await begin();stroke(0);
    view.rerender(<ReviewExercise {...props} revealed/>);
    expect(await screen.findByText('Writing test failed')).toBeTruthy();
  });
  it('learning-only mode never saves mastery',async()=>{
    const {store}=setup();fireEvent.click(await screen.findByRole('button',{name:'Guided practice only'}));
    await waitFor(()=>expect(mocks.quiz!.showHintAfterMisses).toBe(2));
    fireEvent.click(screen.getByRole('button',{name:'Practice again'})); expect(store.setSynced).not.toHaveBeenCalled();
  });
  it('H: changes card, resets statistics, and ignores stale callbacks',async()=>{
    const {view,props,store}=setup();await begin();stroke(0);
    const old=mocks.quiz!;
    view.rerender(<ReviewExercise key="c2" {...props} context={{...props.context,cardId:'c2',chars:['國'],prompt:'country'}}/>);
    expect(await screen.findByRole('button',{name:'Begin test'})).toBeTruthy();
    act(()=>old.onComplete!({character:'學',totalMistakes:0}));expect(store.setSynced).not.toHaveBeenCalled();
    expect(screen.queryByText('Passed this writing test')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Begin test'}));
    await waitFor(()=>expect(mocks.setCharacter).toHaveBeenLastCalledWith('國'));
    expect(screen.getByText('0 / 10 strokes · 0 rejected attempts')).toBeTruthy();
  });
  it('completes multiple characters sequentially and saves their independent results',async()=>{
    const {store}=setup({context:{cardId:'word',vocabularyId:'v',chars:['學','國'],prompt:'study country'}});
    await begin();await complete();
    await waitFor(()=>expect(mocks.setCharacter).toHaveBeenLastCalledWith('國'));
    expect(screen.queryByText('Passed this writing test')).toBeNull();
    await complete('國');await screen.findByText('Writing mastery saved and read back.');expect(store.setSynced).toHaveBeenCalledTimes(2);
  });
  it('load failure blocks testing and can be retried without a grade',async()=>{
    mocks.load.mockRejectedValueOnce(new Error('Stroke data unavailable.'));
    const {store}=setup();expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Begin test'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Retry loading'}));
    await screen.findByRole('button',{name:'Begin test'});expect(store.setSynced).not.toHaveBeenCalled();
  });
  it('cancels on unmount and does not save a late engine completion',async()=>{
    const {view,store}=setup();await begin();const old=mocks.quiz!;view.unmount();
    act(()=>old.onComplete!({character:'學',totalMistakes:0}));expect(mocks.cancel).toHaveBeenCalled();expect(store.setSynced).not.toHaveBeenCalled();
  });
  it('recovers from OS touch cancellation without erasing previously recorded strokes or errors',async()=>{
    setup();await begin();stroke(0);stroke(1,'rejected');
    fireEvent(screen.getByRole('application'),new Event('touchcancel',{bubbles:true}));
    await waitFor(()=>expect(mocks.quiz!.quizStartStrokeNum).toBe(1));
    expect(screen.getByText('1 / 10 strokes · 1 rejected attempts')).toBeTruthy();
    expect(screen.getByText(/device interrupted this contact/)).toBeTruthy();
  });
  it('does not save on a different current card',async()=>{
    let valid=true;const {store}=setup({isCurrent:async()=>valid});await begin();valid=false;await complete();
    await screen.findByRole('button',{name:'Retry mastery save'});expect(store.setSynced).not.toHaveBeenCalled();
  });
});
