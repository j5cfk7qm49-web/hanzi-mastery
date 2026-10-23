import { expect, test } from '@playwright/test';
import { openSdkWidget } from './sdk-host';
import { drawCharacter } from './draw-character';

test.setTimeout(20000);

test('compiled index registers both review widgets without a secure context', async ({ page }) => {
  const host = await openSdkWidget(page, 'index');
  expect(host.capabilities).toEqual({ secure: false, randomUUID: 'undefined', getRandomValues: 'function' });
  await expect.poll(() => host.calls.filter(call => call.methodName === 'registerCommand').length).toBe(2);
  expect(host.calls.filter(call => call.methodName === 'registerWidget').map(call => call.args.fileName))
    .toEqual(['hanzi_review', 'workbench', 'recall_review']);
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

test('compiled dictionary import previews authoritative readings, creates both directions, and edits cards without duplication', async ({ page }) => {
  test.setTimeout(45000);
  await page.route('https://www.moedict.tw/uni/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    title: '學習', heteronyms: [{ pinyin: 'xué xí', bopomofo: 'ㄒㄩㄝˊ ㄒㄧˊ', definitions: [{ def: '學習知識。' }] }],
  }), headers: { 'Access-Control-Allow-Origin': '*' } }));
  const host = await openSdkWidget(page, 'workbench', { focusedVocabulary: false });
  const lookup = async () => {
    await host.frame.getByLabel('Words to look up').fill('學習');
    await host.frame.getByLabel('Review before importing').check();
    await host.frame.getByRole('button', { name: 'Look up words' }).click();
    await expect(host.frame.getByLabel('Study meanings for 學習')).toHaveValue(/to study/);
  };
  await lookup();
  const originalHeight = await page.locator('#sdk-widget').evaluate(element => {
    const frame = element as HTMLIFrameElement, old = frame.style.height; frame.style.height = '1800px'; return old;
  });
  await host.frame.getByRole('region', { name: 'Dictionary import' }).screenshot({ path: test.info().outputPath('dictionary-import.png') });
  await page.locator('#sdk-widget').evaluate((element, height) => { (element as HTMLIFrameElement).style.height = height; }, originalHeight);
  expect(host.calls.filter(call => call.methodName === 'rem.createRem')).toHaveLength(0);
  await host.frame.getByLabel('Study meanings for 學習').fill('study');
  await host.frame.getByRole('button', { name: 'Import selected entries and translation cards' }).click();
  await expect(host.frame.getByRole('button', { name: 'Edit imported 學習' })).toBeVisible();
  expect(host.calls.filter(call => call.methodName === 'rem.createRem')).toHaveLength(2);
  const metadata = () => host.calls.filter(call => call.methodName === 'rem.setPowerupProperty').map(call => JSON.parse((call.args.value as string[])[0]));
  expect(metadata().filter(value => value.skill).map(value => value.skill)).toEqual(['english-to-chinese']);
  await host.frame.getByRole('button', { name: 'Edit imported 學習' }).click();
  await host.frame.getByLabel('Edit study meanings').fill('learn something new');
  await host.frame.getByRole('button', { name: 'Save vocabulary and update study cards' }).click();
  await expect(host.frame.getByText('Vocabulary and linked study cards saved and read back.')).toBeVisible();
  await host.frame.getByRole('region', { name: 'Edit vocabulary', exact: true }).screenshot({ path: test.info().outputPath('vocabulary-editor.png') });
  const updated = metadata().filter(value => value.skill).slice(-1);
  expect(updated.every(value => value.meaning === 'learn something new')).toBe(true);
  expect(metadata().filter(value => value.version === 2).at(-1).dictionary.moe.definitions).toEqual(['學習知識。']);
  expect(host.calls.filter(call => call.methodName === 'rem.setPracticeDirection')).toHaveLength(2);
  await host.frame.getByRole('button', { name: 'New vocabulary / dictionary import' }).click();
  await lookup();
  await host.frame.getByRole('button', { name: 'Import selected entries and translation cards' }).click();
  await expect(host.frame.getByRole('button', { name: 'Edit imported 學習' })).toBeVisible();
  expect(host.calls.filter(call => call.methodName === 'rem.createRem')).toHaveLength(2);
  expect(host.errors).toEqual([]);
});
test('compiled workbench uses native list bullets and moves vocabulary with its linked cards', async ({page})=>{
  test.setTimeout(45000);
  await page.route('https://www.moedict.tw/uni/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({
    title:'學習',heteronyms:[{pinyin:'xué xí',definitions:[{def:'學習知識。'}]}],
  }),headers:{'Access-Control-Allow-Origin':'*'}}));
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
  await expect(host.frame.getByRole('button',{name:'Edit imported 學習'})).toBeVisible();
  const ids=host.calls.filter(c=>c.methodName==='rem.setPowerupProperty').map(c=>String(c.args.remId));
  expect(new Set(ids).size).toBe(2);
  const parentOf=(id:string)=>host.calls.filter(c=>c.methodName==='rem.setParent'&&c.args.remId===id).at(-1)?.args.parentId;
  expect(parentOf(ids[0])).toBe(first); expect(ids.slice(1).every(id=>parentOf(id)===ids[0])).toBe(true);
  await host.frame.getByRole('button',{name:'Edit imported 學習'}).click();
  const second=await createList('Lesson 2');
  const directions=host.calls.filter(c=>c.methodName==='rem.setPracticeDirection').length;
  await host.frame.getByRole('button',{name:'Move vocabulary and cards to selected list'}).click();
  await expect(host.frame.getByText('Vocabulary and linked cards moved and confirmed. Native review history is retained.')).toBeVisible();
  expect(parentOf(ids[0])).toBe(second); expect(ids.slice(1).every(id=>parentOf(id)===ids[0])).toBe(true);
  expect(host.calls.filter(c=>c.methodName==='rem.setPracticeDirection')).toHaveLength(directions);
  const vocabId=ids[0];
  await page.evaluate(id=>(window as unknown as {changeNativeRem(id:string,parent:string,text?:string):void}).changeNativeRem(id,'fixture-external'),vocabId);
  await host.frame.getByRole('button',{name:'Refresh lists from RemNote'}).click();
  await expect(selector).toHaveValue('fixture-external');
  await host.frame.getByRole('button',{name:'Study cards',exact:true}).click();
  await host.frame.getByRole('button',{name:'Create tone recall card'}).click();
  await expect(host.frame.getByRole('button',{name:'Open last study card'})).toBeVisible();
  const tone=host.calls.filter(c=>c.methodName==='rem.setPowerupProperty').at(-1)!;
  expect(JSON.parse((tone.args.value as string[])[0]).skill).toBe('tones');
  expect(parentOf(String(tone.args.remId))).toBe(vocabId);
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
