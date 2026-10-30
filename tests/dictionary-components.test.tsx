import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RNPlugin } from '@remnote/plugin-sdk';
import type { DictionaryCandidate } from '../src/services/dictionary';
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), save: vi.fn(), update: vi.fn(), prepare:vi.fn(), recording:vi.fn() }));
vi.mock('../src/services/dictionary', async original => ({ ...await original<typeof import('../src/services/dictionary')>(), lookupDictionary: mocks.lookup }));
vi.mock('../src/services/vocabulary', () => ({ importDictionaryCandidate: mocks.save, updateVocabulary: mocks.update, prepareDictionaryImport:mocks.prepare }));
vi.mock('../src/services/lists', () => ({ sortVocabularyList:async()=>{} }));
vi.mock('../src/services/recordings', () => ({findRecording:mocks.recording}));
import { DictionaryImport } from '../src/ui/DictionaryImport';
import { VocabularyEditor } from '../src/ui/VocabularyEditor';
const candidate: DictionaryCandidate = { traditional: '行', pinyin: 'xíng', meanings: ['to walk'], dictionary: {
  importedAt: '2026-10-21', moe: { provider: 'MOE Revised via Moedict', url: 'https://www.moedict.tw/uni/行', pinyin: 'xíng', bopomofo: 'ㄒㄧㄥˊ',
    definitions: ['行走。'], license: 'CC BY-ND 3.0 TW', edition: 'Test fixture' },
} };
const draftValues = new Map<string, unknown>();
const plugin = { rootURL: 'https://plugin.example/', storage: {
  getSynced: async (key: string) => structuredClone(draftValues.get(key)),
  setSynced: async (key: string, value: unknown) => { draftValues.set(key, structuredClone(value)); },
} } as unknown as RNPlugin;
beforeEach(() => {
  draftValues.clear();
  mocks.lookup.mockReset().mockResolvedValue([{ word: '行', candidates: [candidate, { ...candidate, pinyin: 'háng', meanings: ['row'] }] }]);
  mocks.save.mockReset().mockResolvedValue({ id: 'v' }); mocks.update.mockReset();
  mocks.recording.mockReset();
  mocks.prepare.mockReset().mockImplementation(async (_plugin, parentId) => ({parentId:parentId || 'collection',entries:new Map()}));
});
it('lets an existing word find a credited recording and saves it only with the shared card update', async () => {
  const initial={version:2 as const,traditional:'耳',pinyin:'ěr',meanings:['ear'],source:'Manual',categories:[]};
  const source={provider:'MOE Concise',traditional:'耳',pinyin:'ěr',recordedForm:'耳',
    url:'https://dict.concised.moe.edu.tw/sound/word/5829.mp3',sourceUrl:'https://dict.concised.moe.edu.tw/search.jsp?word=%E8%80%B3',
    author:'Ministry of Education, R.O.C.',license:'CC BY-ND 3.0 TW',licenseUrl:'https://creativecommons.org/licenses/by-nd/3.0/tw/'};
  mocks.recording.mockResolvedValue(source);
  mocks.update.mockImplementation(async(_plugin,_id,draft)=>draft);
  render(<VocabularyEditor plugin={plugin} id="v" initial={initial} onSaved={vi.fn()} />);
  await waitFor(()=>expect((screen.getByLabelText('Edit pinyin') as HTMLInputElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Find matching recording'}));
  await screen.findByText('Recording found. Save changes to update linked cards.');
  expect(screen.getByLabelText('Shared reference audio URL')).toHaveProperty('value',source.url);
  expect(screen.getByRole('link',{name:'CC BY-ND 3.0 TW'})).toBeTruthy();
  expect(mocks.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Save vocabulary and update study cards'}));
  await waitFor(()=>expect(mocks.update).toHaveBeenCalledWith(plugin,'v',expect.objectContaining({audio:[source.url],audioSource:source}),{}));
});
it('allows an optional reading choice for a polyphone and creates nothing during preview', async () => {
  const onOpen = vi.fn(async () => {});
  render(<DictionaryImport plugin={plugin} onOpen={onOpen} />);
  await waitFor(() => expect((screen.getByLabelText('Words to look up') as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Words to look up'), { target: { value: '行' } });
  fireEvent.click(screen.getByLabelText('Review before importing'));
  fireEvent.click(screen.getByRole('button', { name: 'Look up words' }));
  const reading = await screen.findByLabelText('Reading for 行');
  const commit = screen.getByRole('button', { name: 'Import selected words' });
  expect((commit as HTMLButtonElement).disabled).toBe(true); expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.change(reading, { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Study meanings for 行'), { target: { value: 'row; line' } });
  fireEvent.click(commit);
  await screen.findByRole('button', { name: 'Edit imported 行' });
  expect(mocks.save).toHaveBeenCalledWith(plugin, expect.objectContaining({ pinyin: 'háng', meanings: ['row', 'line'] }), expect.objectContaining({parentId:'collection'}));
  fireEvent.click(screen.getByRole('button', { name: 'Edit imported 行' }));
  await waitFor(() => expect(onOpen).toHaveBeenCalledWith('v'));
});
it('restores an English-only import draft and generates current-word links in the editor', async () => {
  const englishOnly = { ...candidate, dictionary: { importedAt:'2026-10-23', english: {
    provider:'CC-CEDICT' as const, url:'https://www.mdbg.net/chinese/dictionary?wdqb=%E8%A1%8C', snapshot:'Fixture',
    pinyin:'xing2',definitions:['to walk'],license:'CC BY-SA 4.0' as const,
  } } };
  draftValues.set('hm:v6:import-draft:lesson',{version:1,text:'行',rows:[{word:'行',candidates:[englishOnly],selected:0,included:true,meaning:'walk'}],review:true,skills:[],showInput:true,page:0});
  const view=render(<DictionaryImport plugin={plugin} parentId="lesson" onOpen={async()=>{}} />);
  expect(await screen.findByLabelText('Study meanings for 行')).toHaveProperty('value','walk');
  expect((screen.getByLabelText('Link matching word recordings') as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole('link',{name:'CC-CEDICT: 行'}).getAttribute('href')).toContain('wdqb=%E8%A1%8C');
  view.unmount();
  render(<VocabularyEditor plugin={plugin} id="v" initial={{version:2,traditional:'行',pinyin:'xíng',meanings:['walk'],source:'CC-CEDICT',categories:[],dictionary:englishOnly.dictionary}} onSaved={vi.fn()} />);
  await waitFor(()=>expect((screen.getByLabelText('Edit Traditional characters') as HTMLInputElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Edit Traditional characters'),{target:{value:'學'}});
  expect(screen.getByRole('link',{name:'CC-CEDICT: 學'}).getAttribute('href')).toContain('wdqb=%E5%AD%B8');
});
it('preserves edited preview data after a failed import and retries the selected row', async () => {
  mocks.save.mockRejectedValueOnce(new Error('Retry this entry.'));
  mocks.lookup.mockResolvedValueOnce([{ word: '行', candidates: [candidate] }]);
  render(<DictionaryImport plugin={plugin} onOpen={async () => {}} />);
  await waitFor(() => expect((screen.getByLabelText('Words to look up') as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Words to look up'), { target: { value: '行' } });
  fireEvent.click(screen.getByLabelText('Review before importing'));
  fireEvent.click(screen.getByRole('button', { name: 'Look up words' }));
  await screen.findByLabelText('Study meanings for 行');
  fireEvent.change(screen.getByLabelText('Study meanings for 行'), { target: { value: 'walk' } });
  fireEvent.click(screen.getByRole('button', { name: 'Import selected words' }));
  await screen.findByText('Retry this entry.');
  expect((screen.getByLabelText('Study meanings for 行') as HTMLTextAreaElement).value).toBe('walk');
  fireEvent.click(screen.getByRole('button', { name: 'Import selected words' }));
  await screen.findByRole('button', { name: 'Edit imported 行' });
  expect(mocks.save).toHaveBeenCalledTimes(2);
});
it('keeps source definitions visible separately and preserves editor changes across save failure', async () => {
  const initial = { version: 2 as const, traditional: '行', pinyin: 'xíng', meanings: ['to walk'], source: 'Dictionary', categories: [], dictionary: candidate.dictionary };
  const onSaved = vi.fn();
  mocks.update.mockRejectedValueOnce(new Error('Some study cards need a retry.')).mockImplementation(async (_plugin, _id, draft) => draft);
  render(<VocabularyEditor plugin={plugin} id="v" initial={initial} onSaved={onSaved} />);
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save vocabulary and update study cards' }) as HTMLButtonElement).closest('fieldset')?.disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Edit study meanings'), { target: { value: 'go on foot' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save vocabulary and update study cards' }));
  await screen.findByText('Some study cards need a retry.'); expect(onSaved).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Edit study meanings') as HTMLTextAreaElement).value).toBe('go on foot');
  expect(screen.getByText('行走。')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Save vocabulary and update study cards' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ meanings: ['go on foot'], dictionary: initial.dictionary })));
});
it('restores an unfinished word update before enabling further edits', async () => {
  const initial = { version: 2 as const, traditional: '行', pinyin: 'xíng', meanings: ['to walk'], source: 'Manual', categories: [] };
  draftValues.set('hm:v6:edit-draft:v', { word: { ...initial, meanings: ['go on foot'] }, edits: { linked: { prompt: 'my cue', direction: 'none' } } });
  mocks.update.mockImplementation(async (_plugin, _id, draft) => draft);
  render(<VocabularyEditor plugin={plugin} id="v" initial={initial} onSaved={vi.fn()} />);
  await screen.findByText('Some card updates are unfinished. Save changes to finish.');
  expect((screen.getByLabelText('Edit study meanings') as HTMLTextAreaElement).value).toBe('go on foot');
  fireEvent.click(screen.getByRole('button', { name: 'Save vocabulary and update study cards' }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(plugin, 'v', expect.objectContaining({ meanings: ['go on foot'] }), { linked: { prompt: 'my cue', direction: 'none' } }));
});
it('keeps separate import drafts for lists including unsaved reading, wording and skill selections', async () => {
  const view = render(<DictionaryImport plugin={plugin} parentId="lesson-one" onOpen={async () => {}} />);
  await waitFor(() => expect((screen.getByLabelText('Words to look up') as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Words to look up'), { target: { value: '行' } });
  fireEvent.click(screen.getByLabelText('Review before importing'));
  fireEvent.click(screen.getByRole('button', { name: 'Look up words' }));
  fireEvent.change(await screen.findByLabelText('Reading for 行'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Study meanings for 行'), { target: { value: 'my row wording' } });
  fireEvent.click(screen.getByText('Study skills · 8 of 8 selected'));
  fireEvent.click(screen.getByRole('button', { name: 'Vocabulary only' }));
  view.rerender(<DictionaryImport plugin={plugin} parentId="lesson-two" onOpen={async () => {}} />);
  await waitFor(() => expect((screen.getByLabelText('Words to look up') as HTMLTextAreaElement).value).toBe(''));
  fireEvent.change(screen.getByLabelText('Words to look up'), { target: { value: '學習' } });
  view.rerender(<DictionaryImport plugin={plugin} parentId="lesson-one" onOpen={async () => {}} />);
  await waitFor(() => expect((screen.getByLabelText('Study meanings for 行') as HTMLTextAreaElement).value).toBe('my row wording'));
  expect((screen.getByLabelText('Reading for 行') as HTMLSelectElement).value).toBe('1');
  expect(screen.getByText('Study skills · 0 of 8 selected')).toBeTruthy();
  view.unmount();
  render(<DictionaryImport plugin={plugin} parentId="lesson-two" onOpen={async () => {}} />);
  await waitFor(() => expect((screen.getByLabelText('Words to look up') as HTMLTextAreaElement).value).toBe('學習'));
  expect(mocks.save).not.toHaveBeenCalled();
});
it('preserves a malformed saved preview without exposing stale rows for import', async () => {
  const malformed = { version: 1, text: '行', rows: [{ word: '行', candidates: [], selected: 5, included: true, meaning: 'row' }], review: true, skills: [], showInput: true, page: 0 };
  draftValues.set('hm:v6:import-draft:lesson', malformed);
  const view = render(<DictionaryImport plugin={plugin} parentId="lesson" onOpen={async () => {}} />);
  await screen.findByText(/Could not load the saved import draft/);
  expect((screen.getByLabelText('Words to look up') as HTMLTextAreaElement).disabled).toBe(true);
  view.unmount();
  expect(draftValues.get('hm:v6:import-draft:lesson')).toEqual(malformed);
  expect(mocks.save).not.toHaveBeenCalled();
});
it('paginates previews above 50 words while importing selections from every page into the chosen bullet', async () => {
  const words=Array.from({length:61},(_,i)=>String.fromCodePoint(0x4e00+i));
  mocks.lookup.mockResolvedValueOnce(words.map(word=>({word,candidates:[{...candidate,traditional:word}]})));
  render(<DictionaryImport plugin={plugin} parentId="lesson" onOpen={async()=>{}} />);
  await waitFor(() => expect((screen.getByLabelText('Words to look up') as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Words to look up'),{target:{value:words.join('\n')}});
  fireEvent.click(screen.getByLabelText('Review before importing'));
  fireEvent.click(screen.getByRole('button',{name:'Look up words'}));
  await screen.findByText('Showing 1–25 of 61 words');
  expect(screen.getAllByRole('article')).toHaveLength(25);
  fireEvent.click(screen.getByRole('button',{name:'Next preview page'}));
  expect(screen.getByText('Showing 26–50 of 61 words')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Import selected words'}));
  await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(61),{timeout:5000});
  expect(mocks.save.mock.calls.every(call=>call[2].parentId==='lesson')).toBe(true);
  await screen.findByText(/61 entries imported or reused/);
},15000);
it('keeps completed lookup edits and stops an import after the current entry, then resumes pending entries', async () => {
  let releaseLookup!:()=>void;
  mocks.lookup.mockImplementationOnce(async (_words,_root,options)=>{
    options.onResult({word:'行',candidates:[candidate]},1,2);
    await new Promise<void>(resolve=>{releaseLookup=resolve;options.signal.addEventListener('abort',resolve,{once:true});});
    return [{word:'行',candidates:[candidate]}];
  }).mockResolvedValueOnce([{word:'學',candidates:[{...candidate,traditional:'學'}]}]);
  const view=render(<DictionaryImport plugin={plugin} parentId="lesson" onOpen={async()=>{}} />);
  await waitFor(() => expect((screen.getByLabelText('Words to look up') as HTMLTextAreaElement).disabled).toBe(false));
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
  fireEvent.click(screen.getByRole('button',{name:'Import selected words'}));
  await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button',{name:'Stop import after current entry'}));
  releaseImport({id:'first'});
  await screen.findByText(/Import stopped/); expect(mocks.save).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Import selected words'}));
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
  await waitFor(() => expect((screen.getByLabelText('Words to look up') as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Words to look up'),{target:{value:'行 學'}});
  fireEvent.click(screen.getByRole('button',{name:'Import words'}));
  await screen.findByRole('button',{name:'Edit imported 行'});
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.save.mock.calls[0][1]).toMatchObject({traditional:'行',pinyin:'xíng',meanings:['to walk']});
  expect(await screen.findByText(/1 skipped/)).toBeTruthy();
});
