import { expect, test } from '@playwright/test';
import { openSdkWidget } from './sdk-host';
import { drawCharacter } from './draw-character';

test.setTimeout(20000);

test('compiled index registers both review widgets without a secure context', async ({ page }) => {
  const host = await openSdkWidget(page, 'index');
  expect(host.capabilities).toEqual({ secure: false, randomUUID: 'undefined', getRandomValues: 'function' });
  await expect.poll(() => host.calls.filter(call => call.methodName === 'registerCommand').length).toBe(3);
  expect(host.calls.filter(call => call.methodName === 'registerWidget').map(call => call.args.fileName))
    .toEqual(['hanzi_review', 'workbench', 'study_packs', 'recall_review']);
  expect(host.errors).toEqual([]);
});

test('compiled writing widget starts, opens the canvas and saves with randomUUID unavailable', async ({ page }) => {
  const host = await openSdkWidget(page, 'hanzi_review');
  expect(host.capabilities.randomUUID).toBe('undefined');
  await host.frame.getByRole('button', { name: 'Begin test', exact: true }).click();
  await expect(host.frame.getByLabel('Chinese handwriting canvas')).toBeVisible();
  await host.frame.getByRole('button', { name: 'I forgot a stroke — end test' }).click();
  await expect(host.frame.getByLabel('Result saved')).toBeVisible();
  const saves = host.calls.filter(call => call.methodName === 'storage.setSynced');
  expect(saves.length).toBeGreaterThan(0);
  const history = (saves[0].args.value as { history: { id: string; result: { passed: boolean } }[] }).history;
  expect(history[0].id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}:人$/);
  expect(history[0].result.passed).toBe(false);
  await expect(page.getByRole('button', { name: 'Show Answer' })).toBeVisible();
  expect(host.errors).toEqual([]);
});

