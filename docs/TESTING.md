# Verification report

## Final 0.4.0 release checks

TypeScript and all **136 unit/component tests across 18 files** pass. Final browser results and release checksums are recorded in the release test report. The final input controls use standalone diacritics, no neutral-mark toolbar button, and a four-quadrant tone square with a central neutral choice. Umlaut entry changes an entered u to ü and retains an existing tone.

The October 22 Windows RemNote acceptance pass covered all eight modes, including real Hanzi Writer strokes for both writing and meaning → characters, four-option recognition and successful reference-audio playback. Synthetic test cards were disabled again. Phone-sized Chromium/WebKit fixtures verify geometry and controls, not the physical RemNote iPhone app. Microphone capture and pronunciation quality remain unverified.

Earlier candidate validation is retained below as historical evidence. Its not-uploaded statements describe those earlier runs; current distribution status is in INSTALLATION.md.

## 0.4.0 translation, dictionary import, native lists and editing

TypeScript and **126 unit/component/adapter/import tests across 17 files** pass. All **80 covered Chromium/WebKit browser scenarios** pass across the full run and one targeted retry: an overlapping screenshot run removed a trace-output file during handwriting-test cleanup, after the assertions completed. Isolating the screenshot output and rerunning that WebKit scenario passed. The checks include handwriting/layout regressions, both typed translation directions, source-backed import, source-preserving editing, idempotent reimport and native list bullets. A preceding focused run passed all 12 compiled SDK checks. Dictionary tests cover actual bundled CC-CEDICT data, reading-aware English matching, explicit Taiwan pronunciation annotations, absent/mismatched entries, preview selection for polyphones, partial import/save failures, retry reuse, preservation of edits on reimport and no changes to existing native practice directions or parent locations. Translation tests cover hidden targets/meanings, missing optional pinyin, frozen first answers, synonym-aware self-assessment, premature reveal failure and native reveal after intentional comparison.

New list/batch coverage accepts 251 input words, streams a 61-word lookup across batch boundaries, cancels/resumes remaining requests, paginates/imports 61 rows across every page, and preserves edited preview data while stopping/resuming imports. Service checks cover native renames and external parent bullets, per-list identities, native moves with stale retry indexes, legacy flat-import reuse, one inventory scan per batch, linked writing/recall moves without schedule changes, partial-move retries and descendant-destination refusal. Compiled SDK tests create/select ordinary list bullets, import beneath them, move vocabulary/cards together, detect a native move on refresh and place a new tone card under the actual parent. List controls were visually inspected at a narrow width.

The compiled SDK browser test loads the actual compressed CC-CEDICT snapshot, previews a synthetic MOE response, creates a vocabulary entry and both translation cards, edits the English wording, verifies original MOE definitions remain intact and reimports without creating extra Rems. These host RPC responses and MOE fixtures are simulated. Separately, live Chromium browser CORS checks returned HTTP 200, exact headwords and definitions for 學習 (xué xí / xué xi), 行 (xíng / xìng / háng / hàng) and 垃圾 (lè sè) from Moedict on 2026-10-21. The mirror does not report its underlying MOE edition.

Production build, SDK manifest validation and ZIP/data checks pass. Packaging verifies the committed CC-CEDICT source SHA256 and includes its unchanged header and attribution, alongside 9,574 writing character records. The local candidate is not uploaded to RemNote or published to GitHub. Physical iOS remains outstanding. The preceding automated checks changed no user knowledge-base notes or ratings. See DICTIONARY_IMPORT.md for source/edition limitations and edit behavior.

On October 21–22, the 0.4.0 production assets were also tested in the signed-in RemNote Windows app using an isolated local plugin identity and namespaced Powerups, alongside the hosted 0.3.5 installation. Live checks covered all eight study skills; correct/incorrect answers and early reveal; first-answer freezing and saved histories; real MOE/CC-CEDICT lookup and provenance; 80 words across four preview pages; lookup stop/resume with edits retained; import stop after five entries and resume of the remaining fifteen without recreating existing Rems; ordinary/nested list bullets, rename/refresh and linked-card moves; independent imports of the same word into separate lists; manual Traditional/Simplified authoring; invalid/valid settings and restoration; successful HTTPS reference playback and optional WAV file input. Compact and Beautiful writing layouts both accepted input and preserved results during guided practice, with native controls visible. Only synthetic test notes/cards and their ratings were changed. Local Mandarin voices were unavailable; microphone capture, learner pronunciation quality, physical mobile input and cross-device/offline synchronization were not established.

