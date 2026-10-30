import { expect, it } from 'vitest';
import { serializeByKey } from '../src/services/serial';

it('serializes retries for one identity and continues after a failed operation', async () => {
  const owner = {}, calls: string[] = [];
  let release!: () => void;
  const first = serializeByKey(owner, 'entry', async () => {
    calls.push('first'); await new Promise<void>(resolve => { release = resolve; });
    throw new Error('temporary failure');
  });
  const failed = expect(first).rejects.toThrow('temporary failure');
  const second = serializeByKey(owner, 'entry', async () => { calls.push('retry'); return 2; });
  await serializeByKey(owner, 'other-entry', async () => { calls.push('independent'); });
  expect(calls).toEqual(['first', 'independent']);
  release(); await failed;
  expect(await second).toBe(2);
  expect(calls).toEqual(['first', 'independent', 'retry']);
});

it('does not block an identical key in a different host or knowledge base', async () => {
  let release!: () => void;
  const first = serializeByKey({}, 'entry', () => new Promise<void>(resolve => { release = resolve; }));
  expect(await serializeByKey({}, 'entry', async () => 'separate store')).toBe('separate store');
  release(); await first;
});
