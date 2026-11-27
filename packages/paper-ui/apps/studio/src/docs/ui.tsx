import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { highlight, type Lang } from './highlight.ts';

/* ───── icons: 24px grid, 1.6 stroke, drawn to match the Studio's ───── */
const make =
  (d: ReactNode) =>
  ({ className }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d}
    </svg>
  );

export const Icon = {
  copy: make(
    <>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </>,
  ),
  check: make(<path d="m5 12.5 4.5 4.5L19 7.5" />),
  search: make(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>,
  ),
  menu: make(<path d="M4 7h16M4 12h16M4 17h16" />),
  close: make(<path d="M6 6l12 12M18 6 6 18" />),
  replay: make(
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4.5h4.5" />
    </>,
  ),
  terminal: make(
    <>
      <path d="m5 7 5 5-5 5" />
      <path d="M12 17h7" />
    </>,
  ),
  chevDown: make(<path d="m7 10 5 5 5-5" />),
  left: make(<path d="M14 6 8 12l6 6" />),
  right: make(<path d="m10 6 6 6-6 6" />),
  ext: make(
    <>
      <path d="M14 5h5v5" />
      <path d="M19 5 11 13" />
      <path d="M18 14v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18V7.5A1.5 1.5 0 0 1 5.5 6H10" />
    </>,
  ),
  file: make(
    <>
      <path d="M6 3.5h9l3 3V21H6z" />
      <path d="M15 3.5V7h3" />
      <path d="M9 12h6M9 16h5" />
    </>,
  ),
};

/* ───── clipboard ───── */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Copy → check for two seconds. No toast: the icon and the accessible name change. */
export function useCopied(): [boolean, (text: string) => void] {
  const [done, setDone] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const run = (text: string) => {
    void copyText(text).then((ok) => {
      if (!ok) return;
      setDone(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setDone(false), 2000);
    });
  };
  return [done, run];
}

export function CopyButton({ text, label = 'Copy', className = 'docs-icon-btn' }: { text: string | (() => string); label?: string; className?: string }) {
  const [done, run] = useCopied();
  return (
    <button
      type="button"
      className={className}
      aria-label={done ? 'Copied' : label}
      title={done ? 'Copied' : label}
      onClick={() => run(typeof text === 'function' ? text() : text)}
    >
      {done ? <Icon.check /> : <Icon.copy />}
    </button>
  );
}

/* ───── code ───── */
export function Code({ code, lang = 'tsx', title, collapse = false }: { code: string; lang?: Lang; title?: string; collapse?: boolean }) {
  const lines = code.split('\n').length;
  const long = collapse && lines > 16;
  const [open, setOpen] = useState(!long);
  return (
    <div className={'docs-code' + (long && !open ? ' is-collapsed' : '')}>
      {title && (
        <div className="docs-code__title">
          <Icon.file />
          {title}
        </div>
      )}
      <div className="docs-code__body">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: highlight() escapes every character it emits */}
        <pre tabIndex={0}><code dangerouslySetInnerHTML={{ __html: highlight(code, lang) }} /></pre>
        <div className="docs-code__copy">
          <CopyButton text={code} label="Copy code" />
        </div>
        {long && !open && (
          <div className="docs-code__fade">
            <button type="button" className="docs-btn" onClick={() => setOpen(true)}>
              Expand · {lines} lines
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───── segmented control with a sliding pill ───── */
export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const button = ref.current?.querySelector<HTMLButtonElement>(`[data-v="${value}"]`);
    if (button) setPill({ left: button.offsetLeft, width: button.offsetWidth });
  }, [value]);
  return (
    <div className="docs-seg" role="group" aria-label={label} ref={ref}>
      {pill && <span className="docs-seg__pill" style={{ left: pill.left, width: pill.width }} />}
      {options.map((o) => (
        <button key={o.v} type="button" data-v={o.v} aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───── a remembered choice: per-viewer convenience only ───── */
export function useStored<T extends string>(key: string, initial: T, allowed: readonly T[]): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key) as T | null;
      return stored && allowed.includes(stored) ? stored : initial;
    } catch {
      return initial;
    }
  });
  const set = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // Storage blocked: keep the choice for this visit.
    }
  };
  return [value, set];
}

export function useReplay(): [number, () => void] {
  const [run, setRun] = useState(0);
  return [run, () => setRun((n) => n + 1)];
}

/* ───── install command with package-manager choice ───── */
export const PMS = ['npm', 'pnpm', 'yarn', 'bun'] as const;
export type PM = (typeof PMS)[number];
const ADD: Record<PM, string> = { npm: 'npm install', pnpm: 'pnpm add', yarn: 'yarn add', bun: 'bun add' };

export function Command({ packages }: { packages: string }) {
  const [pm, setPm] = useStored<PM>('paper-ui-pm', 'npm', PMS);
  const cmd = `${ADD[pm]} ${packages}`;
  return (
    <div className="docs-cmd">
      <div className="docs-cmd__bar">
        <Icon.terminal className="docs-cmd__term" />
        <div className="docs-cmd__pms" role="group" aria-label="Package manager">
          {PMS.map((p) => (
            <button key={p} type="button" aria-pressed={p === pm} onClick={() => setPm(p)}>
              {p}
            </button>
          ))}
        </div>
        <CopyButton text={cmd} label="Copy command" />
      </div>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: escaped by highlight() */}
      <pre tabIndex={0}><code dangerouslySetInnerHTML={{ __html: highlight(cmd, 'sh') }} /></pre>
    </div>
  );
}
