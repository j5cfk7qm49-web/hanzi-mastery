import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RNPlugin } from '@remnote/plugin-sdk';
import type { DictionaryCandidate } from '../src/services/dictionary';
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), save: vi.fn(), update: vi.fn(), prepare:vi.fn() }));
vi.mock('../src/services/dictionary', async original => ({ ...await original<typeof import('../src/services/dictionary')>(), lookupDictionary: mocks.lookup }));
vi.mock('../src/services/vocabulary', () => ({ importDictionaryCandidate: mocks.save, updateVocabulary: mocks.update, prepareDictionaryImport:mocks.prepare }));
vi.mock('../src/services/lists', () => ({ sortVocabularyList:async()=>{} }));
import { DictionaryImport } from '../src/ui/DictionaryImport';
import { VocabularyEditor } from '../src/ui/VocabularyEditor';
const candidate: DictionaryCandidate = { traditional: '行', pinyin: 'xíng', meanings: ['to walk'], dictionary: {
  importedAt: '2026-10-21', moe: { provider: 'MOE Revised via Moedict', url: 'https://www.moedict.tw/uni/行', pinyin: 'xíng', bopomofo: 'ㄒㄧㄥˊ',
    definitions: ['行走。'], license: 'CC BY-ND 3.0 TW', edition: 'Test fixture' },
} };
const plugin = { rootURL: 'https://plugin.example/' } as RNPlugin;
beforeEach(() => {
  mocks.lookup.mockReset().mockResolvedValue([{ word: '行', candidates: [candidate, { ...candidate, pinyin: 'háng', meanings: ['row'] }] }]);
  mocks.save.mockReset().mockResolvedValue({ id: 'v' }); mocks.update.mockReset();
  mocks.prepare.mockReset().mockImplementation(async (_plugin, parentId) => ({parentId:parentId || 'collection',entries:new Map()}));
});
it('allows an optional reading choice for a polyphone and creates nothing during preview', async () => {
  const onOpen = vi.fn(async () => {});
  render(<DictionaryImport plugin={plugin} onOpen={onOpen} />);
  fireEvent.change(screen.getByLabelText('Words to look up'), { target: { value: '行' } });
  fireEvent.click(screen.getByLabelText('Review before importing'));
  fireEvent.click(screen.getByRole('button', { name: 'Look up words' }));
  const reading = await screen.findByLabelText('Reading for 行');
  const commit = screen.getByRole('button', { name: 'Import selected entries and translation cards' });
  expect((commit as HTMLButtonElement).disabled).toBe(true); expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.change(reading, { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Study meanings for 行'), { target: { value: 'row; line' } });
  fireEvent.click(commit);
  await screen.findByRole('button', { name: 'Edit imported 行' });
  expect(mocks.save).toHaveBeenCalledWith(plugin, expect.objectContaining({ pinyin: 'háng', meanings: ['row', 'line'] }), expect.objectContaining({parentId:'collection'}));
  fireEvent.click(screen.getByRole('button', { name: 'Edit imported 行' }));
  expect(onOpen).toHaveBeenCalledWith('v');
});
it('preserves edited preview data after a failed import and retries the selected row', async () => {
  mocks.save.mockRejectedValueOnce(new Error('Retry this entry.'));
  mocks.lookup.mockResolvedValueOnce([{ word: '行', candidates: [candidate] }]);
  render(<DictionaryImport plugin={plugin} onOpen={async () => {}} />);
  fireEvent.change(screen.getByLabelText('Words to look up'), { target: { value: '行' } });
  fireEvent.click(screen.getByLabelText('Review before importing'));
  fireEvent.click(screen.getByRole('button', { name: 'Look up words' }));
  await screen.findByLabelText('Study meanings for 行');
  fireEvent.change(screen.getByLabelText('Study meanings for 行'), { target: { value: 'walk' } });
  fireEvent.click(screen.getByRole('button', { name: 'Import selected entries and translation cards' }));
  await screen.findByText('Retry this entry.');
  expect((screen.getByLabelText('Study meanings for 行') as HTMLTextAreaElement).value).toBe('walk');
  fireEvent.click(screen.getByRole('button', { name: 'Import selected entries and translation cards' }));
  await screen.findByRole('button', { name: 'Edit imported 行' });
  expect(mocks.save).toHaveBeenCalledTimes(2);
});
it('keeps source definitions visible separately and preserves editor changes across save failure', async () => {
  const initial = { version: 2 as const, traditional: '行', pinyin: 'xíng', meanings: ['to walk'], source: 'Dictionary', categories: [], dictionary: candidate.dictionary };
  const onSaved = vi.fn();
  mocks.update.mockRejectedValueOnce(new Error('Some study cards need a retry.')).mockImplementation(async (_plugin, _id, draft) => draft);
  render(<VocabularyEditor plugin={plugin} id="v" initial={initial} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText('Edit study meanings'), { target: { value: 'go on foot' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save vocabulary and update study cards' }));
  await screen.findByText('Some study cards need a retry.'); expect(onSaved).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Edit study meanings') as HTMLTextAreaElement).value).toBe('go on foot');
  expect(screen.getByText('行走。')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Save vocabulary and update study cards' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ meanings: ['go on foot'], dictionary: initial.dictionary })));
});
it('paginates previews above 50 words while importing selections from every page into the chosen bullet', async () => {
  const words=Array.from({length:61},(_,i)=>String.fromCodePoint(0x4e00+i));
  mocks.lookup.mockResolvedValueOnce(words.map(word=>({word,candidates:[{...candidate,traditional:word}]})));
  render(<DictionaryImport plugin={plugin} parentId="lesson" onOpen={async()=>{}} />);
  fireEvent.change(screen.getByLabelText('Words to look up'),{target:{value:words.join('\n')}});
  fireEvent.click(screen.getByLabelText('Review before importing'));
  fireEvent.click(screen.getByRole('button',{name:'Look up words'}));
  await screen.findByText('Showing 1–25 of 61 words');
  expect(screen.getAllByRole('article')).toHaveLength(25);
  fireEvent.click(screen.getByRole('button',{name:'Next preview page'}));
  expect(screen.getByText('Showing 26–50 of 61 words')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Import selected entries and translation cards'}));
  await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(61));
  expect(mocks.save.mock.calls.every(call=>call[2].parentId==='lesson')).toBe(true);
  await screen.findByText(/61 entries imported or reused/);
});
it('keeps completed lookup edits and stops an import after the current entry, then resumes pending entries', async () => {
  let releaseLookup!:()=>void;
  mocks.lookup.mockImplementationOnce(async (_words,_root,options)=>{
    options.onResult({word:'行',candidates:[candidate]},1,2);
    await new Promise<void>(resolve=>{releaseLookup=resolve;options.signal.addEventListener('abort',resolve,{once:true});});
    return [{word:'行',candidates:[candidate]}];
  }).mockResolvedValueOnce([{word:'學',candidates:[{...candidate,traditional:'學'}]}]);
  const view=render(<DictionaryImport plugin={plugin} parentId="lesson" onOpen={async()=>{}} />);
  fireEvent.change(screen.getByLabelText('Words to look up'),{target:{value:'行 學'}});
  fireEvent.click(screen.getByLabelText('Review before importing'));
  fireEvent.click(screen.getByRole('button',{name:'Look up words'}));
  await screen.findByLabelText('Study meanings for 行');
  // The workbench locks other actions while the importer must retain its stop control.
  view.rerender(<DictionaryImport plugin={plugin} parentId="lesson" disabled onOpen={async()=>{}} />);
  expect((screen.getByRole('button',{name:'Stop lookup'}) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Stop lookup'}));
  await screen.findByText(/Lookup stopped after 1 of 2/);
  view.rerender(<DictionaryImport plugin={plugin} parentId="lesson" onOpen={async()=>{}} />);
  fireEvent.change(screen.getByLabelText('Study meanings for 行'),{target:{value:'go on foot'}});
  fireEvent.click(screen.getByRole('button',{name:'Look up words'}));
  await screen.findByLabelText('Study meanings for 學');
  expect(mocks.lookup.mock.calls[1][0]).toEqual(['學']);
  expect((screen.getByLabelText('Study meanings for 行') as HTMLTextAreaElement).value).toBe('go on foot');
  let releaseImport!:(value:{id:string})=>void;
  mocks.save.mockImplementationOnce(()=>new Promise(resolve=>{releaseImport=resolve;}));
  fireEvent.click(screen.getByRole('button',{name:'Import selected entries and translation cards'}));
  await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button',{name:'Stop import after current entry'}));
  releaseImport({id:'first'});
  await screen.findByText(/Import stopped/); expect(mocks.save).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Import selected entries and translation cards'}));
  await screen.findByRole('button',{name:'Edit imported 學'});
  expect(mocks.save).toHaveBeenCalledTimes(2); expect(mocks.save.mock.calls[1][1].traditional).toBe('學');
  releaseLookup();
});

it('automatically imports a polyphone using the first reading with English and skips missing meanings', async () => {
  mocks.lookup.mockResolvedValueOnce([
    {word:'行',candidates:[{...candidate,pinyin:'háng',meanings:[]},candidate]},
    {word:'學',candidates:[{...candidate,traditional:'學',meanings:[]}]},
  ]);
  render(<DictionaryImport plugin={plugin} onOpen={async()=>{}} />);
  fireEvent.change(screen.getByLabelText('Words to look up'),{target:{value:'行 學'}});
  fireEvent.click(screen.getByRole('button',{name:'Import words'}));
  await screen.findByRole('button',{name:'Edit imported 行'});
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.save.mock.calls[0][1]).toMatchObject({traditional:'行',pinyin:'xíng',meanings:['to walk']});
  expect(await screen.findByText(/1 skipped/)).toBeTruthy();
});
