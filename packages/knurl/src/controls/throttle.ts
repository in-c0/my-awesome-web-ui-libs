import { bar, camera, circle, cyl, fit, flat, open, planeMatrix, poly, poly3, prism3, proj, rad, rrect, seg, slab, type Rot, type SolidPaths, type Vec2, type Vec3 } from "../core/iso";
import { reducedMotion, spring, stepS } from "../core/motion";
import { define, num } from "../core/control";
import { range, RANGE_KEYS, type RangeOptions } from "../core/range";
import { disposer, line, mk, register, shadow, solid, toView } from "../core/stage";

/**
 * Throttle — a vertical slider with detents, built as a throttle quadrant.
 *
 * A curved quadrant housing on a screwed base carries a lever on a pivot
 * inside it: the lever comes up through a gate slot cut along the arc and
 * ends in a grip ball. A scale is engraved beside the gate, and each detent
 * is a notch cut into the gate's side; the lever clicks into a notch when it
 * comes near, with a small overshoot, and that notch's mark lights. The gate
 * is lit from idle up to the lever. The pivot hub and a friction-lock knob
 * sit on the housing's side. Forward (away from you) is more.
 *
 * A press anywhere moves the lever there and a drag carries it; it follows a
 * hand closely and travels with a little overshoot after a key or a click.
 * Hovering with a mouse leans it a degree or two toward where a click would
 * send it.
 *
 * Semantics come from a visually hidden `<input type="range">` with
 * `aria-orientation="vertical"`.
 */

export type ThrottleOptions = RangeOptions & {
  /** Values the lever clicks into, each a notch in the gate. Values off the step grid snap to it. */
  notches?: number[];
};

const VW = 200, VH = 200;
const A = 30;     // degrees the lever swings each way from upright
const SNAP = 0.04; // a notch catches the lever within this share of the range
const N = 200;    // samples along the lever's path for the pointer

