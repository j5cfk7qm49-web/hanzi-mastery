import React from 'react';
import { describe,it,expect,vi } from 'vitest';
import { render,screen,fireEvent,waitFor,cleanup } from '@testing-library/react';
import { StudyPacks } from '../src/studyPacks/StudyPacks';
import { CircleExercise } from '../src/studyPacks/CircleExercise';
import { StudyPackRepository,PackAudioStore } from '../src/studyPacks/repository';
import { courseItem,coursePack } from './helpers/course-pack';
import { memoryRemNote } from './helpers/remnote-memory';

describe('course interaction and recovery',() => {
  it('does not submit an empty text answer and restores completed writing without repeating it',async()=>{
    const {plugin}=memoryRemNote(),pack=coursePack([courseItem({id:'write',kind:'writing',mode:'writing',glyph:'一',answers:['一']}),courseItem({id:'text',kind:'text',mode:'recall',glyph:undefined,answers:['answer']})]);
    const repo=new StudyPackRepository(plugin.storage);await repo.install(pack);
    await repo.saveSession(pack.studyPackId,{id:'saved-writing',section:0,sourceVersion:pack.sourceVersion,ids:['write','text'],index:0,label:'Mixed practice'});
    const event={id:'saved-writing:write',at:1,passed:true,assessment:'checked' as const};await repo.record(pack.studyPackId,'write',event);
    render(<StudyPacks storage={plugin.storage}/>);fireEvent.click(await screen.findByRole('button',{name:'Resume (1/2)'}));
    expect(await screen.findByRole('heading',{name:'Writing result saved'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Begin test'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Next activity'}));await screen.findByLabelText('Your answer');expect((await repo.item(pack.studyPackId,'write')).attempts).toBe(1);
    const submit=screen.getByRole('button',{name:'Submit and reveal'}) as HTMLButtonElement;expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Your answer'),{target:{value:'   '}});expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Your answer'),{target:{value:'answer'}});expect(submit.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Your answer'),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'Reveal without answering'}));
    expect(await screen.findByText('No answer given. Save this result to revisit it in Practice missed.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Save result and next'}));await screen.findByRole('heading',{name:'Session complete'});expect((await repo.item(pack.studyPackId,'text')).lastPassed).toBe(false);
  });
  it('provides character Pinyin and meanings before a word-order answer without revealing its translation',async()=>{
    const {plugin}=memoryRemNote(),pack=coursePack([courseItem({id:'order',section:7,mode:'word-order',kind:'choice',glyph:'父母',syllables:['fù','mǔ'],glosses:['father','mother'],prompt:'Classify the word order.',choices:['Coordinate','Verb–object'],answers:['Coordinate'],reveal:'Model translation: parents'})]);
    await new StudyPackRepository(plugin.storage).install(pack);render(<StudyPacks storage={plugin.storage}/>);fireEvent.click(await screen.findByRole('button',{name:/Practice selected/}));
    await screen.findByRole('heading',{name:'Classify the word order.'});expect([...document.querySelectorAll('rt')].map(el=>el.textContent)).toEqual(['fù','mǔ']);expect(screen.getByText('father')).toBeTruthy();expect(screen.getByText('mother')).toBeTruthy();expect(screen.queryByText('Model translation: parents')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Coordinate',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Submit and reveal'}));expect(await screen.findByText('Model translation: parents')).toBeTruthy();
  });
  it('keeps independent section resume slots and migrates the old saved session without losing its draft',async()=>{
    const {plugin}=memoryRemNote(),pack=coursePack([
      courseItem({id:'sound-a',section:2,kind:'oral',mode:'sound-recognition',prompt:'Pronounce a'}),
      courseItem({id:'sound-ai',section:2,kind:'oral',mode:'sound-recognition',prompt:'Pronounce ai'}),
      courseItem({id:'meaning',section:3,kind:'text',mode:'radical-meaning',prompt:'Radical meaning'})
    ]);pack.sections=[{id:2,title:'Pinyin'},{id:3,title:'Radicals'}];
    const repo=new StudyPackRepository(plugin.storage);await repo.install(pack);await repo.saveSession(pack.studyPackId,{id:'saved',sourceVersion:pack.sourceVersion,ids:['sound-a','sound-ai'],index:0,label:'Mixed practice',draft:{itemId:'sound-a',answer:'',submitted:true}});
    const view=render(<StudyPacks storage={plugin.storage}/>);const resume=await screen.findByRole('group',{name:'Saved session'});
    expect(resume.textContent).toContain('Pinyin · Pronunciation · Mixed practice');
    fireEvent.change(screen.getByRole('combobox',{name:'Section',exact:true}),{target:{value:'3'}});fireEvent.change(screen.getByRole('combobox',{name:'Activity',exact:true}),{target:{value:'radical-meaning'}});
    expect(screen.getByRole('button',{name:'Practice selected (1)'})).toBeTruthy();expect(screen.queryByRole('button',{name:/Resume/})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Practice selected (1)'}));await screen.findByRole('heading',{name:'Radical meaning'});
    fireEvent.change(screen.getByLabelText('Your answer'),{target:{value:'unfinished meaning'}});fireEvent.click(screen.getByRole('button',{name:'Save and return to dashboard'}));await screen.findByRole('group',{name:'Saved session'});
    view.unmount();const reopened=render(<StudyPacks storage={plugin.storage}/>);await screen.findByRole('group',{name:'Saved session'});
    fireEvent.change(screen.getByRole('combobox',{name:'Section',exact:true}),{target:{value:'2'}});
    expect(screen.getByRole('group',{name:'Saved session'}).textContent).toContain('Pinyin · Pronunciation · Mixed practice');
    fireEvent.click(screen.getByRole('button',{name:'Resume (1/2)'}));expect(await screen.findByRole('heading',{name:'Pronounce a'})).toBeTruthy();expect(screen.getByRole('heading',{name:'Compare with the instructor'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Skip reading (no result)'}));await screen.findByRole('heading',{name:'Pronounce ai'});fireEvent.click(screen.getByRole('button',{name:'Save and return to dashboard'}));await screen.findByRole('group',{name:'Saved session'});
    reopened.unmount();render(<StudyPacks storage={plugin.storage}/>);expect(await screen.findByRole('button',{name:'Resume (2/2)'})).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox',{name:'Section',exact:true}),{target:{value:'3'}});fireEvent.click(screen.getByRole('button',{name:'Resume (1/1)'}));expect(await screen.findByDisplayValue('unfinished meaning')).toBeTruthy();
    const saved=await repo.sessions(pack);expect(saved[2].ids).toEqual(['sound-a','sound-ai']);expect(saved[2].index).toBe(1);expect(saved[3].draft?.answer).toBe('unfinished meaning');
  });
  it('finishes a fixed list across resume before practicing missed activities separately',async()=>{
    const {plugin}=memoryRemNote(),pack=coursePack(['a','b','c'].map(id=>courseItem({id,kind:'text',mode:'recall',prompt:`Recall ${id}`,answers:[id],selfGrade:false})));
    const repo=new StudyPackRepository(plugin.storage);await repo.install(pack);const view=render(<StudyPacks storage={plugin.storage}/>);
    fireEvent.click(await screen.findByRole('button',{name:/Practice selected/}));await screen.findByLabelText('Your answer');
    const initial=(await repo.session(pack.studyPackId))!;
    fireEvent.change(screen.getByLabelText('Your answer'),{target:{value:'wrong'}});fireEvent.click(screen.getByRole('button',{name:'Submit and reveal'}));fireEvent.click(await screen.findByRole('button',{name:'Save result and next'}));
    await screen.findByRole('heading',{name:`Recall ${initial.ids[1]}`});view.unmount();render(<StudyPacks storage={plugin.storage}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Resume (2/3)'}));expect(await screen.findByRole('heading',{name:`Recall ${initial.ids[1]}`})).toBeTruthy();
    for(const id of initial.ids.slice(1)){
      await screen.findByRole('heading',{name:`Recall ${id}`});
      fireEvent.change(screen.getByLabelText('Your answer'),{target:{value:id}});fireEvent.click(screen.getByRole('button',{name:'Submit and reveal'}));fireEvent.click(await screen.findByRole('button',{name:'Save result and next'}));
      await waitFor(async()=>expect((await repo.item(pack.studyPackId,id)).attempts).toBe(1));
    }
    expect(await screen.findByText('Session complete')).toBeTruthy();expect((await repo.session(pack.studyPackId))?.ids).toEqual(initial.ids);expect((await repo.session(pack.studyPackId))?.index).toBe(3);
    fireEvent.click(screen.getByRole('button',{name:'Return to dashboard'}));expect((screen.getByRole('button',{name:'Practice unstudied (0)'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Practice missed',exact:true}));expect(await screen.findByRole('heading',{name:`Recall ${initial.ids[0]}`})).toBeTruthy();
    expect((await repo.session(pack.studyPackId))?.ids).toEqual([initial.ids[0]]);expect((await repo.item(pack.studyPackId,initial.ids[0])).attempts).toBe(1);
  });
  it('practices unstudied activities within the filters and keeps skips unstudied after reopening',async()=>{
    const {plugin}=memoryRemNote(),pack=coursePack([
      courseItem({id:'skipped',section:2,mode:'sound-recognition',kind:'oral'}),
      courseItem({id:'missed',section:2,mode:'sound-recognition',kind:'oral'}),
      courseItem({id:'passed',section:2,mode:'sound-recognition',kind:'oral'}),
      courseItem({id:'other-mode',section:2,mode:'spelling',kind:'text'}),
      courseItem({id:'other-section',section:3,mode:'sound-recognition',kind:'oral'})
    ]);pack.sections=[{id:2,title:'Pinyin'},{id:3,title:'Radicals'}];
    const repo=new StudyPackRepository(plugin.storage);await repo.install(pack);
    await repo.record(pack.studyPackId,'missed',{id:'prior-miss',at:1,passed:false,assessment:'self'});await repo.record(pack.studyPackId,'passed',{id:'prior-pass',at:2,passed:true,assessment:'self'});
    const before=await repo.progress(pack),view=render(<StudyPacks storage={plugin.storage}/>);
    expect(await screen.findByRole('button',{name:'Practice unstudied (3)'})).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox',{name:'Section',exact:true}),{target:{value:'2'}});expect(screen.getByRole('button',{name:'Practice unstudied (2)'})).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox',{name:'Activity',exact:true}),{target:{value:'sound-recognition'}});fireEvent.click(screen.getByRole('button',{name:'Practice unstudied (1)'}));
    expect(await screen.findByRole('button',{name:'Skip reading (no result)'})).toBeTruthy();expect((await repo.session(pack.studyPackId))?.ids).toEqual(['skipped']);
    fireEvent.click(screen.getByRole('button',{name:'Skip reading (no result)'}));expect(await screen.findByText('Session complete')).toBeTruthy();expect(await repo.progress(pack)).toEqual(before);
    view.unmount();render(<StudyPacks storage={plugin.storage}/>);expect(await screen.findByRole('button',{name:'Practice unstudied (2)'})).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox',{name:'Section',exact:true}),{target:{value:'0'}});expect(screen.getByRole('button',{name:'Practice unstudied (3)'})).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox',{name:'Section',exact:true}),{target:{value:'2'}});fireEvent.change(screen.getByRole('combobox',{name:'Activity',exact:true}),{target:{value:'sound-recognition'}});
    fireEvent.click(screen.getByRole('button',{name:'Practice unstudied (1)'}));await screen.findByRole('button',{name:'Skip reading (no result)'});expect((await repo.session(pack.studyPackId))?.ids).toEqual(['skipped']);
  });
  it('records a performed dictionary lookup without asking for a written procedure',async()=>{
    const {plugin}=memoryRemNote(),pack=coursePack([courseItem({id:'lookup',section:4,mode:'dictionary-lookup',kind:'text',glyph:'心',prompt:'Find this assigned character in your dictionary.',answers:['Located the entry.'],selfGrade:true})]);
    const repo=new StudyPackRepository(plugin.storage);await repo.install(pack);render(<StudyPacks storage={plugin.storage}/>);
    fireEvent.click(await screen.findByRole('button',{name:/Practice selected/}));expect(await screen.findByRole('article',{name:'Dictionary lookup exercise'})).toBeTruthy();
    expect(screen.queryByLabelText('Your answer')).toBeNull();expect(screen.getByRole('link',{name:'CC-CEDICT: 心'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'I found the entry'}));expect(await screen.findByText('Session complete')).toBeTruthy();expect((await repo.item(pack.studyPackId,'lookup')).lastPassed).toBe(true);
  });
  it('tests radical meaning separately from Pinyin and keeps self-assessed equivalent English',async()=>{
    const {plugin}=memoryRemNote(),pack=coursePack([courseItem({id:'meaning',mode:'radical-meaning',kind:'text',glyph:'木',prompt:'Recall the radical’s English meaning.',answers:['tree, wood'],reveal:'tree, wood',selfGrade:true})]);
    await new StudyPackRepository(plugin.storage).install(pack);render(<StudyPacks storage={plugin.storage}/>);fireEvent.click(await screen.findByRole('button',{name:/Practice selected/}));
    expect(screen.queryByLabelText('Your pinyin')).toBeNull();fireEvent.change(await screen.findByLabelText('Your answer'),{target:{value:'wood'}});fireEvent.click(screen.getByRole('button',{name:'Submit and reveal'}));
    expect((await screen.findAllByText('tree, wood')).length).toBeGreaterThan(0);fireEvent.click(screen.getByRole('button',{name:'I got it'}));expect(await screen.findByText('Session complete')).toBeTruthy();
  });
  it('uses a synced Rem audio attachment without requiring local audio import, and shows Pinyin initially',async()=>{
    const {plugin}=memoryRemNote(),pack=coursePack([courseItem({id:'oral',kind:'oral',mode:'reading',section:1,glyph:'大學',syllables:['dà','xué'],audioId:'clip',prompt:'Read with Pinyin.'})]);
    pack.audio=[{id:'clip',path:'private_assets/audio/clip.m4a',sha256:'a'.repeat(64),bytes:3,url:'https://files.remnote.com/clip.m4a'}];
    const local=vi.spyOn(PackAudioStore.prototype,'get');await new StudyPackRepository(plugin.storage).install(pack);
    render(<StudyPacks storage={plugin.storage}/>);fireEvent.click(await screen.findByRole('button',{name:/Practice selected/}));
    expect(await screen.findByRole('button',{name:'Hide Pinyin'})).toBeTruthy();expect(document.querySelectorAll('rt')).toHaveLength(2);
    expect(screen.queryByLabelText('Private course reference')).toBeNull();expect(screen.queryByRole('button',{name:'I got it'})).toBeNull();expect(local).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:"I've read aloud — compare"}));
    const reference=await screen.findByLabelText('Private course reference');expect(reference.getAttribute('src')).toBe('https://files.remnote.com/clip.m4a');
    expect((screen.getByRole('button',{name:'I got it'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.canPlay(reference);fireEvent.ended(reference);
    expect((screen.getByRole('button',{name:'I got it'}) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:'I got it'}));expect(await screen.findByText('Session complete')).toBeTruthy();
    expect((await new StudyPackRepository(plugin.storage).item(pack.studyPackId,'oral')).lastPassed).toBe(true);expect(local).not.toHaveBeenCalled();vi.restoreAllMocks();
  });
  it('resumes an oral comparison, requires fresh reference playback, and skips unavailable audio without a grade',async()=>{
    const {plugin}=memoryRemNote(),pack=coursePack([courseItem({id:'oral',kind:'oral',mode:'reading',glyph:'大學',syllables:['dà','xué'],showPinyin:false,answers:['dà xué'],audioId:undefined})]);
    const repo=new StudyPackRepository(plugin.storage);await repo.install(pack);const view=render(<StudyPacks storage={plugin.storage}/>);
    fireEvent.click(await screen.findByRole('button',{name:/Practice selected/}));expect(document.querySelectorAll('rt')).toHaveLength(0);
    fireEvent.click(await screen.findByRole('button',{name:"I've read aloud — compare"}));await waitFor(async()=>expect((await repo.session(pack.studyPackId))?.draft?.submitted).toBe(true));
    view.unmount();render(<StudyPacks storage={plugin.storage}/>);fireEvent.click(await screen.findByRole('button',{name:/Resume/}));
    expect(await screen.findByText(/no unique supplied recording/)).toBeTruthy();expect((screen.getByRole('button',{name:'Needs practice'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Skip reading (no result)'}));expect(await screen.findByText('Session complete')).toBeTruthy();expect((await repo.item(pack.studyPackId,'oral')).attempts).toBe(0);
  });
  it('records pointer circles on a whole glyph and supports the keyboard fallback',() => {
    let points:number[][][]=[];
    const {rerender}=render(<CircleExercise glyph="海" points={points} onChange={p => {points=p;}}/>);
    const svg=screen.getByRole('img',{name:'Circle the radical in 海'});
    vi.spyOn(svg,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:300,height:300} as DOMRect);
    expect(svg.querySelectorAll('polyline')).toHaveLength(0);
    fireEvent.pointerDown(svg,{pointerId:1,clientX:20,clientY:20,pointerType:'touch'});
    rerender(<CircleExercise glyph="海" points={points} onChange={p=>{points=p;}}/>);
    fireEvent.pointerMove(svg,{pointerId:1,clientX:40,clientY:50,pointerType:'touch'});
    expect(points[0]).toHaveLength(2);fireEvent.pointerUp(svg,{pointerId:1});
    expect(screen.getByText(/Keyboard alternative/)).toBeTruthy();
  });
  it('freezes the submitted answer and resumes it after reopening',async () => {
    const {plugin}=memoryRemNote(),repo=new StudyPackRepository(plugin.storage),pack=coursePack();await repo.install(pack);
    const view=render(<StudyPacks storage={plugin.storage}/>);
    fireEvent.click(await screen.findByRole('button',{name:/Practice selected/}));
    const input=await screen.findByLabelText('Location description (keyboard alternative)');
    fireEvent.change(input,{target:{value:'three strokes on the left'}});
    expect(screen.queryByText(/氵 \/ 水/)).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Reveal and compare'}));
    expect(await screen.findByText(/氵 \/ 水/)).toBeTruthy();
    expect((input as HTMLTextAreaElement).readOnly).toBe(true);
    await waitFor(async()=>expect((await repo.session(pack.studyPackId))?.draft?.submitted).toBe(true));
    view.unmount();render(<StudyPacks storage={plugin.storage}/>);
    fireEvent.click(await screen.findByRole('button',{name:/Resume/}));
    expect(await screen.findByDisplayValue('three strokes on the left')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Needs practice'}));
    expect(await screen.findByText('Session complete')).toBeTruthy();
    expect((await repo.item(pack.studyPackId,pack.items[0].id)).misses).toBe(1);
  });
  it('shows only manual radical answers for every fallback and never quizzes example pronunciation',async () => {
    for(const [glyph,reveal] of [['海','氵 / 水'],['想','心'],['朗','月'],['陸','阝 = 阜 (left side)']]) {
      const {plugin}=memoryRemNote();await new StudyPackRepository(plugin.storage).install(coursePack([courseItem({glyph,reveal})]));
      render(<StudyPacks storage={plugin.storage}/>);fireEvent.click(await screen.findByRole('button',{name:/Practice selected/}));
      await screen.findByRole('img',{name:`Circle the radical in ${glyph}`});
      expect(screen.queryByText(reveal)).toBeNull();expect(screen.queryByLabelText('Your pinyin')).toBeNull();
      fireEvent.click(screen.getByRole('button',{name:'Reveal and compare'}));expect(await screen.findByText(reveal)).toBeTruthy();cleanup();
    }
  });
  it('disables missing dictation without showing filenames or answer spelling',async () => {
    const {plugin}=memoryRemNote(),pack=coursePack([courseItem({id:'hidden-item',mode:'dictation',section:2,kind:'text',glyph:undefined,prompt:'Listen, then type the sound.',answers:['iong'],audioId:'opaque-id',reveal:'Compare',selfGrade:true})]);
    vi.spyOn(PackAudioStore.prototype,'get').mockResolvedValue(undefined);await new StudyPackRepository(plugin.storage).install(pack);
    render(<StudyPacks storage={plugin.storage}/>);fireEvent.click(await screen.findByRole('button',{name:/Practice selected/}));
    expect(await screen.findByText(/Audio not configured on this device/)).toBeTruthy();
    expect(screen.queryByText('iong')).toBeNull();expect(document.body.textContent).not.toContain('.mp3');
    expect((screen.getByRole('button',{name:'Submit and reveal'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Skip audio activity (no result)'}));expect(await screen.findByText('Session complete')).toBeTruthy();
    expect((await new StudyPackRepository(plugin.storage).item(pack.studyPackId,'hidden-item')).attempts).toBe(0);
    vi.restoreAllMocks();
  });
  it('keeps a revealed first answer on save failure and retries the same result once',async()=>{
    const {plugin}=memoryRemNote(),repo=new StudyPackRepository(plugin.storage),pack=coursePack();await repo.install(pack);
    const write=plugin.storage.setSynced;let fail=true;
    vi.spyOn(plugin.storage,'setSynced').mockImplementation(async(key,value)=>{if(key.includes(':item:') && fail)return;await write(key,value);});
    render(<StudyPacks storage={plugin.storage}/>);fireEvent.click(await screen.findByRole('button',{name:/Practice selected/}));
    fireEvent.change(await screen.findByLabelText('Location description (keyboard alternative)'),{target:{value:'left'}});
    fireEvent.click(screen.getByRole('button',{name:'Reveal and compare'}));fireEvent.click(await screen.findByRole('button',{name:'Needs practice'}));
    expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.getByDisplayValue('left')).toBeTruthy();
    fail=false;fireEvent.click(screen.getByRole('button',{name:'Needs practice'}));expect(await screen.findByText('Session complete')).toBeTruthy();
    expect((await repo.item(pack.studyPackId,pack.items[0].id)).attempts).toBe(1);vi.restoreAllMocks();
  });
});
