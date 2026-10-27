// The Profile Atlas documentation: plain DOM, hash routes (#timeline, #timeline/attributes), no build.
import * as atlasModule from '@in-c0/profile-atlas';
import * as mathModule from '@in-c0/profile-atlas/timeline-math.js';
import { CDN, ELEMENTS, EX, FILES, GROUPS, NPM, PAGES, PUBLIC_URL, REPO, SHOWCASE, SOURCE, VERSION } from './content.js';
import { esc, highlight } from './highlight.js';

const $ = (sel, root = document) => root.querySelector(sel);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage off: keep it for this visit */ } },
};

/* ───── icons: 16px, 1.6 stroke ───── */
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
const I = {
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  replay: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>'),
  terminal: svg('<path d="m5 7 5 5-5 5"/><path d="M12 17h7"/>'),
  chevDown: svg('<path d="m7 10 5 5 5-5"/>'),
  left: svg('<path d="M14 6 8 12l6 6"/>'),
  right: svg('<path d="m10 6 6 6-6 6"/>'),
  ext: svg('<path d="M14 5h5v5"/><path d="M19 5 11 13"/><path d="M18 14v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18V7.5A1.5 1.5 0 0 1 5.5 6H10"/>'),
  file: svg('<path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5Z"/><path d="M14 3.5V8h4"/>'),
  download: svg('<path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>'),
  github: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.84c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
};
/** The mark: three bars on a baseline, the timeline in miniature. */
const MARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 19.5h17" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><rect x="5" y="12" width="3" height="6" rx=".7" fill="var(--c-star)"/><rect x="10.5" y="6" width="3" height="12" rx=".7" fill="var(--c-project)"/><rect x="16" y="9.5" width="3" height="8.5" rx=".7" fill="var(--c-commit)"/></svg>';

/* ───── inline markdown: `code`, **bold**, [text](href) ───── */
const external = (href) => /^https?:/.test(href);
function inline(s) {
  const codes = [];
  let t = esc(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => `<a href="${href}"${external(href) ? ' target="_blank" rel="noreferrer"' : ''}>${text}</a>`);
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}
/** Links in exported Markdown point at the public site. */
const absolute = (s) => s.replace(/\]\(([^)\s]+)\)/g, (_, href) => `](${new URL(href, PUBLIC_URL).href})`);

/* ───── copy, with the icon swapping to a check for 2 s ───── */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const t = Object.assign(document.createElement('textarea'), { value: text });
      t.style.cssText = 'position:fixed;opacity:0'; document.body.append(t); t.select();
      const ok = document.execCommand('copy'); t.remove(); return ok;
    } catch { return false; }
  }
}
function copyButton(text, label = 'Copy', cls = 'icon-btn copy-btn') {
  const b = h(`<button type="button" class="${cls}" aria-label="${esc(label)}" title="${esc(label)}">${I.copy}</button>`);
  let timer = 0;
  b.addEventListener('click', async () => {
    if (!(await copyText(typeof text === 'function' ? await text() : text))) return;
    b.innerHTML = I.check; b.dataset.done = ''; b.setAttribute('aria-label', 'Copied'); b.title = 'Copied';
    clearTimeout(timer);
    timer = setTimeout(() => { b.innerHTML = I.copy; delete b.dataset.done; b.setAttribute('aria-label', label); b.title = label; }, 2000);
  });
  return b;
}

/* ───── code blocks ───── */
const files = new Map();
const fileText = (path) => {
  if (!files.has(path)) files.set(path, fetch(path).then((r) => (r.ok ? r.text() : '')).then((t) => t.trimEnd()).catch(() => ''));
  return files.get(path);
};
function codeBlock(code, lang = 'js', { title, collapse = true } = {}) {
  const box = h(`<div class="code">${title ? `<div class="code-title">${I.file}<span>${esc(title)}</span></div>` : ''}<pre tabindex="0"><code></code></pre><div class="code-copy"></div></div>`);
  const fill = (text) => {
    $('code', box).innerHTML = highlight(text, lang);
    $('.code-copy', box).replaceChildren(copyButton(text, 'Copy code'));
    const lines = text.split('\n').length;
    if (collapse && lines > 18 && !box.querySelector('.fade')) {
      box.classList.add('collapsed');
      const fade = h(`<div class="fade"><button type="button" class="btn sm">Expand · ${lines} lines</button></div>`);
      fade.firstElementChild.addEventListener('click', () => { box.classList.remove('collapsed'); fade.remove(); $('pre', box).focus({ preventScroll: true }); });
      box.append(fade);
    }
  };
  if (code.startsWith('@file:')) { fill('…'); fileText(code.slice(6)).then(fill); } else fill(code);
  return box;
}

