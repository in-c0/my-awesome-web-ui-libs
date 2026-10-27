// Everything the site says lives here as data: the pages, their live examples and the API tables.
// app.js draws it, the palette searches it, and "Copy page" turns the same blocks into Markdown.
// The API tables were written from src/profile-atlas.js and src/timeline-math.js; keep them in step.

export const NPM = '@in-c0/profile-atlas';
export const VERSION = '0.1.0';
export const REPO = 'https://github.com/in-c0/my-awesome-web-ui-libs';
export const SOURCE = `${REPO}/tree/main/packages/profile-atlas`;
export const PUBLIC_URL = 'https://in-c0.github.io/my-awesome-web-ui-libs/profile-atlas/docs/';
export const CDN = `https://cdn.jsdelivr.net/npm/${NPM}/src/profile-atlas.js`;
export const SHOWCASE = '../demo/index.html';
export const SHOWCASE_LIVE = 'https://profile-atlas-showcase.wldud5192.chatgpt.site/';

/** The files a copy-in install needs, all in one folder. */
export const FILES = [
  ['profile-atlas.js', 'Both custom elements. Imports timeline-math.js and links the three stylesheets by their path next to it.'],
  ['timeline-math.js', 'Date bucketing for the timeline. No DOM.'],
  ['profile-atlas.css', 'Theme tokens and the shared shell. Loaded into both shadow roots.'],
  ['github-activity-timeline.css', 'The activity timeline.'],
  ['mellow-overrides.css', 'The gallery, deck, index and detail views.'],
];

/* ───── shared tables ───── */

export const TOKENS = [
  ['paper', '#f5f3ec', '#1b1c18', 'The page of the atlas: gallery stage, toolbar, footer.'],
  ['surface', '#faf9f5', '#22231f', 'Cards, plates, dialogs and the monthly analysis.'],
  ['sunken', '#f0eee7', '#181915', 'The timeline band, text-only covers, hover fills.'],
  ['ink', '#252821', '#ebeae2', 'Headings, titles and figures.'],
  ['muted', '#74776d', '#a9a99e', 'Summaries and secondary labels.'],
  ['faint', '#94968b', '#85857b', 'Counters, axis ticks, idle tabs.'],
  ['line', '#dbd8cc', '#37382f', 'Borders and lane rules.'],
  ['line-soft', '#e7e4da', '#2d2e28', 'Row dividers inside lists.'],
  ['line-strong', '#bdb9ab', '#4c4d43', 'Underlines and hovered borders.'],
  ['grid', '#deded43d', '#ffffff0d', 'The faint grid behind the bars.'],
  ['accent', '#b5553a', '#e2906b', 'Kickers, LIVE marks, month-only notes.'],
  ['focus', '#4f7565', '#8fbba6', 'The focus ring.'],
  ['scrim', '#17231cc9', '#050605d9', 'Behind the index and detail dialogs.'],
  ['star', '#b39462', '#cdb17d', 'Star bars and icons.'],
  ['fork', '#8e93b0', '#a6aacb', 'Fork bars and icons.'],
  ['project', '#be876c', '#d49d83', 'New-repo bars and icons.'],
  ['commit', '#6e9b86', '#86b8a1', 'Push bars and icons.'],
];
const tokenTable = {
  head: ['Property', 'Used for'],
  rows: TOKENS.map(([n, , , use]) => [`\`--profile-atlas-${n}\``, use]),
};

const EVENT_FIELDS = {
  head: ['Field', 'Type', 'Description'],
  rows: [
    ['`id`', '`string`', 'Unique within the array.'],
    ['`type`', '`"star" | "fork" | "project" | "commit"`', 'The lane. Anything else is ignored.'],
    ['`title`', '`string`', 'Shown in the details list.'],
    ['`date`', '`string | Date | number`', 'An ISO string, a `Date` or a timestamp. Undated or invalid records are skipped.'],
    ['`summary`', '`string`', 'Optional second line in the details list.'],
    ['`url`', '`string`', 'Optional. Makes the title a link.'],
    ['`activityCount`', '`number`', 'Optional, default 1. How much this record adds to its bar.'],
    ['`aggregate`', '`boolean`', 'Optional. A month-only total: counted in monthly and yearly views, never placed on a day.'],
  ],
};

