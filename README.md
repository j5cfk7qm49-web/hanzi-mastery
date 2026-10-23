# Hanzi Mastery 0.4.0 — RemNote Chinese study plugin

Traditional-first Chinese writing and recall reviews with progressive writing mastery. **RemNote owns scheduling. Independent recall of every stroke is mandatory.** Practice and testing are separate.

Version 0.4.0 adds **meaning → handwriting** using Hanzi Writer, **characters → meaning** self-assessment, **dictionary-assisted import**, **vocabulary lists using native parent bullets**, and pinyin, tone, character-recognition, listening and spoken-practice cards. Import automatically or preview alternate readings, then edit the study wording while retaining dictionary provenance. New translations share a bidirectional Rem with independent native schedules and results. The review modes share a centered layout and concise feedback. Speaking remains self-assessed, with optional recording. See [distribution status](docs/INSTALLATION.md) for the separately verified RemNote upload.

Version 0.3.5 supports both RemNote's Compact and beta Beautiful Queue layouts. Writing cards show just the Hanzi Mastery interface in the card content area, with the largest square that fits and native answer/rating controls below it. Detailed scoring opens separately. The user's clipped 0.3.4 screenshot was reproduced in Beautiful Queue: additional unsized wrappers left the iframe only 150px tall, and native controls overlay the card. The new layout sizes the full wrapper chain and reserves the native controls' actual height. See [layout and device-test limits](docs/IOS_LAYOUT.md) and [verification](docs/TESTING.md). Physical iPhone acceptance of this fix, Pencil behavior and full offline operation remain unverified.

## Get started

