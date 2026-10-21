import { expect, test } from '@playwright/test';
import { openSdkWidget } from './sdk-host';

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
  await expect(host.frame.getByText('Writing mastery saved and read back.')).toBeVisible();
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
  await expect(host.frame.getByText('Skill result saved and read back.')).toBeVisible();
  const saves = host.calls.filter(call => call.methodName === 'storage.setSynced');
  const history = (saves[0].args.value as { history: { id: string; result: { passed: boolean } }[] }).history;
  expect(history[0].id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  expect(history[0].result.passed).toBe(true);
  expect(host.errors).toEqual([]);
});
