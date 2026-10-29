import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

/**
 * The site's previews play themselves while nobody is using them.
 *
 * A pointer over a preview, focus in it, a press, a key, a wheel or a drag pauses it at once.
 * A readout (a gauge, a tank, a track) has nothing of its own to click, so with `tap` a click
 * on it plays the demo's next step instead.
 * It picks up again 3 seconds after the pointer leaves and focus goes. It never plays offscreen,
 * in a background tab or under prefers-reduced-motion. This is only the site's demo:
 * the controls themselves never move without a prop change or a user.
 */

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const IDLE = 3000;

function useIdlePlay(ref: RefObject<HTMLElement | null>, ms: number, tick: (i: number, root: HTMLElement) => void, tap?: string) {
  const fn = useRef(tick);
  fn.current = tick;
  const step = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    let busy = false, last = 0, seen = true;
    const touch = () => { last = performance.now(); };
    const hold = () => { busy = true; touch(); };
    const settle = () => setTimeout(() => { busy = el.matches(":hover") || el.contains(document.activeElement); touch(); }, 0);
    // a click on the readout named by `tap` plays the next step at once
    const onClick = (e: Event) => { if (tap && (e.target as Element | null)?.closest?.(tap)) fn.current(step.current++, el); };
    const evs: [string, (e: Event) => void][] = [
      ["click", onClick],
      ["pointerenter", hold], ["pointerleave", settle], ["focusin", hold], ["focusout", settle],
      ["pointerdown", hold], ["keydown", touch], ["wheel", touch], ["dragenter", hold], ["dragleave", settle], ["drop", settle],
    ];
    for (const [k, f] of evs) el.addEventListener(k, f, { passive: true });
    const target = el.firstElementChild ?? el;
    const io = typeof IntersectionObserver === "function" ? new IntersectionObserver(([e]) => { seen = e.isIntersecting; }) : null;
    io?.observe(target);
    const t = setInterval(() => {
      if (busy || !seen || document.hidden || performance.now() - last < IDLE) return;
      fn.current(step.current++, el);
    }, ms);
    return () => {
      clearInterval(t);
      io?.disconnect();
      for (const [k, f] of evs) el.removeEventListener(k, f);
    };
  }, [ref, ms, tap]);
}

/** A controlled value that moves by itself: `next` gives the value after `v` every `ms`. */
export function Auto<T>({ init, next, ms = 1800, tap, children }: {
  init: T;
  next: (v: T, i: number) => T;
  ms?: number;
  /** A selector for the readout inside whose click plays the next step, e.g. "[data-knurl=gauge]". */
  tap?: string;
  children: (v: T, set: (v: T) => void) => ReactNode;
}) {
  const [v, setV] = useState(init);
  const ref = useRef<HTMLDivElement>(null);
  useIdlePlay(ref, ms, (i) => setV((x) => next(x, i)), tap);
  return <div className={tap ? "auto tap" : "auto"} ref={ref}>{children(v, setV)}</div>;
}

/** Something to do every `ms`, for controls without a value to drive, like a key to press. */
export function AutoAct({ act, ms = 1800, children }: { act: (root: HTMLElement, i: number) => void; ms?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useIdlePlay(ref, ms, (i, root) => act(root, i));
  return <div className="auto" ref={ref}>{children}</div>;
}

// next-value helpers

export const flip = (b: boolean) => !b;

/** A new value in [lo, hi] on the step grid, far enough from the last to be seen. */
export const wander = (lo: number, hi: number, step = 1) => (v: number) => {
  const n = Math.round((hi - lo) / step);
  for (let k = 0; k < 8; k++) {
    const x = +(lo + Math.round(Math.random() * n) * step).toFixed(6);
    if (Math.abs(x - v) >= (hi - lo) * 0.18) return x;
  }
  return v > (lo + hi) / 2 ? lo + (hi - lo) * 0.25 : lo + (hi - lo) * 0.75;
};

/** A new [low, high] inside [lo, hi], at least `gap` apart. */
export const wanderPair = (lo: number, hi: number, step = 1, gap = 0) => (): [number, number] => {
  const n = Math.round((hi - lo) / step), q = (x: number) => +(lo + Math.round(x * n) * step).toFixed(6);
  const a = q(Math.random() * 0.45), b = q(0.5 + Math.random() * 0.45);
  return [a, Math.max(b, a + gap)];
};

/** The next item, wrapping round (or back and forth with `bounce`). */
export const cycle = <T,>(list: readonly T[], bounce = false) => (v: T, i: number) => {
  const n = list.length;
  if (!bounce || n < 3) return list[(list.indexOf(v) + 1) % n];
  const k = i % (2 * n - 2);
  return list[k < n - 1 ? k + 1 : 2 * n - 3 - k];
};

/** Clicks the native buttons inside, one after another (a key is pressed by its hidden <button>). */
export const press = (gap = 160) => (root: HTMLElement) => {
  root.querySelectorAll<HTMLButtonElement>("[data-knurl] > button[data-knurl-sr]").forEach((b, k) => setTimeout(() => b.click(), k * gap));
};

/** Typing a code in, a digit per tick, then holding it and clearing it. */
export const typing = (codes: string[], hold = 3) => {
  const seq: string[] = [];
  for (const c of codes) { for (let k = 0; k <= c.length; k++) seq.push(c.slice(0, k)); for (let k = 0; k < hold; k++) seq.push(c); }
  return (_: string, i: number) => seq[(i + 1) % seq.length];
};

export type Lamp = { id: string; label: string; state: "off" | "ok" | "warn" | "alert" };
/** One lamp changes state per tick. */
export const blink = (items: Lamp[]): Lamp[] => {
  const pick = ["ok", "ok", "warn", "alert", "off"] as const, k = Math.floor(Math.random() * items.length);
  return items.map((x, i) => (i === k ? { ...x, state: pick.filter((p) => p !== x.state)[Math.floor(Math.random() * 4)] } : x));
};
/** Round the gate, back through the centre every fourth step. */
export const circle = (_: { x: number; y: number }, i: number) => {
  if (i % 4 === 3) return { x: 0, y: 0 };
  const a = i * 1.9;
  return { x: +(Math.cos(a) * 0.85).toFixed(2), y: +(Math.sin(a) * 0.85).toFixed(2) };
};
/** A timer in fast-forward: 20 s a tick down to zero, a pause for the bell, then wound again. */
export const wind = (s: number, i: number) => (s > 0 ? Math.max(0, s - 20) : i % 4 === 0 ? 8 * 60 : 0);
