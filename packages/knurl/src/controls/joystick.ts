import { bar, camera, circle, cyl, fit, flat, poly, proj, rad, rrect, seg, slab, unproj, type Ring, type SolidPaths, type Vec2, type Vec3 } from "../core/iso";
import { spring, stepS } from "../core/motion";
import { define, emit, nativeInput, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid } from "../core/stage";

/**
 * Joystick — a 2D input, built as an arcade joystick on its mounting plate.
 *
 * A ball top on a steel shaft that pivots below the plate; the dust washer
 * and its boss slide with the shaft, and a square restrictor gate engraved
 * round them shows how far it can go. Push past four tenths and the lamp of
 * that direction (one of eight, like the microswitches under a real stick)
 * lights. The shaft leans toward the pointer while dragging and, on release,
 * springs back to centre with a little overshoot.
 *
 * Semantics come from two visually hidden `<input type="range">`, one per
 * axis (-100…100), so each axis is a slider of its own to the keyboard,
 * screen readers and forms.
 */

export type JoystickValue = { x: number; y: number };

export type JoystickOptions = BaseOptions & {
  /** x to the right and y away from the viewer, each -1…1. */
  value?: JoystickValue;
  defaultValue?: JoystickValue;
  /** Springs back to centre when a drag ends. Default true. Keyboard values stay where they are put. */
  returnToCenter?: boolean;
  /** Called with the new value on every change, by pointer or keyboard. */
  onValueChange?: (value: JoystickValue) => void;
  /** Called once when a drag ends (after the return to centre, if any) or a key press settles. */
  onValueCommit?: (value: JoystickValue) => void;
  /** Set by the React wrapper when `value` is controlled. */
  controlled?: boolean;
};

const VW = 200, VH = 180;
const R2 = (n: number) => Math.round(n * 100) / 100;
const ax = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? R2(Math.max(-1, Math.min(1, n))) : 0);
const clampV = (v: Partial<JoystickValue> | undefined): JoystickValue => ({ x: ax(v?.x), y: ax(v?.y) });
const same = (a: JoystickValue, b: JoystickValue) => a.x === b.x && a.y === b.y;

/** A small rounded rectangle on the ground at (cx, cy), its long side turned to angle `a`. */
function pill(cx: number, cy: number, a: number, hl: number, hw: number, r: number): Ring {
  const c = Math.cos(a), s = Math.sin(a);
  return rrect(-hl, -hw, hl, hw, r, 3).map((q) => ({ u: cx + q.u * c - q.v * s, v: cy + q.u * s + q.v * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c }));
}