The live pass found and corrected Compact-only rating-button wording, moved Import beside progress/Stop above the preview, and cleared stale batch messages when changing lists. TypeScript and all 126 tests passed after the writing wording change; 23 relevant component checks passed after moving Import, and all five dictionary component checks passed after clearing stale messages. The local detailed acceptance report is excluded from the distributable ZIP.

## Initial 0.4.0 character recognition and reference comparison

TypeScript and **101 unit/component/adapter/import tests across 13 files** pass. All **70 browser checks** in the full run pass across desktop Chromium and phone-sized WebKit, covering writing/layout regressions and the new character-choice and reference-only speaking flows. After adding the bundled pinyin-pro ambiguity guard, **18 focused SDK/study browser checks** pass, including two new compiled-workbench scenarios: **72 distinct browser scenarios** are covered across these runs. The compiled workbench uses the real SDK against simulated RPC responses to read vocabulary through the Powerup, exclude an unrecorded 行/xíng reading when only 行/háng is saved, create an unambiguous native question, and reuse the same recognition Rem.

New unit coverage checks homophones, tone-only differences, target/distractor alternate readings, dictionary-only polyphones, conservative multi-character reading combinations, invalid/missing metadata, insufficient pools, hidden answer/meaning text, stable option order through interruption, first-answer freezing, native-reveal races and independent result histories. Speaking can finish self-assessment without microphone/file input, while success remains blocked until reference playback completes. Phone screenshots of recognition, tones and reference-only speaking were visually inspected at 393×852.

Production build, official manifest validation and ZIP/data integrity pass. The archive includes the MIT pinyin-pro license; the dictionary is included in the workbench bundle while writing/review bundles remain free of its payload. Existing local character assets retain 9,574 exact records. Version 0.4.0 has not been uploaded to RemNote or published to GitHub. These are automated host simulations and visual checks, not live RemNote new-skill acceptance or physical iOS acceptance. Synthetic WAV fixtures test media/UI behavior; Windows WebKit still exercises playback failure and blocked success rather than successful native audio. No learner speech or automatic pronunciation service has been assessed.

## 0.3.5 Compact and Beautiful Queue

After the user reported a clipped 0.3.4 iPhone review, the same hosted bundle was opened in an isolated Guest KB with beta Beautiful Queue enabled. At a 393×852 browser viewport the actual writing iframe was 295×150. The native prompt remained visible, and the centered start controls were clipped. DOM inspection showed extra beautiful-queue-insight-scroll-layout, beautiful-queue-card-scroll-stage and beautiful-queue-card-content wrappers that the earlier direct-child sizing skipped. The native bottom controls are absolutely overlaid inside this mode's card. The user independently identified Beautiful Queue as the trigger and requested both modes with only the plugin UI in writing cards.

A fixture using the observed nesting/overlay reproduces the clipping: the new WebKit regression fails on 0.3.4 before the fix. Version 0.3.5 sizes the complete content branch, hides its non-writing content, and reserves the actual native control height. The primary controls are checked for overlap as well as frame bounds. Both modes cover seven viewport/pane sizes, ready/test/result/practice/native reveal, unrelated-plugin isolation, rotation/details with recorded strokes and enlarged text. A separate 150px bootstrap-frame case keeps both start choices reachable. TypeScript, all **86 unit/component/adapter/import tests**, all **66 Chromium/WebKit browser checks**, SDK manifest validation, production build and ZIP/data integrity pass locally. The package contains 405 entries, 353 local character-data groups and 9,574 exact character records.

RemNote displayed a fresh upload success notice for the exact 0.3.5 ZIP (SHA256 398204a02509cf6cccad410439e424cccdccae95f0bfe011140853d85371d93c), and Check for Updates changed the isolated Guest installation to hosted 0.3.5. At the same 393×852 browser viewport, Beautiful Queue now uses a 359×602 frame with a 343×343 square; Compact uses a 385×610 frame with a 369×369 square. Both parent panes and plugin documents had scrollHeight equal to their height, and the native prompt/breadcrumbs were absent. Beautiful Queue's native controls started directly below the iframe; after reveal, the frame resized to 576px for the taller rating group without scrolling or overlap. Ready, test, reveal/failure, save read-back, details/focus return and guided practice were verified in the hosted Beautiful Queue. Its first-review tutorial tooltip required keyboard activation of Practice. Compact ready and writing were also verified after returning the Guest KB to its original mode. No native SRS rating was submitted and no user KB cards were modified. Physical iPhone acceptance remains required.


