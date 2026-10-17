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
| Pinyin | Chinese → pinyin including tones | Native forward card; manual creation |
| Tone identification | Audio/syllable → tone number | Native card design; dedicated exercise pending |
| Listening | Audio → meaning/word | Native audio card design; dedicated exercise pending |
| Pronunciation | Chinese/pinyin prompt → audio/self-assessment | Dedicated recording/recognition pending |

Use separate Rems referencing a shared vocabulary entry for these skills so RemNote schedules them separately. Answer-side references preserve shared data without revealing production targets. The plugin does not yet automatically generate these additional skill cards or grade speech, pinyin or tones. There is no tone-contour drawing.
