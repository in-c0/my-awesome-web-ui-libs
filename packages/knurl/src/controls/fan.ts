import { add3, camera, clamp, compose, cyl, fit, lerp, loft, circle, planeMatrix, poly, poly3, prism3, proj, rad, rot, seg, turn, unproj, type Rot, type Vec2, type Vec3 } from "../core/iso";
import { spring, stepS, type Spring } from "../core/motion";
import { define, emit, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, toView, type Solid } from "../core/stage";

/**
 * Fan — a colour choice, built as a paint fan deck.
 *
 * A stack of colour strips is riveted at one end on a slotted Chicago screw,
 * between two heavier cover strips, and fanned open. Each strip carries its
 * colour chip at the far end, a printed number and code lines. The chosen
 * strip rides up the screw's barrel above the stack, its far end tipped up,
 * and swings a little clear of its neighbours, which shuffle aside on a snap
 * spring; its chip is outlined and its end ticked with the accent. Hovering a
 * strip with a mouse lifts it a little; a press picks it at once, and a drag
 * across the fan picks whatever strip passes under it.
 *
 * The chips are filled with the option colours (user data); everything else
 * takes the theme. Semantics come from visually hidden native radio inputs in
 * a `role="radiogroup"`.
 */

export type FanColour = {
  /** Any CSS colour: the chip is filled with it, and it is the value. */
  value: string;
  /** The colour's name: the radio's accessible name. */
  label: string;
};

