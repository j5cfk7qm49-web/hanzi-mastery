import { expect, test } from '@playwright/test';
import { openSdkWidget } from './sdk-host';
test.setTimeout(45000);

test('manual practice opens immediately and reopening a word reuses its writing card', async ({ page }) => {
  const host = await openSdkWidget(page, 'workbench', { focusedVocabulary: false });
  await host.frame.getByRole('button', { name: 'Manual entry', exact: true }).click();
  await host.frame.getByLabel('Traditional characters', { exact: true }).fill('學');
  await host.frame.getByLabel('English meaning / writing prompt').fill('study');
  await host.frame.getByRole('button', { name: 'Practice selected characters' }).click();
  await expect(host.frame.getByLabel('Chinese handwriting canvas')).toBeVisible();
  expect(host.calls.filter(call => call.methodName === 'rem.createRem')).toHaveLength(0);
  expect(host.errors).toEqual([]);
});

test('existing writing cards are reused after closing and reopening the editor', async ({ page }) => {
  const host = await openSdkWidget(page, 'workbench');
  const add = async () => {
    await host.frame.getByRole('button', { name: 'Study cards', exact: true }).click();
    await host.frame.getByRole('button', { name: 'Create linked writing card' }).click();
    await expect(host.frame.getByRole('button', { name: 'Open created writing card' })).toBeVisible();
  };
  await add();
  const frame = page.frames().find(child => child.url().startsWith('https://hanzi-plugin.test/'))!;
  await frame.goto(frame.url()); await add();
  expect(host.calls.filter(call => call.methodName === 'rem.createRem')).toHaveLength(1);
  expect(host.errors).toEqual([]);
});

test('import drafts survive editor navigation and popup reload while showing saved wording on reuse', async ({ page }) => {
  const host = await openSdkWidget(page, 'workbench', { focusedVocabulary: false });
  await host.frame.getByLabel('Words to look up').fill('學習');
  await host.frame.getByLabel('Review before importing').check();
  await host.frame.getByRole('button', { name: 'Look up words', exact: true }).click();
  await host.frame.getByLabel('Study meanings for 學習').fill('my study wording');
  await host.frame.getByRole('button', { name: 'Import selected words' }).click();
  await host.frame.getByRole('button', { name: 'Edit imported 學習' }).click();
  await host.frame.getByLabel('Edit study meanings').fill('saved wording');
  await host.frame.getByRole('button', { name: 'Save vocabulary and update study cards' }).click();
  await expect(host.frame.getByText('Vocabulary and linked study cards saved and read back.')).toBeVisible({ timeout: 20000 });
  await host.frame.getByRole('button', { name: 'Back to import' }).click();
  await expect(host.frame.getByRole('button', { name: 'Edit imported 學習' })).toBeVisible({ timeout: 20000 });
  const frame = page.frames().find(child => child.url().startsWith('https://hanzi-plugin.test/'))!;
  await frame.goto(frame.url());
  await expect(host.frame.getByRole('button', { name: 'Edit imported 學習' })).toBeVisible({ timeout: 20000 });
  const creates = host.calls.filter(call => call.methodName === 'rem.createRem').length;
  await host.frame.getByText('Study skills · 8 of 8 selected', { exact: true }).click();
  await host.frame.getByRole('button', { name: 'Vocabulary only', exact: true }).click();
  await host.frame.getByRole('button', { name: 'Resume import' }).click();
  await expect(host.frame.getByRole('article', { name: 'Import 學習', exact: true })).toContainText('saved wording');
  await expect(host.frame.getByRole('article', { name: 'Import 學習', exact: true })).toContainText('Reused');
  expect(host.calls.filter(call => call.methodName === 'rem.createRem')).toHaveLength(creates);
  expect(host.errors).toEqual([]);
});

test('one save updates writing and recall previews while preserving a custom prompt and paused card', async ({ page }) => {
  const host = await openSdkWidget(page, 'workbench');
  await host.frame.getByRole('button', { name: 'Study cards', exact: true }).click();
  await host.frame.getByRole('button', { name: 'Create linked writing card' }).click();
  await expect(host.frame.getByRole('button', { name: 'Open created writing card' })).toBeVisible();
  await host.frame.getByRole('button', { name: 'Create pinyin recall card' }).click();
  await expect(host.frame.getByRole('button', { name: 'Open last study card' })).toBeVisible();
  await host.frame.getByRole('button', { name: 'Word', exact: true }).click();
  const pinyin = host.frame.getByRole('article', { name: 'Pinyin recall card', exact: true });
  await pinyin.getByText('Customize prompt', { exact: true }).click();
  await pinyin.getByLabel('Custom prompt for Pinyin recall').fill('My pinyin cue');
  await pinyin.getByLabel('Practice directions').selectOption('none');
  await host.frame.getByLabel('Edit study meanings').fill('pattern');
  await expect(host.frame.getByRole('article', { name: 'Writing card', exact: true })).toContainText('pattern (xíng)');
  await host.frame.getByRole('button', { name: 'Save vocabulary and update study cards' }).click();
  await expect(host.frame.getByText('Vocabulary and linked study cards saved and read back.')).toBeVisible({ timeout: 20000 });
  await expect(pinyin).toContainText('Paused');
  await host.frame.getByLabel('Edit study meanings').fill('a model');
  await host.frame.getByRole('button', { name: 'Save vocabulary and update study cards' }).click();
  await expect(pinyin.getByLabel('Custom prompt for Pinyin recall')).toHaveValue('My pinyin cue');
  expect(host.calls.filter(call => call.methodName === 'rem.createRem')).toHaveLength(2);
  expect(host.errors).toEqual([]);
});

test('the searchable master library adds all missing skills once and opens the shared editor', async ({ page }) => {
  const host = await openSdkWidget(page, 'workbench');
  await host.frame.getByRole('button', { name: 'Vocabulary', exact: true }).click();
  await expect(host.frame.getByText('5 words · 0 selected', { exact: true })).toBeVisible();
  await host.frame.getByLabel('Find a word').fill('model');
  await expect(host.frame.getByText('1 word · 0 selected', { exact: true })).toBeVisible();
  await host.frame.getByRole('button', { name: 'Select shown words' }).click();
  const add = host.frame.getByRole('button', { name: 'Add selected skills to selected words' });
  await add.click();
  await expect(host.frame.getByText('Selected skills added. Existing cards and paused directions are preserved.')).toBeVisible({ timeout: 20000 });
  expect(host.calls.filter(call => call.methodName === 'rem.createRem')).toHaveLength(7);
  await add.click();
  await expect(add).toBeEnabled();
  expect(host.calls.filter(call => call.methodName === 'rem.createRem')).toHaveLength(7);
  await host.frame.getByRole('button', { name: 'Edit 型', exact: true }).click();
  await expect(host.frame.getByRole('article', { name: 'Writing card', exact: true })).toBeVisible();
  const widgetFrame = page.frames().find(child => child.url().startsWith('https://hanzi-plugin.test/'))!;
  await widgetFrame.evaluate(() => window.scrollTo(0, 0));
  await page.locator('#sdk-widget').screenshot({ path: test.info().outputPath('shared-editor.png') });
  await host.frame.getByRole('article', { name: 'Writing card', exact: true }).scrollIntoViewIfNeeded();
  await page.locator('#sdk-widget').screenshot({ path: test.info().outputPath('shared-card-options.png') });
  const overflow = await widgetFrame.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  expect(host.errors).toEqual([]);
});
