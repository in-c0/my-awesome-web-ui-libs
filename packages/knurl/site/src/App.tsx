import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Finish } from "knurl-ui";
import { Fader, Gauge, Knob, Toggle } from "knurl-ui/react";
import { DOCS, Hero, NPM, REPO, SITE, useReplay, type Doc } from "./data";
import { Code, Command, CopyButton, Icon, Mark, Seg, Tabs, copyText, useStored } from "./ui";
import { CASES, type Case } from "./cases";

const SOURCES = import.meta.glob("../../src/controls/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const source = (id: string) => SOURCES[`../../src/controls/${id}.ts`] ?? "";

const GUIDES = [
  { id: "introduction", name: "Introduction" },
  { id: "installation", name: "Installation" },
  { id: "theming", name: "Theming" },
];
/** Controls in sidebar order: grouped, and within a group in the order DOCS lists them. */
const GROUPS = ["Inputs", "Choices", "Readouts"] as const;
const ORDERED = GROUPS.flatMap((g) => DOCS.filter((d) => d.group === g));
const PAGES = [...GUIDES, ...ORDERED.map((d) => ({ id: d.id, name: d.name })), ...CASES.map((c) => ({ id: c.id, name: c.name }))];

/* ───── routing on the hash: one plain name per page ───── */
function useRoute(): [string, (r: string) => void] {
  const read = () => decodeURIComponent(location.hash.replace(/^#/, ""));
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => { setR(read()); window.scrollTo({ top: 0 }); };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((to: string) => {
    if (to === read()) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (to) location.hash = to; else { history.pushState(null, "", location.pathname + location.search); setR(""); window.scrollTo({ top: 0 }); }
  }, []);
  return [r, go];
}
const href = (id: string) => (id ? `#${id}` : "#");

/* ───── theme ───── */
function useTheme() {
  const sys = () => matchMedia("(prefers-color-scheme: dark)").matches;
  const [dark, setDark] = useState(() => {
    const a = document.documentElement.getAttribute("data-theme");
    return a ? a === "dark" : sys();
  });
  const toggle = useCallback(() => {
    setDark((d) => {
      const next = !d;
      document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
      try { localStorage.setItem("knurl-theme", next ? "dark" : "light"); } catch { /* fine */ }
      return next;
    });
  }, []);
  return [dark, toggle] as const;
}

export function App() {
  const [route, go] = useRoute();
  const [dark, toggleTheme] = useTheme();
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const [finish, setFinish] = useStored<Finish>("knurl-finish", "line");

  const page = PAGES.find((p) => p.id === route);
  const docIndex = DOCS.findIndex((d) => d.id === route);

  useEffect(() => { setMenu(false); }, [route]);
  useEffect(() => {
    document.title = page ? `${page.name} · Knurl` : "Knurl";
  }, [page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.closest("input, textarea, [contenteditable], select") !== null;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); setPalette((p) => !p); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "d" || e.key === "D") toggleTheme();
      if (docIndex >= 0 && e.key === "]") go(DOCS[(docIndex + 1) % DOCS.length].id);
      if (docIndex >= 0 && e.key === "[") go(DOCS[(docIndex + DOCS.length - 1) % DOCS.length].id);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [docIndex, go, toggleTheme]);

  return (
    <>
      <header className="header">
        <div className="container gutter header-in">
          <button className="icon-btn menu-btn" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>{menu ? <Icon.close /> : <Icon.menu />}</button>
          <a className="brand" href="#" onClick={(e) => { e.preventDefault(); go(""); }}><Mark />Knurl</a>
          <nav className="nav" aria-label="Main">
            <a href="#introduction" aria-current={GUIDES.some((g) => g.id === route) ? "page" : undefined}>Docs</a>
            <a href={href(DOCS[0].id)} aria-current={docIndex >= 0 ? "page" : undefined}>Controls</a>
            <a href={href(CASES[0].id)} aria-current={CASES.some((c) => c.id === route) ? "page" : undefined}>Examples</a>
            <a href="#theming">Theming</a>
          </nav>
          <div className="header-right">
            <button className="search" onClick={() => setPalette(true)} aria-label="Search documentation"><Icon.search className="" /><span>Search documentation…</span><kbd className="kbd">⌘K</kbd></button>
            <span className="sep" aria-hidden="true" />
            <a className="gh" href={REPO} target="_blank" rel="noreferrer"><Icon.github /><span className="stars">GitHub</span></a>
            <button className="icon-btn" onClick={toggleTheme} aria-label={dark ? "Use light theme" : "Use dark theme"} title="Toggle theme (D)">{dark ? <Icon.sun /> : <Icon.moon />}</button>
          </div>
        </div>
      </header>

      {menu && <div className="drawer-nav"><SideNav route={route} /></div>}

      {!route ? <Home go={go} finish={finish} setFinish={setFinish} /> : (
        <div className="container gutter">
          <div className="docs">
            <aside className="sidebar" aria-label="Documentation"><SideNav route={route} /></aside>
            <main className="main" id="main">
              {CASES.some((c) => c.id === route) ? <CasePage key={route} c={CASES.find((c) => c.id === route)!} finish={finish} setFinish={setFinish} />
                : docIndex >= 0 ? <ControlPage key={route} doc={DOCS[docIndex]} index={docIndex} finish={finish} setFinish={setFinish} />
                : route === "installation" ? <Installation />
                : route === "theming" ? <Theming finish={finish} />
                : route === "introduction" ? <Introduction />
                : <NotFound go={go} />}
            </main>
            <Toc route={route} />
          </div>
        </div>
      )}

      <footer className="footer">
        <div className="container gutter">
          Built on <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noreferrer">Anatomy</a> and <a href="https://github.com/lucasmarkes/hairline" target="_blank" rel="noreferrer">Hairline</a>. MIT. Source on <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>, package on <a href={NPM} target="_blank" rel="noreferrer">npm</a>.
        </div>
      </footer>

      {palette && <Palette close={() => setPalette(false)} go={go} toggleTheme={toggleTheme} />}
    </>
  );
}

/* ───── home ───── */
function Home({ go, finish, setFinish }: { go: (r: string) => void; finish: Finish; setFinish: (f: Finish) => void }) {
  const [sheet, setSheet] = useState<Doc | null>(null);
  return (
    <main>
      <section className="hero">
        <div className="container gutter">
          <div className="hero-frame">
            <span className="corner" style={{ left: -4, top: -4 }} /><span className="corner" style={{ right: -4, top: -4 }} />
            <span className="corner" style={{ left: -4, bottom: -4 }} /><span className="corner" style={{ right: -4, bottom: -4 }} />
            <div className="hero-grid">
              <div>
                <a className="eyebrow" href="#introduction"><i />v0.2 · {DOCS.length} controls · {CASES.length} examples</a>
                <h1>Form controls, <em>machined.</em></h1>
                <p className="lede">
                  A switch is a <b>toggle on a panel</b>, a slider is a <b>fader on its strip</b>, a progress bar is a <b>dial gauge</b>.
                  {DOCS.length} accessible controls for React and plain DOM, drawn as working isometric objects on native inputs. No dependencies.
                </p>
                <div className="cta">
                  <a className="btn primary" href={href(DOCS[0].id)}>Browse controls</a>
                  <span className="install-chip mono"><span className="dollar">$</span>npm i knurl-ui<CopyButton text="npm i knurl-ui" label="Copy install command" /></span>
                </div>
              </div>
              <Specimen finish={finish} />
            </div>
          </div>
        </div>
      </section>

      <section className="container gutter" aria-labelledby="all">
        <div className="section-head">
          <div>
            <h2 id="all">Every control</h2>
            <p>Live, and yours to operate. Each one is a native input underneath.</p>
          </div>
          <Seg label="Finish" value={finish} onChange={setFinish} options={[{ v: "line", label: "Line" }, { v: "solid", label: "Solid" }]} />
        </div>
        <div className="grid">
          {ORDERED.map((d) => (
            <div className="cell" key={d.id}>
              <div className="cell-actions">
                <CopyButton className="icon-btn" text={`npx shadcn@latest add ${SITE}/r/${d.id}.json`} label={`Copy add command for ${d.name}`} />
                <button className="icon-btn" aria-label={`View code for ${d.name}`} onClick={() => setSheet(d)}><Icon.code /></button>
              </div>
              <div className="cell-stage"><Hero id={d.id} finish={finish} /></div>
              <div className="cell-foot">
                <a href={href(d.id)} onClick={(e) => { e.preventDefault(); go(d.id); }}>{d.name}</a>
                <span>{d.role}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container gutter" aria-labelledby="examples">
        <div className="section-head">
          <div>
            <h2 id="examples">Examples</h2>
            <p>Whole interfaces built from several controls, with their code.</p>
          </div>
        </div>
        <div className="cases">
          {CASES.map((c) => (
            <a className="case-card" key={c.id} href={href(c.id)}>
              <div className="shot" aria-hidden="true"><Hero id={c.uses[0]} finish={finish} /></div>
              <div className="body"><b>{c.name}</b><p>{c.summary}</p><small>{c.uses.length} controls · {c.uses.map((u) => DOCS.find((d) => d.id === u)?.name).join(", ")}</small></div>
            </a>
          ))}
        </div>
      </section>
      {sheet && <CodeSheet doc={sheet} close={() => setSheet(null)} />}
    </main>
  );
}

/** Three controls on one bench, wired: the fader sets the knob's limit, the switch powers the gauge. */
function Specimen({ finish }: { finish: Finish }) {
  const [on, setOn] = useState(true);
  const [load, setLoad] = useState(68);
  const [trim, setTrim] = useState(40);
  const reading = on ? Math.round(load * (0.5 + trim / 200)) : 0;
  return (
    <div className="bench" aria-label="Three controls wired together">
      <div className="bench-row">
        <Toggle finish={finish} label="Power" checked={on} onCheckedChange={setOn} style={{ width: 120 }} />
        <Gauge finish={finish} role="meter" label="Output" value={reading} style={{ width: 150 }} />
        <Knob finish={finish} label="Trim" value={trim} onValueChange={setTrim} style={{ width: 128 }} />
      </div>
      <div className="bench-row" style={{ marginTop: 4 }}>
        <Fader finish={finish} label="Load" value={load} onValueChange={setLoad} style={{ width: 300, maxWidth: "100%" }} />
      </div>
      <dl className="titleblock">
        <div><dt>Output</dt><dd>{String(reading).padStart(3, "0")} / 100</dd></div>
        <div><dt>Camera</dt><dd>az 45° el 30°</dd></div>
        <div><dt>Stroke</dt><dd>0.9 px</dd></div>
        <div><dt>Finish</dt><dd>{finish}</dd></div>
      </dl>
    </div>
  );
}

function CodeSheet({ doc, close }: { doc: Doc; close: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [close]);
  return (
    <div className="scrim" style={{ placeItems: "stretch end", padding: 0 }} onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`${doc.name} code`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><h3>{doc.name}</h3><button className="icon-btn" aria-label="Close" onClick={close} autoFocus><Icon.close /></button></div>
        <p style={{ color: "var(--muted-fg)", marginTop: 6, fontSize: 14 }}>{doc.summary}</p>
        <Command kind="run" arg={`shadcn@latest add ${SITE}/r/${doc.id}.json`} />
        <Code code={`import { ${doc.name} } from "knurl-ui/react";\n\n${doc.examples[0].code}`} title="usage.tsx" />
        <Code code={source(doc.id)} title={`controls/${doc.id}.ts`} collapse />
        <div style={{ marginTop: 16 }}><a className="btn sm" href={href(doc.id)} onClick={close}>Open the {doc.name} page</a></div>
      </div>
    </div>
  );
}

/* ───── docs chrome ───── */
function SideNav({ route }: { route: string }) {
  return (
    <>
      <h4>Getting started</h4>
      {GUIDES.map((g) => <a key={g.id} href={href(g.id)} aria-current={route === g.id ? "page" : undefined}>{g.name}</a>)}
      {GROUPS.map((g) => (
        <div key={g}>
          <h4>{g}</h4>
          {DOCS.filter((d) => d.group === g).map((d) => <a key={d.id} href={href(d.id)} aria-current={route === d.id ? "page" : undefined}>{d.name}<small>{d.role.split(/[ /(]/)[0].toLowerCase()}</small></a>)}
        </div>
      ))}
      <h4>Examples</h4>
      {CASES.map((c) => <a key={c.id} href={href(c.id)} aria-current={route === c.id ? "page" : undefined}>{c.name}<small>{c.uses.length} controls</small></a>)}
    </>
  );
}

function Toc({ route }: { route: string }) {
  const [items, setItems] = useState<{ id: string; text: string; sub: boolean }[]>([]);
  const [cur, setCur] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      const hs = Array.from(document.querySelectorAll<HTMLElement>(".article h2[id], .article h3[id]"));
      setItems(hs.map((h) => ({ id: h.id, text: h.textContent ?? "", sub: h.tagName === "H3" })));
      const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) setCur(e.target.id); }, { rootMargin: "-80px 0px -70% 0px" });
      hs.forEach((h) => io.observe(h));
      cleanup = () => io.disconnect();
    }, 0);
    let cleanup = () => {};
    return () => { clearTimeout(t); cleanup(); };
  }, [route]);
  return (
    <aside className="toc" aria-label="On this page">
      {items.length > 0 && <h4>On this page</h4>}
      {items.map((i) => (
        <a key={i.id} href={"#" + route} className={i.sub ? "sub" : ""} aria-current={cur === i.id}
          onClick={(e) => { e.preventDefault(); document.getElementById(i.id)?.scrollIntoView({ behavior: "smooth" }); }}>{i.text}</a>
      ))}
      <div className="toc-card">
        <p>Every control installs with one command and owns its source.</p>
        <a className="btn sm" href={REPO} target="_blank" rel="noreferrer"><Icon.github />Star on GitHub</a>
      </div>
    </aside>
  );
}

