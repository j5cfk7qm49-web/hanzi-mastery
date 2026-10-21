import { test, expect, type Page, type FrameLocator } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function expectFits(page: Page, review: FrameLocator) {
  const frame = await page.locator('iframe').boundingBox();
  const pane = await page.getByRole('main').boundingBox();
  expect(frame).not.toBeNull(); expect(pane).not.toBeNull();
  expect(frame!.y).toBeGreaterThanOrEqual(pane!.y - 1);
  expect(frame!.y + frame!.height).toBeLessThanOrEqual(pane!.y + pane!.height + 1);
  await expect.poll(() => review.locator('html').evaluate(el => el.scrollHeight <= innerHeight + 1 && el.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.getByRole('main').evaluate(el => el.scrollHeight <= el.clientHeight + 1 && el.scrollTop === 0)).toBe(true);
  expect(await review.locator('html').evaluate(() => (document.scrollingElement?.scrollTop || 0) === 0)).toBe(true);
  for (const element of [review.locator('.hm-review-prompt'), review.locator('.hm-review-controls')]) {
    const box = await element.boundingBox(); expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(frame!.y - 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1);
  }
  for (const button of await review.getByRole('button').all()) if (await button.isVisible()) {
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(frame!.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(frame!.x + frame!.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(frame!.y - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(frame!.y + frame!.height + 1);
  }
}
async function expectLargestSquare(review: FrameLocator) {
  const canvas = review.getByRole('application');
  await expect(canvas).toHaveAttribute('aria-busy', 'false');
  await expect.poll(async () => {
    const box = await canvas.boundingBox(), area = await review.locator('.hm-canvas-area').boundingBox();
    return !!box && !!area && Math.abs(box.width - box.height) < 1 && Math.abs(box.width - Math.min(area.width, area.height)) < 2;
  }).toBe(true);
}
const sizes = [
  { name: 'compact-phone', width: 320, height: 568 },
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-screenshot', width: 393, height: 852 },
  { name: 'large-phone-dark', width: 430, height: 932, dark: true },
  { name: 'landscape', width: 844, height: 390 },
  { name: 'ipad', width: 768, height: 1024 },
  { name: 'narrow-split-view', width: 1024, height: 768, frameWidth: 320 },
];
for (const beautiful of [false, true]) for (const size of sizes) test(`fitted ${beautiful ? 'beautiful' : 'compact'} review: ${size.name} needs no scrolling in ready, test, result or practice`, async ({ page }) => {
  await page.setViewportSize({ width: size.width, height: size.height });
  await page.emulateMedia({ colorScheme: size.dark ? 'dark' : 'light' });
  await page.goto(`/?host=mobile&long=1${beautiful ? '&beautiful=1' : ''}${size.frameWidth ? `&width=${size.frameWidth}` : ''}`);
  const review = page.frameLocator('iframe');
  await expect(review.getByRole('button', { name: 'Begin test', exact: true })).toBeVisible();
  await expectFits(page, review);
  await expect(page.getByText('Write the word from its English prompt.')).toBeHidden();
  await expect(page.getByText('Statistics', {exact:true})).toBeHidden();
  await review.getByRole('button', { name: 'Begin test', exact: true }).click();
  await expectLargestSquare(review); await expectFits(page, review);
  if (size.name === 'iphone-screenshot') expect((await review.getByRole('application').boundingBox())!.width).toBeGreaterThan(340);
  await page.screenshot({ path: `test-results/${test.info().project.name}-${beautiful ? 'beautiful' : 'compact'}-${size.name}-writing.png` });
  await review.getByRole('button', { name: 'I forgot a stroke — end test' }).click();
  await expect(review.getByText('Writing mastery saved and read back.')).toBeVisible();
  await expectFits(page, review);
  await review.getByRole('button', { name: 'Practice with hints and animation' }).click();
  await expectLargestSquare(review); await expectFits(page, review);
  await expect(review.getByText('Writing test failed', { exact: true })).toBeVisible();
  await expect(review.getByText('Saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Native Show Answer (simulated)' }).click();
  for (const label of ['Forgot', 'Hard', 'Good', 'Easy']) await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  await expectFits(page, review);
  const pluginControls = (await review.locator('.hm-review-controls').boundingBox())!;
  const nativeControls = (await page.getByRole('contentinfo', { name:'Simulated native RemNote controls' }).boundingBox())!;
  expect(pluginControls.y + pluginControls.height).toBeLessThanOrEqual(nativeControls.y + 1);
});

for (const beautiful of [false, true]) test(`fitted ${beautiful ? 'beautiful' : 'compact'} host CSS leaves other plugins and native cards unchanged`, async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(`/?host=mobile&unrelated=1${beautiful ? '&beautiful=1' : ''}`);
  await expect(page.getByText('Write the word from its English prompt.')).toBeVisible();
  await expect(page.getByText('Statistics', {exact:true})).toBeVisible();
  expect(await page.getByRole('main').evaluate(el => getComputedStyle(el).overflowY)).toBe('auto');
  await expect(page.getByRole('button', { name: 'Native Show Answer (simulated)' })).toBeVisible();
});

test('start and practice remain reachable in a 150px bootstrap frame', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 }); await page.goto('/?host=mobile&unfitted=1');
  const review = page.frameLocator('iframe');
  await expect(review.getByRole('button', { name:'Begin test',exact:true })).toBeVisible();
  await expect(review.getByRole('button', { name:'Guided practice only' })).toBeVisible();
  await expectFits(page, review);
});

