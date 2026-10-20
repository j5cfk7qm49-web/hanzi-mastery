# Creating compatible writing flashcards

1. Install/load the plugin, open RemNote's command menu, and run **Hanzi Mastery: create writing card / practice / settings**.
2. Enter the exact Traditional target, an English meaning/prompt, and optionally pinyin. For example, Traditional `學`, pinyin `xué`, English `study`.
3. Enter Simplified only when you have verified the form yourself. A switch to Simplified blocks cards without an explicit form instead of converting them.
4. Click **Create linked writing card**. The workbench validates character-data availability, creates a shared vocabulary entry, and creates a separate **forward-only** writing Rem in a neutral **Hanzi Mastery** document. Use **Open created writing card**, then RemNote's native practice action.
5. Click **Begin test**, write each component from memory, and wait for the result/mastery save. Reveal the native answer after completing the exercise and use the native RemNote rating controls.

The vocabulary entry has the `Hanzi Vocabulary` Powerup. To create another card linked to the same entry, focus that entry and reopen the command. The workbench reuses its ID/forms. The writing Rem has the `Hanzi Writing` Powerup and hidden, programmatically managed JSON metadata. Adding that Powerup manually to an arbitrary Rem does not supply valid metadata; the widget will report a configuration problem. The old prototype's `WRITE:` parsing convention is intentionally unsupported.

Writing cards and vocabulary entries are siblings in a neutral **Hanzi Mastery** document so a vocabulary ancestor cannot reveal the target. You can move writing cards under another neutral folder/document such as **Chinese Writing**. Do not place them under a title containing the answer, make their question-side references display the answer, or enable backward/cloze review. The plugin does not hide native RemNote context that a user independently adds to a card. Inspect the entire native question side before studying a new setup.

## Metadata contract

Powerup `hanzi-writing-v2`, hidden slot `schema`:

```json
{
  "version": 2,
  "skill": "writing",
  "vocabularyId": "REAL_VOCABULARY_REM_ID",
  "traditional": "學習",
  "simplified": "学习",
  "prompt": "study (xué xí)"
}
```

Target strings support 1–12 Han characters, without punctuation, spaces or automatic substitutions. The widget requires matching context/current card IDs and forward direction. It does not guess a target from rich text, referenced Rems, ordinary answers or OCR. Repeated characters in a word retain one worst-case mastery result for that test.

The `Hanzi Vocabulary` schema stores exact forms, pinyin, meanings, optional part of speech, examples, audio references, TOCFL label/source/verification status, source, categories, tags and optional dictionary links. The current authoring UI exposes the basic fields; advanced fields are represented in the TypeScript schema. Writing mastery is linked by vocabulary ID and Unicode character, not duplicated into each skill card.

## Separate skill cards

| Skill | Question / answer pattern | Current support |
| --- | --- | --- |
| Writing | English/pinyin prompt → hidden target / handwriting | Interactive widget and workbench |
| Recognition | Character/word → meaning | Native forward RemNote card; manual creation |
| Chinese → English | Chinese word/sentence → English | Native forward card; manual creation |
| English → Chinese | English → exact Chinese form | Native forward card; manual creation |
| Pinyin | Chinese → pinyin including tones | Checked first-answer exercise |
| Tone identification | Chinese + toneless syllables → tone numbers | Checked per-syllable choices |
| Listening | Audio → dictionary pinyin including tones | Checked first-answer exercise; audio required |
| Pronunciation | Chinese → first spoken attempt → reference comparison | Local recording/file and explicit self-assessment; automatic assessment pending |

Use separate Rems referencing a shared vocabulary entry for these skills so RemNote schedules them separately. Answer-side references preserve shared data without revealing production targets. There is no tone-contour drawing.

## Pinyin, tone, listening and spoken-practice cards

Focus a **Hanzi Vocabulary** entry (for example 人 — rén — person), then run **Hanzi Mastery: pinyin, tones, listening and speaking** from `Ctrl+/`. The existing writing workbench command opens the same form. For new vocabulary you can use **Save vocabulary for other skills** without creating a writing card. Supply one pinyin syllable per Han character, separated by spaces, and create the skills you want in **Pinyin, tones, listening and speaking**. A separate vocabulary entry is required for another reading of the same characters.

The generated Rems have the `Hanzi Study` Powerup and hidden programmatic metadata. Each has its own native schedule. Repeating a skill's creation reuses its existing Rem; changing its reference audio updates that card. The authoring form freezes vocabulary fields after they are saved. Existing writing cards and writing mastery are not converted.

**Pinyin:** type tone marks or numbered syllables. `rén` and `ren2` are equivalent; `nü3`, `nv3` and `nu:3` are equivalent. An unmarked syllable means neutral tone (5), so `ren` does not pass a target of `rén`. All syllables, spelling and tones must match on the first submitted answer.

**Tones:** choose one dictionary tone per syllable. This tests knowledge without a drawing gesture. Surface tones in connected speech can differ from dictionary tones.

**Listening:** the native question omits the target and definition. Play the reference through, then enter dictionary pinyin. This version tests transcription/phonetic recall, not meaning comprehension. It does not treat a changed surface tone from sandhi as a different dictionary reading.

**Audio:** add an HTTPS recording of the exact item, or select a local Mandarin voice during review. The selected device voice's name and region are shown; remote voices are excluded. If the host has no usable voice or the reference fails to play, the audio prerequisite blocks a successful listening test; do not guess a native rating. Adding a reference recording requires reopening the vocabulary workbench and recreating/updating its audio skill card. Audio availability and offline caching depend on the source/host.

**Speaking:** record one attempt (up to 20 seconds) or choose an audio file smaller than 10 MB if microphone access is unavailable. After that attempt, compare the local recording with reference pinyin/audio. Only a self-assessed outcome is saved, explicitly separated from checked pinyin/tone results. Audio bytes are not saved or sent to a server. Browser tests do not establish native RemNote microphone permissions or recording quality. Automatic recognition, acoustic tone checking and phoneme grading are outside the current requirements; [the earlier research](SPEECH_ASSESSMENT.md) is retained for reference.

Native answer reveal during an unfinished test records a failure. Study-only mode saves no result; studying after a test preserves its original result. Saves use retry IDs and read-back confirmation. Per-skill counts are performance history, not spaced writing mastery; use native RemNote controls to submit the suggested rating.
