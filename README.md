# Profile Atlas

A reusable, framework-free Web Component for showcasing **public GitHub projects, stars, forks, curated stories, and inspiration**.

- 2.5D keyboard/swipe-controlled carousel. Only the current card and its neighbours are rendered.
- Searchable, progressively revealed index: one concise description per entry.
- Unified chronological timeline for repositories, stars, and forks.
- Optional manifest for products not represented by a public GitHub repository, stories, image galleries, and explicit live demos.
- Works in plain HTML, React, Vue, Svelte, and other environments that support Custom Elements.
- No sign-in or client-side GitHub token.

## Quick start

Serve this directory over HTTP (for example with a static dev server) and open [demo/index.html](demo/index.html).

In any existing website, load the ESM source and add the element:

```html
<script type="module" src="/src/profile-atlas.js"></script>

<profile-atlas
  username="in-c0"
  manifest-url="/data/in-c0.json"
  max-pages="10">
</profile-atlas>
```

The JavaScript module loads its adjacent `profile-atlas.css` file using `import.meta.url`, so keep both files together when copying or publishing them.

### Curated horizontal rows

For separate visible carousels, render compact instances with different `row` values:

```html
<h2>My projects</h2>
<profile-atlas compact row="project" username="in-c0" manifest-url="/data/in-c0.json"></profile-atlas>

<h2>My stories</h2>
<profile-atlas compact row="story" username="in-c0" manifest-url="/data/in-c0.json"></profile-atlas>

<h2>Inspiration</h2>
<profile-atlas compact row="inspiration" username="in-c0" manifest-url="/data/in-c0.json"></profile-atlas>
```

For large pages, mount compact rows after the first gallery emits `atlas-ready`. Data is cached locally for six hours.

## Attributes

| Attribute | Purpose |
| --- | --- |
| `username` | GitHub username (only public data is requested). |
| `manifest-url` | Optional JSON manifest for curated projects, stories, and inspiration. |
| `max-pages` | Pages of 100 fetched **per feed** (default 10, maximum 30). |
| `row` | Initial gallery category: `project`, `star`, `fork`, `story`, or `inspiration`. |
| `compact` | Hide the built-in heading, tabs, and footer for page-composed rows. |

Events: `atlas-ready` is dispatched with `detail.count` after successful loading.

The default element has three views:

1. **Gallery:** 2.5D cards, arrow buttons, swipes, and keyboard arrows. Details and demo open on demand.
2. **Index:** search and display up to 24 rows initially, then progressively reveal more.
3. **Timeline:** combines dated public events, with kind filters and progressively revealed entries.

## Manifest

See [data/in-c0.json](data/in-c0.json). Format:

```json
{
  "projects": [
    {
      "id": "my-app",
      "title": "My App",
      "summary": "A one-sentence description.",
      "repo": "username/repo",
      "url": "https://example.com",
      "demoUrl": "https://example.com/demo",
      "preview": "iframe",
      "image": "https://example.com/screenshot.jpg",
      "featured": true
    }
  ],
  "stories": [
    { "id": "why", "title": "Why I build", "summary": "A short insight.", "body": "Longer text." }
  ],
  "inspirations": [
    { "id": "art-01", "title": "Visual reference", "image": "https://example.com/image.jpg" }
  ]
}
```

When a curated project provides `repo` equal to a fetched public repository, its details override that auto-discovered card, avoiding duplicates. Other projects are added to the collection, including deployed products without a GitHub repository.

For embeds, set `preview` to `iframe` or `video`; nothing starts until the visitor presses **Try demo**. A cross-origin site may block iframe embedding with CSP or X-Frame-Options. An **Open live demo** link remains available. Only use URLs you are authorized to embed.

## Data and privacy

- Public repositories: `GET /users/{username}/repos?type=owner`; forks have their own category, with their creation time used as the fork's timeline point.
- Stars: `GET /users/{username}/starred` with `Accept: application/vnd.github.star+json` to obtain `starred_at`.
- Private repositories are **never** fetched; starred private repositories are not exposed publicly.
- The API is paginated; large collections can be capped using `max-pages`. The viewer sees a notice when a feed is capped.
- The browser uses an uncredentialed API call and a six-hour local cache. GitHub limits unauthenticated API calls; for high-traffic production or more than a few thousand events, generate a static public snapshot periodically with GitHub Actions or a server-side cache. Never put a personal access token into shipped JavaScript.

This component is a **history of what is still publicly observable**, not a forensic log of every past star, deletion, repository rename, or unfork. Private and deleted activity cannot be reconstructed.

## GitHub profile README integration

GitHub README files do not run arbitrary JavaScript. They cannot embed this Web Component directly. Put a static visual preview and a link to a **deployed** Atlas page near the top of the profile README, with a concise "Projects" summary first. GitHub's own pins can stay as a complement, not the only entry point.

After a public demo is deployed, update the profile README link. Do not link to a speculative Pages URL before enabling it.

## Development and packaging

This version is intentionally buildless. The standalone source is under `src/`; the showcase page is under `demo/`; a sample data manifest lives under `data/`. There is no runtime dependency.

Before a public npm release, add cross-browser automated interaction tests, a tagged distributable build, release automation, and GitHub Pages deployment. The current version is an early public prototype.

MIT License. See [LICENSE](LICENSE).
