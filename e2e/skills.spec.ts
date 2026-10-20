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
  await expect(page.getByText('Skill result saved and read back.')).toBeVisible();
  await page.goto('/?skill=tones'); await page.getByRole('button', { name: 'Begin recall test' }).click();
  await page.getByLabel('Tone for syllable 1').selectOption('2');
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