test('compiled study widget saves the first answer with randomUUID unavailable', async ({ page }) => {
  const host = await openSdkWidget(page, 'recall_review');
  expect(host.capabilities.randomUUID).toBe('undefined');
  await host.frame.getByRole('button', { name: 'Begin recall test' }).click();
  await host.frame.getByLabel('Your pinyin').fill('ren2');
  await host.frame.getByRole('button', { name: 'Check first answer' }).click();
  await expect(host.frame.getByLabel('Result saved')).toBeVisible();
  const saves = host.calls.filter(call => call.methodName === 'storage.setSynced');
  const history = (saves[0].args.value as { history: { id: string; result: { passed: boolean } }[] }).history;
  expect(history[0].id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  expect(history[0].result.passed).toBe(true);
  expect(host.errors).toEqual([]);
});

test('compiled workbench creates and reuses recognition cards while excluding dictionary-only homophones', async ({ page }) => {
  const host = await openSdkWidget(page, 'workbench');
  await host.frame.getByRole('button',{name:'Study cards',exact:true}).click();
  const create = host.frame.getByRole('button', { name: 'Create character recognition card' });
  await create.click();
  await expect(host.frame.getByRole('button', { name: 'Open last study card' })).toBeVisible();
  const writes = host.calls.filter(call => call.methodName === 'rem.setPowerupProperty');
  const schema = JSON.parse((writes[0].args.value as string[])[0]);
  expect(schema).toMatchObject({ version: 1, skill: 'character-choice', vocabularyId: 'fixture-vocab', traditional: '型', pinyin: 'xíng' });
  expect(schema.choices.map((choice: { traditional: string }) => choice.traditional).sort()).toEqual(['型', '書', '愛', '國'].sort());
  const fronts = JSON.stringify(host.calls.filter(call => call.methodName === 'rem.setText'));
  expect(fronts).toContain('Choose the characters for: xíng'); expect(fronts).not.toContain('型');
  await create.click();
  await expect(create).toBeEnabled();
  expect(host.calls.filter(call => call.methodName === 'rem.createRem')).toHaveLength(1);
  expect(host.errors).toEqual([]);
});

test('compiled CC-CEDICT import links matching recordings, creates both directions, and edits cards without duplication', async ({ page }) => {
  test.setTimeout(45000);
  const externalRequests: string[] = [];
  page.on('request', request => { if (/moedict|wiktionary|wikimedia|yojik/.test(request.url())) externalRequests.push(request.url()); });
  const host = await openSdkWidget(page, 'workbench', { focusedVocabulary: false });
  const lookup = async (expected: string | RegExp = /to study/) => {
    const more = host.frame.getByRole('button', { name: 'Import more words', exact: true });
    if (await more.isVisible()) {
      await more.click();
      await host.frame.getByText('Study skills · 8 of 8 selected', { exact: true }).click();
      await host.frame.getByRole('button', { name: 'All skills', exact: true }).click();
    }
    await host.frame.getByLabel('Words to look up').fill('學習');
    await host.frame.getByLabel('Review before importing').check();
    await host.frame.getByRole('button', { name: 'Look up words' }).click();
    await expect(host.frame.getByLabel('Study meanings for 學習')).toHaveValue(expected);
  };
  await lookup();
  const originalHeight = await page.locator('#sdk-widget').evaluate(element => {
    const frame = element as HTMLIFrameElement, old = frame.style.height; frame.style.height = '1800px'; return old;
  });
  await host.frame.getByRole('region', { name: 'Dictionary import' }).screenshot({ path: test.info().outputPath('dictionary-import.png') });
  await page.locator('#sdk-widget').evaluate((element, height) => { (element as HTMLIFrameElement).style.height = height; }, originalHeight);
  expect(host.calls.filter(call => call.methodName === 'rem.createRem')).toHaveLength(0);
  await host.frame.getByLabel('Study meanings for 學習').fill('study');
  await host.frame.getByRole('button', { name: 'Import selected words' }).click();
  await expect(host.frame.getByRole('button', { name: 'Edit imported 學習' })).toBeVisible({ timeout: 20000 });
  expect(host.calls.filter(call => call.methodName === 'rem.createRem')).toHaveLength(9); // Library, word, and seven Rems for eight study directions.
  const metadata = () => host.calls.filter(call => call.methodName === 'rem.setPowerupProperty').map(call => JSON.parse((call.args.value as string[])[0]));
  expect(metadata().filter(value => value.skill).map(value => value.skill)).toEqual(['writing', 'english-to-chinese', 'pinyin', 'tones', 'character-choice', 'listening', 'pronunciation']);
  await host.frame.getByRole('button', { name: 'Edit imported 學習' }).click();
  await host.frame.getByLabel('Edit study meanings').fill('learn something new');
  await host.frame.getByRole('button', { name: 'Save vocabulary and update study cards' }).click();
  await expect(host.frame.getByText('Vocabulary and linked study cards saved and read back.')).toBeVisible({ timeout: 20000 });
  await page.frames().find(child => child.url().startsWith('https://hanzi-plugin.test/'))!.evaluate(() => window.scrollTo(0, 0));
  await page.locator('#sdk-widget').screenshot({ path: test.info().outputPath('vocabulary-editor.png') });
  const updated = metadata().filter(value => value.skill).slice(-7);
  expect(updated.filter(value => value.skill !== 'writing').every(value => value.meaning === 'learn something new')).toBe(true);
  expect(updated.find(value => value.skill === 'writing').prompt).toBe('learn something new (xué xí)');
  const importedWord = metadata().filter(value => value.version === 2 && !value.skill).at(-1);
  expect(importedWord.dictionary.english.provider).toBe('CC-CEDICT');
  expect(importedWord.dictionary.moe).toBeUndefined();
  expect(importedWord.audioSource.provider).toBe('Shtooka');
  expect(importedWord.audioSource.pinyin).toBe('xué xí');
  expect(metadata().filter(value => value.skill === 'listening').at(-1).referenceAudio).toBe(importedWord.audio[0]);
  await expect(host.frame.getByRole('link', { name: 'CC-CEDICT: 學習' })).toHaveAttribute('href', /wdqb=%E5%AD%B8%E7%BF%92/);
  await expect(host.frame.getByRole('link', { name: 'CC BY-SA 3.0 US' })).toBeVisible();
  expect(externalRequests).toEqual([]); // Import resolves metadata locally; audio is fetched only on playback.
  const directions = host.calls.filter(call => call.methodName === 'rem.setPracticeDirection').length;
  expect(directions).toBe(14); // Each new card is paused until its metadata is confirmed, then activated.
  await host.frame.getByRole('button', { name: 'New vocabulary / dictionary import' }).click();
  await lookup('study');
  await host.frame.getByRole('button', { name: 'Import selected words' }).click();
  await expect(host.frame.getByRole('button', { name: 'Edit imported 學習' })).toBeVisible({ timeout: 20000 });
  expect(host.calls.filter(call => call.methodName === 'rem.createRem')).toHaveLength(9);
  expect(host.calls.filter(call => call.methodName === 'rem.setPracticeDirection')).toHaveLength(directions);
  await expect(host.frame.getByRole('article', { name: 'Import 學習', exact: true })).toContainText('learn something new');
  expect(host.errors).toEqual([]);
});
test('compiled workbench shares one vocabulary entry and its cards across native list memberships', async ({page})=>{
  test.setTimeout(45000);
  const host=await openSdkWidget(page,'workbench',{focusedRemId:'fixture-external'});
  const selector=host.frame.getByLabel('List bullet');
  await host.frame.getByText('Manage lists',{exact:true}).click();
  await expect(selector).toHaveValue('fixture-external');
  const createList=async(name:string)=>{
    await host.frame.getByLabel('New list name').fill(name);
    await host.frame.getByRole('button',{name:'Create list bullet'}).click();
    await expect(selector.locator('option:checked')).toHaveText(name);
    return selector.inputValue();
  };
  const first=await createList('Lesson 1');
  await host.frame.getByLabel('Words to look up').fill('學習');
  await host.frame.getByRole('button',{name:'Import words'}).click();
  await expect(host.frame.getByRole('button',{name:'Edit imported 學習'})).toBeVisible({ timeout: 20000 });
  const ids=[...new Set(host.calls.filter(c=>c.methodName==='rem.setPowerupProperty').map(c=>String(c.args.remId)))];
  expect(ids).toHaveLength(8);
  const parentOf=(id:string)=>host.calls.filter(c=>c.methodName==='rem.setParent'&&c.args.remId===id).at(-1)?.args.parentId;
  const library=parentOf(ids[0]);
  expect(library).not.toBe(first); expect(ids.slice(1).every(id=>parentOf(id)===ids[0])).toBe(true);
  expect(host.calls.some(c=>c.methodName==='rem.addTag'&&c.args.remId===ids[0]&&c.args.tagId===first)).toBe(true);
  await host.frame.getByRole('button',{name:'Edit imported 學習'}).click();
  const second=await createList('Lesson 2');
  const directions=host.calls.filter(c=>c.methodName==='rem.setPracticeDirection').length;
  await host.frame.getByRole('button',{name:'Add vocabulary to selected list'}).click();
  await expect(host.frame.getByText('Added to list. Cards and review history are shared.')).toBeVisible();
  expect(parentOf(ids[0])).toBe(library); expect(ids.slice(1).every(id=>parentOf(id)===ids[0])).toBe(true);
  expect(host.calls.some(c=>c.methodName==='rem.addTag'&&c.args.remId===ids[0]&&c.args.tagId===second)).toBe(true);
  expect(host.calls.filter(c=>c.methodName==='rem.setPracticeDirection')).toHaveLength(directions);
  const vocabId=ids[0];
  await page.evaluate(id=>(window as unknown as {changeNativeRem(id:string,parent:string,text?:string):void}).changeNativeRem(id,'fixture-external'),vocabId);
  await host.frame.getByRole('button',{name:'Refresh lists from RemNote'}).click();
  await expect(selector).toHaveValue('fixture-external');
  await host.frame.getByRole('button',{name:'Study cards',exact:true}).click();
  await host.frame.getByRole('button',{name:'Create tone recall card'}).click();
  await expect(host.frame.getByRole('button',{name:'Open last study card'})).toBeVisible();
  const tone=host.calls.filter(c=>c.methodName==='rem.setPowerupProperty').find(c=>JSON.parse((c.args.value as string[])[0]).skill==='tones')!;
  expect(parentOf(String(tone.args.remId))).toBe(vocabId);
  expect(host.calls.filter(c=>c.methodName==='rem.createRem')).toHaveLength(11); // Two lists plus the original library, word and cards.
  expect(host.calls.some(c=>c.methodName==='rem.addPowerup'&&[first,second].includes(String(c.args.remId)))).toBe(false);
  expect(host.errors).toEqual([]);
});

for(const direction of ['forward','backward'] as const) test(`compiled bidirectional translation supports native ${direction} review without revealing its answer`,async({page})=>{
  const host=await openSdkWidget(page,'recall_review',{translationDirection:direction});
  const prompt=direction==='forward'?'person':'人',answer=direction==='forward'?'人':'person';
  await expect(host.frame.getByRole('heading',{name:prompt,exact:true})).toBeVisible();
  expect(await host.frame.getByRole('region',{name:'Hanzi Mastery study review'}).innerText()).not.toContain(answer);
  if (direction === 'forward') {
    await host.frame.getByRole('button', { name: 'Begin test', exact: true }).click();
    const canvas = host.frame.getByLabel('Chinese handwriting canvas'); await expect(canvas).toHaveAttribute('aria-busy', 'false');
    await drawCharacter(canvas, '人');
  } else {
    await host.frame.getByRole('button',{name:'Begin recall test'}).click();
    await host.frame.getByLabel('Your meaning').fill(answer);
    await host.frame.getByRole('button',{name:'Compare first answer'}).click();
    await host.frame.getByRole('button',{name:'My answer is correct'}).click();
  }
  await expect(host.frame.getByLabel('Result saved')).toBeVisible();
  const key=host.calls.find(c=>c.methodName==='storage.setSynced' && String(c.args.key).startsWith('hm:v3:results:'))!.args.key;
  expect(key).toContain(direction==='forward'?':english-to-chinese:':':chinese-to-english:');
  expect(host.errors).toEqual([]);
});
