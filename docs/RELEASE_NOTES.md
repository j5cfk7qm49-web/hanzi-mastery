# Hanzi Mastery 0.2.0 pre-release

Traditional-first interactive Chinese handwriting reviews for RemNote. This replaces the experimental CDN-assisted prototype with pinned dependencies, locally bundled JavaScript/character data and a validated upload archive.

Includes hidden writing-card metadata, shared vocabulary linkage, multi-character sequencing, mandatory independent recall, progressive first-attempt thresholds, spaced promotion/regression, auditable accident recovery, guided practice, synced mastery read-back, native rating suggestions and Pleco/mapped CSV import tooling.

Verified locally: clean `npm ci`, TypeScript, 47 unit/component/adapter/import tests, 6 Chromium/WebKit browser tests, official SDK manifest validation and ZIP integrity checks. Developer loading, authoring, real accepted/rejected mouse input, forgotten/early-reveal failures, mastery save read-back, guided practice, native rating controls and review reset were exercised in signed-in RemNote Desktop.

This is not a production/parity claim. RemNote iOS/Apple Pencil, hosted ZIP installation/marketplace approval, full offline operation, cross-device conflict handling and Taiwan MOE compliance remain incomplete or unverified. A concrete 學 sequence difference is documented. Geometric feedback is experimental and does not grade penmanship. Automatic SRS submission, dedicated speech/listening/translation/pinyin/tone exercises and a verified native ChineseGuru importer are not implemented.

Download `HanziMastery-0.2.0-plugin.zip` for the compiled RemNote upload package. `HanziMastery-0.2.0-source.zip` is the source archive. For immediate desktop development use, run `npm ci`, `npm run dev`, then RemNote **Settings → Plugins → Build → Develop from localhost**, using `http://localhost:8080/`.

Read `README.md`, `docs/INSTALLATION.md`, `docs/FLASHCARDS.md`, `docs/GRADING.md` and `docs/TESTING.md` before using the pre-release for regular study.
