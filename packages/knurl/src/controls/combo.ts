import { camera, cyl, depth, dot3, fit, flat, loft, open, planeMatrix, poly, poly3, prism3, proj, rad, rot, rrect, seg, slab, toViewer, type Projector, type SolidPaths, type Vec2, type Vec3 } from "../core/iso";
import { spring, stepS, type Spring } from "../core/motion";
import { define, emit, nativeInput, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, type Solid } from "../core/stage";

/**
 * Combo — a one-time-code input, built as a combination padlock.
 *
 * A body with a row of knurled number wheels behind a window, the digit above
 * and below each reading foreshortened on the wheel's curve, and accent
 * arrows marking the reading row. Typing sets the wheels left to right and
 * each one rolls to its digit. When the code is right (or `unlocked` is set)
 * the shackle springs up out of its hole and swings open on its long leg.
 *
 * Semantics come from one visually hidden `<input inputmode="numeric"
 * autocomplete="one-time-code">`, so typing, pasting, autofill from an SMS
 * and screen readers are the platform's own.
 */

export type ComboOptions = BaseOptions & {
  /** How many wheels (digits), 3 to 8. Default 4. */
  length?: number;
  /** The digits entered so far, left to right. */
  value?: string;
  defaultValue?: string;
  /** Called with the digits on every change, by typing, pointer, wheel or arrow keys. */
  onValueChange?: (value: string) => void;
  /** Called once all the digits are typed in, or when the lock opens. */
  onComplete?: (value: string) => void;
  /** The combination: the lock opens itself when the value matches it. */
  code?: string;
  /** Opens the shackle whatever the wheels read (e.g. once a server has checked the code). */
  unlocked?: boolean;
  /** Set by the React wrapper when `value` is controlled. */
  controlled?: boolean;
};

const VW = 240, VH = 210;
const AZ = 30, EL = 28;
const LIFT = 6.5, INS = 3.4, SWING = rad(124); // how far the shackle springs up, how deep its short leg sits, how far it swings
let uid = 0;

/**
 * One half of a bent round rod, from where it leaves a hole to the top of its
 * bow: the projected centre line offset by the radius each side (the outline
 * of a swept sphere), closed at the hole by the front half of the cut circle.
 * Each half rises all the way, so its outline never folds back on itself, even
 * seen edge-on; the open end, where the halves meet, is filled but not
 * stroked. The solid finish shades four bands across the rod's width.
 */
