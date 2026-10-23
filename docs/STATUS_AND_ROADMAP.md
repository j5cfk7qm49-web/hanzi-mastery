# Feature status and roadmap

## 0.4.0 release and 0.4.1 direction

Version 0.4.0 includes the authoring/import/list work and all eight refreshed review modes. Meaning → characters uses Hanzi Writer; pinyin uses standalone diacritics, and tones use four quadrants with neutral at the center. The next planned update, 0.4.1, focuses on dictionary learning glosses while retaining full source definitions.

## 2026-10-22 authoring update

Tabbed workbench with compact list management, word details, skill cards and simple writing preferences. Automatic one-click dictionary import with optional preview; missing English matches are skipped for later editing. New translations use one bidirectional Rem with separate native directions and result histories. New notes use List → character/word → cards, sorted by Traditional Chinese collation. Legacy separate translation cards retain their IDs and practice directions. Scoped review styling hides native ancestor answers while retaining native rating controls.

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
- Independently scheduled pinyin recall, dictionary-tone choices, and listening-to-pinyin cards, with first-answer checks, reveal failure, per-skill result history, retry IDs and read-back confirmation.
- Pinyin-to-character recognition with four shuffled same-length choices from saved vocabulary and a fallback pool. A bundled polyphonic dictionary plus recorded alternate readings excludes homophones and tone-only distractors. The original checked result survives study mode and native reveal.
- Both translation directions with typed first answers and explicit self-assessment for synonymous wording; independently scheduled native cards and result histories.
- Dictionary batch lookup/preview/import without a fixed word-count ceiling: progress, stop/resume, 25-word preview pages, MOE Revised readings via Moedict, a bundled unmodified CC-CEDICT English snapshot, optional alternate-reading selection, retained source provenance, resumable/idempotent bidirectional translation creation, and an editor updating linked study cards without resetting native history.
- Vocabulary lists use ordinary RemNote parent bullets, including existing external/nested bullets. Native parents determine membership; list renames/moves refresh from RemNote. Move vocabulary and linked cards together with read-back confirmation, preserving schedules/history. Reimports reuse entries within each list.
- A reusable study-card registry and authoring from an existing vocabulary entry, plus vocabulary-only creation. Audio supports an explicit HTTPS reference or an available local Mandarin device voice.
- Spoken reference comparison without requiring recording, with optional local microphone/file playback, explicitly self-assessed. Updated open-source/cloud speech-engine feasibility and objective-assessment requirements are recorded in SPEECH_ASSESSMENT.md.

## Implemented but requiring live acceptance

Developer installation, registration, actual card creation, correct-card loading, real accepted/rejected mouse strokes, forgotten/early-reveal failures, save read-back, guided practice, native rating controls and native review transition were verified in signed-in RemNote Desktop. Hosted ZIP installation, exhaustive lifecycle timing, app-restart/multi-device sync and iOS still need acceptance. The browser harness exercises the real Hanzi Writer engine but simulates RemNote's host. Phone-sized WebKit is not RemNote iOS or Apple Pencil verification.

## Partial or deferred

- Taiwan MOE alignment: one concrete 學 order discrepancy documented; count checks for seven characters; override registry present, verified Taiwan pack absent.
- Geometric precision: normalized trajectory/endpoint/length diagnostic only. No validated handwriting-quality score, stroke explanations or small-screen calibrated geometric thresholds.
- Additional skills: separate meaning-recognition native patterns remain supported; both translation directions now have typed/self-assessed exercises. Translation, pinyin, tones, character choice, listening, reference-only spoken comparison and dictionary import/edit/list flows passed a live Windows RemNote feature pass with synthetic cards. Microphone capture, learner pronunciation quality, physical iOS/Pencil input and cross-device/offline behavior remain unverified. Automatic speech recognition, acoustic tone classification, phoneme scoring and per-skill spaced mastery promotion are absent.
- ChineseGuru import: no verified current export schema/sample. Generic mapping only. Pleco XML/history/audio transfer, batch UI and imported-Rem linking absent.
- Automatic native grade submission: SDK method exists, but not enabled without host acceptance/duplicate-submission validation.
- Full offline operation: no CDN dependence, but RemNote host loading, plugin-asset caching, WebView storage and synchronization are not verified offline. Non-embedded character assets load via `plugin.rootURL`; host availability still matters.
- Multi-device simultaneous writes: no SDK atomic merge; last-writer conflicts remain possible. Prototype progress migration and export/repair UI remain deferred.

## Prioritized next work

1. Finish desktop acceptance with hosted ZIP installation, complete human-written characters and a word, rapid navigation, retry/restart/offline tests and inspection of actual saved native history. Developer loading and the principal failure/rating flow already pass. Then test iPhone/iPad with Pencil/finger, palm rejection, rotation, scroll/input cancellation and interrupted network.
2. Independently audit Taiwanese sequences/glyphs for frequent TOCFL characters. Ship lawful order-only overrides where possible and a licensed Taiwan vector pack where needed, with per-character tests and visible data provenance.
3. Harden result persistence against host iframe replacement and concurrent cross-device edits, add user-visible history/backup/repair tools, and validate automatic rating submission only if it can preserve native controls and exactly-once behavior.
4. Calibrate geometry on phone/tablet samples and real learner handwriting. Evaluate spatial proportion, placement and direction separately; retain device-size tolerance. Do not call recognizer acceptance penmanship quality.
5. Finish live acceptance of pinyin/tone/character-choice/listening and reference-only speaking cards, add licensed Taiwanese reference audio and listening comprehension, and extend sentence/grammar and translation workflows. Spoken practice remains self-assessed. Automatic assessment is exploratory again: Azure supports Taiwanese Mandarin but requires a configured cloud resource, uploaded audio and validation with learner recordings; browser transcription alone cannot establish pronunciation or tone correctness. See SPEECH_ASSESSMENT.md.
6. Obtain actual ChineseGuru/Pleco export samples and extend the dictionary batch interface to native export adapters and existing-Rem linking. Keep legacy review history as provenance until a defensible scheduling migration is established. Add verified TOCFL datasets with source/version tracking. Dictionary import currently records the Moedict retrieval time and CC-CEDICT snapshot; Moedict does not report its MOE edition.
