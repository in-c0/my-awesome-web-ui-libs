import { camera, circle, cuboid, cyl, fit, flat, planeMatrix, poly, poly3, proj, rrect, seg, slab, unproj, type Vec3 } from "../core/iso";
import { reducedMotion, spring, stepS, type Spring } from "../core/motion";
import { define, emit, num, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, toView, type Solid } from "../core/stage";

/**
 * Dip — a bit field, built as a DIP switch on a circuit board.
 *
 * A moulded package stands on its gull-wing pins over the board's pads,
 * with a row of tiny sliders in their slots, an ON legend and arrow along
 * one edge and the positions numbered along the other. Each slider is one
 * bit; behind the switch a row of indicator LEDs, each wired by a trace to
 * its switch, lights for every bit that is on. A slider snaps across on a
 * stiff spring and rebounds off the end of its slot; a press pushes it most
 * of the way at once and the click commits it. Hovering a position with a
 * mouse nudges its slider toward the other end. A click anywhere on the
 * switch or the board flips the nearest position.
 *
 * The value is a bitmask: position 1 is bit 0. Semantics come from visually
 * hidden native checkboxes in a `role="group"`.
 */

export type DipOptions = BaseOptions & {
  /** How many positions, 2 to 12. Default 8. */
  count?: number;
  /** Controlled bitmask: bit i is position i + 1. Pair with onValueChange. */
  value?: number;
  /** Starting bitmask when uncontrolled. Default 0. */
  defaultValue?: number;
  /** Called with the new bitmask. */
  onValueChange?: (value: number) => void;
  /** Accessible names for the positions, in order. Default "Switch 1", "Switch 2"… */
  labels?: string[];
  /** Set by the React wrapper when `value` is controlled. */
  controlled?: boolean;
};

const VW = 260, VH = 150;
const LEAN = 0.2;  // how far a hover nudges a slider, as a share of its travel
const PUSH = 0.6;  // how far a held press takes it