function PageActions({ md, name }: { md: () => string; name: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener("pointerdown", off);
    return () => removeEventListener("pointerdown", off);
  }, [open]);
  const prompt = encodeURIComponent(`I'm using the ${name} control from Knurl (${SITE}, npm: knurl-ui). Read ${SITE}/llms.txt and help me with it.`);
  return (
    <div className="split" ref={ref}>
      <button className="btn sm" onClick={() => copyText(md())}><Icon.copy />Copy page</button>
      <button className="btn sm" aria-label="More page actions" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Icon.chevDown /></button>
      {open && (
        <div className="menu" role="menu">
          <button role="menuitem" onClick={() => { copyText(md()); setOpen(false); }}><Icon.copy />Copy as Markdown</button>
          <a role="menuitem" href={`https://claude.ai/new?q=${prompt}`} target="_blank" rel="noreferrer"><Icon.ext />Open in Claude</a>
          <a role="menuitem" href={`https://chatgpt.com/?q=${prompt}`} target="_blank" rel="noreferrer"><Icon.ext />Open in ChatGPT</a>
          <a role="menuitem" href={`${SITE}/llms.txt`} target="_blank" rel="noreferrer"><Icon.file />llms.txt</a>
        </div>
      )}
    </div>
  );
}

function Pager({ index }: { index: number }) {
  const prev = PAGES[index - 1], next = PAGES[index + 1];
  return (
    <nav className="pager" aria-label="Pages">
      {prev && <a href={href(prev.id)}><small>Previous</small><b>{prev.name}</b></a>}
      {next && <a className="next" href={href(next.id)}><small>Next</small><b>{next.name}</b></a>}
    </nav>
  );
}

