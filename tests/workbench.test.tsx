import React from 'react';
import { beforeEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_SETTINGS } from '../src/core/config';
const mocks = vi.hoisted(() => ({ load:vi.fn(), create:vi.fn(), get:vi.fn(), set:vi.fn(),
  plugin:undefined as unknown }));
vi.mock('@remnote/plugin-sdk', () => ({ usePlugin:()=>mocks.plugin, renderWidget:()=>{}, WidgetLocation:{Popup:'popup'} }));
vi.mock('../src/services/remnote', () => ({ ensureCollection:async()=> 'collection', createWritingCard:mocks.create }));
vi.mock('../src/services/lists', () => ({ resolveListParent:async()=> 'collection', vocabularyParent:async()=> 'collection',
  sortVocabularyList:async()=>{},
  readVocabularyLists:async()=>[{id:'collection',name:'Hanzi Mastery (default)'}] }));
vi.mock('../src/services/characters', () => ({ loadCharacter:mocks.load }));
vi.mock('../src/ui/WriterCanvas', () => ({ WriterCanvas:()=>null }));
import { Workbench } from '../src/widgets/workbench';
beforeEach(()=>{
  mocks.get.mockReset().mockResolvedValue(undefined);mocks.set.mockReset();mocks.load.mockReset().mockResolvedValue({});
  mocks.create.mockReset().mockResolvedValue('card');
  mocks.plugin={storage:{getSynced:mocks.get,setSynced:mocks.set},
    widget:{getWidgetContext:async()=>({}),closePopup:async()=>{}},
    rem:{findOne:async(id?:string)=>id?{setParent:async()=>{},setText:async()=>{},addPowerup:async()=>{},setPowerupProperty:async()=>{}}:undefined,
      createRem:async()=>({_id:'vocabulary'})}};
});
it('locks authoring fields while async validation is pending so the saved prompt matches the form',async()=>{
  const user=userEvent.setup();render(<Workbench/>);
  await waitFor(()=>expect((screen.getByRole('button',{name:'Manual entry'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Manual entry'}));
  const target=screen.getByLabelText('Traditional characters');const meaning=screen.getByLabelText('English meaning / writing prompt');
  await waitFor(()=>expect(target.closest('fieldset')!.disabled).toBe(false));
  fireEvent.change(target,{target:{value:'國'}});fireEvent.change(meaning,{target:{value:'country'}});
  let release!:()=>void;mocks.load.mockReturnValueOnce(new Promise<void>(resolve=>{release=resolve;}));
  fireEvent.click(screen.getByRole('button',{name:'Create linked writing card'}));
  expect(target.closest('fieldset')!.disabled).toBe(true);
  await user.type(meaning,' changed');expect((meaning as HTMLInputElement).value).toBe('country');
  release();await screen.findByRole('button',{name:'Open created writing card'});
  expect(mocks.create.mock.calls[0][1]).toMatchObject({traditional:'國',prompt:'country'});
});
it('does not claim settings were saved when read-back returns a different configuration',async()=>{
  render(<Workbench/>);await waitFor(()=>expect((screen.getByRole('button',{name:'Settings'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  fireEvent.change(screen.getByLabelText('Settings JSON'),{target:{value:JSON.stringify({...DEFAULT_SETTINGS,canvasSize:240})}});
  fireEvent.click(screen.getByRole('button',{name:'Save settings'}));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Settings save was not confirmed'));
  expect(screen.queryByText('Settings saved and read back.')).toBeNull();
});
it('can save a vocabulary entry for other skills without creating a writing card or requiring stroke data',async()=>{
  render(<Workbench/>);
  await waitFor(()=>expect((screen.getByRole('button',{name:'Manual entry'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Manual entry'}));
  const target=screen.getByLabelText('Traditional characters');
  await waitFor(()=>expect(target.closest('fieldset')!.disabled).toBe(false));
  fireEvent.change(target,{target:{value:'人'}});
  fireEvent.change(screen.getByLabelText('English meaning / writing prompt'),{target:{value:'person'}});
  fireEvent.change(screen.getByLabelText('Pinyin (optional; included in writing prompt)'),{target:{value:'rén'}});
  fireEvent.click(screen.getByRole('button',{name:'Save vocabulary for other skills'}));
  await screen.findByRole('region',{name:'Other study skills'});
  expect(mocks.load).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();
});