/* ───── segmented control with a sliding pill ───── */
function seg(options, value, onChange, label) {
  const el = h(`<div class="seg" role="group" aria-label="${esc(label)}"><span class="pill" aria-hidden="true"></span>${options.map(([v, text]) => `<button type="button" data-v="${v}" aria-pressed="${v === value}">${esc(text)}</button>`).join('')}</div>`);
  const place = () => {
    const b = el.querySelector('[aria-pressed="true"]'); if (!b || !b.offsetWidth) return;
    Object.assign($('.pill', el).style, { left: b.offsetLeft + 'px', width: b.offsetWidth + 'px' });
  };
  el.set = (v) => { el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v))); place(); };
  el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; el.set(b.dataset.v); onChange(b.dataset.v); });
  new ResizeObserver(place).observe(el);
  return el;
}

/* ───── tabs (install method; package manager) ───── */
function tabs(id, items, initial) {
  const el = h(`<div class="tabs"><div class="tablist" role="tablist" aria-label="${esc(id)}"></div></div>`);
  const list = $('.tablist', el);
  let current = items.some((t) => t.id === initial) ? initial : items[0].id;
  const panels = items.map((t) => {
    const tab = h(`<button type="button" role="tab" id="${id}-${t.id}" aria-controls="${id}-${t.id}-panel">${esc(t.label)}</button>`);
    const panel = h(`<div role="tabpanel" id="${id}-${t.id}-panel" aria-labelledby="${id}-${t.id}" tabindex="0"></div>`);
    panel.append(t.body());
    list.append(tab); el.append(panel);
    tab.addEventListener('click', () => select(t.id));
    return { id: t.id, tab, panel };
  });
  list.addEventListener('keydown', (e) => {
    const i = panels.findIndex((p) => p.id === current);
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault(); const next = panels[(i + step + panels.length) % panels.length]; select(next.id); next.tab.focus();
  });
  function select(v) {
    current = v;
    for (const p of panels) { const on = p.id === v; p.tab.setAttribute('aria-selected', String(on)); p.tab.tabIndex = on ? 0 : -1; p.panel.hidden = !on; }
  }
  select(current);
  return el;
}

const PMS = { npm: 'npm i', pnpm: 'pnpm add', yarn: 'yarn add', bun: 'bun add' };
function command(pkg) {
  let pm = PMS[store.get('profile-atlas-pm')] ? store.get('profile-atlas-pm') : 'npm';
  const el = h(`<div class="cmd"><div class="cmd-bar" role="tablist" aria-label="Package manager">${I.terminal}${Object.keys(PMS).map((p) => `<button type="button" role="tab" data-pm="${p}">${p}</button>`).join('')}<span class="grow"></span></div><pre><code></code></pre></div>`);
  const text = () => `${PMS[pm]} ${pkg}`;
  const draw = () => {
    el.querySelectorAll('[data-pm]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.pm === pm)));
    $('code', el).innerHTML = highlight(text(), 'sh');
  };
  $('.cmd-bar', el).append(copyButton(() => text(), 'Copy command'));
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pm]'); if (!b) return;
    pm = b.dataset.pm; store.set('profile-atlas-pm', pm);
    // every command block on the page follows the same choice
    document.querySelectorAll('.cmd').forEach((c) => c.sync?.());
  });
  el.sync = () => { pm = PMS[store.get('profile-atlas-pm')] ? store.get('profile-atlas-pm') : pm; draw(); };
  draw();
  return el;
}

/* ───── theme ───── */
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const effectiveTheme = () => document.documentElement.dataset.theme || (systemDark.matches ? 'dark' : 'light');
function themeComponents(root = document) {
  const theme = effectiveTheme();
  root.querySelectorAll('profile-atlas:not([data-pin-theme]), github-activity-timeline:not([data-pin-theme])').forEach((el) => el.setAttribute('theme', theme));
}
function toggleTheme() {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next; store.set('profile-atlas-theme', next);
  themeComponents(); drawThemeButton();
}
systemDark.addEventListener('change', () => { if (!document.documentElement.dataset.theme) { themeComponents(); drawThemeButton(); } });
function drawThemeButton() {
  const b = $('#theme-btn'); if (!b) return;
  const dark = effectiveTheme() === 'dark';
  b.innerHTML = dark ? I.sun : I.moon; b.setAttribute('aria-label', dark ? 'Use light theme' : 'Use dark theme');
}

