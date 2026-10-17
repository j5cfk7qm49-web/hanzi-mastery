# Feature status and roadmap

## Implemented and automatically verified

- Pinned dependency install, lockfile, official SDK manifest validation, local JavaScript bundles, deterministic ZIP packaging and data/license checks.
- Explicit Powerup writing schema, forward-only authoring, shared vocabulary ID linkage and a development/manual practice fallback.
- Traditional-first loading; 9,574 packaged characters with all seven requested characters additionally embedded in the widget bundle. No automatic Simplified conversion.
- Responsive Hanzi Writer tests, sequential multi-character words, mistake/first-attempt tracking, limited auditable accidental-input correction, explicit forgotten-stroke failure and native-answer-reveal failure.
- Learning mode, animation/outlines/retries; frozen original results after a failed test.
- Configurable thresholds, minimum spacing, promotion counts, gentle regression with retained peak, synced-storage adapter with read-back verification and retry IDs.
- Native grade suggestions and advisory user override; RemNote retains all scheduling/rating controls.
- Pure optional geometric path diagnostics, clearly excluded from pass/fail.
- Pleco text and mapped CSV/TSV CLI converters with category/provenance retention and no scheduling-history migration.

## Implemented but requiring live acceptance

Developer installation, registration, actual card creation, correct-card loading, real accepted/rejected mouse strokes, forgotten/early-reveal failures, save read-back, guided practice, native rating controls and native review transition were verified in signed-in RemNote Desktop. Hosted ZIP installation, exhaustive lifecycle timing, app-restart/multi-device sync and iOS still need acceptance. The browser harness exercises the real Hanzi Writer engine but simulates RemNote's host. Phone-sized WebKit is not RemNote iOS or Apple Pencil verification.

## Partial or deferred

- Taiwan MOE alignment: one concrete 學 order discrepancy documented; count checks for seven characters; override registry present, verified Taiwan pack absent.
- Geometric precision: normalized trajectory/endpoint/length diagnostic only. No validated handwriting-quality score, stroke explanations or small-screen calibrated geometric thresholds.
- Additional skills: structured shared schema and native-card patterns documented; interactive translation/pinyin/tone/listening/pronunciation exercises absent.
- ChineseGuru import: no verified current export schema/sample. Generic mapping only. Pleco XML/history/audio transfer, batch UI and imported-Rem linking absent.
- Automatic native grade submission: SDK method exists, but not enabled without host acceptance/duplicate-submission validation.
- Full offline operation: no CDN dependence, but RemNote host loading, plugin-asset caching, WebView storage and synchronization are not verified offline. Non-embedded character assets load via `plugin.rootURL`; host availability still matters.
- Multi-device simultaneous writes: no SDK atomic merge; last-writer conflicts remain possible. Prototype progress migration and export/repair UI remain deferred.

## Prioritized next work

1. Finish desktop acceptance with hosted ZIP installation, complete human-written characters and a word, rapid navigation, retry/restart/offline tests and inspection of actual saved native history. Developer loading and the principal failure/rating flow already pass. Then test iPhone/iPad with Pencil/finger, palm rejection, rotation, scroll/input cancellation and interrupted network.
2. Independently audit Taiwanese sequences/glyphs for frequent TOCFL characters. Ship lawful order-only overrides where possible and a licensed Taiwan vector pack where needed, with per-character tests and visible data provenance.
3. Harden result persistence against host iframe replacement and concurrent cross-device edits, add user-visible history/backup/repair tools, and validate automatic rating submission only if it can preserve native controls and exactly-once behavior.
4. Calibrate geometry on phone/tablet samples and real learner handwriting. Evaluate spatial proportion, placement and direction separately; retain device-size tolerance. Do not call recognizer acceptance penmanship quality.
5. Add independently scheduled production, translation, pinyin and tone widgets using shared vocabulary entries. Add verified Taiwanese audio/listening, then pronunciation recording with clear privacy/permission handling.
6. Obtain actual ChineseGuru/Pleco export samples, add native adapters and previewable idempotent batch import. Keep legacy review history as provenance until a defensible scheduling migration is established. Add verified TOCFL datasets with source/version tracking.
