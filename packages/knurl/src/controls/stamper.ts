import { camera, circle, cyl, dot3, fit, flat, loft, planeMatrix, poly, poly3, prism3, proj, rad, rrect, seg, slab, toViewer, type Rot, type Vec2, type Vec3 } from "../core/iso";
import { reducedMotion, spring, stepS, type Spring } from "../core/motion";
import { define, emit, nativeInput, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, type Solid } from "../core/stage";

/**
 * Stamper — a date input, built as a self-inking date stamp on a sheet of
 * paper.
 *
 * Two side plates on feet carry a bridge and an ink-pad cartridge. Inside,
 * three rubber bands (day, month, year) run over knurled drive wheels on one
 * axle; the band faces turned up against the pad carry the date, and the
 * date also reads on the bands' front runs. A yoke over the bridge, on two
 * guide posts with return springs, holds the axle's ends in cam slots.
 *
 * Pressing the knob drives the yoke down with weight: the bands swing over
 * from the pad to the paper, print, and the springs throw it back up with a
 * small overshoot. The date is left on the paper in ink. Changing the date
 * rolls each band to its new legend. Clicking a band rolls it on by one,
 * the wheel over a band rolls it, and a click anywhere else stamps.
 *
 * Semantics come from a visually hidden `<input type="date">`, so the
 * keyboard, the date picker, screen readers and forms are the platform's own.
 */

export type StamperOptions = BaseOptions & {
  /** The date, "YYYY-MM-DD". */
  value?: string;
  /** The starting date when uncontrolled. Default today. */
  defaultValue?: string;
  /** The earliest date, "YYYY-MM-DD". */
  min?: string;
  /** The latest date, "YYYY-MM-DD". */
  max?: string;
  /** Called with the new date on every change, by band, wheel or keyboard. */
  onValueChange?: (value: string) => void;
  /** Called with the date each time it is stamped. */
  onStamp?: (value: string) => void;
  /** Set by the React wrapper when `value` is controlled. */
  controlled?: boolean;
};

const VW = 240, VH = 240;
const AZ = 30, EL = 26;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const FS = 4.2, PITCH = 4.4;
const PZ = 0.4, RB = 3.2, RF = 4.3, LB = 10, RC = 1.2, FL = 1, GAPB = 0.5; // paper top; band and flange radius; axle to print face; band corner; flange width; gap
const ZR = 17.2, ZP = LB + PZ, S = ZR - ZP; // the axle at rest and at the print; the stroke
let uid = 0;

