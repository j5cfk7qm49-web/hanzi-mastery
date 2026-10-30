// Serialize one identity within one host/store. Failures must not block later retries.
// Weak ownership keeps separate knowledge bases independent and allows closed hosts to be collected.
const queues = new WeakMap<object, Map<string, Promise<unknown>>>();

export function serializeByKey<T>(owner: object, key: string, run: () => Promise<T>): Promise<T> {
  let queue = queues.get(owner);
  if (!queue) { queue = new Map(); queues.set(owner, queue); }
  const pending = (queue.get(key) || Promise.resolve()).catch(() => {}).then(run);
  queue.set(key, pending);
  const clean = () => { if (queue.get(key) === pending) queue.delete(key); };
  void pending.then(clean, clean);
  return pending;
}
