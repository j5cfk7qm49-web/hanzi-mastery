# Hanzi Mastery 0.3.5 — RemNote Chinese study plugin

Traditional-first Chinese writing reviews with progressive mastery. **RemNote owns scheduling. Independent recall of every stroke is mandatory.** Practice and testing are separate.

Version 0.3.5 supports both RemNote's Compact and beta Beautiful Queue layouts. Writing cards show just the Hanzi Mastery interface in the card content area, with the largest square that fits and native answer/rating controls below it. Detailed scoring opens separately. The user's clipped 0.3.4 screenshot was reproduced in Beautiful Queue: additional unsized wrappers left the iframe only 150px tall, and native controls overlay the card. The new layout sizes the full wrapper chain and reserves the native controls' actual height. See [layout and device-test limits](docs/IOS_LAYOUT.md) and [verification](docs/TESTING.md). Physical iPhone acceptance of this fix, Pencil behavior and full offline operation remain unverified.

## Get started

Install the approved hosted version from the [unlisted plugin page](https://www.remnote.com/plugins/hanzi_mastery_handwriting_v1). In a writing-card review, the plugin should show **Begin test**, followed by the writing square. Existing correctly tagged writing cards do not need to be recreated after an update. Check [installation and distribution status](docs/INSTALLATION.md) for the current approved/submitted versions.

For card creation on the verified Windows desktop, run **Hanzi Mastery: create writing card / practice / settings** from RemNote's command menu (`Ctrl+/`). Enter an exact Traditional target and an English prompt, create the card, open it and use RemNote's native practice action. Cards and vocabulary are siblings under a neutral **Hanzi Mastery** document.

### Local development

Use Node 22.12+ (Node 24.17.0 tested):

```powershell
npm ci
npm run check
npm run build
npm run dev
```

In RemNote: **Settings → Plugins → Build → Develop from localhost → http://localhost:8080/**. Keep the server running for developer loading. The loopback server is for this computer; use the hosted installation for phone review.

The compiled upload archive is **`release/HanziMastery-0.3.5-plugin.zip`**. The upload package has manifest/widget bundles at its root, local stroke data, licenses and documentation. GitHub source/releases and RemNote registrations update separately; see [installation and version labels](docs/INSTALLATION.md).

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
- Listening tests dictionary-pinyin recall after reference playback. Supply an HTTPS recording or select an available local Mandarin device voice; no remote synthesis fallback is used.
- Spoken practice records or opens a local audio clip for reference comparison. Its results are explicitly self-assessed; **automatic spoken-pronunciation grading is not implemented**. [Speech engine research and integration plan](docs/SPEECH_ASSESSMENT.md).
- Each additional skill uses a separate forward RemNote card, hidden metadata and independently saved result history. Repeated authoring reuses the same skill card for a vocabulary entry.

## Read before studying

First-attempt recognizer correctness is **not validated penmanship precision**. The bundled sequence for **學 differs from Taiwan MOE**. No Taiwan-compliance claim is made; a per-character override registry is provided. [Taiwan stroke audit](docs/TAIWAN_STROKES.md).

Recognition and translation retain native-card patterns. Pinyin/tone/listening exercises are implemented; spoken comparison is an interim tool, not a speech recognizer. ChineseGuru's current export schema has not been verified; there is no claimed native importer. Full parity remains a roadmap objective.

## Documentation

- [Installation and distribution](docs/INSTALLATION.md)
- [Create compatible flashcards and share vocabulary](docs/FLASHCARDS.md)
- [Grading, accident policy and spaced mastery](docs/GRADING.md)
- [Tests and exact desktop/iOS verification boundary](docs/TESTING.md)
- [iPhone/iPad layout decisions and embedded-pane tests](docs/IOS_LAYOUT.md)
- [ChineseGuru/Pleco interoperability and CLI](docs/IMPORTING.md)
- [Implemented/partial/deferred features and prioritized roadmap](docs/STATUS_AND_ROADMAP.md)
- [Build, source structure and persistence](docs/DEVELOPMENT.md)
- [Prototype audit and verified API sources](docs/RESEARCH.md)
- [New study cards, audio setup and speech assessment research](docs/SPEECH_ASSESSMENT.md)

## Privacy and licenses

Voice recordings remain in memory in the current review and are discarded when it closes; they are not uploaded or saved in progress history. Optional reference audio is fetched from its configured HTTPS source only when played; use recordings you have permission to use. Device synthesis is limited to voices reported as local. Optional dictionary links open an external app/site only when clicked. The plugin requests read/create/modify access to create and link Rems; it never deletes existing data or writes SRS history. RemNote manages its own storage and sync.

Hanzi Writer is MIT; character vectors have the separate **Arphic Public License**. Complete data/license notices are included in the upload ZIP. MOE vectors/animations are not redistributed. No runtime JavaScript CDN is used. Local assets alone do not guarantee cold offline host operation or cross-device conflict-free persistence.
