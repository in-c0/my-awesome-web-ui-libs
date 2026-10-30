import { add3, bar, camera, clamp, cross3, dot3, fit, lerp, open, poly, proj, rad, scale3, seg, SHADES, toViewer, turn, type Rot, type SolidPaths, type Vec2, type Vec3 } from "../core/iso";
import { reducedMotion, spring, stepS } from "../core/motion";
import { define, keepAttrs, num, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, type Solid } from "../core/stage";

/**
 * Hourglass — progress, built as a sand glass in a turned frame.
 *
 * Two turned end caps on three spindles hold a glass of two bulbs; each
 * bulb's dome sits in a turned cup on its cap. Sand streams through the neck, the top
 * charge sinks with a little crater over the neck and the pile below grows
 * as a cone. Determinate, the sand is split by progress and moves to a new
 * value smoothly. Indeterminate, it runs on its own: when the top empties
 * the whole glass is lifted and turned end over end, slow to start, with a
 * small overshoot as it comes down, and the sand slides to the other end as
 * it passes level. Under reduced motion the sand holds still and the glass
 * is not turned; it still shows the value.
 *
 * The host is role="progressbar": aria-valuenow when determinate,
 * aria-busy while indeterminate. It has no pointer behaviour of its own.
 */

export type HourglassOptions = BaseOptions & {
  /** Progress from 0 to `max`. Leave it out for an indeterminate glass that runs and turns by itself. */
  value?: number;
  /** The value that means done. Default 100 (pass 1 for a 0–1 fraction). */
  max?: number;
  /** Whether sand runs. Default true; false holds the sand where it is. */
  running?: boolean;
};

const VW = 180, VH = 200;
const AZ = 30, EL = 22;
const HH = 30, BOSS = 0.9; // half-height to the caps' outer faces; the turned boss each cap stands on
const CAPR = 18, CAPT = 2.8, STEPR = 16.1, STEPT = 1.1; // the caps: disc radius and thickness, inner step
const HG = HH - CAPT - STEPT; // the glass's half-length, cap to cap
const NECK = 0.75, RB = 10.4, DM = 13.2; // glass: neck radius, bulb radius, where the bulb is widest
const CUPR = 8.2, CUPH = 1.7; // the cups the domes sit in
const GT = 0.5; // glass wall
const RP = 14.4; // spindles' radius from the axis
const RUN = 4.2, TURN = 0.62; // seconds for the top to empty; seconds for the turn's push
const N = 64;

/** The glass's outer radius at distance d from the neck. */
function rGlass(d: number) {
  d = Math.abs(d);
  if (d <= DM) { const s = Math.sin((d / DM) * (Math.PI / 2)); return NECK + (RB - NECK) * s * s; }
  const u = Math.min(1, (d - DM) / (HG - DM));
  return Math.max(0.3, RB * Math.sqrt(Math.max(0, 1 - u * u)));
}
const rIn = (d: number) => Math.max(0.05, rGlass(d) - GT);

// the volume inside one bulb, from the neck out: V[k] up to d = k·HG/N
const VOL: number[] = [0];
for (let k = 1; k <= 200; k++) {
  const d0 = ((k - 1) / 200) * HG, d1 = (k / 200) * HG, r = rIn((d0 + d1) / 2);
  VOL.push(VOL[k - 1] + Math.PI * r * r * (d1 - d0));
}
const VT = VOL[200];
const SAND = 0.5 * VT;
/** The distance from the neck at which the bulb holds `v` measured from the neck. */
function dAt(v: number) {
  v = clamp(v, 0, VT);
  let k = 1;
  while (k < 200 && VOL[k] < v) k++;
  const a = VOL[k - 1], b = VOL[k];
  return (((k - 1) + (b > a ? (v - a) / (b - a) : 0)) / 200) * HG;
}

