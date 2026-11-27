/**
 * Knurl — the drawing maths every control shares, with no DOM.
 *
 * The camera and the hull-silhouette solids follow Hairline (MIT, Lucas
 * Marques); the four-tone side shading and the lofted solid follow Anatomy's
 * kit (MIT, wheresryan22). One solid yields every path both finishes need, so
 * "line" and "solid" differ only in CSS.
 *
 * World space: x and y on the ground, z up. Screen space: the control's own
 * viewBox. No perspective; parts are painted back to front by the caller.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rad = (d: number) => (d * Math.PI) / 180;
export const r2 = (n: number) => Math.round(n * 100) / 100;

export const poly = (pts: readonly Vec2[]) =>
  pts.length < 2 ? "" : "M" + pts.map((p) => r2(p[0]) + " " + r2(p[1])).join("L") + "Z";
export const open = (pts: readonly Vec2[]) =>
  pts.length < 2 ? "" : "M" + pts.map((p) => r2(p[0]) + " " + r2(p[1])).join("L");
export const seg = (a: Vec2, b: Vec2) => `M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`;

/* ───── camera ───── */

/** An orthographic camera: azimuth and elevation in degrees, scale S, offset set by `fit`. */
export type Camera = { az: number; el: number; S: number; ox: number; oy: number };
export type Projector = (x: number, y: number, z: number) => Vec2;

export const camera = (az = 45, el = 30, S = 1): Camera => ({ az, el, S, ox: 0, oy: 0 });

export function proj(C: Camera): Projector {
  const a = rad(C.az), c = Math.cos(a), s = Math.sin(a), k = Math.sin(rad(C.el)), zf = Math.cos(rad(C.el));
  return (x, y, z) => [C.ox + C.S * (x * c - y * s), C.oy + C.S * ((x * s + y * c) * k - z * zf)];
}

/** World x/y under a screen point, on the ground plane at height z. */
export function unproj(C: Camera, sx: number, sy: number, z: number): Vec2 {
  const a = rad(C.az), c = Math.cos(a), s = Math.sin(a), k = Math.sin(rad(C.el)), zf = Math.cos(rad(C.el));
  const X = (sx - C.ox) / C.S, Y = ((sy - C.oy) / C.S + z * zf) / k;
  return [X * c + Y * s, -X * s + Y * c];
}

/** Centres the projected bounding box of `pts` on (cx, cy). With `w`/`h`, also scales it to fit that box. */
export function fit(C: Camera, pts: readonly Vec3[], cx: number, cy: number, w?: number, h?: number) {
  C.ox = 0; C.oy = 0;
  if (w && h) {
    C.S = 1;
    const b = bounds(proj(C), pts);
    C.S = Math.min(w / (b[1] - b[0]), h / (b[3] - b[2]));
  }
  const b = bounds(proj(C), pts);
  C.ox = cx - (b[0] + b[1]) / 2; C.oy = cy - (b[2] + b[3]) / 2;
}

function bounds(P: Projector, pts: readonly Vec3[]): [number, number, number, number] {
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
  for (const p of pts) {
    const q = P(p[0], p[1], p[2]);
    a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1]);
  }
  return [a, b, c, d];
}

/** Depth along the view: larger is nearer the viewer. Sort ascending to paint back to front. */
export function depth(C: Camera, x: number, y: number, z: number) {
  const a = rad(C.az);
  return (x * Math.sin(a) + y * Math.cos(a)) * Math.cos(rad(C.el)) + z * Math.sin(rad(C.el));
}

/* ───── rings: footprints sampled with outward normals ───── */

export type Sample = { u: number; v: number; nu: number; nv: number };
export type Ring = Sample[];

/** A rounded rectangle from (x0, y0) to (x1, y1), counter-clockwise, n samples per corner. */
export function rrect(x0: number, y0: number, x1: number, y1: number, r: number, n = 5): Ring {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  const out: Ring = [];
  for (const [cu, cv, a0] of [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180], [x1 - r, y0 + r, 270]] as const)
    for (let k = 0; k <= n; k++) {
      const a = rad(a0 + (90 * k) / n), ca = Math.cos(a), sa = Math.sin(a);
      out.push({ u: cu + r * ca, v: cv + r * sa, nu: ca, nv: sa });
    }
  return out;
}