export const throttle = define<ThrottleOptions>({
  id: "throttle",
  label: "Throttle",
  vw: VW,
  vh: VH,
  width: 170,
  keys: [...RANGE_KEYS, "notches"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    const C = camera(36, 48);
    const PX = 19, PY = 21, PZ = 3;                 // base plate
    const HX = 8, ZP = PZ + 4, RQ = 20, PHI = A + 10; // housing half-width, pivot height, arc radius, arc half-angle
    const RL = RQ + 15, RB = 3.6;                   // the ball's centre from the pivot, and its radius
    const SW = 1.3;                                 // gate half-width
    const dir = (deg: number): Vec3 => [0, -Math.sin(rad(deg)), Math.cos(rad(deg))];
    const on = (deg: number, r: number, x = 0): Vec3 => { const d = dir(deg); return [x, d[1] * r, ZP + d[2] * r]; };
    const ext: Vec3[] = [[-PX, -PY, 0], [PX, PY, 0], [-PX, PY, 0], [PX, -PY, 0], on(-A, RL + RB), on(A, RL + RB), on(0, RL + RB)];
    fit(C, ext, VW / 2, VH / 2 + 2, VW - 20, VH - 16);
    const P = proj(C);
    const at = (w: Vec3) => P(w[0], w[1], w[2]);

    const g = mk("g", {}, svg);
    // the base plate on four screws
    shadow(g, flat(P, rrect(-PX, -PY + 3, PX, PY + 3, 4), 0));
    solid(g).put(slab(C, P, -PX, -PY, PX, PY, 4, 0, PZ));
    line(g, "lo").setAttribute("d", flat(P, rrect(-PX + 2, -PY + 2, PX - 2, PY - 2, 2.6), PZ));
    const slots: string[] = [];
    for (const [x, y] of [[-PX + 4.2, -PY + 4.2], [PX - 4.2, -PY + 4.2], [-PX + 4.2, PY - 4.2], [PX - 4.2, PY - 4.2]]) {
      solid(g).put(cyl(C, P, x, y, 1.9, PZ, PZ + 0.6, 20));
      const a = rad(x * y > 0 ? 35 : -20);
      slots.push(seg(P(x - Math.cos(a) * 1.35, y - Math.sin(a) * 1.35, PZ + 0.6), P(x + Math.cos(a) * 1.35, y + Math.sin(a) * 1.35, PZ + 0.6)));
    }
    line(g, "edge").setAttribute("d", slots.join(""));

    // the quadrant: an arc-topped profile in y–z, extruded across x
    const K = 14, aE = RQ * Math.sin(rad(PHI)), bE = ZP + RQ * Math.cos(rad(PHI));
    const ring: Vec2[] = [[-aE, PZ], [aE, PZ], [aE, bE]];
    for (let k = 1; k < K; k++) { const f = -PHI + (2 * PHI * k) / K; ring.push([-RQ * Math.sin(rad(f)), ZP + RQ * Math.cos(rad(f))]); }
    ring.push([-aE, bE]);
    const R: Rot = [[0, 1, 0], [0, 0, 1], [1, 0, 0]]; // profile x → world y, profile y → world z, extrusion → world x
    const q = prism3([0, 0, 0], ring, HX, R);
    solid(g).put(poly3(C, P, q.verts, q.faces));
    // the cover's chamfer lines along the arc, and the seam where it meets the cheeks
    const arc = (r: number, x: number, f0 = -PHI, f1 = PHI, n = 48) => Array.from({ length: n + 1 }, (_, k) => at(on(f0 + ((f1 - f0) * k) / n, r, x)));
    line(g, "lo").setAttribute("d", open(arc(RQ, -HX + 1.2)) + open(arc(RQ, HX - 1.2)));
    line(g, "lo").setAttribute("d", seg(P(HX, -aE + 1.4, PZ + 1.4), P(HX, aE - 1.4, PZ + 1.4)));

    // on the near face, a placard on two screws
    {
      const y = aE, zc = (PZ + bE) / 2, w = HX - 2.2, h = 3.6;
      mk("path", { class: "k-face", d: poly([P(-w, y, zc + h), P(w, y, zc + h), P(w, y, zc - h), P(-w, y, zc - h)]) }, g);
      const dots: string[] = [];
      for (const x of [-w + 1.5, w - 1.5]) dots.push(poly(circle(0, 0, 0.75, 14).map((q) => P(x + q.u, y, zc + q.v))));
      line(g, "edge").setAttribute("d", dots.join(""));
      const t = mk("text", { class: "k-text", "text-anchor": "middle" }, g) as SVGTextElement;
      t.textContent = "THR";
      t.style.fontSize = "3px";
      t.setAttribute("transform", planeMatrix(P, [0, y, zc], [1, 0, 0], [0, 0, -1]) + " translate(0 1.05)");
      line(g, "lo").setAttribute("d", seg(P(-w + 3, y, zc - 2.4), P(w - 3, y, zc - 2.4)));
    }

    // on the near cheek: the pivot hub and its screw, and the friction-lock knob with its knurl
    const boss = (a: Vec3, b: Vec3, r0: number, r1: number) => {
      const s = bar(P, a, b, r0, r1, 28);
      const pg = mk("g", { class: "k-solid" }, g);
      mk("path", { class: "k-fill", d: s.sil }, pg);
      mk("path", { class: "k-edge", d: s.sil }, pg);
      mk("path", { class: "k-top", d: s.cap }, pg);
      mk("path", { class: "k-crease", d: s.cap }, pg);
      return s;
    };
    boss([HX, 0, ZP], [HX + 1.2, 0, ZP], 3.4, 3.4);
    boss([HX + 1.2, 0, ZP], [HX + 1.8, 0, ZP], 1.7, 1.7);
    line(g, "edge").setAttribute("d", seg(P(HX + 1.8, -1.1, ZP + 0.4), P(HX + 1.8, 1.1, ZP - 0.4)));
    const FY = aE - 5, FZ = PZ + 5.4;
    boss([HX, FY, FZ], [HX + 1, FY, FZ], 1.4, 1.4);
    boss([HX + 1, FY, FZ], [HX + 3.6, FY, FZ], 2.6, 2.6);
    const knurl: string[] = [];
    for (let k = 0; k < 12; k++) {
      const t = (k / 12) * Math.PI * 2, cy = Math.cos(t) * 2.6, cz = Math.sin(t) * 2.6;
      // the ridges on the half that faces the viewer
      if (cy * Math.cos(rad(36)) * Math.cos(rad(48)) + cz * Math.sin(rad(48)) < 0.3) continue;
      knurl.push(seg(P(HX + 1.4, FY + cy, FZ + cz), P(HX + 3.3, FY + cy, FZ + cz)));
    }
    line(g, "lo").setAttribute("d", knurl.join(""));

    // the gate: the slot, the notches cut into its far side, the scale and legends on its near side
    const f0 = -A - 3, f1 = A + 3;
    mk("path", { class: "k-slot", d: poly([...arc(RQ, -SW, f0, f1), ...arc(RQ, SW, f0, f1).reverse()]) }, g);
    const scale = mk("g", {}, g);
    const lit = line(g, "accent");

    // the lever: a boot where it leaves the gate, the rod, and the grip ball
    const leverG = mk("g", {}, g);
    const part = () => {
      const pg = mk("g", { class: "k-solid" }, leverG);
      return { fill: mk("path", { class: "k-fill" }, pg), edge: mk("path", { class: "k-edge" }, pg), top: mk("path", { class: "k-top" }, pg), cr: mk("path", { class: "k-crease" }, pg) };
    };
    const boot = part(), rod = part(), band = part();
    const ball = solid(leverG);
    const putBar = (p: ReturnType<typeof part>, a: Vec3, b: Vec3, r0: number, r1: number) => {
      const s = bar(P, a, b, r0, r1, 28);
      p.fill.setAttribute("d", s.sil); p.edge.setAttribute("d", s.sil); p.top.setAttribute("d", s.cap); p.cr.setAttribute("d", s.cap);
    };
    const S = C.S;
    function drawLever(deg: number) {
      putBar(boot, on(deg, RQ - 0.4), on(deg, RQ + 1.6), 2.2, 1.8);
      putBar(rod, on(deg, RQ + 1.6), on(deg, RL - RB + 0.6), 1.15, 1.35);
      putBar(band, on(deg, RL - RB - 1.2), on(deg, RL - RB + 0.4), 1.7, 1.7);
      // an orthographic ball is a circle on screen: the outline, a lit cap toward the light and a shaded crescent away from it
      const c = at(on(deg, RL)), r = RB * S;
      const pts = (cx: number, cy: number, rr: number, a0 = 0, a1 = 360, n = 40) => Array.from({ length: n + 1 }, (_, k): Vec2 => {
        const t = rad(a0 + ((a1 - a0) * k) / n);
        return [cx + Math.cos(t) * rr, cy + Math.sin(t) * rr];
      });
      const sil = poly(pts(c[0], c[1], r).slice(0, -1));
      const shade = poly([...pts(c[0], c[1], r, -30, 150, 24), ...pts(c[0] - r * 0.22, c[1] - r * 0.22, r * 0.86, 150, -30, 24)]);
      const top = poly(pts(c[0] - r * 0.3, c[1] - r * 0.34, r * 0.42).slice(0, -1));
      const crease = open(pts(c[0], c[1], r * 0.7, 195, 265, 12));
      const sp: SolidPaths = { sil, shades: [shade, "", "", ""], top, crease };
      ball.put(sp);
    }

    const r = range(ctx, o, "range", "Throttle", () => B.wake());
    r.input.setAttribute("aria-orientation", "vertical");
    let opts = o;
    const degOf = (t: number) => -A + 2 * A * t;
    const notches = () => {
      const src = Array.isArray(opts.notches) ? opts.notches : [];
      return src.map((v) => num(v, NaN)).filter((v) => Number.isFinite(v) && v >= r.min && v <= r.max);
    };
    let marks: { v: number; tick: SVGPathElement }[] = [];
    function drawScale() {
      scale.replaceChildren();
      const ns = notches(), span = r.max - r.min || 1;
      const minor: string[] = [];
      for (let k = 0; k <= 10; k++) {
        const f = degOf(k / 10);
        if (ns.some((v) => Math.abs((v - r.min) / span - k / 10) < 0.02)) continue;
        minor.push(seg(at(on(f, RQ, SW + 1.1)), at(on(f, RQ, SW + (k % 5 === 0 ? 3.2 : 2.2)))));
      }
      line(scale, "edge").setAttribute("d", minor.join(""));
      marks = ns.map((v) => {
        const f = degOf((v - r.min) / span), h = 1.7;
        mk("path", { class: "k-slot", d: poly([at(on(f - h, RQ, -SW + 0.1)), at(on(f - h, RQ, -SW - 2)), at(on(f + h, RQ, -SW - 2)), at(on(f + h, RQ, -SW + 0.1))]) }, scale);
        const tick = line(scale, "hi");
        tick.setAttribute("d", seg(at(on(f, RQ, SW + 1.1)), at(on(f, RQ, SW + 3.6))));
        const s = String(Math.round(v * 100) / 100);
        if (s.length <= 3) {
          const t = mk("text", { class: "k-text" }, scale) as SVGTextElement;
          t.textContent = s;
          t.style.fontSize = "2.4px";
          const v3: Vec3 = [0, Math.cos(rad(f)), Math.sin(rad(f))];
          t.setAttribute("transform", planeMatrix(P, on(f, RQ, SW + 4.3), [1, 0, 0], v3) + " translate(0 0.85)");
        }
        return { v, tick };
      });
      showNotch();
    }
    const engaged = () => marks.find((m) => Math.abs(m.v - r.value) < 1e-9);
    function showNotch() {
      const e = engaged();
      for (const m of marks) m.tick.setAttribute("class", m === e ? "k-line accent" : "k-line hi");
    }
    drawScale();

    // the lever's angle on a spring: it clicks into a notch, follows a hand, and travels after a key
    let drag = false, lean = 0;
    const sp = spring(degOf(r.t), { k: 300, c: 16, eps: 0.02 });
    let drawn = NaN;
    const B = register(host, (dt) => {
      const notch = !!engaged();
      if (notch) { sp.k = 420; sp.c = 16; } else if (drag) { sp.k = 900; sp.c = 60; } else { sp.k = 300; sp.c = 16; }
      sp.t = degOf(r.t) + lean;
      const m = stepS(sp, dt);
      const deg = Math.max(-A - 2.5, Math.min(A + 2.5, sp.x));
      if (deg !== drawn) {
        drawn = deg;
        drawLever(deg);
        lit.setAttribute("d", deg > -A + 0.3 ? open(arc(RQ + 0.02, 0, -A, deg, 40)) : "");
      }
      return m;
    });
    bag.add(B.unregister);
    if (reducedMotion()) drawLever(sp.t);

    // pointer: the point on the lever's path, or on the gate, nearest the pointer is the value
    let path: Vec2[][] = [];
    const sample = () => {
      path = [RL, RQ].map((rr) => Array.from({ length: N + 1 }, (_, k) => at(on(degOf(k / N), rr))));
    };
    sample();
    const tAt = (e: PointerEvent) => {
      const qv = toView(svg, e, VW, VH);
      let best = 0, d = 1e9;
      for (const pts of path) pts.forEach((p, k) => { const dk = (p[0] - qv[0]) ** 2 + (p[1] - qv[1]) ** 2; if (dk < d) { d = dk; best = k; } });
      return best / N;
    };
    const valueAt = (t: number) => {
      const v = r.min + t * (r.max - r.min), span = r.max - r.min;
      let near: number | null = null, d = SNAP * span;
      for (const n of notches()) { const dn = Math.abs(n - v); if (dn <= d) { d = dn; near = n; } }
      return near ?? v;
    };
    const ask = (v: number) => { r.ask(v); showNotch(); B.wake(); };
    host.setAttribute("data-knurl-hit", "");
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0) return;
      drag = true; lean = 0;
      host.setPointerCapture?.(e.pointerId);
      r.input.focus({ preventScroll: true });
      ask(valueAt(tAt(e)));
      e.preventDefault();
    });
    bag.on(host, "pointermove", (e) => {
      if (drag) { ask(valueAt(tAt(e))); return; }
      if (e.pointerType !== "mouse" || opts.disabled) return;
      // hover: lean a little toward where a click here would send it
      const want = (valueAt(tAt(e)) - r.min) / (r.max - r.min || 1) - r.t;
      const l = Math.abs(want) < 0.01 ? 0 : Math.sign(want) * Math.min(2.4, Math.abs(want) * 2 * A * 0.3);
      if (l !== lean) { lean = l; B.wake(); }
    });
    const end = () => { if (!drag) return; drag = false; r.commit(); B.wake(); };
    bag.on(host, "pointerup", end);
    bag.on(host, "pointercancel", end);
    bag.on(host, "pointerleave", () => { if (lean) { lean = 0; B.wake(); } });
    bag.on(r.input, "input", () => { showNotch(); B.wake(); });

    bag.add(() => { r.destroy(); host.removeAttribute("data-knurl-hit"); svg.replaceChildren(); });
    return {
      update(next, prev) {
        opts = next;
        const before = `${r.min},${r.max},${r.step}`;
        r.update(next);
        if (`${r.min},${r.max},${r.step}` !== before || JSON.stringify(next.notches) !== JSON.stringify(prev.notches)) drawScale();
        else showNotch();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
