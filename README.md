# Profile Atlas

**[Live interactive showcase ↗](https://profile-atlas-showcase.wldud5192.chatgpt.site)** · [Use with GitHub profile README](#github-profile-readme-integration)

A reusable, framework-free Web Component for showcasing **public GitHub projects, stars, forks, recent code-push activity, curated stories, and inspiration**.

- **Orbital 2.5D gallery** inspired by Mellow UI's [Ring Gallery](https://www.mellowui.com/components/ring-gallery), adapted to framework-free DOM with inertial dragging, swipe, keyboard arrows and a bounded card window.
- **Browse all** opens a searchable index overlay, rather than replacing the gallery.
- **Always-visible, horizontally interactive activity graph** on one shared time spine: Star and Fork branches above; New repo and recent Code push branches below. The activities are independent events, grouped by month; select any node for details.
- An independently reusable `<github-activity-timeline>` Web Component with either a GitHub username or externally supplied event data.
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

The JavaScript module loads its adjacent `profile-atlas.css` and `github-activity-timeline.css` files using `import.meta.url`. Keep all three files together when publishing the components.

### GitHub Activity Timeline — standalone

Use the timeline without the gallery or profile page:

```html
<script type="module" src="/src/profile-atlas.js"></script>
<github-activity-timeline username="your-github-username" max-pages="10"></github-activity-timeline>
```

Or set the element's `events` property to an array of items:

```js
document.querySelector('github-activity-timeline').events = [
  { id: 'example-1', type: 'star', title: 'Example discovery', date: '2025-05-01T00:00:00Z' },
  { id: 'example-2', type: 'fork', title: 'Example fork', date: '2025-06-01T00:00:00Z' },
  { id: 'example-3', type: 'project', title: 'New repository', date: '2025-07-01T00:00:00Z' },
  { id: 'example-4', type: 'commit', title: 'Code push', date: '2025-08-01T00:00:00Z' }
];
```

Events can have `activityCount` for a monthly aggregate and `aggregate: true` to avoid disclosing item names. A cancellable `activity-open` event emits `detail.items` and `detail.label`; call `event.preventDefault()` to handle selection yourself and suppress the built-in detail drawer.

The [sample activity graph in the live showcase](https://profile-atlas-showcase.wldud5192.chatgpt.site/activity-demo.html) uses clearly fictional data and needs no GitHub API access. The standalone timeline does not infer links between a fork and a separate new-repository event.

**Accuracy note:** GitHub's public user events endpoint only covers about 30 days and up to 300 events. The green Code push nodes reflect *push events*, **not exact historical commit counts**. To visualize verified individual commits or complete long-term history, supply your own versioned, authorized event archive.

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

For large pages, mount compact rows after the first gallery emits `atlas-ready`. Compact story/inspiration rows also expose a full searchable index. Data is cached locally for six hours.

## Attributes

| Attribute | Purpose |
| --- | --- |
| `username` | GitHub username (only public data is requested). |
| `manifest-url` | Optional JSON manifest for curated projects, stories, and inspiration. |
| `max-pages` | Pages of 100 fetched **per feed** (default 10, maximum 30). |
| `row` | Initial gallery category: `project`, `star`, `fork`, `story`, or `inspiration`. |
| `compact` | Hide the built-in heading, tabs, and footer for page-composed rows. |

Events: `atlas-ready` is dispatched with `detail.count` after successful loading.

The default element composes all three reading modes without a tab switch:

1. The **orbital gallery** is the primary view. It shows only up to eleven nearby cards even when the data set contains hundreds of entries. Arrow controls, dragging and keyboard navigation advance the ring. A click opens item details and optionally a live demo.
2. **Browse all** opens an on-demand search and one-line list, progressively showing additional entries.
3. Below the gallery, the **horizontal GitHub activity graph** is visible without a toggle. Star and Fork appear above a central time spine; New repo and Code push appear below on separate heights. Drag, swipe, or use arrows. Every monthly node is independently selectable.

## Manifest

See [data/in-c0.json](data/in-c0.json). Format:

```json
{
  "projectVisibility": "curated",
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

The optional `projectVisibility: "curated"` setting hides automatically collected **owned projects** from the showcase, while retaining public forks and stars. This is useful when a founder has public source repositories that should not yet be featured as named products. With this setting, only explicitly listed `projects` appear in the Made gallery. Creation activity for other public owned repositories is reduced to **monthly counts** on the New repo branch (no names, links, or individual creation dates). The component keeps featured repositories individually identifiable with their public GitHub creation timestamps. This monthly activity disclosure is opt-in through the curated manifest setting; review whether publishing even aggregate activity suits your profile. Omit the setting to include all public GitHub repositories automatically. This is a presentation control, **not a privacy boundary**: public repository details remain accessible on GitHub.

For embeds, set `preview` to `iframe` or `video`; nothing starts until the visitor presses **Try demo**. A cross-origin site may block iframe embedding with CSP or X-Frame-Options. An **Open live demo** link remains available. Only use URLs you are authorized to embed.

## Data and privacy

- Public repositories: `GET /users/{username}/repos?type=owner`; forks have their own category, with their creation time used as the fork's timeline point.
- Stars: `GET /users/{username}/starred` with `Accept: application/vnd.github.star+json` to obtain `starred_at`.
- Recent public code activity: `GET /users/{username}/events/public`, filtering `PushEvent`, which covers **only recent pushes** (typically up to 30 days/300 events). One push is not necessarily one commit.
- Private repositories are **never** fetched; starred private repositories are not exposed publicly.
- The API is paginated; large collections can be capped using `max-pages`. The viewer sees a notice when a feed is capped.
- The browser uses uncredentialed API calls and a six-hour local cache. The showcase also includes a **dated, month-only activity snapshot**, derived from public aggregates, so rate-limited visitors still see a meaningful timeline without exposing unfeatured repository titles. GitHub limits unauthenticated API calls; for high-traffic production or more than a few thousand events, generate a static public snapshot periodically with GitHub Actions or a server-side cache. Never put a personal access token into shipped JavaScript.

This component is a **history of what is still publicly observable**, not a forensic log of every past star, deletion, repository rename, or unfork. Private and deleted activity cannot be reconstructed.

## GitHub profile README integration

GitHub README files do not run arbitrary JavaScript. They cannot embed this Web Component directly. Put a static visual preview and a link to a **deployed** Atlas page near the top of the profile README, with a concise "Projects" summary first. GitHub's own pins can stay as a complement, not the only entry point.

After a public demo is deployed, update the profile README link. Do not link to a speculative Pages URL before enabling it.

## Development and packaging

This version is intentionally buildless. The ring motion borrows the interaction idea from Mellow UI but is implemented here directly, rather than bundling its React source. The standalone source and its two adjacent stylesheets are under `src/`; the showcase and fictional activity example are under `demo/`; the curated data manifest and archived month-only public totals live under `data/`. There is no runtime dependency.

Before a public npm release, add cross-browser automated interaction tests, a tagged distributable build, release automation, and GitHub Pages deployment. The current version is an early public prototype.

MIT License. See [LICENSE](LICENSE).
