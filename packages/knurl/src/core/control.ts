import { inject } from "./styles";

/**
 * Knurl — the public wrapper around an engine. It dresses the host element,
 * makes the svg, owns the options every control shares, and only ever removes
 * what it added.
 */

export type Theme = "auto" | "light" | "dark";
export type Finish = "line" | "solid";

/** Options every control takes. */
export type BaseOptions = {
  /** `"auto"` follows the page: an ancestor with `.dark` or `data-theme="dark"`, then `color-scheme`. */
  theme?: Theme;
  /** `"line"`: hairlines on plates (default). `"solid"`: shaded sides, lit lids and a contact shadow. */
  finish?: Finish;
  /** The accessible name. Each control has an English default. */
  label?: string;
  disabled?: boolean;
  /** A form field name: the control writes its value to a native input that submits with the form. */
  name?: string;
};

export type Control<O> = {
  /** Changes options on the running control. A key set to `undefined` goes back to its default; a key left out stays. */
  update(options: O): void;
  /** Stops the control and removes what it added. Safe to call twice. */
  destroy(): void;
};

export type EngineContext = {
  host: HTMLElement;
  svg: SVGSVGElement;
  doc: Document;
};

export type Engine<O> = { update(options: O, prev: O): void; destroy(): void };

export type Spec<O extends BaseOptions> = {
  id: string;
  label: string;
  /** viewBox size; the control's height follows its width at this ratio. */
  vw: number;
  vh: number;
  /** Default CSS width in px when the host has none. */
  width: number;
  /** The control's own option names (beyond BaseOptions), so a wrapper can tell options from attributes. */
  keys: readonly string[];
  /** The option that makes it controlled in React: "value" or "checked". */
  controlKey?: "value" | "checked";
  mount(ctx: EngineContext, options: O): Engine<O>;
};

const NS = "http://www.w3.org/2000/svg";
const mounted = new WeakMap<Element, () => void>();

export const report = (err: unknown) => {
  if (typeof reportError === "function") reportError(err);
  else setTimeout(() => { throw err; });
};

/** Calls a consumer callback without letting it unwind the shared frame loop. */
export function emit<A extends unknown[]>(fn: ((...a: A) => void) | undefined, ...args: A) {
  if (typeof fn === "function") try { fn(...args); } catch (err) { report(err); }
}

export const BASE_KEYS = ["theme", "finish", "label", "disabled", "name"] as const;

/** A mount function, carrying what a wrapper needs to know about it. */
export type Mount<O> = ((el: HTMLElement, options?: O) => Control<O>) & {
  readonly id: string; readonly keys: readonly string[]; readonly ratio: string; readonly controlKey?: "value" | "checked";
};

export function define<O extends BaseOptions>(spec: Spec<O>): Mount<O> {
  const create = function create(el: HTMLElement, options?: O): Control<O> {
    if (typeof document === "undefined") throw new Error(`knurl: ${spec.id}() needs a DOM; call it in the browser once the element exists.`);
    if (!el || el.nodeType !== 1) throw new TypeError(`knurl: ${spec.id}() takes an element as its first argument.`);
    mounted.get(el)?.();

    let opts = { ...options } as O;
    const doc = el.ownerDocument;
    const root = el.getRootNode();
    inject(root.nodeType === 9 || "host" in root ? (root as Document | ShadowRoot) : doc);

    const owned = new Set<string>();
    const attr = (name: string, value: string | null) => {
      if (!owned.has(name) && el.hasAttribute(name)) return;
      if (value === null) { el.removeAttribute(name); owned.delete(name); }
      else { el.setAttribute(name, value); owned.add(name); }
    };
    let ownWidth = false;
    if (!el.style.width) { el.style.width = spec.width + "px"; ownWidth = true; }
    const dress = () => {
      attr("data-knurl-theme", opts.theme === "light" || opts.theme === "dark" ? opts.theme : null);
      attr("data-knurl-finish", opts.finish === "solid" ? "solid" : "line");
      attr("data-disabled", opts.disabled ? "" : null);
    };
    attr("data-knurl", spec.id);
    dress();

    const svg = doc.createElementNS(NS, "svg") as SVGSVGElement;
    svg.setAttribute("viewBox", `0 0 ${spec.vw} ${spec.vh}`);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    el.appendChild(svg);

    const engine = spec.mount({ host: el, svg, doc }, opts);
    // a press on the drawing keeps focus where the control put it (its native input), instead of on <body>
    const keepFocus = (e: MouseEvent) => { if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement)) e.preventDefault(); };
    el.addEventListener("mousedown", keepFocus);

    let dead = false;
    const destroy = () => {
      if (dead) return;
      dead = true;
      if (mounted.get(el) === destroy) mounted.delete(el);
      engine.destroy();
      el.removeEventListener("mousedown", keepFocus);
      svg.remove();
      for (const n of owned) el.removeAttribute(n);
      owned.clear();
      if (ownWidth) { el.style.removeProperty("width"); if (!el.getAttribute("style")) el.removeAttribute("style"); }
    };
    mounted.set(el, destroy);

    return {
      update(next) {
        if (dead || !next) return;
        const prev = opts;
        const merged = { ...opts } as Record<string, unknown>;
        for (const k in next) {
          const v = (next as Record<string, unknown>)[k];
          if (v === undefined) delete merged[k]; else merged[k] = v;
        }
        opts = merged as O;
        dress();
        engine.update(opts, prev);
      },
      destroy,
    };
  };
  return Object.assign(create, { id: spec.id, keys: [...BASE_KEYS, ...spec.keys], ratio: `${spec.vw} / ${spec.vh}`, controlKey: spec.controlKey });
}

/** A visually hidden native input inside the host: keyboard, screen readers and forms come from the platform. */
export function nativeInput(ctx: EngineContext, attrs: Record<string, string>): HTMLInputElement {
  const i = ctx.doc.createElement("input");
  i.setAttribute("data-knurl-sr", "");
  for (const k in attrs) i.setAttribute(k, attrs[k]);
  ctx.host.appendChild(i);
  return i;
}

export const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Snaps v to min + k·step and clamps to [min, max]. */
export function snap(v: number, min: number, max: number, step: number) {
  if (max < min) [min, max] = [max, min];
  const s = step > 0 ? step : 0;
  let x = s ? min + Math.round((v - min) / s) * s : v;
  x = Math.max(min, Math.min(max, x));
  // trim float noise from the step
  if (!s) return x;
  const dec = Math.max(...[s, min].map((n) => (String(n).split(".")[1] ?? "").length));
  return Number(x.toFixed(Math.min(dec, 10)));
}

/** Remembers the host's own values of `names`; the returned function puts them back (or removes what it did not have). */
export function keepAttrs(host: HTMLElement, names: readonly string[]): () => void {
  const was = names.map((n) => [n, host.getAttribute(n)] as const);
  return () => { for (const [n, v] of was) if (v === null) host.removeAttribute(n); else host.setAttribute(n, v); };
}