Install the approved hosted version from the [unlisted plugin page](https://www.remnote.com/plugins/hanzi_mastery_handwriting_v1). In a writing-card review, the plugin should show **Begin test**, followed by the writing square. Existing correctly tagged writing cards do not need to be recreated after an update. Check [installation and distribution status](docs/INSTALLATION.md) for the current approved/submitted versions.

For card creation on the verified Windows desktop, run **Hanzi Mastery: create writing card / practice / settings** from RemNote's command menu (`Ctrl+/`). Enter an exact Traditional target and an English prompt, create the card, open it and use RemNote's native practice action. Cards sit beneath their character/word heading in a selected list (the **Hanzi Mastery** document by default).

### Local development

Use Node 22.12+ (Node 24.17.0 tested):

```powershell
npm ci
npm run check
npm run build
npm run dev
```

In RemNote: **Settings → Plugins → Build → Develop from localhost → http://localhost:8080/**. Keep the server running for developer loading. The loopback server is for this computer; use the hosted installation for phone review.

The compiled upload archive is **`release/HanziMastery-0.4.0-plugin.zip`**. The upload package has manifest/widget bundles at its root, local stroke data, licenses and documentation. GitHub source/releases and RemNote registrations update separately; see [installation and version labels](docs/INSTALLATION.md).

## What works

- Responsive Hanzi Writer canvas; locally bundled JavaScript and data for 9,574 exact-script characters. 學、國、書、語、聽、體、愛 are also embedded in the widget bundle.
- Fitted phone review with the largest available writing square, 44px controls, app dark-theme support, optional details sheet and rotation/reflow tests inside a simulated review pane. [iOS layout and device-test limits](docs/IOS_LAYOUT.md).
- Explicit hidden writing-card metadata and shared vocabulary linkage, rather than answer-text guessing. Single characters and sequential multi-character words.
- First-attempt stroke correctness, remembered-but-misdrawn corrections, limited auditable accidental-input recovery, and mandatory failure on forgotten strokes or premature answer reveal.
- Beginner/Developing/Proficient/Mastered thresholds of 60/75/90/95%, configurable spaced promotion, gentle regression and preserved peak. Same-session practice cannot inflate mastery.
- Guided learning with outlines, animation and retries, preserving the original failed result.
- Interrupted-engine and temporary host-connection recovery preserve completed strokes and mistakes. One-click guided practice keeps and saves the original failure.
- Synced mastery storage with retry IDs and read-back confirmation. Suggested native grade and advisory override; native RemNote controls remain intact.
- Optional experimental path geometry feedback, excluded from pass/fail.
- Tested Pleco text and mapped CSV/TSV converters. Categories/provenance are retained; existing SRS history is not modified.
- Pinyin recall checks both syllable spelling and tones. Tone recall uses per-syllable choices; no tracing. Numeric tones, tone marks and ü/v/u: are supported.
- Meaning → characters uses the same Hanzi Writer canvas and checked stroke grading as writing. Characters → meaning freezes the typed first answer, then allows self-assessment of equivalent English wording. New translations share a bidirectional Rem with independent native cards, schedules and result histories.
- Preview Traditional word lists with no fixed word-count ceiling, progress, stop/resume and 25-word preview pages. Use MOE-derived readings/Chinese definitions through Moedict and CC-CEDICT English. Import automatically or optionally choose readings and edit study meanings before creating bidirectional translations and later edit the linked vocabulary/cards without changing their native histories. Source attribution, retrieval details and original definitions are retained.
- Organize vocabulary beneath ordinary RemNote bullets. Create a list in the workbench or focus an existing bullet anywhere before opening it. The outline is List → character/word → study cards, sorted by Traditional Chinese collation. Rename/move bullets natively, refresh their names/membership, or explicitly move a vocabulary entry and all its linked cards together. Reimports reuse entries within the selected list; different lists can contain the same word independently.
- Pinyin-to-character recognition presents four shuffled choices from saved vocabulary and a bundled fallback pool, rejecting shared pronunciations across dictionary and recorded readings. Correct answers and choice readings appear after submission; each skill keeps its own schedule and history.
- Listening tests dictionary-pinyin recall after reference playback. Supply an HTTPS recording or select an available local Mandarin device voice; no remote synthesis fallback is used.
- Spoken practice lets you say the word, play a reference and self-assess without recording. Optional local microphone/file comparison remains available. **Automatic spoken-pronunciation grading is not implemented**. [Speech engine research and integration plan](docs/SPEECH_ASSESSMENT.md).
- Translation directions share a bidirectional Rem; other skills use separate forward RemNote cards, hidden metadata and independently saved result history. Repeated authoring reuses the same skill card for a vocabulary entry.

## Read before studying

First-attempt recognizer correctness is **not validated penmanship precision**. The bundled sequence for **學 differs from Taiwan MOE**. No Taiwan-compliance claim is made; a per-character override registry is provided. [Taiwan stroke audit](docs/TAIWAN_STROKES.md).

Translation, pinyin, tone, pinyin-to-character and listening exercises are implemented; translation and spoken comparison are explicitly self-assessed. ChineseGuru's current export schema has not been verified; there is no claimed native importer. Full parity remains a roadmap objective. Dictionary import details and source limits are in [dictionary import](docs/DICTIONARY_IMPORT.md).

## Documentation

- [Installation and distribution](docs/INSTALLATION.md)
- [Create compatible flashcards and share vocabulary](docs/FLASHCARDS.md)
- [Grading, accident policy and spaced mastery](docs/GRADING.md)
- [Tests and exact desktop/iOS verification boundary](docs/TESTING.md)
- [iPhone/iPad layout decisions and embedded-pane tests](docs/IOS_LAYOUT.md)
- [ChineseGuru/Pleco interoperability and CLI](docs/IMPORTING.md)
- [Dictionary sources, automatic import and editing](docs/DICTIONARY_IMPORT.md)
- [Implemented/partial/deferred features and prioritized roadmap](docs/STATUS_AND_ROADMAP.md)
- [Build, source structure and persistence](docs/DEVELOPMENT.md)
- [Prototype audit and verified API sources](docs/RESEARCH.md)
- [New study cards, audio setup and speech assessment research](docs/SPEECH_ASSESSMENT.md)

## Privacy and licenses

Voice recordings remain in memory in the current review and are discarded when it closes; they are not uploaded or saved in progress history. Dictionary lookup sends only the entered words to Moedict when requested; English lookup uses the bundled CC-CEDICT snapshot. Optional reference audio is fetched from its configured HTTPS source only when played; use recordings you have permission to use. Device synthesis is limited to local voices. The plugin requests read/create/modify access to create and link Rems; it never deletes existing data or writes SRS history. RemNote manages its own storage and sync.

Hanzi Writer and the bundled pinyin-pro polyphonic dictionary are MIT; character vectors have the separate **Arphic Public License**. Complete data/license notices are included in the upload ZIP. MOE vectors/animations are not redistributed. No runtime JavaScript CDN is used. Local assets alone do not guarantee cold offline host operation or cross-device conflict-free persistence.

CC-CEDICT data is distributed unchanged under **CC BY-SA 4.0**, with attribution and its original header. MOE-derived lookup records use **CC BY-ND 3.0 TW** and remain separate from editable learner notes. See `dictionary/SOURCE.md` in the upload ZIP.
