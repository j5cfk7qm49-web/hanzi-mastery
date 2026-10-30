import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,within,waitFor} from '@testing-library/react';
import {StudyPackRepository} from '../src/studyPacks/repository';
import {StudyPacks} from '../src/studyPacks/StudyPacks';
import {courseItem,coursePack} from './helpers/course-pack';
import {memoryRemNote} from './helpers/remnote-memory';
const fixture=()=>coursePack(['a','b','c'].map(id=>courseItem({id,kind:'text',mode:'recall',prompt:`Recall ${id}`,answers:[id],selfGrade:false})));
const session=(pack=fixture())=>({id:'session',section:3,sourceVersion:pack.sourceVersion,ids:pack.items.map(i=>i.id),index:0,label:'Mixed practice'});

describe('one-pass session snapshots',()=>{
  it('rejects a stale cursor after a missed answer without changing its saved result',async()=>{
    const {plugin}=memoryRemNote(),repo=new StudyPackRepository(plugin.storage),pack=fixture(),initial=session(pack);await repo.install(pack);await repo.saveSession(pack.studyPackId,initial);
    await repo.record(pack.studyPackId,'a',{id:'session:a',at:1,passed:false,assessment:'checked'});const before=await repo.progress(pack);
    await repo.saveSession(pack.studyPackId,{...initial,index:1});const retained=await repo.saveSession(pack.studyPackId,initial);
    expect(retained.index).toBe(1);expect((await repo.session(pack.studyPackId))?.index).toBe(1);expect((await repo.sessions(pack))[3].index).toBe(1);expect(await repo.progress(pack)).toEqual(before);
  });
  it('allows a new list only when explicitly started, and keeps the first submitted answer frozen',async()=>{
    const {plugin}=memoryRemNote(),repo=new StudyPackRepository(plugin.storage),pack=fixture(),old=session(pack),fresh={...old,id:'new-session'};
    await repo.saveSession(pack.studyPackId,old);expect((await repo.saveSession(pack.studyPackId,fresh)).id).toBe(old.id);
    await repo.saveSession(pack.studyPackId,fresh,true);expect((await repo.saveSession(pack.studyPackId,old)).id).toBe(fresh.id);
    const submitted={...fresh,draft:{itemId:'a',answer:'wrong first answer',submitted:true}};await repo.saveSession(pack.studyPackId,submitted);
    expect(await repo.saveSession(pack.studyPackId,{...fresh,draft:{itemId:'a',answer:'edited after reveal',submitted:false}})).toEqual(submitted);
  });
  it('adopts farther progress written by an older client after section migration, never an earlier cursor',async()=>{
    const {plugin}=memoryRemNote(),repo=new StudyPackRepository(plugin.storage),pack=fixture(),initial=session(pack);await repo.saveSession(pack.studyPackId,{...initial,index:1});
    await plugin.storage.setSynced(repo.key(pack.studyPackId,'session'),{...initial,index:2,section:undefined});expect((await repo.sessions(pack))[3].index).toBe(2);
    await plugin.storage.setSynced(repo.key(pack.studyPackId,'session'),initial);expect((await repo.sessions(pack))[3].index).toBe(2);
  });
  it('does not save an untouched popup on close and still flushes an unsaved draft',async()=>{
    const {plugin}=memoryRemNote(),repo=new StudyPackRepository(plugin.storage),pack=fixture();await repo.install(pack);await repo.saveSession(pack.studyPackId,session(pack));
    const save=vi.spyOn(StudyPackRepository.prototype,'saveSession'),view=render(<StudyPacks storage={plugin.storage}/>);await screen.findByRole('button',{name:'Resume (1/3)'});view.unmount();expect(save).not.toHaveBeenCalled();
    const dirty=render(<StudyPacks storage={plugin.storage}/>);fireEvent.click(await screen.findByRole('button',{name:'Resume (1/3)'}));fireEvent.change(await screen.findByLabelText('Your answer'),{target:{value:'unsaved draft'}});dirty.unmount();
    await waitFor(async()=>expect((await repo.session(pack.studyPackId))?.draft?.answer).toBe('unsaved draft'));save.mockRestore();
  });
  it('closing a stale second popup cannot bring a missed question back through Resume',async()=>{
    const {plugin}=memoryRemNote(),repo=new StudyPackRepository(plugin.storage),pack=fixture();await repo.install(pack);await repo.saveSession(pack.studyPackId,session(pack));
    const active=render(<StudyPacks storage={plugin.storage}/>),a=within(active.container);await a.findByRole('button',{name:'Resume (1/3)'});
    const stale=render(<StudyPacks storage={plugin.storage}/>);await within(stale.container).findByRole('button',{name:'Resume (1/3)'});
    fireEvent.click(a.getByRole('button',{name:'Resume (1/3)'}));fireEvent.change(await a.findByLabelText('Your answer'),{target:{value:'wrong'}});fireEvent.click(a.getByRole('button',{name:'Submit and reveal'}));fireEvent.click(await a.findByRole('button',{name:'Save result and next'}));await a.findByRole('heading',{name:'Recall b'});
    stale.unmount();active.unmount();render(<StudyPacks storage={plugin.storage}/>);fireEvent.click(await screen.findByRole('button',{name:'Resume (2/3)'}));expect(await screen.findByRole('heading',{name:'Recall b'})).toBeTruthy();expect((await repo.item(pack.studyPackId,'a')).attempts).toBe(1);
  });
});
