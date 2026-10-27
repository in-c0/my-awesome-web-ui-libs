import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { INSTALL, NPM, PUBLISHED_VERSION, REPO } from './docs/api.ts';
import { DocsPage, href, PAGES, Toc } from './docs/DocsPage.tsx';
import { DOCS } from './docs/pages.tsx';
import { copyText, Icon } from './docs/ui.tsx';
import { StudioApp } from './StudioApp.tsx';
import './docs/docs.css';

const STUDIO_TITLE = 'paper ui — a little, over time.';

/**
 * Plain hash routes: `#paper-button`. Anything else — an empty hash or the Studio's own
 * `#effect=…&speed=…` share state — is the Studio, so existing share links keep working.
 */
function readRoute(): string {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  return DOCS.some((d) => d.id === hash) ? hash : '';
}

function useRoute(): string {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onChange = () => {
      const next = readRoute();
      setRoute((current) => {
        if (current !== next) window.scrollTo({ top: 0 });
        return next;
      });
    };
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function go(id: string) {
  if (id === readRoute() && id) {
    window.scrollTo({ top: 0 });
    return;
  }
  window.location.hash = id;
}

function SideNav({ route }: { route: string }) {
  return (
    <>
      <h4>Studio</h4>
      <a href="#" aria-current={route === '' ? 'page' : undefined}>
        Material study
        <small>home</small>
      </a>
      <a href="?device-lab=1">
        Device lab
        <small>field test</small>
      </a>
      <h4>
        Components <span>{String(DOCS.length).padStart(2, '0')}</span>
      </h4>
      {DOCS.map((d) => (
        <a key={d.id} href={href(d.id)} aria-current={route === d.id ? 'page' : undefined}>
          {d.name}
          <small>{d.role}</small>
        </a>
      ))}
      <h4>Reference</h4>
      <a href="llms.txt" target="_blank" rel="noreferrer">
        llms.txt
      </a>
      <a href={`${REPO}/blob/HEAD/docs/RELEASE_CHECKLIST.md`} target="_blank" rel="noreferrer">
        Release checklist <Icon.ext className="docs-nav__ext" />
      </a>
      <a href={REPO} target="_blank" rel="noreferrer">
        Source <Icon.ext className="docs-nav__ext" />
      </a>
    </>
  );
}

export function App() {
  const route = useRoute();
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const doc = DOCS.find((d) => d.id === route);
  const pageIndex = PAGES.findIndex((p) => p.id === route);
  const searchRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMenu(false);
    document.title = doc ? `${doc.name} · Paper UI` : STUDIO_TITLE;
  }, [doc]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.closest('input, textarea, select, [contenteditable="true"]') !== null;
      if ((event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey)) {
        event.preventDefault();
        setPalette((open) => !open);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey || pageIndex < 1) return;
      if (event.key === ']' && PAGES[pageIndex + 1]) go(PAGES[pageIndex + 1].id);
      if (event.key === '[') go(PAGES[pageIndex - 1].id);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [pageIndex]);

  const closePalette = useCallback(() => {
    setPalette(false);
    searchRef.current?.focus();
  }, []);

  return (
    <div className="site">
      <a
        className="studio-skip-link"
        href="#main"
        onClick={(event) => {
          // Routes live in the hash, so move focus without changing it.
          event.preventDefault();
          const main = document.getElementById('main');
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        {doc ? 'Skip to content' : 'Skip to material preview'}
      </a>
      <header className="site-header">
        <button
          type="button"
          className="docs-icon-btn site-header__menu"
          aria-label={menu ? 'Close menu' : 'Open menu'}
          aria-expanded={menu}
          aria-controls="site-drawer"
          onClick={() => setMenu((m) => !m)}
        >
          {menu ? <Icon.close /> : <Icon.menu />}
        </button>
        <a className="studio-brand" href="#" aria-label="Paper UI Studio">
          <span className="studio-brand__mark" aria-hidden="true">
            w.
          </span>
          <div>
            <strong>paper / graphite</strong>
            <span>an interactive material study</span>
          </div>
        </a>
        <span className="site-badge" title="Experimental alpha. Not production-certified.">
          alpha
        </span>
        <nav className="site-header__nav" aria-label="Main">
          <a href="#" aria-current={route === '' ? 'page' : undefined}>
            Studio
          </a>
          <a href={href(DOCS[0].id)} aria-current={doc ? 'page' : undefined}>
            Components
          </a>
        </nav>
        <div className="site-header__right">
          <button type="button" ref={searchRef} className="site-search" onClick={() => setPalette(true)} aria-label="Search pages" aria-keyshortcuts="Meta+K Control+K /">
            <Icon.search />
            <span>Search pages…</span>
            <kbd>⌘K</kbd>
          </button>
          <span className="site-sep" aria-hidden="true" />
          <a className="studio-header__source" href={REPO} target="_blank" rel="noreferrer">
            Source <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      {menu && (
        <div className="site-drawer" id="site-drawer">
          <nav className="docs-nav" aria-label="All pages">
            <SideNav route={route} />
          </nav>
        </div>
      )}

      {doc ? (
        <div className="docs-layout">
          <nav className="docs-nav docs-sidebar" aria-label="Documentation">
            <SideNav route={route} />
          </nav>
          <main className="docs-main" id="main" tabIndex={-1}>
            <DocsPage key={doc.id} doc={doc} />
          </main>
          <Toc route={route} />
        </div>
      ) : (
        <StudioApp />
      )}

      <footer className="site-footer">
        Paper UI {PUBLISHED_VERSION} is an experimental alpha, not production-certified. MIT. Materials by{' '}
        <a href="https://github.com/paper-design/shaders" target="_blank" rel="noreferrer">
          Paper Shaders
        </a>
        , handwriting by{' '}
        <a href="https://github.com/gkurt/tegaki" target="_blank" rel="noreferrer">
          Tegaki
        </a>
        . Source on{' '}
        <a href={REPO} target="_blank" rel="noreferrer">
          GitHub
        </a>
        , package on{' '}
        <a href={NPM} target="_blank" rel="noreferrer">
          npm
        </a>
        .
      </footer>

      {palette && <Palette close={closePalette} />}
    </div>
  );
}

/* ───── ⌘K / ───── */
type Item = { group: string; label: string; hint: string; run: () => void };

function Palette({ close }: { close: () => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const items = useMemo(() => {
    const all: Item[] = [
      { group: 'Studio', label: 'Material study', hint: 'home', run: () => go('') },
      { group: 'Studio', label: 'Device lab', hint: 'field test', run: () => window.location.assign('?device-lab=1') },
      ...DOCS.map((d) => ({ group: 'Components', label: d.name, hint: d.role, run: () => go(d.id) })),
      { group: 'Actions', label: 'Copy install command', hint: INSTALL, run: () => void copyText(INSTALL) },
      { group: 'Actions', label: 'Open llms.txt', hint: '', run: () => window.open('llms.txt', '_blank', 'noopener') },
      { group: 'Actions', label: 'Open source on GitHub', hint: '', run: () => window.open(REPO, '_blank', 'noopener') },
    ];
    const q = query.trim().toLowerCase();
    return q ? all.filter((item) => `${item.label} ${item.hint} ${item.group}`.toLowerCase().includes(q)) : all;
  }, [query]);

  useEffect(() => setSelected(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const pick = (index: number) => {
    const item = items[index];
    if (!item) return;
    close();
    item.run();
  };

  const rows: ReactNode[] = [];
  let lastGroup = '';
  items.forEach((item, i) => {
    if (item.group !== lastGroup) {
      rows.push(
        <li key={`g-${item.group}`} className="palette__group" role="presentation">
          {item.group}
        </li>,
      );
      lastGroup = item.group;
    }
    rows.push(
      // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input owns the keyboard (arrows + Enter)
      <li
        key={item.group + item.label}
        id={`palette-${i}`}
        role="option"
        aria-selected={i === selected}
        onMouseMove={() => setSelected(i)}
        onClick={() => pick(i)}
      >
        <span>{item.label}</span>
        {item.hint && <small>{item.hint}</small>}
      </li>,
    );
  });

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled on the input
    <div className="palette-scrim" onClick={close}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops the scrim click only */}
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search pages" onClick={(event) => event.stopPropagation()}>
        <div className="palette__input">
          <Icon.search />
          <input
            // biome-ignore lint/a11y/noAutofocus: a command palette opens to type
            autoFocus
            placeholder="Search components and pages…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search pages"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[selected] ? `palette-${selected}` : undefined}
            aria-autocomplete="list"
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelected((s) => Math.min(items.length - 1, s + 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelected((s) => Math.max(0, s - 1));
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                pick(selected);
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                close();
              }
              if (event.key === 'Tab') event.preventDefault();
            }}
          />
        </div>
        <ul id="palette-list" role="listbox" aria-label="Pages and actions" ref={listRef}>
          {rows.length ? rows : <li className="palette__group">Nothing matches “{query}”.</li>}
        </ul>
        <div className="palette__foot">
          <span>
            <kbd>↑↓</kbd> move
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