/* ───── live examples ─────
   An example's markup goes into the frame; its script runs with `document` scoped to the frame,
   and its import lines are served from the modules this page has already loaded. */
const MODULES = { [NPM]: atlasModule, [`${NPM}/profile-atlas.js`]: atlasModule, [`${NPM}/timeline-math.js`]: mathModule };
const AsyncFunction = (async () => {}).constructor;
function runScript(code, root) {
  const body = code.replace(/^import\s+(?:\{([^}]*)\}\s+from\s+)?['"]([^'"]+)['"];?[ \t]*$/gm, (_, names, spec) => {
    if (!(spec in MODULES)) throw Error(`Unknown module ${spec}`);
    return names ? `const {${names}} = __modules[${JSON.stringify(spec)}];` : '';
  });
  const scope = { querySelector: (s) => root.querySelector(s), querySelectorAll: (s) => root.querySelectorAll(s) };
  return new AsyncFunction('document', '__modules', body)(scope, MODULES);
}
const exampleCode = (ex) => ex.js ? `${ex.html}\n\n<script type="module">\n${ex.js.replace(/^/gm, '  ').replace(/^ +$/gm, '')}\n</script>` : ex.html;

async function mount(stage, ex, { live = !ex.lazy } = {}) {
  stage.replaceChildren();
  if (!live) {
    const wait = h(`<div class="stage-wait"><p>${esc(ex.lazy)}</p><button type="button" class="btn sm">${I.github}Load from GitHub</button></div>`);
    wait.querySelector('button').addEventListener('click', () => mount(stage, ex, { live: true }));
    stage.append(wait); return;
  }
  const holder = document.createElement('div');
  holder.className = 'stage-inner';
  holder.innerHTML = ex.html;
  if (ex.pinTheme) holder.querySelectorAll('profile-atlas, github-activity-timeline').forEach((el) => el.setAttribute('data-pin-theme', ''));
  themeComponents(holder);
  stage.append(holder);
  if (ex.js) {
    try { await runScript(ex.js, holder); } catch (err) { holder.append(h(`<p class="stage-error">This example did not run: ${esc(err.message)}</p>`)); }
  }
}

function preview(ex, { small = false, label = 'Preview' } = {}) {
  const el = h(`<div class="preview${small ? ' sm' : ''}"><div class="preview-bar"></div><div class="preview-stage"></div><div class="preview-code" hidden></div></div>`);
  const stage = $('.preview-stage', el), codeView = $('.preview-code', el);
  let tab = 'preview';
  const switcher = seg([['preview', label], ['code', 'Code']], tab, (v) => show(v), 'View');
  const replay = h(`<button type="button" class="icon-btn" aria-label="Replay" title="Replay">${I.replay}</button>`);
  replay.addEventListener('click', () => { show('preview'); switcher.set('preview'); mount(stage, ex, { live: !ex.lazy || !!stage.querySelector('.stage-inner') }); });
  $('.preview-bar', el).append(switcher, h('<span class="grow"></span>'), replay);
  codeView.append(codeBlock(exampleCode(ex), 'html', { collapse: false }));
  function show(v) { tab = v; stage.hidden = v !== 'preview'; codeView.hidden = v !== 'code'; }
  mount(stage, ex);
  return el;
}

/* ───── page chrome ───── */
const route = () => {
  const [page = '', anchor = ''] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  return { page, anchor };
};
const pageById = (id) => PAGES.find((p) => p.id === id);
const pageIndex = (id) => PAGES.findIndex((p) => p.id === id);
const title = (p) => (p.mono ? `<code class="h-code">${esc(p.name)}</code>` : esc(p.name));

function sideNav(current) {
  return GROUPS.map((g) => `<div class="nav-group"><h4>${g}</h4>${PAGES.filter((p) => p.group === g).map((p) => `<a href="#${p.id}"${p.id === current ? ' aria-current="page"' : ''}${p.mono ? ' class="mono"' : ''}>${esc(p.name)}</a>`).join('')}</div>`).join('')
    + `<div class="nav-group"><h4>Elsewhere</h4><a href="${SHOWCASE}">The showcase</a><a href="llms.txt">llms.txt</a><a href="${SOURCE}" target="_blank" rel="noreferrer">Source</a></div>`;
}