export const joystick = define<JoystickOptions>({
  id: "joystick",
  label: "Joystick",
  vw: VW,
  vh: VH,
  width: 160,
  keys: ["value", "defaultValue", "returnToCenter", "onValueChange", "onValueCommit", "controlled"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(25, 32);
    const PH = 31, PZ = 4; // plate half-size and thickness
    const ZP = PZ - 14, L = 38, D = 12; // pivot under the plate, pivot to ball centre, ball travel per unit of value
    const RB = 6.6, RS = 2, RW = 9.5, RO = 4.2; // ball, shaft, washer and boss radii
    const ZW = PZ + 0.7, ZO = ZW + 1.9; // washer top, boss top
    const ZB = ZP + L; // the ball centre, upright
    const ext: Vec3[] = [[-PH, -PH, 0], [PH, PH, 0], [-PH, PH, 0], [PH, -PH, 0]];
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ext.push([x * (D + RB), y * (D + RB), ZB + RB]);
    fit(C, ext, VW / 2, VH / 2 + 2, VW - 18, VH - 14);
    const P = proj(C);
    const S = C.S;

    /** The world direction of a value: x along +x, y away from the viewer along -y. */
    const world = (v: JoystickValue): Vec2 => [v.x * D, -v.y * D];
    /** Where the shaft's axis crosses height z, for a ball offset h. */
    const axisAt = (h: Vec2, z: number): Vec3 => {
      const up = Math.sqrt(Math.max(1, L * L - h[0] * h[0] - h[1] * h[1]));
      const t = (z - ZP) / up;
      return [h[0] * t, h[1] * t, z];
    };

    const g = mk("g", {}, svg);
    // the plate, its bevel, four screws
    shadow(g, flat(P, rrect(-PH, -PH + 3, PH, PH + 3, 5), 0));
    solid(g).put(slab(C, P, -PH, -PH, PH, PH, 5, 0, PZ));
    line(g, "lo").setAttribute("d", flat(P, rrect(-PH + 2, -PH + 2, PH - 2, PH - 2, 3), PZ));
    const slots: string[] = [];
    for (const [x, y] of [[-PH + 5, -PH + 5], [PH - 5, -PH + 5], [-PH + 5, PH - 5], [PH - 5, PH - 5]]) {
      solid(g).put(cyl(C, P, x, y, 2.1, PZ, PZ + 0.7, 20));
      const a = rad(-30);
      slots.push(seg(P(x - Math.cos(a) * 1.5, y - Math.sin(a) * 1.5, PZ + 0.7), P(x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5, PZ + 0.7)));
    }
    line(g, "edge").setAttribute("d", slots.join(""));

    // the restrictor gate, engraved: its inner edge is where the washer stops at full travel
    const corner = axisAt([D, D], ZO);
    const GR = RW + 0.8, GH = corner[0] + GR, GW = 1.3;
    mk("path", { class: "k-slot", "fill-rule": "evenodd", d: flat(P, rrect(-GH - GW, -GH - GW, GH + GW, GH + GW, GR + GW, 8), PZ) + flat(P, rrect(-GH, -GH, GH, GH, GR, 8), PZ) }, g);
    // centre marks on the gate's four sides
    const ticks: string[] = [];
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a), r0 = GH + GW + 1, r1 = r0 + 1.6;
      ticks.push(seg(P(c * r0, s * r0, PZ), P(c * r1, s * r1, PZ)));
    }
    line(g, "mid").setAttribute("d", ticks.join(""));

    // eight direction lamps: a recess, a lens, a glow. Value-space angle k·45°, 0 is right, 90 is away.
    const lamps = Array.from({ length: 8 }, (_, k) => {
      const a = (k * Math.PI) / 4, wa = Math.atan2(-Math.sin(a), Math.cos(a)); // its world angle
      // the four sides' lamps face the gate's flats, the diagonals' its corners
      const r = k % 2 ? (GH - GR) * Math.SQRT2 + GR + GW + 4.6 : GH + GW + 5;
      const cx = Math.cos(wa) * r, cy = Math.sin(wa) * r, along = wa + Math.PI / 2;
      mk("path", { class: "k-slot", d: flat(P, pill(cx, cy, along, 2.5, 1.25, 1.2), PZ) }, g);
      const glow = mk("path", { class: "k-glow", d: flat(P, pill(cx, cy, along, 3.2, 1.8, 1.6), PZ + 0.2) }, g);
      const led = mk("path", { class: "k-led", d: flat(P, pill(cx, cy, along, 1.7, 0.6, 0.6), PZ + 0.05) }, g);
      return { glow, led };
    });

    // moving parts, back to front: the ball's shadow on the plate, washer, boss and its hole, shaft, ball
    const ballShadow = shadow(g, "");
    const washer = solid(g), washerLip = line(g, "lo"), boss = solid(g);
    const hole = mk("path", { class: "k-slot" }, g);
    const shaft = solid(g), collar = solid(g), ball = solid(g);
    const shine = line(g, "lo");

    function band(c: Vec2, r: number, d: Vec2, k1: number, k2: number) {
      const p: Vec2 = [-d[1], d[0]], pts: Vec2[] = [];
      for (let i = 0; i <= 16; i++) { const f = (i / 16) * Math.PI; pts.push([c[0] + r * (Math.cos(f) * p[0] + k1 * Math.sin(f) * d[0]), c[1] + r * (Math.cos(f) * p[1] + k1 * Math.sin(f) * d[1])]); }
      for (let i = 16; i >= 0; i--) { const f = (i / 16) * Math.PI; pts.push([c[0] + r * (Math.cos(f) * p[0] + k2 * Math.sin(f) * d[0]), c[1] + r * (Math.cos(f) * p[1] + k2 * Math.sin(f) * d[1])]); }
      return poly(pts);
    }
    const ellipse = (c: Vec2, rx: number, ry: number, a: number) => poly(Array.from({ length: 24 }, (_, i): Vec2 => {
      const t = (i / 24) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), x = Math.cos(t) * rx, y = Math.sin(t) * ry;
      return [c[0] + x * ca - y * sa, c[1] + x * sa + y * ca];
    }));
    const DARK: Vec2 = [Math.SQRT1_2, Math.SQRT1_2]; // the shadow side of a round part, on screen

    function drawStick(v: JoystickValue) {
      const h = world(v);
      const up = Math.sqrt(L * L - h[0] * h[0] - h[1] * h[1]);
      const b: Vec3 = [h[0], h[1], ZP + up];
      const o3 = axisAt(h, ZO);
      // the shadow straight under the ball
      ballShadow.setAttribute("d", flat(P, circle(b[0] + 1, b[1] + 2, RB * 0.8, 24), PZ));
      washer.put(cyl(C, P, o3[0], o3[1], RW, PZ, ZW, 48));
      washerLip.setAttribute("d", flat(P, circle(o3[0], o3[1], RW - 2.2, 40), ZW));
      boss.put(cyl(C, P, o3[0], o3[1], RO, ZW, ZO, 32));
      hole.setAttribute("d", flat(P, circle(o3[0], o3[1], RS + 0.7, 24), ZO));
      // the shaft: a bar from the hole to the ball, a darker band on its far side and a highlight on its near one
      const s = bar(P, o3, b, RS, RS, 24);
      const A = P(o3[0], o3[1], o3[2]), Bp = P(b[0], b[1], b[2]);
      let n: Vec2 = [Bp[1] - A[1], A[0] - Bp[0]];
      const nl = Math.hypot(n[0], n[1]) || 1; n = [n[0] / nl, n[1] / nl];
      if (n[0] < 0) n = [-n[0], -n[1]];
      const rs = RS * S;
      const at = (q: Vec2, k: number): Vec2 => [q[0] + n[0] * rs * k, q[1] + n[1] * rs * k];
      const shades = ["", "", "", ""];
      shades[0] = poly([at(A, 0.3), at(Bp, 0.3), at(Bp, 1), at(A, 1)]);
      shades[3] = poly([at(A, -0.25), at(Bp, -0.25), at(Bp, -0.75), at(A, -0.75)]);
      shaft.put({ sil: s.sil, shades, top: "", crease: seg(at(A, -0.5), at(Bp, -0.5)) });
      // the collar the ball screws down onto
      const w: Vec3 = [b[0] / L, b[1] / L, (b[2] - ZP) / L];
      const c0: Vec3 = [b[0] - w[0] * (RB + 1.1), b[1] - w[1] * (RB + 1.1), b[2] - w[2] * (RB + 1.1)];
      const c1: Vec3 = [b[0] - w[0] * (RB - 1), b[1] - w[1] * (RB - 1), b[2] - w[2] * (RB - 1)];
      const cb = bar(P, c0, c1, RS + 0.9, RS + 0.9, 24);
      collar.put({ sil: cb.sil, shades: ["", "", "", ""], top: "", crease: "" });
      // the ball: a circle, two shadow bands, and a highlight
      const r = RB * S;
      const sil = poly(Array.from({ length: 48 }, (_, i): Vec2 => [Bp[0] + Math.cos((i / 48) * Math.PI * 2) * r, Bp[1] + Math.sin((i / 48) * Math.PI * 2) * r]));
      const hc: Vec2 = [Bp[0] - 0.36 * r, Bp[1] - 0.4 * r];
      const hl = ellipse(hc, 0.34 * r, 0.21 * r, rad(-38));
      const ballPaths: SolidPaths = { sil, shades: [band(Bp, r, DARK, 1, 0.62), band(Bp, r, DARK, 0.62, 0.12), "", ""], top: hl, crease: "" };
      ball.put(ballPaths);
      shine.setAttribute("d", hl);
      // the lamp of the direction it is pushed, past four tenths
      const m = Math.hypot(v.x, v.y);
      const k = m > 0.4 ? ((Math.round(Math.atan2(v.y, v.x) / (Math.PI / 4)) % 8) + 8) % 8 : -1;
      lamps.forEach((l, i) => { l.led.classList.toggle("on", i === k); l.glow.classList.toggle("on", i === k); });
    }

    // state
    const label = () => opts.label ?? "Joystick";
    const ix = nativeInput(ctx, { type: "range", min: "-100", max: "100", step: "10" });
    const iy = nativeInput(ctx, { type: "range", min: "-100", max: "100", step: "10" });
    let value = clampV(o.value ?? o.defaultValue);
    let asked = value;
    const sx = spring(value.x, { k: 260, c: 17, eps: 0.001 }), sy = spring(value.y, { k: 260, c: 17, eps: 0.001 });
    const word = (n: number, plus: string, minus: string) => (n === 0 ? "centre" : `${Math.round(Math.abs(n) * 100)}% ${n > 0 ? plus : minus}`);
    const sync = () => {
      ix.value = String(Math.round(value.x * 100)); iy.value = String(Math.round(value.y * 100));
      ix.setAttribute("aria-valuetext", word(value.x, "right", "left"));
      iy.setAttribute("aria-valuetext", word(value.y, "up", "down"));
      host.setAttribute("data-state", Math.hypot(value.x, value.y) > 0.4 ? "pushed" : "centre");
      for (const [i, a] of [[ix, "X"], [iy, "Y"]] as const) {
        i.disabled = !!opts.disabled;
        i.setAttribute("aria-label", `${label()} ${a}`);
        if (opts.name) i.name = `${opts.name}-${a.toLowerCase()}`; else i.removeAttribute("name");
      }
    };
    sync();

    const B = register(host, (dt) => {
      sx.t = value.x; sy.t = value.y;
      const m = stepS(sx, dt), n = stepS(sy, dt);
      drawStick({ x: sx.x, y: sy.x });
      return m || n;
    });
    bag.add(B.unregister);

    const ask = (want: Partial<JoystickValue>) => {
      const next = clampV({ ...value, ...want });
      asked = next;
      if (same(next, value)) { sync(); return; }
      if (opts.controlled) { sync(); emit(opts.onValueChange, next); return; }
      value = next; sync(); B.wake(); emit(opts.onValueChange, next);
    };
    const commit = () => emit(opts.onValueCommit, asked);
    for (const [i, a] of [[ix, "x"], [iy, "y"]] as const) {
      bag.on(i, "input", () => ask({ [a]: Number(i.value) / 100 }));
      bag.on(i, "change", commit);
    }

    // pointer: the ball goes where the pointer is, on the plane through its centre, clamped to the gate
    host.setAttribute("data-knurl-hit", "");
    let drag = false;
    const ptr = (e: PointerEvent, z: number): Vec2 => {
      const r = svg.getBoundingClientRect();
      return unproj(C, ((e.clientX - r.left) / (r.width || 1)) * VW, ((e.clientY - r.top) / (r.height || 1)) * VH, z);
    };
    const valueAt = (e: PointerEvent) => { const [x, y] = ptr(e, ZB); return { x: x / D, y: -y / D }; };
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0) return;
      const [px, py] = ptr(e, PZ), [bx, by] = ptr(e, ZB);
      const onPlate = Math.abs(px) <= PH && Math.abs(py) <= PH, onBall = Math.abs(bx) <= D + RB && Math.abs(by) <= D + RB;
      if (!onPlate && !onBall) return;
      drag = true;
      host.setPointerCapture?.(e.pointerId);
      (Math.abs(by) > Math.abs(bx) ? iy : ix).focus({ preventScroll: true });
      sx.k = sy.k = 900; sx.c = sy.c = 60; // follow a hand closely
      ball.lit(true);
      ask(valueAt(e));
      e.preventDefault();
    });
    bag.on(host, "pointermove", (e) => { if (drag) ask(valueAt(e)); });
    const end = () => {
      if (!drag) return;
      drag = false;
      sx.k = sy.k = 260; sx.c = sy.c = 17; // the return spring: a little overshoot
      ball.lit(false);
      if (opts.returnToCenter !== false) ask({ x: 0, y: 0 });
      commit();
      B.wake();
    };
    bag.on(host, "pointerup", end);
    bag.on(host, "pointercancel", end);

    bag.add(() => { ix.remove(); iy.remove(); host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state"); svg.replaceChildren(); });
    return {
      update(next) {
        opts = next;
        if (next.value !== undefined) { const v = clampV(next.value); if (!same(v, value)) { value = v; asked = v; } }
        sync();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