/* ───── examples ─────
   Each example is the code a reader copies. The site runs exactly that code: the markup goes into
   the preview frame, and the script runs with `document` scoped to the frame. Its import lines are
   the ones the reader needs; the site already has those modules loaded. */

// Paths are relative to docs/index.html.
const DATA = '../data/in-c0.json';

export const EX = {
  atlas: {
    id: 'atlas',
    html: `<profile-atlas manifest-url="${DATA}"></profile-atlas>`,
  },
  atlasHome: {
    id: 'atlas-home',
    html: `<profile-atlas compact row="project" manifest-url="${DATA}"></profile-atlas>`,
  },
  stories: {
    id: 'stories',
    html: `<profile-atlas compact row="story" manifest-url="${DATA}"></profile-atlas>`,
  },
  ownManifest: {
    id: 'own-manifest',
    html: `<profile-atlas compact row="project" manifest-url="examples/three-projects.json"></profile-atlas>`,
  },
  atlasLive: {
    id: 'atlas-live',
    lazy: 'Fetches up to 200 repositories and stars from GitHub’s public API, which allows 60 requests an hour per visitor.',
    html: `<profile-atlas username="in-c0" manifest-url="${DATA}" max-pages="2"></profile-atlas>`,
  },
  timeline: {
    id: 'timeline',
    html: `<github-activity-timeline range="all"></github-activity-timeline>`,
    js: `import '@in-c0/profile-atlas';
import { reconcileMonthlySnapshots } from '@in-c0/profile-atlas/timeline-math.js';

const manifest = await fetch('${DATA}').then((r) => r.json());

// Month-level totals for stars, forks and new repositories, as recorded on a date.
document.querySelector('github-activity-timeline').events = reconcileMonthlySnapshots(
  manifest.activitySnapshot,
  manifest.activitySnapshotRecordedAt,
  [],
);`,
  },
  ownEvents: {
    id: 'own-events',
    html: `<github-activity-timeline range="month"></github-activity-timeline>`,
    js: `import '@in-c0/profile-atlas';

const day = 24 * 60 * 60 * 1000;
const ago = (n) => Date.now() - n * day;

document.querySelector('github-activity-timeline').events = [
  { id: 'r1', type: 'project', title: 'profile-atlas', date: ago(12), url: 'https://github.com/in-c0/my-awesome-web-ui-libs' },
  { id: 's1', type: 'star', title: 'lit/lit', date: ago(10), url: 'https://github.com/lit/lit' },
  { id: 'p1', type: 'commit', title: 'Docs site', summary: '3 pushes', date: ago(9), activityCount: 3 },
  { id: 's2', type: 'star', title: 'open-wc/open-wc', date: ago(6), url: 'https://github.com/open-wc/open-wc' },
  { id: 'f1', type: 'fork', title: 'shoelace-style/shoelace', date: ago(4) },
  { id: 'p2', type: 'commit', title: 'Theme tokens', summary: '5 pushes', date: ago(2), activityCount: 5 },
  { id: 'p3', type: 'commit', title: 'Release notes', date: ago(0) },
];`,
  },
  ownPanel: {
    id: 'own-panel',
    html: `<github-activity-timeline range="all"></github-activity-timeline>
<p class="picked" aria-live="polite">Select a bar.</p>`,
    js: `import '@in-c0/profile-atlas';

const timeline = document.querySelector('github-activity-timeline');
const picked = document.querySelector('.picked');

timeline.events = [
  { id: 'a', type: 'star', title: 'Starred three repositories', date: '2025-03-04', activityCount: 3 },
  { id: 'b', type: 'project', title: 'Created a repository', date: '2025-09-18' },
  { id: 'c', type: 'fork', title: 'Forked a repository', date: '2026-02-11' },
];

timeline.addEventListener('activity-open', (event) => {
  event.preventDefault(); // keep the built-in panel closed
  const { label, items } = event.detail;
  picked.textContent = label + ': ' + items.map((item) => item.title).join(', ');
});`,
  },
  timelineLive: {
    id: 'timeline-live',
    lazy: 'Reads repositories, stars and recent public events from GitHub’s public API, which allows 60 requests an hour per visitor.',
    html: `<github-activity-timeline username="in-c0" max-pages="2"></github-activity-timeline>`,
  },
  math: {
    id: 'math',
    html: `<pre class="readout"><output>Loading…</output></pre>`,
    js: `import { activityWindow, reconcileMonthlySnapshots } from '@in-c0/profile-atlas/timeline-math.js';

const manifest = await fetch('${DATA}').then((r) => r.json());
const items = reconcileMonthlySnapshots(manifest.activitySnapshot, manifest.activitySnapshotRecordedAt, []);
const year = activityWindow('year', items);

document.querySelector('output').textContent = [
  year.label + ' · one bin per ' + year.grain,
  ...year.bins.map((bin) => bin.label.padEnd(10) + 'stars ' + String(bin.counts.star).padStart(3)
    + '   forks ' + String(bin.counts.fork).padStart(2) + '   repos ' + String(bin.counts.project).padStart(2)),
].join('\\n');`,
  },
  theming: {
    id: 'theming',
    html: `<profile-atlas
  compact row="project"
  manifest-url="examples/three-projects.json"
  style="--profile-atlas-paper: #eef0f3; --profile-atlas-surface: #f9fafb;
         --profile-atlas-accent: #2f5fb3; --profile-atlas-line: #d5dae2"
></profile-atlas>`,
    pinTheme: true,
  },
};