function header() {
  const el = h(`<header class="header"><div class="wrap header-in">
    <button type="button" class="icon-btn menu-btn" id="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">${I.menu}</button>
    <a class="brand" href="#">${MARK}<span>Profile Atlas</span></a>
    <nav class="nav" aria-label="Main">
      <a href="#introduction" data-match="introduction installation">Docs</a>
      <a href="#profile-atlas" data-match="profile-atlas timeline timeline-math">Elements</a>
      <a href="#manifest" data-match="manifest">Manifest</a>
      <a href="#theming" data-match="theming">Theming</a>
      <a href="${SHOWCASE}">Showcase</a>
    </nav>
    <div class="header-right">
      <button type="button" class="search" id="search-btn" aria-label="Search the docs" aria-keyshortcuts="${isMac ? 'Meta+K' : 'Control+K'} /">${I.search}<span>Search the docs…</span><kbd class="kbd">${isMac ? '⌘' : 'Ctrl '}K</kbd></button>
      <span class="sep" aria-hidden="true"></span>
      <a class="icon-btn" href="${SOURCE}" target="_blank" rel="noreferrer" aria-label="Source on GitHub">${I.github}</a>
      <button type="button" class="icon-btn" id="theme-btn" title="Toggle theme (D)"></button>
    </div>
  </div></header>`);
  $('#search-btn', el).addEventListener('click', openPalette);
  $('#theme-btn', el).addEventListener('click', toggleTheme);
  $('#menu-btn', el).addEventListener('click', () => setDrawer(!document.body.classList.contains('drawer-open')));
  return el;
}
function setDrawer(open) {
  document.body.classList.toggle('drawer-open', open);
  const b = $('#menu-btn'); b.setAttribute('aria-expanded', String(open)); b.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  b.innerHTML = open ? I.close : I.menu;
  if (open) $('#drawer a')?.focus();
}

function pageActions(page) {
  const prompt = encodeURIComponent(`I'm using ${page.name === 'Introduction' ? 'Profile Atlas' : page.name + ' from Profile Atlas'} (${PUBLIC_URL}, npm ${NPM}). Read ${PUBLIC_URL}llms.txt and help me with it.`);
  const el = h(`<div class="split">
    <button type="button" class="btn sm" data-copy>${I.copy}<span>Copy page</span></button>
    <button type="button" class="btn sm" aria-label="More page actions" aria-haspopup="menu" aria-expanded="false" data-more>${I.chevDown}</button>
    <div class="menu" role="menu" hidden>
      <button type="button" role="menuitem" data-copy>${I.copy}Copy as Markdown</button>
      <a role="menuitem" href="https://claude.ai/new?q=${prompt}" target="_blank" rel="noreferrer">${I.ext}Open in Claude</a>
      <a role="menuitem" href="https://chatgpt.com/?q=${prompt}" target="_blank" rel="noreferrer">${I.ext}Open in ChatGPT</a>
      <a role="menuitem" href="llms.txt" target="_blank" rel="noreferrer">${I.file}llms.txt</a>
    </div></div>`);
  const menu = $('.menu', el), more = $('[data-more]', el), main = el.querySelector('.btn[data-copy]');
  let timer = 0;
  const close = () => { menu.hidden = true; more.setAttribute('aria-expanded', 'false'); };
  el.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    close();
    if (!(await copyText(await pageMarkdown(page)))) return;
    main.innerHTML = `${I.check}<span>Copied</span>`; clearTimeout(timer);
    timer = setTimeout(() => { main.innerHTML = `${I.copy}<span>Copy page</span>`; }, 2000);
  }));
  more.addEventListener('click', () => {
    const open = menu.hidden; menu.hidden = !open; more.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('[role=menuitem]').focus();
  });
  menu.addEventListener('keydown', (e) => {
    const items = [...menu.querySelectorAll('[role=menuitem]')], i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
    if (e.key === 'Escape') { close(); more.focus(); }
  });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  document.addEventListener('pointerdown', (e) => { if (!el.contains(e.target)) close(); });
  return el;
}

function pager(page) {
  const i = pageIndex(page.id), prev = PAGES[i - 1], next = PAGES[i + 1];
  return `<nav class="pager" aria-label="Previous and next page">${prev ? `<a href="#${prev.id}"><small>Previous</small><b>${title(prev)}</b></a>` : '<span></span>'}${next ? `<a class="next" href="#${next.id}"><small>Next</small><b>${title(next)}</b></a>` : ''}</nav>`;
}

