import { camera, cyl, fit, flat, planeMatrix, poly3, prism3, proj, rad, rrect, seg, slab, unproj, loft, type Ring, type Vec2, type Vec3 } from "../core/iso";
import { spring, stepS } from "../core/motion";
import { define, emit, nativeInput, num, snap, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, toView, type Solid } from "../core/stage";

/**
 * Caliper — a range slider, built as a vernier caliper lying on the bench.
 *
 * Two sliding heads ride an engraved beam whose millimetre scale is the steps
 * when there are few enough of them. Each head carries a vernier plate, a
 * locking screw and a knurled thumb roller, and hangs its jaw over the beam's
 * near edge; the jaws face each other and the gap between them is lit with
 * the accent along the beam's groove. The heads follow their values on
 * springs, so a jump from the keyboard travels and the rollers turn as they
 * go; a jaw never passes the other.
 *
 * Semantics come from two visually hidden `<input type="range">`, one per
 * jaw, inside a labelled group.
 */

export type CaliperOptions = BaseOptions & {
  value?: [number, number];
  defaultValue?: [number, number];
  min?: number;
  max?: number;
  step?: number;
  /** The smallest distance the jaws keep between them, in value units. Default 0 (they may close). */
  minGap?: number;
  /** Called with the new pair on every change, by pointer or keyboard. */
  onValueChange?: (value: [number, number]) => void;
  /** Called once when a drag or key press settles. */
  onValueCommit?: (value: [number, number]) => void;
  /** Formats each input's `aria-valuetext`, e.g. (v) => `${v} mm`. */
  format?: (value: number) => string;
  /** Set by the React wrapper when `value` is controlled. */
  controlled?: boolean;
};

const VW = 340, VH = 150;
let uid = 0;

/** A rounded rectangle whose left and right ends take their own radius (0 for a cut end). */
function rring(x0: number, y0: number, x1: number, y1: number, rl: number, rr: number, n = 4): Ring {
  const out: Ring = [];
  for (const [cu, cv, a0, r] of [[x1 - rr, y1 - rr, 0, rr], [x0 + rl, y1 - rl, 90, rl], [x0 + rl, y0 + rl, 180, rl], [x1 - rr, y0 + rr, 270, rr]] as const)
    for (let k = 0; k <= n; k++) {
      const a = rad(a0 + (90 * k) / n), ca = Math.cos(a), sa = Math.sin(a);
      out.push({ u: cu + r * ca, v: cv + r * sa, nu: ca, nv: sa });
    }
  return out;
}

