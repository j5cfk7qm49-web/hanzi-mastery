export async function fetchWithTimeout<T>(url: string, consume: (response: Response) => Promise<T>, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', cancel, { once: true });
  try { return await consume(await fetch(url, { signal: controller.signal, credentials: 'omit' })); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
