import { camera, cyl, depth, facing, fit, flat, lighting, poly, proj, rad, rrect, seg, slab, SHADES, type Camera, type Projector, type Vec2, type Vec3 } from "../core/iso";
import { reducedMotion } from "../core/motion";
import { define, keepAttrs, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid } from "../core/stage";

/**
 * Gears — a loading indicator, built as a gear train on a plate.
 *
 * A driver and two followers mesh at their true ratios (24 : 16 : 12 teeth),
 * so the small one turns twice as fast as the big one and every pair turns
 * opposite ways. Spinning eases up to speed and coasts down when it stops.
 * Under reduced motion it holds still and only the lamp blinks.
 *
 * The host carries role="status" and its label.
 */

export type GearsOptions = BaseOptions & {
  /** Whether it turns. Default true. */
  spinning?: boolean;
  /** Driver revolutions per second. Default 0.25. */
  speed?: number;
};

const VW = 200, VH = 150;

type Gear = { cx: number; cy: number; teeth: number; R: number; dir: number; ratio: number; phase: number };

/** A spur gear's outline at angle a: tooth tips and roots with their outward normals. */
function profile(g: Gear, a: number) {
  const pts: { u: number; v: number; nu: number; nv: number }[] = [];
  const addendum = 1.6, dedendum = 1.9, ro = g.R + addendum, rr = g.R - dedendum;
  const n = g.teeth;
  for (let k = 0; k < n; k++) {
    const t0 = a + (k / n) * Math.PI * 2, w = (Math.PI * 2) / n;
    // root, flank up, tip, flank down: four points per tooth
    const at = [[t0, rr], [t0 + w * 0.22, ro], [t0 + w * 0.48, ro], [t0 + w * 0.7, rr]] as const;
    for (const [t, r] of at) pts.push({ u: g.cx + Math.cos(t) * r, v: g.cy + Math.sin(t) * r, nu: Math.cos(t), nv: Math.sin(t) });
  }
  return pts;
}

/** A thin non-convex prism: its visible side faces in four tones, its foot outline, and its lid. */
function prismOf(C: Camera, P: Projector, ring: ReturnType<typeof profile>, z0: number, z1: number) {
  const front = facing(C), light = lighting(C);
  const buckets: string[][] = Array.from({ length: SHADES }, () => []);
  const lo = ring.map((q) => P(q.u, q.v, z0)), hi = ring.map((q) => P(q.u, q.v, z1));
  const sides: string[] = [];
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    // the face's own normal, from the edge direction
    const du = ring[j].u - ring[i].u, dv = ring[j].v - ring[i].v, L = Math.hypot(du, dv) || 1;
    const nu = dv / L, nv = -du / L;
    if (!front(nu, nv)) continue;
    const d = poly([hi[i], hi[j], lo[j], lo[i]]);
    sides.push(d);
    buckets[Math.min(SHADES - 1, Math.floor(light(nu, nv) * SHADES))].push(d);
  }
  return { foot: poly(lo), sides: sides.join(""), shades: buckets.map((b) => b.join("")), lid: poly(hi) };
}

