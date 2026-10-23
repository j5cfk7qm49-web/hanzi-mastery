# Creating compatible writing flashcards

1. Install/load the plugin, open RemNote's command menu, and run **Hanzi Mastery: create writing card / practice / settings**.
2. Select **Manual entry**. Enter the exact Traditional target, an English meaning/prompt, and optionally pinyin. For example, Traditional `學`, pinyin `xué`, English `study`.
3. Enter Simplified only when you have verified the form yourself. A switch to Simplified blocks cards without an explicit form instead of converting them.
4. Select or create a **List bullet**, then click **Create linked writing card**. The workbench validates character-data availability, creates a shared vocabulary entry, and creates a separate **forward-only** writing Rem beneath its character/word heading within that list (the **Hanzi Mastery** document by default). Use **Open created writing card**, then RemNote's native practice action.
5. Click **Begin test**, write each component from memory, and wait for the result/mastery save. Reveal the native answer after completing the exercise and use the native RemNote rating controls.

The vocabulary entry has the `Hanzi Vocabulary` Powerup. To create another card linked to the same entry, focus that entry and reopen the command. The workbench reuses its ID/forms. The writing Rem has the `Hanzi Writing` Powerup and hidden, programmatically managed JSON metadata. Adding that Powerup manually to an arbitrary Rem does not supply valid metadata; the widget will report a configuration problem. The old prototype's `WRITE:` parsing convention is intentionally unsupported.

The outline is **List → character or word → cards**. Word headings sort by Traditional characters. Create list bullets under **Manage lists**, or focus an ordinary bullet before opening the workbench. The plugin hides native ancestor context in its writing/study review area, supplies its own prompt, and retains native answer/rating controls. Use **Move vocabulary and cards to selected list** to group older flat cards or move an entry while preserving IDs, schedules and histories. Writing cards remain forward-only. New translations use one bidirectional Rem; older separate translation Rems remain separate.

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
| Chinese → English | Chinese word → type meaning, reveal and self-assess | Workbench and dictionary import; bidirectional translation Rem (legacy separate cards retained) |
| English → Chinese | English study meaning → write characters with Hanzi Writer stroke checks | Workbench and dictionary import; bidirectional translation Rem (legacy separate cards retained) |
| Pinyin | Chinese → pinyin including tones | Checked first-answer exercise |
| Character recognition | Pinyin → choose the matching characters | Four shuffled choices with distinct verified pronunciations; checked first answer |
| Tone identification | Chinese + toneless syllables → five-position tone buttons | Checked per-syllable choices |
| Listening | Audio → dictionary pinyin including tones | Checked first-answer exercise; audio required |
| Pronunciation | Chinese → say aloud → reference comparison | Self-assessment; recording/file comparison optional |

Translation directions share one bidirectional Rem for new words, with independent native cards and result histories. Other skills use separate Rems beneath the shared word heading. Answer-side references preserve shared data without revealing production targets. There is no tone-contour drawing.

## Pinyin, tone, character-recognition and audio cards

Focus a **Hanzi Vocabulary** entry (for example 人 — rén — person), then run **Hanzi Mastery: import, edit and create study cards** from `Ctrl+/`. The existing writing workbench command opens the same form. For new vocabulary you can use **Save vocabulary for other skills** without creating a writing card, or use [dictionary import](DICTIONARY_IMPORT.md) to fill readings/English suggestions and create both translation cards. Supply one pinyin syllable per Han character for pronunciation skills; translation cards also work without a reading. A separate vocabulary entry is required for another reading of the same characters.

The generated Rems have the `Hanzi Study` Powerup and hidden programmatic metadata. Each has its own native schedule. Repeating a skill's creation reuses its existing Rem; changing its reference audio updates that card. Saved vocabulary opens an editor that can update linked study cards in place; original dictionary records stay separate from learner edits. Existing writing cards and writing mastery are not converted.

