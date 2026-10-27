import { add3, camera, circle, cross3, cuboid, cyl, dot3, fit, flat, hull, lighting, loft, planeMatrix, poly, poly3, proj, rad, rot, rrect, scale3, seg, slab, sub3, toViewer, SHADES, type Camera, type Projector, type SolidPaths, type Vec2, type Vec3 } from "../core/iso";
import { spring, stepS } from "../core/motion";
import { define, num, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid } from "../core/stage";

/**
 * Tank — a level meter or progress bar, built as an upright storage tank.
 *
 * A banded shell on a concrete plinth, held down by anchor chairs, with a
 * bolted dome lid; the inlet rises behind it and comes in over the top
 * through a gate valve with a handwheel, and a drain valve stands off the
 * bottom. On the near side a gauge board carries a sight glass between two
 * mounting blocks: the liquid column in it rises and falls to the value on a
 * slow, underdamped spring, so it overshoots a touch and the surface tilts
 * as it sloshes. Graduations run beside the glass, and accent pointers mark
 * the optional low and high thresholds.
 *
 * Not focusable: the host carries role="meter" (or "progressbar") with its
 * aria values.
 */

export type TankOptions = BaseOptions & {
  value?: number;
  min?: number;
  max?: number;
  /** Marks a low threshold on the glass scale. */
  low?: number;
  /** Marks a high threshold on the glass scale. */
  high?: number;
  /** `meter` (default) for a level within a range; `progressbar` for work toward completion. */
  role?: "meter" | "progressbar";
  format?: (value: number) => string;
};

const VW = 180, VH = 250;
let tid = 0;

const norm = (a: Vec3): Vec3 => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };

