# Hanzi Mastery 0.2.0

Traditional-first handwriting reviews for RemNote. RemNote owns scheduling; Hanzi Mastery records writing mastery separately. This is an MVP requiring live desktop/iOS acceptance testing, not a claim of ChineseGuru feature parity.

Build with Node 22.12+ (Node 24 tested): `npm ci`, `npm run check`, `npm run build`.
The installable upload archive is `release/HanziMastery-0.2.0-plugin.zip`. It contains compiled widgets, manifest, documentation and local character data. It is not the source archive.

See [research](docs/RESEARCH.md) for verified APIs and limitations. Installation, flashcard authoring and grading documentation are completed alongside implementation.

No learner data is sent to a third party. Optional dictionary links open an external app/site only when clicked. Hanzi Writer is MIT; character data has a separate Arphic Public License included in the ZIP. No runtime JavaScript CDN is used.