**Pinyin:** use the standalone tone-mark and umlaut toolbar, or type numbered syllables and see them turn into marks. The toolbar edits the syllable at the cursor. `rén` and `ren2` are equivalent; `nü3`, `nv3` and `nu:3` are equivalent. An unmarked syllable means neutral tone (5), so `ren` does not pass a target of `rén`. All syllables, spelling and tones must match on the first submitted answer.

**Tones:** choose one dictionary tone per syllable using four square quadrants and a circular neutral-tone button in the center. This tests knowledge without a drawing gesture. Surface tones in connected speech can differ from dictionary tones.

**Character recognition:** see pinyin and choose its matching characters. The workbench uses three distractors from entries tagged **Hanzi Vocabulary**, supplementing short words with a small bundled vocabulary pool when needed. Existing two- or three-option cards receive the same supplementation at review time. Every option has the same number of characters as the target; if four unambiguous options cannot be built, creation/testing is blocked. The bundled **pinyin-pro 3.29.5** polyphonic dictionary and all your recorded readings are considered: 人/rén and 仁/rén cannot appear together; neither can rén/rěn tone-only alternatives. 行/háng is also excluded for 型/xíng because 行 can be xíng, even without a separate saved reading. Distractors cannot share readings with one another either. Multi-character options use conservative combinations of per-character readings. Missing/invalid or dictionary-unknown readings are excluded; an unverified target or fewer than four valid options blocks card creation with an explanation. Your supplied target reading is retained rather than replaced by an inferred reading; the dictionary is an ambiguity filter, not a Taiwan pronunciation authority. Options are a snapshot at authoring; recreate/update the recognition card after changing readings. Review shuffles their display order, preserves selection during interruptions, and reveals readings and the meaning only after submission or in study mode. Single characters and multi-character words are supported.

**Listening:** the native question omits the target and definition. Play the reference through, then enter dictionary pinyin. This version tests transcription/phonetic recall, not meaning comprehension. It does not treat a changed surface tone from sandhi as a different dictionary reading.

**Audio:** add an HTTPS recording of the exact item, or select a local Mandarin voice during review. The selected device voice's name and region are shown; remote voices are excluded. If the host has no usable voice or the reference fails to play, the audio prerequisite blocks a successful listening test; do not guess a native rating. Adding a reference recording requires reopening the vocabulary workbench and recreating/updating its audio skill card. Audio availability and offline caching depend on the source/host.

**Speaking:** say the word from memory, select **I’ve said it — compare with reference**, play the reference, then choose **I pronounced it correctly** or **Needs practice**. No microphone or recording is required. Completing reference playback is required before marking success. For optional side-by-side playback, use **Record pronunciation** to record one attempt (up to 20 seconds) or expand **Use an audio file** to choose a file smaller than 10 MB before revealing the reference. Only a self-assessed outcome is saved, explicitly separated from checked pinyin/tone results. Audio bytes are not saved or sent to a server. Browser tests do not establish native RemNote microphone permissions or recording quality. Automatic assessment is exploratory; [current feasibility and service requirements](SPEECH_ASSESSMENT.md) are documented separately.

Native answer reveal during an unfinished test records a failure. Study-only mode saves no result; studying after a test preserves its original result. Saves use retry IDs and read-back confirmation. Per-skill counts are performance history, not spaced writing mastery; use native RemNote controls to submit the suggested rating.

## Review UI refresh

All modes use a full-card surface, centered prompts and a shared result hierarchy. Writing keeps its fitted square and centers the canvas above the controls on desktop as well as mobile. Meaning → characters reuses that exact Hanzi Writer component and guarded grading flow; it has no keyboard or freehand-only substitution. Its mastery namespace and translation result history remain separate from the writing card and native schedules stay independent. Characters → meaning keeps a typed, synonym-aware self-assessment. Pronunciation exposes Record and Play controls directly; microphone access is requested only after Record is pressed.

Phone-sized Chromium/WebKit fixtures verify layout and input behavior, not the physical RemNote iPhone app.