/** A circle about (cx, cy), counter-clockwise. `phase` turns where the samples start. */
export function circle(cx: number, cy: number, R: number, n = 48, phase = 0): Ring {
  const out: Ring = [];
  for (let k = 0; k < n; k++) {
    const a = phase + (k / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    out.push({ u: cx + R * ca, v: cy + R * sa, nu: ca, nv: sa });
  }
  return out;
}

/** Moves a ring by (dx, dy). */
export const shift = (r: Ring, dx: number, dy: number): Ring => r.map((q) => ({ ...q, u: q.u + dx, v: q.v + dy }));

/** Insets a ring along its normals (a negative `by` grows it). */
export const inset = (r: Ring, by: number): Ring => r.map((q) => ({ ...q, u: q.u - q.nu * by, v: q.v - q.nv * by }));

/** Monotone-chain convex hull. */
export function hull(input: readonly Vec2[]): Vec2[] {
  const pts = input.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const x = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Vec2[] = [], up: Vec2[] = [];
  for (const p of pts) { while (lo.length > 1 && x(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length > 1 && x(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

/** Whether a ground normal faces the camera: screen-down in world is (sin az, cos az). */
export const facing = (C: Camera) => {
  const a = rad(C.az), s = Math.sin(a), c = Math.cos(a);
  return (nu: number, nv: number) => nu * s + nv * c > 1e-6;
};

/** The light comes from the upper left of the screen and a little toward the viewer. 0 is darkest, 1 lightest. */
export const lighting = (C: Camera) => {
  const a = rad(C.az), s = Math.sin(a), c = Math.cos(a);
  // screen-left on the ground is (-c, s); toward the viewer is (s, c)
  let lu = -c * 0.85 + s * 0.5, lv = s * 0.85 + c * 0.5;
  const L = Math.hypot(lu, lv); lu /= L; lv /= L;
  return (nu: number, nv: number) => (nu * lu + nv * lv + 1) / 2;
};

/** The one cyclic run of indices whose flag is true, in ring order (the ring is assumed to have one such run). */
function runOf(flags: readonly boolean[]): number[] {
  const n = flags.length;
  let s = -1;
  for (let i = 0; i < n; i++) if (flags[i] && !flags[(i + n - 1) % n]) { s = i; break; }
  if (s < 0) return flags[0] ? flags.map((_, i) => i) : [];
  const out: number[] = [];
  for (let k = 0; k < n && flags[(s + k) % n]; k++) out.push((s + k) % n);
  return out;
}

/* ───── solids ───── */

export const SHADES = 4;

/**
 * Every path a solid needs, in both finishes:
 *  - `sil`: the filled silhouette (hull of the two rings), stroked as the outline;
 *  - `shades`: the visible side faces bucketed by how much light they catch (solid finish only);
 *  - `top`: the lid (solid finish only);
 *  - `crease`: the front run of the lid, where it meets the sides (both finishes).
 */
export type SolidPaths = { sil: string; shades: string[]; top: string; crease: string };

/**
 * A loft between a ring at z0 and a ring at z1 (same sample count; `top`
 * defaults to the bottom ring). Covers slabs, cylinders and tapered caps.
 */
export function loft(C: Camera, P: Projector, bottom: Ring, z0: number, z1: number, top: Ring = bottom): SolidPaths {
  const n = bottom.length, front = facing(C), light = lighting(C);
  const lo = bottom.map((q) => P(q.u, q.v, z0)), hi = top.map((q) => P(q.u, q.v, z1));
  const buckets: string[][] = Array.from({ length: SHADES }, () => []);
  const flags: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // the face between sample i and i+1: its normal is the mean of theirs
    const a = bottom[i], b = bottom[j];
    let nu = a.nu + b.nu, nv = a.nv + b.nv;
    const L = Math.hypot(nu, nv) || 1; nu /= L; nv /= L;
    const vis = front(nu, nv);
    flags.push(front(top[i].nu, top[i].nv));
    if (!vis || z1 - z0 < 1e-6) continue;
    const t = Math.min(SHADES - 1, Math.floor(light(nu, nv) * SHADES));
    buckets[t].push(poly([hi[i], hi[j], lo[j], lo[i]]));
  }
  return {
    sil: poly(hull(hi.concat(lo))),
    shades: buckets.map((b) => b.join("")),
    top: poly(hi),
    crease: open(runOf(flags).map((i) => hi[i])),
  };
}

/** A slab with a rounded footprint. */
export const slab = (C: Camera, P: Projector, x0: number, y0: number, x1: number, y1: number, r: number, z0: number, z1: number) =>
  loft(C, P, rrect(x0, y0, x1, y1, r), z0, z1);

/** An upright cylinder. */
export const cyl = (C: Camera, P: Projector, cx: number, cy: number, R: number, z0: number, z1: number, n = 40) =>
  loft(C, P, circle(cx, cy, R, n), z0, z1);

/**
 * A round bar between two world points, tapering from r0 to r1: its silhouette,
 * and the cap at `b` as an ellipse-ish polygon. For levers and stems that tilt.
 */
export function bar(P: Projector, a: Vec3, b: Vec3, r0: number, r1: number, n = 24): { sil: string; cap: string; capPts: Vec2[] } {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(d[0], d[1], d[2]) || 1;
  const w: Vec3 = [d[0] / L, d[1] / L, d[2] / L];
  // two unit vectors across the axis
  const ref: Vec3 = Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let u: Vec3 = [w[1] * ref[2] - w[2] * ref[1], w[2] * ref[0] - w[0] * ref[2], w[0] * ref[1] - w[1] * ref[0]];
  const ul = Math.hypot(u[0], u[1], u[2]); u = [u[0] / ul, u[1] / ul, u[2] / ul];
  const v: Vec3 = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
  const ring = (o: Vec3, r: number) =>
    Array.from({ length: n }, (_, k): Vec2 => {
      const t = (k / n) * Math.PI * 2, ct = Math.cos(t) * r, st = Math.sin(t) * r;
      return P(o[0] + u[0] * ct + v[0] * st, o[1] + u[1] * ct + v[1] * st, o[2] + u[2] * ct + v[2] * st);
    });
  const ra = ring(a, r0), rb = ring(b, r1);
  return { sil: poly(hull(ra.concat(rb))), cap: poly(rb), capPts: rb };
}

/* ───── marks on planes ───── */

/** A ring of radial ticks on the plane z: `count` ticks across `span` radians from `from`, every `every`-th long. */
export function radialTicks(P: Projector, cx: number, cy: number, R: number, z: number, count: number, from: number, span: number, every: number, short: number, long: number) {
  const out: string[] = [], major: string[] = [];
  for (let k = 0; k <= count; k++) {
    const a = from + (span * k) / count, ca = Math.cos(a), sa = Math.sin(a), l = k % every === 0 ? long : short;
    (k % every === 0 ? major : out).push(seg(P(cx + ca * R, cy + sa * R, z), P(cx + ca * (R - l), cy + sa * (R - l), z)));
  }
  return { minor: out.join(""), major: major.join("") };
}

/** An SVG `matrix()` that puts a local 2D frame (x right along `u`, y down along `v`, in world units) at `o` on a plane. */
export function planeMatrix(P: Projector, o: Vec3, u: Vec3, v: Vec3) {
  const p0 = P(o[0], o[1], o[2]);
  const pu = P(o[0] + u[0], o[1] + u[1], o[2] + u[2]);
  const pv = P(o[0] + v[0], o[1] + v[1], o[2] + v[2]);
  return `matrix(${r2(pu[0] - p0[0])} ${r2(pu[1] - p0[1])} ${r2(pv[0] - p0[0])} ${r2(pv[1] - p0[1])} ${r2(p0[0])} ${r2(p0[1])})`;
}

/** A ring laid flat at height z, as a closed path. */
export const flat = (P: Projector, ring: readonly Sample[], z: number) => poly(ring.map((q) => P(q.u, q.v, z)));

/** Short straight ticks along x on the plane z, from y0 to y0+len (major: to y0+long). */
export function rulerX(P: Projector, x0: number, x1: number, n: number, every: number, y0: number, len: number, long: number, z: number) {
  const minor: string[] = [], major: string[] = [];
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n, m = k % every === 0;
    (m ? major : minor).push(seg(P(x, y0, z), P(x, y0 + (m ? long : len), z)));
  }
  return { minor: minor.join(""), major: major.join("") };
}

/* ───── convex solids in any orientation ───── */

export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A 3×3 rotation as three column vectors; compose with `turn`. */
export type Rot = [Vec3, Vec3, Vec3];
export const IDENT: Rot = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
/** Rotation about the world x, y or z axis by `a` radians. */
export function rot(axis: "x" | "y" | "z", a: number): Rot {
  const c = Math.cos(a), s = Math.sin(a);
  if (axis === "x") return [[1, 0, 0], [0, c, s], [0, -s, c]];
  if (axis === "y") return [[c, 0, -s], [0, 1, 0], [s, 0, c]];
  return [[c, s, 0], [-s, c, 0], [0, 0, 1]];
}
/** Applies a rotation to a vector. */
export const turn = (R: Rot, v: Vec3): Vec3 => add3(add3(scale3(R[0], v[0]), scale3(R[1], v[1])), scale3(R[2], v[2]));
/** `A` after `B`: the rotation that applies B, then A. */
export const compose = (A: Rot, B: Rot): Rot => [turn(A, B[0]), turn(A, B[1]), turn(A, B[2])];

/** The direction toward the viewer, in world space. */
export const toViewer = (C: Camera): Vec3 => {
  const a = rad(C.az), e = rad(C.el);
  return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
};

/**
 * Any convex polyhedron, from its vertices and its faces (each a ring of
 * vertex indices, counter-clockwise seen from outside). Faces turned up
 * (normal z > 0.6) are lids; the rest are shaded in four tones by facing.
 * The crease is every edge shared by two visible faces, so a tilted box
 * reads in the line finish exactly as an upright slab does.
 */
export function poly3(C: Camera, P: Projector, verts: readonly Vec3[], faces: readonly number[][]): SolidPaths {
  const V = toViewer(C), light = lighting(C);
  const scr = verts.map((v) => P(v[0], v[1], v[2]));
  const buckets: string[][] = Array.from({ length: SHADES }, () => []);
  const tops: string[] = [];
  const vis: boolean[] = [];
  const edgeCount = new Map<string, number>();
  faces.forEach((f, i) => {
    const n = cross3(sub3(verts[f[1]], verts[f[0]]), sub3(verts[f[2]], verts[f[0]]));
    const L = Math.hypot(n[0], n[1], n[2]) || 1;
    const nn: Vec3 = [n[0] / L, n[1] / L, n[2] / L];
    vis[i] = dot3(nn, V) > 1e-6;
    if (!vis[i]) return;
    const d = poly(f.map((k) => scr[k]));
    if (nn[2] > 0.6) tops.push(d);
    else {
      const g = Math.hypot(nn[0], nn[1]) || 1;
      buckets[Math.min(SHADES - 1, Math.floor(light(nn[0] / g, nn[1] / g) * SHADES))].push(d);
    }
    for (let k = 0; k < f.length; k++) {
      const a = f[k], b = f[(k + 1) % f.length];
      const key = a < b ? a + "," + b : b + "," + a;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  });
  const crease: string[] = [];
  for (const [key, n] of edgeCount) if (n === 2) { const [a, b] = key.split(",").map(Number); crease.push(seg(scr[a], scr[b])); }
  return { sil: poly(hull(scr)), shades: buckets.map((b) => b.join("")), top: tops.join(""), crease: crease.join("") };
}

/**
 * A box of half-extents (hx, hy, hz), turned by R about its own centre and
 * placed at `c`. Optionally pivoted: `pivot` is a point in the box's own
 * frame that stays at `c` instead of the centre (a lever turning on its foot).
 */
export function cuboid(c: Vec3, hx: number, hy: number, hz: number, R: Rot = IDENT, pivot: Vec3 = [0, 0, 0]) {
  const local: Vec3[] = [
    [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
    [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
  ];
  const verts = local.map((v) => add3(c, turn(R, sub3(v, pivot))));
  const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  return { verts, faces };
}

/** A prism from a convex ring in the box's own x–y plane, extruded ±hz, then turned and placed like `cuboid`. */
export function prism3(c: Vec3, ring: readonly Vec2[], hz: number, R: Rot = IDENT, pivot: Vec3 = [0, 0, 0]) {
  const n = ring.length;
  const local: Vec3[] = [...ring.map((p): Vec3 => [p[0], p[1], -hz]), ...ring.map((p): Vec3 => [p[0], p[1], hz])];
  const verts = local.map((v) => add3(c, turn(R, sub3(v, pivot))));
  const faces: number[][] = [Array.from({ length: n }, (_, k) => n - 1 - k), Array.from({ length: n }, (_, k) => n + k)];
  for (let k = 0; k < n; k++) faces.push([k, (k + 1) % n, n + (k + 1) % n, n + k]);
  return { verts, faces };
}