/* ───── pages ───── */

const a11yAtlas = [
  'Each card in the gallery is a button named by its title. Focus fans the stack open at that card, so Tab walks the visible window; Enter or Space opens the details.',
  'With focus in the gallery, ← and → move the window by one card. Keys pressed inside the nested timeline, a search field or a dialog are left alone.',
  'The index and the details view are modal dialogs (`role="dialog"`, `aria-modal`). Focus moves into them, Tab stays inside, Escape closes them and returns focus to what opened them.',
  'The collection tabs are buttons with `aria-pressed`. A collection with no entries gets no tab.',
  'Known gap: the card caption changes on hover and focus without a live region, so a screen reader hears the card name from the button, not the caption.',
];
const motionAtlas = [
  'Under `prefers-reduced-motion: reduce` the cards and the deck stop animating between positions, video previews stay on their poster frame, and the details view does not autoplay.',
];
const a11yTimeline = [
  'Every bar is a button. Its name gives the type, the period and the count, for example “Star · Oct 2026: 24 recorded. Open records.”',
  'The period choices and the four lane labels are buttons with `aria-pressed`; a lane label highlights its type.',
  'The plot is a focusable, labelled scroll region, so keyboard users can scroll a long range sideways. The details panel is a labelled region placed before the monthly analysis.',
  'Colour is never the only signal: each lane has an icon and a text label, and the monthly analysis repeats the counts as numbers.',
];
const motionTimeline = [
  'Under `prefers-reduced-motion: reduce` bars do not grow on hover and the details panel scrolls into view without smooth scrolling.',
];

const installBlock = { install: true };