/** Rotation by `a` about the unit axis `w` (Rodrigues), as three columns. */
function axisRot(w: Vec3, a: number): Rot {
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c, [x, y, z] = w;
  return [
    [t * x * x + c, t * x * y + s * z, t * x * z - s * y],
    [t * x * y - s * z, t * y * y + c, t * y * z + s * x],
    [t * x * z + s * y, t * y * z - s * x, t * z * z + c],
  ];
}

const smooth = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// a spindle, from one end to the middle: (distance from its end, radius); mirrored past the middle
const SPINDLE: [number, number][] = [[0, 2.15], [1.5, 2.15], [2.2, 1.3], [3.0, 1.85], [3.8, 1.2], [5.0, 1.12], [HG - 2.4, 0.92], [HG - 1.5, 1.55], [HG, 1.55]];

export const hourglass = define<HourglassOptions>({
  id: "hourglass",
  label: "Progress",
  vw: VW,
  vh: VH,
  width: 130,
  keys: ["value", "max", "running"],
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(AZ, EL);
    const az = rad(AZ);
    const W: Vec3 = [Math.sin(az), Math.cos(az), 0]; // the turn's axis: level, toward the viewer
    const LAT: Vec3 = [Math.cos(az), -Math.sin(az), 0]; // level, across the screen
    const V = toViewer(C);
    const REST = HH + BOSS;
    const ext: Vec3[] = [];
    for (const s of [-1, 1]) for (const t of [-1, 1]) {
      ext.push(add3([0, 0, REST], add3(scale3(LAT, CAPR * s), [0, 0, (HH + BOSS) * t])));
      ext.push(add3([0, 0, REST], add3(scale3(W, CAPR * s), [0, 0, (HH + BOSS) * t])));
    }
    fit(C, ext, VW / 2, VH / 2 + 3, VW - 40, VH - 20);
    const P = proj(C);
    const g = mk("g", {}, svg);

    // a contact shadow (solid finish), redrawn as the glass lifts to turn
    const shade = shadow(g, "");
    const parts = mk("g", {}, g);

    // the caps: an outer boss, the disc, the inner step, each a turned prism; a groove round the disc
    const disc = (r: number, k = 48): Vec2[] => Array.from({ length: k }, (_, i): Vec2 => [Math.cos((i / k) * Math.PI * 2) * r, Math.sin((i / k) * Math.PI * 2) * r]);
    type Cap = { g: SVGGElement; boss: Solid; disc: Solid; step: Solid; groove: SVGPathElement; ring: SVGPathElement; sign: number };
    const makeCap = (sign: number): Cap => {
      const cg = mk("g", {}, parts);
      return { g: cg, boss: solid(cg), disc: solid(cg), step: solid(cg), groove: line(cg, "lo"), ring: line(cg, "lo"), sign };
    };
    const caps = [makeCap(-1), makeCap(1)];

    // the spindles, at front left, front right and back
    type Post = { g: SVGGElement; segs: { fill: SVGPathElement; top: SVGPathElement; edge: SVGPathElement; cap: SVGPathElement }[]; hi: SVGPathElement; a: number };
    const posts: Post[] = [rad(60), rad(-60), rad(180)].map((off) => {
      const pg = mk("g", {}, parts);
      const full = SPINDLE.concat(SPINDLE.slice(0, -1).reverse().map(([d, r]): [number, number] => [2 * HG - d, r]));
      const segs = full.slice(1).map(() => ({ fill: mk("path", { class: "k-fill" }, pg), top: mk("path", { class: "k-top" }, pg), edge: mk("path", { class: "k-edge" }, pg), cap: line(pg, "lo") }));
      return { g: pg, segs, hi: line(pg, "lo"), a: off };
    });
    const PROFILE = SPINDLE.concat(SPINDLE.slice(0, -1).reverse().map(([d, r]): [number, number] => [2 * HG - d, r]));

    // the glass and what is in it
    const glassG = mk("g", {}, parts);
    const cupPre = mk("g", {}, glassG);
    // the glass dims what is behind it a little
    const tint = mk("path", { class: "k-fill" }, glassG);
    tint.style.opacity = "0.7";
    const sandA = mk("path", { class: "k-dot lo" }, glassG), sandAo = line(glassG, "edge"), sandB = mk("path", { class: "k-dot lo" }, glassG), sandBo = line(glassG, "edge");
    const surface = mk("path", { class: "k-dot lo" }, glassG), rim = line(glassG, "edge"), crater = line(glassG, "edge");
    const stream = line(glassG, "accent dash"), drip = line(glassG, "accent");
    const glass = line(glassG, "edge"), glassIn = line(glassG, "lo"), gleam = line(glassG, "lo");
    const cupPost = mk("g", {}, glassG);
    // a cup whose open face shows is painted under the glass, and its front wall again over it
    const collars = [0, 1].map(() => { const cg = mk("g", {}, cupPost); const s = solid(cg); const inner = line(cg, "lo"); const wg = mk("g", {}, cupPost); return { cg, s, inner, wg, wall: mk("path", { class: "k-fill" }, wg), wallEdge: mk("path", { class: "k-edge" }, wg) }; });

    // state
    let angle = 0; // the turn, radians; 0 is upright
    let lift = 0;
    const turnSp = spring(0, { k: 150, c: 15.5, eps: 0.001 }); // follows the turn's push and runs a little past it, ζ ≈ 0.63
    let turning = -1; // seconds into a turn, or -1
    let qTop = 1; // the share of the sand in the upper bulb, indeterminate
    const shown = spring(0, { k: 26, c: 10.5, eps: 0.0005 }); // determinate: the share of the sand that has run, eased
    let flow = 0; // the stream's dash offset
    const det = () => typeof opts.value === "number" && Number.isFinite(opts.value);
    const frac = () => { const m = num(opts.max, 100) || 100; return clamp(num(opts.value, 0) / m, 0, 1); };
    const runs = () => opts.running !== false;
    shown.x = shown.t = det() ? frac() : 0;

    /** The silhouette of a solid of revolution about an axis: its two sides, from samples (s along the axis, r). */
    function revolve(O: Vec3, w: Vec3, u: Vec3, v: Vec3, prof: [number, number][]) {
      const a = dot3(u, V), b = dot3(v, V), wv = dot3(w, V), R = Math.hypot(a, b), ph = Math.atan2(b, a);
      const pt = (s: number, r: number, t: number): Vec2 => {
        const p = add3(add3(O, scale3(w, s)), add3(scale3(u, r * Math.cos(t)), scale3(v, r * Math.sin(t))));
        return P(p[0], p[1], p[2]);
      };
      const A: Vec2[] = [], Bs: Vec2[] = [], tA: number[] = [];
      prof.forEach(([s, r], i) => {
        const p0 = prof[Math.max(0, i - 1)], p1 = prof[Math.min(prof.length - 1, i + 1)];
        const dr = p1[0] !== p0[0] ? (p1[1] - p0[1]) / (p1[0] - p0[0]) : 0;
        const k = Math.acos(R > 1e-6 ? clamp((dr * wv) / R, -1, 1) : 0);
        A.push(pt(s, r, ph + k)); Bs.push(pt(s, r, ph - k)); tA.push(k);
      });
      /** The end ring at sample i, from side A round to side B: behind if that end faces the viewer, else in front. */
      const arc = (i: number, outward: number, fromA: boolean) => {
        const [s, r] = prof[i], k = tA[i], back = outward * wv > 0;
        const t0 = ph + k, t1 = back ? ph - k + Math.PI * 2 : ph - k;
        const out: Vec2[] = [];
        for (let j = 1; j < 16; j++) out.push(pt(s, r, lerp(t0, t1, j / 16)));
        return fromA ? out : out.reverse();
      };
      const ring = (i: number) => { const [s, r] = prof[i]; return Array.from({ length: 40 }, (_, j) => pt(s, r, (j / 40) * Math.PI * 2)); };
      return { A, B: Bs, arc, ring, faces: (outward: number) => outward * wv > 0 };
    }

    /** The front half of a revolve's end ring i, from side A to side B. */
    const frontArc = (rv: ReturnType<typeof revolve>, i: number) => rv.arc(i, rv.faces(1) ? -1 : 1, true);

    // the light, from the upper left and a little toward the viewer, as a world direction
    const LW: Vec3 = (() => { const c = Math.cos(az), sn = Math.sin(az), lu = -c * 0.85 + sn * 0.5, lv = sn * 0.85 + c * 0.5, n = Math.hypot(lu, lv, 0.7); return [lu / n, lv / n, 0.7 / n]; })();
    /** A turned drum (a disc, a cup) on any axis, as the seven paths of a solid: smooth sides in four tones, the end that shows as its lid. */
    function drum(O: Vec3, w: Vec3, u: Vec3, v: Vec3, r: number, s0: number, s1: number, n = 48): SolidPaths {
      const rv = revolve(O, w, u, v, [[s0, r], [s1, r]]);
      const sil = poly([...rv.A, ...rv.arc(1, 1, true), ...rv.B.slice().reverse(), ...rv.arc(0, -1, false)]);
      const at = (s: number, t: number): Vec2 => { const p = add3(add3(O, scale3(w, s)), add3(scale3(u, r * Math.cos(t)), scale3(v, r * Math.sin(t)))); return P(p[0], p[1], p[2]); };
      const buckets: string[][] = Array.from({ length: SHADES }, () => []);
      const front: boolean[] = [];
      for (let k = 0; k < n; k++) {
        const t0 = (k / n) * Math.PI * 2, t1 = ((k + 1) / n) * Math.PI * 2, tm = (t0 + t1) / 2;
        const nn = add3(scale3(u, Math.cos(tm)), scale3(v, Math.sin(tm)));
        const vis = dot3(nn, V) > 1e-6;
        front.push(dot3(add3(scale3(u, Math.cos(t0)), scale3(v, Math.sin(t0))), V) > 0);
        if (!vis) continue;
        const b = Math.min(SHADES - 1, Math.floor(((dot3(nn, LW) + 1) / 2) * SHADES));
        buckets[b].push(poly([at(s1, t0), at(s1, t1), at(s0, t1), at(s0, t0)]));
      }
      const se = rv.faces(1) ? s1 : s0;
      const ring = Array.from({ length: n }, (_, k) => at(se, (k / n) * Math.PI * 2));
      // the front run of the lid's ring, where it meets the sides
      let st = front.findIndex((f, k) => f && !front[(k + n - 1) % n]);
      const run: Vec2[] = [];
      if (st >= 0) for (let k = 0; k <= n && front[(st + k) % n]; k++) run.push(ring[(st + k) % n]);
      if (run.length) run.push(ring[(st + run.length) % n]);
      return { sil, shades: buckets.map((b) => b.join("")), top: poly(ring), crease: open(run) };
    }

    /** A sand body along the axis, between d0 and d1 from the neck (σ: which bulb), with a cone toward the neck of height hc. */
    function body(O: Vec3, w: Vec3, u: Vec3, v: Vec3, sigma: number, d0: number, d1: number, hc: number) {
      if (d1 - d0 < 0.05) return null;
      const prof: [number, number][] = [];
      const c0 = Math.max(0, d0 - hc);
      if (hc > 0.05) for (let k = 0; k <= 8; k++) { const d = lerp(c0, d0, k / 8); prof.push([d, Math.min(rIn(d), rIn(d0) * ((d - c0) / (d0 - c0 || 1)))]); }
      for (let k = hc > 0.05 ? 1 : 0; k <= 28; k++) { const d = lerp(d0, d1, k / 28); prof.push([d, rIn(d)]); }
      const s = prof.map(([d, r]): [number, number] => [sigma * d, r]);
      if (sigma < 0) s.reverse();
      const rv = revolve(O, w, u, v, s);
      const last = s.length - 1;
      // the outline: one side up, round the far end, the other side down, round the near end
      const pts = [...rv.A, ...rv.arc(last, 1, true), ...rv.B.slice().reverse(), ...rv.arc(0, -1, false)];
      return { d: poly(pts), rv, s };
    }

    function frameAt(a: number, z: number) {
      const R = axisRot(W, a);
      const O: Vec3 = [0, 0, z];
      const X = (p: Vec3): Vec3 => add3(O, turn(R, p));
      const axis = turn(R, [0, 0, 1]);
      return { R, O, X, axis };
    }

    let drawnFrame = "";
    function drawFrame(a: number, z: number) {
      const key = a.toFixed(5) + " " + z.toFixed(4);
      if (key === drawnFrame) return;
      drawnFrame = key;
      const F = frameAt(a, z);
      const toward = dot3(F.axis, V); // >0: the axis's +end leans toward the viewer
      shade.setAttribute("d", poly(disc(CAPR * (1 - lift * 0.02) + Math.abs(Math.sin(a)) * 8, 24).map(([x, y]) => P(x + 2, y + 2, 0))));

      // caps
      const u = turn(F.R, [1, 0, 0]), v = turn(F.R, [0, 1, 0]);
      for (const cap of caps) {
        const sgn = cap.sign;
        const put = (s: Solid, r: number, z0: number, z1: number) => s.put(drum(F.O, F.axis, u, v, r, Math.min(sgn * z0, sgn * z1), Math.max(sgn * z0, sgn * z1)));
        put(cap.boss, 13, HH, HH + BOSS);
        put(cap.disc, CAPR, HH - CAPT, HH);
        put(cap.step, STEPR, HG, HH - CAPT);
        // the groove round the disc's rim, on the side that shows
        const groove: Vec2[] = [], ring: Vec2[] = [];
        for (let k = 0; k <= 48; k++) {
          const t = (k / 48) * Math.PI * 2, rr: Vec3 = [Math.cos(t), Math.sin(t), 0];
          if (dot3(turn(F.R, rr), V) > 0.05) { const p = F.X([rr[0] * CAPR, rr[1] * CAPR, sgn * (HH - CAPT / 2)]); groove.push(P(p[0], p[1], p[2])); }
          const q = F.X([rr[0] * (CAPR - 2.6), rr[1] * (CAPR - 2.6), sgn * HH]);
          ring.push(P(q[0], q[1], q[2]));
        }
        cap.groove.setAttribute("d", open(groove));
        // a turned ring on the outer face, where it faces the viewer
        cap.ring.setAttribute("d", sgn * toward > 0 ? poly(ring) : "");
        // its pieces, the far one first
        const outerFirst = sgn * toward < 0;
        const order = outerFirst ? [cap.boss, cap.disc, cap.step] : [cap.step, cap.disc, cap.boss];
        for (const s of order) cap.g.appendChild(s.g);
        cap.g.appendChild(cap.groove); cap.g.appendChild(cap.ring);
      }

      // spindles
      for (const p of posts) {
        const ox = Math.cos(p.a) * RP, oy = Math.sin(p.a) * RP;
        // the post's own frame: the spindles stand at world angles measured from the viewer's side
        const off = add3(scale3(W, ox), scale3(LAT, oy));
        const base = turn(axisRot(W, a), off);
        const pts = PROFILE.map(([d, r]) => ({ p: add3(add3(F.O, base), scale3(F.axis, d - HG)), r }));
        // draw the segments from the far end to the near end, each with its near end's ring
        const idx = pts.slice(1).map((_, i) => i);
        if (toward < 0) idx.reverse();
        idx.forEach((i, k) => {
          const a0 = toward >= 0 ? pts[i] : pts[i + 1], a1 = toward >= 0 ? pts[i + 1] : pts[i];
          const b = bar(P, a0.p, a1.p, a0.r, a1.r, 20);
          const sg = p.segs[k];
          sg.fill.setAttribute("d", b.sil); sg.edge.setAttribute("d", b.sil); sg.top.setAttribute("d", b.cap); sg.cap.setAttribute("d", b.cap);
        });
        // a highlight down the long shafts, on the lit side
        const side = scale3(cross3(F.axis, V), 0.55);
        const h0 = add3(add3(add3(F.O, base), scale3(F.axis, -HG + 6)), side), h1 = add3(add3(add3(F.O, base), scale3(F.axis, HG - 6)), side);
        const q0 = P(h0[0], h0[1], h0[2]), q1 = P(h1[0], h1[1], h1[2]);
        p.hi.setAttribute("d", seg(q0, q1));
      }

      // paint order: the cap seen from inside, the posts behind the glass, the glass, the posts in front, the cap seen from outside
      const depthOf = (p: Post) => dot3(turn(axisRot(W, a), add3(scale3(W, Math.cos(p.a) * RP), scale3(LAT, Math.sin(p.a) * RP))), V);
      const sorted = posts.slice().sort((x, y) => depthOf(x) - depthOf(y));
      const inner = caps.filter((c) => c.sign * toward < 0), outer = caps.filter((c) => c.sign * toward >= 0);
      const seq: Element[] = [...inner.map((c) => c.g), ...sorted.filter((p) => depthOf(p) < 0).map((p) => p.g), glassG, ...sorted.filter((p) => depthOf(p) >= 0).map((p) => p.g), ...outer.map((c) => c.g)];
      for (const el of seq) parts.appendChild(el);

      // the glass: its two sides, the thick neck, a gleam on each bulb; the ferrules over its ends
      const prof: [number, number][] = [];
      for (let k = 0; k <= N; k++) { const s = lerp(-HG + 0.5, HG - 0.5, k / N); prof.push([s, rGlass(s)]); }
      const rv = revolve(F.O, F.axis, u, v, prof);
      glass.setAttribute("d", open(rv.A) + open(rv.B));
      tint.setAttribute("d", poly([...rv.A, ...rv.B.slice().reverse()]));
      const neck = prof.filter(([s]) => Math.abs(s) < 3.2).map(([s, r]): [number, number] => [s, r - GT * 0.8]);
      const rn = revolve(F.O, F.axis, u, v, neck);
      glassIn.setAttribute("d", open(rn.A) + open(rn.B));
      const lit = (rv.A[N >> 1][0] < rv.B[N >> 1][0]) ? 1 : -1; // which side is screen-left
      const gl: string[] = [];
      for (const sg of [-1, 1]) {
        const pts: Vec2[] = [];
        for (let k = 0; k <= 10; k++) {
          const s = sg * lerp(DM - 6, DM + 4, k / 10), r = rGlass(s) - 1.3;
          const ph = Math.atan2(dot3(v, V), dot3(u, V)) + lit * 1.05;
          const p = add3(add3(F.O, scale3(F.axis, s)), add3(scale3(u, r * Math.cos(ph)), scale3(v, r * Math.sin(ph))));
          pts.push(P(p[0], p[1], p[2]));
        }
        gl.push(open(pts));
      }
      gleam.setAttribute("d", gl.join(""));
      // the cups: each dome sits in a shallow turned cup on its cap, its rim and inner lip toward the neck
      [-1, 1].forEach((sg, i) => {
        const c = collars[i];
        const s0 = Math.min(sg * (HG - CUPH), sg * HG), s1 = Math.max(sg * (HG - CUPH), sg * HG);
        c.s.put(drum(F.O, F.axis, u, v, CUPR, s0, s1));
        const lipS = sg * (HG - CUPH), shows = sg * toward < 0;
        const ringAt = (r: number) => Array.from({ length: 40 }, (_, j): Vec2 => { const t = (j / 40) * Math.PI * 2, p = add3(add3(F.O, scale3(F.axis, lipS)), add3(scale3(u, r * Math.cos(t)), scale3(v, r * Math.sin(t)))); return P(p[0], p[1], p[2]); });
        c.inner.setAttribute("d", shows ? poly(ringAt(CUPR - 1.1)) : "");
        (shows ? cupPre : cupPost).appendChild(c.cg);
        if (shows) {
          // the wall's front, from the rim's front arc down to the foot's
          const r2 = revolve(F.O, F.axis, u, v, [[s0, CUPR], [s1, CUPR]]);
          const top = sg < 0 ? 1 : 0, foot = 1 - top;
          const w = poly([r2.A[top], ...frontArc(r2, top), r2.B[top], r2.B[foot], ...frontArc(r2, foot).reverse(), r2.A[foot]]);
          c.wall.setAttribute("d", w); c.wallEdge.setAttribute("d", w);
        } else { c.wall.setAttribute("d", ""); c.wallEdge.setAttribute("d", ""); }
      });
    }

    /** Draws the sand: `up` is the share in the bulb on the +axis side, `piled` how far that bulb's sand has slid to its far end (turning). */
    function drawSand(a: number, z: number, upShare: number, flowing: boolean, slide: number) {
      const F = frameAt(a, z);
      const u = turn(F.R, [1, 0, 0]), v = turn(F.R, [0, 1, 0]);
      // +axis bulb is on top when upright: its sand lies against the neck (slide 0) or, turning, slides to its far end
      const qU = upShare * SAND, qD = (1 - upShare) * SAND;
      // upper: neck fill
      const dHi = dAt(qU);
      // lower: a pile from the far end, the last of it as a cone toward the neck
      const pile = (q: number) => {
        const dLo = dAt(VT - q * 0.86), hc = Math.min(rIn(dLo) * 0.62, dLo - 0.6) * clamp((q / SAND) * 6, 0, 1);
        return { dLo, hc };
      };
      const pd = pile(qD);
      // while turning, the full bulb's charge slides from its far end (as a pile) to its neck
      let U = body(F.O, F.axis, u, v, 1, 0, dHi, 0);
      if (slide < 1) {
        const pu = pile(qU);
        const d0 = lerp(pu.dLo, 0, slide), d1 = lerp(HG - 0.6, dHi, slide);
        U = body(F.O, F.axis, u, v, 1, d0, d1, pu.hc * (1 - slide));
      }
      const D = body(F.O, F.axis, u, v, -1, pd.dLo, HG - 0.6, pd.hc);
      sandA.setAttribute("d", U ? U.d : ""); sandAo.setAttribute("d", U ? U.d : "");
      sandB.setAttribute("d", D ? D.d : ""); sandBo.setAttribute("d", D ? D.d : "");
      // the top charge's level face and its crater over the neck
      if (U && slide >= 1 && dHi > 0.6 && U.rv.faces(1)) {
        const last = U.s.length - 1;
        surface.setAttribute("d", poly(U.rv.ring(last))); rim.setAttribute("d", poly(U.rv.ring(last)));
        const r = rIn(dHi) * 0.34, dd = Math.max(0.2, dHi - 1.2);
        const pts: Vec2[] = [];
        for (let k = 0; k < 24; k++) {
          const t = (k / 24) * Math.PI * 2, p = add3(add3(F.O, scale3(F.axis, dd)), add3(scale3(u, r * Math.cos(t)), scale3(v, r * Math.sin(t))));
          pts.push(P(p[0], p[1], p[2]));
        }
        crater.setAttribute("d", poly(pts));
      } else { surface.setAttribute("d", ""); rim.setAttribute("d", ""); crater.setAttribute("d", ""); }
      // the stream: from the neck down to the top of the pile
      if (flowing && qU > 0.002 * SAND) {
        const apex = Math.max(0.6, pd.dLo - pd.hc);
        const p0 = F.X([0, 0, -0.4]), p1 = F.X([0, 0, -apex]);
        const q0 = P(p0[0], p0[1], p0[2]), q1 = P(p1[0], p1[1], p1[2]);
        stream.setAttribute("d", seg(q0, q1));
        const pn = F.X([0, 0, 0.6]), qn = P(pn[0], pn[1], pn[2]);
        drip.setAttribute("d", seg(qn, q0));
        stream.style.strokeDashoffset = String(-flow);
      } else { stream.setAttribute("d", ""); drip.setAttribute("d", ""); }
    }

    const B = register(host, (dt) => {
      const still = reducedMotion();
      let moving = false;
      if (det()) {
        turning = -1; angle = 0; lift = 0; turnSp.x = turnSp.t = 0; turnSp.v = 0;
        shown.t = frac();
        moving = stepS(shown, dt);
        const flowing = runs() && shown.x < 0.999;
        if (flowing && !still) { flow += dt * 26; moving = true; }
        drawFrame(0, REST);
        drawSand(0, REST, 1 - shown.x, flowing, 1);
        return moving;
      }
      if (still) {
        // indeterminate, reduced motion: a glass part run, standing still
        turning = -1; angle = 0; lift = 0;
        drawFrame(0, REST);
        drawSand(0, REST, 0.58, runs(), 1);
        return false;
      }
      if (!runs() && turning < 0) { drawFrame(0, REST); drawSand(0, REST, qTop, false, 1); return false; }
      if (turning < 0) {
        qTop -= dt / RUN;
        flow += dt * 26;
        if (qTop <= 0) { qTop = 0; turning = 0; turnSp.x = 0; turnSp.v = 0; }
        drawFrame(0, REST);
        drawSand(0, REST, qTop, true, 1);
        return true;
      }
      // turning: a smooth push to half a turn that the glass follows with a little lag, and runs past
      turning += dt;
      turnSp.t = Math.PI * smooth(turning / TURN);
      stepS(turnSp, dt);
      angle = turnSp.x;
      lift = Math.sin(clamp(angle / Math.PI, 0, 1) * Math.PI) * 3.2;
      const slide = smooth((angle - rad(70)) / rad(60));
      drawFrame(angle, REST + lift);
      // the full bulb is the -axis one: show it from the +axis side's frame by turning the shares round
      drawSandTurned(angle, REST + lift, slide);
      if (turning > TURN && Math.abs(turnSp.x - Math.PI) < 0.002 && Math.abs(turnSp.v) < 0.02) {
        // set down: the glass is symmetric, so it is upright again with the full bulb on top
        turning = -1; angle = 0; lift = 0; qTop = 1; turnSp.x = turnSp.t = 0; drawnFrame = "";
        drawFrame(0, REST);
        drawSand(0, REST, 1, true, 1);
      }
      return true;
    });

    /** Mid-turn: the -axis bulb holds all the sand, sliding from its far end (a pile) to its neck as it passes level. */
    function drawSandTurned(a: number, z: number, slide: number) {
      // seen from the other end, the -axis bulb is the +axis bulb of a glass turned by a further half turn
      drawSand(a + Math.PI, z, 1, false, slide);
    }
    bag.add(B.unregister);

    const restore = keepAttrs(host, ["role", "aria-label", "aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-busy"]);
    const sync = () => {
      host.setAttribute("role", "progressbar");
      host.setAttribute("aria-label", opts.label ?? "Progress");
      if (det()) {
        const m = num(opts.max, 100) || 100;
        host.setAttribute("aria-valuemin", "0");
        host.setAttribute("aria-valuemax", String(m));
        host.setAttribute("aria-valuenow", String(clamp(num(opts.value, 0), 0, m)));
        host.removeAttribute("aria-busy");
        host.setAttribute("data-state", frac() >= 1 ? "done" : "running");
      } else {
        host.removeAttribute("aria-valuemin");
        host.removeAttribute("aria-valuemax");
        host.removeAttribute("aria-valuenow");
        host.setAttribute("aria-busy", runs() ? "true" : "false");
        host.setAttribute("data-state", runs() ? "busy" : "paused");
      }
    };
    sync();

    bag.add(() => { restore(); host.removeAttribute("data-state"); svg.replaceChildren(); });
    return {
      update(next) {
        const was = det();
        opts = next;
        if (det() && !was) { shown.x = shown.t = frac(); }
        if (!det() && was) { qTop = 1 - shown.x; }
        drawnFrame = "";
        sync();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
