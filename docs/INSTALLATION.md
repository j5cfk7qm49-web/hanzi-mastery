# Installation and distribution status

For hosted installation, open the [unlisted plugin page](https://www.remnote.com/plugins/hanzi_mastery_handwriting_v1) while signed into the account used by your devices. Install/enable the approved version. In a compatible writing review, expect a Hanzi Mastery section with **Begin test**, followed by the writing square. Existing correctly tagged cards do not need to be recreated after a plugin update.

For local development only, run `npm ci`, `npm run build`, then `npm run dev`. In RemNote's Plugins developer tools, load the unpacked plugin from `http://localhost:8080` using **Develop from localhost**. The server binds only to this computer. Keep it running while testing; `npm run dev` does not hot-reload source changes, so rebuild after edits.

The ZIP in `release/` is a compiled RemNote upload package, with the manifest and widget bundles at its root. The official SDK validator checks it before packaging. It does not establish RemNote approval or successful installation.

Version **0.3.1 was submitted on October 19 and confirmed approved on October 20, 2026**: the user received approval and the public listing exposed version 0.3.1 with an Install action. Its workbench and handwriting canvas also loaded in a clean RemNote web demo session. Its manifest enables mobile use and points to the [public source repository](https://github.com/j5cfk7qm49-web/hanzi-mastery). The submitted code is [commit e419e39](https://github.com/j5cfk7qm49-web/hanzi-mastery/commit/e419e3987a4ba574f166e22ce86e3883e1224e37). Actual iPhone acceptance remains outstanding: the user reported a blank review widget while the phone's plugin page showed 0.3.1.

Version **0.3.2** is the prepared review-identity compatibility patch. It accepts the SDK's optional widget card ID being absent while still requiring the current forward card and matching Rem, and shows a waiting message instead of an empty registered widget. It still requires submission/review and physical iPhone confirmation. This fixes an API-contract bug consistent with the report; the phone's actual widget context has not been inspected.

## Version labels

The source, GitHub releases and RemNote registrations are separate records:

| Record | Version | Meaning |
| --- | --- | --- |
| Current source and upload ZIP | 0.3.2 | Review-identity compatibility patch, with distribution outcome recorded above. |
| Approved hosted release | 0.3.1 | Approved and loaded in a clean web session; iPhone review failed in the user's report. |
| GitHub pre-release | See release tag | Downloadable package with matching source/checksums. Publishing it does not update RemNote. |
| Existing RemNote development registration | 0.2.0 | The desktop Build tab still points this entry at `http://localhost:8080/`. Its stored version label has not followed subsequent builds. |

The desktop development entry still displayed 0.2.0 and the localhost URL on October 20, but the user subsequently confirmed 0.3.1 on the phone. The desktop entry therefore does not establish the phone's installed source or version. A localhost URL refers to the device opening it, so the desktop's loopback-only development server does not provide a phone installation. "Enabled on Mobile" is not an installation or runtime test.

After installing an approved update, check the phone's resulting version and the actual review widget. GitHub ZIPs are not an iOS sideload mechanism. If the waiting message persists, it distinguishes a registered widget that cannot bind from a widget that never loads; no successful handwriting result should be recorded in either case.

For future uploads, use the Plugins **Build** tab → **Upload plugin** with the compiled ZIP. `unlisted: true` requests personal/unlisted distribution. RemNote's published policy still requires review, including a public source URL. After approval, use the [unlisted plugin page](https://www.remnote.com/plugins/hanzi_mastery_handwriting_v1) and enable it on the devices you use. There is no documented universal “install any local ZIP directly into iOS” route.

Sources: [official upload instructions](https://plugins.remnote.com/advanced/submitting_plugins), [unlisted plugins](https://plugins.remnote.com/advanced/unlisted_plugins), [quick start](https://plugins.remnote.com/getting-started/quick_start_guide).
