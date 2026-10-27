import { add3, bar, camera, circle, cuboid, cyl, depth, fit, flat, hull, loft, open, planeMatrix, poly, poly3, prism3, proj, rad, rot, seg, unproj, type Rot, type Vec2, type Vec3 } from "../core/iso";
import { reducedMotion, spring, stepS } from "../core/motion";
import { define, emit, nativeInput, num, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid } from "../core/stage";

/**
 * Timer — a countdown, built as a mechanical kitchen timer.
 *
 * A squat drum on four feet carries a dial ring engraved with the minutes,
 * a winding grip on top and a fixed index at the front. Turn the dial
 * clockwise to wind it; it then turns back toward zero as the time runs out,
 * and the accent arc from the index round to the zero mark is the time left.
 * At zero the striker at the back rattles against its bell for a few seconds.
 * The dial follows the clock, not the frames, so it turns smoothly between
 * whole-second updates even when the value is controlled.
 *
 * Semantics: the host carries role="timer"; winding is a visually hidden
 * `<input type="range">` in whole minutes whose `aria-valuetext` is the time
 * left ("12 minutes 30 seconds").
 */

export type TimerOptions = BaseOptions & {
  /** Seconds remaining. */
  value?: number;
  defaultValue?: number;
  /** Seconds for one turn of the dial. Default 3600 (an hour). */
  max?: number;
  /** Counts down whenever there is time left. Default true. */
  running?: boolean;
  /** Called with the seconds left when it is wound, and once per whole second while it runs. */
  onValueChange?: (seconds: number) => void;
  /** Called once each time it runs down to zero. */
  onDone?: () => void;
  /** Set by the React wrapper when `value` is controlled. */
  controlled?: boolean;
};

const VW = 200, VH = 180;
const TAU = Math.PI * 2;
const RING_MS = 2600; // how long the bell rings
const HOLD = 0.002; // how far short of a second a controlled timer waits for its value

/** Seconds as words: "12 minutes 30 seconds". */
export function timeText(s: number) {
  s = Math.max(0, Math.ceil(s - 1e-6));
  const m = Math.floor(s / 60), r = s % 60;
  const part = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (!m) return part(r, "second");
  return r ? `${part(m, "minute")} ${part(r, "second")}` : part(m, "minute");
}

