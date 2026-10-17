# Hanzi Mastery 0.2.2 pre-release

Mobile layout refinements for the Traditional-first RemNote handwriting MVP.

- Compact phone header and first-attempt score, with two primary controls immediately below the square canvas.
- Scroll margins beside the drawing surface; less frequent practice/scoring options use a disclosure.
- Safe-area padding, long-prompt wrapping, 44px touch targets and 16px form controls.
- Put mastery save status near the result heading; expandable multi-character result details.
- Cancel delayed auto-scroll when input starts and skip unnecessary canvas resize updates. Preserve strokes/errors through rotation.
- Add an auto-sized iframe fixture with separate simulated native controls, covering small phones, landscape, iPad and narrow split panes. Height synchronization and visual screenshot review prevent clipped-iframe false positives.

Verification: TypeScript, **60 unit/component/adapter/import tests**, **26 Chromium/WebKit browser tests**, official SDK manifest validation and ZIP integrity checks. Earlier v0.2.0/v0.2.1 integration flows were exercised in signed-in RemNote Desktop. This release's new layout was tested automatically in browser/iframe fixtures; native RemNote iOS was not available.

RemNote retains native rating controls and scheduling. Portrait is recommended for phone writing: short landscape panes may require scrolling. Finger/Pencil gesture routing, palm rejection, actual safe-area propagation, VoiceOver, Dynamic Type, keyboard behavior, hosted installation and offline/sync behavior remain unverified on a physical iOS device. First-attempt scoring and the documented Taiwan stroke-order limitations are unchanged. Wait for save confirmation before advancing; no durable pending-save outbox exists.

Download `HanziMastery-0.2.2-plugin.zip` for the compiled upload package and `HanziMastery-0.2.2-source.zip` for source. Local desktop developer loading uses `npm ci`, `npm run dev`, then **Settings → Plugins → Build → Develop from localhost → http://localhost:8080/**. See `docs/IOS_LAYOUT.md` for layout decisions and remaining device checks, and `docs/INSTALLATION.md` for hosted distribution requirements. The test fixture is excluded from the plugin ZIP.