function pageHead(page) {
  const i = pageIndex(page.id), n = PAGES.length;
  const el = h(`<div class="page-head"><p class="crumb">${esc(page.group)}</p><div class="page-title"><h1>${title(page)}</h1><div class="page-actions"></div></div><p class="desc">${inline(page.summary)}</p></div>`);
  $('.page-actions', el).append(pageActions(page),
    h(`<a class="icon-btn" href="#${PAGES[(i - 1 + n) % n].id}" aria-label="Previous page: ${esc(PAGES[(i - 1 + n) % n].name)}" title="Previous ([)">${I.left}</a>`),
    h(`<a class="icon-btn" href="#${PAGES[(i + 1) % n].id}" aria-label="Next page: ${esc(PAGES[(i + 1) % n].name)}" title="Next (])">${I.right}</a>`));
  return el;
}

function table(t) {
  return `<div class="table-wrap"><table><thead><tr>${t.head.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c, i) => `<td${i === r.length - 1 ? ' class="desc-cell"' : ''}>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function installation(page) {
  const importLine = page.importLine || `import '${NPM}';`;
  const manualSrc = page.id === 'timeline-math' ? '/vendor/profile-atlas/timeline-math.js' : '/vendor/profile-atlas/profile-atlas.js';
  return tabs('install', [
    { id: 'npm', label: 'npm', body: () => {
      const f = document.createDocumentFragment();
      f.append(h(`<p>${page.id === 'timeline-math' ? 'Install the package and import the functions you need. The module has no side effects and no DOM.' : 'Install the package, then import it once. Importing defines both elements.'}</p>`), command(NPM), codeBlock(importLine, 'js'));
      return f;
    } },
    { id: 'cdn', label: 'CDN', body: () => {
      const f = document.createDocumentFragment();
      f.append(h('<p>One script tag, no install. The stylesheets load from the same folder.</p>'),
        codeBlock(page.id === 'timeline-math' ? `<script type="module">\n  import { activityWindow } from 'https://cdn.jsdelivr.net/npm/${NPM}/src/timeline-math.js';\n</script>` : `<script type="module" src="${CDN}"></script>`, 'html'),
        h(`<p class="note">Pin the version in production: <code>${NPM}@${VERSION}</code>.</p>`));
      return f;
    } },
    { id: 'manual', label: 'Manual', body: () => {
      const f = document.createDocumentFragment();
      f.append(h(`<p>Copy ${page.id === 'timeline-math' ? '<code>timeline-math.js</code>. It has no imports.' : 'these five files into one folder of your site and keep them next to each other: the module loads its stylesheets and <code>timeline-math.js</code> by their path beside it.'}</p>`));
      if (page.id !== 'timeline-math') {
        f.append(h(`<div class="file-list">${FILES.map(([name, what]) => `<a href="../src/${name}" download><span class="mono">${name}</span><small>${esc(what)}</small>${I.download}</a>`).join('')}</div>`));
      }
      f.append(codeBlock(page.id === 'timeline-math' ? `import { activityWindow } from '${manualSrc}';` : `<script type="module" src="${manualSrc}"></script>`, page.id === 'timeline-math' ? 'js' : 'html'));
      return f;
    } },
  ], 'npm');
}

/* ───── pages ───── */
function article(page) {
  const art = h('<article class="article"></article>');
  art.append(pageHead(page));
  if (page.blocks) for (const b of page.blocks) art.append(...renderBlock(b, page));
  else {
    if (page.preview) art.append(preview(page.preview, { label: page.previewLabel || 'Preview' }));
    art.append(h('<h2 id="installation">Installation</h2>'), installation(page));
    art.append(h('<h2 id="usage">Usage</h2>'));
    for (const b of page.usage) art.append(...renderBlock(b, page));
    if (page.examples.length) {
      art.append(h('<h2 id="examples">Examples</h2>'));
      for (const ex of page.examples) {
        const sec = h(`<section class="example"><h3 id="ex-${ex.id}">${esc(ex.title)}</h3><p>${inline(ex.text)}</p></section>`);
        sec.append(preview(ex, { small: true }));
        if (ex.extra) sec.append(codeBlock('@file:' + ex.extra.file, ex.extra.lang, { title: ex.extra.file.split('/').pop() }));
        art.append(sec);
      }
    }
    art.append(h('<h2 id="api">API</h2>'));
    for (const t of page.api) {
      art.append(h(`<h3 id="${t.id}">${t.h.includes('(') || /^[A-Z_]+$/.test(t.h) ? `<code>${esc(t.h)}</code>` : esc(t.h)}</h3>`), h(table(t)));
      if (t.note) art.append(h(`<p class="note">${inline(t.note)}</p>`));
    }
    if (page.a11y) art.append(h('<h2 id="accessibility">Accessibility</h2>'), h(`<ul>${page.a11y.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`));
    if (page.motion) art.append(h('<h3 id="reduced-motion">Reduced motion</h3>'), h(`<ul>${page.motion.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`));
  }
  art.append(h(pager(page)));
  return art;
}

function renderBlock(b, page) {
  if (b.p) return [h(`<p>${inline(b.p)}</p>`)];
  if (b.h2) return [h(`<h2 id="${b.id}">${esc(b.h2)}</h2>`)];
  if (b.list) return [h(`<ul>${b.list.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`)];
  if (b.table) return [h(table(b.table))];
  if (b.code) return [codeBlock(b.code, b.lang, { title: b.title })];
  if (b.install) return [h('<h2 id="install">Install</h2>'), installation(page)];
  if (b.preview) return [preview(b.preview)];
  return [];
}

function home() {
  const main = h('<main id="main" class="home" tabindex="-1"></main>');
  main.append(h(`<section class="hero wrap">
    <p class="kicker">Web Components · v${VERSION} · MIT</p>
    <h1>Show the work behind <em>the six pins.</em></h1>
    <p class="lede">${ELEMENTS.length} custom elements, 5 files, 31 kB gzipped. No framework, no build step, no API token.</p>
    <div class="cta"><a class="btn primary" href="#introduction">Get started</a><a class="btn outline" href="${SHOWCASE}">View the live showcase</a><span class="install-chip"><span class="dollar" aria-hidden="true">$</span><code>npm i ${NPM}</code></span></div>
  </section>`));
  $('.install-chip', main).append(copyButton(`npm i ${NPM}`, 'Copy install command'));

  const specimens = h('<section class="wrap specimens" aria-label="The elements, running"></section>');
  for (const [ex, page, caption] of [
    [EX.atlasHome, pageById('profile-atlas'), 'Seven projects from the bundled manifest. Hover or focus to fan the stack; select a card for its details.'],
    [EX.timeline, pageById('timeline'), 'Thirty-three months of history from the same file. Choose a period, a lane or a bar.'],
  ]) {
    const fig = h(`<figure class="specimen"><figcaption><div><a href="#${page.id}" class="mono">${esc(page.name)}</a><span>${esc(caption)}</span></div><div class="specimen-actions"></div></figcaption><div class="specimen-stage"></div></figure>`);
    $('.specimen-actions', fig).append(copyButton(exampleCode(ex), `Copy the code for ${page.name}`), h(`<a class="btn sm" href="#${page.id}">Docs</a>`));
    mount($('.specimen-stage', fig), ex);
    specimens.append(fig);
  }
  main.append(specimens);

  main.append(h(`<section class="wrap index" aria-labelledby="index-title">
    <h2 id="index-title">Index</h2>
    <ol>${PAGES.map((p) => `<li><a href="#${p.id}"><span class="num">${String(pageIndex(p.id) + 1).padStart(2, '0')}</span><b class="${p.mono ? 'mono' : ''}">${esc(p.name)}</b><span class="sum">${inline(p.summary)}</span></a></li>`).join('')}</ol>
  </section>`));
  return main;
}

function notFound() {
  return h(`<article class="article"><div class="page-head"><h1>No page here</h1><p class="desc">That address doesn’t match a page. Every page is listed on the left, or press ${isMac ? '⌘' : 'Ctrl '}K.</p></div><p><a class="btn sm" href="#">Back to the start</a></p></article>`);
}

/* ───── on this page ───── */
let tocObserver;
function toc(art, id) {
  const aside = $('#toc'); tocObserver?.disconnect();
  if (!aside) return;
  const hs = [...art.querySelectorAll('h2[id], h3[id]')];
  aside.innerHTML = hs.length ? `<h4>On this page</h4>${hs.map((x) => `<a href="#${id}/${x.id}" class="${x.tagName === 'H3' ? 'sub' : ''}" data-for="${x.id}">${esc(x.textContent)}</a>`).join('')}` : '';
  tocObserver = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) aside.querySelectorAll('a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.for === e.target.id));
  }, { rootMargin: '-72px 0px -70% 0px' });
  hs.forEach((x) => tocObserver.observe(x));
}