/** A round bar from a to b with shaded sides and its visible end cap: pipes and bolts in any direction. */
function tube(C: Camera, P: Projector, a: Vec3, b: Vec3, r: number, n = 22): SolidPaths {
  const w = norm(sub3(b, a));
  const u = norm(cross3(w, Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), v = cross3(w, u);
  const V = toViewer(C), light = lighting(C);
  const dir = (t: number): Vec3 => add3(scale3(u, Math.cos(t)), scale3(v, Math.sin(t)));
  const ring = (o: Vec3) => Array.from({ length: n }, (_, k) => { const p = add3(o, scale3(dir((k / n) * Math.PI * 2), r)); return P(p[0], p[1], p[2]); });
  const sa = ring(a), sb = ring(b);
  const buckets: string[][] = Array.from({ length: SHADES }, () => []), tops: string[] = [];
  for (let k = 0; k < n; k++) {
    const m = dir(((k + 0.5) / n) * Math.PI * 2), j = (k + 1) % n;
    if (dot3(m, V) <= 1e-6) continue;
    const d = poly([sa[k], sa[j], sb[j], sb[k]]);
    if (m[2] > 0.6) { tops.push(d); continue; }
    const g = Math.hypot(m[0], m[1]) || 1;
    buckets[Math.min(SHADES - 1, Math.floor(light(m[0] / g, m[1] / g) * SHADES))].push(d);
  }
  const f = dot3(w, V), cap = f > 0.02 ? poly(sb) : f < -0.02 ? poly(sa) : "";
  return { sil: poly(hull(sa.concat(sb))), shades: buckets.map((x) => x.join("")), top: tops.join("") + cap, crease: cap };
}

/** The near half of a ring band round a cylinder (a hoop, a weld bead): its back never shows. */
function band(C: Camera, P: Projector, R: number, z0: number, z1: number, n = 72): SolidPaths {
  const full = loft(C, P, circle(0, 0, R, n), z0, z1), ring = circle(0, 0, R, n), V = toViewer(C);
  const vis = (k: number) => { const a = ring[k], b = ring[(k + 1) % n]; return (a.nu + b.nu) * V[0] + (a.nv + b.nv) * V[1] > 1e-6; };
  let s = 0;
  while (!(vis(s) && !vis((s + n - 1) % n))) s++;
  const run: number[] = [];
  for (let k = 0; k < n && vis((s + k) % n); k++) run.push((s + k) % n);
  run.push((run[run.length - 1] + 1) % n);
  const top = run.map((k) => P(ring[k].u, ring[k].v, z1)), bot = run.map((k) => P(ring[k].u, ring[k].v, z0));
  return { sil: poly(top.concat(bot.reverse())), shades: full.shades, top: "", crease: "" };
}

/** A dome of radius r and rise h on z0: shaded courses up the side, a lit crown, one outline. */
function dome(C: Camera, P: Projector, r: number, h: number, z0: number): SolidPaths {
  const phis = [0, 14, 28, 42, 54].map(rad), pts: Vec2[] = [], shades: string[] = ["", "", "", ""];
  for (let k = 0; k < phis.length - 1; k++) {
    const s = loft(C, P, circle(0, 0, r * Math.cos(phis[k]), 72), z0 + h * Math.sin(phis[k]), z0 + h * Math.sin(phis[k + 1]), circle(0, 0, r * Math.cos(phis[k + 1]), 72));
    s.shades.forEach((d, i) => { shades[i] += d; });
  }
  for (let k = 0; k <= 12; k++) {
    const ph = (k / 12) * (Math.PI / 2);
    for (const q of circle(0, 0, r * Math.cos(ph) + 1e-3, 72)) pts.push(P(q.u, q.v, z0 + h * Math.sin(ph)));
  }
  const crown = phis[phis.length - 1];
  return { sil: poly(hull(pts)), shades, top: flat(P, circle(0, 0, r * Math.cos(crown), 72), z0 + h * Math.sin(crown)), crease: "" };
}

/** "Nice" tick spacing near `raw`: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(raw: number) {
  const e = 10 ** Math.floor(Math.log10(raw)), m = raw / e;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e;
}

export const tank = define<TankOptions>({
  id: "tank",
  label: "Level",
  vw: VW,
  vh: VH,
  width: 150,
  keys: ["value", "min", "max", "low", "high", "role", "format"],
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(45, 30);
    const id = "knurl-t" + ++tid;

    const R = 14, PH = 21, PZ = 3; // shell radius, plinth half-size and height
    const Z0 = PZ + 1.6, ZS = 46, ZF = ZS + 1.4; // shell foot, shell top, flange top
    const RD = R - 0.2, HD = 6.4; // dome radius and rise
    const ZR = ZF + HD + 3.4; // the inlet run
    const IY = 6, IX0 = -18, IX1 = -4, VX = -11; // inlet: riser x, nozzle x, valve x, all at y = IY
    const ZH = ZR + 7.2, RW = 4.2; // handwheel
    const ext: Vec3[] = [[-PH, -PH, 0], [PH, PH, 0], [-PH, PH, 0], [PH, -PH, 0], [VX - RW, IY - RW, ZH + 1], [VX + RW, IY + RW, ZH + 1], [0, 0, ZH]];
    fit(C, ext, VW / 2, VH / 2 + 1, VW - 16, VH - 14);
    const P = proj(C);
    const g = mk("g", {}, svg);
    const put = (s: SolidPaths, parent: Element = g) => { const x = solid(parent); x.put(s); return x; };
    const zDome = (r: number) => ZF + HD * Math.sqrt(Math.max(0, 1 - (r / RD) ** 2));
    const view = toViewer(C);
    const faces = (th: number) => Math.cos(th) * view[0] + Math.sin(th) * view[1];

    // the plinth: a concrete pad, its chamfer, anchor bolts at the corners
    shadow(g, flat(P, rrect(-PH, -PH + 3, PH, PH + 3, 3), 0));
    put(slab(C, P, -PH, -PH, PH, PH, 3, 0, PZ));
    line(g, "lo").setAttribute("d", flat(P, rrect(-PH + 2, -PH + 2, PH - 2, PH - 2, 1.6), PZ));
    const nuts: string[] = [];
    for (const [x, y] of [[-PH + 3.6, -PH + 3.6], [PH - 3.6, -PH + 3.6], [-PH + 3.6, PH - 3.6], [PH - 3.6, PH - 3.6]]) {
      put(loft(C, P, circle(x, y, 1.5, 6, rad(15)), PZ, PZ + 0.8));
      put(cyl(C, P, x, y, 0.6, PZ + 0.8, PZ + 1.5, 14));
      nuts.push(seg(P(x - 0.5, y + 0.2, PZ + 1.5), P(x + 0.5, y - 0.2, PZ + 1.5)));
    }
    line(g, "edge").setAttribute("d", nuts.join(""));

    // the inlet riser behind the tank: floor flange, pipe, a clamp
    put(cyl(C, P, IX0, IY, 2.6, PZ, PZ + 0.8, 28));
    for (let k = 0; k < 4; k++) {
      const a = rad(45 + k * 90), x = IX0 + Math.cos(a) * 1.9, y = IY + Math.sin(a) * 1.9;
      put(cyl(C, P, x, y, 0.35, PZ + 0.8, PZ + 1.2, 10));
    }
    put(cyl(C, P, IX0, IY, 1.3, PZ + 0.8, ZR, 24));
    put(cyl(C, P, IX0, IY, 1.75, 27, 28.4, 24));

    // the base chime, the shell, its hoops and the welded seams of each course
    put(cyl(C, P, 0, 0, R + 0.6, PZ, Z0, 72));
    put(cyl(C, P, 0, 0, R, Z0, ZS, 72));
    const course = (ZS - Z0) / 3;
    const seams: string[] = [];
    const seamAt: number[][] = [[-25, 100], [5, 118], [-32, 88]];
    for (let k = 0; k < 3; k++) {
      const z0 = Z0 + k * course, z1 = z0 + course;
      for (const d of seamAt[k]) {
        const th = rad(d), x = R * Math.cos(th), y = R * Math.sin(th);
        seams.push(seg(P(x, y, z0 + 1.2), P(x, y, z1 - 0.6)));
      }
    }
    line(g, "lo").setAttribute("d", seams.join(""));
    for (let k = 1; k < 3; k++) put(band(C, P, R + 0.35, Z0 + k * course - 0.5, Z0 + k * course + 0.5));

    // anchor chairs round the foot: two gussets and a cap plate with its nut, on the visible side
    const chairs = [-22.5, 22.5, 67.5, 112.5].map(rad).filter((th) => faces(th) > 0.05).sort((a, b) => faces(a) - faces(b));
    for (const th of chairs) {
      const n: Vec3 = [Math.cos(th), Math.sin(th), 0], t: Vec3 = [-Math.sin(th), Math.cos(th), 0];
      const at = (r: number, a: number, z: number): Vec3 => add3(add3(scale3(n, r), scale3(t, a)), [0, 0, z]);
      const Rz = rot("z", th);
      const box = (r0: number, r1: number, a0: number, a1: number, z0: number, z1: number) => {
        const b = cuboid(at((r0 + r1) / 2, (a0 + a1) / 2, (z0 + z1) / 2), (r1 - r0) / 2, (a1 - a0) / 2, (z1 - z0) / 2, Rz);
        return poly3(C, P, b.verts, b.faces);
      };
      // paint the gusset farther from the viewer first
      const side = dot3(t, view) > 0 ? [-1, 1] : [1, -1];
      for (const s of side) put(box(R - 0.3, R + 2.6, s * 1.9 - 0.35, s * 1.9 + 0.35, Z0, Z0 + 4.2));
      put(box(R - 0.3, R + 2.8, -2.5, 2.5, Z0 + 4.2, Z0 + 4.9));
      const c = at(R + 1.5, 0, 0);
      put(loft(C, P, circle(c[0], c[1], 0.85, 6, th), Z0 + 4.9, Z0 + 5.5));
      put(cyl(C, P, c[0], c[1], 0.38, Z0 + 5.5, Z0 + 6.2, 12));
    }

    // the gauge board on the near side: a plate on the shell, two blocks holding the glass, bolts
    const TH = rad(40), n: Vec3 = [Math.cos(TH), Math.sin(TH), 0], u: Vec3 = [Math.sin(TH), -Math.cos(TH), 0];
    const at = (r: number, a: number, z: number): Vec3 => add3(add3(scale3(n, r), scale3(u, a)), [0, 0, z]);
    const RZ = rot("z", TH);
    const box = (r0: number, r1: number, a0: number, a1: number, z0: number, z1: number) => {
      const b = cuboid(at((r0 + r1) / 2, (a0 + a1) / 2, (z0 + z1) / 2), (r1 - r0) / 2, (a1 - a0) / 2, (z1 - z0) / 2, RZ);
      return poly3(C, P, b.verts, b.faces);
    };
    const RF = R + 0.8; // the board's face
    const BZ0 = 12.2, BZ1 = 42.4, WZ0 = 15.2, WZ1 = 39.4; // board and window heights
    const WA0 = -4.6, WA1 = -1.4; // window across the board
    put(box(R - 2.4, RF, -7, 7, BZ0, BZ1));
    const bolt = (a: number, z: number, r0: number, len = 0.45, rr = 0.55) => {
      put(tube(C, P, at(r0, a, z), at(r0 + len, a, z), rr, 14));
    };
    for (const z of [BZ0 + 1.3, BZ1 - 1.3]) for (const a of [-6, 6]) bolt(a, z, RF);

    // the window: the glass's slot, the liquid column clipped to it, the scale beside it
    const WW = WA1 - WA0, WH = WZ1 - WZ0;
    const plane = mk("g", { transform: planeMatrix(P, at(RF, WA0, WZ1), u, [0, 0, -1]) }, g);
    mk("path", { class: "k-slot", d: `M0 0H${WW}V${WH}H0Z` }, plane);
    const defs = mk("defs", {}, plane);
    const clip = mk("clipPath", { id }, defs);
    mk("rect", { x: 0.3, y: 0, width: WW - 0.6, height: WH }, clip);
    const glass = mk("g", { "clip-path": `url(#${id})` }, plane);
    const liquid = mk("path", { class: "k-dot lo" }, glass);
    const surface = mk("path", { class: "k-line mid" }, glass);
    // the glass tube's highlight, over the liquid
    mk("path", { class: "k-line lo", d: `M${WW * 0.28} 0.8V${WH - 0.8}M${WW * 0.78} 0.8V${WH - 0.8}` }, glass);
    const meniscus = mk("path", { class: "k-line accent" }, plane);
    const scale = mk("g", {}, plane);
    const minor = mk("path", { class: "k-line mid" }, scale);
    const major = mk("path", { class: "k-line hi" }, scale);
    const marks = mk("path", { class: "k-led on" }, scale);
    const lbTop = mk("text", { class: "k-text", x: WW + 2.9, y: 0.8 }, scale) as SVGTextElement;
    const lbBot = mk("text", { class: "k-text", x: WW + 2.9, y: WH + 0.8 }, scale) as SVGTextElement;
    lbTop.style.fontSize = lbBot.style.fontSize = "2.2px";

    // the mounting blocks over the glass ends, each with two bolts
    for (const [z0, z1] of [[WZ0 - 2.8, WZ0 + 0.2], [WZ1 - 0.2, WZ1 + 2.8]]) {
      put(box(RF - 0.2, RF + 1.6, WA0 - 1.1, WA1 + 1.1, z0, z1));
      for (const a of [WA0 - 0.1, WA1 + 0.1]) bolt(a, (z0 + z1) / 2, RF + 1.6, 0.4, 0.5);
    }

    // the drain: a nozzle, a flanged joint, a ball valve with its lever, a cap
    {
      const th = rad(-6), dn: Vec3 = [Math.cos(th), Math.sin(th), 0], zo = Z0 + 7.2;
      const q = (r: number, z = zo): Vec3 => add3(scale3(dn, r), [0, 0, z]);
      put(tube(C, P, q(R - 0.5), q(R + 2.2), 1.4));
      put(tube(C, P, q(R + 2.2), q(R + 2.9), 2.7, 28));
      put(tube(C, P, q(R + 2.9), q(R + 3.6), 2.7, 28));
      put(tube(C, P, q(R + 3.6), q(R + 4.4), 1.4));
      put(tube(C, P, q(R + 4.4), q(R + 7.6), 2.1, 26));
      put(tube(C, P, q(R + 7.6), q(R + 9.4), 1.2));
      put(tube(C, P, q(R + 9.4), q(R + 10.2), 1.55));
      const sc = q(R + 6, zo);
      put(cyl(C, P, sc[0], sc[1], 0.7, zo + 1.8, zo + 3.1, 14));
      // the lever lies along the pipe: the valve is open
      const lv = cuboid(q(R + 8.2, zo + 3.45), 3.4, 0.55, 0.3, rot("z", th));
      put(poly3(C, P, lv.verts, lv.faces));
    }

    // the flange ring, its back bolts, the dome, its front bolts
    put(cyl(C, P, 0, 0, R + 1.2, ZS, ZF, 72));
    const lidBolts = Array.from({ length: 28 }, (_, k) => rad(k * (360 / 28) + 6));
    const lidBolt = (th: number) => put(cyl(C, P, (R + 0.55) * Math.cos(th), (R + 0.55) * Math.sin(th), 0.42, ZF, ZF + 0.5, 10));
    lidBolts.filter((th) => faces(th) <= 0).forEach(lidBolt);
    put(dome(C, P, RD, HD, ZF));
    // the knuckle weld where the dome turns, on its near side
    {
      const ph = rad(30), ring = circle(0, 0, RD * Math.cos(ph), 72, rad(225)).filter((q) => q.nu * view[0] + q.nv * view[1] > 0.12);
      line(g, "lo").setAttribute("d", "M" + ring.map((q) => P(q.u, q.v, ZF + HD * Math.sin(ph)).map((c) => c.toFixed(2)).join(" ")).join("L"));
    }
    // a manway on the crown: a collar, its cover and a ring of bolts
    {
      const x = 2.6, y = 1.4, z = zDome(Math.hypot(x, y) + 3);
      put(cyl(C, P, x, y, 3.2, z - 0.8, z + 0.9, 40));
      put(cyl(C, P, x, y, 3.6, z + 0.9, z + 1.5, 40));
      const mb = Array.from({ length: 8 }, (_, k) => rad(k * 45 + 22.5)).sort((a, b) => faces(a) - faces(b));
      for (const th of mb) put(cyl(C, P, x + 3.05 * Math.cos(th), y + 3.05 * Math.sin(th), 0.32, z + 1.5, z + 1.9, 10));
      put(tube(C, P, [x - 1.3, y + 1.3, z + 1.9], [x + 1.3, y - 1.3, z + 1.9], 0.3, 10));
    }
    lidBolts.filter((th) => faces(th) > 0).sort((a, b) => faces(a) - faces(b)).forEach(lidBolt);

    // a breather vent on the dome
    {
      const x = 5, y = -6.4, z = zDome(Math.hypot(x, y));
      put(cyl(C, P, x, y, 1.6, z - 0.6, z + 0.5, 24));
      put(cyl(C, P, x, y, 0.8, z + 0.5, z + 2.6, 18));
      put(loft(C, P, circle(x, y, 2.2, 28), z + 2.6, z + 3.5, circle(x, y, 1.3, 28)));
    }

    // the inlet over the top: elbow, pipe, flanged gate valve, pipe, elbow, nozzle into the dome
    const ax = (x: number): Vec3 => [x, IY, ZR];
    put(cyl(C, P, IX0, IY, 1.7, ZR - 1.7, ZR + 1.6, 24));
    put(tube(C, P, ax(IX0 + 1.5), ax(VX - 3.6), 1.3));
    put(tube(C, P, ax(VX - 3.6), ax(VX - 2.9), 2.5, 28));
    put(tube(C, P, ax(VX - 2.9), ax(VX + 2.9), 2.0, 26));
    put(tube(C, P, ax(VX + 2.9), ax(VX + 3.6), 2.5, 28));
    put(tube(C, P, ax(VX + 3.6), ax(IX1 - 1.5), 1.3));
    {
      const r = Math.hypot(IX1, IY), z = zDome(r);
      put(cyl(C, P, IX1, IY, 2.6, z - 0.8, z + 0.6, 28));
      put(cyl(C, P, IX1, IY, 1.3, z + 0.6, ZR - 1.7, 24));
      put(cyl(C, P, IX1, IY, 1.7, ZR - 1.7, ZR + 1.6, 24));
    }
    // bonnet, gland, stem
    put(cyl(C, P, VX, IY, 2.6, ZR - 0.4, ZR + 2.6, 32));
    put(cyl(C, P, VX, IY, 2.9, ZR + 2.6, ZR + 3.3, 32));
    put(loft(C, P, circle(VX, IY, 2.0, 32), ZR + 3.3, ZR + 5.6, circle(VX, IY, 1.2, 32)));
    put(loft(C, P, circle(VX, IY, 1.25, 6, rad(15)), ZR + 5.6, ZR + 6.4));
    put(cyl(C, P, VX, IY, 0.45, ZR + 6.4, ZH + 1.6, 12));

    // the handwheel: the far inside of the rim, back spokes, hub, front spokes, then the rim
    {
      const ZT = ZH + 0.9, RI = RW - 0.9, zs = ZH + 0.45;
      const inner = circle(VX, IY, RI, 48);
      const back = inner.filter((q) => -(q.nu * view[0] + q.nv * view[1]) > 0);
      // the back half as one run, in ring order
      const start = inner.findIndex((q, i) => -(q.nu * view[0] + q.nv * view[1]) > 0 && -(inner[(i + 47) % 48].nu * view[0] + inner[(i + 47) % 48].nv * view[1]) <= 0);
      const run = Array.from({ length: back.length }, (_, k) => inner[(start + k) % 48]);
      const bandPts: Vec2[] = [...run.map((q) => P(q.u, q.v, ZT)), ...run.slice().reverse().map((q) => P(q.u, q.v, ZH))];
      const band = solid(g);
      band.put({ sil: poly(bandPts), shades: [poly(bandPts), "", "", ""], top: "", crease: "" });
      const spokes = [0, 1, 2, 3, 4].map((k) => rad(18 + k * 72));
      const sp = (th: number) => put(tube(C, P, [VX, IY, zs], [VX + Math.cos(th) * (RI + 0.3), IY + Math.sin(th) * (RI + 0.3), zs], 0.32, 10));
      spokes.filter((th) => faces(th) <= 0).forEach(sp);
      put(cyl(C, P, VX, IY, 1.0, ZH - 0.1, ZH + 1.1, 20));
      spokes.filter((th) => faces(th) > 0).forEach(sp);
      const rim = loft(C, P, circle(VX, IY, RW, 64), ZH, ZT);
      const hole = flat(P, inner, ZT);
      const s = solid(g);
      s.g.setAttribute("fill-rule", "evenodd");
      s.put({ ...rim, sil: rim.sil + hole, top: rim.top + hole });
      put(cyl(C, P, VX, IY, 0.55, ZT, ZT + 0.5, 12));
    }

    // state: the level follows the value on a slow, underdamped spring
    const lim = () => { const a = num(opts.min, 0), b = num(opts.max, 100); return [Math.min(a, b), Math.max(a, b)] as const; };
    const tOf = (v: number) => { const [a, b] = lim(); return b > a ? Math.max(0, Math.min(1, (v - a) / (b - a))) : 0; };
    let t = tOf(num(opts.value, lim()[0]));
    const sp = spring(t, { k: 30, c: 7.6, eps: 0.0006 });

    function drawScale() {
      const [a, b] = lim(), span = b - a;
      const mn: string[] = [], mj: string[] = [], x0 = WW + 0.5;
      if (span > 0) {
        const st = niceStep(span / 10), every = Math.round(st / 10 ** Math.floor(Math.log10(st))) === 5 || Math.round(st / 10 ** Math.floor(Math.log10(st))) === 25 ? 2 : 5;
        const first = Math.ceil(a / st - 1e-9);
        for (let k = first; k * st <= b + 1e-9; k++) {
          const y = WH * (1 - (k * st - a) / span), m = k % every === 0;
          (m ? mj : mn).push(`M${x0} ${y.toFixed(2)}H${(x0 + (m ? 2 : 1.1)).toFixed(2)}`);
        }
      }
      mj.push(`M${x0} 0H${x0 + 2}M${x0} ${WH}H${x0 + 2}`);
      minor.setAttribute("d", mn.join(""));
      major.setAttribute("d", mj.join(""));
      const fmt = (v: number) => { const s = String(Math.round(v * 100) / 100); return s.length <= 4 ? s : ""; };
      lbTop.textContent = fmt(b); lbBot.textContent = fmt(a);
      // accent pointers at the thresholds, on the near side of the glass
      const ptr = (v: unknown) => {
        if (typeof v !== "number" || !Number.isFinite(v)) return "";
        const y = WH * (1 - tOf(v));
        return `M-0.4 ${y.toFixed(2)}L-1.8 ${(y - 0.65).toFixed(2)}L-1.8 ${(y + 0.65).toFixed(2)}Z`;
      };
      marks.setAttribute("d", ptr(opts.low) + ptr(opts.high));
    }
    drawScale();

    let lastY = NaN, lastTilt = NaN;
    function drawLevel(x: number, v: number) {
      const y = WH * (1 - Math.max(0, Math.min(1, x)));
      const tilt = Math.max(-0.9, Math.min(0.9, v * 3.2));
      if (Math.abs(y - lastY) < 0.004 && Math.abs(tilt - lastTilt) < 0.004) return;
      lastY = y; lastTilt = tilt;
      const yl = y - tilt, yr = y + tilt, sag = 0.45;
      liquid.setAttribute("d", `M-1 ${yl.toFixed(2)}Q${(WW / 2).toFixed(2)} ${(y + sag).toFixed(2)} ${WW + 1} ${yr.toFixed(2)}V${WH + 1}H-1Z`);
      const top = `M0 ${(yl - 0.25).toFixed(2)}Q${(WW / 2).toFixed(2)} ${(y + sag).toFixed(2)} ${WW} ${(yr - 0.25).toFixed(2)}`;
      surface.setAttribute("d", top);
      meniscus.setAttribute("d", `M-0.5 ${(yl - 0.25).toFixed(2)}L0 ${(yl - 0.25).toFixed(2)}Q${(WW / 2).toFixed(2)} ${(y + sag).toFixed(2)} ${WW} ${(yr - 0.25).toFixed(2)}L${WW + 0.5} ${(yr - 0.25).toFixed(2)}`);
    }

    const B = register(host, (dt) => {
      sp.t = t;
      const m = stepS(sp, dt);
      drawLevel(sp.x, m ? sp.v : 0);
      return m;
    });
    bag.add(B.unregister);

    // the host's own values for what we set, so destroy can put them back
    const ARIA = ["role", "aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-label", "aria-valuetext"];
    const before = ARIA.map((k) => host.getAttribute(k));
    const sync = () => {
      const [a, b] = lim(), v = num(opts.value, a);
      const meter = opts.role !== "progressbar";
      host.setAttribute("role", meter ? "meter" : "progressbar");
      host.setAttribute("aria-valuemin", String(a));
      host.setAttribute("aria-valuemax", String(b));
      host.setAttribute("aria-valuenow", String(v));
      host.setAttribute("aria-label", opts.label ?? (meter ? "Level" : "Progress"));
      if (opts.format) host.setAttribute("aria-valuetext", opts.format(v)); else host.removeAttribute("aria-valuetext");
    };
    sync();

    bag.add(() => {
      ARIA.forEach((k, i) => { const was = before[i]; if (was === null) host.removeAttribute(k); else host.setAttribute(k, was); });
      svg.replaceChildren();
    });
    return {
      update(next) {
        opts = next;
        t = tOf(num(next.value, lim()[0]));
        drawScale();
        sync();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
