# Profile Atlas

Two framework-free Web Components for a personal site that shows more of a GitHub profile than six pinned repositories:

- **`<profile-atlas>`**: a gallery of what you made, starred and forked, with a searchable index, a details view and the activity timeline.
- **`<github-activity-timeline>`**: stars, forks, new repositories and pushes in four lanes on one time scale, from a username or any dated `events` array.

Plain ES modules and CSS in shadow roots. No framework, no build step, no runtime dependency and no GitHub token. Five files, about 31 kB gzipped.

**[Documentation and live examples](https://in-c0.github.io/my-awesome-web-ui-libs/profile-atlas/)** · [llms.txt](https://in-c0.github.io/my-awesome-web-ui-libs/profile-atlas/docs/llms.txt) · [The owner’s showcase](https://profile-atlas-showcase.wldud5192.chatgpt.site/)

## Install

```sh
npm i @in-c0/profile-atlas
```

```js
import '@in-c0/profile-atlas'; // defines both elements
```

Or with no install:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@in-c0/profile-atlas/src/profile-atlas.js"></script>
```

Or copy `profile-atlas.js`, `timeline-math.js`, `profile-atlas.css`, `github-activity-timeline.css` and `mellow-overrides.css` from `src/` into one folder. Keep them next to each other: the module loads its stylesheets by their path beside it. With Vite, add `optimizeDeps: { exclude: ['@in-c0/profile-atlas'] }` so the dev server does not separate them.

## Use

```html
<profile-atlas username="your-github-name" manifest-url="/atlas.json"></profile-atlas>

<github-activity-timeline username="your-github-name" range="five"></github-activity-timeline>
```

Either attribute is enough for `<profile-atlas>`: a username reads public repositories, stars and recent pushes; a [manifest](https://in-c0.github.io/my-awesome-web-ui-libs/profile-atlas/docs/#manifest) curates projects, stories, inspiration and month-level history, and on its own makes no GitHub request. The timeline also takes records of your own:

```js
document.querySelector('github-activity-timeline').events = [
  { id: 'a', type: 'star', title: 'lit/lit', date: '2026-10-04T09:30:00Z', url: 'https://github.com/lit/lit' },
  { id: 'b', type: 'commit', title: 'Release', date: new Date(), activityCount: 4 },
];
```

| Element | Attributes | Properties | Events |
| --- | --- | --- | --- |
| `<profile-atlas>` | `username`, `manifest-url`, `max-pages`, `row`, `compact`, `theme` | `items`, `kind`, `load()` | `atlas-ready`, `activity-open` |
| `<github-activity-timeline>` | `username`, `max-pages`, `range`, `theme` | `events`, `range`, `load()`, `showDetails()` | `activity-open` (cancellable) |

`theme` is `light` (default), `dark` or `auto`. Seventeen `--profile-atlas-*` custom properties restyle both elements; see [Theming](https://in-c0.github.io/my-awesome-web-ui-libs/profile-atlas/docs/#theming). `@in-c0/profile-atlas/timeline-math.js` exports the date bucketing (`activityWindow`, `reconcileMonthlySnapshots`) as pure functions for Node or the browser.

See [data/in-c0.json](data/in-c0.json) for a complete manifest.

## This folder

- `src/`: the published library.
- `docs/`: the documentation site (plain HTML and JS modules, no build). Served with the rest of this folder, it opens at `docs/index.html`.
- `demo/`: the owner’s personal showcase, built on the same data with its own `src/showcase.js` and `src/showcase.css` (not published). It is deployed at [profile-atlas-showcase.wldud5192.chatgpt.site](https://profile-atlas-showcase.wldud5192.chatgpt.site/) and linked from the [GitHub profile README](https://github.com/in-c0) through `assets/showcase-banner.svg`.
- `data/in-c0.json`: the owner’s manifest, used by the showcase and the docs.

`pnpm test` runs the tests in `tests/`.

## Data, limits, and privacy

- Public repos from GitHub's user repository endpoint; forks use repo creation timestamps.
- Stars from the starred endpoint with `Accept: application/vnd.github.star+json`, which includes star timestamps.
- **Push** from the recent public `PushEvent` feed: this is **not a complete commit history** and a push event is not a single commit. Public event history is limited to recent events (approximately 30 days / 300 events).
- Public GitHub API requests are unauthenticated; local browser cache lasts six hours. The sample profile reconciles its dated month-only snapshot with newly fetched events, adding only previously unaccounted-for quantities to avoid double counting.
- `projectVisibility: "curated"` in the manifest hides unfeatured owned repo **titles from the gallery** and represents their creation in the public chart as month-only totals. This does **not** make public GitHub repos private.
- Curated screenshot previews link directly to the live product or store listing. Other items may use iframes if allowed; when embedding is blocked, visitors can open the project directly.

## GitHub profile README

GitHub profile READMEs cannot execute JavaScript. Embed `assets/profile-atlas-preview.gif` as a linked image, and point it at the live interactive Atlas. Rebuild the compact animated illustration with `python scripts/make_readme_preview.py` (requires Pillow). The GitHub six-pin limit is independent of what you can display on the hosted page.

MIT licensed. Tests cover the date bucketing and the element lifecycle in Node; there are no automated cross-browser interaction tests yet, and static pre-generated feeds are future work.