/* ───── render ───── */
let shown = null;
function render() {
  const { page: id, anchor } = route();
  if (id !== shown) {
    shown = id;
    const page = pageById(id);
    const app = $('#app');
    app.replaceChildren(header());
    app.append(h(`<div class="drawer" id="drawer"><nav aria-label="Documentation">${sideNav(id)}</nav></div>`));
    if (!id) app.append(home());
    else {
      const layout = h(`<div class="wrap docs"><aside class="sidebar"><nav aria-label="Documentation">${sideNav(id)}</nav></aside><main id="main" tabindex="-1"></main><aside class="toc" id="toc" aria-label="On this page"></aside></div>`);
      const art = page ? article(page) : notFound();
      $('main', layout).append(art);
      app.append(layout);
      toc(art, id);
    }
    app.append(h(`<footer class="footer"><div class="wrap">MIT. Source on <a href="${SOURCE}" target="_blank" rel="noreferrer">GitHub</a>, package on <a href="https://www.npmjs.com/package/${NPM}" target="_blank" rel="noreferrer">npm</a>, a machine-readable summary in <a href="llms.txt">llms.txt</a>, and the owner’s own <a href="${SHOWCASE}">showcase</a>.</div></footer>`));
    for (const a of app.querySelectorAll('.nav a[data-match]')) if (a.dataset.match.split(' ').includes(id)) a.setAttribute('aria-current', 'page');
    drawThemeButton();
    document.title = page ? `${page.name} · Profile Atlas` : id ? 'Not found · Profile Atlas' : 'Profile Atlas · Web Components for a GitHub profile';
    document.body.classList.remove('drawer-open');
  }
  if (anchor) {
    const target = document.getElementById(anchor);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }));
  } else window.scrollTo({ top: 0 });
}