/* ───── a control's page ───── */
function Preview({ ex, finish, setFinish, small }: { ex: Doc["examples"][number]; finish: Finish; setFinish: (f: Finish) => void; small?: boolean }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [run, replay] = useReplay();
  return (
    <div className="preview">
      <div className="preview-bar">
        <Seg label="View" value={tab} onChange={setTab} options={[{ v: "preview", label: "Preview" }, { v: "code", label: "Code" }]} />
        <div className="preview-tools">
          <Seg label="Finish" value={finish} onChange={setFinish} options={[{ v: "line", label: "Line" }, { v: "solid", label: "Solid" }]} />
          <button className="icon-btn" aria-label="Replay" title="Replay" onClick={() => { setTab("preview"); replay(); }}><Icon.replay /></button>
        </div>
      </div>
      {tab === "preview"
        ? <div className={"preview-stage" + (small ? " sm" : "")} key={run}>{ex.render(finish)}</div>
        : <Code code={ex.code} />}
    </div>
  );
}

function ControlPage({ doc, index, finish, setFinish }: { doc: Doc; index: number; finish: Finish; setFinish: (f: Finish) => void }) {
  const usage = `import { ${doc.name} } from "knurl-ui/react";\n\nexport function Example() {\n  return ${doc.examples[0].code.includes("\n") ? "(\n    " + doc.examples[0].code.replace(/\n/g, "\n    ") + "\n  )" : doc.examples[0].code};\n}`;
  const md = () => toMarkdown(doc);
  const pageIndex = PAGES.findIndex((p) => p.id === doc.id);
  return (
    <article className="article">
      <div className="page-title">
        <h1>{doc.name}</h1>
        <div className="page-actions">
          <PageActions md={md} name={doc.name} />
          <a className="icon-btn" href={href(DOCS[(index + DOCS.length - 1) % DOCS.length].id)} aria-label="Previous control" title="Previous ([)"><Icon.left /></a>
          <a className="icon-btn" href={href(DOCS[(index + 1) % DOCS.length].id)} aria-label="Next control" title="Next (])"><Icon.right /></a>
        </div>
      </div>
      <p className="desc">{doc.summary}</p>
      <div className="meta-row">
        <span className="chip">role <b>{doc.role}</b></span>
        <span className="chip">native <b>{doc.native}</b></span>
      </div>

      <Preview ex={doc.examples[0]} finish={finish} setFinish={setFinish} />

      <h2 id="installation">Installation</h2>
      <Tabs id="install" tabs={[
        { id: "cli", label: "CLI", body: <><p style={{ marginTop: 14 }}>Adds the control and its shared core to <code>components/knurl</code>, as source you own.</p><Command kind="run" arg={`shadcn@latest add ${SITE}/r/${doc.id}.json`} /></> },
        { id: "npm", label: "Package", body: <><p style={{ marginTop: 14 }}>Or install every control as one package and import what you use.</p><Command kind="add" arg="knurl-ui" /><Code code={`import { ${doc.name} } from "knurl-ui/react"; // React\nimport { ${doc.id} } from "knurl-ui";             // any DOM`} /></> },
        { id: "manual", label: "Manual", body: (
          <div className="steps" style={{ marginTop: 20 }}>
            <div><h4>Copy the core</h4><p>Six small files every control shares: projection, solids, the frame loop, the stylesheet, the value logic and the React wrapper. Take them from <a href={`${SITE}/r/knurl-core.json`} target="_blank" rel="noreferrer">knurl-core.json</a> or <a href={`${REPO}/tree/main/src/core`} target="_blank" rel="noreferrer">src/core</a> into <code>components/knurl/core</code>.</p></div>
            <div><h4>Copy the control</h4><Code code={source(doc.id)} title={`components/knurl/controls/${doc.id}.ts`} collapse /></div>
            <div><h4>Add its React component</h4><Code title={`components/knurl/${doc.id}.tsx`} code={`"use client";\nimport { make } from "./react/make";\nimport { ${doc.id}, type ${doc.name}Options } from "./controls/${doc.id}";\n\nexport const ${doc.name} = make<${doc.name}Options>("${doc.name}", ${doc.id});`} /></div>
          </div>
        ) },
      ]} />

      <h2 id="usage">Usage</h2>
      <Code code={usage} />
      <p style={{ marginTop: 14 }}>{doc.object}</p>

      <h2 id="examples">Examples</h2>
      {doc.examples.slice(1).map((ex) => (
        <section key={ex.id}>
          <h3 id={`ex-${ex.id}`}>{ex.title}</h3>
          <p>{ex.text}</p>
          <Preview ex={ex} finish={finish} setFinish={setFinish} small />
        </section>
      ))}

      {doc.keys.length > 0 && <>
        <h2 id="keyboard">Keyboard and pointer</h2>
        <div className="table-wrap"><table><thead><tr><th>Input</th><th>Does</th></tr></thead>
          <tbody>{doc.keys.map(([k, v]) => <tr key={k}><td><span className="mono" style={{ fontSize: 12.5 }}>{k}</span></td><td className="desc-cell">{v}</td></tr>)}</tbody></table></div>
      </>}

      <h2 id="api">API</h2>
      <p>Every prop is optional. The React component also takes any <code>&lt;div&gt;</code> attribute and forwards its ref.</p>
      <div className="table-wrap"><table>
        <thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>{doc.props.map((p) => (
          <tr key={p.name}><td><code>{p.name}</code></td><td><span className="type">{p.type}</span></td><td><span className="type">{p.def ?? "–"}</span></td><td className="desc-cell">{p.desc}</td></tr>
        ))}</tbody>
      </table></div>

      <Pager index={pageIndex} />
    </article>
  );
}


