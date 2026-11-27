import { camera, cuboid, fit, flat, planeMatrix, poly, poly3, prism3, proj, rrect, seg, slab, type Vec2, type Vec3 } from "../core/iso";
import { spring, stepS, type Spring } from "../core/motion";
import { define, emit, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, toView } from "../core/stage";

/**
 * Tabs — a tablist, built as a card-index drawer.
 *
 * A dovetailed wooden drawer with a label holder and a cup pull on its front
 * holds a run of index cards against a follower block. Each tab is a guide
 * card with its tab cut at its own place along the top, so every label shows,
 * and a few record cards filed behind it. The selected guide card rises out
 * of the drawer with a signal clip on its tab; switching drops the old card
 * and lifts the new one on a snap spring, and the record cards beside them
 * jostle. Hovering a tab with a mouse lifts that card a little; a press
 * selects it at once; a press on the drawer itself selects the next tab.
 *
 * Semantics come from a visually hidden `role="tablist"` of `role="tab"`
 * buttons with a roving tabindex, arrow keys, Home and End. The panels are the
 * app's: render the panel for the selected index, and pass `ids` to point
 * each tab's aria-controls at its panel.
 */

export type TabsOptions = BaseOptions & {
  /** The tabs, front card first. Short labels: the tabs show up to 6 characters. Default ["Home","Specs","Price","Notes"]. */
  tabs?: string[];
  /** The selected tab's index. */
  value?: number;
  defaultValue?: number;
  onValueChange?: (index: number) => void;
  /** The panels' element ids, in tab order: each tab gets aria-controls for its panel. */
  ids?: string[];
  /** Set by the React wrapper when `value` is controlled: the control asks, the prop decides. */
  controlled?: boolean;
};

const VW = 240, VH = 190;
const AZ = 26, EL = 40;
const CX = 37, IX = 38.4, WT = 2.4, OX = IX + WT; // card half-width, drawer inner and outer half-width
const FZ = 2.4, WH = 16.5, FH = 19.5; // floor top, side wall top, drawer front top
const CH = 26.5, TH = 6.2; // card height, tab height
// guide cards are spaced so a raised card stops just under the tab behind it: D·cos az·sin el ≥ RISE·cos el
const D = 8.6, FILL = [2.2, 4.3, 6.4]; // guide-card spacing; record cards behind each guide
const RISE = 6.5;

