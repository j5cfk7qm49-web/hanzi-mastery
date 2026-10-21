# Hanzi Mastery 0.3.5 pre-release

Support both Compact and beta Beautiful Queue, presenting only the Hanzi Mastery interface inside writing cards. The user's 0.3.4 clipping was reproduced in the actual hosted Beautiful Queue: its extra insight/stage/content wrappers were not sized, so the iframe resolved to the browser's 150px default. Native answer controls also overlay that mode's card. Size every wrapper along the writing iframe's content branch, suppress duplicate native prompt/context/statistics/insight content only in these writing cards, and put the existing Beautiful Queue answer controls in normal flow so their actual height is reserved. Compact mode keeps its native controls.

Move Begin test to the bottom control row so it remains reachable even in a short initial frame. Keep the maximum fitted square, recorded-stroke recovery, saved outcomes, grading and native scheduling. Expanded browser fixtures use the observed Beautiful Queue nesting and overlay structure as well as Compact mode. The new regression fails on the previous code. Physical iPhone acceptance of 0.3.5 remains required.

Validation: TypeScript, 86 unit/component tests, 66 Chromium/WebKit browser checks, SDK manifest validation and ZIP/data integrity pass.

## Previous 0.3.4 fitted review

Fit handwriting review to the available RemNote card area. Remove the duplicated native question and padding only in cards containing this plugin's writing iframe. Keep the native answer/rating controls. Use one compact prompt/status bar, the largest square allowed by both width and height, and a 44px control row. Landscape uses a side-by-side layout. Ready, test, result and guided practice fit without scrolling in the covered viewport sizes; detailed scoring and advisory rating choices open in an optional sheet.

Fitted canvases no longer stop at the workbench's configured size cap. Resizing and opening details retain accepted strokes and recorded errors. Practice keeps the original test outcome and save state visible. Honor RemNote's app dark theme as well as the OS preference. The plugin still requires explicit Begin test and native SRS rating submission.

The user confirmed that uninstalling and reinstalling restored the iPhone widget before this redesign. That confirms startup on their device, without identifying the sole cause of the earlier blank view. The new layout still requires physical iPhone acceptance. Host styling is scoped to the observed RemNote queue classes and handwriting iframe; a future host DOM change may require an adjustment. See [layout](IOS_LAYOUT.md) and [validation](TESTING.md).

Validation: TypeScript, 86 unit/component tests, 44 Chromium/WebKit browser checks, SDK manifest validation and ZIP/data integrity pass.

## Previous 0.3.3 startup fix

Fix a startup crash reproduced with the exact published 0.3.2 ZIP. In WebKit, the compiled widget and real SDK activate, but an unavailable `crypto.randomUUID()` throws before the first card read and React clears the view. The comparison also reproduces this with HTTPS plugin files under a non-trustworthy parent. The same test opens the writing canvas with 0.3.3. Native iPhone API state has not been inspected; this is a confirmed crash matching the reported symptom, with physical device acceptance still outstanding.

Generate listener and writing/study-result UUIDs from `crypto.getRandomValues()`, which does not require a secure context. Preserve cryptographic randomness and existing result-ID formatting. Add a boundary that shows HM-START for caught render/effect startup failures. New tests use production HTML/bundles and the actual SDK message transport, with simulated RemNote host responses, to cover index registration, handwriting canvas and result persistence, and first-answer pinyin persistence. Earlier browser fixtures mocked the plugin context and did not exercise this startup path.

## Previous 0.3.2 review identity fix

Fix a review-binding bug consistent with a blank mobile writing card. The pinned SDK declares the widget's `cardId` optional, but the writing and study adapters previously rejected every widget that omitted it. Bind to the required matching Rem and the current forward card when that optional ID is absent; still reject a conflicting supplied card ID, another Rem, reverse reviews and lookback. Result saving and stale-review checks remain bound to the actual queue card ID and review time.

Show a waiting status while a registered review widget cannot bind, instead of rendering an empty iframe. Existing correctly tagged cards do not need recreation. TypeScript, 83 unit/component/adapter/import tests, all 36 Chromium/WebKit browser checks, production build, SDK validation and ZIP/data integrity checks pass. Physical iPhone confirmation remains required; the screenshot did not expose its actual widget context, so this is a verified API-contract fix rather than a claim that the device's cause has been observed directly.