function toMarkdown(d: Doc) {
  return [
    `# ${d.name}`, "", d.summary, "", d.object, "",
    "## Installation", "", "```sh", `npx shadcn@latest add ${SITE}/r/${d.id}.json`, "# or", "npm i knurl-ui", "```", "",
    "## Usage", "", "```tsx", `import { ${d.name} } from "knurl-ui/react";`, "", d.examples[0].code, "```", "",
    ...d.examples.slice(1).flatMap((e) => [`### ${e.title}`, "", e.text, "", "```tsx", e.code, "```", ""]),
    "## API", "", "| Prop | Type | Default | Description |", "| --- | --- | --- | --- |",
    ...d.props.map((p) => `| \`${p.name}\` | \`${p.type.replace(/\|/g, "\\|")}\` | ${p.def ? "`" + p.def + "`" : ""} | ${p.desc} |`),
    "", `Semantics: ${d.native}.`,
  ].join("\n");
}

/* ───── a case example ───── */
function CasePage({ c, finish, setFinish }: { c: Case; finish: Finish; setFinish: (f: Finish) => void }) {
  const idx = PAGES.findIndex((p) => p.id === c.id);
  const [run, replay] = useReplay();
  const md = () => [`# ${c.name}`, "", c.summary, "", ...c.body.flatMap((b) => [b, ""]), "```tsx", c.source, "```"].join("\n");
  const View = c.View;
  return (
    <article className="article wide-article">
      <div className="page-title">
        <h1>{c.name}</h1>
        <div className="page-actions"><PageActions md={md} name={c.name} /></div>
      </div>
      <p className="desc">{c.summary}</p>
      <div className="uses">{c.uses.map((u) => { const d = DOCS.find((x) => x.id === u); return d ? <a key={u} href={href(u)}><span className="chip"><b>{d.name}</b>{d.role}</span></a> : null; })}</div>
      <div className="case-bar">
        <Seg label="Finish" value={finish} onChange={setFinish} options={[{ v: "line", label: "Line" }, { v: "solid", label: "Solid" }]} />
        <button className="icon-btn" aria-label="Reset" title="Reset" onClick={replay}><Icon.replay /></button>
      </div>
      <div className="case-stage" key={run}><View finish={finish} /></div>
      <h2 id="how">How it works</h2>
      {c.body.map((b, i) => <p key={i} style={{ marginTop: i ? 12 : 8 }}>{b}</p>)}
      <h2 id="code">Code</h2>
      <p>The whole example, as it runs on this page. Every control comes from <code>knurl-ui/react</code>.</p>
      <Code code={c.source} title={c.file} collapse />
      <Pager index={idx} />
    </article>
  );
}

