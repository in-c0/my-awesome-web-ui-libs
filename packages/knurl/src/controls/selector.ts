import { camera, circle, cyl, facing, fit, flat, inset, loft, open, planeMatrix, proj, rad, rrect, seg, slab, unproj, type Ring, type Vec2, type Vec3 } from "../core/iso";
import { spring, stepS } from "../core/motion";
import { define, emit, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid } from "../core/stage";

/**
 * Selector — a select, built as a rotary selector switch on a panel, like an
 * oven's mode dial or a test meter's range switch.
 *
 * A chicken-head pointer knob on a fluted skirt turns between detents. Each
 * position has an engraved legend and a tick on the dial plate around it; the
 * current one is lit and the pointer's tip sits on it. The knob snaps from
 * detent to detent on a stiff spring with a small overshoot. Click a legend,
 * drag around the knob, scroll, or use the arrow keys.
 *
 * Semantics come from visually hidden native radio inputs, so arrow keys,
 * screen readers and forms behave as the platform's own.
 */

export type SelectorOptions = BaseOptions & {
  /** The positions, clockwise. A short legend for each (up to 4 characters). Default ["OFF","LOW","MED","HIGH"]. */
  options?: string[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  controlled?: boolean;
};

const VW = 200, VH = 170;
const AZ = 34, EL = 40;
let uid = 0;

/** The chicken-head's footprint pointing along `a`: a round back and a narrow tip joined by straight flanks. */
function head(a: number, back: number, rb: number, tip: number, rt: number, n1 = 8, n2 = 28): Ring {
  const phi = Math.acos((rb - rt) / (tip + back));
  const ca = Math.cos(a), sa = Math.sin(a), out: Ring = [];
  const push = (cx: number, r: number, t: number) => {
    const ct = Math.cos(t), st = Math.sin(t), lu = cx + r * ct, lv = r * st;
    out.push({ u: lu * ca - lv * sa, v: lu * sa + lv * ca, nu: ct * ca - st * sa, nv: ct * sa + st * ca });
  };
  for (let k = 0; k <= n1; k++) push(tip, rt, -phi + (2 * phi * k) / n1);
  for (let k = 0; k <= n2; k++) push(-back, rb, phi + ((2 * Math.PI - 2 * phi) * k) / n2);
  return out;
}

export const selector = define<SelectorOptions>({
  id: "selector",
  label: "Selector",
  vw: VW,
  vh: VH,
  width: 160,
  keys: ["options", "value", "defaultValue", "onValueChange", "controlled"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg, doc } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(AZ, EL);
    const PH = 40, PD = 37, PZ = 4, DR = 34, DZ = PZ + 0.8; // panel half-width, half-depth, height; dial plate radius and top
    const RW = 14.6, RS = 12, zW = DZ + 1.4, zS0 = zW, zS1 = zS0 + 2.8, zH1 = zS1 + 6; // washer, skirt, head
    const T0 = 21.6, T1 = 24, RL = 28.8; // ticks and legends
    const ext: Vec3[] = [[-PH, -PD, 0], [PH, PD, 0], [-PH, PD, 0], [PH, -PD, 0], [0, 0, zH1]];
    fit(C, ext, VW / 2, VH / 2 + 2, VW - 18, VH - 14);
    const P = proj(C), front = facing(C);
    const az = rad(AZ), cz = Math.cos(az), sz = Math.sin(az);
    // the top of the dial on screen, as a world angle: screen-up on the ground is (-sin az, -cos az)
    const TOP = Math.atan2(-cz, -sz);

    const g = mk("g", {}, svg);
    const group = doc.createElement("div");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("data-knurl-sr", "");
    host.appendChild(group);
    host.setAttribute("data-knurl-hit", "");
    const gname = "knurl-selector-" + ++uid;

    // the panel on four screws, and the dial plate
    shadow(g, flat(P, rrect(-PH, -PD + 3, PH, PD + 3, 5), 0));
    solid(g).put(slab(C, P, -PH, -PD, PH, PD, 5, 0, PZ));
    line(g, "lo").setAttribute("d", flat(P, rrect(-PH + 2, -PD + 2, PH - 2, PD - 2, 3), PZ));
    const slots: string[] = [];
    for (const [x, y] of [[-PH + 4.5, -PD + 4.5], [PH - 4.5, -PD + 4.5], [-PH + 4.5, PD - 4.5], [PH - 4.5, PD - 4.5]]) {
      solid(g).put(cyl(C, P, x, y, 2, PZ, PZ + 0.7, 20));
      slots.push(seg(P(x - 1.4, y - 0.5, PZ + 0.7), P(x + 1.4, y + 0.5, PZ + 0.7)));
    }
    line(g, "edge").setAttribute("d", slots.join(""));
    solid(g).put(cyl(C, P, 0, 0, DR, PZ, DZ, 72));
    line(g, "lo").setAttribute("d", flat(P, circle(0, 0, DR - 1.6, 72), DZ));
    // two countersunk screws hold the dial plate, low on its front
    const plate: string[] = [];
    for (const a of [TOP + Math.PI - rad(24), TOP + Math.PI + rad(24)]) {
      const x = Math.cos(a) * (DR - 6), y = Math.sin(a) * (DR - 6);
      solid(g).put(cyl(C, P, x, y, 1.5, DZ, DZ + 0.4, 18));
      plate.push(seg(P(x - 1, y + 0.4, DZ + 0.4), P(x + 1, y - 0.4, DZ + 0.4)));
    }
    line(g, "edge").setAttribute("d", plate.join(""));

    // the scale: rebuilt with the positions
    const scale = mk("g", {}, g);

    // the knob: the panel nut, fluted skirt, chicken head and its pointer line
    const hex: Ring = Array.from({ length: 6 }, (_, k) => {
      const t = TOP + Math.PI / 6 + (k * Math.PI) / 3;
      return { u: Math.cos(t) * RW, v: Math.sin(t) * RW, nu: Math.cos(t), nv: Math.sin(t) };
    });
    solid(g).put(loft(C, P, hex, DZ, zW));
    const skirt = solid(g);
    skirt.put(cyl(C, P, 0, 0, RS, zS0, zS1, 64));
    const flutes = line(g, "lo");
    line(g, "lo").setAttribute("d", flat(P, circle(0, 0, RS - 1.4, 56), zS1));
    const body = solid(g);
    const pointer = line(g, "hi"), spine = line(g, "lo");

    function drawKnob(a: number) {
      const ribs: string[] = [];
      const N = 40, vu = Math.sin(az), vv = Math.cos(az);
      for (let k = 0; k < N; k++) {
        const t = a + (k / N) * Math.PI * 2, ca = Math.cos(t), sa = Math.sin(t);
        if (!front(ca, sa) || ca * vu + sa * vv < 0.15) continue;
        ribs.push(seg(P(ca * RS, sa * RS, zS0 + 0.5), P(ca * RS, sa * RS, zS1 - 0.4)));
      }
      flutes.setAttribute("d", ribs.join(""));
      const foot = head(a, 3.6, 6.4, 16, 1.9);
      body.put(loft(C, P, foot, zS1, zH1, inset(foot, 1.3)));
      const ca = Math.cos(a), sa = Math.sin(a), na = -sa, nb = ca;
      // the pointer line from the hub to the tip, and the seam across the back where the head meets its round
      pointer.setAttribute("d", seg(P(ca * 1.6, sa * 1.6, zH1), P(ca * 14, sa * 14, zH1)));
      spine.setAttribute("d", seg(P(ca * -3.6 + na * 5.1, sa * -3.6 + nb * 5.1, zH1), P(ca * -3.6 - na * 5.1, sa * -3.6 - nb * 5.1, zH1)));
    }

    type Pos = { v: string; a: number; tick: SVGPathElement; text: SVGTextElement; input: HTMLInputElement };
    let pos: Pos[] = [];
    let value = "", STEP = rad(50);
    const list = () => (Array.isArray(opts.options) && opts.options.length ? opts.options.map(String) : ["OFF", "LOW", "MED", "HIGH"]);
    const index = () => Math.max(0, pos.findIndex((p) => p.v === value));

    function build() {
      scale.replaceChildren();
      group.replaceChildren();
      const opt = list(), n = opt.length;
      STEP = n > 1 ? Math.min(rad(50), rad(270) / (n - 1)) : 0;
      const A = (i: number) => TOP + (i - (n - 1) / 2) * STEP;
      // the arc that ties the ticks together, ending on the first and last
      if (n > 1) line(scale, "mid").setAttribute("d", open(Array.from({ length: 49 }, (_, k): Vec2 => {
        const t = A(0) + ((A(n - 1) - A(0)) * k) / 48;
        return P(Math.cos(t) * T0, Math.sin(t) * T0, DZ);
      })));
      const u: Vec3 = [cz, -sz, 0], v: Vec3 = [sz, cz, 0];
      pos = opt.map((label, i) => {
        const a = A(i), ca = Math.cos(a), sa = Math.sin(a);
        const tick = line(scale, "edge");
        tick.setAttribute("d", seg(P(ca * T0, sa * T0, DZ), P(ca * T1, sa * T1, DZ)));
        const text = mk("text", { class: "k-text", "text-anchor": "middle" }, scale) as SVGTextElement;
        const s = label.slice(0, 4);
        text.textContent = s;
        text.style.fontSize = s.length > 2 ? "4.3px" : "5px";
        // legends sit a little further out where they are long and lie along the radius
        const rl = RL + Math.abs(ca * cz - sa * sz) * (s.length - 2) * 1.1;
        text.setAttribute("transform", planeMatrix(P, [ca * rl, sa * rl, DZ], u, v) + " translate(0 1.6)");
        const input = doc.createElement("input");
        input.type = "radio"; input.value = label;
        input.setAttribute("aria-label", label);
        group.appendChild(input);
        return { v: label, a, tick, text, input };
      });
      const first = opts.value ?? (value || undefined) ?? opts.defaultValue;
      value = opt.includes(first as string) ? (first as string) : opts.defaultValue && opt.includes(opts.defaultValue) ? opts.defaultValue : opt[0];
      sync();
    }

    function sync() {
      group.setAttribute("aria-label", opts.label ?? "Selector");
      host.setAttribute("data-state", value);
      for (const p of pos) {
        const on = p.v === value;
        p.input.checked = on;
        p.input.disabled = !!opts.disabled;
        p.input.name = opts.name || gname;
        p.tick.setAttribute("class", on ? "k-line accent" : "k-line edge");
        p.text.setAttribute("class", on ? "k-text hi" : "k-text");
      }
    }

    build();
    // a detent: a stiff spring that overshoots a little and settles
    const sp = spring(pos[index()]?.a ?? TOP, { k: 420, c: 25, eps: 0.0015 });
    const B = register(host, (dt) => {
      sp.t = pos[index()]?.a ?? TOP;
      const m = stepS(sp, dt);
      drawKnob(sp.x);
      return m;
    });
    bag.add(B.unregister);

    const ask = (v: string) => {
      if (v === value) return;
      if (opts.controlled) { sync(); emit(opts.onValueChange, v); return; }
      value = v; sync(); B.wake(); emit(opts.onValueChange, v);
    };
    bag.on(group, "change", (e) => { const t = e.target as HTMLInputElement; if (t.checked) ask(t.value); });

    // pointer: on the dial plate, a legend or tick jumps there; on the knob, a drag turns it through the detents
    const at = (e: PointerEvent, z: number) => {
      const r = svg.getBoundingClientRect();
      return unproj(C, ((e.clientX - r.left) / (r.width || 1)) * VW, ((e.clientY - r.top) / (r.height || 1)) * VH, z);
    };
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    const nearest = (a: number) => {
      let best = -1, d = 1e9;
      pos.forEach((p, i) => { const x = Math.abs(wrap(a - p.a)); if (x < d) { d = x; best = i; } });
      return { i: best, d };
    };
    const choose = (i: number) => { const p = pos[i]; if (!p) return; p.input.focus({ preventScroll: true }); ask(p.v); };
    let drag: { a: number; turn: number; i: number } | null = null;
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0 || !pos.length) return;
      const [x, y] = at(e, DZ), r = Math.hypot(x, y);
      const [kx, ky] = at(e, zH1), rk = Math.hypot(kx, ky);
      if (rk <= RS + 3 || r <= RS + 2) {
        drag = { a: Math.atan2(ky, kx), turn: 0, i: index() };
        host.setPointerCapture?.(e.pointerId);
        pos[index()].input.focus({ preventScroll: true });
        e.preventDefault();
        return;
      }
      if (r > DR + 6) return;
      const hit = nearest(Math.atan2(y, x));
      if (hit.i >= 0 && hit.d <= Math.max(STEP * 0.5, rad(18))) { choose(hit.i); e.preventDefault(); }
    });
    bag.on(host, "pointermove", (e) => {
      if (!drag || !STEP) return;
      const [x, y] = at(e, zH1);
      if (Math.hypot(x, y) < 1.5) return;
      // add up the turn a little at a time, so a long drag doesn't wrap at half a turn
      const a = Math.atan2(y, x);
      drag.turn += wrap(a - drag.a); drag.a = a;
      const i = Math.max(0, Math.min(pos.length - 1, Math.round(drag.i + drag.turn / STEP)));
      if (pos[i].v !== value) { pos[i].input.focus({ preventScroll: true }); ask(pos[i].v); }
    });
    const end = () => { drag = null; };
    bag.on(host, "pointerup", end);
    bag.on(host, "pointercancel", end);
    bag.on(host, "wheel", (e) => {
      if (opts.disabled || !pos.length) return;
      e.preventDefault();
      choose(Math.max(0, Math.min(pos.length - 1, index() + (e.deltaY < 0 ? 1 : -1))));
    }, { passive: false });

    bag.add(() => { group.remove(); host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state"); svg.replaceChildren(); });
    return {
      update(next, prev) {
        opts = next;
        if (next.value !== undefined && next.value !== value) value = next.value;
        if (JSON.stringify(next.options) !== JSON.stringify(prev.options)) build(); else sync();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
