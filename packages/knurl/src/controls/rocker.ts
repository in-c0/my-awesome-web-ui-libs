import { add3, camera, circle, compose, cyl, fit, flat, hull, poly, poly3, prism3, proj, rad, rot, rrect, seg, slab, turn, type Rot, type Vec2, type Vec3 } from "../core/iso";
import { reducedMotion, spring, stepS } from "../core/motion";
import { define, emit, nativeInput, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, toView } from "../core/stage";

/**
 * Rocker — a checkbox, built as a panel-mount rocker switch.
 *
 * A moulded bezel on a flange, screwed to a plate; the paddle sits in the
 * bezel's opening and rocks on its axle about 12° each way, the pressed end
 * dipping under the bezel's lip and the other standing proud. "I" and "O"
 * are engraved on its two ends, and a lens window beside the axle lights
 * with the accent when on. Indeterminate sets the paddle level: a centre-off
 * rocker. Pressing either half throws it to that end; hovering a raised half
 * leans the paddle a little toward it.
 *
 * Semantics come from a visually hidden `<input type="checkbox">` (with its
 * `indeterminate` state).
 */

export type RockerOptions = BaseOptions & {
  checked?: boolean;
  defaultChecked?: boolean;
  /** Shows the paddle level in the middle, neither on nor off (the native input's `indeterminate`). */
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Set by the React wrapper when `checked` is controlled: the control asks, the prop decides. */
  controlled?: boolean;
};

const VW = 200, VH = 140;
const TILT = 12; // degrees each way from level
let uid = 0;