/* ───── guides ───── */
function GuideHead({ title, desc, md }: { title: string; desc: string; md: () => string }) {
  return (
    <>
      <div className="page-title"><h1>{title}</h1><div className="page-actions"><PageActions md={md} name={title} /></div></div>
      <p className="desc">{desc}</p>
    </>
  );
}

function Introduction() {
  const idx = PAGES.findIndex((p) => p.id === "introduction");
  return (
    <article className="article">
      <GuideHead title="Introduction" desc="Knurl draws each form control as the physical instrument it stands for, on top of the native input that does the work." md={() => "# Knurl\n\nUI controls machined as isometric instruments. " + DOCS.map((d) => `\n- ${d.name}: ${d.summary}`).join("")} />
      <h2 id="idea">The idea</h2>
      <p>A control explains itself when it looks like the thing it does. A switch that is a bat-handle toggle reads as on or off from across the room; a progress bar that is a dial gauge shows not only how far, but that the needle is still moving. Each Knurl control is a small machine of real parts: a panel with screws, a bushing and nut, a ruler of the actual steps, a lamp that lights.</p>
      <p>Two open-source projects supply the method. <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noreferrer">Anatomy</a> sets the craft: invent a real object whose working is the concept, build it from many small precise parts, shade sides in four tones, and keep every number true to the model that moves it. <a href="https://github.com/lucasmarkes/hairline" target="_blank" rel="noreferrer">Hairline</a> sets the runtime: hairline figures that answer the pointer, one shared frame loop that sleeps offscreen, zero-specificity styles and a theme of five custom properties.</p>
      <h2 id="principles">Principles</h2>
      <ul>
        <li><b>Native underneath.</b> Every control sits on a real <code>input</code>, <code>button</code> or ARIA role, so keyboard, screen readers and form submission behave as the platform's own.</li>
        <li><b>One geometry, two finishes.</b> <code>line</code> draws hairlines on plates; <code>solid</code> shades the same solids. The switch is CSS only.</li>
        <li><b>True motion.</b> Springs with real stiffness and damping: a toggle snaps, a gauge needle overshoots and settles, a fader cap travels to a keyboard jump.</li>
        <li><b>Calm when idle.</b> One <code>requestAnimationFrame</code> for every control on the page. Offscreen or at rest, nothing runs. Reduced motion lands every spring in one step.</li>
        <li><b>Yours to change.</b> Install the package, or add a control's source to your project with the shadcn CLI.</li>
      </ul>
      <h2 id="controls">The controls</h2>
      <div className="table-wrap"><table><thead><tr><th>Control</th><th>Stands for</th><th>Built as</th></tr></thead>
        <tbody>{DOCS.map((d) => <tr key={d.id}><td><a href={href(d.id)}>{d.name}</a></td><td className="desc-cell">{d.role}</td><td className="desc-cell">{d.summary.split(", built as ")[1]?.replace(/\.$/, "") ?? d.summary}</td></tr>)}</tbody></table></div>
      <Pager index={idx} />
    </article>
  );
}

