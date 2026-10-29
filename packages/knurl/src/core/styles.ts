/**
 * Knurl — the stylesheet, as a string, and the one function that injects it.
 *
 * Every selector sits inside `:where()`, so each rule has zero specificity and
 * any rule of the page wins without `!important` (Hairline's approach).
 * The `--knurl-*` properties are the public theme; `--k-*` are private and read
 * them with the palette as the fallback.
 *
 * Two finishes from the same geometry:
 *  - `line`  — hairlines over plates filled with the page colour (Hairline);
 *  - `solid` — four-tone shaded sides, lighter lids, a soft contact shadow (Anatomy).
 */

const LIGHT = {
  plate: "#ffffff", hi: "#1d1d20", edge: "#9d9da6", mid: "#c3c3c9", lo: "#e2e2e6",
  top: "#ffffff", s0: "#d9d9d6", s1: "#e3e3e0", s2: "#ecece9", s3: "#f5f5f2", shadow: "#6f6f66", "shadow-o": "0.28",
  accent: "#f76b15",
};
const DARK = {
  plate: "#09090b", hi: "#e4e6eb", edge: "#5d5f66", mid: "#3d3e44", lo: "#26272b",
  top: "#202024", s0: "#0e0e10", s1: "#121214", s2: "#161619", s3: "#1b1b1e", shadow: "#000000", "shadow-o": "0.75",
  accent: "#ff8a3d",
};
const KEYS = Object.keys(LIGHT) as (keyof typeof LIGHT)[];
type Palette = Record<(typeof KEYS)[number], string>;

const vars = (p: Palette) => KEYS.map((k) => `--k-${k}:var(--knurl-${k},${p[k]});`).join("");
const EASE = "cubic-bezier(0.32,0.72,0,1)";
const H = ":where([data-knurl])";
const S = ":where([data-knurl]>svg)";
const SOLID = ':where([data-knurl][data-knurl-finish="solid"]>svg)';