export const tabs = define<TabsOptions>({
  id: "tabs",
  label: "Tabs",
  vw: VW,
  vh: VH,
  width: 250,
  keys: ["tabs", "value", "defaultValue", "onValueChange", "ids", "controlled"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg, doc } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(AZ, EL);
    let P = proj(C);
    const g = mk("g", {}, svg);
    const tablist = doc.createElement("div");
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-orientation", "horizontal");
    tablist.setAttribute("data-knurl-sr", "");
    host.appendChild(tablist);
    host.setAttribute("data-knurl-hit", "");

    type Card = {
      y: number; guide: number; section: number; x0: number; x1: number;
      g: SVGGElement; face: SVGPathElement; rules: SVGPathElement | null; text: SVGTextElement | null; clip: SVGPathElement | null; edge: SVGPathElement | null;
      sp: Spring; drawn: number; lit: boolean;
    };
    let cards: Card[] = [];
    let guides: Card[] = [];
    let buttons: HTMLButtonElement[] = [];
    let labels: string[] = [];
    let value = 0;
    let hover = -1;

    const list = () => (Array.isArray(opts.tabs) && opts.tabs.length ? opts.tabs.map(String) : ["Home", "Specs", "Price", "Notes"]);
    const clampI = (i: number) => Math.max(0, Math.min(labels.length - 1, Math.round(i)));

    /** A point on the plane of a card at depth y. */
    const at = (x: number, y: number, z: number) => P(x, y, z);

    function build() {
      g.replaceChildren();
      tablist.replaceChildren();
      labels = list();
      const n = labels.length;
      const YF = 0, Y0 = YF - 3.6;
      const yLast = Y0 - (n - 1) * D - FILL[FILL.length - 1];
      const yFol = yLast - 1.2; // the follower block's face
      const YB = yFol - 6.5; // inner face of the back wall
      const ext: Vec3[] = [[-OX - 1.2, YB - WT, 0], [OX + 1.2, YF + 3, 0], [-OX - 1.2, YF + 3, 0], [OX + 1.2, YB - WT, 0], [-OX, YB, FZ + CH + TH + RISE + 1], [OX, Y0, FZ + CH + TH + RISE + 1], [-OX, Y0, FZ + CH + TH + RISE + 1]];
      fit(C, ext, VW / 2, VH / 2 + 1, VW - 14, VH - 12);
      P = proj(C);

      // the drawer: shadow, floor, back and left walls, the follower block
      shadow(g, flat(P, rrect(-OX - 1.2, YB - WT + 3, OX + 1.2, YF + 6, 2), 0));
      solid(g).put(slab(C, P, -OX, YB - WT, OX, YF, 0.6, 0, FZ));
      solid(g).put(slab(C, P, -OX, YB - WT, OX, YB, 0.4, FZ, WH));
      solid(g).put(slab(C, P, -OX, YB, -IX, YF, 0.4, FZ, WH));
      // the follower: a block that slides on the floor and keeps the cards upright, with its knob
      solid(g).put(slab(C, P, -CX + 7, yFol - 5.5, CX - 7, yFol, 0.8, FZ, FZ + 13));
      line(g, "lo").setAttribute("d", seg(at(-CX + 8.5, yFol, FZ + 11.2), at(CX - 8.5, yFol, FZ + 11.2)));
      // its release rod stands up behind the last card, with a knob to pull it by
      solid(g).put(poly3(C, P, ...box(cuboid([0, yFol - 2.75, FZ + 13 + (CH - 9.5) / 2], 0.9, 0.9, (CH - 9.5) / 2))));
      solid(g).put(poly3(C, P, ...box(prism3([0, yFol - 2.75, FZ + CH + 4.3], oct(1.5), 0.6))));
      solid(g).put(poly3(C, P, ...box(prism3([0, yFol - 2.75, FZ + CH + 5.6], oct(2.3), 0.7))));

      // the cards, back to front: each section is a guide card with its records filed behind it
      cards = [];
      guides = [];
      buttons = [];
      const TW = Math.min(22, (2 * CX - 2) / n);
      const stepX = n > 1 ? (2 * CX - 2 - TW) / (n - 1) : 0;
      for (let i = n - 1; i >= 0; i--) {
        const yg = Y0 - i * D;
        for (const f of FILL.slice().reverse()) cards.push(makeCard(yg - f, -1, i, 0, 0));
        const x0 = -CX + 1 + i * stepX;
        const c = makeCard(yg, i, i, x0, x0 + TW);
        cards.push(c);
        guides[i] = c;
      }

      // the right wall over the cards' ends, with the back wall's dovetails showing on it
      solid(g).put(slab(C, P, IX, YB - WT, OX, YF, 0.4, FZ, WH));
      const tails: string[] = [];
      const m = 5, h = (WH - 0.6) / m;
      for (let k = 0; k < m; k += 2) {
        const z0 = 0.4 + k * h, z1 = z0 + h;
        tails.push(seg(P(OX, YB - WT, z0), P(OX, YB + 0.4, z0 + 0.25)) + seg(P(OX, YB + 0.4, z0 + 0.25), P(OX, YB + 0.4, z1 - 0.25)) + seg(P(OX, YB + 0.4, z1 - 0.25), P(OX, YB - WT, z1)));
      }
      line(g, "lo").setAttribute("d", tails.join(""));
      line(g, "lo").setAttribute("d", seg(P(OX, YB - WT + 0.2, FZ), P(OX, YF - 0.2, FZ)));

      // the drawer front: a wider panel, its bevel, a brass label holder with its card and rivets, a cup pull on two screws
      const FX = OX + 1.2, FY0 = YF, FY1 = YF + 3;
      solid(g).put(slab(C, P, -FX, FY0, FX, FY1, 0.6, 0, FH));
      const face = (x: number, z: number) => P(x, FY1, z);
      line(g, "lo").setAttribute("d", poly([face(-FX + 2, 1.6), face(FX - 2, 1.6), face(FX - 2, FH - 1.6), face(-FX + 2, FH - 1.6)]));
      solid(g).put(poly3(C, P, ...box(cuboid([0, FY1 + 0.3, 14], 9.5, 0.3, 2.9))));
      mk("path", { class: "k-face", d: poly([P(-7.8, FY1 + 0.62, 12.1), P(7.8, FY1 + 0.62, 12.1), P(7.8, FY1 + 0.62, 15.9), P(-7.8, FY1 + 0.62, 15.9)]) }, g);
      line(g, "lo").setAttribute("d", seg(P(-6, FY1 + 0.62, 14.6), P(5, FY1 + 0.62, 14.6)) + seg(P(-6, FY1 + 0.62, 13.2), P(2, FY1 + 0.62, 13.2)));
      const dots: string[] = [];
      for (const x of [-8.7, 8.7]) dots.push(dot(x, FY1 + 0.62, 14, 0.5));
      for (const x of [-9.6, 9.6]) dots.push(dot(x, FY1 + 0.02, 6.8, 0.55));
      mk("path", { class: "k-dot mid", d: dots.join("") }, g);
      // the pull: a hood, open underneath, profile in y–z, run along x
      const hood: Vec2[] = [[0, 0], [1.5, 0.4], [2.6, 1.8], [2.9, 3.5], [2.3, 4.7], [0, 5.1]];
      solid(g).put(poly3(C, P, ...box(prism3([0, FY1, 4.2], hood, 7.6, [[0, 1, 0], [0, 0, 1], [1, 0, 0]]))));
      mk("path", { class: "k-slot", d: poly([P(-7.2, FY1 + 0.2, 4.35), P(7.2, FY1 + 0.2, 4.35), P(7.2, FY1 + 1.4, 4.6), P(-7.2, FY1 + 1.4, 4.6)]) }, g);

      // the native tabs
      labels.forEach((label, i) => {
        const b = doc.createElement("button");
        b.type = "button";
        b.setAttribute("role", "tab");
        b.textContent = label;
        tablist.appendChild(b);
        buttons.push(b);
        bag.on(b, "click", () => { if (!opts.disabled) ask(i); });
      });
      const first = opts.value ?? opts.defaultValue ?? value;
      value = clampI(typeof first === "number" && Number.isFinite(first) ? first : 0);
      guides.forEach((c, i) => { c.sp.x = c.sp.t = i === value ? RISE : 0; });
      sync();
      cards.forEach((c) => draw(c));
    }

    const box = (s: { verts: Vec3[]; faces: number[][] }) => [s.verts, s.faces] as const;
    const oct = (r: number): Vec2[] => Array.from({ length: 16 }, (_, k): Vec2 => [Math.cos((k / 16) * Math.PI * 2) * r, Math.sin((k / 16) * Math.PI * 2) * r]);
    const dot = (x: number, y: number, z: number, r: number) => poly(Array.from({ length: 12 }, (_, k): Vec2 => P(x + Math.cos((k / 12) * Math.PI * 2) * r, y, z + Math.sin((k / 12) * Math.PI * 2) * r)));

    function makeCard(y: number, guide: number, section: number, x0: number, x1: number): Card {
      const cg = mk("g", {}, g);
      const face = mk("path", { class: "k-face" }, cg);
      const isG = guide >= 0;
      const rules = isG ? line(cg, "lo") : null;
      const edge = isG ? line(cg, "hi") : null;
      const text = isG ? (mk("text", { class: "k-text", "text-anchor": "middle" }, cg) as SVGTextElement) : null;
      const clip = isG ? (mk("path", { class: "k-led on" }, cg) as SVGPathElement) : null;
      if (text) {
        const s = labels[guide].slice(0, 6);
        text.textContent = s;
        const tw = x1 - x0;
        text.style.fontSize = Math.min(4.2, (tw - 2.6) / Math.max(1, s.length * 0.62)).toFixed(2) + "px";
      }
      // record cards jostle on a light spring when the guide card next to them moves; guides snap at ζ ≈ 0.46
      return { y, guide, section, x0, x1, g: cg, face, rules, text, clip, edge, sp: spring(0, isG ? { k: 320, c: 16.5, eps: 0.01 } : { k: 520, c: 16, eps: 0.01 }), drawn: NaN, lit: false };
    }

    function draw(c: Card) {
      const lit = c.guide === value && c.guide >= 0;
      const z = c.sp.x;
      if (z === c.drawn && lit === c.lit) return;
      c.drawn = z; c.lit = lit;
      const z0 = FZ + z, zt = z0 + CH, y = c.y;
      const pts: Vec2[] = [at(-CX, y, z0 + 0.4), at(CX, y, z0 + 0.4), at(CX, y, zt - 0.8), at(CX - 0.8, y, zt)];
      if (c.guide >= 0) {
        const r = 1.3;
        pts.push(at(c.x1, y, zt), at(c.x1 - 0.5, y, zt + TH - r), at(c.x1 - 0.5 - r, y, zt + TH), at(c.x0 + 0.5 + r, y, zt + TH), at(c.x0 + 0.5, y, zt + TH - r), at(c.x0, y, zt));
      }
      pts.push(at(-CX + 0.8, y, zt), at(-CX, y, zt - 0.8));
      c.face.setAttribute("d", poly(pts));
      if (c.guide < 0) return;
      // the guide card's ruled heading and lines, its tab's label, the signal clip on the selected one
      const L = (zz: number) => seg(at(-CX + 3, y, zz), at(CX - 3, y, zz));
      c.rules!.setAttribute("d", L(zt - 4.2) + L(zt - 4.9) + L(zt - 8.6) + L(zt - 12.4) + L(zt - 16.2));
      const xc = (c.x0 + c.x1) / 2;
      c.text!.setAttribute("transform", planeMatrix(P, [xc, y, zt + TH / 2], [1, 0, 0], [0, 0, -1]) + " translate(0 1.4)");
      c.text!.setAttribute("class", lit ? "k-text hi" : "k-text");
      c.clip!.setAttribute("d", lit ? poly([at(c.x1 - 4.6, y + 0.05, zt + TH + 0.35), at(c.x1 - 2.2, y + 0.05, zt + TH + 0.35), at(c.x1 - 2.2, y + 0.05, zt + TH - 2.6), at(c.x1 - 4.6, y + 0.05, zt + TH - 2.6)]) : "");
      c.edge!.setAttribute("d", lit ? poly(pts.slice(2)).replace(/Z$/, "") : "");
    }

    const B = register(host, (dt) => {
      let m = false;
      for (const c of cards) {
        if (c.guide >= 0) c.sp.t = c.guide === value ? RISE : c.guide === hover ? 1.8 : 0;
        if (stepS(c.sp, dt)) m = true;
        // a record card can't sink into the floor
        if (c.sp.x < 0) { c.sp.x = 0; c.sp.v = Math.abs(c.sp.v) * 0.3; }
        draw(c);
      }
      return m;
    });
    bag.add(B.unregister);

    function sync() {
      tablist.setAttribute("aria-label", opts.label ?? "Tabs");
      host.setAttribute("data-state", String(value));
      const ids = Array.isArray(opts.ids) ? opts.ids : [];
      buttons.forEach((b, i) => {
        const on = i === value;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        b.disabled = !!opts.disabled;
        if (ids[i]) b.setAttribute("aria-controls", ids[i]); else b.removeAttribute("aria-controls");
      });
      for (const c of cards) c.drawn = NaN;
    }

    /** The record cards beside a guide that moves are pulled up a little by it, and drop back. */
    const jostle = (i: number, kick: number) => { for (const c of cards) if (c.guide < 0 && (c.section === i || c.section === i - 1)) c.sp.v += kick * (0.6 + Math.random() * 0.5); };
    const ask = (i: number) => {
      i = clampI(i);
      if (i === value) return;
      if (opts.controlled) { sync(); emit(opts.onValueChange, i); return; }
      jostle(value, 9); jostle(i, 16);
      value = i; sync(); B.wake(); emit(opts.onValueChange, i);
    };
    bag.on(tablist, "keydown", (e) => {
      const n = labels.length;
      const k = e.key, cur = buttons.indexOf(doc.activeElement as HTMLButtonElement), from = cur >= 0 ? cur : value;
      const to = k === "ArrowRight" || k === "ArrowDown" ? (from + 1) % n : k === "ArrowLeft" || k === "ArrowUp" ? (from + n - 1) % n : k === "Home" ? 0 : k === "End" ? n - 1 : -1;
      if (to < 0 || opts.disabled) return;
      e.preventDefault();
      buttons[to].focus({ preventScroll: true });
      ask(to);
    });

    // pointer: a tab (front card first, since it hides what is behind), then a card's top showing above the drawer, else the drawer: the next tab
    const inside = (pts: Vec2[], x: number, y: number) => {
      let r = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
      }
      return r;
    };
    const front = () => cards.slice().sort((a, b) => b.y - a.y);
    const target = (e: PointerEvent): { i: number; on: boolean } => {
      const [sx, sy] = toView(svg, e, VW, VH);
      for (const c of front()) {
        const zt = FZ + c.sp.x + CH;
        if (c.guide >= 0 && inside([at(c.x0, c.y, zt), at(c.x1, c.y, zt), at(c.x1, c.y, zt + TH), at(c.x0, c.y, zt + TH)], sx, sy)) return { i: c.guide, on: true };
        if (inside([at(-CX, c.y, Math.max(WH, FZ + c.sp.x)), at(CX, c.y, Math.max(WH, FZ + c.sp.x)), at(CX, c.y, zt), at(-CX, c.y, zt)], sx, sy) && (c.guide >= 0 || zt > FH))
          return { i: c.section, on: true };
      }
      return { i: (value + 1) % labels.length, on: false };
    };
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0 || !labels.length) return;
      if (e.target instanceof HTMLButtonElement) return;
      const t = target(e);
      hover = -1;
      buttons[t.i]?.focus({ preventScroll: true });
      ask(t.i);
      B.wake();
      e.preventDefault();
    });
    bag.on(host, "pointermove", (e) => {
      if (e.pointerType !== "mouse" || opts.disabled || !labels.length) return;
      const t = target(e);
      const h = t.i === value ? -1 : t.i;
      if (h !== hover) { hover = h; B.wake(); }
    });
    bag.on(host, "pointerleave", () => { if (hover !== -1) { hover = -1; B.wake(); } });

    build();
    bag.add(() => { tablist.remove(); host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state"); svg.replaceChildren(); });
    return {
      update(next, prev) {
        opts = next;
        if (JSON.stringify(next.tabs) !== JSON.stringify(prev.tabs)) build();
        if (typeof next.value === "number" && Number.isFinite(next.value) && clampI(next.value) !== value) value = clampI(next.value);
        sync();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
