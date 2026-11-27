import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { INSTALL, PUBLISHED_VERSION, REPO, TUNING } from './api.ts';
import type { Doc, Example } from './pages.tsx';
import { DOCS } from './pages.tsx';
import { Code, Command, copyText, Icon, Seg, useCopied, useReplay } from './ui.tsx';

/** Studio first, then the components in sidebar order. */
export const PAGES: { id: string; name: string }[] = [{ id: '', name: 'Studio' }, ...DOCS.map((d) => ({ id: d.id, name: d.name }))];
export const href = (id: string) => (id ? `#${id}` : '#');

/** Where this copy of the site lives, so llms.txt links work on any deploy or sub-path. */
export function siteBase(): string {
  return window.location.href.split('#')[0].split('?')[0];
}

/* ───── inline text: `code` spans and an "Unreleased:" badge ───── */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|Unreleased:)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part === 'Unreleased:' ? (
          <span key={i} className="docs-badge" title={`In this repository, not in the published ${PUBLISHED_VERSION}`}>
            unreleased
          </span>
        ) : part.startsWith('`') ? (
          <code key={i}>{part.slice(1, -1)}</code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/* ───── preview frame: Preview / Code in one box, replay remounts ───── */
function OptionControl({ ex, value, onChange }: { ex: Example; value: string; onChange: (v: string) => void }) {
  const options = ex.options;
  if (!options) return null;
  const id = `opt-${ex.id}`;
  if (options.values.length > 3) {
    return (
      <label className="docs-select" htmlFor={id}>
        <span>{options.label}</span>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.values.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon.chevDown />
      </label>
    );
  }
  return (
    <div className="docs-option">
      <span aria-hidden="true">{options.label}</span>
      <Seg label={options.label} value={value} onChange={onChange} options={options.values} />
    </div>
  );
}

function Preview({ ex, live, takeShader, primary }: { ex: Example; live: boolean; takeShader: () => void; primary?: boolean }) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [opt, setOpt] = useState(ex.options?.initial ?? '');
  const [run, replay] = useReplay();
  const Demo = ex.Demo;
  return (
    <div className={'docs-preview' + (primary ? ' is-primary' : '')}>
      <div className="docs-preview__bar">
        <Seg
          label="View"
          value={tab}
          onChange={setTab}
          options={[
            { v: 'preview', label: 'Preview' },
            { v: 'code', label: 'Code' },
          ]}
        />
        <div className="docs-preview__tools">
          <OptionControl ex={ex} value={opt} onChange={setOpt} />
          <button
            type="button"
            className="docs-icon-btn"
            aria-label="Replay preview"
            title="Replay"
            onClick={() => {
              setTab('preview');
              replay();
            }}
          >
            <Icon.replay />
          </button>
        </div>
      </div>
      {tab === 'preview' ? (
        <>
          <div className={'docs-stage' + (ex.fill ? ' is-fill' : '')} key={run}>
            <div className="docs-stage__inner">
              <Demo live={live} opt={opt} />
            </div>
          </div>
          {ex.shader && !live && (
            <div className="docs-preview__note">
              <span>CSS fallback. One shader runs per page, so this preview waits its turn.</span>
              <button type="button" className="docs-link-btn" onClick={takeShader}>
                Render live
              </button>
            </div>
          )}
        </>
      ) : (
        <Code code={ex.code(opt)} />
      )}
    </div>
  );
}

