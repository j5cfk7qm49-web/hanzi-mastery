# Hanzi Mastery 0.3.0 pre-release

Add independently scheduled pinyin, tone and listening exercises linked to shared vocabulary entries.

- Check the first pinyin answer for both spelling and tones, accepting tone marks or numbered syllables and common spellings of ü.
- Test dictionary-tone recall with per-syllable choices and listening-to-pinyin recall after reference audio playback.
- Create or reuse separate native forward cards for each skill from the vocabulary workbench. Preserve first results through answer reveal, study mode and save retries.
- Support an HTTPS reference recording or an available local Mandarin device voice. Spoken recording/file comparison is optional and explicitly self-assessed; recordings remain in memory and are not uploaded. Automatic speech recognition and pronunciation grading are outside the current requirements.
- Preserve existing independent handwriting recall, mastery progression, Traditional character data and native RemNote rating controls.

TypeScript and 80 unit/component/adapter/import tests pass. Browser and live-host verification boundaries are recorded in `docs/TESTING.md` and `docs/STUDY_SKILL_VERIFICATION.md`. The new skill cards still require live-host acceptance, and actual RemNote iOS/Pencil operation, hosted installation, offline behavior and cross-device progress remain unverified.

The unlisted upload package is `release/HanziMastery-0.3.0-plugin.zip`. The manifest enables mobile use and requests sandboxed read/create/modify access. RemNote retains scheduling; the plugin does not delete existing notes or submit native ratings automatically. Installation instructions and the required RemNote approval process are in `docs/INSTALLATION.md`.

## Previous 0.2.3 handwriting fixes

Fix a result-display issue found by testing the new plugin in RemNote Desktop.

- After finishing a scrolled handwriting test, its result heading and save confirmation could remain clipped above the queue pane. The result and persisted mastery were correct, but the feedback was easy to miss.
- Bring the result heading into view after the host finishes resizing. Share the canvas's input-cancelled delayed adjustment without taking keyboard focus from RemNote.
- Add a regression that fails before the fix and checks actual heading/save-status bounds inside a short review pane in Chromium and WebKit. Grading and scheduling behavior are unchanged.

Verification: TypeScript, **60 unit/component/adapter/import tests**, **28 Chromium/WebKit browser tests**, official SDK manifest validation and ZIP integrity checks. Live RemNote Desktop testing confirmed accepted/rejected strokes, explicit-forgetting failure, early native-reveal failure, synced mastery read-back, retained failure in guided practice, and the corrected result position. No native SRS rating was applied during this test pass. The original v0.2.2 ZIP was also rebuilt byte-for-byte before the fix.

RemNote retains native rating controls and scheduling. Real RemNote iOS/Apple Pencil, hosted installation, offline/multi-device behavior and complete Taiwan stroke-order compliance remain unverified or incomplete. Short review panes still require scrolling. Wait for save confirmation before advancing; no durable pending-save outbox exists.

Download `HanziMastery-0.2.3-plugin.zip` for the compiled upload package and `HanziMastery-0.2.3-source.zip` for source. Local desktop developer loading uses `npm ci`, `npm run dev`, then **Settings → Plugins → Build → Develop from localhost → http://localhost:8080/**. See `docs/TESTING.md` for exact evidence and remaining platform checks. The browser fixtures are excluded from the plugin ZIP.