function Installation() {
  const idx = PAGES.findIndex((p) => p.id === "installation");
  return (
    <article className="article">
      <GuideHead title="Installation" desc="As a package, as source through the shadcn CLI, or as a plain DOM call. React 18 or later is optional." md={() => "# Installation\n\n```sh\nnpm i knurl-ui\nnpx shadcn@latest add " + SITE + "/r/knurl.json\n```"} />
      <h2 id="package">Package</h2>
      <p>One dependency-free ESM package. Import a control from <code>knurl-ui/react</code>, or the mount function from <code>knurl-ui</code>.</p>
      <Command kind="add" arg="knurl-ui" />
      <Code title="app.tsx" code={`import { Toggle, Fader } from "knurl-ui/react";\n\nexport function Mixer() {\n  const [gain, setGain] = useState(60);\n  return (\n    <>\n      <Toggle label="Mute" />\n      <Fader label="Gain" value={gain} onValueChange={setGain} />\n    </>\n  );\n}`} />
      <p style={{ marginTop: 14 }}>Components render a sized empty box on the server and draw on mount, so nothing shifts. The entry is a client module, so a Server Component can render it without <code>"use client"</code> of its own.</p>
      <h2 id="shadcn">shadcn CLI</h2>
      <p>Each control is a registry item. Adding one writes its source and the shared core to <code>components/knurl</code>.</p>
      <Command kind="run" arg={`shadcn@latest add ${SITE}/r/toggle.json`} />
      <p style={{ marginTop: 14 }}>All eight at once:</p>
      <Command kind="run" arg={`shadcn@latest add ${SITE}/r/knurl.json`} />
      <p style={{ marginTop: 14 }}>Or register the namespace once in <code>components.json</code> and add by name:</p>
      <Code lang="json" title="components.json" code={`{\n  "registries": {\n    "@knurl": "${SITE}/r/{name}.json"\n  }\n}`} />
      <Command kind="run" arg="shadcn@latest add @knurl/fader" />
      <h2 id="dom">Any DOM</h2>
      <p>Each mount function takes an element and options, and returns <code>update</code> and <code>destroy</code>: the shape of a Svelte action, a Vue directive or a Web Component's lifecycle.</p>
      <Code title="main.ts" code={`import { gauge } from "knurl-ui";\n\nconst g = gauge(document.querySelector("#upload")!, { label: "Uploading" });\n\nupload.on("progress", (p) => g.update({ value: p * 100 }));\nupload.on("done", () => g.destroy());`} />
      <Pager index={idx} />
    </article>
  );
}

