export function localMandarinVoices(): SpeechSynthesisVoice[] {
  return typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices().filter(v =>
    v.localService && /^zh(?:[-_](?:TW|CN|SG|Hans|Hant)(?:[-_]|$)|$)/i.test(v.lang));
}
/** Playback is initiated only by a user gesture; remote synthesis is deliberately excluded. */
export function playReference(options: { text: string; url?: string; voice?: SpeechSynthesisVoice;
  onEnded(): void; onError(): void }): () => void {
  let live = true;
  if (options.url) {
    const audio = new Audio(options.url);
    audio.onended = () => { if (live) options.onEnded(); };
    audio.onerror = () => { if (live) options.onError(); };
    void audio.play().catch(() => { if (live) options.onError(); });
    return () => { live = false; audio.pause(); audio.removeAttribute('src'); audio.load(); };
  }
  if (!options.voice?.localService || typeof speechSynthesis === 'undefined') throw new Error('Choose a local Mandarin voice or add reference audio in the workbench.');
  const utterance = new SpeechSynthesisUtterance(options.text);
  utterance.voice = options.voice; utterance.lang = options.voice.lang;
  utterance.onend = () => { if (live) options.onEnded(); };
  utterance.onerror = () => { if (live) options.onError(); };
  speechSynthesis.speak(utterance);
  return () => { live = false; speechSynthesis.cancel(); };
}
