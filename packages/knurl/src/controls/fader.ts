import { camera, cyl, fit, flat, proj, rad, rrect, rulerX, seg, slab, unproj, type Vec3 } from "../core/iso";
import { spring, stepS } from "../core/motion";
import { define } from "../core/control";
import { range, RANGE_KEYS, type RangeOptions } from "../core/range";
import { disposer, line, mk, register, shadow, solid, toView } from "../core/stage";

/**
 * Fader — a slider, built as a mixing-desk fader on its strip.
 *
 * A cap with a lit index line rides a slot cut in the strip, over a ruler
 * whose ticks are the steps when there are few enough of them. The slot is lit
 * with the accent from its start to the cap. The cap follows the value on a
 * spring, so a jump from the keyboard travels; a drag is followed closely.
 *
 * Semantics come from a visually hidden `<input type="range">`.
 */

export type FaderOptions = RangeOptions;

const VW = 320, VH = 120;

export const fader = define<FaderOptions>({
  id: "fader",
  label: "Slider",
  vw: VW,
  vh: VH,
  width: 280,
  keys: RANGE_KEYS,
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    const C = camera(30, 30);
    const PX = 78, PY = 17, PZ = 4, L = 62; // strip half-length, half-depth, thickness; slot half-length
    const CAP = { w: 5.5, d: 13, h: 7.5 };
    const ext: Vec3[] = [[-PX, -PY, 0], [PX, PY, 0], [-PX, PY, 0], [PX, -PY, 0], [L, -CAP.d, PZ + CAP.h], [-L, -CAP.d, PZ + CAP.h]];
    fit(C, ext, VW / 2, VH / 2 + 2, VW - 20, VH - 16);
    const P = proj(C);

    const g = mk("g", {}, svg);
    shadow(g, flat(P, rrect(-PX, -PY + 3, PX, PY + 3, 4), 0));
    solid(g).put(slab(C, P, -PX, -PY, PX, PY, 4, 0, PZ));
    line(g, "lo").setAttribute("d", flat(P, rrect(-PX + 2, -PY + 2, PX - 2, PY - 2, 2.5), PZ));
    // screws at each end
    const slots: string[] = [];
    for (const x of [-PX + 6, PX - 6]) {
      solid(g).put(cyl(C, P, x, 0, 2.1, PZ, PZ + 0.7, 20));
      const a = rad(-20);
      slots.push(seg(P(x - Math.cos(a) * 1.5, -Math.sin(a) * 1.5, PZ + 0.7), P(x + Math.cos(a) * 1.5, Math.sin(a) * 1.5, PZ + 0.7)));
    }
    line(g, "edge").setAttribute("d", slots.join(""));

    // the slot, and the accent run from its start to the cap
    const slotEl = mk("path", { class: "k-slot", d: flat(P, rrect(-L - 1.6, -1.6, L + 1.6, 1.6, 1.6), PZ) }, g);
    void slotEl;
    const lit = line(g, "accent");
    // the ruler on the near side; a second, finer one behind
    const front = line(g, "mid"), frontMajor = line(g, "edge"), back = line(g, "lo");
    const ends = line(g, "edge");
    ends.setAttribute("d", seg(P(-L, -3.4, PZ), P(-L, -6, PZ)) + seg(P(L, -3.4, PZ), P(L, -6, PZ)));

    // the cap: a body, a top plate with grip grooves, and the lit index line
    const capG = mk("g", {}, g);
    const body = solid(capG), lid = solid(capG);
    const grooves = line(capG, "lo"), index = line(capG, "hi");

    const r = range(ctx, o, "range", "Slider", () => B.wake());
    let opts = o;
    const xOf = (t: number) => -L + 2 * L * t;
    const sp = spring(xOf(r.t), { k: 260, c: 30, eps: 0.02 });

    function drawRuler() {
      const span = r.max - r.min, steps = r.step > 0 ? Math.round(span / r.step) : 0;
      const n = steps > 0 && steps <= 40 ? steps : 40;
      const every = n % 4 === 0 ? n / 4 : n % 5 === 0 ? n / 5 : n % 2 === 0 ? n / 2 : n;
      const t = rulerX(P, -L, L, n, Math.max(1, every), 4, 2.4, 4.6, PZ);
      front.setAttribute("d", t.minor);
      frontMajor.setAttribute("d", t.major);
      back.setAttribute("d", rulerX(P, -L, L, 8, 1, -4, -1.6, -1.6, PZ).minor);
    }
    drawRuler();

    function drawCap(x: number) {
      const z0 = PZ, z1 = PZ + CAP.h - 1.6, z2 = PZ + CAP.h;
      body.put(slab(C, P, x - CAP.w, -CAP.d, x + CAP.w, CAP.d, 1.6, z0, z1));
      lid.put(slab(C, P, x - CAP.w + 0.8, -CAP.d + 0.8, x + CAP.w - 0.8, CAP.d - 0.8, 1.2, z1, z2));
      const gs: string[] = [];
      for (const dy of [-9, -6.5, -4, 4, 6.5, 9]) gs.push(seg(P(x - CAP.w + 1.8, dy, z2), P(x + CAP.w - 1.8, dy, z2)));
      grooves.setAttribute("d", gs.join(""));
      index.setAttribute("d", seg(P(x, -2, z2), P(x, 2, z2)) + seg(P(x, CAP.d - 0.8, z2), P(x, CAP.d - 0.8, z1)));
      lit.setAttribute("d", x > -L + 0.2 ? seg(P(-L, 0, PZ), P(x, 0, PZ)) : "");
    }

    const B = register(host, (dt) => {
      sp.t = xOf(r.t);
      const m = stepS(sp, dt);
      drawCap(sp.x);
      return m;
    });
    bag.add(B.unregister);

    // pointer: the x on the strip's top under the pointer is the value
    host.setAttribute("data-knurl-hit", "");
    let drag = false;
    const valueAt = (e: PointerEvent) => {
      const [sx, sy] = toView(svg, e, VW, VH);
      const [x] = unproj(C, sx, sy, PZ + CAP.h / 2);
      return r.min + ((x + L) / (2 * L)) * (r.max - r.min);
    };
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0) return;
      drag = true;
      host.setPointerCapture?.(e.pointerId);
      r.input.focus({ preventScroll: true });
      sp.k = 900; sp.c = 60; // follow a hand closely
      r.ask(valueAt(e));
      e.preventDefault();
    });
    bag.on(host, "pointermove", (e) => { if (drag) r.ask(valueAt(e)); });
    const end = () => { if (!drag) return; drag = false; sp.k = 260; sp.c = 30; r.commit(); };
    bag.on(host, "pointerup", end);
    bag.on(host, "pointercancel", end);

    bag.add(() => { r.destroy(); host.removeAttribute("data-knurl-hit"); svg.replaceChildren(); });

    return {
      update(next) {
        opts = next;
        const before = `${r.min},${r.max},${r.step}`;
        r.update(next);
        if (`${r.min},${r.max},${r.step}` !== before) drawRuler();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