The clean [GitHub Actions run for source commit 2d26e5b](https://github.com/j5cfk7qm49-web/hanzi-mastery/actions/runs/39695405753) also passed TypeScript, all 86 tests, all 66 browser checks and package validation.

## 0.3.4 fitted handwriting review

The user confirmed that uninstalling and reinstalling restored the plugin on iPhone and supplied a screenshot of a working but heavily scrolled review. The redesign scopes host CSS to the writing iframe in the observed RemNote queue DOM, removes the duplicated native prompt/padding, and measures the largest square inside the remaining iframe area. Native answer/rating controls remain outside the changed content area.

New layout checks cover 320×568, 375×667, 393×852, 430×932 dark, 844×390 landscape, 768×1024 and a 320px split pane. Each checks ready, test, saved result, guided practice, and native rating visibility, with no frame/parent scrolling and all visible action targets inside bounds. Additional checks cover unrelated-plugin CSS isolation, accepted strokes through rotation/details, focus return, and enlarged text. Optional details can scroll within their own sheet. These model host geometry rather than native iOS; physical acceptance of the redesign remains required.

TypeScript, all **86 unit/component/adapter/import tests**, all **44 Chromium/WebKit browser checks**, production build, official SDK manifest validation and ZIP/data integrity checks pass locally. The package contains 405 entries, 353 character-data groups and 9,574 exact character records. Physical acceptance of the new layout remains required.


The clean [GitHub Actions run for source commit 7fc2d4b](https://github.com/j5cfk7qm49-web/hanzi-mastery/actions/runs/39558819019) also passed all 86 tests, 44 browser checks and package validation. RemNote displayed a fresh upload success notice, the public page exposes 0.3.4, and an isolated Guest web installation updated from hosted 0.3.3 to 0.3.4. Live verification at a 393×852 browser viewport measured a 375×610 iframe and a 359×359 square in an available 359×471 canvas area. Both the parent pane and iframe document had scrollHeight equal to their height and scrollTop 0. Ready, test, details/focus return, failure/save read-back, guided practice with the original result, and native answer/rating controls worked. No user KB cards or native SRS ratings were changed; test writing history was saved only in the isolated Guest KB. This phone-sized web check does not establish native iPhone acceptance of the redesign.

## 2026-10-20 compiled widget startup

The user confirmed that 0.3.2 still left the iPhone card completely blank, with no waiting message. The actual compiled 0.3.2 writing widget was then loaded with SDK 0.0.46 in WebKit at a non-trustworthy HTTP test origin. The browser reported `isSecureContext: false`, `typeof crypto.randomUUID: "undefined"` and `typeof crypto.getRandomValues: "function"`. The SDK activated, but `subscribeReview` threw `TypeError: crypto.randomUUID is not a function` before the first settings/card read, and React unmounted the widget. The captured body text was empty. This reproduces the screenshot's blank-view failure in the real bundle rather than an adapter mock.

Version 0.3.3 uses cryptographically random UUIDs built from `getRandomValues` for listeners and both writing/study result IDs. It adds a React error boundary around review/workbench views. New browser tests exercise the production HTML, compiled bundles, actual SDK activation and message transport with HTTPS plugin files inside a non-trustworthy HTTP parent. The browser itself withholds `randomUUID`; it is not stubbed. Only the RemNote host's RPC responses are simulated. All six new checks pass across Chromium and WebKit, covering index registration, opening the real handwriting canvas, saving/read-back of a forgotten-stroke failure, and saving/read-back of a first pinyin answer. `npm run test:browser` now builds production bundles before the test fixtures, preventing stale startup tests. TypeScript and all 86 unit/component/adapter/import tests pass, including render/effect error-boundary coverage.

A separate comparison loaded the exact published 0.3.2 ZIP and the 0.3.3 build in that same HTTPS-child/non-secure-parent WebKit fixture. Version 0.3.2 produced the randomUUID exception, empty body text and zero card reads; 0.3.3 opened the actual canvas without page errors. Local JSON and screenshots of both cases are retained in the ignored audit directory.

The iPhone's actual secure-context/API state has not been inspected; this is a reproduced crash consistent with the report, not proof that this is the phone's only failure. Physical RemNote iOS acceptance still remains necessary. API availability is documented by [Mozilla for randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) and [getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues).

The complete local validation passed after the fix: **86 unit/component/adapter/import tests in 12 files and all 42 Chromium/WebKit browser checks**, including the six production-bundle startup checks. TypeScript, the production build, official SDK validator and ZIP/data integrity checks passed. The package still contains 405 entries, 353 data groups and 9,574 exact character records. Physical iPhone confirmation is separate from these results.

On October 20 at approximately 23:10 America/Los_Angeles (October 21 UTC), RemNote showed a new successful-upload notice for 0.3.3. The public page displayed 0.3.3, and Check for Updates changed the isolated Guest web installation from 0.3.2 to the hosted 0.3.3 index bundle. The existing person (rén) card loaded its 0.3.3 review, showed Begin test and opened the actual Hanzi Writer canvas without card recreation. No user knowledge-base cards or native SRS ratings were changed. This normal hosted check is separate from the startup comparison and native iPhone acceptance.

The [clean GitHub Actions run for submitted commit 30269e7](https://github.com/j5cfk7qm49-web/hanzi-mastery/actions/runs/39553545160) also passed TypeScript, all 86 tests, all 42 browser checks and production/package validation.

## 2026-10-20 optional review identity

Version 0.3.2 passes TypeScript, **83 unit/component/adapter/import tests**, all **36 Chromium/WebKit browser checks**, the production build, SDK manifest validation and ZIP/data integrity checks. SDK 0.0.46's `WidgetLocationContextDataMap[FlashcardUnder]` declares `cardId?: string`; adapters previously rejected the omitted case. New regressions cover successful binding without that field and rejection of a different Rem, reverse card and lookback. A supplied conflicting card ID remains rejected. Save and lifecycle guards still use the actual current card's ID and repetition-history timestamp.

The user reported approval and confirmed 0.3.1 on the iPhone's plugin page, while the writing review displayed only the native prompt. The public listing independently showed 0.3.1 with an Install action. In a clean, empty RemNote web demo session, the approved hosted 0.3.1 plugin installed, registered both commands, opened its workbench, created a person (rén) writing card and displayed the review and actual Hanzi Writer canvas after Begin test. That is hosted web evidence, not an iPhone acceptance test or direct observation of the phone's omitted card ID. No user cards or native SRS ratings were changed by this test.

The [clean GitHub Actions run for submitted commit b1ea5c1](https://github.com/j5cfk7qm49-web/hanzi-mastery/actions/runs/39442588124) also passed. After uploading 0.3.2 on October 20, the public plugin page displayed 0.3.2 and **Check for Updates** changed the isolated web installation from 0.3.1 to 0.3.2, loading the hosted 0.3.2 index bundle. The existing person card then loaded the versioned 0.3.2 review widget, displayed Begin test and opened the actual Hanzi Writer canvas. No card recreation, user knowledge-base changes or native SRS rating was involved. This confirms that the update is distributable and its web review loads; native iPhone behavior remains unverified.

## 2026-10-19 grouped character assets

Version 0.3.1 passes TypeScript and **81 unit/component/adapter/import tests**. The build verifies all 9,574 exact character records against the grouped package data and validates the SDK manifest and ZIP. The archive contains 405 files, including 353 character-data groups, at approximately 13.51 MiB. Two focused browser checks pass in Chromium and phone-sized WebKit: a character outside the seven embedded examples loads from the actual generated assets, accepts its strokes and saves a passing result. Missing exact records are covered by a unit test and block grading. These checks do not establish actual RemNote iOS or hosted installation.

The clean [GitHub Actions run for submitted commit e419e39](https://github.com/j5cfk7qm49-web/hanzi-mastery/actions/runs/39373520677) subsequently completed successfully: all **81 tests and all 36 browser checks** passed, along with TypeScript, production build and package validation. The initial local full run's two new asset checks had used an incorrect expected URL; the corrected focused rerun and the complete clean CI run passed. An October 20 phone screenshot showing a 0.2.0 entry is evidence of displayed metadata only, not acceptance of the hosted 0.3.1 plugin.

## 2026-10-19 study-skill increment

Version 0.3.0 passes TypeScript and **80 unit/component/adapter/import tests** across 11 files. The 28 existing browser checks passed, and six new study-skill checks passed in a focused rerun after adapting the Windows WebKit media expectations. These cover pinyin/tone answers, hidden listening targets, playback prerequisites and explicitly self-assessed spoken comparison. Chromium verifies completed WAV playback; Windows WebKit rejects the fixture and verifies error reporting and blocked success grading. See [study-skill verification](STUDY_SKILL_VERIFICATION.md) for the boundary: synthetic audio exercises media/UI behavior, not Mandarin speech accuracy. New study skills have not yet been accepted in the live RemNote host. Automatic speech recognition and pronunciation grading are not bundled; [the source audit](SPEECH_ASSESSMENT.md) identifies candidate engines and validation work.

## Automated checks

Windows, Node 24.17.0, npm 11.13.0. TypeScript check passes. **60 unit/component/adapter/import tests pass** (8 test files). **28 browser tests pass** across Chromium desktop and phone-sized WebKit.

| Requirement | Evidence |
| --- | --- |
| A: Beginner 80% pass | Pure grading test: 8/10 first attempts, two independent corrections, 60% threshold. |
| B: Mastered 80% fail | Same attempt frozen at 95%; no retroactive lowering. |
| C: forgotten stroke | Automatic failure tested at all four levels, plus reveal/practice failure and actual desktop controls. |
| D: accidental input | Latest-event/time-window/limit policy; original errors and raw score retained. Genuine earlier errors stay counted. |
| E: promotion | 2+2+3 qualified reviews, separate dates/minimum spacing, duplicate IDs and promotion-day repeat blocked. |
| F: regression | Three separated failures lower only one level; peak and failed historical threshold retained. |
| G: Traditional | Seven exact characters' counts/data verified; real engine accepts all seven reference paths in both browser projects. |
| H: lifecycle | Stale callbacks ignored, cancellation/unmount cleanup, multi-character sequencing, wrong-card save blocked, real native rating transition resets the widget. |

Other coverage includes load failure/retry, invalid settings, corrupt storage, write failure/read-back ambiguity, new repository instances, same-process concurrent writes, learning-only behavior, hidden targets in question DOM, no auto hints/forced acceptance, local asset root, script-form selection, geometry diagnostics, documented Pleco text/CSV mapping and safe card authoring.

The v0.2.1 regression pass adds engine-error recovery on the second character without erasing earlier errors, host read failure/pause/reconnect without unmounting the attempt, irreversible answer reveal despite stale reads, repeated-character worst-result deduplication, completing a verified save batch across React unmount, same-card/new-review rejection, authoring fields locked during async validation, settings read-back mismatch and one-click practice/failure saving. Real-engine browser cases additionally complete a word across simulated host interruption and verify adjusted versus raw accuracy after a declared accident. The browser harness rebuilds automatically before every run.

The v0.2.2 pass adds 16 embedded-layout cases across both browser projects: 320/375/430px phone widths, landscape, iPad, a 320px pane within a wider viewport, long prompts, dark mode, enlarged text, rotation with an accepted stroke and separate simulated native controls. Bounds checks include no horizontal overflow, square canvas, scroll margins, 44px control targets, settled iframe height and reachable controls. Screenshots were visually inspected. A component regression verifies that touch input cancels delayed auto-scroll. See [the iOS layout report](IOS_LAYOUT.md).

The v0.2.3 test pass found a live-host issue that the earlier assertions missed: the failed result existed in the DOM while its heading/save confirmation were clipped above the queue pane. A regression test reproduced it before the fix in Chromium, then passed after the fix in both engines. It checks the actual heading and save-status bounds inside a short parent review pane without manually scrolling the result into view. Result reveal shares the canvas's input-cancelled delayed adjustment and does not take keyboard focus.

Browser tests use real Hanzi Writer and JSON data. The queue host is simulated. Reference paths are generated input, not samples of human writing. Touch tests dispatch synthetic touch-shaped events because WebKit does not expose a constructible `Touch` in this automation environment; they check event handling/cancellation, not physical touchscreen/Pencil behavior. Browser reload verifies stored test-event ledgers and progress survive a new page session.

## Live RemNote Desktop

After the user opened the signed-in desktop app, the plugin was loaded using **Settings → Plugins → Build → Develop from localhost**. Verified:

- Manifest accepted and plugin active in sandbox mode; registered command opens the actual workbench.
- Actual SDK authoring creates a vocabulary entry, hidden writing metadata, forward-only card and neutral Hanzi Mastery document.
- The correct card's English prompt appears on the question side with no target character/outline.
- A real mouse drag is accepted as the first stroke of 國. An intentionally wrong following drag records one rejection while keeping the attempt active.
- **I forgot a stroke** produces a failed result and Again suggestion; synced storage reports successful save/read-back.
- Native **Show Answer** leaves the original result intact and displays all four native rating controls.
- Guided practice shows the character outline while preserving the failed result.
- Clicking native **Forgot** is accepted by RemNote; the next presentation resets the widget to Begin test.
- Revealing the native answer during a fresh unfinished attempt causes **answer revealed** failure and a confirmed mastery save.

The live test caught and fixed two SDK integration issues missed by mocks: transaction callback completion and the unwrapped `Card.getRem()` response. The adapter tests now model the latter accurately, and authoring no longer assumes a working transaction callback.

The isolated test entries are named **Hanzi Mastery acceptance test: study/country**. The earlier study entry was created before neutral-document organization was added; the country entry is under Hanzi Mastery. Pre-existing notes/cards were not edited. One native Forgot rating was applied only to the isolated country test card. Test artifacts remain available for inspection.

On 2026-10-17 the v0.2.1 developer build was exercised again on the isolated country card: compact first-attempt feedback and test-ending controls render above the canvas; one click enters guided practice, preserves a prominent original-failure message, and confirms the synced failure save/read-back. This pass exited without submitting another native SRS rating.

The v0.2.2 build was retested in signed-in RemNote Desktop on 2026-10-17. The question kept its character hidden, a real mouse stroke was accepted, a deliberately wrong stroke recorded a rejection without failing the test, explicit forgetting produced failure/Again, synced mastery save/read-back succeeded, and guided practice displayed the outline while retaining the failure. This pass found the clipped result heading described above. No native SRS rating was submitted in this pass.

The rebuilt v0.2.3 bundle was then loaded in the same real desktop queue. A mouse stroke was accepted again. Clicking native **Show Answer** before completion produced an **answer revealed** failure and a confirmed save/read-back. The failure heading and save status were now visibly inside the review pane without manual scrolling. All four native ratings remained available. Guided practice displayed the outline and retained the original failure. This pass also submitted no native SRS rating; only isolated test-entry plugin mastery records were written.

The original v0.2.2 ZIP rebuilt byte-for-byte with SHA-256 `c0df9fff19b41717f6a7edc523316a1c924715e6edb41188e6867d83a1c54cf1` before the fix. The new manifest and production ZIP validate as v0.2.3. In this restricted Windows session, an initial managed browser-server shutdown stalled after its assertions; the final complete 28-test run used an independently started loopback fixture server and exited successfully. No product workaround was required.

Native RemNote iOS remains unverified. The iframe fixture models available space and scrolling without claiming to reproduce RemNote iOS chrome or its safe-area/keyboard handling.

## Still unverified

- Physical iPhone acceptance of the available hosted 0.3.2 update. Upload and hosted web installation/update are verified separately from SDK ZIP validation.
- Complete human-drawn characters and all seven characters inside the live desktop host. Real-engine full reference-path completion was verified in the standalone browser tests.
- Physical iPhone/iPad, RemNote iOS, Apple Pencil, palm rejection, rotation and app resume.
- Real multi-device sync, simultaneous offline writes, app restart persistence and cold offline plugin/asset loading.
- Recovery of an unsaved result after the host destroys its iframe or the app closes; no durable pending-save outbox exists.
- Complete Taiwan MOE order/shape compliance and calibrated geometric handwriting grading.

## Manual continuation checklist

Use an isolated document/knowledge base. Verify hosted ZIP installation, all seven characters and a word, independently corrected mistakes, accidental contact expiration, early reveal, rapid card changes, restart/save retry, and native rating history. On iOS verify finger/Pencil input, scroll versus drawing, palm contact, touch cancellation, small-screen legibility, orientation changes, audio/dictionary handoff and network interruption. Complete these checks before calling the plugin production-ready.
