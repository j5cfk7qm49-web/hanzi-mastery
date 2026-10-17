# Installation and distribution status

For local development, run `npm ci`, `npm run build`, then `npm run dev`. In RemNote's Plugins developer tools, load the unpacked plugin from `http://localhost:8080` using **Develop from localhost**. The server binds only to this computer. Keep it running while testing; `npm run dev` does not hot-reload source changes, so rebuild after edits.

The ZIP in `release/` is a compiled RemNote upload package, with the manifest and widget bundles at its root. The official SDK validator checks it before packaging. It does not establish RemNote approval or successful installation.

The development manifest currently points to the real local Git source repository using a file URL. This passes the SDK URL schema, but is **not a public repository** and cannot satisfy marketplace review. Before submitting, replace `public/manifest.json`'s `repoUrl` with the actual public source repository URL and rebuild. A repository URL was requested from the user; none is invented. Do not treat this development ZIP as an approved marketplace release.

For distribution, use the Plugins **Build** tab → **Upload plugin** with the compiled ZIP. `unlisted: true` requests personal/unlisted distribution. RemNote's published policy still requires review, including a public source URL. After approval, install from the plugin page and enable it on the devices you use. There is no documented universal “install any local ZIP directly into iOS” route.

Sources: [official upload instructions](https://plugins.remnote.com/advanced/submitting_plugins), [unlisted plugins](https://plugins.remnote.com/advanced/unlisted_plugins), [quick start](https://plugins.remnote.com/getting-started/quick_start_guide).