export const gears = define<GearsOptions>({
  id: "gears",
  label: "Loading",
  vw: VW,
  vh: VH,
  width: 140,
  keys: ["spinning", "speed"],
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(45, 36);
    const M = 1.25; // module: pitch radius = M · teeth / 2
    const g1: Gear = { cx: -9, cy: -3, teeth: 24, R: (M * 24) / 2, dir: 1, ratio: 1, phase: 0 };
    const g2: Gear = { cx: 0, cy: 0, teeth: 16, R: (M * 16) / 2, dir: -1, ratio: 24 / 16, phase: 0 };
    const g3: Gear = { cx: 0, cy: 0, teeth: 12, R: (M * 12) / 2, dir: 1, ratio: 24 / 12, phase: 0 };
    // place the followers on their pitch circles: g2 down-right of g1, g3 off g2
    const d12 = g1.R + g2.R, a12 = rad(20);
    g2.cx = g1.cx + Math.cos(a12) * d12; g2.cy = g1.cy + Math.sin(a12) * d12;
    const d23 = g2.R + g3.R, a23 = rad(115);
    g3.cx = g2.cx + Math.cos(a23) * d23; g3.cy = g2.cy + Math.sin(a23) * d23;
    // mesh phase: a follower's tooth sits in the driver's gap on the line of centres
    const mesh = (a: Gear, b: Gear, ang: number) => { b.phase = ang + Math.PI - (b.teeth / a.teeth) * (a.phase - ang) + Math.PI / b.teeth * 0.94; };
    mesh(g1, g2, a12);
    mesh(g2, g3, a23);
    const all = [g1, g2, g3];
    // centre the train, and size the plate round it
    const bx0 = Math.min(...all.map((q) => q.cx - q.R)), bx1 = Math.max(...all.map((q) => q.cx + q.R));
    const by0 = Math.min(...all.map((q) => q.cy - q.R)), by1 = Math.max(...all.map((q) => q.cy + q.R));
    const mx = (bx0 + bx1) / 2, my = (by0 + by1) / 2;
    for (const q of all) { q.cx -= mx; q.cy -= my; }

    const PX0 = -(bx1 - bx0) / 2 - 5, PX1 = (bx1 - bx0) / 2 + 5, PY0 = -(by1 - by0) / 2 - 5, PY1 = (by1 - by0) / 2 + 7, PZ = 4, GZ = PZ + 3, GT = 2.4;
    const ext: Vec3[] = [[PX0, PY0, 0], [PX1, PY1, 0], [PX0, PY1, 0], [PX1, PY0, 0], [PX0, PY0, GZ + GT + 2], [PX1, PY0, GZ + GT + 2]];
    fit(C, ext, VW / 2, VH / 2 + 2, VW - 16, VH - 14);
    const P = proj(C);
    const g = mk("g", {}, svg);
    shadow(g, flat(P, rrect(PX0, PY0 + 3, PX1, PY1 + 3, 5), 0));
    solid(g).put(slab(C, P, PX0, PY0, PX1, PY1, 5, 0, PZ));
    line(g, "lo").setAttribute("d", flat(P, rrect(PX0 + 2, PY0 + 2, PX1 - 2, PY1 - 2, 3), PZ));
    // the lamp: on while turning
    const lamp = mk("path", { class: "k-led", d: flat(P, rrect(PX1 - 9, PY1 - 6, PX1 - 4, PY1 - 3, 1.2), PZ + 0.01) }, g);

    // standoffs (axles under the gears) and the gears, painted back to front
    const order = all.slice().sort((a, b) => depth(C, a.cx, a.cy, 0) - depth(C, b.cx, b.cy, 0));
    const els = order.map((gr) => {
      solid(g).put(cyl(C, P, gr.cx, gr.cy, 3.2, PZ, GZ, 24));
      const grp = mk("g", { class: "k-solid" }, g);
      return {
        gr,
        foot: mk("path", { class: "k-fill" }, grp),
        sides: mk("path", { class: "k-fill" }, grp),
        sh: [0, 1, 2, 3].map((i) => mk("path", { class: "k-shade", "data-s": i }, grp)),
        sidesEdge: mk("path", { class: "k-line lo" }, grp),
        lid: mk("path", { class: "k-fill" }, grp),
        lidTop: mk("path", { class: "k-top" }, grp),
        lidEdge: mk("path", { class: "k-edge" }, grp),
        details: mk("path", { class: "k-line lo" }, grp),
        hub: null as SVGGElement | null,
      };
    });
    els.forEach((e) => {
      const hubG = mk("g", {}, e.lidEdge.parentElement!);
      e.hub = hubG;
    });
    // the axle caps: drawn after each gear so they sit on top
    const caps = els.map((e) => {
      const s = solid(e.hub!);
      s.put(cyl(C, P, e.gr.cx, e.gr.cy, 2, GZ + GT, GZ + GT + 1.4, 20));
      return s;
    });
    caps[order.indexOf(g1)].lit(true);

    let angle = 0, vel = 0;
    const target = () => (opts.spinning === false ? 0 : Math.PI * 2 * (typeof opts.speed === "number" ? opts.speed : 0.25));
    function draw() {
      for (const e of els) {
        const a = e.gr.phase + e.gr.dir * e.gr.ratio * angle;
        const p = prismOf(C, P, profile(e.gr, a), GZ, GZ + GT);
        e.foot.setAttribute("d", p.foot);
        e.sides.setAttribute("d", p.sides);
        e.sh.forEach((s, i) => s.setAttribute("d", p.shades[i]));
        e.sidesEdge.setAttribute("d", p.sides);
        e.lid.setAttribute("d", p.lid);
        e.lidTop.setAttribute("d", p.lid);
        e.lidEdge.setAttribute("d", p.lid);
        // spokes or holes: lightening holes as rings on the bigger gears, a keyway line on all
        const parts: string[] = [];
        const zt = GZ + GT;
        if (e.gr.teeth >= 16) {
          const nh = e.gr.teeth >= 24 ? 5 : 4, rh = e.gr.R * 0.5, hr = e.gr.R * 0.18;
          for (let k = 0; k < nh; k++) {
            const t = a + (k / nh) * Math.PI * 2;
            const cx = e.gr.cx + Math.cos(t) * rh, cy = e.gr.cy + Math.sin(t) * rh;
            parts.push(poly(Array.from({ length: 16 }, (_, j): Vec2 => P(cx + Math.cos((j / 16) * Math.PI * 2) * hr, cy + Math.sin((j / 16) * Math.PI * 2) * hr, zt))));
          }
        }
        parts.push(poly(Array.from({ length: 24 }, (_, j): Vec2 => P(e.gr.cx + Math.cos((j / 24) * Math.PI * 2) * (e.gr.R - 3.4), e.gr.cy + Math.sin((j / 24) * Math.PI * 2) * (e.gr.R - 3.4), zt))));
        e.details.setAttribute("d", parts.join(""));
      }
    }

    const B = register(host, (dt) => {
      const want = reducedMotion() ? 0 : target();
      // ease toward speed: 0.6s to come up, a longer coast down
      const tau = want > vel ? 0.35 : 0.8;
      vel += (want - vel) * (1 - Math.exp(-dt / tau));
      if (Math.abs(vel - want) < 0.002) vel = want;
      angle += vel * dt;
      draw();
      lamp.classList.toggle("on", opts.spinning !== false);
      return vel !== 0 || want !== 0;
    });
    bag.add(B.unregister);

    const restore = keepAttrs(host, ["role", "aria-label", "aria-busy"]);
    const sync = () => {
      host.setAttribute("role", "status");
      host.setAttribute("aria-label", opts.label ?? "Loading");
      host.setAttribute("aria-busy", opts.spinning === false ? "false" : "true");
    };
    sync();
    void seg;

    bag.add(() => { restore(); svg.replaceChildren(); });
    return {
      update(next) { opts = next; sync(); B.wake(); },
      destroy: bag.dispose,
    };
  },
});