export const timer = define<TimerOptions>({
  id: "timer",
  label: "Timer",
  vw: VW,
  vh: VH,
  width: 160,
  keys: ["value", "defaultValue", "max", "running", "onValueChange", "onDone", "controlled"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(45, 34);
    // body radius, foot height, deck height; dial ring radius and top; cap radius and top
    const RB = 32, ZF = 2.4, ZK = 14, RD = 25, ZD = ZK + 2.6, RC = 12.5, ZC = ZD + 1.4;
    const ext: Vec3[] = [[0, 0, ZC + 7.2], [-20, -20, ZK + 8]]; // the grip's top, the bell's knop
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; ext.push([Math.cos(a) * RB, Math.sin(a) * RB, 0], [Math.cos(a) * RB, Math.sin(a) * RB, ZK]); }
    fit(C, ext, VW / 2, VH / 2 + 2, VW - 18, VH - 14);
    const P = proj(C);
    const AI = rad(45); // the index: on the ground, straight toward the viewer
    const toward = (a: number) => Math.cos(a - AI);
    /** The near half of a circle, left to right on screen, at height z. */
    const nearArc = (cx: number, cy: number, r: number, z: number, cut = 0.06) => open(circle(cx, cy, r, 64)
      .filter((q) => toward(Math.atan2(q.v - cy, q.u - cx)) > cut)
      .sort((p, q) => Math.sin(Math.atan2(p.v - cy, p.u - cx) - AI) - Math.sin(Math.atan2(q.v - cy, q.u - cx) - AI))
      .map((q) => P(q.u, q.v, z)));
    const g = mk("g", {}, svg);

    // the feet, the drum (a chamfer at its foot, a lip at its deck), a beaded band round its waist
    shadow(g, flat(P, circle(0, 3, RB, 48), 0));
    for (let k = 0; k < 4; k++) {
      const a = AI + Math.PI * (k + 0.5) / 2, fx = Math.cos(a) * 26.5, fy = Math.sin(a) * 26.5;
      solid(g).put(loft(C, P, circle(fx, fy, 3.2, 20), 0, ZF, circle(fx, fy, 2.8, 20)));
    }
    solid(g).put(loft(C, P, circle(0, 0, RB - 1.4, 72), ZF, ZF + 1.6, circle(0, 0, RB, 72)));
    solid(g).put(cyl(C, P, 0, 0, RB, ZF + 1.6, ZK - 0.7, 72));
    solid(g).put(loft(C, P, circle(0, 0, RB, 72), ZK - 0.7, ZK, circle(0, 0, RB - 0.7, 72)));
    line(g, "lo").setAttribute("d", nearArc(0, 0, RB, ZF + 5.2) + nearArc(0, 0, RB, ZF + 6.4));
    // the deck: a rebate round the dial and the engraved MIN beside the index
    line(g, "lo").setAttribute("d", flat(P, circle(0, 0, RD + 1.2, 72), ZK));
    const minText = mk("text", { class: "k-text", "text-anchor": "middle" }, g);
    minText.textContent = "MIN";
    minText.style.fontSize = "3.2px";
    {
      const a = AI - rad(30), rr = 28.6;
      minText.setAttribute("transform", planeMatrix(P, [Math.cos(a) * rr, Math.sin(a) * rr, ZK], [Math.sin(a), -Math.cos(a), 0], [Math.cos(a), Math.sin(a), 0]) + " translate(0 1.1)");
    }

    // the bell and its striker on the deck at the back: before the dial, which is nearer
    const RR = 28.6, AB = AI + Math.PI - rad(14), AH = AB - rad(10.5);
    const bellAt: Vec2 = [Math.cos(AB) * RR, Math.sin(AB) * RR], strAt: Vec2 = [Math.cos(AH) * RR, Math.sin(AH) * RR];
    const BZ0 = ZK + 1.2; // the bell's lip
    const PROFILE: [number, number][] = [[3.2, 0], [3.05, 0.5], [2.85, 1.9], [2.3, 3.3], [1.45, 4.3], [0.7, 4.75]];
    const bellG = mk("g", {}, g), strG = mk("g", {}, g);
    solid(bellG).put(cyl(C, P, bellAt[0], bellAt[1], 0.9, ZK, BZ0 + 2, 16)); // the post up inside the bell
    const bell = solid(bellG);
    const knop = solid(bellG), bellRim = line(bellG, "lo");
    { const c = cuboid([strAt[0], strAt[1], ZK + 0.6], 1.2, 1.2, 0.6, rot("z", AH)); solid(strG).put(poly3(C, P, c.verts, c.faces)); }
    const wire = solid(strG), ball = solid(strG), ballHi = line(strG, "lo");
    // painted back to front, by depth
    if (depth(C, bellAt[0], bellAt[1], 0) > depth(C, strAt[0], strAt[1], 0)) g.insertBefore(strG, bellG);
    const NONE = ["", "", "", ""];
    const disc = (c: Vec2, r: number) => poly(Array.from({ length: 28 }, (_, i): Vec2 => [c[0] + Math.cos((i / 28) * TAU) * r, c[1] + Math.sin((i / 28) * TAU) * r]));

    function drawBell(shake: number, strike: number) {
      const t: Vec2 = [-Math.sin(AB), Math.cos(AB)], bx = bellAt[0] + t[0] * shake, by = bellAt[1] + t[1] * shake;
      // one solid from its lofted bands: their shades together, one silhouette round them all, the crease at the lip
      const bands = PROFILE.slice(1).map((q, i) => loft(C, P, circle(bx, by, PROFILE[i][0], 36), BZ0 + PROFILE[i][1], BZ0 + q[1], circle(bx, by, q[0], 36)));
      const pts = PROFILE.flatMap(([r, z]) => circle(bx, by, r, 36).map((c) => P(c.u, c.v, BZ0 + z)));
      bell.put({ sil: poly(hull(pts)), shades: [0, 1, 2, 3].map((k) => bands.map((b) => b.shades[k]).join("")), top: "", crease: "" });
      knop.put(cyl(C, P, bx, by, 0.7, BZ0 + 4.75, BZ0 + 5.4, 16));
      bellRim.setAttribute("d", nearArc(bx, by, 3.1, BZ0 + 0.5));
      // the striker: a spring wire from its block, leaning toward the bell; `strike` 1 touches it
      const d: Vec2 = [bellAt[0] - strAt[0], bellAt[1] - strAt[1]], dl = Math.hypot(d[0], d[1]);
      const th = rad(9 + 17 * strike), Lw = 4.8;
      const a: Vec3 = [strAt[0], strAt[1], ZK + 1.2];
      const h = add3(a, [(d[0] / dl) * Math.sin(th) * Lw, (d[1] / dl) * Math.sin(th) * Lw, Math.cos(th) * Lw]);
      wire.put({ sil: bar(P, a, h, 0.3, 0.3, 12).sil, shades: NONE, top: "", crease: "" });
      const hc = P(h[0], h[1], h[2]), r = 1.05 * C.S;
      ball.put({ sil: disc(hc, r), shades: NONE, top: "", crease: "" });
      ballHi.setAttribute("d", disc([hc[0] - r * 0.35, hc[1] - r * 0.35], r * 0.28));
    }

    // the dial ring: its side, ribbed, turning; its face with the minutes; the arc of time left
    solid(g).put(cyl(C, P, 0, 0, RD, ZK, ZD, 96));
    const ribs = line(g, "lo");
    mk("path", { class: "k-face", d: flat(P, circle(0, 0, RD - 0.9, 96), ZD) }, g);
    const minor = line(g, "mid"), major = line(g, "hi"), zero = line(g, "hi");
    const left = line(g, "accent");
    const digits = mk("g", {}, g);
    let labels: { el: SVGTextElement; m: number }[] = [];
    // the cap and its winding grip, turning with the dial
    solid(g).put(cyl(C, P, 0, 0, RC + 0.8, ZD, ZD + 0.4, 64));
    solid(g).put(cyl(C, P, 0, 0, RC, ZD + 0.4, ZC, 64));
    line(g, "lo").setAttribute("d", flat(P, circle(0, 0, RC - 2, 56), ZC));
    const grip = solid(g), dimples = line(g, "lo");
    // the fixed index: a post on the deck and a pointer plate reaching over the dial's edge
    const iR = rot("z", AI);
    { const c = cuboid([Math.cos(AI) * 28.2, Math.sin(AI) * 28.2, (ZK + ZD + 1.6) / 2], 2, 1.9, (ZD + 1.6 - ZK) / 2, iR); solid(g).put(poly3(C, P, c.verts, c.faces)); }
    {
      const c = prism3([0, 0, ZD + 1.9], [[RD - 2.6, 0], [RD + 5.2, -2.8], [RD + 5.2, 2.8]], 0.35, iR);
      const s = solid(g); s.put(poly3(C, P, c.verts, c.faces)); s.lit(true);
    }
    line(g, "hi").setAttribute("d", seg(P(Math.cos(AI) * (RD - 2.1), Math.sin(AI) * (RD - 2.1), ZD + 2.25), P(Math.cos(AI) * (RD + 2), Math.sin(AI) * (RD + 2), ZD + 2.25)));

    const lim = () => Math.max(60, Math.round(num(opts.max, 3600) / 60) * 60);
    let max = lim();
    /** Numbers every 5 minutes on an hour's dial (fewer, larger steps on a longer one). */
    function scale() {
      const mm = max / 60, every = [5, 10, 15, 30, 60, 120, 240].find((e) => mm / e <= 12) ?? Math.ceil(mm / 12);
      const n = Math.ceil(mm / every - 1e-6);
      if (labels.length !== n || (n > 1 && labels[1].m !== every)) {
        digits.replaceChildren();
        labels = Array.from({ length: n }, (_, k) => {
          const el = mk("text", { class: "k-text hi", "text-anchor": "middle" }, digits);
          el.style.fontSize = "4.2px";
          el.textContent = String(k * every);
          return { el, m: k * every };
        });
      }
      return { mm, step: mm <= 60 ? 1 : every / 5, every };
    }

    /** The dial turned to φ: minute m sits at φ − 2π·m/mm, so winding turns it clockwise on screen. */
    function drawDial(phi: number) {
      const { mm, step, every } = scale();
      const mi: string[] = [], ma: string[] = [];
      for (let m = 0; m < mm - 1e-6; m += step) {
        const a = phi - (TAU * m) / mm, c = Math.cos(a), s = Math.sin(a), big = Math.abs(m / every - Math.round(m / every)) < 1e-6;
        (big ? ma : mi).push(seg(P(c * (RD - 1.5), s * (RD - 1.5), ZD), P(c * (RD - (big ? 3.9 : 2.8)), s * (RD - (big ? 3.9 : 2.8)), ZD)));
      }
      minor.setAttribute("d", mi.join(""));
      major.setAttribute("d", ma.join(""));
      zero.setAttribute("d", seg(P(Math.cos(phi) * (RC + 1.4), Math.sin(phi) * (RC + 1.4), ZD), P(Math.cos(phi) * (RC + 3.8), Math.sin(phi) * (RC + 3.8), ZD)));
      for (const l of labels) {
        const a = phi - (TAU * l.m) / mm, c = Math.cos(a), s = Math.sin(a), rn = RD - 6.6;
        l.el.setAttribute("transform", planeMatrix(P, [c * rn, s * rn, ZD], [s, -c, 0], [c, s, 0]) + " translate(0 1.5)");
      }
      const rb: string[] = [];
      for (let k = 0; k < 90; k++) {
        const a = phi + (k / 90) * TAU;
        if (toward(a) < 0.14) continue;
        rb.push(seg(P(Math.cos(a) * RD, Math.sin(a) * RD, ZK + 0.6), P(Math.cos(a) * RD, Math.sin(a) * RD, ZD - 0.5)));
      }
      ribs.setAttribute("d", rb.join(""));
      // the time left: from the index round to the zero mark
      const span = phi - AI, n = Math.max(2, Math.ceil(span * 16));
      left.setAttribute("d", span > 0.004 ? open(Array.from({ length: n + 1 }, (_, k): Vec2 => {
        const a = AI + (span * k) / n;
        return P(Math.cos(a) * (RC + 2.6), Math.sin(a) * (RC + 2.6), ZD);
      })) : "");
      // the grip: a rounded fin across the cap, standing up; local x along the fin, y up, z through it
      const ps = phi + Math.PI / 2, ux = Math.cos(ps), uy = Math.sin(ps);
      const R: Rot = [[ux, uy, 0], [0, 0, 1], [uy, -ux, 0]];
      const fin: Vec2[] = [[-10.4, 0], [10.4, 0], [10.1, 3.2], [9.3, 5.3], [7.9, 6.6], [6, 7.2], [-6, 7.2], [-7.9, 6.6], [-9.3, 5.3], [-10.1, 3.2]];
      const f = prism3([0, 0, ZC], fin, 2, R);
      grip.put(poly3(C, P, f.verts, f.faces));
      // a thumb dimple each side of the centre, on the face toward the viewer
      const side = toward(Math.atan2(-ux, uy)) > 0 ? 1 : -1, nx = uy * side, ny = -ux * side;
      const dm: string[] = [];
      for (const x of [-5, 5]) dm.push(nearOval(ux * x + nx * 2, uy * x + ny * 2, ux, uy, ZC + 3.8));
      dimples.setAttribute("d", dm.join(""));
    }
    /** A small oval on a vertical face: 2.6 along (ux, uy), 2.4 tall. */
    function nearOval(cx: number, cy: number, ux: number, uy: number, cz: number) {
      return poly(Array.from({ length: 20 }, (_, i): Vec2 => {
        const t = (i / 20) * TAU, a = Math.cos(t) * 2.6, z = Math.sin(t) * 2.2;
        return P(cx + ux * a, cy + uy * a, cz + z);
      }));
    }

    // the clock: while counting, `endAt` is when it reaches zero (ms of performance.now); otherwise `held` seconds
    const input = nativeInput(ctx, { type: "range", min: "0", step: "60" });
    host.setAttribute("data-knurl-hit", "");
    const now0 = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const clampS = (v: unknown) => Math.max(0, Math.min(max, num(v, 0)));
    const whole = (s: number) => Math.max(0, Math.ceil(s - 1e-6));
    let held = clampS(o.value ?? o.defaultValue);
    let endAt: number | null = null;
    let cur = whole(held); // the whole seconds last reported
    let prop = o.value === undefined ? NaN : held; // the controlled value, if any
    let dragging = false, done = held <= 0, ringAt = -1e9, ringing = false, to: ReturnType<typeof setTimeout> | 0 = 0;
    const rem = (now: number) => (endAt === null ? held : Math.max(0, (endAt - now) / 1000));
    const ctrl = () => !!opts.controlled && prop === prop;

    const sync = () => {
      input.max = String(max);
      input.value = String(cur);
      input.setAttribute("aria-valuetext", timeText(cur));
      input.setAttribute("aria-label", opts.label ?? "Timer");
      input.disabled = !!opts.disabled;
      if (opts.name) input.name = opts.name; else input.removeAttribute("name");
      host.setAttribute("role", "timer");
      host.setAttribute("aria-label", opts.label ?? "Timer");
      host.setAttribute("data-state", ringing ? "done" : cur <= 0 ? "idle" : endAt !== null ? "running" : "paused");
    };

    /** Reports each whole second crossed, and the end. */
    function clock(now: number) {
      if (endAt === null) return;
      // controlled: it reports the next second, then runs on (showing that second) until its value catches up
      if (ctrl()) endAt = Math.max(endAt, now + (prop - 2 + HOLD) * 1000);
      const n = whole(rem(now));
      if (n >= cur) return;
      cur = n;
      if (n <= 0) { endAt = null; held = 0; }
      if (n <= 0 && !done) { done = true; ringAt = now; ringing = true; }
      sync();
      emit(opts.onValueChange, n);
      if (ringAt === now) emit(opts.onDone);
    }
    /** A timeout at the next whole second, so it keeps time while the drawing sleeps offscreen. */
    function schedule() {
      if (to) clearTimeout(to);
      to = 0;
      if (endAt === null || (ctrl() && cur < prop)) return; // controlled and reported: wait for the value
      const ms = endAt - (cur - 1) * 1000 - now0();
      to = setTimeout(() => { to = 0; clock(now0()); B.wake(); schedule(); }, Math.max(0, ms) + 2);
    }
    /** Starts or stops counting from wherever it is now. */
    function restart(now: number) {
      const r = rem(now);
      endAt = opts.running !== false && !dragging && r > 0 ? now + r * 1000 : null;
      if (endAt === null) held = r;
      schedule();
    }
    /** Winds it to `v` seconds. */
    function set(v: number, now: number) {
      held = v; endAt = null; cur = whole(v); done = v <= 0; ringAt = -1e9;
      restart(now);
      sync();
      B.wake();
    }

    const sp = spring(AI + (TAU * held) / max, { k: 300, c: 34, eps: 0.0004 });
    let drawn = NaN;
    const B = register(host, (dt, now) => {
      clock(now);
      const r = rem(now);
      // controlled: shown between the value and a second below it, however late the next value is
      const shown = ctrl() ? Math.min(prop, Math.max(r, prop - 1)) : r;
      sp.t = AI + (TAU * shown) / max;
      const m = stepS(sp, dt);
      if (!(Math.abs(sp.x - drawn) < 1e-4)) { drawn = sp.x; drawDial(sp.x); }
      // the bell: a fast rattle that dies away
      const ra = (now - ringAt) / RING_MS, was = ringing;
      ringing = ra >= 0 && ra < 1;
      const w = ringing && !reducedMotion() ? Math.sin(((now - ringAt) / 1000) * TAU * 14) * (1 - ra) : 0;
      drawBell(w * 0.3, Math.max(0, w) ** 0.6);
      bell.lit(ringing);
      if (ringing !== was) sync();
      const stalled = ctrl() && r <= prop - 2 + HOLD + 1e-6;
      return (endAt !== null && !stalled) || m || ringing;
    });
    bag.add(B.unregister);
    bag.add(() => { if (to) clearTimeout(to); to = 0; });
    restart(now0());
    sync();

    /** A request from the pointer, wheel or keyboard, in whole minutes. */
    const ask = (v: number) => {
      const next = Math.min(Math.floor(max / 60) * 60, Math.round(clampS(v) / 60) * 60);
      if (next === cur) { sync(); return; }
      if (opts.controlled) { sync(); emit(opts.onValueChange, next); return; }
      set(next, now0());
      emit(opts.onValueChange, next);
    };
    bag.on(input, "input", () => ask(Number(input.value)));

    // pointer: turn the dial by its angle about the centre; the wheel winds a minute
    const angleAt = (e: PointerEvent): number | null => {
      const b = svg.getBoundingClientRect();
      const [x, y] = unproj(C, ((e.clientX - b.left) / (b.width || 1)) * VW, ((e.clientY - b.top) / (b.height || 1)) * VH, ZD);
      return Math.hypot(x, y) > RB + 6 ? null : Math.atan2(y, x);
    };
    let drag: { a: number; turn: number; v: number } | null = null;
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0) return;
      const a = angleAt(e);
      if (a === null) return;
      const now = now0();
      dragging = true;
      restart(now); // holds the clock while a hand is on the dial
      drag = { a, turn: 0, v: Math.round(held / 60) * 60 };
      host.setPointerCapture?.(e.pointerId);
      input.focus({ preventScroll: true });
      e.preventDefault();
      sync();
      B.wake();
    });
    bag.on(host, "pointermove", (e) => {
      if (!drag) return;
      const a = angleAt(e) ?? drag.a;
      let d = a - drag.a;
      if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
      drag.turn += d; drag.a = a;
      ask(drag.v + (drag.turn / TAU) * max);
    });
    const end = () => { if (!drag) return; drag = null; dragging = false; restart(now0()); sync(); B.wake(); };
    bag.on(host, "pointerup", end);
    bag.on(host, "pointercancel", end);
    bag.on(host, "wheel", (e) => {
      if (opts.disabled) return;
      e.preventDefault();
      ask(e.deltaY < 0 ? Math.floor(cur / 60) * 60 + 60 : Math.ceil(cur / 60) * 60 - 60);
    }, { passive: false });

    bag.add(() => { input.remove(); for (const n of ["data-knurl-hit", "data-state", "role", "aria-label"]) host.removeAttribute(n); svg.replaceChildren(); });
    return {
      update(next) {
        opts = next;
        const now = now0();
        if (lim() !== max) { max = lim(); drawn = NaN; if (rem(now) > max) set(max, now); }
        if (next.value !== undefined) {
          const v = clampS(next.value), r = rem(now);
          prop = v;
          // a value the running clock agrees with (within the second it last reported) keeps the clock going
          if (dragging || !(r > v - 1 && r <= v + 1e-6)) set(v, now);
          else cur = whole(v);
        } else prop = NaN;
        restart(now);
        sync();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