/* ───── page actions ───── */
function PageActions({ md, name }: { md: () => string; name: string }) {
  const [open, setOpen] = useState(false);
  const [done, copy] = useCopied();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const esc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector<HTMLButtonElement>('[aria-expanded]')?.focus();
      }
    };
    addEventListener('pointerdown', off);
    addEventListener('keydown', esc);
    return () => {
      removeEventListener('pointerdown', off);
      removeEventListener('keydown', esc);
    };
  }, [open]);
  const base = siteBase();
  const prompt = encodeURIComponent(
    `I'm using ${name} from Paper UI (npm: @in-c0/paper-ui@alpha, an experimental React alpha). Read ${base}llms.txt and help me with it.`,
  );
  return (
    <div className="docs-split" ref={ref}>
      <button type="button" className="docs-btn" onClick={() => copy(md())} aria-label={done ? 'Copied page as Markdown' : 'Copy page as Markdown'}>
        {done ? <Icon.check /> : <Icon.copy />}
        Copy page
      </button>
      <button type="button" className="docs-btn" aria-label="More page actions" aria-expanded={open} aria-controls="page-actions" onClick={() => setOpen((o) => !o)}>
        <Icon.chevDown />
      </button>
      {open && (
        <div className="docs-menu" id="page-actions">
          <button
            type="button"
            onClick={() => {
              void copyText(md());
              setOpen(false);
            }}
          >
            <Icon.copy />
            Copy as Markdown
          </button>
          <a href={`https://claude.ai/new?q=${prompt}`} target="_blank" rel="noreferrer">
            <Icon.ext />
            Open in Claude
          </a>
          <a href={`https://chatgpt.com/?q=${prompt}`} target="_blank" rel="noreferrer">
            <Icon.ext />
            Open in ChatGPT
          </a>
          <a href="llms.txt" target="_blank" rel="noreferrer">
            <Icon.file />
            llms.txt
          </a>
        </div>
      )}
    </div>
  );
}

function Pager({ index }: { index: number }) {
  const prev = PAGES[index - 1];
  const next = PAGES[index + 1];
  return (
    <nav className="docs-pager" aria-label="Previous and next page">
      {prev && (
        <a href={href(prev.id)}>
          <small>Previous</small>
          <b>{prev.name}</b>
        </a>
      )}
      {next && (
        <a className="is-next" href={href(next.id)}>
          <small>Next</small>
          <b>{next.name}</b>
        </a>
      )}
    </nav>
  );
}

/* ───── Markdown for "Copy page" ───── */
const plain = (text: string) => text.replace(/Unreleased:/g, '(Unreleased, not in 0.1.0-alpha.1)');