/* ───── ⌘K ───── */
function sections(page) {
  if (page.blocks) return page.blocks.filter((b) => b.h2).map((b) => [b.id, b.h2]).concat(page.blocks.some((b) => b.install) ? [['install', 'Install']] : []);
  return [['installation', 'Installation'], ['usage', 'Usage'], ...page.examples.map((e) => ['ex-' + e.id, e.title]), ...page.api.map((t) => [t.id, t.h]), ...(page.a11y ? [['accessibility', 'Accessibility']] : [])];
}
let paletteOpen = false;
function openPalette() {
  if (paletteOpen) return; paletteOpen = true;
  const before = document.activeElement;
  const all = [
    ...PAGES.map((p) => ({ group: 'Pages', label: p.name, hint: p.group, mono: p.mono, run: () => { location.hash = p.id; } })),
    ...PAGES.flatMap((p) => sections(p).map(([sid, text]) => ({ group: 'Sections', label: text, hint: p.name, run: () => { location.hash = `${p.id}/${sid}`; } }))),
    { group: 'Actions', label: 'Toggle theme', hint: 'D', run: toggleTheme },
    { group: 'Actions', label: 'Copy install command', hint: `npm i ${NPM}`, run: () => copyText(`npm i ${NPM}`) },
    { group: 'Actions', label: 'Copy CDN script tag', hint: 'jsDelivr', run: () => copyText(`<script type="module" src="${CDN}"></script>`) },
    { group: 'Actions', label: 'Open the showcase', hint: 'demo/', run: () => { location.href = SHOWCASE; } },
    { group: 'Actions', label: 'Open llms.txt', hint: '', run: () => { location.href = 'llms.txt'; } },
    { group: 'Actions', label: 'Source on GitHub', hint: '', run: () => window.open(SOURCE, '_blank', 'noopener') },
  ];
  const scrim = h(`<div class="scrim"><div class="palette" role="dialog" aria-modal="true" aria-label="Search the docs">
    <div class="palette-input">${I.search}<input type="text" placeholder="Search pages, sections and actions…" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list" autocomplete="off" spellcheck="false"></div>
    <ul id="palette-list" role="listbox" aria-label="Results"></ul>
    <div class="palette-foot"><span><kbd class="kbd">↑↓</kbd> move</span><span><kbd class="kbd">↵</kbd> open</span><span><kbd class="kbd">esc</kbd> close</span></div>
  </div></div>`);
  const input = $('input', scrim), list = $('ul', scrim);
  let items = all, sel = 0;
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    items = q ? all.filter((i) => `${i.label} ${i.hint} ${i.group}`.toLowerCase().includes(q)) : all.filter((i) => i.group !== 'Sections');
    sel = Math.min(sel, Math.max(0, items.length - 1));
    let last = '';
    list.innerHTML = items.length ? items.map((it, i) => {
      const head = it.group !== last ? `<li class="group" role="presentation">${it.group}</li>` : ''; last = it.group;
      return `${head}<li role="option" id="opt-${i}" data-i="${i}" aria-selected="${i === sel}"><span class="${it.mono ? 'mono' : ''}">${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</li>`;
    }).join('') : `<li class="group empty" role="presentation">Nothing matches “${esc(input.value)}”.</li>`;
    input.setAttribute('aria-activedescendant', items.length ? `opt-${sel}` : '');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };
  const close = () => { scrim.remove(); paletteOpen = false; before?.focus?.(); };
  const pick = (i) => { const it = items[i]; if (!it) return; close(); it.run(); };
  input.addEventListener('input', () => { sel = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') e.preventDefault();
  });
  list.addEventListener('pointermove', (e) => { const li = e.target.closest('[data-i]'); if (li && Number(li.dataset.i) !== sel) { sel = Number(li.dataset.i); draw(); } });
  list.addEventListener('click', (e) => { const li = e.target.closest('[data-i]'); if (li) pick(Number(li.dataset.i)); });
  scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) close(); });
  document.body.append(scrim); draw(); input.focus();
}

