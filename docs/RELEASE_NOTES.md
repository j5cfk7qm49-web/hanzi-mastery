# Hanzi Mastery 0.2.3 pre-release

Fix a result-display issue found by testing the new plugin in RemNote Desktop.

- After finishing a scrolled handwriting test, its result heading and save confirmation could remain clipped above the queue pane. The result and persisted mastery were correct, but the feedback was easy to miss.
- Bring the result heading into view after the host finishes resizing. Share the canvas's input-cancelled delayed adjustment without taking keyboard focus from RemNote.
- Add a regression that fails before the fix and checks actual heading/save-status bounds inside a short review pane in Chromium and WebKit. Grading and scheduling behavior are unchanged.

Verification: TypeScript, **60 unit/component/adapter/import tests**, **28 Chromium/WebKit browser tests**, official SDK manifest validation and ZIP integrity checks. Live RemNote Desktop testing confirmed accepted/rejected strokes, explicit-forgetting failure, early native-reveal failure, synced mastery read-back, retained failure in guided practice, and the corrected result position. No native SRS rating was applied during this test pass. The original v0.2.2 ZIP was also rebuilt byte-for-byte before the fix.

RemNote retains native rating controls and scheduling. Real RemNote iOS/Apple Pencil, hosted installation, offline/multi-device behavior and complete Taiwan stroke-order compliance remain unverified or incomplete. Short review panes still require scrolling. Wait for save confirmation before advancing; no durable pending-save outbox exists.

Download `HanziMastery-0.2.3-plugin.zip` for the compiled upload package and `HanziMastery-0.2.3-source.zip` for source. Local desktop developer loading uses `npm ci`, `npm run dev`, then **Settings → Plugins → Build → Develop from localhost → http://localhost:8080/**. See `docs/TESTING.md` for exact evidence and remaining platform checks. The browser fixtures are excluded from the plugin ZIP.