The approved 0.3.1 hosted plugin was installed in an empty RemNote web demo knowledge base. Its commands, workbench, generated person (rén) card, Begin test control and actual Hanzi Writer canvas all loaded. No native SRS rating was submitted and no user knowledge-base cards were modified during that hosted test.

## Previous 0.3.1 asset packaging

Group the 9,574 exact character records into small local JSON bundles to reduce the number of files processed by RemNote's uploader. Version 0.3.0's upload returned a server timeout and a retry reported that version already existed; neither response established a completed review submission. Character keys/data, script selection and offline asset inclusion are preserved. Missing records still block grading rather than substituting another character.

The patch passes TypeScript, 81 unit/component/adapter/import tests, SDK/ZIP validation and a focused packaged-data browser check in both Chromium and phone-sized WebKit. Its archive contains 405 files rather than 9,626. Actual RemNote iOS and hosted installation still require acceptance testing.

## Study skills introduced in 0.3.0

Add independently scheduled pinyin, tone and listening exercises linked to shared vocabulary entries.

- Check the first pinyin answer for both spelling and tones, accepting tone marks or numbered syllables and common spellings of ü.
- Test dictionary-tone recall with per-syllable choices and listening-to-pinyin recall after reference audio playback.
- Create or reuse separate native forward cards for each skill from the vocabulary workbench. Preserve first results through answer reveal, study mode and save retries.
- Support an HTTPS reference recording or an available local Mandarin device voice. Spoken recording/file comparison is optional and explicitly self-assessed; recordings remain in memory and are not uploaded. Automatic speech recognition and pronunciation grading are outside the current requirements.
- Preserve existing independent handwriting recall, mastery progression, Traditional character data and native RemNote rating controls.

TypeScript and 80 unit/component/adapter/import tests pass. Browser and live-host verification boundaries are recorded in `docs/TESTING.md` and `docs/STUDY_SKILL_VERIFICATION.md`. The new skill cards still require live-host acceptance, and actual RemNote iOS/Pencil operation, hosted installation, offline behavior and cross-device progress remain unverified.

The unlisted upload package is `release/HanziMastery-0.3.1-plugin.zip`. The manifest enables mobile use and requests sandboxed read/create/modify access. RemNote retains scheduling; the plugin does not delete existing notes or submit native ratings automatically. Installation instructions and the required RemNote approval process are in `docs/INSTALLATION.md`.

## Previous 0.2.3 handwriting fixes

Fix a result-display issue found by testing the new plugin in RemNote Desktop.

- After finishing a scrolled handwriting test, its result heading and save confirmation could remain clipped above the queue pane. The result and persisted mastery were correct, but the feedback was easy to miss.
- Bring the result heading into view after the host finishes resizing. Share the canvas's input-cancelled delayed adjustment without taking keyboard focus from RemNote.
- Add a regression that fails before the fix and checks actual heading/save-status bounds inside a short review pane in Chromium and WebKit. Grading and scheduling behavior are unchanged.

Verification: TypeScript, **60 unit/component/adapter/import tests**, **28 Chromium/WebKit browser tests**, official SDK manifest validation and ZIP integrity checks. Live RemNote Desktop testing confirmed accepted/rejected strokes, explicit-forgetting failure, early native-reveal failure, synced mastery read-back, retained failure in guided practice, and the corrected result position. No native SRS rating was applied during this test pass. The original v0.2.2 ZIP was also rebuilt byte-for-byte before the fix.

RemNote retains native rating controls and scheduling. Real RemNote iOS/Apple Pencil, hosted installation, offline/multi-device behavior and complete Taiwan stroke-order compliance remain unverified or incomplete. Short review panes still require scrolling. Wait for save confirmation before advancing; no durable pending-save outbox exists.

Download `HanziMastery-0.2.3-plugin.zip` for the compiled upload package and `HanziMastery-0.2.3-source.zip` for source. Local desktop developer loading uses `npm ci`, `npm run dev`, then **Settings → Plugins → Build → Develop from localhost → http://localhost:8080/**. See `docs/TESTING.md` for exact evidence and remaining platform checks. The browser fixtures are excluded from the plugin ZIP.