export function toMarkdown(doc: Doc): string {
  const rows = doc.api.props.map(
    (p) =>
      `| \`${p.name}\`${p.required ? ' (required)' : ''} | \`${p.type.replace(/\|/g, '\\|')}\` | ${p.def ? `\`${p.def}\`` : ''} | ${p.unreleased ? '(Unreleased) ' : ''}${p.desc} |`,
  );
  return [
    `# ${doc.name}`,
    '',
    plain(doc.summary),
    '',
    `Paper UI is an experimental alpha (${PUBLISHED_VERSION}, npm tag \`alpha\`). Not production-certified: real-device GPU and accessibility audits are pending. This page documents the repository source; items marked Unreleased are not in ${PUBLISHED_VERSION}.`,
    '',
    '## Installation',
    '',
    '```sh',
    INSTALL,
    '```',
    '',
    '```tsx',
    "import '@in-c0/paper-ui/styles.css';",
    '```',
    ...doc.installNotes.flatMap((n) => ['', plain(n)]),
    '',
    '## Usage',
    '',
    '```tsx',
    doc.usage,
    '```',
    '',
    ...doc.usageNotes.map((n) => `- ${plain(n)}`),
    '',
    '## Examples',
    '',
    ...[doc.main, ...doc.examples].flatMap((ex) => [`### ${ex.title}`, '', ...(ex.text ? [plain(ex.text), ''] : []), '```tsx', ex.code(ex.options?.initial ?? ''), '```', '']),
    '## Keyboard and accessibility',
    '',
    ...doc.keys.map(([k, v]) => `- **${k}**: ${plain(v)}`),
    ...doc.a11y.map((n) => `- ${plain(n)}`),
    '',
    '## API',
    '',
    doc.api.renders,
    '',
    '| Prop | Type | Default | Description |',
    '| --- | --- | --- | --- |',
    ...rows,
    ...(doc.id === 'material-effect'
      ? ['', '### Tuning', '', '| Kinds | Keys (clamped range) |', '| --- | --- |', ...TUNING.map((t) => `| ${t.kinds.join(', ')} | ${t.keys.map((k) => `\`${k.key}\` ${k.range}`).join(', ')} |`)]
      : []),
    '',
    `Source: ${REPO}/blob/HEAD/packages/paper-ui/src/${doc.api.file}`,
  ].join('\n');
}

/* ───── a component page ───── */
export const SECTIONS = [
  { id: 'installation', text: 'Installation' },
  { id: 'usage', text: 'Usage' },
  { id: 'examples', text: 'Examples' },
  { id: 'accessibility', text: 'Keyboard and accessibility' },
  { id: 'api', text: 'API' },
];

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} tabIndex={-1}>
      {children}
    </h2>
  );
}

export function DocsPage({ doc }: { doc: Doc }) {
  const index = PAGES.findIndex((p) => p.id === doc.id);
  const prev = PAGES[index - 1];
  const next = PAGES[index + 1];
  const shaderExamples = [doc.main, ...doc.examples].filter((ex) => ex.shader);
  const [liveId, setLiveId] = useState<string | null>(shaderExamples[0]?.id ?? null);
  const source = `${REPO}/blob/HEAD/packages/paper-ui/src/${doc.api.file}`;

  return (
    <article className="docs-article">
      <div className="docs-title">
        <h1>{doc.name}</h1>
        <div className="docs-title__actions">
          <PageActions md={() => toMarkdown(doc)} name={doc.name} />
          {prev && (
            <a className="docs-icon-btn is-bordered" href={href(prev.id)} aria-label={`Previous: ${prev.name}`} title="Previous ([)">
              <Icon.left />
            </a>
          )}
          {next && (
            <a className="docs-icon-btn is-bordered" href={href(next.id)} aria-label={`Next: ${next.name}`} title="Next (])">
              <Icon.right />
            </a>
          )}
        </div>
      </div>
      <p className="docs-desc">
        <Inline text={doc.summary} />
      </p>
      <div className="docs-chips">
        <span className="docs-chip">{doc.role}</span>
        <span className="docs-chip">
          npm <b>{PUBLISHED_VERSION}</b>
        </span>
        <a className="docs-chip" href={source} target="_blank" rel="noreferrer">
          src/{doc.api.file}
          <Icon.ext />
        </a>
      </div>

      <Preview ex={doc.main} primary live={liveId === doc.main.id} takeShader={() => setLiveId(doc.main.id)} />

      <H2 id="installation">Installation</H2>
      <p>
        Published to npm under the <code>alpha</code> tag. React 18, 19 or 20 is a peer dependency.
      </p>
      <Command packages="@in-c0/paper-ui@alpha react" />
      <p>Import the stylesheet once, in your entry file. Without it the components render unstyled.</p>
      <Code title="main.tsx" code="import '@in-c0/paper-ui/styles.css';" />
      {doc.installNotes.map((note) => (
        <p key={note}>
          <Inline text={note} />
        </p>
      ))}
      <aside className="docs-callout" aria-label="Release status">
        <b>Experimental alpha.</b> {PUBLISHED_VERSION} is not production-certified. Browser checks run in Chromium; real-device GPU, screen-reader and visual
        audits are still open. See the{' '}
        <a href={`${REPO}/blob/HEAD/docs/RELEASE_CHECKLIST.md`} target="_blank" rel="noreferrer">
          release checklist
        </a>
        .
      </aside>

      <H2 id="usage">Usage</H2>
      <Code code={doc.usage} />
      <ul className="docs-list">
        {doc.usageNotes.map((note) => (
          <li key={note}>
            <Inline text={note} />
          </li>
        ))}
      </ul>

      <H2 id="examples">Examples</H2>
      {doc.examples.map((ex) => (
        <section key={ex.id} className="docs-example" aria-labelledby={`ex-${ex.id}`}>
          <h3 id={`ex-${ex.id}`}>{ex.title}</h3>
          <p>
            <Inline text={ex.text} />
          </p>
          <Preview ex={ex} live={liveId === ex.id} takeShader={() => setLiveId(ex.id)} />
        </section>
      ))}

      <H2 id="accessibility">Keyboard and accessibility</H2>
      <div className="docs-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Input</th>
              <th scope="col">Behaviour</th>
            </tr>
          </thead>
          <tbody>
            {doc.keys.map(([key, does]) => (
              <tr key={key}>
                <td>
                  <span className="docs-kbd">{key}</span>
                </td>
                <td>
                  <Inline text={does} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="docs-list">
        {doc.a11y.map((note) => (
          <li key={note}>
            <Inline text={note} />
          </li>
        ))}
      </ul>

      <H2 id="api">API</H2>
      <p>
        <Inline text={doc.api.renders} />
      </p>
      <div className="docs-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Prop</th>
              <th scope="col">Type</th>
              <th scope="col">Default</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            {doc.api.props.map((p) => (
              <tr key={p.name}>
                <td>
                  <code className="docs-prop">{p.name}</code>
                  {p.required && <span className="docs-required">required</span>}
                </td>
                <td>
                  <span className="docs-type">{p.type}</span>
                </td>
                <td>{p.def ? <span className="docs-type">{p.def}</span> : <span className="docs-none">–</span>}</td>
                <td>
                  {p.unreleased && <Inline text="Unreleased: " />}
                  <Inline text={p.desc} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {doc.id === 'material-effect' && (
        <>
          <h3 id="tuning">Tuning</h3>
          <p>
            <code>MaterialTuning</code> is one optional bag of numbers. Each family reads only its own keys and clamps each value; out-of-range or non-finite numbers
            are pulled into range.
          </p>
          <div className="docs-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">Kinds</th>
                  <th scope="col">Keys and ranges</th>
                </tr>
              </thead>
              <tbody>
                {TUNING.map((t) => (
                  <tr key={t.family}>
                    <td>
                      {t.kinds.map((k) => (
                        <code key={k} className="docs-prop is-stacked">
                          {k}
                        </code>
                      ))}
                    </td>
                    <td>
                      <div className="docs-keys">
                        {t.keys.map((k) => (
                          <span key={k.key} className="docs-type">
                            {k.key} {k.range}
                          </span>
                        ))}
                      </div>
                      {t.note && (
                        <p className="docs-cell-note">
                          <Inline text={t.note} />
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The other exports, <code>MATERIAL_KINDS</code>, <code>MATERIAL_PRESETS</code>, <code>WHISPERS_PAPER_PRESET</code> and <code>clampTuning</code>, are read-only
            data and a helper. Treat the presets as fixed: they are the owner-approved source values.
          </p>
        </>
      )}

      <Pager index={index} />
    </article>
  );
}

export function Toc({ route }: { route: string }) {
  const [current, setCurrent] = useState('');
  useEffect(() => {
    const heads = SECTIONS.map((s) => document.getElementById(s.id)).filter((h): h is HTMLElement => Boolean(h));
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' },
    );
    for (const h of heads) io.observe(h);
    return () => io.disconnect();
  }, [route]);
  return (
    <nav className="docs-toc" aria-label="On this page">
      <h4>On this page</h4>
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={href(route)}
          aria-current={current === s.id ? 'location' : undefined}
          onClick={(event) => {
            event.preventDefault();
            const target = document.getElementById(s.id);
            target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            target?.focus({ preventScroll: true });
          }}
        >
          {s.text}
        </a>
      ))}
    </nav>
  );
}
