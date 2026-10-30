import { useEffect, useRef, useState } from 'react';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { STUDY_SKILLS, type StudySkill } from '../core/study';
import type { DictionaryLookup } from '../services/dictionary';
import { serializeByKey } from '../services/serial';

export interface ImportRow extends DictionaryLookup {
  selected: number; included: boolean; meaning: string; importedId?: string; importError?: string; pending?: boolean; reused?: boolean; audioNotice?: string;
}
export interface ImportDraft { version: 1; text: string; rows: ImportRow[]; review: boolean; skills: StudySkill[]; showInput: boolean; page: number; findAudio: boolean }
const empty = (): ImportDraft => ({ version: 1, text: '', rows: [], review: false, skills: [...STUDY_SKILLS], showInput: true, page: 0, findAudio: true });
function validDraft(value: ImportDraft): boolean {
  return value.version === 1 && typeof value.text === 'string' && typeof value.review === 'boolean' && typeof value.showInput === 'boolean' &&
    (value.findAudio === undefined || typeof value.findAudio === 'boolean') &&
    Number.isInteger(value.page) && value.page >= 0 && Array.isArray(value.skills) && value.skills.every(skill => STUDY_SKILLS.includes(skill)) &&
    Array.isArray(value.rows) && value.rows.every(row => row && typeof row.word === 'string' && typeof row.meaning === 'string' && typeof row.included === 'boolean' &&
      (row.audioNotice === undefined || typeof row.audioNotice === 'string') &&
      Array.isArray(row.candidates) && Number.isInteger(row.selected) && row.selected >= -1 && row.selected < row.candidates.length &&
      row.candidates.every(candidate => candidate && typeof candidate.traditional === 'string' && typeof candidate.pinyin === 'string' &&
        Array.isArray(candidate.meanings) && candidate.meanings.every(meaning => typeof meaning === 'string') && candidate.dictionary && (candidate.dictionary.moe || candidate.dictionary.english) &&
        (!candidate.dictionary.moe || (Array.isArray(candidate.dictionary.moe.definitions) && candidate.dictionary.moe.definitions.every(definition => typeof definition === 'string'))) &&
        (!candidate.dictionary.english || (Array.isArray(candidate.dictionary.english.definitions) && candidate.dictionary.english.definitions.every(definition => typeof definition === 'string')))));
}
export function useImportDraft(plugin: RNPlugin, parentId?: string) {
  const key = `hm:v6:import-draft:${encodeURIComponent(parentId || 'default')}`;
  const [draft, setDraft] = useState<ImportDraft>(empty), [loadedKey, setLoadedKey] = useState(''), [error, setError] = useState('');
  const latest = useRef({ key: '', draft, ready: false });
  const snapshots = useRef(new Map<string, ImportDraft>());
  latest.current = { key, draft, ready: loadedKey === key };
  if (loadedKey === key) snapshots.current.set(key, draft);
  const persist = (snapshot: ImportDraft, draftKey: string) => serializeByKey(plugin.storage, draftKey, () => plugin.storage.setSynced(draftKey, snapshot));
  useEffect(() => {
    let live = true;
    void serializeByKey(plugin.storage, key, () => plugin.storage.getSynced<ImportDraft>(key)).then(value => {
      if (!live) return;
      if (value && !validDraft(value)) {
        throw new Error('The saved import draft could not be read. It has been preserved.');
      }
      setDraft(value ? { ...value, findAudio: value.findAudio ?? true } : empty()); setLoadedKey(key); setError('');
    }).catch(() => { if (live) setError('Could not load the saved import draft. Reopen this workbench to retry; it has not been overwritten.'); });
    return () => { live = false; };
  }, [plugin, key]);
  useEffect(() => {
    if (loadedKey !== key) return;
    let live = true;
    const timer = window.setTimeout(() => {
      void persist(draft, key).then(() => { if (live) setError(''); })
        .catch(() => { if (live) setError('Could not save the import draft. Keep this workbench open and retry.'); });
    }, 200);
    return () => { live = false; window.clearTimeout(timer); };
  }, [draft, key, loadedKey]);
  useEffect(() => () => {
    const snapshot = snapshots.current.get(key);
    if (snapshot) void persist(snapshot, key).catch(() => {});
  }, [plugin, key]);
  return { draft, setDraft, ready: loadedKey === key, error,
    flush: () => latest.current.ready ? persist(latest.current.draft, latest.current.key) : Promise.reject(new Error('Wait for the saved import to load.')) };
}
