# Hanzi Mastery 0.2.1 pre-release

Bug fixes and review polish for the Traditional-first RemNote handwriting MVP.

- Preserve completed strokes and rejected attempts when the handwriting engine needs a retry, including later characters in a word.
- Pause during a temporary RemNote read failure and resume the same attempt after the current review is confirmed.
- Keep answer reveal irreversible within a review, even if a host response briefly reports stale visibility. Reject stale work when the same card returns after a native rating.
- Enter guided practice in one click while saving and retaining the original failed result.
- Continue a verified per-character save batch across React component unmount; confirm settings read-back before reporting success.
- Lock authoring fields during asynchronous creation to prevent prompt/form mismatches.
- Put accuracy and forgotten-stroke controls above the canvas, retain an original-result reminder in practice, and bring the canvas into view using normal browser scrolling.
- Rebuild browser-test assets automatically and require the upload manifest version to match the package version.

Verification: TypeScript, **59 unit/component/adapter/import tests**, **10 Chromium/WebKit browser tests**, official SDK manifest validation and ZIP integrity checks. The expanded browser cases include interruption midway through a word and auditable accidental input. One-click guided practice, the preserved failure and synced save read-back were rechecked in signed-in RemNote Desktop using the existing isolated test card.

No scheduling algorithm or native rating automation was added. RemNote still owns scheduling. First-attempt accuracy remains recognizer correctness rather than a calibrated penmanship score. RemNote iOS/Apple Pencil, hosted ZIP installation, full offline behavior, cross-device conflicts and full Taiwan MOE compliance remain unverified or incomplete. A pending save can still be lost if its iframe/app closes; wait for save confirmation before advancing.

Download `HanziMastery-0.2.1-plugin.zip` for the compiled upload package. `HanziMastery-0.2.1-source.zip` is the source archive. For local desktop developer loading: `npm ci`, `npm run dev`, then **Settings → Plugins → Build → Develop from localhost → http://localhost:8080/**. Read `docs/INSTALLATION.md`, `docs/FLASHCARDS.md`, `docs/GRADING.md` and `docs/TESTING.md` for setup and verification boundaries.
