# Verification report — 2026-10-17

## 2026-10-20 optional review identity

Version 0.3.2 passes TypeScript, **83 unit/component/adapter/import tests**, all **36 Chromium/WebKit browser checks**, the production build, SDK manifest validation and ZIP/data integrity checks. SDK 0.0.46's `WidgetLocationContextDataMap[FlashcardUnder]` declares `cardId?: string`; adapters previously rejected the omitted case. New regressions cover successful binding without that field and rejection of a different Rem, reverse card and lookback. A supplied conflicting card ID remains rejected. Save and lifecycle guards still use the actual current card's ID and repetition-history timestamp.

The user reported approval and confirmed 0.3.1 on the iPhone's plugin page, while the writing review displayed only the native prompt. The public listing independently showed 0.3.1 with an Install action. In a clean, empty RemNote web demo session, the approved hosted 0.3.1 plugin installed, registered both commands, opened its workbench, created a person (rén) writing card and displayed the review and actual Hanzi Writer canvas after Begin test. That is hosted web evidence, not an iPhone acceptance test or direct observation of the phone's omitted card ID. No user cards or native SRS ratings were changed by this test.

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

- ZIP upload/marketplace approval and hosted installation. Developer loading is verified; SDK ZIP validation is a separate packaging check.
- Complete human-drawn characters and all seven characters inside the live desktop host. Real-engine full reference-path completion was verified in the standalone browser tests.
- Physical iPhone/iPad, RemNote iOS, Apple Pencil, palm rejection, rotation and app resume.
- Real multi-device sync, simultaneous offline writes, app restart persistence and cold offline plugin/asset loading.
- Recovery of an unsaved result after the host destroys its iframe or the app closes; no durable pending-save outbox exists.
- Complete Taiwan MOE order/shape compliance and calibrated geometric handwriting grading.

## Manual continuation checklist

Use an isolated document/knowledge base. Verify hosted ZIP installation, all seven characters and a word, independently corrected mistakes, accidental contact expiration, early reveal, rapid card changes, restart/save retry, and native rating history. On iOS verify finger/Pencil input, scroll versus drawing, palm contact, touch cancellation, small-screen legibility, orientation changes, audio/dictionary handoff and network interruption. Complete these checks before calling the plugin production-ready.
