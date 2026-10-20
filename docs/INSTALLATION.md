# Installation and distribution status

For local development, run `npm ci`, `npm run build`, then `npm run dev`. In RemNote's Plugins developer tools, load the unpacked plugin from `http://localhost:8080` using **Develop from localhost**. The server binds only to this computer. Keep it running while testing; `npm run dev` does not hot-reload source changes, so rebuild after edits.

The ZIP in `release/` is a compiled RemNote upload package, with the manifest and widget bundles at its root. The official SDK validator checks it before packaging. It does not establish RemNote approval or successful installation.

The manifest points to the [public source repository](https://github.com/j5cfk7qm49-web/hanzi-mastery), created with the user's authorization. SDK validation and a public repository do not establish marketplace approval. On October 19, 2026, the 0.3.0 upload returned a 504 server timeout. A retry reported that 0.3.0 already existed, but no submission receipt or approval status was shown. Version 0.3.1 groups the same local character data into fewer files for another submission attempt. Approval and hosted installation remain unverified.

For distribution, use the Plugins **Build** tab → **Upload plugin** with the compiled ZIP. `unlisted: true` requests personal/unlisted distribution. RemNote's published policy still requires review, including a public source URL. After approval, install from the plugin page and enable it on the devices you use. There is no documented universal “install any local ZIP directly into iOS” route.

Sources: [official upload instructions](https://plugins.remnote.com/advanced/submitting_plugins), [unlisted plugins](https://plugins.remnote.com/advanced/unlisted_plugins), [quick start](https://plugins.remnote.com/getting-started/quick_start_guide).
