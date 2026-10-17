# Research and prototype audit

Audit date: 2026-10-16. Supplied source v0.1.0 and CDN upload v0.1.1 were extracted into ignored `audit/`; originals are untouched.

## Findings

- Source used floating SDK/dependency versions and had no lockfile. Upload ZIP loaded SDK, React and Hanzi Writer via runtime CDN imports. Neither archive demonstrates host installation.
- Widget registered on every card, parsed a `WRITE:` prefix and Han characters out of the answer, and stored mastery per card rather than character. It could disclose targets in loading errors.
- Promotion reset the last qualifying date, permitting more same-day promotion credit. It lacked minimum spacing, peak mastery, accident handling, navigation tests and recovery from storage errors.
- Tests covered only basic grading. No platform test evidence was supplied.

## Supported integration decisions

Use the official React template's webpack widget/sandbox entry pattern, pinned SDK **0.0.46** and its React **17.0.2** peer dependencies. This is the published SDK version verified against npm; React 17 is intentional compatibility, not an assumption that it is the newest React.

Register a writing Powerup, a filtered `FlashcardUnder` widget, and an authoring/practice popup. Read typed widget context and cross-check `queue.getCurrentCard()`. Use hidden programmatic metadata instead of text parsing. Reject backward/cloze cards and lookback tests. Listen for queue load/reveal/exit and use a serialized polling fallback.

SDK 0.0.46 declarations include `hasRevealedAnswer`, `showAnswer`, `rateCurrentCard`, `inLookbackMode`, card repetition history, and persistent `storage.getSynced/setSynced`. The older generated web reference omits some of these. No live host acceptance test has established safe automatic grading; this release therefore suggests ratings and retains native controls. It never appends synthetic repetition history or installs a scheduler.

Writing mastery uses synced storage keyed by vocabulary Rem ID + exact Unicode character, separate from FSRS. Different skill cards reference that vocabulary Rem. SDK key-value storage has no documented atomic compare-and-swap: simultaneous offline review on different devices remains a merge limitation.

## Handwriting decisions

Hanzi Writer 3.7.3 has typed `onMistake`, `onCorrectStroke`, `onComplete`, `drawnPath.points`, `charDataLoader` and quiz cancellation. Test mode disables outlines, hints, backwards acceptance and forced acceptance. Rejections measure execution, not mental forgetting. Explicit surrender, hints or answer reveal fail recall.

`drawnPath.points` are character-space coordinates (verified in the installed implementation's Quiz/Positioner code); paths and reference medians permit an optional normalized geometric diagnostic. It is not validated handwriting assessment and does not determine a pass. The recognizer renders canonical accepted strokes, so its output is not a faithful image of the learner's penmanship.

Bundle character JSON from hanzi-writer-data 2.0.1 and its complete Arphic license. Supply an explicit loader; do not let Hanzi Writer fall back to CDN. Missing data blocks testing without revealing the target or lowering the standard. Host availability and asset caching still limit offline operation.

## Primary sources

- [Official template](https://github.com/remnoteio/remnote-plugin-template-react) — widget bundle structure and SDK validator.
- [Widgets](https://plugins.remnote.com/advanced/widgets), [Powerups](https://plugins.remnote.com/advanced/powerups), [queue reference](https://plugins.remnote.com/api/classes/QueueNamespace), [events](https://plugins.remnote.com/advanced/events).
- [Storage](https://plugins.remnote.com/advanced/storage) — synced user-level persistence.
- [Unlisted distribution](https://plugins.remnote.com/advanced/unlisted_plugins) — personal uploads still require RemNote approval.
- [Hanzi Writer docs](https://hanziwriter.org/docs.html), [source](https://github.com/chanind/hanzi-writer), [data/license](https://github.com/chanind/hanzi-writer-data).
- [Taiwan MOE](https://stroke-order.learningweb.moe.edu.tw/) — the authoritative comparison target, not the source of the bundled vectors.
- [Chinese Guru publisher](https://www.xamisoft.com/) and [Pleco iOS manual](https://iphone.pleco.com/manual/30200/flash.html) — interoperability research continues in IMPORTING.md.

## Validation boundary

Compile/type checks, core tests, component tests and browser engine tests can run here. They do not prove cross-device synchronization, iOS WebView/Pencil handling or MOE compliance. After the user opened RemNote Desktop, developer-plugin activation and authoring were tested in the live host; see TESTING.md for the final scope. Pre-existing knowledge-base content is untouched; isolated new test entries are clearly named.

The live host test exposed `app.transaction` returning without the local callback-populated ID being available. Authoring now awaits individual documented SDK writes, caches draft IDs for retry, and keeps a draft's practice direction disabled until its metadata is complete. It does not rely on that host callback behavior or claim atomic multi-Rem authoring.

SDK 0.0.46's published `Card.getRem()` implementation returns the raw API response, although its declaration promises a Rem object. Live testing exposed the missing methods. The review adapter uses `plugin.rem.findOne(card.remId)` to obtain the documented wrapper instead. Its constructor also leaves `lastRepetitionTime` unassigned, so lifecycle identity derives from repetition-history dates rather than relying on that field.
