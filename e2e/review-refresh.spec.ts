import { test, expect } from '@playwright/test';
import { drawCharacter } from './draw-character';

for (const width of [320, 393, 1280]) for (const skill of ['english-to-chinese', 'chinese-to-english', 'pinyin', 'tones', 'character-choice', 'listening', 'pronunciation']) {
  test(`${skill} fills its card and keeps native controls reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 900 : 852 });
    await page.goto(`/?host=mobile&width=${width}&reviewSkill=${skill}&audioFixture=1`);
    const review = page.frameLocator('iframe'), writing = skill === 'english-to-chinese';
    const begin = review.getByRole('button', { name: writing ? 'Begin test' : skill === 'pronunciation' ? 'Begin spoken practice' : 'Begin recall test', exact: true });
    await begin.click();
    if (width === 393) await page.screenshot({ path: `docs/screenshots/review-refresh-2026-10-22/${test.info().project.name}-${skill}-active-phone.png` });
    if (writing) {
      const canvas = review.getByLabel('Chinese handwriting canvas'); await expect(canvas).toHaveAttribute('aria-busy', 'false');
      await drawCharacter(canvas, '人'); await expect(review.getByLabel('Result saved')).toBeVisible();
    } else if (skill === 'pinyin') {
      await review.getByLabel('Your pinyin').fill('ren2'); await expect(review.getByLabel('Your pinyin')).toHaveValue('rén');
      await review.getByRole('button', { name: 'Add tone 3' }).click(); await expect(review.getByLabel('Your pinyin')).toHaveValue('rěn');
    } else if (skill === 'tones') {
      await expect(review.getByRole('radio')).toHaveCount(5);
      await review.getByRole('radio', { name: '2 — rising' }).click();
      await review.getByRole('button', { name: 'Check first answer' }).click();
      await expect(review.getByLabel('Result saved')).toBeVisible();
      await review.getByText('Answer details', { exact: true }).click();
      await expect(review.getByText(/syllables spelled correctly/)).toHaveCount(0);
    } else if (skill === 'chinese-to-english') {
      await review.getByLabel('Your meaning').fill('person');
      await review.getByRole('button', { name: 'Compare first answer' }).click();
      await expect(review.locator('.hm-recall-prompt')).toHaveCount(0);
      await expect(review.locator('.hm-result-target')).toHaveCount(1);
    } else if (skill === 'character-choice') await expect(review.getByRole('radio')).toHaveCount(4);
    else if (skill === 'pronunciation') {
      await expect(review.getByRole('button', { name: 'Record pronunciation' })).toBeVisible();
      await expect(review.getByRole('button', { name: 'Play reference audio' })).toBeVisible();
    }
    expect(await review.locator('html').evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const frame = (await page.locator('iframe').boundingBox())!, pane = (await page.getByRole('main').boundingBox())!;
    expect(frame.y + frame.height).toBeLessThanOrEqual(pane.y + pane.height + 1);
    await expect(page.getByRole('button', { name: 'Native Show Answer (simulated)' })).toBeVisible();
    if (width === 393) await page.screenshot({ path: `docs/screenshots/review-refresh-2026-10-22/${test.info().project.name}-${skill}-phone.png` });
  });
}
