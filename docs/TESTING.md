# Verification report — 2026-10-17

## Automated checks

Windows, Node 24.17.0, npm 11.13.0. TypeScript check passes. **59 unit/component/adapter/import tests pass** (8 test files). **10 browser tests pass** across Chromium desktop and phone-sized WebKit.

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

## Still unverified

- ZIP upload/marketplace approval and hosted installation. Developer loading is verified; SDK ZIP validation is a separate packaging check.
- Complete human-drawn characters and all seven characters inside the live desktop host. Real-engine full reference-path completion was verified in the standalone browser tests.
- Physical iPhone/iPad, RemNote iOS, Apple Pencil, palm rejection, rotation and app resume.
- Real multi-device sync, simultaneous offline writes, app restart persistence and cold offline plugin/asset loading.
- Recovery of an unsaved result after the host destroys its iframe or the app closes; no durable pending-save outbox exists.
- Complete Taiwan MOE order/shape compliance and calibrated geometric handwriting grading.

## Manual continuation checklist

Use an isolated document/knowledge base. Verify hosted ZIP installation, all seven characters and a word, independently corrected mistakes, accidental contact expiration, early reveal, rapid card changes, restart/save retry, and native rating history. On iOS verify finger/Pencil input, scroll versus drawing, palm contact, touch cancellation, small-screen legibility, orientation changes, audio/dictionary handoff and network interruption. Complete these checks before calling the plugin production-ready.
