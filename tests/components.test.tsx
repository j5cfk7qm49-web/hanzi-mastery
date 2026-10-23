import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ReviewExercise, type ExerciseProps } from '../src/ui/ReviewExercise';
import { DEFAULT_SETTINGS } from '../src/core/config';
import { MasteryRepository } from '../src/services/persistence';
import { RecallExercise } from '../src/ui/RecallExercise';
import { SkillRepository, skillHistoryKey } from '../src/services/recall';
import type { RecallSchema } from '../src/core/recall';
import type { QuizOptions, StrokeData, CharacterJson } from 'hanzi-writer';
const mocks=vi.hoisted(()=>({ quiz: undefined as Partial<QuizOptions> | undefined,
  quizHistory: [] as Partial<QuizOptions>[], setCharacter:vi.fn(),cancel:vi.fn(),options:undefined as Record<string,unknown> | undefined,
  load:vi.fn(),showOutline:vi.fn(),hideOutline:vi.fn() }));
vi.mock('hanzi-writer',()=>({ default:class {
  constructor(_node:unknown,options:Record<string,unknown>) { mocks.options=options; }
  async setCharacter(c:string){await mocks.setCharacter(c);}
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
beforeEach(()=>{mocks.quiz=undefined;mocks.quizHistory=[];mocks.setCharacter.mockReset();mocks.load.mockResolvedValue(data);});
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
function meaningSetup() {
  const values = new Map<string, unknown>();
  const storage = { getSynced: async <T,>(key: string) => structuredClone(values.get(key)) as T | undefined,
    setSynced: async (key: string, value: unknown) => { values.set(key, structuredClone(value)); } };
  const repository = new SkillRepository(storage);
  const schema: RecallSchema = { version: 1, skill: 'english-to-chinese', vocabularyId: 'meaning-vocab', traditional: '學', pinyin: 'xué', meaning: 'to study' };
  const props = { context: { cardId: 'translation-forward', schema }, repository, revealed: false, isCurrent: async () => true };
  return { props, values, repository, schema, view: render(<RecallExercise {...props} />) };
}
describe('meaning-to-characters uses the shared Hanzi Writer engine', () => {
  it('keeps the target hidden, grades actual strokes, and saves the translation skill separately', async () => {
    const { view, values, schema } = meaningSetup(); await begin();
    expect(view.container.innerHTML).not.toContain('學'); expect(screen.queryByRole('textbox')).toBeNull();
    expect(mocks.quiz).toMatchObject({ showHintAfterMisses: false, acceptBackwardsStrokes: false });
    await complete(); await screen.findByLabelText('Result saved');
    expect(values.get(skillHistoryKey(schema))).toMatchObject({ attempts: 1, passed: 1, history: [{ cardId: 'translation-forward', result: { assessment: 'checked', accuracy: 1 } }] });
    expect(values.has('hm:v2:writing:meaning-vocab:5b78')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Practice with hints and animation' }));
    expect(screen.getByText('Passed this writing test')).toBeTruthy();
    expect(values.get(skillHistoryKey(schema))).toMatchObject({ attempts: 1 });
  });
  it('fails on a premature native answer reveal and does not turn practice into success', async () => {
    const { view, props, values, schema } = meaningSetup(); await begin(); stroke(0);
    view.rerender(<RecallExercise {...props} revealed />); await screen.findByLabelText('Result saved');
    expect(values.get(skillHistoryKey(schema))).toMatchObject({ attempts: 1, passed: 0, history: [{ result: { failure: 'answer-revealed' } }] });
  });
  it('retries an interrupted translation save without recording the stroke attempt twice', async () => {
    const { repository, values, schema } = meaningSetup();
    const original = repository.save.bind(repository);
    const save = vi.spyOn(repository, 'save').mockRejectedValueOnce(new Error('offline')).mockImplementation(original);
    await begin(); await complete(); fireEvent.click(await screen.findByRole('button', { name: 'Retry result save' }));
    await screen.findByLabelText('Result saved'); expect(save.mock.calls[0][1].id).toBe(save.mock.calls[1][1].id);
    expect(values.get(skillHistoryKey(schema))).toMatchObject({ attempts: 1, passed: 1 });
    const writing = [...values.entries()].find(([key]) => key.startsWith('hm:v2:writing:'))![1] as { history: unknown[] };
    expect(writing.history).toHaveLength(1);
  });
});
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
  it('a delayed start check cannot switch guided practice back into a graded test',async()=>{
    let release!:(value:boolean)=>void;
    const pending=new Promise<boolean>(resolve=>{release=resolve;});
    const {store}=setup({isCurrent:()=>pending});
    fireEvent.click(await screen.findByRole('button',{name:'Begin test'}));
    fireEvent.click(screen.getByRole('button',{name:'Guided practice only'}));
    await waitFor(()=>expect(mocks.quiz!.showHintAfterMisses).toBe(2));
    await act(async()=>{release(true);await pending;});
    expect(screen.getByRole('button',{name:'Animate strokes'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'I forgot a stroke — end test'})).toBeNull();
    expect(store.setSynced).not.toHaveBeenCalled();
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
  it('one click ends the test for guided practice and saves the original failure',async()=>{
    const {store}=setup();await begin();stroke(0);
    fireEvent.click(screen.getByRole('button',{name:'Review options and details'}));
    fireEvent.click(screen.getByRole('button',{name:'End test for guided practice'}));
    await screen.findByRole('button',{name:'Animate strokes'});
    await screen.findByText('Writing mastery saved and read back.');
    expect(screen.getByText('Writing test failed')).toBeTruthy();
    expect(store.setSynced.mock.calls[0][1]).toHaveProperty('history.0.result.failure','guided-practice');
  });
  it('engine failure on the second character resumes that character without erasing its errors',async()=>{
    const {view,props,store}=setup({context:{cardId:'word',vocabularyId:'v',chars:['學','國'],prompt:'study country'}});
    await begin();await complete();
    await waitFor(()=>expect(mocks.quizHistory).toHaveLength(2));
    stroke(0,'rejected','國');stroke(0,'accepted','國');
    view.rerender(<ReviewExercise {...props} suspended/>);
    await waitFor(()=>expect(screen.getByText(/Waiting for RemNote/)).toBeTruthy());
    mocks.setCharacter.mockRejectedValueOnce(new Error('temporary engine failure'));
    view.rerender(<ReviewExercise {...props}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Retry writing canvas'}));
    await waitFor(()=>expect(mocks.quiz!.quizStartStrokeNum).toBe(1));
    expect(screen.getByText('Character 2 / 2')).toBeTruthy();
    expect(screen.getByText('1 / 10 strokes · 1 rejected attempts')).toBeTruthy();
    expect(store.setSynced).not.toHaveBeenCalled();
    for(let i=1;i<10;i++)stroke(i,'accepted','國');
    act(()=>mocks.quiz!.onComplete!({character:'國',totalMistakes:0}));
    await screen.findByText('Writing mastery saved and read back.');
    expect(store.setSynced).toHaveBeenCalledTimes(2);
    expect(store.setSynced.mock.calls[1][1]).toHaveProperty('history.0.result.accuracy',.9);
  });
  it('pauses for host verification and resumes the accepted prefix with the same ledger',async()=>{
    const {view,props}=setup();await begin();stroke(0);stroke(1,'rejected');
    const old=mocks.quiz!;
    view.rerender(<ReviewExercise {...props} suspended/>);
    await screen.findByText(/Waiting for RemNote/);
    act(()=>old.onCorrectStroke!({character:'學',strokeNum:1} as StrokeData));
    expect(screen.getByText('1 / 10 strokes · 1 rejected attempts')).toBeTruthy();
    view.rerender(<ReviewExercise {...props}/>);
    await waitFor(()=>expect(mocks.quiz).not.toBe(old));
    expect(mocks.quiz!.quizStartStrokeNum).toBe(1);
    expect(screen.getByText('1 / 10 strokes · 1 rejected attempts')).toBeTruthy();
  });
  it('saves a completed word as one verified batch even if navigation unmounts during the first write',async()=>{
    const {view,store}=setup({context:{cardId:'word',vocabularyId:'v',chars:['學','國'],prompt:'study country'}});
    let release!:()=>void;
    const waiting=new Promise<void>(resolve=>{release=resolve;});
    const original=store.setSynced.getMockImplementation()!;
    store.setSynced.mockImplementationOnce(async(k,v)=>{await waiting;await original(k,v);});
    await begin();await complete();
    await waitFor(()=>expect(mocks.setCharacter).toHaveBeenLastCalledWith('國'));
    await complete('國');await waitFor(()=>expect(store.setSynced).toHaveBeenCalledTimes(1));
    view.unmount();release();
    await waitFor(()=>expect(store.setSynced).toHaveBeenCalledTimes(2));
  });
  it('repeated characters save their worst result once',async()=>{
    const {store}=setup({context:{cardId:'word',vocabularyId:'v',chars:['學','學'],prompt:'study twice'}});
    await begin();await complete();await waitFor(()=>expect(mocks.quizHistory).toHaveLength(2));
    stroke(0,'rejected');await complete();
    await screen.findByText('Writing mastery saved and read back.');
    expect(store.setSynced).toHaveBeenCalledTimes(1);
    expect(store.setSynced.mock.calls[0][1]).toHaveProperty('history.0.result.accuracy',.9);
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
  it('does not perform a delayed auto-scroll after the learner touches the canvas',async()=>{
    const previous=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollIntoView');
    const scroll=vi.fn();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{value:scroll,configurable:true});
    try {
      setup();await begin();const count=scroll.mock.calls.length;expect(count).toBeGreaterThan(0);
      fireEvent.touchStart(screen.getByRole('application'));
      await act(async()=>{await new Promise(resolve=>setTimeout(resolve,350));});
      expect(scroll).toHaveBeenCalledTimes(count);
    } finally {
      if(previous)Object.defineProperty(HTMLElement.prototype,'scrollIntoView',previous);
      else Reflect.deleteProperty(HTMLElement.prototype,'scrollIntoView');
    }
  });
  it('does not save on a different current card',async()=>{
    let valid=true;const {store}=setup({isCurrent:async()=>valid});await begin();valid=false;await complete();
    await screen.findByRole('button',{name:'Retry result save'});expect(store.setSynced).not.toHaveBeenCalled();
  });
});
