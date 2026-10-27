import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { highlight } from "./highlight";

/* ───── icons (16px, 1.5 stroke) ───── */
const I = (d: ReactNode, vb = "0 0 24 24") => (p: { className?: string }) => (
  <svg viewBox={vb} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{d}</svg>
);
export const Icon = {
  copy: I(<><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></>),
  check: I(<path d="m5 12.5 4.5 4.5L19 7.5" />),
  search: I(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>),
  sun: I(<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>),
  moon: I(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />),
  menu: I(<path d="M4 7h16M4 12h16M4 17h16" />),
  close: I(<path d="M6 6l12 12M18 6 6 18" />),
  replay: I(<><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4.5h4.5" /></>),
  terminal: I(<><path d="m5 7 5 5-5 5" /><path d="M12 17h7" /></>),
  code: I(<path d="m9 8-4 4 4 4M15 8l4 4-4 4" />),
  chevDown: I(<path d="m7 10 5 5 5-5" />),
  left: I(<path d="M14 6 8 12l6 6" />),
  right: I(<path d="m10 6 6 6-6 6" />),
  ext: I(<><path d="M14 5h5v5" /><path d="M19 5 11 13" /><path d="M18 14v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18V7.5A1.5 1.5 0 0 1 5.5 6H10" /></>),
  file: I(<><path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5Z" /><path d="M14 3.5V8h4" /></>),
  link: I(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  github: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.84c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>
  ),
};

/** The mark: a knurled knob seen from above at the house angle. */
export const Mark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <ellipse cx="12" cy="15.2" rx="9" ry="5.4" fill="var(--bg)" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4 11.4v3.8M20 11.4v3.8" stroke="currentColor" strokeWidth="1.3" />
    <ellipse cx="12" cy="11.4" rx="8" ry="4.8" fill="var(--bg)" stroke="currentColor" strokeWidth="1.3" />
    <path d="M7 15.7v1.2M9.4 16.4v1.3M12 16.6v1.3M14.6 16.4v1.3M17 15.7v1.2" stroke="currentColor" strokeWidth="1" opacity=".55" />
    <path d="M12 11.4 15.6 9.1" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/* ───── copy ───── */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const t = document.createElement("textarea");
      t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      const ok = document.execCommand("copy");
      t.remove();
      return ok;
    } catch { return false; }
  }
}

export function CopyButton({ text, label = "Copy", className = "copy-btn" }: { text: string | (() => string); label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button type="button" className={className} title={done ? "Copied" : label} aria-label={done ? "Copied" : label}
      onClick={() => { copyText(typeof text === "function" ? text() : text).then((ok) => { if (!ok) return; setDone(true); clearTimeout(timer.current); timer.current = window.setTimeout(() => setDone(false), 2000); }); }}>
      {done ? <Icon.check /> : <Icon.copy />}
    </button>
  );
}

/* ───── code ───── */
export function Code({ code, lang = "tsx", title, collapse = false }: { code: string; lang?: "tsx" | "sh" | "json"; title?: string; collapse?: boolean }) {
  const [open, setOpen] = useState(!collapse);
  const lines = code.split("\n").length;
  const long = collapse && lines > 14;
  return (
    <div className={"code" + (long && !open ? " collapsed" : "")}>
      {title && <div className="code-title"><Icon.file className="" />{title}</div>}
      <pre><code dangerouslySetInnerHTML={{ __html: highlight(code, lang) }} /></pre>
      <div className="copy"><CopyButton text={code} label="Copy code" /></div>
      {long && !open && <div className="fade"><button className="btn sm" onClick={() => setOpen(true)}>Expand · {lines} lines</button></div>}
    </div>
  );
}

/* ───── segmented control with a sliding pill ───── */
export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const b = ref.current?.querySelector<HTMLButtonElement>(`[data-v="${value}"]`);
    if (b) setPill({ left: b.offsetLeft, width: b.offsetWidth });
  }, [value]);
  return (
    <div className="seg" role="group" aria-label={label} ref={ref}>
      {pill && <span className="pill" style={{ left: pill.left, width: pill.width }} />}
      {options.map((o) => (
        <button key={o.v} type="button" data-v={o.v} aria-pressed={o.v === value} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ───── a remembered choice ───── */
export function useStored<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { return (localStorage.getItem(key) as T) || initial; } catch { return initial; } });
  const set = (x: T) => { setV(x); try { localStorage.setItem(key, x); } catch { /* storage off: keep it for this visit */ } };
  return [v, set];
}

/* ───── install command with package-manager tabs ───── */
const PMS = ["pnpm", "npm", "yarn", "bun"] as const;
type PM = (typeof PMS)[number];
const RUN: Record<PM, string> = { pnpm: "pnpm dlx", npm: "npx", yarn: "yarn dlx", bun: "bunx --bun" };
const ADD: Record<PM, string> = { pnpm: "pnpm add", npm: "npm i", yarn: "yarn add", bun: "bun add" };

export function Command({ kind, arg }: { kind: "run" | "add"; arg: string }) {
  const [pm, setPm] = useStored<PM>("knurl-pm", "pnpm");
  const cmd = `${kind === "run" ? RUN[pm] : ADD[pm]} ${arg}`;
  return (
    <div className="cmd">
      <div className="cmd-bar" role="tablist" aria-label="Package manager">
        <Icon.terminal className="term" />
        {PMS.map((p) => <button key={p} role="tab" aria-selected={p === pm} onClick={() => setPm(p)}>{p}</button>)}
        <CopyButton text={cmd} label="Copy command" />
      </div>
      <pre><code dangerouslySetInnerHTML={{ __html: highlight(cmd, "sh") }} /></pre>
    </div>
  );
}

export function Tabs({ tabs, id }: { tabs: { id: string; label: string; body: ReactNode }[]; id: string }) {
  const [cur, setCur] = useState(tabs[0].id);
  return (
    <div className="tabs">
      <div className="tablist" role="tablist">
        {tabs.map((t) => <button key={t.id} id={`${id}-${t.id}`} role="tab" aria-selected={cur === t.id} aria-controls={`${id}-${t.id}-panel`} onClick={() => setCur(t.id)}>{t.label}</button>)}
      </div>
      {tabs.map((t) => <div key={t.id} id={`${id}-${t.id}-panel`} role="tabpanel" aria-labelledby={`${id}-${t.id}`} hidden={cur !== t.id}>{t.body}</div>)}
    </div>
  );
}