export const PAGES = [
  {
    id: 'introduction', group: 'Getting started', name: 'Introduction',
    summary: 'Two framework-free custom elements that show more of a GitHub profile than six pinned repositories.',
    blocks: [
      { p: 'Profile Atlas is a small library of Web Components for a personal site. Point it at a GitHub username, a JSON manifest of the work you want to feature, or both, and it draws a project gallery with a searchable index and a four-lane timeline of public activity.' },
      { p: 'It is plain JavaScript modules and CSS: no framework, no build step, no runtime dependency and no API token. The elements render into shadow roots, so they keep their own styles on any page.' },
      { h2: 'What is in it', id: 'contents' },
      { table: { head: ['Piece', 'What it does'], rows: [
        ['[`<profile-atlas>`](#profile-atlas)', 'A gallery of what you made, starred and forked, a searchable index, a details view and the activity timeline, from GitHub, a manifest or both.'],
        ['[`<github-activity-timeline>`](#timeline)', 'Stars, forks, new repositories and pushes on one shared time scale. Takes a username or any dated `events` array.'],
        ['[`timeline-math.js`](#timeline-math)', 'The date bucketing behind the timeline, as two pure functions you can use on their own.'],
        ['[Manifest](#manifest)', 'The JSON file that curates projects, stories, inspiration and a month-level history.'],
      ] } },
      { h2: 'Data and its limits', id: 'limits' },
      { p: 'Everything comes from GitHub’s public, unauthenticated REST API, cached in the visitor’s browser for six hours. That keeps the elements token-free, and it has limits worth stating plainly:' },
      { list: [
        'Repositories come from the user’s repository list; forks are dated by when the fork was created.',
        'Stars use the starred-at time, requested with `Accept: application/vnd.github.star+json`.',
        '**Push** comes from the recent public event feed. It is not a commit history, one push can hold many commits, and GitHub keeps only about 30 days or 300 events.',
        'Unauthenticated requests are limited to 60 an hour per visitor. When a feed fails, the atlas still renders the manifest and says that a feed was unavailable.',
        'A manifest’s `activitySnapshot` adds month-level totals for older history. They count in monthly and yearly views and are never assigned an invented day.',
        '`projectVisibility: "curated"` hides the titles of unfeatured repositories in the gallery and counts their creation by month only. It does not make a public repository private.',
      ] },
      { h2: 'The showcase', id: 'showcase' },
      { p: `The owner’s own page is built from the same data with its own layout, and is [included in this site](${SHOWCASE}). It shows what a manifest can carry; the elements on these pages are what you install.` },
    ],
  },
  {
    id: 'installation', group: 'Getting started', name: 'Installation',
    summary: 'From npm, from a CDN with one script tag, or by copying five files into your site.',
    blocks: [
      installBlock,
      { h2: 'Use it', id: 'use' },
      { p: 'After that, the elements work anywhere HTML does.' },
      { code: `<profile-atlas username="your-github-name" manifest-url="/atlas.json"></profile-atlas>`, lang: 'html' },
      { h2: 'With a bundler', id: 'bundlers' },
      { p: 'The module finds its stylesheets with `new URL("./profile-atlas.css", import.meta.url)`, so they must stay next to it. Vite and webpack 5 copy files referenced that way into production builds.' },
      { p: 'Vite’s dev server pre-bundles dependencies into another folder, which breaks that relative path. Exclude the package from pre-bundling:' },
      { code: `// vite.config.js
export default {
  optimizeDeps: { exclude: ['@in-c0/profile-atlas'] },
};`, lang: 'js', title: 'vite.config.js' },
      { h2: 'Frameworks', id: 'frameworks' },
      { p: 'They are standard custom elements, so React 19, Vue, Svelte, Astro and plain HTML render them as they are. Set `events` as a property, not an attribute: in React 19 pass it as a prop, in Vue use `:events.prop`, in Lit use `.events`. Server rendering outputs the empty tag, and the element draws itself once the module loads in the browser.' },
    ],
  },
  {
    id: 'profile-atlas', group: 'Elements', name: '<profile-atlas>', tag: 'profile-atlas', mono: true,
    summary: 'A gallery of what you made, starred and forked, with a searchable index, a details view and the activity timeline.',
    preview: EX.atlas,
    usage: [
      { code: `<script type="module" src="${CDN}"></script>

<profile-atlas username="your-github-name" manifest-url="/atlas.json"></profile-atlas>`, lang: 'html' },
      { p: 'With a username, it reads public repositories, stars and recent pushes from GitHub. With a [manifest](#manifest), it shows the projects, stories and inspiration you curate, and fills in older history from a month-level snapshot. Give it both, or either one: the preview above uses only the bundled manifest, so it makes no GitHub request.' },
    ],
    examples: [
      { ...EX.stories, title: 'Stories as a deck', text: '`compact` removes the tabs, the timeline and the footer, and `row` chooses the collection. Stories are drawn as a deck: drag the front card aside, or use the arrows.' },
      { ...EX.ownManifest, title: 'Your own manifest', text: 'Three projects and no username, so nothing is requested from GitHub. The image path in the manifest is resolved from the manifest file, not the page; a project without an image gets a cover set in its own title.', extra: { file: 'examples/three-projects.json', lang: 'json' } },
      { ...EX.atlasLive, title: 'Live from GitHub', text: 'The same manifest with a username. Live repositories and stars join the curated projects, and Saved and Remixed tabs appear when there are stars and forks to show.' },
    ],
    api: [
      { h: 'Attributes', id: 'attributes', head: ['Attribute', 'Type', 'Default', 'Description'], rows: [
        ['`username`', '`string`', '–', 'A GitHub username. Optional when `manifest-url` is set.'],
        ['`manifest-url`', '`string`', '–', 'URL of a [manifest](#manifest), resolved against the page. HTTP or HTTPS only.'],
        ['`max-pages`', '`number`', '`10`', 'Pages of 100 to fetch per feed, from 1 to 30. A note appears when the limit is reached.'],
        ['`row`', '`"project" | "star" | "fork" | "story" | "inspiration"`', '`"project"`', 'The collection to show first. With `compact`, the only one.'],
        ['`compact`', '`boolean`', '–', 'Gallery only: no tabs, timeline or footer.'],
        ['`theme`', '`"light" | "dark" | "auto"`', '`"light"`', '`auto` follows `prefers-color-scheme`. Passed on to the nested timeline.'],
      ] },
      { h: 'Properties and methods', id: 'properties', head: ['Name', 'Type', 'Description'], rows: [
        ['`items`', '`object[]`', 'Every entry after loading: owned repositories, the manifest’s projects, stars, stories and inspiration.'],
        ['`kind`', '`string`', 'The collection on show. Set `row` to change it.'],
        ['`load()`', '`() => Promise<void>`', 'Fetch again. Results are cached in `localStorage` for six hours per username and `max-pages`.'],
      ] },
      { h: 'Events', id: 'events', head: ['Event', 'Detail', 'Description'], rows: [
        ['`atlas-ready`', '`{ count: number }`', 'Fired after each load, with the number of `items`. Bubbles.'],
        ['`activity-open`', '`{ items, label }`', 'From the nested timeline when a bar is chosen. Bubbles out of the shadow root and is cancellable. See [the timeline](#timeline/timeline-events).'],
      ] },
      { h: 'CSS custom properties', id: 'css', ...tokenTable, note: 'Set on the element or any ancestor; defaults for light and dark are on [Theming](#theming/tokens).' },
    ],
    a11y: a11yAtlas, motion: motionAtlas,
  },
  {
    id: 'timeline', group: 'Elements', name: '<github-activity-timeline>', tag: 'github-activity-timeline', mono: true,
    summary: 'Stars, forks, new repositories and pushes in four lanes on one time scale, from a username or any dated events array.',
    preview: EX.timeline,
    usage: [
      { code: `<script type="module" src="${CDN}"></script>

<github-activity-timeline username="your-github-name"></github-activity-timeline>`, lang: 'html' },
      { p: 'Or give it records of your own. Setting `events` stops it from fetching, even when it has a username.' },
      { code: `document.querySelector('github-activity-timeline').events = [
  { id: 'a', type: 'star', title: 'lit/lit', date: '2026-10-04T09:30:00Z', url: 'https://github.com/lit/lit' },
  { id: 'b', type: 'commit', title: 'Release', date: new Date(), activityCount: 4 },
];`, lang: 'js' },
      { p: 'Choose a period above the plot, a lane label to highlight one type, or a bar to list its records. Under the plot, the monthly analysis gives exact counts for any month in the data.' },
    ],
    examples: [
      { ...EX.ownEvents, title: 'A feed of your own', text: 'Any dated list works: releases, posts, talks. Dates can be strings, `Date` objects or timestamps, and `activityCount` lets one record stand for several.' },
      { ...EX.ownPanel, title: 'Your own details panel', text: '`activity-open` fires before the built-in panel opens. Cancel it and show the records your own way.' },
      { ...EX.timelineLive, title: 'Live from GitHub', text: 'With a username, the timeline reads public repositories, stars and the recent push feed.' },
    ],
    api: [
      { h: 'Attributes', id: 'attributes', head: ['Attribute', 'Type', 'Default', 'Description'], rows: [
        ['`username`', '`string`', '–', 'A GitHub username to read public activity for. Ignored once `events` is set.'],
        ['`max-pages`', '`number`', '`10`', 'Pages of 100 to fetch for repositories and stars, from 1 to 30. Recent events always read up to 3 pages.'],
        ['`range`', '`"week" | "month" | "year" | "five" | "all"`', '`"year"`', 'The first period shown. Week and month have a bar per day; year and five years a bar per month; all switches to years past six years.'],
        ['`theme`', '`"light" | "dark" | "auto"`', '`"light"`', '`auto` follows `prefers-color-scheme`.'],
      ] },
      { h: 'Properties and methods', id: 'properties', head: ['Name', 'Type', 'Description'], rows: [
        ['`events`', '`ActivityEvent[]`', 'The records to plot. Can be set before the element is defined. Records with another `type` or no valid date are skipped.'],
        ['`range`', '`string`', 'The period on show. Unknown values are ignored.'],
        ['`load()`', '`() => Promise<void>`', 'Fetch the username’s activity again. Does nothing once `events` has been set.'],
        ['`showDetails(items, label)`', '`(object[], string) => void`', 'Open the built-in details panel with any records.'],
      ] },
      { h: 'Event records', id: 'records', ...EVENT_FIELDS },
      { h: 'Events', id: 'timeline-events', head: ['Event', 'Detail', 'Description'], rows: [
        ['`activity-open`', '`{ items: ActivityEvent[], label: string }`', 'A bar, a monthly count or Browse activity was chosen. Bubbles, crosses shadow roots, and is cancellable: `preventDefault()` keeps the built-in panel closed.'],
      ] },
      { h: 'CSS custom properties', id: 'css', ...tokenTable, note: 'The same tokens as `<profile-atlas>`; defaults are on [Theming](#theming/tokens).' },
    ],
    a11y: a11yTimeline, motion: motionTimeline,
  },
  {
    id: 'timeline-math', group: 'Modules', name: 'timeline-math.js', mono: true,
    summary: 'The date bucketing behind the timeline, as two pure functions with no DOM.',
    preview: EX.math, previewLabel: 'Output',
    importLine: `import {
  activityWindow,
  reconcileMonthlySnapshots,
  ACTIVITY_TYPES,
} from '${NPM}/timeline-math.js';`,
    usage: [
      { code: `import { activityWindow } from '${NPM}/timeline-math.js';

const week = activityWindow('week', records);
week.bins;   // seven days, Monday first
week.totals; // { star, fork, project, commit }`, lang: 'js' },
      { p: 'It runs in Node and in workers, so a build step or a server can count activity the same way the timeline draws it. Days and months are in the local time zone of wherever it runs.' },
    ],
    examples: [],
    api: [
      { h: 'activityWindow()', id: 'activity-window', note: 'Signature: `activityWindow(range, items, now = new Date())`. Returns the object above.', head: ['Returns', 'Type', 'Description'], rows: [
        ['`range`', '`string`', 'The range used: `week`, `month`, `year`, `five` or `all`. Anything else is treated as `year`.'],
        ['`grain`', '`"day" | "month" | "year"`', 'One bin per day, month or year.'],
        ['`bins`', '`Bin[]`', 'Each with `key`, `label`, `start`, `end`, `future`, `items` and `counts` per type.'],
        ['`totals`', '`Record<type, number>`', 'Sums of `activityCount` in the range. Records after `now` are left out.'],
        ['`label`', '`string`', 'A readable period, such as “Oct 2021 – Oct 2026”.'],
        ['`monthOnlyOmitted`', '`number`', 'Month-only totals that a daily view could not place.'],
      ] },
      { h: 'reconcileMonthlySnapshots()', id: 'reconcile', note: 'Signature: `reconcileMonthlySnapshots(rows, recordedAt, known)`.', head: ['Argument', 'Type', 'Description'], rows: [
        ['`rows`', '`[month, stars, forks, repos][]`', 'Month-level totals, with `month` as `"YYYY-MM"`.'],
        ['`recordedAt`', '`string`', 'When the totals were taken. Used in each record’s summary.'],
        ['`known`', '`object[]`', 'Dated records you already have. Only what they do not account for is added, so nothing is counted twice.'],
        ['returns', '`ActivityEvent[]`', 'One `aggregate: true` record per month and type that still has a remainder.'],
      ] },
      { h: 'ACTIVITY_TYPES', id: 'types', head: ['Export', 'Value'], rows: [['`ACTIVITY_TYPES`', '`["star", "fork", "project", "commit"]`']] },
    ],
    a11y: null, motion: null,
  },
  {
    id: 'manifest', group: 'Reference', name: 'Manifest',
    summary: 'A JSON file that curates what the atlas shows: projects, stories, inspiration and a month-level history.',
    blocks: [
      { p: 'Point `manifest-url` at it. Every field is optional. The [bundled example](../data/in-c0.json) is the owner’s real manifest; the smallest useful one is a list of projects.' },
      { code: '@file:examples/three-projects.json', lang: 'json', title: 'three-projects.json' },
      { h2: 'Top level', id: 'top' },
      { table: { head: ['Field', 'Type', 'Description'], rows: [
        ['`projects`', '`Item[]`', 'Your work, shown first under Made in the order given. An item whose `repo` matches a fetched repository is merged with it.'],
        ['`stories`', '`Item[]`', 'Short notes, drawn as a deck with `row="story"`.'],
        ['`inspirations`', '`Item[]`', 'Images and clips you collected, with `row="inspiration"`.'],
        ['`excludeRepos`', '`string[]`', 'Repositories to leave out. A name matches when it contains the text.'],
        ['`projectVisibility`', '`"curated"`', 'Only featured projects are named; other repositories you created count by month in the timeline.'],
        ['`activitySnapshot`', '`[month, stars, forks, repos][]`', 'Month-level totals for history the API no longer returns, such as `["2024-09", 45, 4, 8]`.'],
        ['`activitySnapshotRecordedAt`', '`string`', 'The date those totals were taken.'],
      ] } },
      { h2: 'Items', id: 'items' },
      { table: { head: ['Field', 'Type', 'Description'], rows: [
        ['`id`', '`string`', 'Stable identifier.'],
        ['`title`', '`string`', 'The card and index title.'],
        ['`summary`', '`string`', 'One sentence on the card.'],
        ['`body`', '`string`', 'Longer text for the details view. Line breaks are kept.'],
        ['`url`', '`string`', 'Source or home page.'],
        ['`demoUrl`', '`string`', 'A live product. Adds a LIVE mark and a Live demo link.'],
        ['`repo`', '`string`', '`owner/name`, to merge with the fetched repository and take its date.'],
        ['`image`', '`string`', 'A screenshot or a video URL, relative to the manifest file.'],
        ['`mediaType`', '`"video"`', 'Treat `image` as a muted, looping clip.'],
        ['`poster`', '`string`', 'Still frame for a video.'],
        ['`preview`', '`"image" | "iframe" | "video" | "link"`', 'How the details view shows `demoUrl` when there is no image.'],
        ['`date`', '`string`', 'ISO date, for sorting and the details view.'],
        ['`language`', '`string`', 'Shown in the index and on text covers.'],
        ['`featured`', '`boolean`', 'Sorts first under Made.'],
      ] } },
      { h2: 'Images', id: 'images' },
      { p: 'Paths in `image` and `poster` resolve from the manifest, so `../assets/shot.webp` next to `data/atlas.json` means `assets/shot.webp`. Only HTTP and HTTPS URLs are used. An item with no image, or one that fails to load, gets a cover set in its own title, category and domain instead of an empty box.' },
    ],
  },
  {
    id: 'theming', group: 'Reference', name: 'Theming',
    summary: 'Seventeen custom properties and a theme attribute. Set them on an element or on anything above it.',
    blocks: [
      { preview: EX.theming },
      { h2: 'Light, dark or automatic', id: 'theme' },
      { p: 'Light is the default. `theme="dark"` pins the dark set, and `theme="auto"` follows the visitor’s `prefers-color-scheme`. `<profile-atlas>` passes its theme to the timeline inside it. This site sets `theme` on every preview to match its own toggle.' },
      { code: `<profile-atlas theme="auto" username="your-github-name"></profile-atlas>`, lang: 'html' },
      { h2: 'Tokens', id: 'tokens' },
      { p: 'Custom properties inherit into shadow roots, so you can set them in your own stylesheet. A token you set wins in both themes.' },
      { code: `profile-atlas, github-activity-timeline {
  --profile-atlas-paper: var(--background);
  --profile-atlas-ink: var(--foreground);
  --profile-atlas-accent: #2f5fb3;
}`, lang: 'css', title: 'site.css' },
      { table: { head: ['Property', 'Light', 'Dark', 'Used for'], rows: TOKENS.map(([n, l, d, use]) => [`\`--profile-atlas-${n}\``, `\`${l}\``, `\`${d}\``, use]) } },
      { h2: 'Type', id: 'type' },
      { p: 'Headings use Georgia, labels and body text use Inter, falling back to the system sans. Both inherit nothing from the page, so load Inter yourself if you want it rather than the fallback.' },
    ],
  },
];

export const GROUPS = ['Getting started', 'Elements', 'Modules', 'Reference'];
export const ELEMENTS = PAGES.filter((p) => p.group === 'Elements');
