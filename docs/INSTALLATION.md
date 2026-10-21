# Installation and distribution status

For hosted installation, open the [unlisted plugin page](https://www.remnote.com/plugins/hanzi_mastery_handwriting_v1) while signed into the account used by your devices. Install/enable the approved version. In a compatible writing review, expect a Hanzi Mastery section with **Begin test**, followed by the writing square. Existing correctly tagged cards do not need to be recreated after a plugin update.

For local development only, run `npm ci`, `npm run build`, then `npm run dev`. In RemNote's Plugins developer tools, load the unpacked plugin from `http://localhost:8080` using **Develop from localhost**. The server binds only to this computer. Keep it running while testing; `npm run dev` does not hot-reload source changes, so rebuild after edits.

The ZIP in `release/` is a compiled RemNote upload package, with the manifest and widget bundles at its root. The official SDK validator checks it before packaging. It does not establish RemNote approval or successful installation.

Version **0.3.1 was submitted on October 19 and confirmed approved on October 20, 2026**: the user received approval and the public listing exposed version 0.3.1 with an Install action. Its workbench and handwriting canvas also loaded in a clean RemNote web demo session. Its manifest enables mobile use and points to the [public source repository](https://github.com/j5cfk7qm49-web/hanzi-mastery). The submitted code is [commit e419e39](https://github.com/j5cfk7qm49-web/hanzi-mastery/commit/e419e3987a4ba574f166e22ce86e3883e1224e37). Actual iPhone acceptance remains outstanding: the user reported a blank review widget while the phone's plugin page showed 0.3.1.

Version **0.3.2 was uploaded on October 20, 2026 and is available through RemNote's Check for Updates**. The public plugin page displays 0.3.2, and an isolated web demo installation updated from 0.3.1 to the hosted 0.3.2 index bundle. This review-identity compatibility patch accepts the SDK's optional widget card ID being absent while still requiring the current forward card and matching Rem, and shows a waiting message instead of an empty registered widget. Physical iPhone confirmation remains required. This fixes an API-contract bug consistent with the report; the phone's actual widget context has not been inspected. The matching [GitHub release](https://github.com/j5cfk7qm49-web/hanzi-mastery/releases/tag/v0.3.2) contains the uploaded ZIP and source from commit b1ea5c1.

## Version labels

Version **0.3.3 is being prepared** after the user reported that 0.3.2 still left a blank iPhone review. An actual compiled-bundle WebKit test reproduced a startup crash when `crypto.randomUUID` was unavailable, before any card read. The patch replaces those calls with identifiers generated from `crypto.getRandomValues` and shows a diagnostic for caught render/effect startup failures. Distribution and native iPhone acceptance still require confirmation. See [startup verification](TESTING.md).

The source, GitHub releases and RemNote registrations are separate records:

| Record | Version | Meaning |
| --- | --- | --- |
| Current source and upload ZIP | 0.3.3 | Compiled-widget startup crash fix; distribution status recorded above. |
| Latest available hosted update | 0.3.2 | Public page and isolated web update confirmed; physical iPhone review still requires confirmation. |
| GitHub pre-release | See release tag | Downloadable package with matching source/checksums. Publishing it does not update RemNote. |
| Existing RemNote development registration | 0.2.0 | The desktop Build tab still points this entry at `http://localhost:8080/`. Its stored version label has not followed subsequent builds. |

The desktop development entry still displayed 0.2.0 and the localhost URL on October 20, but the user subsequently confirmed 0.3.1 on the phone. The desktop entry therefore does not establish the phone's installed source or version. A localhost URL refers to the device opening it, so the desktop's loopback-only development server does not provide a phone installation. "Enabled on Mobile" is not an installation or runtime test.

On the phone, open Plugins → Manage and use **Check for Updates** if that control is available. Reopen RemNote and check that Hanzi Mastery displays 0.3.2, then open an existing writing review. The update control and hosted 0.3.2 loading were verified on the web; the phone's exact update-menu layout has not been verified. GitHub ZIPs are not an iOS sideload mechanism. If the waiting message persists, it distinguishes a registered widget that cannot bind from a widget that never loads; no successful handwriting result should be recorded in either case.

For future uploads, use the Plugins **Build** tab → **Upload plugin** with the compiled ZIP. `unlisted: true` requests personal/unlisted distribution. RemNote's published policy still requires review, including a public source URL. After approval, use the [unlisted plugin page](https://www.remnote.com/plugins/hanzi_mastery_handwriting_v1) and enable it on the devices you use. There is no documented universal “install any local ZIP directly into iOS” route.

Sources: [official upload instructions](https://plugins.remnote.com/advanced/submitting_plugins), [unlisted plugins](https://plugins.remnote.com/advanced/unlisted_plugins), [quick start](https://plugins.remnote.com/getting-started/quick_start_guide).