for (const beautiful of [false, true]) test(`fitted ${beautiful ? 'beautiful' : 'compact'} canvas retains strokes through rotation and opening details`, async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 }); await page.goto(`/?host=mobile${beautiful ? '&beautiful=1' : ''}`);
  const review = page.frameLocator('iframe'); await review.getByRole('button', { name: 'Begin test', exact: true }).click();
  await expectLargestSquare(review);
  const canvas = review.getByRole('application');
  const data = JSON.parse(await readFile('node_modules/hanzi-writer-data/學.json', 'utf8'));
  const draw = async (median: number[][]) => canvas.evaluate((element, median: number[][]) => {
    const svg = element.querySelector('svg')!, box = svg.getBoundingClientRect(), scale = (box.width - 32) / 1024;
    const touch = (p: number[]) => ({ identifier: 1, target: svg, clientX: box.left + 16 + p[0] * scale, clientY: box.top + 16 + (900 - p[1]) * scale });
    const emit = (type: string, p: number[]) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [touch(p)] }, changedTouches: { value: [touch(p)] } }); svg.dispatchEvent(event);
    };
    emit('touchstart', median[0]); for (const p of median.slice(1)) emit('touchmove', p); emit('touchend', median.at(-1)!);
  }, median);
  await draw(data.medians[0]); await expect(review.getByText('1 / 16 strokes · 0 rejected attempts')).toBeVisible();
  await review.getByRole('button', { name: 'Review options and details' }).click();
  await expect(review.getByRole('dialog', { name: 'Review details' })).toBeVisible();
  await review.getByRole('button', { name: 'Close review details' }).press('Escape');
  await expect(review.getByRole('dialog')).toHaveCount(0); await expectLargestSquare(review);
  await expect(review.getByRole('button', { name: 'Review options and details' })).toBeFocused();
  await page.setViewportSize({ width: 844, height: 390 }); await expectLargestSquare(review); await expectFits(page, review);
  await draw(data.medians[1]); await expect(review.getByText('2 / 16 strokes · 0 rejected attempts')).toBeVisible();
  await page.setViewportSize({ width: 393, height: 852 }); await expectLargestSquare(review); await expectFits(page, review);
});

for (const beautiful of [false, true]) test(`fitted ${beautiful ? 'beautiful' : 'compact'} review reflows larger text without scrolling or losing its controls`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 }); await page.goto(`/?host=mobile&long=1${beautiful ? '&beautiful=1' : ''}`);
  const review = page.frameLocator('iframe'); await review.getByRole('button', { name: 'Begin test', exact: true }).click();
  await review.locator('.hm-review').evaluate(el => {
    for (const item of el.querySelectorAll<HTMLElement>('h2,button,.hm-review-meta,.hm-score')) item.style.fontSize = '20px';
  });
  await expectLargestSquare(review); await expectFits(page, review);
});