function Theming({ finish }: { finish: Finish }) {
  const idx = PAGES.findIndex((p) => p.id === "theming");
  const vars: [string, string, string, string][] = [
    ["--knurl-plate", "#ffffff", "#09090b", "The fill of every plate: set it to the background the control sits on."],
    ["--knurl-hi", "#1d1d20", "#e4e6eb", "What is lit: the index line, the active outline, legends."],
    ["--knurl-edge", "#9d9da6", "#5d5f66", "Silhouettes."],
    ["--knurl-mid", "#c3c3c9", "#3d3e44", "Every other stroke: ticks, ribs, screw slots."],
    ["--knurl-lo", "#e2e2e6", "#26272b", "What recedes: creases, seams, slots."],
    ["--knurl-accent", "#f76b15", "#ff8a3d", "The one lit colour: the lamp, the lit slot, the gauge's red zone."],
    ["--knurl-stroke", "0.9", "0.9", "Stroke width in CSS pixels, at any size."],
  ];
  const solid: [string, string][] = [["--knurl-top", "Lids"], ["--knurl-s0 … --knurl-s3", "The four side tones, darkest to lightest"], ["--knurl-shadow", "The contact shadow"]];
  return (
    <article className="article">
      <GuideHead title="Theming" desc="Seven custom properties for the line finish, five more for solid. Set them on a control or on anything above it." md={() => "# Theming\n\n" + vars.map((v) => `- \`${v[0]}\`: ${v[3]} (light ${v[1]}, dark ${v[2]})`).join("\n")} />
      <h2 id="tokens">Tokens</h2>
      <div className="table-wrap"><table><thead><tr><th>Property</th><th>Light</th><th>Dark</th><th>Used for</th></tr></thead>
        <tbody>{vars.map((v) => <tr key={v[0]}><td><code>{v[0]}</code></td><td><span className="type">{v[1]}</span></td><td><span className="type">{v[2]}</span></td><td className="desc-cell">{v[3]}</td></tr>)}</tbody></table></div>
      <p style={{ marginTop: 14 }}>The styles sit inside <code>:where()</code>, so they have no specificity: any rule of yours wins without <code>!important</code>.</p>
      <Code lang="tsx" title="globals.css" code={`.mixer [data-knurl] {\n  --knurl-plate: var(--background);\n  --knurl-accent: oklch(0.72 0.17 150); /* a green lamp */\n  --knurl-stroke: 1.1;\n}`} />
      <h2 id="finish">Finish</h2>
      <p>The same geometry yields both finishes. <code>solid</code> adds these, with light and dark defaults:</p>
      <div className="table-wrap"><table><thead><tr><th>Property</th><th>Used for</th></tr></thead>
        <tbody>{solid.map((v) => <tr key={v[0]}><td><code>{v[0]}</code></td><td className="desc-cell">{v[1]}</td></tr>)}</tbody></table></div>
      <div className="preview"><div className="preview-stage sm"><div className="demo-row">
        <Toggle finish="line" label="Line finish" defaultChecked /><Toggle finish="solid" label="Solid finish" defaultChecked />
      </div></div></div>
      <h2 id="dark">Dark mode</h2>
      <p><code>theme="auto"</code> follows an ancestor with class <code>dark</code> or <code>data-theme="dark"</code>, then the page's <code>color-scheme</code>. Pass <code>"light"</code> or <code>"dark"</code> to pin one. This site's toggle sets <code>data-theme</code> on the root, and the {finish} finish you picked is remembered across pages.</p>
      <Pager index={idx} />
    </article>
  );
}

