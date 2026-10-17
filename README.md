# Hanzi Mastery 0.2.0 — RemNote handwriting MVP

Traditional-first Chinese writing reviews with progressive mastery. **RemNote owns scheduling. Independent recall of every stroke is mandatory.** Practice and testing are separate.

The plugin builds reproducibly, passes 47 unit/component/adapter/import tests and 6 Chromium/WebKit browser tests, and has been loaded and exercised in **RemNote Desktop**. This is a pre-release: iOS/Pencil, complete Taiwan MOE compliance, hosted ZIP installation and full offline operation remain unverified.

## Get started

Use Node 22.12+ (Node 24.17.0 tested):

```powershell
npm ci
npm run check
npm run build
npm run dev
```

In RemNote: **Settings → Plugins → Build → Develop from localhost → http://localhost:8080/**. Keep the server running for developer loading. Run **Hanzi Mastery: create writing card / practice / settings** from the command menu (`Ctrl+/` on the verified Windows desktop). Enter an exact Traditional target and an English prompt, create the card, open it, and use RemNote's native practice action. Cards and vocabulary are siblings under a neutral **Hanzi Mastery** document.

The compiled upload archive is **`release/HanziMastery-0.2.0-plugin.zip`**. The separately named source ZIP contains development files. The upload package has manifest/widget bundles at its root, local stroke data, licenses and documentation. It passes the official SDK validator and archive checks. Marketplace upload/review is still required for hosted/unlisted distribution; see [installation](docs/INSTALLATION.md).

## What works

- Responsive Hanzi Writer canvas; locally bundled JavaScript and data for 9,574 exact-script characters. 學、國、書、語、聽、體、愛 are also embedded in the widget bundle.
- Explicit hidden writing-card metadata and shared vocabulary linkage, rather than answer-text guessing. Single characters and sequential multi-character words.
- First-attempt stroke correctness, remembered-but-misdrawn corrections, limited auditable accidental-input recovery, and mandatory failure on forgotten strokes or premature answer reveal.
- Beginner/Developing/Proficient/Mastered thresholds of 60/75/90/95%, configurable spaced promotion, gentle regression and preserved peak. Same-session practice cannot inflate mastery.
- Guided learning with outlines, animation and retries, preserving the original failed result.
- Synced mastery storage with retry IDs and read-back confirmation. Suggested native grade and advisory override; native RemNote controls remain intact.
- Optional experimental path geometry feedback, excluded from pass/fail.
- Tested Pleco text and mapped CSV/TSV converters. Categories/provenance are retained; existing SRS history is not modified.

## Read before studying

First-attempt recognizer correctness is **not validated penmanship precision**. The bundled sequence for **學 differs from Taiwan MOE**. No Taiwan-compliance claim is made; a per-character override registry is provided. [Taiwan stroke audit](docs/TAIWAN_STROKES.md).

Recognition, translation, pinyin, tones, listening and pronunciation have a shared vocabulary schema and separate native-card patterns, but dedicated interactive exercises are not implemented. ChineseGuru's current export schema has not been verified; there is no claimed native importer. Full parity remains a roadmap objective.

## Documentation

- [Installation and distribution](docs/INSTALLATION.md)
- [Create compatible flashcards and share vocabulary](docs/FLASHCARDS.md)
- [Grading, accident policy and spaced mastery](docs/GRADING.md)
- [Tests and exact desktop/iOS verification boundary](docs/TESTING.md)
- [ChineseGuru/Pleco interoperability and CLI](docs/IMPORTING.md)
- [Implemented/partial/deferred features and prioritized roadmap](docs/STATUS_AND_ROADMAP.md)
- [Build, source structure and persistence](docs/DEVELOPMENT.md)
- [Prototype audit and verified API sources](docs/RESEARCH.md)

## Privacy and licenses

No learner data is sent to a third party by the plugin. Optional dictionary links open an external app/site only when clicked. The plugin requests read/create/modify access to create and link Rems; it never deletes existing data or writes SRS history. RemNote manages its own storage and sync.

Hanzi Writer is MIT; character vectors have the separate **Arphic Public License**. Complete data/license notices are included in the upload ZIP. MOE vectors/animations are not redistributed. No runtime JavaScript CDN is used. Local assets alone do not guarantee cold offline host operation or cross-device conflict-free persistence.