function tube(P: Projector, S: number, pts: readonly Vec3[], r: number) {
  const Q = pts.map((p) => P(p[0], p[1], p[2]));
  const n = Q.length, rs = r * S;
  const N: Vec2[] = Q.map((_, i) => {
    const a = Q[Math.max(0, i - 1)], b = Q[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return [-dy / L, dx / L];
  });
  const off = (i: number, s: number): Vec2 => [Q[i][0] + N[i][0] * rs * s, Q[i][1] + N[i][1] * rs * s];
  // the front (lower) half of the cut circle at the hole, from one side of the rod to the other
  const p = pts[0];
  const ring = Array.from({ length: 24 }, (_, k): Vec2 => P(p[0] + Math.cos((k / 24) * Math.PI * 2) * r, p[1] + Math.sin((k / 24) * Math.PI * 2) * r, p[2]));
  const near = (q: Vec2) => ring.reduce((b, x, k) => (Math.hypot(x[0] - q[0], x[1] - q[1]) < Math.hypot(ring[b][0] - q[0], ring[b][1] - q[1]) ? k : b), 0);
  const i0 = near(off(0, -1)), i1 = near(off(0, 1)), low = ring.reduce((b, x, k) => (x[1] > ring[b][1] ? k : b), 0);
  const walk = (dir: number) => { const out: Vec2[] = []; for (let k = i0; ; k = (k + dir + 24) % 24) { out.push(ring[k]); if (k === i1) break; } return out; };
  const w1 = walk(1), cap = w1.includes(ring[low]) ? w1 : walk(-1);
  const left = Q.map((_, i) => off(i, 1)), right = Q.map((_, i) => off(n - 1 - i, -1));
  const edge = [...right, ...cap, ...left];
  // light from the upper left of the screen
  const Lx = -0.6, Ly = -0.8, bands = [[-1, -0.5], [-0.5, 0], [0, 0.5], [0.5, 1]];
  const buckets: string[][] = [[], [], [], []];
  for (let i = 0; i < n - 1; i++) for (const [s0, s1] of bands) {
    const nx = (N[i][0] + N[i + 1][0]) / 2, ny = (N[i][1] + N[i + 1][1]) / 2, m = (s0 + s1) / 2;
    const b = 0.5 + 0.5 * m * (nx * Lx + ny * Ly) * 1.6;
    buckets[Math.max(0, Math.min(3, Math.floor(b * 4)))].push(poly([off(i, s0), off(i + 1, s0), off(i + 1, s1), off(i, s1)]));
  }
  return { fill: poly(edge), shades: buckets.map((b) => b.join("")), edge: open(edge) };
}

/** A tube half in the DOM, with the same parts and classes as a core solid. */
function tubeSolid(parent: Element) {
  const g = mk("g", { class: "k-solid" }, parent);
  const fill = mk("path", { class: "k-fill" }, g);
  const sh = [0, 1, 2, 3].map((i) => mk("path", { class: "k-shade", "data-s": i }, g));
  const edge = mk("path", { class: "k-edge" }, g);
  return { g, put(t: ReturnType<typeof tube>) { fill.setAttribute("d", t.fill); sh.forEach((p, i) => p.setAttribute("d", t.shades[i])); edge.setAttribute("d", t.edge); } };
}

export const combo = define<ComboOptions>({
  id: "combo",
  label: "Combination",
  vw: VW,
  vh: VH,
  width: 200,
  keys: ["length", "value", "defaultValue", "onValueChange", "onComplete", "code", "unlocked", "controlled"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(AZ, EL);
    let P = proj(C);
    const g = mk("g", {}, svg);
    const clipId = "knurl-combo-" + ++uid;
    const V = toViewer(C);

    const N_ = () => Math.max(3, Math.min(8, Math.round(typeof opts.length === "number" && Number.isFinite(opts.length) ? opts.length : 4)));
    const clean = (s: unknown, n: number) => String(s ?? "").replace(/\D/g, "").slice(0, n);
    let n = N_();
    let value = clean(opts.value ?? opts.defaultValue, n);

    const input = nativeInput(ctx, { type: "text", inputmode: "numeric", autocomplete: "one-time-code", pattern: "[0-9]*", spellcheck: "false" });
    host.setAttribute("data-knurl-hit", "");

    // geometry, set by build
    const R = 6, WW = 6.2, GAP = 1.1, FL = 0.9, BD = 8.6, BH = 25, ZC = 11.5, WIN = 0.72 * R, ROD = 1.9;
    let BX = 0, SX = 0, SA = 0, X0 = 0;
    type Wheel = { x0: number; x1: number; fl0: Solid; band: Solid; fl1: Solid; ribs: SVGPathElement; seps: SVGPathElement; digits: SVGTextElement[]; sp: Spring; last: number; set: boolean };
    let wheels: Wheel[] = [];
    let shortLeg: ReturnType<typeof tubeSolid>, longLeg: ReturnType<typeof tubeSolid>;

    // a point on the front face's plane under the pointer
    const onFront = (sx: number, sy: number): Vec2 => {
      const a = rad(AZ), c = Math.cos(a), s = Math.sin(a), k = Math.sin(rad(EL)), zf = Math.cos(rad(EL));
      const x = ((sx - C.ox) / C.S + BD * s) / c;
      return [x, ((x * s + BD * c) * k - (sy - C.oy) / C.S) / zf];
    };
    const face = (pts: readonly Vec2[]) => poly(pts.map(([x, z]) => P(x, BD, z)));
    const ring2 = (x: number, z: number, r: number, k = 14) => face(Array.from({ length: k }, (_, i): Vec2 => [x + Math.cos((i / k) * Math.PI * 2) * r, z + Math.sin((i / k) * Math.PI * 2) * r]));

    function build() {
      g.replaceChildren();
      n = N_();
      const winW = n * (WW + GAP) + GAP;
      X0 = -winW / 2;
      BX = winW / 2 + 6.5;
      SX = Math.min(BX - 5.5, 10.5);
      SA = BH + 7; // where the legs turn into the bow
      // fit the drawing to the lock closed and open, so it never rescales as it moves
      const ext: Vec3[] = [[-BX, -BD, 0], [BX, BD, 0], [-BX, BD, 0], [BX, -BD, 0], [-BX, -BD, BH], [BX, BD, BH]];
      for (let k = 0; k <= 8; k++) {
        const t = (k / 8) * SWING, c = Math.cos(t), sn = Math.sin(t);
        for (let j = 0; j <= 8; j++) {
          const u = (j / 8) * Math.PI, dx = SX + SX * Math.cos(u);
          ext.push([-SX + dx * c, dx * sn, SA + LIFT + Math.sin(u) * SX + ROD]);
        }
      }
      fit(C, ext, VW / 2, VH / 2, VW - 20, VH - 16);
      P = proj(C);

      shadow(g, flat(P, rrect(-BX, -BD + 3, BX, BD + 3, 4), 0));
      // the body, its top plate's seam and lid
      const foot = rrect(-BX, -BD, BX, BD, 4);
      solid(g).put(slab(C, P, -BX, -BD, BX, BD, 4, 0, BH));
      line(g, "lo").setAttribute("d", loft(C, P, foot, BH - 4, BH - 4).crease + loft(C, P, foot, 2.2, 2.2).crease);
      line(g, "lo").setAttribute("d", flat(P, rrect(-BX + 1.6, -BD + 1.6, BX - 1.6, BD - 1.6, 2.6), BH));

      // the shackle's collars and holes on the top
      for (const x of [-SX, SX]) {
        solid(g).put(cyl(C, P, x, 0, ROD + 1.5, BH, BH + 0.7, 28));
        mk("path", { class: "k-slot", d: flat(P, rrect(x - ROD - 0.35, -ROD - 0.35, x + ROD + 0.35, ROD + 0.35, ROD + 0.35, 6), BH + 0.7) }, g);
      }

      // the front: the wheel window, its frame, the reading arrows, four rivets
      const z0 = ZC - WIN, z1 = ZC + WIN;
      mk("path", { class: "k-slot", d: face([[X0, z0], [-X0, z0], [-X0, z1], [X0, z1]]) }, g);
      const defs = mk("defs", {}, g);
      mk("path", { d: face([[X0 + 0.3, z0 + 0.3], [-X0 - 0.3, z0 + 0.3], [-X0 - 0.3, z1 - 0.3], [X0 + 0.3, z1 - 0.3]]) }, mk("clipPath", { id: clipId }, defs));
      const win = mk("g", { "clip-path": `url(#${clipId})` }, g);
      // the axle the wheels turn on, seen between them
      line(win, "edge").setAttribute("d", seg(P(X0, BD - R, ZC), P(-X0, BD - R, ZC)));
      wheels = Array.from({ length: n }, (_, i) => {
        const x0 = X0 + GAP + i * (WW + GAP), x1 = x0 + WW;
        const wg = mk("g", {}, win);
        const fl0 = solid(wg), band = solid(wg);
        const seps = line(wg, "lo");
        const digits = Array.from({ length: 10 }, (_, d) => {
          const t = mk("text", { class: "k-text hi", "text-anchor": "middle" }, wg) as SVGTextElement;
          t.textContent = String(d);
          t.style.fontSize = "4.6px";
          return t;
        });
        const fl1 = solid(wg);
        const ribs = line(wg, "lo");
        const d0 = Number(value[i] ?? 0);
        return { x0, x1, fl0, band, fl1, ribs, seps, digits, sp: spring(d0, { k: 260, c: 24, eps: 0.004 }), last: NaN, set: i < value.length };
      });
      // the frame round the window, and the accent arrows on the reading row
      line(g, "edge").setAttribute("d", face([[X0 - 0.9, z0 - 0.9], [-X0 + 0.9, z0 - 0.9], [-X0 + 0.9, z1 + 0.9], [X0 - 0.9, z1 + 0.9]]));
      line(g, "accent").setAttribute("d", face([[X0 - 3.6, ZC + 1.3], [X0 - 1.6, ZC], [X0 - 3.6, ZC - 1.3]]).replace(/Z$/, "") + face([[-X0 + 3.6, ZC + 1.3], [-X0 + 1.6, ZC], [-X0 + 3.6, ZC - 1.3]]).replace(/Z$/, ""));
      const rivets: string[] = [];
      for (const [x, z] of [[-BX + 2.6, BH - 7], [BX - 2.6, BH - 7], [-BX + 2.6, 4.6], [BX - 2.6, 4.6]]) rivets.push(ring2(x, z, 1.1));
      mk("path", { class: "k-face", d: rivets.join("") }, g);
      // the code-reset slot under the window, with its pin
      const rz = (2.2 + z0) / 2 - 0.6;
      mk("path", { class: "k-slot", d: face(rrect(-3.2, rz - 0.9, 3.2, rz + 0.9, 0.9, 4).map((q): Vec2 => [q.u, q.v])) }, g);
      mk("path", { class: "k-dot mid", d: ring2(-1.6, rz, 0.55, 10) }, g);

      const sg = mk("g", {}, g);
      shortLeg = tubeSolid(sg); longLeg = tubeSolid(sg);
      last = { lift: NaN, sw: NaN };
      sync();
      for (const w of wheels) drawWheel(w);
      drawShackle(lift.x, sw.x);
    }

    // one wheel at a reading: three short drums (a knurled flange each side of the digit band) turning on the x axis
    const Ry = rot("y", Math.PI / 2);
    const drum = (x0: number, x1: number, r: number, phase: number, k = 30): SolidPaths => {
      const ring: Vec2[] = Array.from({ length: k }, (_, i) => { const t = phase + (i / k) * Math.PI * 2; return [Math.cos(t) * r, Math.sin(t) * r]; });
      const p = prism3([(x0 + x1) / 2, BD - R, ZC], ring, (x1 - x0) / 2, Ry);
      const s = poly3(C, P, p.verts, p.faces);
      // the outline of the near end only, not the facets between
      s.crease = poly(p.verts.slice(k).map((v) => P(v[0], v[1], v[2])));
      return s;
    };
    // the point at angle t on a wheel (t = 0 faces front, positive is up) and the surface's way down there
    const at = (x: number, r: number, t: number): Vec3 => [x, BD - R + Math.cos(t) * r, ZC + Math.sin(t) * r];
    const STEP = (Math.PI * 2) / 10;

    function drawWheel(w: Wheel) {
      const D = w.sp.x;
      if (D === w.last) return;
      w.last = D;
      // the next digit sits below the reading row, so a rising value rolls the band up
      const phase = D * STEP;
      w.fl0.put(drum(w.x0, w.x0 + FL, R + 0.45, phase));
      w.band.put(drum(w.x0 + FL, w.x1 - FL, R, phase));
      w.fl1.put(drum(w.x1 - FL, w.x1, R + 0.45, phase));
      const seps: string[] = [];
      w.digits.forEach((t, d) => {
        const a = ((((d - D) % 10) + 15) % 10) - 5; // nearest turn, -5…5 digits from the reading row
        const th = -a * STEP;
        const nrm: Vec3 = [0, Math.cos(th), Math.sin(th)];
        if (Math.abs(th) > rad(80) || dot3(nrm, V) < 0.05) { t.setAttribute("display", "none"); return; }
        t.removeAttribute("display");
        t.setAttribute("transform", planeMatrix(P, at((w.x0 + w.x1) / 2, R, th), [1, 0, 0], [0, Math.sin(th), -Math.cos(th)]) + " translate(0 1.65)");
      });
      // the lines between digits across the band, and the knurl on the flanges
      for (let k = 0; k < 10; k++) {
        const th = phase - (k + 0.5) * STEP, tt = Math.atan2(Math.sin(th), Math.cos(th));
        if (Math.abs(tt) > rad(80)) continue;
        seps.push(seg(P(...at(w.x0 + FL + 0.2, R, tt)), P(...at(w.x1 - FL - 0.2, R, tt))));
      }
      w.seps.setAttribute("d", seps.join(""));
      const ribs: string[] = [];
      for (let k = 0; k < 30; k++) {
        const th = (k / 30) * Math.PI * 2 - phase, tt = Math.atan2(Math.sin(th), Math.cos(th));
        if (Math.abs(tt) > rad(78)) continue;
        for (const x of [w.x0, w.x1 - FL]) ribs.push(seg(P(...at(x + 0.15, R + 0.45, tt)), P(...at(x + FL - 0.15, R + 0.45, tt))));
      }
      w.ribs.setAttribute("d", ribs.join(""));
    }

    // the shackle: long leg on the left (the pivot), short leg on the right; up by `lift`, swung by `sw`
    let last = { lift: NaN, sw: NaN };
    function drawShackle(lift: number, sw: number) {
      if (lift === last.lift && sw === last.sw) return;
      last = { lift, sw };
      const c = Math.cos(sw), s = Math.sin(sw);
      const place = (x: number, z: number): Vec3 => { const dx = x + SX; return [-SX + dx * c, dx * s, z + lift]; };
      // each half runs from where its leg leaves the body (or the short leg's free end) up to the top of the bow
      const half = (side: 1 | -1, z0: number) => {
        const pts: Vec3[] = [];
        for (let k = 0; k <= 6; k++) pts.push(place(side * SX, z0 + ((SA - z0) * k) / 6));
        for (let k = 1; k <= 12; k++) { const t = (k / 24) * Math.PI; pts.push(place(side * SX * Math.cos(t), SA + Math.sin(t) * SX)); }
        return pts;
      };
      const ps = half(1, Math.max(BH + 0.7, BH - INS + lift) - lift), pl = half(-1, BH + 0.7 - lift);
      shortLeg.put(tube(P, C.S, ps, ROD));
      longLeg.put(tube(P, C.S, pl, ROD));
      // paint the nearer half last
      const d = (q: Vec3[]) => depth(C, q[6][0], q[6][1], q[6][2]);
      const want = d(ps) > d(pl) ? shortLeg.g : longLeg.g;
      if (want.parentNode!.lastChild !== want) want.parentNode!.appendChild(want);
    }

    // motion: the shackle springs up first, then swings; closing, it swings home, then drops
    const lift = spring(0, { k: 320, c: 15, eps: 0.01 }), sw = spring(0, { k: 120, c: 17, eps: 0.002 });
    let opened = false;
    const B = register(host, (dt) => {
      let m = false;
      for (const w of wheels) { if (stepS(w.sp, dt)) m = true; drawWheel(w); }
      lift.t = opened || Math.abs(sw.x) > rad(4) ? LIFT : 0;
      sw.t = opened && lift.x > INS + 1 ? SWING : 0;
      const a = stepS(lift, dt), b = stepS(sw, dt);
      if (shortLeg) drawShackle(lift.x, sw.x);
      return m || a || b || lift.t !== lift.x || sw.t !== sw.x;
    });
    bag.add(B.unregister);

    let done = "";
    const complete = (v: string) => { if (v.length < n || v === done) return; done = v; emit(opts.onComplete, v); };
    const isOpen = () => !!opts.unlocked || (typeof opts.code === "string" && opts.code !== "" && value === clean(opts.code, n));

    /** Writes the value out to the input, host and wheels; returns whether the lock has just opened. */
    function sync(): boolean {
      input.value = value;
      input.maxLength = n;
      input.disabled = !!opts.disabled;
      input.setAttribute("aria-label", opts.label ?? "Combination");
      if (opts.name) input.name = opts.name; else input.removeAttribute("name");
      const was = opened;
      opened = isOpen();
      host.setAttribute("data-state", opened ? "open" : "locked");
      wheels.forEach((w, i) => {
        const d = Number(value[i] ?? 0);
        // roll the short way round to the new digit
        const cur = w.sp.t, k = Math.round(cur / 10) * 10 + d;
        const opts10 = [k - 10, k, k + 10];
        w.sp.t = opts10.reduce((b, x) => (Math.abs(x - cur) < Math.abs(b - cur) ? x : b));
        const set = i < value.length;
        if (set !== w.set) { w.set = set; w.digits.forEach((t) => t.setAttribute("class", set ? "k-text hi" : "k-text")); }
      });
      if (value.length < n) done = "";
      B?.wake();
      return opened && !was;
    }

    const ask = (next: string, typed: boolean) => {
      next = clean(next, n);
      if (next === value) { input.value = value; return; }
      if (opts.controlled) { input.value = value; emit(opts.onValueChange, next); if (typed) complete(next); return; }
      value = next;
      const justOpened = sync();
      emit(opts.onValueChange, next);
      if (typed || justOpened) complete(next);
    };
    // sets wheel i to digit d, filling any unset wheels before it with 0
    const roll = (i: number, by: number) => {
      const digits = value.padEnd(i + 1, "0").split("");
      digits[i] = String((Number(digits[i]) + by + 10) % 10);
      ask(digits.join(""), false);
    };

    bag.on(input, "input", () => { const caret = input.selectionStart; ask(input.value, true); if (caret !== null && ctx.doc.activeElement === input) input.setSelectionRange(Math.min(caret, input.value.length), Math.min(caret, input.value.length)); });
    // ArrowUp/Down roll the wheel at the caret (the next one to set), or the last wheel once all are set.
    // The rolled digit is left selected, so typing overwrites it and Backspace clears it.
    const pick = (i: number) => { if (ctx.doc.activeElement === input) input.setSelectionRange(i, Math.min(i + 1, input.value.length)); };
    bag.on(input, "keydown", (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const i = Math.min(n - 1, input.selectionStart ?? n - 1);
      roll(i, e.key === "ArrowUp" ? 1 : -1);
      pick(i);
    });

    // pointer: a vertical drag or the wheel over a wheel rolls that digit
    const wheelAt = (e: PointerEvent | WheelEvent) => {
      const r = svg.getBoundingClientRect();
      const [x, z] = onFront(((e.clientX - r.left) / (r.width || 1)) * VW, ((e.clientY - r.top) / (r.height || 1)) * VH);
      if (z < ZC - R - 1.5 || z > ZC + R + 1.5) return -1;
      return wheels.findIndex((w) => x >= w.x0 - GAP / 2 && x <= w.x1 + GAP / 2);
    };
    let drag: { y: number; i: number; acc: number } | null = null;
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0) return;
      input.focus({ preventScroll: true });
      const i = wheelAt(e);
      if (i < 0) return;
      drag = { y: e.clientY, i, acc: 0 };
      host.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    bag.on(host, "pointermove", (e) => {
      if (!drag) return;
      const r = svg.getBoundingClientRect(), px = (STEP * R * C.S * r.width) / VW; // a digit's height on screen
      const steps = Math.trunc((drag.y - e.clientY) / Math.max(6, px)) - drag.acc;
      if (steps) { drag.acc += steps; roll(drag.i, steps); pick(drag.i); }
    });
    const end = () => { drag = null; };
    bag.on(host, "pointerup", end);
    bag.on(host, "pointercancel", end);
    bag.on(host, "wheel", (e) => {
      if (opts.disabled) return;
      const i = wheelAt(e);
      if (i < 0) return;
      e.preventDefault();
      roll(i, e.deltaY < 0 ? 1 : -1);
      pick(i);
    }, { passive: false });

    build();
    // a lock that mounts open starts open, without the swing
    if (opened) { lift.x = lift.t = LIFT; sw.x = sw.t = SWING; drawShackle(lift.x, sw.x); }
    bag.add(() => { input.remove(); host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state"); svg.replaceChildren(); });
    return {
      update(next, prev) {
        opts = next;
        const m = N_();
        if (next.value !== undefined) value = clean(next.value, m);
        else if (m !== n) value = clean(value, m);
        if (m !== n || next.length !== prev.length) build(); else if (sync()) complete(value);
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
