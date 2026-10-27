import { camera, circle, cyl, fit, flat, loft, poly, proj, rad, radialTicks, rrect, seg, slab, type Vec2, type Vec3 } from "../core/iso";
import { spring, stepS } from "../core/motion";
import { define, keepAttrs, num, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid } from "../core/stage";

/**
 * Gauge — a progress bar or meter, built as a dial gauge on a bench block.
 *
 * A bezel with a knurled rim around a face with a 270° scale; a needle with
 * an accent tip swings to the value on an underdamped spring, so it overshoots
 * a little and settles, the way a damped movement does. A tell-tale hand
 * stays at the highest value seen. Behind the case, a stem and hex fitting
 * come out of the block.
 *
 * Not focusable: the host carries role="progressbar" (or "meter") with its
 * aria values.
 */

export type GaugeOptions = BaseOptions & {
  value?: number;
  min?: number;
  max?: number;
  /** `progressbar` (default) for work toward completion; `meter` for a level within a range. */
  role?: "progressbar" | "meter";
  /** Shows the tell-tale hand at the highest value seen. Default true. */
  peak?: boolean;
  format?: (value: number) => string;
};

const VW = 200, VH = 170;
const A0 = rad(90), SPAN = rad(270);

export const gauge = define<GaugeOptions>({
  id: "gauge",
  label: "Progress",
  vw: VW,
  vh: VH,
  width: 160,
  keys: ["value", "min", "max", "role", "peak", "format"],
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(45, 34);
    const BH = 31, BZ = 5, R = 25, ZC = BZ + 5, ZF = ZC + 2.2; // block half-size and height, case radius, case top, face height
    const ext: Vec3[] = [[-BH, -BH, 0], [BH, BH, 0], [-BH, BH, 0], [BH, -BH, 0], [0, 0, ZC + 3]];
    fit(C, ext, VW / 2, VH / 2 + 2, VW - 18, VH - 14);
    const P = proj(C);
    const g = mk("g", {}, svg);

    shadow(g, flat(P, rrect(-BH, -BH + 3, BH, BH + 3, 5), 0));
    solid(g).put(slab(C, P, -BH, -BH, BH, BH, 5, 0, BZ));
    line(g, "lo").setAttribute("d", flat(P, rrect(-BH + 2, -BH + 2, BH - 2, BH - 2, 3), BZ));
    // the stem and fitting out of the back corner
    const sx = -BH + 9, sy = -BH + 9;
    solid(g).put(loft(C, P, circle(sx, sy, 5.4, 6, rad(10)), BZ, BZ + 3.2));
    solid(g).put(cyl(C, P, sx, sy, 3, BZ + 3.2, BZ + 5.5, 24));
    // the case, the knurled bezel, the face
    solid(g).put(cyl(C, P, 0, 0, R + 1.6, BZ, BZ + 1.2, 64));
    solid(g).put(cyl(C, P, 0, 0, R, BZ + 1.2, ZC, 72));
    const knurl: string[] = [];
    for (let k = 0; k < 72; k++) {
      const t = (k / 72) * Math.PI * 2, ca = Math.cos(t), sa = Math.sin(t);
      if (ca * Math.sin(rad(45)) + sa * Math.cos(rad(45)) < 0.15) continue;
      knurl.push(seg(P(ca * R, sa * R, BZ + 2.2), P(ca * R, sa * R, ZC - 0.8)));
    }
    line(g, "lo").setAttribute("d", knurl.join(""));
    mk("path", { class: "k-face", d: flat(P, circle(0, 0, R - 2.6, 72), ZF - 0.01) }, g);
    line(g, "lo").setAttribute("d", flat(P, circle(0, 0, R - 2.6, 72), ZC));

    const ticks = radialTicks(P, 0, 0, R - 4.2, ZF, 50, A0, SPAN, 10, 1.4, 3.2);
    line(g, "mid").setAttribute("d", ticks.minor);
    line(g, "hi").setAttribute("d", ticks.major);
    // the last fifth of the scale is the red zone: a second, accent arc inside the ticks
    const arcPts = (from: number, to: number, r: number): Vec2[] => Array.from({ length: 25 }, (_, k) => {
      const t = from + ((to - from) * k) / 24;
      return P(Math.cos(t) * r, Math.sin(t) * r, ZF);
    });
    line(g, "accent").setAttribute("d", "M" + arcPts(A0 + SPAN * 0.8, A0 + SPAN, R - 8.4).map((p) => p.join(" ")).join("L"));
    line(g, "lo").setAttribute("d", "M" + arcPts(A0, A0 + SPAN * 0.8, R - 8.4).map((p) => p.join(" ")).join("L"));

    // hands: the tell-tale, then the needle, then the hub
    const tell = mk("path", { class: "k-line lo" }, g);
    const needle = mk("path", { class: "k-face" }, g);
    const tip = line(g, "accent");
    solid(g).put(cyl(C, P, 0, 0, 2.6, ZF, ZF + 1.1, 28));
    const hubTop = mk("ellipse", { class: "k-dot" }, g);
    const hc = P(0, 0, ZF + 1.1);
    hubTop.setAttribute("cx", hc[0].toFixed(2)); hubTop.setAttribute("cy", hc[1].toFixed(2));
    hubTop.setAttribute("rx", (0.9 * C.S).toFixed(2)); hubTop.setAttribute("ry", (0.9 * C.S * Math.sin(rad(34))).toFixed(2));
    // the glass: a highlight arc
    line(g, "lo").setAttribute("d", "M" + arcPts(rad(200), rad(250), R - 4).map((p) => p.join(" ")).join("L"));

    const lim = () => { const a = num(opts.min, 0), b = num(opts.max, 100); return [Math.min(a, b), Math.max(a, b)] as const; };
    const tOf = (v: number) => { const [a, b] = lim(); return b > a ? Math.max(0, Math.min(1, (v - a) / (b - a))) : 0; };
    let t = tOf(num(opts.value, lim()[0]));
    let peak = t;
    const sp = spring(A0 + SPAN * t, { k: 90, c: 7.5, eps: 0.0015 });

    function drawNeedle(a: number) {
      const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, L = R - 5, W = 1.1;
      const pts: Vec2[] = [P(-ca * 5 + nx * W, -sa * 5 + ny * W, ZF + 0.6), P(ca * L, sa * L, ZF + 0.6), P(-ca * 5 - nx * W, -sa * 5 - ny * W, ZF + 0.6)];
      needle.setAttribute("d", poly(pts));
      tip.setAttribute("d", seg(P(ca * (L - 6), sa * (L - 6), ZF + 0.6), P(ca * L, sa * L, ZF + 0.6)));
      const pa = A0 + SPAN * peak;
      tell.setAttribute("d", opts.peak === false ? "" : seg(P(Math.cos(pa) * (L - 9), Math.sin(pa) * (L - 9), ZF + 0.3), P(Math.cos(pa) * (L - 1), Math.sin(pa) * (L - 1), ZF + 0.3)));
    }

    const B = register(host, (dt) => {
      sp.t = A0 + SPAN * t;
      const m = stepS(sp, dt);
      drawNeedle(sp.x);
      return m;
    });
    bag.add(B.unregister);

    const restore = keepAttrs(host, ["role", "aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-label", "aria-valuetext"]);
    const sync = () => {
      const [a, b] = lim(), v = num(opts.value, a);
      host.setAttribute("role", opts.role === "meter" ? "meter" : "progressbar");
      host.setAttribute("aria-valuemin", String(a));
      host.setAttribute("aria-valuemax", String(b));
      host.setAttribute("aria-valuenow", String(v));
      host.setAttribute("aria-label", opts.label ?? (opts.role === "meter" ? "Meter" : "Progress"));
      if (opts.format) host.setAttribute("aria-valuetext", opts.format(v)); else host.removeAttribute("aria-valuetext");
    };
    sync();

    bag.add(() => {
      restore();
      svg.replaceChildren();
    });
    return {
      update(next) {
        opts = next;
        t = tOf(num(next.value, lim()[0]));
        peak = Math.max(peak, t);
        sync();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
