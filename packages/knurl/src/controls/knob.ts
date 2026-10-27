import { camera, circle, cyl, facing, fit, flat, loft, open, proj, rad, radialTicks, rrect, seg, slab, type Vec2, type Vec3 } from "../core/iso";
import { spring, stepS } from "../core/motion";
import { define } from "../core/control";
import { range, RANGE_KEYS, type RangeOptions } from "../core/range";
import { disposer, line, mk, register, shadow, solid } from "../core/stage";

/**
 * Knob — a rotary value, built as a knurled knob on a panel.
 *
 * A skirt, a tapered body whose knurl turns with it, and a cap with a lit
 * index line, over a 270° scale on the panel. The scale is lit from its start
 * to the index. Drag up or down, scroll, or use the arrow keys; the knob turns
 * on a spring.
 *
 * Semantics come from a visually hidden `<input type="range">`.
 */

export type KnobOptions = RangeOptions;

const VW = 200, VH = 170;
const A0 = rad(90), SPAN = rad(270); // the scale starts at the lower left and runs clockwise on screen

export const knob = define<KnobOptions>({
  id: "knob",
  label: "Knob",
  vw: VW,
  vh: VH,
  width: 150,
  keys: RANGE_KEYS,
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    const C = camera(45, 32);
    const PH = 32, PZ = 4, R = 13.5, RS = 15.5;
    const ext: Vec3[] = [[-PH, -PH, 0], [PH, PH, 0], [-PH, PH, 0], [PH, -PH, 0], [0, 0, PZ + 16]];
    fit(C, ext, VW / 2, VH / 2 + 2, VW - 18, VH - 14);
    const P = proj(C), front = facing(C);

    const g = mk("g", {}, svg);
    shadow(g, flat(P, rrect(-PH, -PH + 3, PH, PH + 3, 5), 0));
    solid(g).put(slab(C, P, -PH, -PH, PH, PH, 5, 0, PZ));
    line(g, "lo").setAttribute("d", flat(P, rrect(-PH + 2, -PH + 2, PH - 2, PH - 2, 3), PZ));
    const screwSlots: string[] = [];
    for (const [x, y] of [[-PH + 4.5, -PH + 4.5], [PH - 4.5, -PH + 4.5], [-PH + 4.5, PH - 4.5], [PH - 4.5, PH - 4.5]]) {
      solid(g).put(cyl(C, P, x, y, 2, PZ, PZ + 0.7, 20));
      screwSlots.push(seg(P(x - 1.4, y + 0.6, PZ + 0.7), P(x + 1.4, y - 0.6, PZ + 0.7)));
    }
    line(g, "edge").setAttribute("d", screwSlots.join(""));

    // the scale
    const ticks = radialTicks(P, 0, 0, 24.5, PZ, 30, A0, SPAN, 5, 1.6, 3.6);
    line(g, "mid").setAttribute("d", ticks.minor);
    line(g, "edge").setAttribute("d", ticks.major);
    const arc = line(g, "accent");
    const arcAt = (a: number) => open(Array.from({ length: 49 }, (_, k): Vec2 => {
      const t = A0 + ((a - A0) * k) / 48;
      return P(Math.cos(t) * 26.6, Math.sin(t) * 26.6, PZ);
    }));
    line(g, "lo").setAttribute("d", arcAt(A0 + SPAN));
    const arcLit = arc;

    // the knob: skirt with its pointer notch, knurled body, cap
    solid(g).put(cyl(C, P, 0, 0, RS + 1, PZ, PZ + 0.6, 48)); // washer
    const skirt = solid(g), body = solid(g), cap = solid(g);
    const knurl = line(g, "lo"), notch = line(g, "hi"), index = line(g, "hi"), capRing = line(g, "lo");
    const zS0 = PZ + 0.6, zS1 = zS0 + 2.4, zB1 = zS1 + 8, zC1 = zB1 + 1.2;
    skirt.put(cyl(C, P, 0, 0, RS, zS0, zS1, 64));
    body.put(loft(C, P, circle(0, 0, R, 64), zS1, zB1, circle(0, 0, R - 1.4, 64)));
    cap.put(cyl(C, P, 0, 0, R - 2.2, zB1, zC1, 56));
    capRing.setAttribute("d", flat(P, circle(0, 0, R - 4.4, 48), zC1));

    function drawKnob(a: number) {
      // knurl: vertical ribs that face the viewer, turning with the knob
      const ribs: string[] = [];
      const N = 36;
      for (let k = 0; k < N; k++) {
        const t = a + (k / N) * Math.PI * 2, ca = Math.cos(t), sa = Math.sin(t);
        if (!front(ca, sa) || ca * Math.sin(rad(45)) + sa * Math.cos(rad(45)) < 0.12) continue;
        ribs.push(seg(P(ca * R, sa * R, zS1 + 1), P(ca * (R - 1.4), sa * (R - 1.4), zB1 - 0.8)));
      }
      knurl.setAttribute("d", ribs.join(""));
      const ca = Math.cos(a), sa = Math.sin(a);
      index.setAttribute("d", seg(P(ca * 3, sa * 3, zC1), P(ca * (R - 3.2), sa * (R - 3.2), zC1)));
      notch.setAttribute("d", front(ca, sa) ? seg(P(ca * RS, sa * RS, zS1), P(ca * RS, sa * RS, zS0 + 0.4)) + seg(P(ca * (RS - 2), sa * (RS - 2), zS1), P(ca * RS, sa * RS, zS1)) : "");
      arcLit.setAttribute("d", a > A0 + 0.01 ? arcAt(a) : "");
    }

    const r = range(ctx, o, "range", "Knob", () => B.wake());
    let opts = o;
    const angleOf = (t: number) => A0 + SPAN * t;
    const sp = spring(angleOf(r.t), { k: 220, c: 26, eps: 0.002 });
    const B = register(host, (dt) => {
      sp.t = angleOf(r.t);
      const m = stepS(sp, dt);
      drawKnob(sp.x);
      return m;
    });
    bag.add(B.unregister);

    // pointer: drag up to turn up; 160px is the whole sweep
    host.setAttribute("data-knurl-hit", "");
    let drag: { y: number; v: number } | null = null;
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0) return;
      drag = { y: e.clientY, v: r.value };
      host.setPointerCapture?.(e.pointerId);
      r.input.focus({ preventScroll: true });
      e.preventDefault();
    });
    bag.on(host, "pointermove", (e) => {
      if (!drag) return;
      const fine = e.shiftKey ? 0.2 : 1;
      r.ask(drag.v + ((drag.y - e.clientY) / 160) * (r.max - r.min) * fine);
    });
    const end = () => { if (drag) { drag = null; r.commit(); } };
    bag.on(host, "pointerup", end);
    bag.on(host, "pointercancel", end);
    bag.on(host, "wheel", (e) => {
      if (opts.disabled) return;
      e.preventDefault();
      const s = r.step > 0 ? r.step : (r.max - r.min) / 100;
      r.ask(r.value + (e.deltaY < 0 ? s : -s));
      r.commit();
    }, { passive: false });

    bag.add(() => { r.destroy(); host.removeAttribute("data-knurl-hit"); svg.replaceChildren(); });
    return {
      update(next) { opts = next; r.update(next); B.wake(); },
      destroy: bag.dispose,
    };
  },
});