type Ymd = { y: number; m: number; d: number };
const pad2 = (n: number) => String(n).padStart(2, "0");
const fmt = (v: Ymd) => `${String(v.y).padStart(4, "0")}-${pad2(v.m)}-${pad2(v.d)}`;
const dim = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function parse(s: unknown): Ymd | null {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ""));
  if (!r) return null;
  const y = +r[1], m = +r[2], d = +r[3];
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= dim(y, m) ? { y, m, d } : null;
}
const today = (): Ymd => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }; };
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const stamper = define<StamperOptions>({
  id: "stamper",
  label: "Date",
  vw: VW,
  vh: VH,
  width: 200,
  keys: ["value", "defaultValue", "min", "max", "onValueChange", "onStamp", "controlled"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(AZ, EL);
    const V = toViewer(C);
    const id = "knurl-stamp-" + ++uid;
    const g = mk("g", {}, svg);

    const input = nativeInput(ctx, { type: "date" });
    host.setAttribute("data-knurl-hit", "");

    const clamp = (v: Ymd): Ymd => {
      const lo = parse(opts.min), hi = parse(opts.max), s = fmt(v);
      if (lo && s < fmt(lo)) return lo;
      if (hi && s > fmt(hi)) return hi;
      return v;
    };
    let value = clamp(parse(opts.value) ?? parse(opts.defaultValue) ?? today());

    // the bands, left to right: day, month, year
    type Band = {
      kind: "d" | "m" | "y"; x0: number; x1: number; w: number;
      fl0: Solid; loop: Solid; fl1: Solid; ribs: SVGPathElement; run: SVGGElement; seps: SVGPathElement; texts: SVGTextElement[];
      sp: Spring; idx: number; ink: SVGTextElement;
    };
    const legend = (b: Band, i: number) => b.kind === "d" ? pad2((((i - 1) % 31) + 31) % 31 + 1) : b.kind === "m" ? MONTHS[((i % 12) + 12) % 12] : String(i);
    const indexOf = (b: Band, v: Ymd) => b.kind === "d" ? v.d : b.kind === "m" ? v.m - 1 : v.y;
    const chars = { d: 2, m: 3, y: 4 } as const;
    const widths = (["d", "m", "y"] as const).map((k) => chars[k] * FS * 0.6 + 2.2);
    const CX = (widths.reduce((a, b) => a + b, 0) + 6 * FL + 2 * GAPB) / 2;
    const PX0 = CX + 0.6, PX1 = PX0 + 1.6; // the side plates' inner and outer faces
    const AX0 = PX1 + 0.4, AX1 = AX0 + 1.8; // the yoke's arms
    const PY = 4.2, BZ0 = 30.4, BZ1 = BZ0 + 3, HZ0 = BZ1 + S + 1.6, HZ1 = HZ0 + 3; // plates' half-depth, bridge, yoke head at rest
    const PADZ = ZR + LB + 0.1;

    const ext: Vec3[] = [[-34, -18, 0], [34, 24, 0], [-34, 24, 0], [34, -18, 0], [0, 0, HZ1 + 9], [AX1 + 1, 0, HZ1], [-AX1 - 1, 0, HZ1]];
    fit(C, ext, VW / 2, VH / 2 + 1, VW - 16, VH - 14);
    const P = proj(C);

    // a cylinder (or any ring) along x, in the (y, z) plane about (y0, z0), turned by ψ
    const frame = (psi: number): Rot => [[0, Math.cos(psi), Math.sin(psi)], [0, -Math.sin(psi), Math.cos(psi)], [1, 0, 0]];
    const RXr: Rot = frame(0);
    const alongX = (x0: number, x1: number, y0: number, z0: number, ring: readonly Vec2[], R: Rot = RXr) => {
      const p = prism3([(x0 + x1) / 2, y0, z0], ring, (x1 - x0) / 2, R);
      const s = poly3(C, P, p.verts, p.faces);
      // the outline of the near (+x) end, not the facets between
      s.crease = poly(p.verts.slice(ring.length).map((v) => P(v[0], v[1], v[2])));
      return s;
    };
    const disc = (r: number, k = 28): Vec2[] => Array.from({ length: k }, (_, i) => [Math.cos((i / k) * Math.PI * 2) * r, Math.sin((i / k) * Math.PI * 2) * r]);
    // a band's loop in its own (y', z') plane: over the wheel at the axle, down two runs to the flat print face at z' = -LB
    const LOOP: Vec2[] = (() => {
      const out: Vec2[] = [];
      for (let k = 0; k <= 10; k++) { const t = (k / 10) * Math.PI; out.push([Math.cos(t) * RB, Math.sin(t) * RB]); }
      for (let k = 0; k <= 4; k++) { const t = Math.PI + (k / 4) * (Math.PI / 2); out.push([-RB + RC + Math.cos(t) * RC, -LB + RC + Math.sin(t) * RC]); }
      for (let k = 0; k <= 4; k++) { const t = 1.5 * Math.PI + (k / 4) * (Math.PI / 2); out.push([RB - RC + Math.cos(t) * RC, -LB + RC + Math.sin(t) * RC]); }
      return out;
    })();
    const onYZ = (y: number, z: number): Vec3 => [0, y, z];
    const fx = (x: number, y: number, z: number): string => { const q = P(x, y, z); return q[0].toFixed(2) + " " + q[1].toFixed(2); };
    const faceX = (x: number, pts: readonly Vec2[]) => "M" + pts.map(([y, z]) => fx(x, y, z)).join("L") + "Z";
    const faceY = (y: number, pts: readonly Vec2[]) => "M" + pts.map(([x, z]) => fx(x, y, z)).join("L") + "Z";
    void onYZ;

    // the paper, with a few ruled lines and the impression on it
    shadow(g, flat(P, rrect(-30, -14, 30, 22, 1), 0));
    solid(g).put(slab(C, P, -30, -14, 30, 22, 0.6, 0, PZ));
    const rules: string[] = [];
    for (const y of [-9, 12, 16]) rules.push(seg(P(-26, y, PZ), P(26, y, PZ)));
    line(g, "lo").setAttribute("d", rules.join(""));
    const inkG = mk("g", {}, g);

    // the left foot, the left arm (behind the left plate), the left plate
    // each foot reaches back and out from its plate, clear of the print
    const foot = (x0: number, x1: number) => { solid(g).put(slab(C, P, x0, -9, x1, 2.4, 1, PZ, PZ + 2)); };
    foot(-PX1 - 2.6, -PX0 + 0.4);
    const armL = solid(g);
    solid(g).put(slab(C, P, -PX1, -PY, -PX0, PY, 0.5, PZ + 2, BZ0));

    // the bands
    const bandG = mk("g", {}, g);
    const defs = mk("defs", {}, g);
    let x = -CX;
    const bands: Band[] = (["d", "m", "y"] as const).map((kind, i) => {
      const w = widths[i], x0 = x + FL, x1 = x0 + w;
      x = x1 + FL + GAPB;
      const bg = mk("g", {}, bandG);
      const fl0 = solid(bg), loop = solid(bg);
      const run = mk("g", {}, bg);
      const clip = mk("clipPath", { id: id + kind }, defs);
      mk("rect", { x: -w / 2 + 0.4, y: -(LB - RC) / 2, width: w - 0.8, height: LB - RC }, clip);
      const inner = mk("g", { "clip-path": `url(#${id + kind})` }, run);
      const seps = mk("path", { class: "k-line lo" }, inner);
      const texts = [-2, -1, 0, 1, 2].map(() => {
        const t = mk("text", { class: "k-text hi", "text-anchor": "middle" }, inner) as SVGTextElement;
        t.style.fontSize = FS + "px";
        return t;
      });
      const fl1 = solid(bg);
      const ribs = line(bg, "lo");
      const ink = mk("text", { class: "k-led on", "text-anchor": "middle" }, inkG) as SVGTextElement;
      ink.style.fontSize = FS * 1.05 + "px"; ink.style.stroke = "none"; ink.style.fontWeight = "700";
      ink.style.fontFamily = 'ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace'; ink.style.letterSpacing = ".04em";
      const b: Band = { kind, x0, x1, w, fl0, loop, fl1, ribs, run, seps, texts, sp: spring(0, { k: 300, c: 16, eps: 0.004 }), idx: 0, ink };
      b.idx = indexOf(b, value); b.sp.x = b.sp.t = b.idx;
      return b;
    });

    // the pad cartridge: its felt along the bottom and the pull tab
    solid(g).put(slab(C, P, -CX, -4, CX, 4, 0.6, PADZ, BZ0));
    mk("path", { class: "k-slot", d: faceY(4, [[-CX + 0.6, PADZ], [CX - 0.6, PADZ], [CX - 0.6, PADZ + 0.8], [-CX + 0.6, PADZ + 0.8]]) }, g);
    solid(g).put(slab(C, P, -3.6, 4, 3.6, 6.6, 0.8, PADZ + 1.2, PADZ + 2.2));
    line(g, "lo").setAttribute("d", flat(P, rrect(-1.6, 4.8, 1.6, 6, 0.6), PADZ + 2.2));

    // the right foot and plate, its cam slot and two screws; then the right axle pin and arm, which move
    foot(PX0 - 0.4, PX1 + 2.6);
    solid(g).put(slab(C, P, PX0, -PY, PX1, PY, 0.5, PZ + 2, BZ0));
    mk("path", { class: "k-slot", d: faceX(PX1, [[-1.9, ZP - 2], [1.9, ZP - 2], [1.9, ZR + 2], [-1.9, ZR + 2]]) }, g);
    const scr: string[] = [];
    for (const [y, z] of [[-2.6, PZ + 4.6], [2.6, PZ + 4.6], [-2.6, BZ0 - 3], [2.6, BZ0 - 3]]) {
      mk("path", { class: "k-face", d: faceX(PX1, Array.from({ length: 14 }, (_, k): Vec2 => [y + Math.cos((k / 14) * Math.PI * 2) * 1, z + Math.sin((k / 14) * Math.PI * 2) * 1])) }, g);
      scr.push(seg(P(PX1, y - 0.7, z - 0.3), P(PX1, y + 0.7, z + 0.3)));
    }
    line(g, "edge").setAttribute("d", scr.join(""));
    const pinR = solid(g), pinSlot = line(g, "edge");
    const armR = solid(g);

    // the bridge on its screws, the guide posts and their springs, the yoke head, the knob
    solid(g).put(slab(C, P, -PX1, -PY, PX1, PY, 0.8, BZ0, BZ1));
    line(g, "lo").setAttribute("d", flat(P, rrect(-PX1 + 1.2, -PY + 1.2, PX1 - 1.2, PY - 1.2, 0.6), BZ1));
    const bs: string[] = [];
    for (const sx of [-1, 1]) {
      const xs = sx * (PX1 - 1.8);
      solid(g).put(cyl(C, P, xs, 0, 1.1, BZ1, BZ1 + 0.4, 14));
      bs.push(seg(P(xs - 0.8, 0.3, BZ1 + 0.4), P(xs + 0.8, -0.3, BZ1 + 0.4)));
    }
    line(g, "edge").setAttribute("d", bs.join(""));
    const GX = 12, POST = HZ1 + 2.6;
    const springs = [line(g, "edge"), line(g, "edge")];
    for (const sx of [-1, 1]) solid(g).put(cyl(C, P, sx * GX, 0, 0.9, BZ1, POST, 16));
    const head = solid(g);
    const headSeam = line(g, "lo");
    const caps = [solid(g), solid(g)];
    const neck = solid(g), knob = solid(g), knobCap = solid(g);
    const knobTop = line(g, "lo");

    // motion: the stroke p (0 up, 1 printing), each band's roll; ψ turns the bands from the pad (π) to the paper (0)
    const stroke = spring(0, { k: 520, c: 22, eps: 0.002 });
    let pressed = false, holding = false, inked = false, hoverBand = -1, hoverHandle = false;
    let drag: { i: number; y: number; acc: number; moved: boolean; frac: number } | null = null;
    let drawn = { p: NaN, rolls: "" };
    const HOVER = 0.12, THUMB = 0.32;

    function drawBands(p: number) {
      const zA = ZR - S * p, psi = Math.PI * (1 - smooth(0.12, 0.88, p)), R = frame(psi);
      const e1: Vec3 = R[0], e2: Vec3 = R[1];
      const L = (yl: number, zl: number): Vec3 => [0, e1[1] * yl + e2[1] * zl, zA + e1[2] * yl + e2[2] * zl];
      for (const b of bands) {
        b.fl0.put(alongX(b.x0 - FL, b.x0, 0, zA, disc(RF), R));
        b.loop.put(alongX(b.x0, b.x1, 0, zA, LOOP, R));
        b.fl1.put(alongX(b.x1, b.x1 + FL, 0, zA, disc(RF), R));
        // the run that faces the viewer at rest (y' = -RB), with its legends
        const nrm: Vec3 = [0, -e1[1], -e1[2]];
        const seen = dot3(nrm, V) > 0.05;
        b.run.setAttribute("display", seen ? "inline" : "none");
        const cx = (b.x0 + b.x1) / 2, zr = -(LB - RC) / 2;
        if (seen) {
          const o = L(-RB - 0.02, zr);
          b.run.setAttribute("transform", planeMatrix(P, [cx, o[1], o[2]], [1, 0, 0], e2));
          const base = Math.round(b.sp.x), f = b.sp.x - base, sep: string[] = [];
          b.texts.forEach((t, k) => {
            const Y = (k - 2 - f) * PITCH;
            const s = legend(b, base + k - 2);
            if (t.textContent !== s) t.textContent = s;
            t.setAttribute("y", (Y + FS * 0.36).toFixed(2));
            sep.push(`M${-b.w / 2} ${(Y + PITCH / 2).toFixed(2)}L${b.w / 2} ${(Y + PITCH / 2).toFixed(2)}`);
          });
          b.seps.setAttribute("d", sep.join(""));
        }
        // the knurl on the drive wheels' flanges turns with the band
        const roll = (b.sp.x * PITCH) / RB, ribs: string[] = [];
        for (let k = 0; k < 26; k++) {
          const t = roll + (k / 26) * Math.PI * 2, ny = Math.cos(t), nz = Math.sin(t);
          const wn: Vec3 = [0, e1[1] * ny + e2[1] * nz, e1[2] * ny + e2[2] * nz];
          if (dot3(wn, V) < 0.2) continue;
          const q = L(ny * RF, nz * RF);
          for (const x0 of [b.x0 - FL, b.x1]) ribs.push(seg(P(x0 + 0.15, q[1], q[2]), P(x0 + FL - 0.15, q[1], q[2])));
        }
        b.ribs.setAttribute("d", ribs.join(""));
      }
    }

    function drawYoke(p: number) {
      const zA = ZR - S * p, dz = -S * p;
      const h0 = HZ0 + dz, h1 = HZ1 + dz;
      armL.put(slab(C, P, -AX1, -2.6, -AX0, 2.6, 0.6, zA - 2.6, h0));
      armR.put(slab(C, P, AX0, -2.6, AX1, 2.6, 0.6, zA - 2.6, h0));
      pinR.put(alongX(AX1, AX1 + 1, 0, zA, disc(1.7, 18)));
      pinSlot.setAttribute("d", seg(P(AX1 + 1, -1.2, zA - 0.4), P(AX1 + 1, 1.2, zA + 0.4)));
      head.put(slab(C, P, -AX1 - 0.6, -3.4, AX1 + 0.6, 3.4, 1, h0, h1));
      headSeam.setAttribute("d", flat(P, rrect(-AX1 + 0.6, -2.2, AX1 - 0.6, 2.2, 0.6), h1));
      // the guide posts pass through the head; the springs between bridge and head close up as it comes down
      for (const [k, sx] of [[0, -1], [1, 1]] as const) {
        caps[k].put(cyl(C, P, sx * GX, 0, 1.5, h1, h1 + 0.5, 16));
        const pts: string[] = [], turns = 7, n = turns * 16;
        for (let i = 0; i <= n; i++) {
          const t = (i / 16) * Math.PI * 2, z = BZ1 + ((h0 - BZ1) * i) / n;
          pts.push(fx(sx * GX + Math.cos(t) * 1.9, Math.sin(t) * 1.9, z));
        }
        springs[k].setAttribute("d", "M" + pts.join("L"));
      }
      neck.put(cyl(C, P, 0, 0, 2.2, h1, h1 + 2.4, 24));
      knob.put(loft(C, P, circle(0, 0, 4.4, 40), h1 + 2.4, h1 + 6.8, circle(0, 0, 7, 40)));
      knobCap.put(loft(C, P, circle(0, 0, 7, 40), h1 + 6.8, h1 + 8.4, circle(0, 0, 6, 40)));
      knobTop.setAttribute("d", flat(P, circle(0, 0, 4.4, 36), h1 + 8.4));
    }

    function drawInk(v: Ymd | null) {
      for (const b of bands) {
        b.ink.textContent = v ? legend(b, indexOf(b, v)) : "";
        b.ink.setAttribute("transform", planeMatrix(P, [(b.x0 + b.x1) / 2, 0, PZ], [1, 0, 0], [0, 1, 0]) + ` translate(0 ${(FS * 0.36).toFixed(2)})`);
      }
    }

    function paint() {
      const rolls = bands.map((b) => b.sp.x).join();
      if (stroke.x === drawn.p && rolls === drawn.rolls) return;
      if (stroke.x !== drawn.p) drawYoke(stroke.x);
      drawn = { p: stroke.x, rolls };
      drawBands(stroke.x);
    }

    const B = register(host, (dt) => {
      // a press goes all the way to the paper before the springs may take it back
      if (holding && stroke.x >= 0.97) holding = false;
      const down = pressed || holding;
      stroke.k = down ? 520 : 260; stroke.c = down ? 22 : 14;
      stroke.t = down ? 1 : hoverHandle ? 0.04 : 0;
      let m = stepS(stroke, dt);
      // the paper stops it: it lands and gives back a little of the blow
      if (stroke.x > 1) { stroke.x = 1; stroke.v = -Math.abs(stroke.v) * 0.2; m = true; }
      if (stroke.x >= 0.97 && !inked) { inked = true; drawInk(value); emit(opts.onStamp, fmt(value)); }
      if (stroke.x < 0.5) inked = false;
      bands.forEach((b, i) => {
        let off = i === hoverBand && !drag && !down ? HOVER : 0;
        if (drag && drag.i === i) off = (drag.moved ? 0 : THUMB) + Math.max(-1, Math.min(1, drag.frac)) * 0.42;
        b.sp.t = b.idx + off;
        if (stepS(b.sp, dt)) m = true;
      });
      paint();
      return m || down;
    });
    bag.add(B.unregister);

    function sync() {
      input.value = fmt(value);
      if (opts.min && parse(opts.min)) input.min = opts.min; else input.removeAttribute("min");
      if (opts.max && parse(opts.max)) input.max = opts.max; else input.removeAttribute("max");
      input.disabled = !!opts.disabled;
      input.setAttribute("aria-label", opts.label ?? "Date");
      if (opts.name) input.name = opts.name; else input.removeAttribute("name");
      host.setAttribute("data-state", fmt(value));
      // each band rolls the short way to its legend (the year straight there)
      for (const b of bands) {
        const want = indexOf(b, value), n = b.kind === "d" ? 31 : b.kind === "m" ? 12 : 0;
        if (!n) { b.idx = want; continue; }
        const k = Math.round((b.idx - want) / n);
        b.idx = [k - 1, k, k + 1].map((j) => want + j * n).reduce((a, c) => (Math.abs(c - b.idx) < Math.abs(a - b.idx) ? c : a));
      }
      if (reducedMotion()) for (const b of bands) { b.sp.x = b.sp.t = b.idx; b.sp.v = 0; }
      B?.wake();
    }

    const ask = (next: Ymd) => {
      next = clamp(next);
      if (fmt(next) === fmt(value)) { input.value = fmt(value); return; }
      if (opts.controlled) { input.value = fmt(value); emit(opts.onValueChange, fmt(next)); return; }
      value = next; sync(); emit(opts.onValueChange, fmt(next));
    };
    /** Rolls one band by `by`, the others staying where they are; the day is kept inside its month. */
    const roll = (kind: Band["kind"], by: number) => {
      let { y, m, d } = value;
      if (kind === "d") d = ((((d - 1 + by) % dim(y, m)) + dim(y, m)) % dim(y, m)) + 1;
      else if (kind === "m") { m = ((((m - 1 + by) % 12) + 12) % 12) + 1; d = Math.min(d, dim(y, m)); }
      else { y = Math.max(1, Math.min(9999, y + by)); d = Math.min(d, dim(y, m)); }
      ask({ y, m, d });
    };
    const onInput = () => { const v = parse(input.value); if (v) ask(v); else input.value = fmt(value); };
    bag.on(input, "input", onInput);
    bag.on(input, "change", onInput);

    // pointer: a band (on its front run or its wheel) rolls; anywhere else presses the stamp
    const bandAt = (e: { clientX: number; clientY: number }) => {
      if (stroke.x > 0.15) return -1;
      const r = svg.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / (r.width || 1)) * VW, sy = ((e.clientY - r.top) / (r.height || 1)) * VH;
      const a = rad(AZ), c = Math.cos(a), s = Math.sin(a), k = Math.sin(rad(EL)), zf = Math.cos(rad(EL));
      const y = RB, xw = ((sx - C.ox) / C.S + y * s) / c, z = ((xw * s + y * c) * k - (sy - C.oy) / C.S) / zf;
      if (z < ZR - RF - 0.6 || z > ZR + LB + 0.4) return -1;
      return bands.findIndex((b) => xw >= b.x0 - FL - GAPB / 2 && xw <= b.x1 + FL + GAPB / 2);
    };
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0) return;
      input.focus({ preventScroll: true });
      host.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      const i = bandAt(e);
      if (i >= 0) drag = { i, y: e.clientY, acc: 0, moved: false, frac: 0 };
      else { pressed = true; holding = true; }
      B.wake();
    });
    bag.on(host, "pointermove", (e) => {
      if (drag) {
        const r = svg.getBoundingClientRect(), px = Math.max(6, (PITCH * C.S * r.width) / VW);
        const dist = (drag.y - e.clientY) / px, steps = Math.trunc(dist) - drag.acc;
        drag.frac = dist - Math.trunc(dist);
        if (Math.abs(dist) > 0.2) drag.moved = true;
        if (steps) { drag.acc += steps; roll(bands[drag.i].kind, steps); }
        B.wake();
        return;
      }
      if (e.pointerType !== "mouse" || opts.disabled || pressed) return;
      const i = bandAt(e), h = i < 0;
      if (i !== hoverBand || h !== hoverHandle) { hoverBand = i; hoverHandle = h; B.wake(); }
    });
    const end = (commit: boolean) => {
      if (drag && commit && !drag.moved && !opts.disabled) roll(bands[drag.i].kind, 1);
      drag = null; pressed = false; B.wake();
    };
    bag.on(host, "pointerup", () => end(true));
    bag.on(host, "pointercancel", () => { holding = false; end(false); });
    bag.on(host, "pointerleave", () => { if (hoverBand >= 0 || hoverHandle) { hoverBand = -1; hoverHandle = false; B.wake(); } });
    bag.on(host, "wheel", (e) => {
      if (opts.disabled) return;
      const i = bandAt(e);
      if (i < 0) return;
      e.preventDefault();
      roll(bands[i].kind, e.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    sync();
    drawInk(value);
    paint();
    bag.add(() => { input.remove(); host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state"); svg.replaceChildren(); });
    return {
      update(next) {
        opts = next;
        const v = next.value !== undefined ? parse(next.value) : null;
        value = clamp(v ?? value);
        sync();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
