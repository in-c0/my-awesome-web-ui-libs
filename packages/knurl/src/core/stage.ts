import { r2, type SolidPaths, type Vec2 } from "./iso";
import { setReducedMotion } from "./motion";

/**
 * Knurl — the DOM side every control shares: svg nodes, the solid's seven
 * paths, one frame loop for every control on the page (asleep offscreen and
 * at rest), and the only reduced-motion query. The loop's shape follows
 * Hairline's stage (MIT, Lucas Marques).
 *
 * Nothing here touches `window` at import, so the module is safe to evaluate
 * during a server render.
 */

const NS = "http://www.w3.org/2000/svg";
export type Attrs = Record<string, string | number>;

export function mk<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Attrs | null, parent?: Element | null): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}

/** A solid in the DOM: shadow, silhouette fill, four shade bands, lid, crease and outline. */
export type Solid = {
  g: SVGGElement;
  put(s: SolidPaths): void;
  /** Mark the solid as the lit one: a brighter outline and lid. */
  lit(on: boolean): void;
};

export function solid(parent: Element, cls = ""): Solid {
  const g = mk("g", { class: ("k-solid " + cls).trim() }, parent);
  const fill = mk("path", { class: "k-fill" }, g);
  const sh = [0, 1, 2, 3].map((i) => mk("path", { class: "k-shade", "data-s": i }, g));
  const top = mk("path", { class: "k-top" }, g);
  const cr = mk("path", { class: "k-crease" }, g);
  const edge = mk("path", { class: "k-edge" }, g);
  let last = "";
  return {
    g,
    put(s) {
      const key = s.sil + s.crease;
      if (key === last) return;
      last = key;
      fill.setAttribute("d", s.sil);
      edge.setAttribute("d", s.sil);
      sh.forEach((p, i) => p.setAttribute("d", s.shades[i]));
      top.setAttribute("d", s.top);
      cr.setAttribute("d", s.crease);
    },
    lit(on) { g.classList.toggle("k-lit", on); },
  };
}

/** A line or set of lines with a tone class: `hi`, `edge`, `mid`, `lo`. */
export const line = (parent: Element, tone = "mid", extra = "") => mk("path", { class: `k-line ${tone} ${extra}`.trim() }, parent);

/** A soft contact shadow under a footprint (solid finish only). */
export const shadow = (parent: Element, d: string) => mk("path", { class: "k-shadow", d }, parent);

export const setD = (el: SVGElement, d: string) => { if (el.getAttribute("d") !== d) el.setAttribute("d", d); };
export const place = (el: SVGElement, q: Vec2) => { el.setAttribute("cx", String(r2(q[0]))); el.setAttribute("cy", String(r2(q[1]))); };

/* ───── one loop ───── */

export type Tick = (dt: number, now: number) => boolean | void;
export type Loop = { wake(): void; unregister(): void };
type Board = { el: Element; tick: Tick; vis: boolean; awake: boolean };

let boards: Board[] = [];
let raf = 0, last = 0;
let io: IntersectionObserver | null = null;
let rm: MediaQueryList | null = null;

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  let any = false;
  for (const b of boards.slice()) if (b.vis && b.awake) {
    try { b.awake = !!b.tick(dt, now); } catch (err) { b.awake = false; setTimeout(() => { throw err; }); }
    any = any || b.awake;
  }
  raf = any ? requestAnimationFrame(frame) : 0;
}

function wake(b: Board) {
  b.awake = true;
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
}

const onMotion = () => { setReducedMotion(!!rm?.matches); boards.forEach(wake); };

function start() {
  if (io) return;
  if (typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver((es) => {
      for (const e of es) for (const b of boards) if (b.el === e.target) { b.vis = e.isIntersecting; if (b.vis) wake(b); }
    }, { rootMargin: "80px" });
  }
  if (typeof matchMedia !== "undefined") {
    rm = matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(rm.matches);
    rm.addEventListener?.("change", onMotion);
  }
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  io?.disconnect(); io = null;
  rm?.removeEventListener?.("change", onMotion); rm = null;
}

/** Joins the shared loop. The tick runs once now, then each frame while the element is near the viewport and the tick returns true. */
export function register(el: Element, tick: Tick): Loop {
  start();
  const b: Board = { el, tick, vis: !io, awake: true };
  boards.push(b);
  io?.observe(el);
  tick(0, typeof performance !== "undefined" ? performance.now() : 0);
  let gone = false;
  return {
    wake: () => { if (!gone) wake(b); },
    unregister: () => {
      if (gone) return;
      gone = true;
      boards = boards.filter((x) => x !== b);
      if (!boards.some((x) => x.el === el)) io?.unobserve(el);
      if (!boards.length) stop();
    },
  };
}

/* ───── tear-down ───── */

export type Disposer = {
  add(fn: () => void): void;
  on<K extends keyof HTMLElementEventMap>(t: EventTarget, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions): void;
  dispose(): void;
};

export function disposer(): Disposer {
  let fns: Array<() => void> = [];
  return {
    add: (fn) => { fns.push(fn); },
    on: (t, type, fn, opts) => {
      const h = fn as EventListener;
      t.addEventListener(type, h, opts);
      fns.push(() => t.removeEventListener(type, h, opts));
    },
    dispose: () => { const run = fns; fns = []; for (let i = run.length - 1; i >= 0; i--) run[i](); },
  };
}

/** The pointer in viewBox units. */
export function toView(svg: SVGSVGElement, e: { clientX: number; clientY: number }, vw: number, vh: number): Vec2 {
  const r = svg.getBoundingClientRect();
  return [((e.clientX - r.left) / (r.width || 1)) * vw, ((e.clientY - r.top) / (r.height || 1)) * vh];
}
