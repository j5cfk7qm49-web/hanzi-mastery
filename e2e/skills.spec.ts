import { expect, test } from '@playwright/test';
/** A silent WAV exercises media playback only; it is not a Mandarin reference sample. */
function fixtureWav() {
  const bytes = Buffer.alloc(44 + 8000), samples = 4000;
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40); return bytes;
}
test('pinyin and tone knowledge check first answers and fail on native reveal', async ({ page }) => {
  await page.goto('/?skill=pinyin'); await page.getByRole('button', { name: 'Begin recall test' }).click();
  await page.getByLabel('Your pinyin').fill('ren2');
  await page.getByRole('button', { name: 'Check first answer' }).click();
  await expect(page.getByLabel('Result saved')).toBeVisible();
  await page.goto('/?skill=tones'); await page.getByRole('button', { name: 'Begin recall test' }).click();
  await page.getByRole('radio', { name: '2 — rising' }).click();
  await page.getByRole('button', { name: 'Simulate native answer reveal' }).click();
  await expect(page.getByText('Recall test needs practice')).toBeVisible();
  await expect(page.getByText('The native answer was revealed before completion.')).toBeVisible();
});
test('listening hides the answer and gates grading on available, completed playback', async ({ page, browserName }) => {
  await page.route('https://hanzi-audio.test/reference.wav', route => route.fulfill({ body: fixtureWav(), contentType: 'audio/wav', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto('/?skill=listening&audioFixture=1'); await page.getByRole('button', { name: 'Begin recall test' }).click();
  const region = page.getByRole('region', { name: 'Hanzi Mastery study review' });
  expect(await region.innerHTML()).not.toContain('人'); expect(await region.innerHTML()).not.toContain('rén');
  await page.getByLabel('Your pinyin').fill('ren2');
  await expect(page.getByRole('button', { name: 'Check first answer' })).toBeDisabled();
  await page.getByRole('button', { name: 'Play reference audio' }).click();
  // Windows Playwright WebKit advertises WAV support but its native media backend
  // rejects even a same-origin WAV. Exercise the failure gate on this runtime;
  // Chromium exercises actual playback. This is not iPhone media acceptance.
  if (browserName === 'webkit' && process.platform === 'win32') {
    await expect(page.getByRole('alert')).toContainText('Reference audio could not play');
    await expect(page.getByRole('button', { name: 'Check first answer' })).toBeDisabled();
    await expect(page.getByText('Correct on the first answer')).toHaveCount(0);
    return;
  }
  await expect(page.getByRole('button', { name: 'Check first answer' })).toBeEnabled();
  await page.getByRole('button', { name: 'Check first answer' }).click();
  await expect(page.getByText('Correct on the first answer')).toBeVisible();
});
test('spoken practice preserves a local clip and clearly labels self-assessment', async ({ page, browserName }) => {
  await page.route('https://hanzi-audio.test/reference.wav', route => route.fulfill({ body: fixtureWav(), contentType: 'audio/wav', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto('/?skill=pronunciation&audioFixture=1'); await page.getByRole('button', { name: 'Begin spoken practice' }).click();
  await page.getByText('Use an audio file', { exact: true }).click();
  await page.getByLabel('Or choose a pronunciation recording').setInputFiles({ name: 'test.wav', mimeType: 'audio/wav', buffer: fixtureWav() });
  await expect(page.getByLabel('Your pronunciation recording')).toBeVisible();
  await expect(page.getByRole('button', { name: 'I pronounced it correctly' })).toBeDisabled();
  await page.getByRole('button', { name: 'Play reference audio' }).click();
  if (browserName === 'webkit' && process.platform === 'win32') {
    await expect(page.getByRole('alert')).toContainText('Reference audio could not play');
    await expect(page.getByRole('button', { name: 'I pronounced it correctly' })).toBeDisabled();
    await page.getByRole('button', { name: 'Needs practice', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'I pronounced it correctly' }).click();
  }
  await expect(page.getByText('Spoken practice: self-assessed')).toBeVisible();
  await expect(page.getByLabel('Your pronunciation recording')).toBeVisible();
});

test('character recognition hides meanings and readings, saves the first choice and preserves failure in study', async ({ page }) => {
  await page.goto('/?skill=character-choice');
  await expect(page.getByRole('heading', { name: 'rén', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '人', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Begin recall test' }).click();
  await expect(page.getByRole('radio')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Check first answer' })).toBeDisabled();
  await expect(page.getByText('shū', { exact: true })).toHaveCount(0);
  await page.getByRole('radio', { name: '書', exact: true }).check();
  await page.getByRole('button', { name: 'Check first answer' }).click();
  await page.getByText('Answer details', {exact:true}).click();
  await expect(page.getByText('Your choice: 書 — incorrect')).toBeVisible();
  await expect(page.getByLabel('Result saved')).toBeVisible();
  await page.getByRole('button', { name: 'Study with the reference' }).click();
  await expect(page.getByText('Recall test needs practice')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Choice readings' })).toContainText('書 — shū');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('spoken comparison works without a microphone or recording and waits for the reference', async ({ page, browserName }) => {
  await page.route('https://hanzi-audio.test/reference.wav', route => route.fulfill({ body: fixtureWav(), contentType: 'audio/wav' }));
  await page.goto('/?skill=pronunciation&audioFixture=1');
  await page.getByRole('button', { name: 'Begin spoken practice' }).click();
  await expect(page.getByRole('button', { name: 'Play reference audio' })).toBeDisabled();
  await page.getByRole('button', { name: 'I’ve said it — compare with reference' }).click();
  await expect(page.getByRole('button', { name: 'I pronounced it correctly' })).toBeDisabled();
  await page.getByRole('button', { name: 'Play reference audio' }).click();
  if (browserName === 'webkit' && process.platform === 'win32') {
    await expect(page.getByRole('alert')).toContainText('Reference audio could not play');
    await expect(page.getByRole('button', { name: 'I pronounced it correctly' })).toBeDisabled();
    await page.getByRole('button', { name: 'Needs practice', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'I pronounced it correctly' }).click();
  }
  await expect(page.getByText('Spoken practice: self-assessed')).toBeVisible();
  await expect(page.getByLabel('Your pronunciation recording')).toHaveCount(0);
});

for (const skill of ['chinese-to-english']) {
  test(`${skill} accepts a typed first answer and explicit self-assessment`, async ({ page }) => {
    await page.goto(`/?skill=${skill}`);
    const region = page.getByRole('region', { name: 'Hanzi Mastery study review' });
    expect(await region.innerHTML()).not.toContain(skill === 'english-to-chinese' ? '人' : 'person');
    await page.getByRole('button', { name: 'Begin recall test' }).click();
    await page.getByRole('textbox').fill(skill === 'english-to-chinese' ? '人' : 'human being');
    await page.getByRole('button', { name: 'Compare first answer' }).click();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await page.getByRole('button', { name: 'Simulate native answer reveal' }).click();
    await page.getByRole('button', { name: 'My answer is correct' }).click();
    await expect(page.getByLabel('Result saved')).toBeVisible();
    await expect(page.getByText('Suggested RemNote rating: Good / Recalled')).toBeVisible();
  });
}
