import { readMastery, recordReview, type Mastery, type ReviewRecord } from '../core/mastery';
import type { Settings } from '../core/config';
export interface SyncedStore {
  getSynced<T = unknown>(key: string): Promise<T | undefined>;
  setSynced(key: string, value: unknown): Promise<void>;
}
export const masteryKey = (vocabularyId: string, character: string) => `hm:v2:writing:${encodeURIComponent(vocabularyId)}:${character.codePointAt(0)!.toString(16)}`;
const locks = new Map<string, Promise<unknown>>();
export class MasteryRepository {
  constructor(private storage: SyncedStore) {}
  async load(vocabularyId: string, character: string): Promise<Mastery> {
    return readMastery(await this.storage.getSynced(masteryKey(vocabularyId, character)));
  }
  save(vocabularyId: string, character: string, review: ReviewRecord, settings: Settings): Promise<Mastery> {
    const key = masteryKey(vocabularyId, character);
    const run = async () => {
      const old = await this.load(vocabularyId, character);
      if (old.history.some(r => r.id === review.id)) return old;
      const next = recordReview(old, review, settings);
      await this.storage.setSynced(key, next);
      // Verify the read-back before reporting saved. This is not a multi-device transaction.
      const stored = await this.load(vocabularyId, character);
      if (!stored.history.some(r => r.id === review.id)) throw new Error('Mastery save was not confirmed. Keep the result open and retry.');
      return stored;
    };
    const pending = (locks.get(key) || Promise.resolve()).catch(() => {}).then(run);
    locks.set(key, pending);
    void pending.finally(() => { if (locks.get(key) === pending) locks.delete(key); }).catch(() => {});
    return pending;
  }
}