/* ───── Markdown for "Copy page" ───── */
const mdTable = (t) => [`| ${t.head.join(' | ')} |`, `| ${t.head.map(() => '---').join(' | ')} |`, ...t.rows.map((r) => `| ${r.map((c) => absolute(c).replace(/`([^`]*)`/g, (m) => m.replace(/\|/g, '\\|'))).join(' | ')} |`)].join('\n');
const fence = (code, lang) => '```' + lang + '\n' + code + '\n```';
const mdInstall = (page) => [
  '## Installation', '',
  fence(`npm i ${NPM}`, 'sh'), '', fence(page.importLine || `import '${NPM}';`, 'js'), '',
  'Or from a CDN:', '', fence(`<script type="module" src="${CDN}"></script>`, 'html'), '',
  `Or copy ${FILES.map(([f]) => '`' + f + '`').join(', ')} into one folder and keep them next to each other.`,
].join('\n');
async function mdBlock(b, page) {
  if (b.p) return absolute(b.p);
  if (b.h2) return `## ${b.h2}`;
  if (b.list) return b.list.map((x) => `- ${absolute(x)}`).join('\n');
  if (b.table) return mdTable(b.table);
  if (b.code) return fence(b.code.startsWith('@file:') ? await fileText(b.code.slice(6)) : b.code, b.lang);
  if (b.install) return mdInstall(page);
  if (b.preview) return fence(exampleCode(b.preview), 'html');
  return '';
}
async function pageMarkdown(page) {
  const out = [`# ${page.name}`, '', absolute(page.summary), ''];
  if (page.blocks) { for (const b of page.blocks) out.push(await mdBlock(b, page), ''); }
  else {
    if (page.preview) out.push(fence(exampleCode(page.preview), 'html'), '');
    out.push(mdInstall(page), '', '## Usage', '');
    for (const b of page.usage) out.push(await mdBlock(b, page), '');
    if (page.examples.length) {
      out.push('## Examples', '');
      for (const ex of page.examples) {
        out.push(`### ${ex.title}`, '', absolute(ex.text), '', fence(exampleCode(ex), 'html'), '');
        if (ex.extra) out.push(fence(await fileText(ex.extra.file), ex.extra.lang), '');
      }
    }
    out.push('## API', '');
    for (const t of page.api) { out.push(`### ${t.h}`, '', mdTable(t), ''); if (t.note) out.push(absolute(t.note), ''); }
    if (page.a11y) out.push('## Accessibility', '', page.a11y.map((x) => `- ${absolute(x)}`).join('\n'), '');
    if (page.motion) out.push('### Reduced motion', '', page.motion.map((x) => `- ${absolute(x)}`).join('\n'), '');
  }
  out.push(`Source: ${PUBLIC_URL}#${page.id}`);
  return out.join('\n');
}

/* ───── keys ───── */
addEventListener('keydown', (e) => {
  const typing = e.target.closest?.('input, textarea, select, [contenteditable]') || e.composedPath().some((n) => n instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName));
  if ((e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing && !paletteOpen)) { e.preventDefault(); paletteOpen ? null : openPalette(); return; }
  if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) { setDrawer(false); $('#menu-btn').focus(); return; }
  if (typing || paletteOpen || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'd' || e.key === 'D') toggleTheme();
  const i = pageIndex(route().page);
  if (i >= 0 && e.key === ']') location.hash = PAGES[(i + 1) % PAGES.length].id;
  if (i >= 0 && e.key === '[') location.hash = PAGES[(i - 1 + PAGES.length) % PAGES.length].id;
});
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (a && document.body.classList.contains('drawer-open')) setDrawer(false);
  if (a?.classList.contains('skip')) { e.preventDefault(); const m = $('#main'); m?.focus(); m?.scrollIntoView(); }
  if (a && a.getAttribute('href') === '#' && !route().page) { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); }
});
addEventListener('hashchange', render);
render();