export type FanOptions = BaseOptions & {
  /** The strips, in fan order. Default: eight paint colours. */
  options?: FanColour[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Set by the React wrapper when `value` is controlled: the control asks, the prop decides. */
  controlled?: boolean;
};

export const FAN_COLOURS: FanColour[] = [
  { value: "#28354d", label: "Ink" },
  { value: "#2f6f73", label: "Teal" },
  { value: "#8aa27a", label: "Sage" },
  { value: "#d8a23d", label: "Ochre" },
  { value: "#c8643b", label: "Terracotta" },
  { value: "#9b3a35", label: "Brick" },
  { value: "#6d4c6f", label: "Plum" },
  { value: "#b7aea0", label: "Stone" },
];

const VW = 260, VH = 170;
const AZ = 30, EL = 52;
const L = 54, W2 = 5.4, T = 0.75, CT = 1.5; // strip length from the rivet, half-width and thickness; cover thickness
const CH0 = 33.5, CH1 = 51.6, CW2 = 4.5; // the chip, in strip coordinates
const GAP = 1.3; // the clearance either side of the chosen strip, in steps
const RISE = 2.4, TILT = rad(3.4); // how far the chosen strip rides up the barrel, and tips its far end up
let uid = 0;

/** A strip's footprint, from the rivet out: a round end about the rivet, square-ish at the far end. Counter-clockwise. */
function stripRing(w2: number, len: number): Vec2[] {
  const pts: Vec2[] = [];
  for (let k = 0; k <= 12; k++) { const a = Math.PI / 2 + (k / 12) * Math.PI; pts.push([Math.cos(a) * w2, Math.sin(a) * w2]); }
  const r = 1.3;
  for (const [cx, cy, a0] of [[len - r, -w2 + r, -90], [len - r, w2 - r, 0]] as const)
    for (let k = 0; k <= 3; k++) { const a = rad(a0 + 30 * k); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return pts;
}

const RING = stripRing(W2, L);
const COVER = stripRing(W2 + 0.35, L + 0.6);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export const fan = define<FanOptions>({
  id: "fan",
  label: "Colour",
  vw: VW,
  vh: VH,
  width: 250,
  keys: ["options", "value", "defaultValue", "onValueChange", "controlled"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg, doc } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(AZ, EL);
    let P = proj(C);
    const TOP = Math.atan2(-Math.cos(rad(AZ)), -Math.sin(rad(AZ))); // the world angle that points up the screen

    const g = mk("g", {}, svg);
    const group = doc.createElement("div");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("data-knurl-sr", "");
    host.appendChild(group);
    host.setAttribute("data-knurl-hit", "");
    const gname = "knurl-fan-" + ++uid;

    type Strip = {
      i: number; v: string; label: string; colour: string;
      g: SVGGElement; sh: SVGPathElement; body: Solid; print: SVGPathElement; num: SVGTextElement;
      chip: SVGPathElement; ring: SVGPathElement; tip: SVGPathElement;
      input: HTMLInputElement; ang: Spring; lift: Spring; drawn: string; z: number;
    };
    let strips: Strip[] = [];
    let stack: SVGGElement = mk("g", {}, g);
    let barrel: SVGGElement = mk("g", {}, g);
    let covers: { el: SVGGElement; z: number }[] = [];
    let value = "";
    let hover = -1;
    let n = 0, STEP = rad(12), STRIPTOP = 0, STACK = 0, LIFTZ = 0;

    const list = (): FanColour[] => {
      const src = Array.isArray(opts.options) && opts.options.length ? opts.options : FAN_COLOURS;
      return src.map((c) => ({ value: String(c.value), label: String(c.label ?? c.value) }));
    };
    const index = () => Math.max(0, strips.findIndex((s) => s.v === value));
    const slotZ = (i: number) => CT + i * T;
    /** Where strip i sits in the fan, in steps from the first, with the chosen one's clearance either side. */
    const pos = (i: number, sel: number) => i + (i > sel ? 2 * GAP : i === sel ? GAP : 0);
    const angAt = (p: number) => TOP + (p - (n - 1 + 2 * GAP) / 2) * STEP;

    /** Places a point of a turned, tipped strip's top face (strip coordinates l along, c across). */
    const frame = (th: number, phi: number, z: number, h: number) => {
      const R: Rot = compose(rot("z", th), rot("y", -phi));
      const o: Vec3 = [0, 0, z + h];
      const at = (l: number, c: number): Vec3 => add3(o, turn(R, [l, c, h]));
      return { R, o, at, pt: (l: number, c: number): Vec2 => { const w = at(l, c); return P(w[0], w[1], w[2]); } };
    };

    function build() {
      g.replaceChildren();
      group.replaceChildren();
      const opt = list();
      n = opt.length;
      STEP = n > 1 ? Math.min(rad(12.5), rad(106) / (n - 1 + 2 * GAP)) : 0;
      STRIPTOP = CT + n * T; STACK = STRIPTOP + CT; LIFTZ = STACK + RISE;
      const first = opts.value ?? (value || undefined) ?? opts.defaultValue;
      const vals = opt.map((c) => c.value);
      value = vals.includes(first as string) ? (first as string) : opts.defaultValue && vals.includes(opts.defaultValue) ? opts.defaultValue : vals[0];
      const sel = Math.max(0, vals.indexOf(value));

      // fit the open fan: its two covers, its top, and the rivet
      const a0 = angAt(-1.25), a1 = angAt(n - 1 + 2 * GAP + 1.25);
      const ext: Vec3[] = [[-7, -7, 0], [7, 7, 0], [0, 0, LIFTZ + 4]];
      for (let k = 0; k <= 12; k++) { const a = lerp(a0, a1, k / 12); ext.push([Math.cos(a) * (L + 1), Math.sin(a) * (L + 1), LIFTZ + 3]); ext.push([Math.cos(a) * (L + 1), Math.sin(a) * (L + 1), 0]); }
      for (const a of [a0, a1]) for (const s of [-1, 1]) ext.push([Math.cos(a) * L - Math.sin(a) * W2 * s, Math.sin(a) * L + Math.cos(a) * W2 * s, 0]);
      fit(C, ext, VW / 2, VH / 2 + 2, VW - 14, VH - 12);
      P = proj(C);

      // a soft shadow under the open fan (solid finish)
      const sector: Vec2[] = [P(Math.cos(a0 - 1.6) * 5, Math.sin(a0 - 1.6) * 5 + 3, 0)];
      for (let k = 0; k <= 16; k++) { const a = lerp(a0 - 0.08, a1 + 0.08, k / 16); sector.push(P(Math.cos(a) * L, Math.sin(a) * L + 3, 0)); }
      sector.push(P(Math.cos(a1 + 1.6) * 5, Math.sin(a1 + 1.6) * 5 + 3, 0));
      shadow(g, poly(sector));

      stack = mk("g", {}, g);
      covers = [];
      // the two covers: heavier strips at each end of the fan, the top one embossed
      ([[a0, 0, false], [a1, STRIPTOP, true]] as const).forEach(([a, z, top]) => {
        const el = mk("g", {}, stack);
        const f = frame(a, 0, z, CT / 2);
        solid(el).put(poly3(C, P, ...spread(prism3(f.o, COVER, CT / 2, f.R))));
        const inner = stripRing(W2 - 0.9, L - 1.4).map(([l, c]) => f.pt(l + 0.2, c));
        line(el, "lo").setAttribute("d", poly(inner));
        // an embossed title plate near the far end and the printed lines on it, on the side the strips leave showing
        const c0 = top ? -3.2 : -4.3, c1 = top ? 3.2 : -0.4;
        mk("path", { class: "k-face", d: poly([f.pt(37, c0), f.pt(50, c0), f.pt(50, c1), f.pt(37, c1)]) }, el);
        line(el, "lo").setAttribute("d", seg(f.pt(39, c0 + 1.2), f.pt(48, c0 + 1.2)) + seg(f.pt(39, c0 + 2.6), f.pt(45, c0 + 2.6)));
        line(el, "mid").setAttribute("d", seg(f.pt(14, -2.8), f.pt(28, -2.8)) + seg(f.pt(14, -1.4), f.pt(22, -1.4)));
        covers.push({ el, z });
      });

      strips = opt.map((c, i) => {
        const sg = mk("g", {}, stack);
        const sh = mk("path", { class: "k-shadow" }, sg);
        const body = solid(sg);
        const print = line(sg, "lo");
        const num = mk("text", { class: "k-text" }, sg) as SVGTextElement;
        num.textContent = String(i + 1).padStart(2, "0");
        num.style.fontSize = "2.7px";
        const chip = mk("path", { class: "k-face" }, sg);
        chip.style.fill = c.value;
        const ring = mk("path", { class: "k-line hi" }, sg);
        const tip = mk("path", { class: "k-led on" }, sg);
        const input = doc.createElement("input");
        input.type = "radio"; input.value = c.value;
        input.setAttribute("aria-label", c.label);
        group.appendChild(input);
        const a = angAt(pos(i, sel));
        const s: Strip = {
          i, v: c.value, label: c.label, colour: c.value, g: sg, sh, body, print, num, chip, ring, tip, input,
          // a snap: ζ = c / 2√k ≈ 0.44, settling in about 0.3 s
          ang: spring(a, { k: 380, c: 17, eps: 0.0008 }),
          lift: spring(i === sel ? 1 : 0, { k: 420, c: 18, eps: 0.004 }),
          drawn: "", z: 0,
        };
        return s;
      });

      // the screw's barrel, seen in the gap under the chosen strip, then its washer and slotted head
      barrel = mk("g", {}, stack);
      solid(barrel).put(cyl(C, P, 0, 0, 1.6, STACK, LIFTZ + T, 24));
      const hz = LIFTZ + T + 0.15;
      solid(g).put(cyl(C, P, 0, 0, 4.1, hz, hz + 0.55, 32));
      solid(g).put(loft(C, P, circle(0, 0, 3.5, 32), hz + 0.55, hz + 1.9, circle(0, 0, 2.3, 32)));
      const sa = TOP + Math.PI / 2 + rad(20);
      line(g, "edge").setAttribute("d", seg(P(Math.cos(sa) * 1.9, Math.sin(sa) * 1.9, hz + 1.9), P(-Math.cos(sa) * 1.9, -Math.sin(sa) * 1.9, hz + 1.9)));
      sync();
      strips.forEach(draw);
      order();
    }

    const spread = (s: { verts: Vec3[]; faces: number[][] }) => [s.verts, s.faces] as const;

    function draw(s: Strip) {
      const lift = clamp(s.lift.x, -0.2, 1.3);
      const z = lerp(slotZ(s.i), LIFTZ, lift), phi = TILT * lift, th = s.ang.x;
      const lit = s.v === value;
      const key = `${th.toFixed(5)} ${z.toFixed(4)} ${lit}`;
      if (key === s.drawn) return;
      s.drawn = key; s.z = z;
      const f = frame(th, phi, z, T / 2);
      s.body.put(poly3(C, P, ...spread(prism3(f.o, RING, T / 2, f.R))));
      // its shadow falls on the stack below while it is up
      s.sh.setAttribute("d", lift > 0.08 ? poly(RING.filter((_, k) => k % 2 === 0).map(([l, c]) => {
        const w = turn(rot("z", th), [l + 1.5, c + 1.2, 0]);
        return P(w[0], w[1], STACK);
      })) : "");
      // printed code lines and the strip's number, on the side its neighbour leaves showing
      s.print.setAttribute("d", seg(f.pt(9, -3.5), f.pt(19, -3.5)) + seg(f.pt(9, -1.7), f.pt(15, -1.7)) + seg(f.pt(CH0 - 1.8, -W2 + 1), f.pt(CH0 - 1.8, W2 - 1)));
      const nw = f.at(21.5, -2.4);
      s.num.setAttribute("transform", planeMatrix(P, nw, turn(f.R, [1, 0, 0]), turn(f.R, [0, 1, 0])) + " translate(0 0.9)");
      const chip = poly([f.pt(CH0, -CW2), f.pt(CH1, -CW2), f.pt(CH1, CW2), f.pt(CH0, CW2)]);
      s.chip.setAttribute("d", chip);
      s.ring.setAttribute("d", lit ? chip : "");
      // the chosen strip's end is ticked with the accent, like a marked page
      s.tip.setAttribute("d", lit ? poly([f.pt(L - 1.7, -3.4), f.pt(L - 0.5, -3.4), f.pt(L - 0.5, 3.4), f.pt(L - 1.7, 3.4)]) : "");
      s.num.setAttribute("class", lit ? "k-text hi" : "k-text");
    }

    /** Paints the stack bottom to top: covers, strips at their heights, the barrel above the stack. */
    let last = "";
    function order() {
      const items: { el: SVGGElement; z: number }[] = [...covers, ...strips.map((s) => ({ el: s.g, z: s.z })), { el: barrel, z: STACK - 1e-3 }];
      items.sort((a, b) => a.z - b.z);
      const key = items.map((x) => x.z.toFixed(3)).join();
      if (key === last) return;
      last = key;
      for (const x of items) stack.appendChild(x.el);
    }

    function sync() {
      group.setAttribute("aria-label", opts.label ?? "Colour");
      host.setAttribute("data-state", value);
      for (const s of strips) {
        s.input.checked = s.v === value;
        s.input.disabled = !!opts.disabled;
        s.input.name = opts.name || gname;
        s.drawn = "";
      }
    }

    build();
    const B = register(host, (dt) => {
      const sel = index();
      let m = false;
      for (const s of strips) {
        s.ang.t = angAt(pos(s.i, sel));
        // a hovered strip lifts a little toward being picked
        s.lift.t = s.i === sel ? 1 : s.i === hover ? 0.32 : 0;
        if (stepS(s.ang, dt)) m = true;
        if (stepS(s.lift, dt)) m = true;
        draw(s);
      }
      order();
      return m;
    });
    bag.add(B.unregister);

    const ask = (v: string) => {
      if (v === value) return;
      if (opts.controlled) { sync(); emit(opts.onValueChange, v); return; }
      value = v; sync(); B.wake(); emit(opts.onValueChange, v);
    };
    bag.on(group, "change", (e) => { const t = e.target as HTMLInputElement; if (t.checked) ask(t.value); });

    /** The strip under the pointer, the top one first; -1 off the strips. */
    const stripAt = (sx: number, sy: number) => {
      for (const s of strips.slice().sort((a, b) => b.z - a.z)) {
        const th = s.ang.x, phi = TILT * clamp(s.lift.x, 0, 1), z = s.z + T, ca = Math.cos(th), sa = Math.sin(th);
        let [x, y] = unproj(C, sx, sy, z), l = x * ca + y * sa;
        // the far end is tipped up: look again at the height it has there
        [x, y] = unproj(C, sx, sy, z + Math.max(0, l) * Math.sin(phi));
        l = x * ca + y * sa;
        const c = -x * sa + y * ca;
        if (Math.abs(c) <= W2 && l <= L && (l >= 0 || l * l + c * c <= W2 * W2)) return s.i;
      }
      return -1;
    };
    /** What a press here picks: the strip under it; on the rivet, the next one round; anywhere else, the strip in that direction. */
    const target = (e: PointerEvent) => {
      const [sx, sy] = toView(svg, e, VW, VH);
      const [x, y] = unproj(C, sx, sy, STACK);
      if (Math.hypot(x, y) < 4.6) return { i: (index() + 1) % Math.max(1, n), on: true };
      const i = stripAt(sx, sy);
      if (i >= 0) return { i, on: true };
      const a = Math.atan2(y, x);
      let best = 0, d = 1e9;
      strips.forEach((s) => { const k = Math.abs(wrap(a - s.ang.x)); if (k < d) { d = k; best = s.i; } });
      return { i: best, on: false };
    };
    const choose = (i: number) => { const s = strips[i]; if (!s) return; s.input.focus({ preventScroll: true }); ask(s.v); };
    let dragging = false;
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0 || !n) return;
      const t = target(e);
      dragging = true;
      host.setPointerCapture?.(e.pointerId);
      hover = -1;
      choose(t.i);
      B.wake();
      e.preventDefault();
    });
    bag.on(host, "pointermove", (e) => {
      if (opts.disabled || !n) return;
      if (dragging) {
        // a drag across the fan picks each strip it passes over
        const [sx, sy] = toView(svg, e, VW, VH);
        const i = stripAt(sx, sy);
        if (i >= 0 && strips[i].v !== value) choose(i);
        return;
      }
      if (e.pointerType !== "mouse") return;
      const [sx, sy] = toView(svg, e, VW, VH);
      const i = stripAt(sx, sy);
      const h = i === index() ? -1 : i;
      if (h !== hover) { hover = h; B.wake(); }
    });
    const end = () => { dragging = false; };
    bag.on(host, "pointerup", end);
    bag.on(host, "pointercancel", end);
    bag.on(host, "pointerleave", () => { if (hover !== -1) { hover = -1; B.wake(); } });

    bag.add(() => { group.remove(); host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state"); svg.replaceChildren(); });
    return {
      update(next, prev) {
        opts = next;
        if (JSON.stringify(next.options) !== JSON.stringify(prev.options)) { build(); last = ""; }
        if (next.value !== undefined && next.value !== value && strips.some((s) => s.v === next.value)) value = next.value;
        sync();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
