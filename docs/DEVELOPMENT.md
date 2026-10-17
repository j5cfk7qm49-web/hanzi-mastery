# Development

Use Node 22.12+; the verified Windows environment used Node 24.17.0 and npm 11.13.0. `.nvmrc` records that version. Dependencies and lockfile are committed. Run installs, browser downloads and builds sequentially because `npm ci` replaces `node_modules` while other processes may be using it.

```powershell
npm ci
npm run check
npm run build
npm run build:preview
npx playwright install chromium webkit
npm run test:browser
```

`npm run dev` builds and serves the actual RemNote bundles at `http://localhost:8080`. Rebuild after source edits. It uses a small loopback-only static server, avoiding the vulnerable development-proxy dependency chain encountered during the audit. `npm audit` reported no vulnerabilities after that change. Production React 17.0.2 matches the current RemNote SDK peer contract.

`webpack.preview.cjs` and `e2e/harness.tsx` are **test tooling only**. They build to ignored `preview-dist`, simulate RemNote queue flags and persist to browser localStorage. They are never included in the plugin ZIP. Browser tests draw actual Hanzi Writer median paths with mouse input and exercise touch-event cancellation. These synthetic reference paths establish engine/data integration, not human penmanship accuracy or hardware stylus quality.

## Source map

- `src/core`: pure grading, event ledger, settings/schema, mastery progression and diagnostic geometry.
- `src/services`: documented RemNote adapter, synced mastery repository and local character loading.
- `src/ui`: responsive exercise and reusable Hanzi Writer canvas.
- `src/widgets`: SDK entrypoints, filtered review widget and authoring/practice/settings popup.
- `src/importers`: format adapters with no knowledge-base side effects.
- `scripts`: packaging, loopback asset server and non-overwriting import CLI.
- `tests`, `e2e`: automatic verification; `docs/TESTING.md` records coverage and platform limits.

## Packaging

The build invokes the SDK's `remnote-plugin validate` command, compiles normal and sandbox widget entrypoints following the official template, then constructs a ZIP with fixed entry timestamps. Every character's JSON filename is its exact Unicode code point in hexadecimal. The seven core Traditional examples are additionally embedded so they require no separate character request. Other characters load from `plugin.rootURL` with a timeout, explicit error and memory/browser HTTP caching. There is no default CDN fallback in the configured loader.

The package script checks root entries, data counts, core characters, development-file exclusion, runtime remote imports, archive extraction and manifest version. JavaScript and character data carry separate licenses. All notices/license files are copied into the package. `npm audit --omit=dev` can verify runtime dependencies independently.

## Persistence boundaries

`storage.setSynced` is a RemNote user-level store, not its card scheduler. Keys use a stable vocabulary Rem ID and exact character code point. Save IDs deduplicate retries; same-process writes serialize and read back before confirmation. Histories are bounded to 200 tests, while timestamps/level/peak survive trimming. RemNote does not document a transactional cross-device key-value update API, so concurrent device edits remain a limitation.

The earlier prototype's per-card `hanzi-mastery-v1` keys are not imported automatically. A future migration should preview mappings from old cards to vocabulary/character identities and never alter FSRS history.

## Release gate

The source and upload artifact are a pre-release. Principal developer-installation, authoring, input, failure and native-rating flows have passed in signed-in RemNote Desktop. Before marketplace submission, finish the remaining desktop/iOS checklist and review Taiwan differences. The GitHub workflow is provided, but its presence is not evidence that the remote run passed; check the actual Actions status.