function NotFound({ go }: { go: (r: string) => void }) {
  return (
    <article className="article">
      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em" }}>No page here</h1>
      <p className="desc">That address doesn't match a page. Every control is listed on the left.</p>
      <div style={{ marginTop: 20 }}><button className="btn sm" onClick={() => go("")}>Back to the start</button></div>
    </article>
  );
}

/* ───── ⌘K ───── */
function Palette({ close, go, toggleTheme }: { close: () => void; go: (r: string) => void; toggleTheme: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const items = useMemo(() => {
    const all: { group: string; label: string; hint: string; run: () => void }[] = [
      ...GUIDES.map((g) => ({ group: "Getting started", label: g.name, hint: "", run: () => go(g.id) })),
      ...ORDERED.map((d) => ({ group: "Controls", label: d.name, hint: d.role, run: () => go(d.id) })),
      ...CASES.map((c) => ({ group: "Examples", label: c.name, hint: `${c.uses.length} controls`, run: () => go(c.id) })),
      { group: "Actions", label: "Toggle theme", hint: "D", run: toggleTheme },
      { group: "Actions", label: "Copy install command", hint: "npm i knurl-ui", run: () => copyText("npm i knurl-ui") },
      { group: "Actions", label: "Open GitHub", hint: "", run: () => window.open(REPO, "_blank", "noopener") },
    ];
    const s = q.trim().toLowerCase();
    return s ? all.filter((i) => (i.label + " " + i.hint + " " + i.group).toLowerCase().includes(s)) : all;
  }, [q, go, toggleTheme]);
  useEffect(() => setSel(0), [q]);
  const pick = (i: number) => { const it = items[i]; if (!it) return; close(); it.run(); };
  let lastGroup = "";
  const rows: ReactNode[] = [];
  items.forEach((it, i) => {
    if (it.group !== lastGroup) { rows.push(<li key={"g" + it.group} className="group" role="presentation">{it.group}</li>); lastGroup = it.group; }
    rows.push(<li key={it.group + it.label} role="option" aria-selected={i === sel} onMouseMove={() => setSel(i)} onClick={() => pick(i)}>{it.label}{it.hint && <small>{it.hint}</small>}</li>);
  });
  return (
    <div className="scrim" onClick={close}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search" onClick={(e) => e.stopPropagation()}>
        <input autoFocus placeholder="Search controls and pages…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search"
          role="combobox" aria-expanded="true" aria-controls="palette-list"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === "Enter") pick(sel);
            if (e.key === "Escape") close();
          }} />
        <ul id="palette-list" role="listbox">{rows.length ? rows : <li className="group">Nothing matches “{q}”.</li>}</ul>
        <div className="palette-foot"><span><kbd className="kbd">↑↓</kbd> move</span><span><kbd className="kbd">↵</kbd> open</span><span><kbd className="kbd">esc</kbd> close</span></div>
      </div>
    </div>
  );
}
