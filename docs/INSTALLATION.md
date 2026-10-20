# Installation and distribution status

For local development, run `npm ci`, `npm run build`, then `npm run dev`. In RemNote's Plugins developer tools, load the unpacked plugin from `http://localhost:8080` using **Develop from localhost**. The server binds only to this computer. Keep it running while testing; `npm run dev` does not hot-reload source changes, so rebuild after edits.

The ZIP in `release/` is a compiled RemNote upload package, with the manifest and widget bundles at its root. The official SDK validator checks it before packaging. It does not establish RemNote approval or successful installation.

Version **0.3.1 was submitted as an unlisted plugin on October 19, 2026**. RemNote displayed "was uploaded successfully" and instructed the author to wait for approval. Its manifest enables mobile use and points to the [public source repository](https://github.com/j5cfk7qm49-web/hanzi-mastery). The submitted code is [commit e419e39](https://github.com/j5cfk7qm49-web/hanzi-mastery/commit/e419e3987a4ba574f166e22ce86e3883e1224e37). RemNote approval, hosted installation and actual iPhone operation remain unverified.

The initial 0.3.0 upload returned a 504 timeout and registered its version without a submission receipt. Version 0.3.1 groups the same character data into fewer files; this upload completed with RemNote's success message.

For future uploads, use the Plugins **Build** tab → **Upload plugin** with the compiled ZIP. `unlisted: true` requests personal/unlisted distribution. RemNote's published policy still requires review, including a public source URL. After approval, use the [unlisted plugin page](https://www.remnote.com/plugins/hanzi_mastery_handwriting_v1) and enable it on the devices you use. There is no documented universal “install any local ZIP directly into iOS” route.

Sources: [official upload instructions](https://plugins.remnote.com/advanced/submitting_plugins), [unlisted plugins](https://plugins.remnote.com/advanced/unlisted_plugins), [quick start](https://plugins.remnote.com/getting-started/quick_start_guide).