export const dip = define<DipOptions>({
  id: "dip",
  label: "DIP switch",
  vw: VW,
  vh: VH,
  width: 240,
  keys: ["count", "value", "defaultValue", "onValueChange", "labels", "controlled"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg, doc } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(30, 42);
    let P = proj(C);
    const g = mk("g", {}, svg);
    const group = doc.createElement("div");
    group.setAttribute("role", "group");
    group.setAttribute("data-knurl-sr", "");
    host.appendChild(group);
    host.setAttribute("data-knurl-hit", "");

    // the board, the package on its standoff, a slot and its slider's travel
    const PITCH = 4.4, BY = 8, ZB = 1.6, BZ0 = ZB + 0.9, BZ1 = BZ0 + 4, SW = 1.55, SL = 3.7, KH = 1.5, KD = 1.15;
    type Pos = { i: number; x: number; input: HTMLInputElement; slider: Solid; grip: SVGPathElement; led: SVGPathElement; glow: SVGPathElement; num: SVGTextElement; sp: Spring; drawn: number };
    let pos: Pos[] = [];
    let n = 8, BX = 0;
    let bits = 0, first = true;
    let hover = -1, held = -1, focus = -1;
    let still: { x: number; y: number } | null = null;

    const count = () => Math.max(2, Math.min(12, Math.round(num(opts.count, 8))));
    const mask = (v: number) => (Math.round(v) >>> 0) & ((1 << n) - 1);
    const isOn = (i: number) => ((bits >> i) & 1) === 1;

    function build() {
      g.replaceChildren();
      group.replaceChildren();
      n = count();
      bits = mask(num(opts.value, first ? num(opts.defaultValue, 0) : bits));
      first = false;
      BX = (n * PITCH) / 2 + 1.8;
      const PX = BX + 9, PY0 = -BY - 15, PY1 = BY + 9;
      const ext: Vec3[] = [[-PX, PY0, 0], [PX, PY1, 0], [-PX, PY1, 0], [PX, PY0, 0], [-BX, -BY, BZ1 + 1.5], [BX, -BY, BZ1 + 1.5]];
      fit(C, ext, VW / 2, VH / 2 + 2, VW - 20, VH - 16);
      P = proj(C);
      const xs = Array.from({ length: n }, (_, i) => -BX + 1.8 + PITCH / 2 + i * PITCH);

      // the board: its four plated mounting holes, the switch's silkscreen outline, a pin-1 dot and the designator
      shadow(g, flat(P, rrect(-PX, PY0 + 3, PX, PY1 + 3, 2.5), 0));
      solid(g).put(slab(C, P, -PX, PY0, PX, PY1, 2.5, 0, ZB));
      const holes: string[] = [];
      for (const [x, y] of [[-PX + 3.6, PY0 + 3.6], [PX - 3.6, PY0 + 3.6], [-PX + 3.6, PY1 - 3.6], [PX - 3.6, PY1 - 3.6]]) {
        holes.push(flat(P, circle(x, y, 2.3, 24), ZB));
        mk("path", { class: "k-slot", d: flat(P, circle(x, y, 1.2, 20), ZB) }, g);
      }
      line(g, "edge").setAttribute("d", holes.join(""));
      line(g, "lo").setAttribute("d", flat(P, rrect(-BX - 1.6, -BY - 3.2, BX + 1.6, BY + 3.2, 0.6), ZB));
      mk("path", { class: "k-dot mid", d: flat(P, circle(-BX - 3.4, BY + 2.4, 0.6, 12), ZB) }, g);
      const sw = mk("text", { class: "k-text" }, g) as SVGTextElement;
      sw.textContent = "SW1";
      sw.style.fontSize = "2.8px";
      sw.setAttribute("transform", planeMatrix(P, [-BX - 1.6, BY + 6.4, ZB], [1, 0, 0], [0, 1, 0]));

      // the LED row behind the switch, each with its resistor and a trace to its back pin
      const LY = -BY - 9.5, leds: { led: SVGPathElement; glow: SVGPathElement }[] = [];
      const traces: string[] = [];
      for (const x of xs) traces.push(seg(P(x, LY + 1.1, ZB), P(x, -BY - 2.2, ZB)), seg(P(x, LY - 1.1, ZB), P(x, LY - 2.6, ZB)));
      line(g, "lo").setAttribute("d", traces.join(""));
      for (const x of xs) {
        mk("path", { class: "k-face", d: flat(P, rrect(x - 1.2, LY - 4.6, x + 1.2, LY - 2.6, 0.2), ZB) }, g);
        solid(g).put(slab(C, P, x - 0.75, LY - 4.4, x + 0.75, LY - 2.8, 0.1, ZB, ZB + 0.5));
        solid(g).put(slab(C, P, x - 1.1, LY - 1.1, x + 1.1, LY + 1.1, 0.25, ZB, ZB + 0.7));
        const glow = mk("path", { class: "k-glow", d: flat(P, circle(x, LY, 2.2, 20), ZB + 0.8) }, g);
        const led = mk("path", { class: "k-led", d: flat(P, rrect(x - 0.75, LY - 0.75, x + 0.75, LY + 0.75, 0.3), ZB + 0.7) }, g);
        leds.push({ led, glow });
      }

      // a gull-wing pin: the stub out of the package's side, and the leg down to its pad
      const pin = (x: number, side: 1 | -1) => {
        const y0 = side * BY, y1 = side * (BY + 1.5);
        mk("path", { class: "k-face", d: flat(P, rrect(x - 0.95, Math.min(y1 - side * 0.9, y1 + side * 0.9), x + 0.95, Math.max(y1 - side * 0.9, y1 + side * 0.9), 0.2), ZB) }, g);
        solid(g).put(slab(C, P, x - 0.5, Math.min(y0, y1), x + 0.5, Math.max(y0, y1), 0, BZ0 + 0.6, BZ0 + 1.2));
        solid(g).put(slab(C, P, x - 0.5, Math.min(y1 - side * 0.55, y1), x + 0.5, Math.max(y1 - side * 0.55, y1), 0, ZB, BZ0 + 1.2));
      };
      for (const x of xs) pin(x, -1);

      // the package: body, ejector-pin dimples, the ON arrow and legend, numbered positions and the slots
      solid(g).put(slab(C, P, -BX, -BY, BX, BY, 0.6, BZ0, BZ1));
      line(g, "lo").setAttribute("d", flat(P, circle(-BX + 1.6, -BY + 1.9, 0.7, 14), BZ1) + flat(P, circle(BX - 1.6, -BY + 1.9, 0.7, 14), BZ1));
      const ay = -BY + 1.6;
      line(g, "edge").setAttribute("d", seg(P(-BX + 4, ay, BZ1), P(-BX + 9, ay, BZ1)) + poly([P(-BX + 3, ay, BZ1), P(-BX + 4.2, ay - 0.7, BZ1), P(-BX + 4.2, ay + 0.7, BZ1)]));
      const onT = mk("text", { class: "k-text hi" }, g) as SVGTextElement;
      onT.textContent = "ON";
      onT.style.fontSize = "2.4px";
      onT.setAttribute("transform", planeMatrix(P, [-BX + 9.8, ay, BZ1], [1, 0, 0], [0, 1, 0]) + " translate(0 0.85)");
      for (const x of xs) mk("path", { class: "k-slot", d: flat(P, rrect(x - SW, -SL, x + SW, SL, 0.35), BZ1) }, g);

      const labels = Array.isArray(opts.labels) ? opts.labels : [];
      pos = xs.map((x, i) => {
        const t = mk("text", { class: "k-text", "text-anchor": "middle" }, g) as SVGTextElement;
        t.textContent = String(i + 1);
        t.style.fontSize = "2.3px";
        t.setAttribute("transform", planeMatrix(P, [x, BY - 1.6, BZ1], [1, 0, 0], [0, 1, 0]) + " translate(0 0.8)");
        const input = doc.createElement("input");
        input.type = "checkbox";
        input.value = String(1 << i);
        input.setAttribute("aria-label", labels[i] != null && String(labels[i]) ? String(labels[i]) : `Switch ${i + 1}`);
        group.appendChild(input);
        return { i, x, input, slider: null as unknown as Solid, grip: null as unknown as SVGPathElement, led: leds[i].led, glow: leds[i].glow, num: t, sp: spring(isOn(i) ? 1 : 0, { k: 420, c: 18, eps: 0.004 }), drawn: NaN };
      });
      // the sliders, left to right (with the camera at 30°, +x is nearer)
      for (const p of pos) { const sg = mk("g", {}, g); p.slider = solid(sg); p.grip = line(sg, "lo"); }
      // the near pins stand in front of the package
      for (const x of xs) pin(x, 1);
      hover = held = focus = -1;
      sync();
      for (const p of pos) drawSlider(p, p.sp.x);
    }

    /** A slider at `s` along its slot: 0 is off (near), 1 is on (far, toward the ON legend). */
    function drawSlider(p: Pos, s: number) {
      if (s === p.drawn) return;
      p.drawn = s;
      const y = SL - KD - 0.25 - s * (2 * SL - 2 * KD - 0.5);
      const b = cuboid([p.x, y, BZ1 + KH / 2 - 0.2], SW - 0.35, KD, KH / 2);
      p.slider.put(poly3(C, P, b.verts, b.faces));
      const z = BZ1 + KH - 0.2;
      p.grip.setAttribute("d", seg(P(p.x - 0.8, y - 0.35, z), P(p.x + 0.8, y - 0.35, z)) + seg(P(p.x - 0.8, y + 0.35, z), P(p.x + 0.8, y + 0.35, z)));
    }

    function sync() {
      group.setAttribute("aria-label", opts.label ?? "DIP switch");
      host.setAttribute("data-state", String(bits));
      for (const p of pos) {
        const lit = isOn(p.i);
        p.input.checked = lit;
        p.input.disabled = !!opts.disabled;
        if (opts.name) p.input.name = opts.name; else p.input.removeAttribute("name");
        p.led.classList.toggle("on", lit);
        p.glow.classList.toggle("on", lit);
        p.slider?.lit(lit);
        p.num.setAttribute("class", p.i === focus || p.i === hover ? "k-text hi" : "k-text");
      }
    }

    const target = (p: Pos) => {
      const b = isOn(p.i) ? 1 : 0, dir = b ? -1 : 1;
      if (p.i === held) return b + dir * PUSH;
      return p.i === hover && !still ? b + dir * LEAN : b;
    };
    // the slider rebounds off each end of its slot
    const stopAt = (s: number) => (s > 1 ? 2 - s : s < 0 ? -s : s);

    build();
    const B = register(host, (dt) => {
      let moving = false;
      for (const p of pos) {
        p.sp.t = target(p);
        p.sp.c = p.i === held ? 32 : 18;
        if (stepS(p.sp, dt)) moving = true;
        drawSlider(p, stopAt(p.sp.x));
      }
      return moving;
    });
    bag.add(B.unregister);
    if (reducedMotion()) for (const p of pos) drawSlider(p, p.sp.t);

    const ask = (p: Pos, on: boolean) => {
      if (on === isOn(p.i)) { p.input.checked = on; return; }
      const next = on ? bits | (1 << p.i) : bits & ~(1 << p.i);
      if (opts.controlled) { p.input.checked = !on; emit(opts.onValueChange, next >>> 0); return; }
      bits = next >>> 0; sync(); B.wake(); emit(opts.onValueChange, bits);
    };
    bag.on(group, "change", (e) => { const p = pos.find((x) => x.input === e.target); if (p) ask(p, p.input.checked); });

    // pointer: the nearest position along the package, wherever the pointer is
    const posAt = (e: { clientX: number; clientY: number }) => {
      if (!pos.length) return -1;
      const q = toView(svg, e, VW, VH);
      const [x] = unproj(C, q[0], q[1], BZ1);
      return Math.max(0, Math.min(n - 1, Math.round((x - pos[0].x) / PITCH)));
    };
    const setHover = (i: number) => { if (i !== hover) { hover = i; sync(); B.wake(); } };
    const hold = (i: number) => { if (i !== held) { held = i; B.wake(); } };
    bag.on(host, "pointermove", (e) => {
      if (e.pointerType !== "mouse" || opts.disabled) return;
      if (still && Math.hypot(e.clientX - still.x, e.clientY - still.y) > 6) { still = null; B.wake(); }
      setHover(posAt(e));
    });
    bag.on(host, "pointerleave", () => { still = null; hold(-1); setHover(-1); });
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0 || e.target instanceof HTMLInputElement) return;
      const i = posAt(e);
      if (i < 0) return;
      pos[i].input.focus({ preventScroll: true });
      hold(i);
    });
    bag.on(host, "pointerup", (e) => { if (held >= 0) still = { x: e.clientX, y: e.clientY }; hold(-1); });
    bag.on(host, "pointercancel", () => hold(-1));
    bag.on(host, "click", (e) => {
      if (opts.disabled || e.target instanceof HTMLInputElement) return;
      const p = pos[posAt(e)];
      if (!p) return;
      p.input.focus({ preventScroll: true });
      ask(p, !isOn(p.i));
    });
    bag.on(group, "keydown", (e) => { const p = pos.find((x) => x.input === e.target); if (p && e.key === " " && !opts.disabled) hold(p.i); });
    bag.on(group, "keyup", (e) => { if (e.key === " ") hold(-1); });
    bag.on(group, "focusin", (e) => { const p = pos.find((x) => x.input === e.target); focus = p ? p.i : -1; sync(); });
    bag.on(group, "focusout", () => { focus = -1; hold(-1); sync(); });

    bag.add(() => { group.remove(); host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state"); svg.replaceChildren(); });
    return {
      update(next, prev) {
        opts = next;
        if (count() !== n || JSON.stringify(next.labels) !== JSON.stringify(prev.labels)) {
          if (typeof next.value === "number") bits = next.value;
          build();
        } else {
          if (typeof next.value === "number") bits = mask(next.value);
          sync();
        }
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
