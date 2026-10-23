import React, { useRef, useState } from 'react';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { parseRecallSchema, RECALL_NAMES, RECALL_SKILLS, type RecallSkill } from '../core/recall';
import { ensureRecallCard, ensureTranslationCards, vocabularyCharacterChoices } from '../services/recall';

export function StudySkills({ plugin, vocabularyId, traditional, pinyin, meaning, audio, onBusy }: {
  plugin: RNPlugin; vocabularyId: string; traditional: string; pinyin: string; meaning: string; audio?: string; onBusy?(busy:boolean):void;
}) {
  const [referenceAudio, setReferenceAudio] = useState(audio || '');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const [lastCard, setLastCard] = useState(''); const guard = useRef(false);
  const create = async (skill: RecallSkill) => {
    if (guard.current) return; guard.current = true; setBusy(true); onBusy?.(true); setError(''); setStatus('');
    try {
      const choices = skill === 'character-choice' ? await vocabularyCharacterChoices(plugin, { traditional, pinyin }) : undefined;
      const schema = parseRecallSchema(JSON.stringify({ version: 1, skill, vocabularyId, traditional, pinyin, meaning,
        ...(choices ? { choices } : {}), ...(referenceAudio.trim() ? { referenceAudio: referenceAudio.trim() } : {}) }));
      const id = skill === 'english-to-chinese' ? (await ensureTranslationCards(plugin, schema))[0] : await ensureRecallCard(plugin, schema, vocabularyId);
      setLastCard(id); setStatus(`${skill === 'english-to-chinese' ? 'Translation in both directions' : RECALL_NAMES[skill]} is ready beneath ${traditional}. Existing cards are reused.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'The study card could not be created.'); }
    finally { guard.current = false; setBusy(false); onBusy?.(false); }
  };
  return <section className="hm-study-authoring" aria-label="Other study skills">
    <h2>Study cards</h2>
    <p className="hm-muted">Add a skill once. Each direction keeps its own review schedule.</p>
    <div className="hm-skill-grid">{RECALL_SKILLS.filter(s => s !== 'chinese-to-english').map(skill => <button key={skill} disabled={busy} aria-label={skill === 'english-to-chinese' ? 'Create bidirectional translation card' : `Create ${RECALL_NAMES[skill].toLowerCase()} card`} onClick={() => void create(skill)}>
      <strong>{skill === 'english-to-chinese' ? 'Translation ↔' : RECALL_NAMES[skill]}</strong><small>{({ 'english-to-chinese': 'Meaning ↔ characters', pinyin: 'Type the reading', tones: 'Choose each tone', 'character-choice': 'Match pinyin to characters', listening: 'Listen, then type pinyin', pronunciation: 'Speak and self-assess' } as Record<string, string>)[skill]}</small></button>)}</div>
    <details><summary>Audio & recognition options</summary><label>Reference audio URL (optional)<input type="url" value={referenceAudio} disabled={busy} onChange={e => setReferenceAudio(e.target.value)} placeholder="https://…" /></label>
      <p className="hm-caption">Use a recording of this exact word, or select a local Mandarin device voice during review. Spoken practice uses self-assessment. Recognition excludes homophones and tone-only alternatives.</p></details>
    {status && <p role="status">{status}</p>}{error && <p role="alert" className="hm-error">{error}</p>}
    {lastCard && <button disabled={busy} onClick={() => void (async () => {
      if (guard.current) return; guard.current = true; setBusy(true); onBusy?.(true); setError('');
      try {
        const rem = await plugin.rem.findOne(lastCard);
        if (!rem) throw new Error('The study card could not be found.');
        await plugin.window.openRem(rem); await plugin.widget.closePopup();
      } catch (e) { setError(e instanceof Error ? e.message : 'The study card could not be opened.'); }
      finally { guard.current = false; setBusy(false); onBusy?.(false); }
    })()}>Open last study card</button>}
  </section>;
}