/** Even-odd point-in-polygon, in screen units. */
function inside(q: Vec2, pts: readonly Vec2[]) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > q[1]) !== (yj > q[1]) && q[0] < ((xj - xi) * (q[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export const rocker = define<RockerOptions>({
  id: "rocker",
  label: "Rocker switch",
  vw: VW,
  vh: VH,
  width: 140,
  keys: ["checked", "defaultChecked", "indeterminate", "onCheckedChange", "controlled"],
  controlKey: "checked",
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    const C = camera(32, 32);
    const PX = 36, PY = 23, PZ = 4;                      // plate half-size and height
    const FX = 24, FY = 16, FZ = PZ + 1.1;               // flange
    const BX = 21, BY = 13, BR = 2.6, ZT = FZ + 3.4;     // bezel and its top
    const OX = 17.2, OY = 9.4, DEP = 3.4;                // opening, and how far its walls show
    const L = 16, W = 8.1, H = 3.4, D = 4.4, CH = 1.5;   // paddle half-length, half-width, height above and below the axle, end chamfer
    const ZA = ZT + 0.6;                                 // the axle
    const ext: Vec3[] = [[-PX, -PY, 0], [PX, PY, 0], [-PX, PY, 0], [PX, -PY, 0], [-PX, -PY, PZ], [-L, -W, ZA + 7.2], [-L, W, ZA + 7.2], [L, -W, ZA + 7.2]];
    fit(C, ext, VW / 2, VH / 2 + 3, VW - 22, VH - 18);
    const P = proj(C);
    const id = "knurl-rocker-" + ++uid;

    const defs = mk("defs", {}, svg);
    const g = mk("g", {}, svg);
    // the plate, its bevel and four screws
    shadow(g, flat(P, rrect(-PX, -PY + 3, PX, PY + 3, 5), 0));
    solid(g).put(slab(C, P, -PX, -PY, PX, PY, 5, 0, PZ));
    line(g, "lo").setAttribute("d", flat(P, rrect(-PX + 2.2, -PY + 2.2, PX - 2.2, PY - 2.2, 3), PZ));
    const slots: string[] = [];
    for (const [x, y] of [[-PX + 5.5, -PY + 5.5], [PX - 5.5, -PY + 5.5], [-PX + 5.5, PY - 5.5], [PX - 5.5, PY - 5.5]]) {
      solid(g).put(cyl(C, P, x, y, 2.1, PZ, PZ + 0.7, 20));
      const a = rad(x * y > 0 ? 35 : -20);
      slots.push(seg(P(x - Math.cos(a) * 1.5, y - Math.sin(a) * 1.5, PZ + 0.7), P(x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5, PZ + 0.7)));
    }
    line(g, "edge").setAttribute("d", slots.join(""));

    // the flange, the bezel, its two top chamfers and the opening
    solid(g).put(slab(C, P, -FX, -FY, FX, FY, 3.4, PZ, FZ));
    solid(g).put(slab(C, P, -BX, -BY, BX, BY, BR, FZ, ZT));
    line(g, "lo").setAttribute("d", flat(P, rrect(-BX + 1.1, -BY + 1.1, BX - 1.1, BY - 1.1, BR - 0.9), ZT) + flat(P, rrect(-OX - 1.1, -OY - 1.1, OX + 1.1, OY + 1.1, 1.6), ZT));
    mk("path", { class: "k-slot", d: flat(P, rrect(-OX, -OY, OX, OY, 0.7), ZT) }, g);
    // the two far walls of the opening show inside it: their foot, and the corner between them
    const zw = ZT - DEP;
    const mouth = mk("clipPath", { id: id + "-m" }, defs);
    mk("path", { d: flat(P, rrect(-OX, -OY, OX, OY, 0.7), ZT) }, mouth);
    const walls = mk("g", { "clip-path": `url(#${id}-m)` }, g);
    line(walls, "edge").setAttribute("d", "M" + [P(OX, -OY, zw), P(-OX, -OY, zw), P(-OX, OY, zw)].map((p) => p[0].toFixed(2) + " " + p[1].toFixed(2)).join("L") + seg(P(-OX, -OY, ZT), P(-OX, -OY, zw)));

    // the bezel's near lip hides whatever of the paddle is below it: clip the paddle to everything above the opening's near edges
    const e = 0.2, A = P(-BX, OY - e, ZT), Bc = P(OX - e, OY - e, ZT), Cc = P(OX - e, -BY, ZT);
    const clip = mk("clipPath", { id }, defs);
    mk("path", {
      "clip-rule": "evenodd",
      d: `M-60 -60H${VW + 60}V${VH + 60}H-60Z` + poly([A, Bc, Cc, [Cc[0], VH + 40], [A[0], VH + 40]]),
    }, clip);

    // the paddle: two chamfered halves meeting in a shallow valley over the axle, extruded across the opening
    const pg = mk("g", { "clip-path": `url(#${id})` }, g);
    const bodyO = solid(pg), bodyI = solid(pg); // the −x half is farther from the viewer, so it is painted first
    const boss = line(pg, "lo");
    const glow = mk("path", { class: "k-glow" }, pg);
    const lensRim = line(pg, "lo");
    const lens = mk("path", { class: "k-led" }, pg);
    const legend = line(pg, "hi");
    const H0 = H - 1.1; // the valley floor
    const top = (x: number) => H0 + ((H - H0) * Math.min(Math.abs(x), L - CH)) / (L - CH);
    const HALF_I: Vec2[] = [[0, -D], [L, -D], [L, H - CH], [L - CH, H], [0, H0]];
    const HALF_O: Vec2[] = HALF_I.map((q): Vec2 => [-q[0], q[1]]).reverse();
    const R0 = rot("x", rad(90)); // the profile's y is height; its extrusion runs across the opening
    const halves: { i: Vec2[]; o: Vec2[] } = { i: [], o: [] };
    let drawn = NaN;

    function drawPaddle(deg: number) {
      if (deg === drawn) return;
      drawn = deg;
      const R: Rot = compose(rot("y", rad(deg)), R0), c: Vec3 = [0, 0, ZA];
      for (const [s, ring] of [[bodyO, HALF_O], [bodyI, HALF_I]] as const) {
        const pr = prism3(c, ring, W, R);
        s.put(poly3(C, P, pr.verts, pr.faces));
      }
      // a point on the paddle: x along it, y across, h above the axle (h = top(x) lies on its face)
      const at = (x: number, y: number, h = top(x)) => { const w = add3(c, turn(R, [x, h, -y])); return P(w[0], w[1], w[2]); };
      const rect = (x0: number, x1: number, y0: number, y1: number, lift = 0) => poly([at(x0, y0, top(x0) + lift), at(x1, y0, top(x1) + lift), at(x1, y1, top(x1) + lift), at(x0, y1, top(x0) + lift)]);
      // the axle boss on the near side
      boss.setAttribute("d", poly(circle(0, 0, 1.3, 20).map((q) => at(q.u, W, q.v))));
      // the lens window beside the valley, on the I half
      glow.setAttribute("d", rect(1.2, 6.6, -W + 1, W - 1, 0.3));
      lensRim.setAttribute("d", rect(1.8, 6, -W + 1.7, W - 1.7));
      lens.setAttribute("d", rect(2.5, 5.3, -W + 2.4, W - 2.4, 0.02));
      // the legends: I (a bar across the paddle) on the +x end, O on the −x end
      legend.setAttribute("d", seg(at(9, 0), at(12.4, 0)) + poly(circle(-10.4, 0, 2, 24).map((q) => at(q.u, q.v))));
      const half = (x0: number, x1: number) => hull([x0, x1].flatMap((x) => [-W, W].flatMap((y) => [-1, top(x)].map((h) => at(x, y, h)))));
      halves.i = half(0, L);
      halves.o = half(-L, 0);
    }

    // state
    const input = nativeInput(ctx, { type: "checkbox" });
    host.setAttribute("data-knurl-hit", "");
    let opts = o;
    let on = !!(o.checked ?? o.defaultChecked);
    let mixed = !!o.indeterminate;
    let hover = 0; // +1 over the I half, −1 over the O half
    const base = () => (mixed ? 0 : on ? TILT : -TILT);
    const target = () => {
      const down = !mixed && ((hover > 0 && on) || (hover < 0 && !on));
      return base() + (hover && !down ? hover * 2.5 : 0);
    };
    const sp = spring(base(), { k: 400, c: 16, eps: 0.02 });

    const sync = () => {
      input.checked = on;
      input.indeterminate = mixed;
      input.disabled = !!opts.disabled;
      input.setAttribute("aria-label", opts.label ?? "Rocker switch");
      if (opts.name) input.name = opts.name; else input.removeAttribute("name");
      const lit = on && !mixed;
      lens.classList.toggle("on", lit);
      glow.classList.toggle("on", lit);
      host.setAttribute("data-state", mixed ? "mixed" : on ? "on" : "off");
    };
    sync();

    const B = register(host, (dt) => {
      sp.t = target();
      const moving = stepS(sp, dt);
      drawPaddle(sp.x);
      return moving;
    });
    bag.add(B.unregister);
    if (reducedMotion()) drawPaddle(sp.t);

    const ask = (next: boolean) => {
      if (next === on && !mixed) { input.checked = on; input.indeterminate = false; return; }
      if (opts.controlled) { input.checked = on; input.indeterminate = mixed; emit(opts.onCheckedChange, next); return; }
      on = next; mixed = false; sync(); B.wake(); emit(opts.onCheckedChange, next);
    };
    // which half of the paddle is under the pointer, tested on the paddle's projected shape as it sits now
    const halfAt = (e: { clientX: number; clientY: number }) => {
      const q = toView(svg, e, VW, VH);
      return inside(q, halves.i) ? 1 : inside(q, halves.o) ? -1 : 0;
    };
    bag.on(input, "change", () => ask(input.checked));
    bag.on(host, "click", (e) => {
      if (opts.disabled || e.target === input) return;
      input.focus({ preventScroll: true });
      const h = halfAt(e);
      ask(h > 0 ? true : h < 0 ? false : mixed ? true : !on);
    });
    bag.on(host, "pointermove", (e) => { if (e.pointerType !== "mouse") return; const h = halfAt(e); if (h !== hover) { hover = h; B.wake(); } });
    bag.on(host, "pointerleave", () => { hover = 0; B.wake(); });

    bag.add(() => { input.remove(); host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state"); svg.replaceChildren(); });

    return {
      update(next, prev) {
        opts = next;
        if (next.checked !== undefined && next.checked !== on) { on = next.checked; B.wake(); }
        const ind = !!next.indeterminate;
        if ((next.controlled || ind !== !!prev.indeterminate) && ind !== mixed) { mixed = ind; B.wake(); }
        sync();
      },
      destroy: bag.dispose,
    };
  },
});