export function css(lightDark: boolean): string {
  const both = Object.fromEntries(KEYS.map((k) => [k, k === "shadow-o" ? LIGHT[k] : `light-dark(${LIGHT[k]},${DARK[k]})`])) as Palette;
  return [
    `${H}{display:inline-block;position:relative;vertical-align:middle;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;--k-sw:var(--knurl-stroke,0.9);${vars(LIGHT)}}`,
    lightDark ? `${H}{${vars(both)}}` : "",
    `:where(.dark,[data-theme="dark"]) ${H}{${vars(DARK)}}`,
    `:where([data-knurl][data-knurl-theme="light"]){${vars(LIGHT)}}`,
    `:where([data-knurl][data-knurl-theme="dark"]){${vars(DARK)}}`,
    `${S}{display:block;width:100%;height:auto;overflow:visible}`,
    `:where([data-knurl]:has(input:focus-visible),[data-knurl]:has(button:focus-visible)){outline:1.5px solid var(--k-hi);outline-offset:4px;border-radius:6px}`,
    `:where([data-knurl][data-disabled]){opacity:.45;pointer-events:none}`,
    `:where([data-knurl] [data-knurl-sr]){position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;opacity:0}`,
    `:where([data-knurl][data-knurl-hit]){cursor:pointer}`,
    // drawing: line finish
    `${S} :where(path,ellipse,circle,polygon){stroke-width:var(--k-sw);vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}`,
    `${S} :where(.k-fill){fill:var(--k-plate);stroke:none}`,
    `${S} :where(.k-shade,.k-top,.k-shadow){display:none}`,
    `${S} :where(.k-crease){fill:none;stroke:var(--k-lo)}`,
    `${S} :where(.k-edge){fill:none;stroke:var(--k-edge);transition:stroke 240ms ${EASE}}`,
    `${S} :where(.k-lit>.k-edge){stroke:var(--k-hi)}`,
    `${S} :where(.k-line){fill:none;stroke:var(--k-mid);transition:stroke 240ms ${EASE}}`,
    `${S} :where(.k-line.hi){stroke:var(--k-hi)}`,
    `${S} :where(.k-line.edge){stroke:var(--k-edge)}`,
    `${S} :where(.k-line.lo){stroke:var(--k-lo)}`,
    `${S} :where(.k-line.accent){stroke:var(--k-accent)}`,
    `${S} :where(.k-line.dash){stroke-dasharray:1 3}`,
    `${S} :where(.k-face){fill:var(--k-plate);stroke:var(--k-edge)}`,
    `${S} :where(.k-slot){fill:var(--k-lo);stroke:var(--k-edge)}`,
    `${S} :where(.k-dot){fill:var(--k-hi);stroke:none}`,
    `${S} :where(.k-dot.mid){fill:var(--k-edge)}`,
    `${S} :where(.k-dot.lo){fill:var(--k-mid)}`,
    `${S} :where(.k-led){fill:var(--k-plate);stroke:var(--k-edge);transition:fill 240ms ${EASE},stroke 240ms ${EASE}}`,
    `${S} :where(.k-led.on){fill:var(--k-accent);stroke:var(--k-accent)}`,
    `${S} :where(.k-glow){fill:var(--k-accent);stroke:none;opacity:0;transition:opacity 320ms ${EASE};filter:blur(4px)}`,
    `${S} :where(.k-glow.on){opacity:.35}`,
    `${S} :where(.k-text){fill:var(--k-edge);stroke:none;font:500 6px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;letter-spacing:.04em}`,
    `${S} :where(.k-text.hi){fill:var(--k-hi)}`,
    // solid finish
    `${SOLID} :where(.k-fill){fill:var(--k-s2)}`,
    `${SOLID} :where(.k-shade){display:inline;stroke:none}`,
    `${SOLID} :where(.k-shade[data-s="0"]){fill:var(--k-s0)}`,
    `${SOLID} :where(.k-shade[data-s="1"]){fill:var(--k-s1)}`,
    `${SOLID} :where(.k-shade[data-s="2"]){fill:var(--k-s2)}`,
    `${SOLID} :where(.k-shade[data-s="3"]){fill:var(--k-s3)}`,
    `${SOLID} :where(.k-top){display:inline;fill:var(--k-top);stroke:none}`,
    `${SOLID} :where(.k-shadow){display:inline;fill:var(--k-shadow);stroke:none;opacity:var(--k-shadow-o);filter:blur(5px)}`,
    `${SOLID} :where(.k-edge){stroke:var(--k-mid)}`,
    `${SOLID} :where(.k-crease){stroke:var(--k-s3)}`,
    `${SOLID} :where(.k-lit>.k-edge){stroke:var(--k-hi)}`,
    `${SOLID} :where(.k-face){fill:var(--k-s3);stroke:var(--k-mid)}`,
    `${SOLID} :where(.k-line){stroke:var(--k-edge)}`,
    `${SOLID} :where(.k-slot){fill:var(--k-s0);stroke:var(--k-mid)}`,
    `${SOLID} :where(.k-line.lo){stroke:var(--k-mid)}`,
    `${SOLID} :where(.k-line.hi){stroke:var(--k-hi)}`,
    `${SOLID} :where(.k-line.accent){stroke:var(--k-accent)}`,
    `@media (prefers-reduced-motion:reduce){${S} :where(*){transition:none!important}}`,
  ].join("");
}

const done = new WeakSet<Document | ShadowRoot>();

/** Puts the stylesheet in a document or shadow root, once. */
export function inject(root: Document | ShadowRoot): void {
  if (done.has(root)) return;
  done.add(root);
  const doc = root.nodeType === 9 ? (root as Document) : (root as ShadowRoot).ownerDocument;
  const win = doc.defaultView;
  const text = css(!!win?.CSS?.supports?.("color", "light-dark(#000,#fff)"));
  if (win && "adoptedStyleSheets" in root) {
    try {
      const sheet = new win.CSSStyleSheet();
      sheet.replaceSync(text);
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      return;
    } catch { /* fall through */ }
  }
  const style = doc.createElement("style");
  style.setAttribute("data-knurl-style", "");
  style.textContent = text;
  (root.nodeType === 9 ? doc.head ?? doc.documentElement : root).appendChild(style);
}
