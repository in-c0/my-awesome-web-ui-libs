# my-awesome-web-ui-libs

Web UI libraries in one workspace. Each folder in `packages/` is its own library: it has its own npm package and version, its own site, and its own rules. They share one CI, one release workflow and one GitHub Pages deploy, so a new library needs no new repository, token or settings.

**Sites:** [in-c0.github.io/my-awesome-web-ui-libs](https://in-c0.github.io/my-awesome-web-ui-libs/)

| Library | npm | What it is |
| --- | --- | --- |
| [Knurl](packages/knurl) | [`@in-c0/knurl`](https://www.npmjs.com/package/@in-c0/knurl) | 18 form controls drawn as working isometric instruments: a switch is a toggle on a panel, a progress bar is a dial gauge. |
| [Paper UI](packages/paper-ui) | [`@in-c0/paper-ui`](https://www.npmjs.com/package/@in-c0/paper-ui) | Material-aware React components: paper shaders and stroke-by-stroke handwriting. |
| [Profile Atlas](packages/profile-atlas) | [`@in-c0/profile-atlas`](https://www.npmjs.com/package/@in-c0/profile-atlas) | Framework-free Web Components for a GitHub profile: project gallery, index and activity timeline. |

Each library came in with its full history from its original repository (`in-c0/knurl`, `in-c0/paper-ui`, `in-c0/profile-atlas`).

## How releases work

Bump a package's `version` and push to `main`. The **Release** workflow publishes every package whose version is not on npm yet, each on its own, with provenance. Nothing is published when no version changed.

- With a stage-only `NPM_TOKEN`, each new version is staged instead: it goes live once approved on npmjs.com → **Staged Packages** (with 2FA). A direct-capable token publishes at once.
- A prerelease goes out under the tag in its `publishConfig.tag` (Paper UI uses `alpha`).
- `node scripts/unpublished.mjs` shows what a release would publish.
- Paper UI keeps its own release rules: a version bump there follows [its release checklist](packages/paper-ui/docs/RELEASE_CHECKLIST.md).

## How sites work

The **Sites** workflow builds every library that declares a `webUiSite` field in `packages/<folder>/package.json` into `/<folder>/`, and writes a hub page at `/` that lists them. `node scripts/build-sites.mjs` does the same locally into `_site/`.

```json
"webUiSite": {
  "title": "Knurl",
  "tagline": "One line for the hub.",
  "build": "pnpm exec vite build site",
  "dir": "site/dist",
  "preview": ".github/assets/preview.png"
}
```

A static library can use `"copy": ["demo", "src"]` and `"index": "demo/index.html"` instead of `build` and `dir`. Each build gets `SITE_URL` and `VITE_SITE_URL` set to its own public address.

## One-time setup (already done once for all libraries)

1. **Settings → Pages → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → `NPM_TOKEN`**: an npm granular token for the `@in-c0` scope, stage-only (approve each version on npmjs.com) or direct-capable (bypass 2FA, live at once).

## Adding a library

Add a folder under `packages/` with a `package.json` (a public `name`, a `version`, and `webUiSite`), commit and push. CI tests it, Sites builds it, and Release publishes it.

## Develop

```sh
pnpm install
pnpm test        # every library's tests
pnpm build       # every library's package
pnpm sites       # every site and the hub, into _site/
```

Paper UI's tests use Bun (`bun test`), so install Bun as well.