export const caliper = define<CaliperOptions>({
  id: "caliper",
  label: "Range",
  vw: VW,
  vh: VH,
  width: 300,
  keys: ["value", "defaultValue", "min", "max", "step", "minGap", "onValueChange", "onValueCommit", "format", "controlled"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(30, 32);
    const S = 58, HL = 15, BW = 7.5, BL = S + HL + 5; // scale half-length, head length, beam half-width and half-length
    const Z0 = 1.4, ZT = 3.8, HZ = 6.6; // beam bottom and top (the heads lift it off the bench), head top
    const HY0 = -BW - 2.2, HY1 = BW + 1.8, JL = 15; // head's far and near faces, outer jaw reach
    const ext: Vec3[] = [[-BL, HY0 - 7, 0], [BL, HY1 + JL, 0], [-BL, HY1 + JL, 0], [BL, HY0 - 7, 0], [-BL, HY0, HZ + 2.4], [BL, HY0, HZ + 2.4]];
    fit(C, ext, VW / 2, VH / 2 + 2, VW - 18, VH - 14);
    const P = proj(C);
    const sa = Math.sin(rad(C.az)), ca = Math.cos(rad(C.az));
    const id = "knurl-cal" + ++uid;

    const g = mk("g", {}, svg);
    shadow(g, flat(P, rrect(-BL, -BW + 3, BL, BW + 3, 2), 0));
    const shades = [shadow(g, ""), shadow(g, "")];

    /* ───── the value side: two native ranges ───── */

    const lim = () => {
      const a = num(opts.min, 0), b = num(opts.max, 100);
      const min = Math.min(a, b), max = Math.max(a, b);
      return { min, max, step: num(opts.step, 1), gap: Math.max(0, Math.min(max - min, num(opts.minGap, 0))) };
    };
    let { min, max, step, gap } = lim();
    const grid = (v: number, up: boolean) => {
      if (!(step > 0)) return Math.max(min, Math.min(max, v));
      const k = (v - min) / step;
      return snap(min + (up ? Math.ceil(k - 1e-9) : Math.floor(k + 1e-9)) * step, min, max, step);
    };
    /** Snaps a pair and keeps the gap, moving `which` jaw (the other stays unless the limits force it). */
    const fix = (a0: number, b0: number, which: "lo" | "hi"): [number, number] => {
      let a = snap(a0, min, max, step), b = snap(b0, min, max, step);
      if (b - a < gap) {
        if (which === "lo") a = grid(b - gap, false); else b = grid(a + gap, true);
        if (b - a < gap && b >= max) a = grid(max - gap, false);
        if (b - a < gap && a <= min) b = grid(min + gap, true);
      }
      return [a, b];
    };
    const pairOf = (v: unknown): [number, number] | null => {
      if (!Array.isArray(v) || v.length < 2) return null;
      const a = num(v[0], min), b = num(v[1], max);
      return a <= b ? [a, b] : [b, a];
    };
    let [lo, hi] = fix(...(pairOf(opts.value) ?? pairOf(opts.defaultValue) ?? [min + (max - min) * 0.25, min + (max - min) * 0.75]), "hi");

    const inLo = nativeInput(ctx, { type: "range" });
    const inHi = nativeInput(ctx, { type: "range" });
    const sync = () => {
      const label = opts.label ?? "Range";
      host.setAttribute("role", "group");
      host.setAttribute("aria-label", label);
      ([[inLo, lo, "minimum"], [inHi, hi, "maximum"]] as const).forEach(([el, v, which]) => {
        el.min = String(min); el.max = String(max); el.step = String(step || "any");
        el.value = String(v);
        el.disabled = !!opts.disabled;
        el.setAttribute("aria-label", `${label} ${which}`);
        if (opts.format) el.setAttribute("aria-valuetext", opts.format(v)); else el.removeAttribute("aria-valuetext");
        if (opts.name) el.name = opts.name; else el.removeAttribute("name");
      });
    };
    sync();

    const set = ([a, b]: [number, number]) => {
      if (a === lo && b === hi) { inLo.value = String(lo); inHi.value = String(hi); return; }
      if (opts.controlled) { inLo.value = String(lo); inHi.value = String(hi); emit(opts.onValueChange, [a, b]); return; }
      lo = a; hi = b; sync(); B.wake(); emit(opts.onValueChange, [a, b]);
    };
    const commit = () => emit(opts.onValueCommit, [lo, hi]);
    bag.on(inLo, "input", () => set(fix(Math.min(Number(inLo.value), hi), hi, "lo")));
    bag.on(inHi, "input", () => set(fix(lo, Math.max(Number(inHi.value), lo), "hi")));
    bag.on(inLo, "change", commit);
    bag.on(inHi, "change", commit);

    const xOf = (v: number) => (max > min ? -S + (2 * S * (v - min)) / (max - min) : -S);
    const vOf = (x: number) => min + ((x + S) / (2 * S)) * (max - min);

    /* ───── the beam, in three pieces so each head sits between the right ones ───── */

    type Piece = { body: Solid; clip: SVGPathElement; over: SVGGElement };
    const defs = mk("defs", {}, g);
    const overs: Array<{ minor: SVGPathElement; mid: SVGPathElement; major: SVGPathElement; labels: SVGGElement; lit: SVGPathElement }> = [];
    const layer = (k: number) => {
      const body = solid(g);
      const cp = mk("clipPath", { id: `${id}-${k}` }, defs);
      const clip = mk("path", {}, cp);
      const over = mk("g", { "clip-path": `url(#${id}-${k})` }, g);
      // the beam's top: a border line, the groove, the back ruler, the main scale and its figures, the end stops
      line(over, "lo").setAttribute("d", flat(P, rrect(-BL + 1.4, -BW + 1.2, BL - 1.4, BW - 1.2, 1), ZT));
      mk("path", { class: "k-slot", d: flat(P, rrect(-BL + 6, -3.4, BL - 6, -1.8, 0.8), ZT) }, over);
      const back: string[] = [];
      for (let i = 0; i <= 48; i++) { const x = -S + (2 * S * i) / 48; back.push(seg(P(x, -BW + 0.9, ZT), P(x, -BW + (i % 4 ? 2.1 : 3), ZT))); }
      line(over, "lo").setAttribute("d", back.join(""));
      const minor = line(over, "mid"), mid = line(over, "edge"), major = line(over, "hi");
      const labels = mk("g", {}, over);
      const lit = line(over, "accent");
      const stops: string[] = [];
      for (const x of [-BL + 2.6, BL - 2.6]) {
        solid(over).put(cyl(C, P, x, -2.6, 1.3, ZT, ZT + 0.5, 16));
        stops.push(seg(P(x - 0.9, -2.3, ZT + 0.5), P(x + 0.9, -2.9, ZT + 0.5)));
      }
      line(over, "edge").setAttribute("d", stops.join(""));
      overs.push({ minor, mid, major, labels, lit });
      return { body, clip, over };
    };

    function drawScale() {
      const span = max - min, steps = step > 0 ? Math.round(span / step) : 0;
      const n = steps > 0 && steps <= 100 ? steps : 100;
      const every = [10, 5, 4, 2].map((d) => n / d).find((e) => Number.isInteger(e) && e >= 1) ?? n;
      const half = every % 2 === 0 ? every / 2 : 0;
      const minor: string[] = [], midT: string[] = [], major: string[] = [];
      const figs: Array<[number, string]> = [];
      for (let k = 0; k <= n; k++) {
        const x = -S + (2 * S * k) / n, y0 = BW - 0.9;
        if (k % every === 0) {
          major.push(seg(P(x, y0, ZT), P(x, y0 - 3.2, ZT)));
          const v = String(Number((min + (span * k) / n).toFixed(2)));
          if (v.length <= 4) figs.push([x, v]);
        } else if (half && k % half === 0) midT.push(seg(P(x, y0, ZT), P(x, y0 - 2.3, ZT)));
        else minor.push(seg(P(x, y0, ZT), P(x, y0 - 1.5, ZT)));
      }
      for (const ov of overs) {
        ov.minor.setAttribute("d", minor.join(""));
        ov.mid.setAttribute("d", midT.join(""));
        ov.major.setAttribute("d", major.join(""));
        ov.labels.replaceChildren();
        for (const [x, v] of figs) {
          const t = mk("text", { class: "k-text", "text-anchor": "middle", transform: planeMatrix(P, [x, BW - 4.7, ZT], [1, 0, 0], [0, 1, 0]) }, ov.labels);
          t.style.fontSize = "2.6px";
          t.textContent = v;
        }
      }
      unit = (2 * S) / n;
    }
    let unit = 1;

    /* ───── a sliding head ───── */

    // Each head reaches from its measuring face away from the other: the lo head toward −x, the hi head
    // toward +x. A head is two layers: what is over the beam (the knife jaw on the far edge, the body
    // and what sits on it), and what hangs off its near edge (the outer jaw at the measuring end, the
    // thumb roller at the tail). The near layers are nearer than any of the beam, so they paint last;
    // within one, +x is nearer the viewer, so the lo head paints its roller first and the hi head its jaw.
    const head = (dir: -1 | 1) => {
      const hg = mk("g", {}, g);
      const knife = solid(hg);
      const body = solid(hg), seam = line(hg, "lo");
      const plate = solid(hg), vern = line(hg, "mid"), zero = line(hg, "hi"), plateScrews = line(hg, "edge");
      const washer = solid(hg), screw = solid(hg), screwKnurl = line(hg, "lo"), slot = line(hg, "edge");
      const near = mk("g", {}, null);
      const nearA = mk("g", {}, near), nearB = mk("g", {}, near);
      const [rollG, jawG] = dir < 0 ? [nearA, nearB] : [nearB, nearA];
      const jaw = solid(jawG), jawLine = line(jawG, "lo");
      const lug = solid(rollG), lugScrew = line(rollG, "edge"), wheel = solid(rollG), knurl = line(rollG, "lo"), wheelCap = solid(rollG), axle = line(rollG, "edge");
      return { dir, near, knife, body, seam, plate, vern, zero, plateScrews, washer, screw, screwKnurl, slot, jaw, jawLine, lug, lugScrew, wheel, knurl, wheelCap, axle };
    };
    type Head = ReturnType<typeof head>;

    /** Knurl lines on the visible side of an upright ring. */
    const knurlOf = (cx: number, cy: number, R: number, z0: number, z1: number, n: number, phase: number) => {
      const out: string[] = [];
      for (let k = 0; k < n; k++) {
        const a = phase + (k / n) * Math.PI * 2, nu = Math.cos(a), nv = Math.sin(a);
        if (nu * sa + nv * ca < 0.18) continue;
        out.push(seg(P(cx + R * nu, cy + R * nv, z0), P(cx + R * nu, cy + R * nv, z1)));
      }
      return out.join("");
    };
    // footprints of the lo head's jaws, from the measuring face (x 0) at the beam's edge, counter-clockwise;
    // the hi head's are their mirror images
    const JAW: Vec2[] = [[0, 0], [0, JL], [-2.2, JL - 2.6], [-7.6, 4.6], [-9.5, 0]];
    const KNIFE: Vec2[] = [[0, 0], [-3.6, 0], [-1.7, -6.2], [0, -7]];
    const mirror = (r: Vec2[]) => r.map(([a, b]): Vec2 => [-a, b]).reverse();
    const shape = (p: { verts: Vec3[]; faces: number[][] }) => poly3(C, P, p.verts, p.faces);
    const IZ = (Z0 + ZT) / 2;

    function drawHead(h: Head, m: number) {
      const d = h.dir, xo = m + d * HL, x0 = Math.min(m, xo), x1 = Math.max(m, xo);
      const at = (a: number) => m + d * a; // a distance from the measuring face into the head
      h.knife.put(shape(prism3([m, HY0, IZ], d < 0 ? KNIFE : mirror(KNIFE), 0.7)));
      // the body wraps the beam; a seam, the vernier plate and the locking screw sit on top
      h.body.put(slab(C, P, x0, HY0, x1, HY1, 1.4, 0, HZ));
      h.seam.setAttribute("d", flat(P, rrect(x0 + 1.1, HY0 + 1.1, x1 - 1.1, HY1 - 1.1, 0.8), HZ));
      const p0 = Math.min(at(0.8), at(12.6)), p1 = Math.max(at(0.8), at(12.6)), py0 = BW - 3.8, py1 = HY1 - 0.6, zt = HZ + 0.4;
      h.plate.put(slab(C, P, p0, py0, p1, py1, 0.5, HZ, zt));
      const vs = Math.max(0.8, Math.min(1.05, unit * 0.9)), vt: string[] = [];
      for (let k = 1; k <= 10; k++) { const x = at(1.6 + k * vs); vt.push(seg(P(x, py1 - 0.5, zt), P(x, py1 - (k % 5 ? 1.6 : 2.6), zt))); }
      h.vern.setAttribute("d", vt.join(""));
      h.zero.setAttribute("d", seg(P(at(1.6), py1 - 0.5, zt), P(at(1.6), py1 - 3.1, zt)));
      // the plate's two screws, in the margin behind the vernier
      const ps = [at(2.2), at(11.4)].map((x) => seg(P(x - 0.55, py0 + 1.1, zt), P(x + 0.55, py0 + 0.9, zt)));
      h.plateScrews.setAttribute("d", ps.join(""));
      const sx = at(HL * 0.62), sy = -BW * 0.45;
      h.washer.put(cyl(C, P, sx, sy, 2.7, HZ, HZ + 0.4, 28));
      h.screw.put(cyl(C, P, sx, sy, 2, HZ + 0.4, HZ + 2.2, 28));
      h.screwKnurl.setAttribute("d", knurlOf(sx, sy, 2, HZ + 0.7, HZ + 1.9, 22, 0.1));
      const sl = rad(-25);
      h.slot.setAttribute("d", seg(P(sx - Math.cos(sl) * 1.3, sy - Math.sin(sl) * 1.3, HZ + 2.2), P(sx + Math.cos(sl) * 1.3, sy + Math.sin(sl) * 1.3, HZ + 2.2)));
      // the outer jaw hangs over the near edge, its measuring face flush with the head's end
      h.jaw.put(shape(prism3([m, HY1, IZ], d < 0 ? JAW : mirror(JAW), (ZT - Z0) / 2)));
      h.jawLine.setAttribute("d", seg(P(at(1.4), HY1 + 0.8, ZT), P(at(7), HY1 + 0.8, ZT)));
      // the lug at the tail and its thumb roller, which turns as the head travels along the beam
      const l0 = Math.min(xo, xo - d * 5.8), l1 = Math.max(xo, xo - d * 5.8), wx = xo - d * 2.9, wy = HY1 + 3.2, ph = -m / 2.6;
      h.lug.put(slab(C, P, l0, HY1, l1, HY1 + 6.4, 1.4, 0.8, 2.8));
      h.lugScrew.setAttribute("d", seg(P(l0 + 0.9, HY1 + 0.9, 2.8), P(l1 - 0.9, HY1 + 0.9, 2.8)));
      h.wheel.put(cyl(C, P, wx, wy, 2.5, 2.8, 5, 36));
      h.knurl.setAttribute("d", knurlOf(wx, wy, 2.5, 3.1, 4.7, 30, ph));
      h.wheelCap.put(cyl(C, P, wx, wy, 1, 5, 5.5, 16));
      h.axle.setAttribute("d", seg(P(wx - Math.cos(ph) * 0.7, wy - Math.sin(ph) * 0.7, 5.5), P(wx + Math.cos(ph) * 0.7, wy + Math.sin(ph) * 0.7, 5.5)));
    }

    // back to front along the beam: the stock left of the lo head, the lo head, the span, the hi head, the rest
    const pieces: Piece[] = [layer(0)];
    const lowHead = head(-1);
    pieces.push(layer(1));
    const highHead = head(1);
    pieces.push(layer(2));
    g.appendChild(lowHead.near);
    g.appendChild(highHead.near);
    drawScale();

    const piece = (pc: Piece, x0: number, x1: number, rl: number, rr: number) => {
      if (x1 - x0 < 0.05) { pc.body.g.style.display = "none"; pc.over.style.display = "none"; return; }
      pc.body.g.style.display = ""; pc.over.style.display = "";
      pc.body.put(loft(C, P, rring(x0, -BW, x1, BW, rl, rr), Z0, ZT));
      pc.clip.setAttribute("d", flat(P, rring(x0, -BW, x1, BW, rl, rr), ZT));
    };

    const spL = spring(xOf(lo), { k: 260, c: 30, eps: 0.02 }), spH = spring(xOf(hi), { k: 260, c: 30, eps: 0.02 });
    function draw(xl: number, xh: number) {
      xh = Math.max(xh, xl);
      piece(pieces[0], -BL, xl - HL + 0.5, 1.6, 0);
      piece(pieces[1], xl, xh, 0, 0);
      piece(pieces[2], xh + HL, BL, 0, 1.6);
      drawHead(lowHead, xl);
      drawHead(highHead, xh);
      for (const ov of overs) ov.lit.setAttribute("d", xh - xl > 0.2 ? seg(P(xl, -2.6, ZT), P(xh, -2.6, ZT)) : "");
      shades[0].setAttribute("d", flat(P, rrect(xl - HL, HY0 - 3, xl, HY1 + 6, 3), 0));
      shades[1].setAttribute("d", flat(P, rrect(xh, HY0 - 3, xh + HL, HY1 + 6, 3), 0));
    }

    const B = register(host, (dt) => {
      spL.t = xOf(lo); spH.t = xOf(hi);
      const m = stepS(spL, dt) || false;
      const n = stepS(spH, dt);
      draw(spL.x, spH.x);
      return m || n;
    });
    bag.add(B.unregister);

    /* ───── pointer: grab a head, press the beam, or drag the lit span ───── */

    host.setAttribute("data-knurl-hit", "");
    type Drag = { mode: "lo" | "hi" | "span" | "pending"; off: number; v0: number; a0: number; b0: number; x0: number };
    let drag: Drag | null = null;
    const at = (e: PointerEvent) => { const [sx, sy] = toView(svg, e, VW, VH); return unproj(C, sx, sy, ZT); };
    const follow = (on: boolean) => { for (const s of [spL, spH]) { s.k = on ? 900 : 260; s.c = on ? 60 : 30; } };
    const move = (which: "lo" | "hi", v: number) => set(which === "lo" ? fix(Math.min(v, hi), hi, "lo") : fix(lo, Math.max(v, lo), "hi"));
    const nearer = (v: number): "lo" | "hi" => (v < lo ? "lo" : v > hi ? "hi" : v - lo <= hi - v ? "lo" : "hi");
    const shiftBy = (dv: number) => {
      if (!drag) return;
      let d = step > 0 ? Math.round(dv / step) * step : dv;
      d = Math.max(min - drag.a0, Math.min(max - drag.b0, d));
      set([snap(drag.a0 + d, min, max, step), snap(drag.b0 + d, min, max, step)]);
    };
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0) return;
      const [x] = at(e), v = vOf(x), xl = xOf(lo), xh = xOf(hi);
      host.setPointerCapture?.(e.pointerId);
      follow(true);
      const base = { v0: v, a0: lo, b0: hi, x0: x, off: 0 };
      if (x <= xl && x >= xl - HL) drag = { ...base, mode: "lo", off: lo - v };
      else if (x >= xh && x <= xh + HL) drag = { ...base, mode: "hi", off: hi - v };
      else if (x > xl + 1 && x < xh - 1) drag = { ...base, mode: "pending" };
      else { const w = nearer(v); drag = { ...base, mode: w }; move(w, v); }
      (drag.mode === "hi" ? inHi : inLo).focus({ preventScroll: true });
      e.preventDefault();
    });
    bag.on(host, "pointermove", (e) => {
      if (!drag) return;
      const [x] = at(e), v = vOf(x);
      if (drag.mode === "pending" && Math.abs(x - drag.x0) > 1) drag.mode = "span";
      if (drag.mode === "span") shiftBy(v - drag.v0);
      else if (drag.mode !== "pending") move(drag.mode, v + drag.off);
    });
    const end = (e: PointerEvent) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.mode === "pending" && e.type === "pointerup") { const w = nearer(d.v0); (w === "hi" ? inHi : inLo).focus({ preventScroll: true }); move(w, d.v0); }
      follow(false);
      commit();
    };
    bag.on(host, "pointerup", end);
    bag.on(host, "pointercancel", end);

    bag.add(() => {
      inLo.remove(); inHi.remove();
      for (const n of ["role", "aria-label", "data-knurl-hit"]) host.removeAttribute(n);
      svg.replaceChildren();
    });

    return {
      update(next) {
        opts = next;
        const before = `${min},${max},${step}`;
        ({ min, max, step, gap } = lim());
        const want = pairOf(next.value) ?? [lo, hi];
        [lo, hi] = fix(want[0], want[1], "hi");
        sync();
        if (`${min},${max},${step}` !== before) drawScale();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
