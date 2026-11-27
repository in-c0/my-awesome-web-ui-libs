import { camera, circle, cyl, fit, flat, inset, lerp, loft, planeMatrix, poly, poly3, prism3, proj, rad, rot, seg, slab, rrect, type Ring, type Vec2, type Vec3 } from "../core/iso";
import { reducedMotion, spring, stepS } from "../core/motion";
import { define, emit, nativeInput, num, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, type Solid } from "../core/stage";

/**
 * Embosser — a text input, built as a handheld label maker.
 *
 * A head with a character dial and a knurled hub, a grip with a window onto
 * the tape reel, and a squeeze lever on a pivot pin, held open by its return
 * spring. Typing turns the dial to each new character, the lever squeezes and
 * springs back, and the tape advances out of the head carrying the letter
 * raised on it. Backspace draws the tape back in by one letter. The index
 * mark at the dial's top is lit.
 *
 * Hovering takes up the lever's slack; pressing anywhere on the label maker
 * focuses the field and the lever gives under the hand without embossing.
 *
 * Semantics come from a visually hidden `<input type="text">` that keeps real
 * focus while typing, so the keyboard, the caret, IME, paste and screen
 * readers are the platform's own.
 */

export type EmbosserOptions = BaseOptions & {
  value?: string;
  defaultValue?: string;
  /** Called with the text on every change. */
  onValueChange?: (value: string) => void;
  /** The most characters the tape takes. Default 16. */
  maxLength?: number;
  /** The native field's placeholder, for screen readers and autofill; the tape itself starts blank. */
  placeholder?: string;
  /** The tape is embossed in capitals, and the value is upper-cased with it. Default true. */
  uppercase?: boolean;
  /** Set by the React wrapper when `value` is controlled. */
  controlled?: boolean;
};

const VW = 340, VH = 150;
const AZ = 30, EL = 34;
const DIAL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.& ".split("");
const STEP = (Math.PI * 2) / DIAL.length;
const OPEN = rad(6), SHUT = rad(-2.6); // the lever's angle off the grip: at rest and squeezed home
const STROKE = 70; // ms the lever stays squeezed while a letter is embossed

/** The hull of two circles: a tapered, rounded bar from (x0, y0) to (x1, y1). Counter-clockwise, with normals. */
function capsule(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, n = 14): Ring {
  const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0), phi = Math.acos((r0 - r1) / L);
  const out: Ring = [];
  const push = (cx: number, cy: number, r: number, t: number) => out.push({ u: cx + r * Math.cos(t), v: cy + r * Math.sin(t), nu: Math.cos(t), nv: Math.sin(t) });
  for (let k = 0; k <= n; k++) push(x1, y1, r1, a - phi + (2 * phi * k) / n);
  for (let k = 0; k <= n; k++) push(x0, y0, r0, a + phi + ((2 * Math.PI - 2 * phi) * k) / n);
  return out;
}

export const embosser = define<EmbosserOptions>({
  id: "embosser",
  label: "Label maker",
  vw: VW,
  vh: VH,
  width: 300,
  keys: ["value", "defaultValue", "onValueChange", "maxLength", "placeholder", "uppercase", "controlled"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg, doc } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(AZ, EL);
    let P = proj(C);
    const g = mk("g", {}, svg);
    const az = rad(AZ);
    const TOP = Math.atan2(-Math.cos(az), -Math.sin(az)); // the dial's far side, where its letter reads upright

    const input = nativeInput(ctx, { type: "text", autocomplete: "off", spellcheck: "false" });
    host.setAttribute("data-knurl-hit", "");

    const MAX = () => Math.max(1, Math.min(64, Math.round(num(opts.maxLength, 16))));
    const upper = () => opts.uppercase !== false;
    const clean = (s: unknown) => { const t = String(s ?? "").replace(/[\r\n\t]/g, " "); return (upper() ? t.toUpperCase() : t).slice(0, MAX()); };
    let value = clean(opts.value ?? opts.defaultValue);
    let ghost = value; // what the tape carries: the value, plus letters still drawing back into the head

    // geometry
    const HZ = 8, DR = 12, DZ1 = HZ + 1.6, YT = -10.6, TW = 6.2, TZ0 = 2.6, TZ1 = 3.05, NX = -25, EX = NX - 0.6;
    const PIV: Vec2 = [14, 9.6], LEN = 42;
    let pitch = 3.5, fs = 4;
    let tape: Solid, letters: { sh: SVGTextElement; face: SVGTextElement }[] = [], tapeG: SVGGElement;
    let dialG: SVGGElement, dialLetters: SVGTextElement[] = [], hubRibs: SVGPathElement, reelMark: SVGPathElement;
    let lever: Solid, leverRibs: SVGPathElement, pin: Solid, pinSlot: SVGPathElement, coil: SVGPathElement;

    function build() {
      g.replaceChildren();
      const n = MAX();
      pitch = 3.5 * Math.min(1, 16 / n); fs = 4 * Math.min(1, 16 / n) + 0.0001;
      const XL = EX - n * pitch - 3;
      const ext: Vec3[] = [[XL, YT - TW / 2, 0], [63, -6, 0], [56, 15, 0], [-15, 13, 0], [-15, -15, 0], [0, 0, DZ1 + 3.6], [-8, -14, HZ], [NX, YT - 4.4, 8]];
      fit(C, ext, VW / 2, VH / 2 + 1, VW - 18, VH - 16);
      P = proj(C);

      shadow(g, flat(P, capsule(-6, -1, 15, 58, -1, 6), 0));
      // the tape, under everything else: it runs out of the head to the left
      tapeG = mk("g", {}, g);
      tape = solid(tapeG);
      letters = Array.from({ length: n }, () => {
        const sh = mk("text", { class: "k-text", "text-anchor": "middle" }, tapeG) as SVGTextElement;
        const face = mk("text", { class: "k-text hi", "text-anchor": "middle" }, tapeG) as SVGTextElement;
        sh.style.fontSize = face.style.fontSize = fs.toFixed(2) + "px";
        sh.style.fontWeight = face.style.fontWeight = "700";
        return { sh, face };
      });

      // the grip, with its parting line, three screws and the reel window
      const grip = capsule(10, 0, 8.5, 58, -1, 5);
      solid(g).put(loft(C, P, grip, 0, 7, inset(grip, 0.8)));
      line(g, "lo").setAttribute("d", loft(C, P, grip, 2.4, 2.4).crease);
      const gs: string[] = [];
      for (const [x, y] of [[22, -3.5], [46, -3.2], [54, -1]]) {
        solid(g).put(cyl(C, P, x, y, 1.2, 7, 7.4, 14));
        gs.push(seg(P(x - 0.8, y + 0.3, 7.4), P(x + 0.8, y - 0.3, 7.4)));
      }
      line(g, "edge").setAttribute("d", gs.join(""));
      const RX = 34, RY = -1;
      solid(g).put(cyl(C, P, RX, RY, 5.2, 7, 7.6, 32));
      mk("path", { class: "k-slot", d: flat(P, circle(RX, RY, 3.9, 32), 7.6) }, g);
      line(g, "lo").setAttribute("d", flat(P, circle(RX, RY, 3.2, 28), 7.6) + flat(P, circle(RX, RY, 2.4, 24), 7.6));
      solid(g).put(cyl(C, P, RX, RY, 1.3, 7.6, 8.2, 16));
      reelMark = line(g, "edge");

      // the nose the tape leaves by, with the tape's slot and the cutter's plunger on top
      solid(g).put(slab(C, P, NX, YT - 4.4, -10, YT + 4.4, 2, 0, 6));
      line(g, "lo").setAttribute("d", loft(C, P, rrect(NX, YT - 4.4, -10, YT + 4.4, 2), 3, 3).crease);
      solid(g).put(cyl(C, P, NX + 5, YT, 2.2, 6, 6.8, 20));
      solid(g).put(cyl(C, P, NX + 5, YT, 1.5, 6.8, 8.4, 20));
      line(g, "lo").setAttribute("d", flat(P, circle(NX + 5, YT, 0.8, 14), 8.4));
      // the head: its body, parting line, the cutter plunger, the dial
      const headRing = rrect(-15, -15, 15, 13, 7);
      solid(g).put(loft(C, P, headRing, 0, HZ, inset(headRing, 0.6)));
      line(g, "lo").setAttribute("d", loft(C, P, headRing, 3, 3).crease);
      line(g, "lo").setAttribute("d", flat(P, circle(0, 0, DR + 1.2, 64), HZ));
      solid(g).put(cyl(C, P, 0, 0, DR, HZ, DZ1, 72));
      line(g, "lo").setAttribute("d", flat(P, circle(0, 0, DR - 3.8, 56), DZ1));
      dialG = mk("g", {}, g);
      const sep: string[] = [];
      for (let k = 0; k < DIAL.length; k++) {
        const a = (k + 0.5) * STEP;
        sep.push(`M${(Math.cos(a) * (DR - 0.5)).toFixed(2)} ${(Math.sin(a) * (DR - 0.5)).toFixed(2)}L${(Math.cos(a) * (DR - 3.8)).toFixed(2)} ${(Math.sin(a) * (DR - 3.8)).toFixed(2)}`);
      }
      mk("path", { class: "k-line lo", d: sep.join("") }, dialG);
      dialLetters = DIAL.map((ch, k) => {
        const t = mk("text", { class: "k-text", "text-anchor": "middle", y: "0.9", transform: `rotate(${((k * STEP * 180) / Math.PI + 90).toFixed(2)}) translate(0 ${-(DR - 2.1)})` }, dialG) as SVGTextElement;
        t.textContent = ch === " " ? "·" : ch;
        t.style.fontSize = "2.5px";
        return t;
      });
      // the index shoe over the dial's far rim, its lit arrow pointing at the letter to emboss
      {
        const ca = Math.cos(TOP), sa = Math.sin(TOP), na = -sa, nb = ca;
        const shoe = prism3([ca * (DR + 1.2), sa * (DR + 1.2), DZ1 + 0.55], [[-2, -1.9], [2, -1.9], [2, 1.9], [-2, 1.9]], 0.45, rot("z", TOP));
        solid(g).put(poly3(C, P, shoe.verts, shoe.faces));
        const zt = DZ1 + 1;
        line(g, "accent").setAttribute("d", poly([P(ca * (DR - 0.6), sa * (DR - 0.6), zt), P(ca * (DR + 1.6) + na * 1.1, sa * (DR + 1.6) + nb * 1.1, zt), P(ca * (DR + 1.6) - na * 1.1, sa * (DR + 1.6) - nb * 1.1, zt)]));
        // the shoe's two rivets into the head
        line(g, "edge").setAttribute("d", flat(P, circle(ca * (DR + 2.4) + na * 1.3, sa * (DR + 2.4) + nb * 1.3, 0.35, 8), zt) + flat(P, circle(ca * (DR + 2.4) - na * 1.3, sa * (DR + 2.4) - nb * 1.3, 0.35, 8), zt));
      }
      // the knurled hub and its screw
      solid(g).put(cyl(C, P, 0, 0, 4.2, DZ1, DZ1 + 0.6, 40));
      solid(g).put(cyl(C, P, 0, 0, 3.4, DZ1 + 0.6, DZ1 + 3.4, 40));
      hubRibs = line(g, "lo");
      line(g, "lo").setAttribute("d", flat(P, circle(0, 0, 2.6, 32), DZ1 + 3.4));
      line(g, "edge").setAttribute("d", seg(P(-1.4, 0.5, DZ1 + 3.4), P(1.4, -0.5, DZ1 + 3.4)));

      // the lever, its pivot pin, and the return spring between it and the grip
      coil = line(g, "edge");
      lever = solid(g);
      leverRibs = line(g, "lo");
      pin = solid(g);
      pinSlot = line(g, "edge");
      drawn = { dial: NaN, lev: NaN, feed: NaN };
      sync();
      paint();
    }

    function drawDial(th: number) {
      dialG.setAttribute("transform", planeMatrix(P, [0, 0, DZ1], [Math.cos(th), Math.sin(th), 0], [-Math.sin(th), Math.cos(th), 0]));
      const ribs: string[] = [];
      const vu = Math.sin(az), vv = Math.cos(az);
      for (let k = 0; k < 36; k++) {
        const t = th + (k / 36) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
        if (c * vu + s * vv < 0.15) continue;
        ribs.push(seg(P(c * 3.4, s * 3.4, DZ1 + 0.9), P(c * 3.4, s * 3.4, DZ1 + 3.1)));
      }
      hubRibs.setAttribute("d", ribs.join(""));
    }

    function drawLever(a: number) {
      const R = rot("z", a);
      const ring: Vec2[] = capsule(0, 0, 2.8, LEN, 0, 3.3, 10).map((q) => [q.u, q.v]);
      const p = prism3([PIV[0], PIV[1], 3.75], ring, 2.75, R);
      lever.put(poly3(C, P, p.verts, p.faces));
      const ca = Math.cos(a), sa = Math.sin(a);
      const L = (d: number, w: number, z: number): Vec2 => P(PIV[0] + ca * d - sa * w, PIV[1] + sa * d + ca * w, z);
      const ribs: string[] = [];
      for (let k = 0; k < 7; k++) { const d = 20 + k * 2.2, w = 1.9 + (k / 6) * 0.3; ribs.push(seg(L(d, -w, 6.5), L(d, w, 6.5))); }
      leverRibs.setAttribute("d", ribs.join(""));
      pin.put(cyl(C, P, PIV[0], PIV[1], 1.5, 6.5, 7.3, 16));
      pinSlot.setAttribute("d", seg(P(PIV[0] - 1, PIV[1] + 0.4, 7.3), P(PIV[0] + 1, PIV[1] - 0.4, 7.3)));
      // the return spring: a coil from the grip's edge to the lever's inner edge, near the lever's end
      const x = 51, y0 = 4.4, y1 = PIV[1] + Math.tan(a) * (x - PIV[0]) - 3.2 / Math.cos(a), z = 5.4;
      const pts: Vec2[] = [P(x, y0, z)];
      for (let k = 1; k < 11; k++) pts.push(P(x + (k % 2 ? 0.9 : -0.9), lerp(y0, y1, k / 11), z + (k % 2 ? 0.7 : -0.7)));
      pts.push(P(x, y1, z));
      coil.setAttribute("d", "M" + pts.map((q) => q[0].toFixed(2) + " " + q[1].toFixed(2)).join("L"));
    }

    function drawTape(f: number) {
      const n = letters.length;
      const xEnd = EX - Math.max(0, f) * pitch - 2.6;
      tape.put(slab(C, P, xEnd, YT - TW / 2, 0, YT + TW / 2, 0.8, TZ0, TZ1));
      const shown = Math.min(n, Math.ceil(f - 1e-3));
      letters.forEach((l, i) => {
        if (i >= shown || !ghost[i] || ghost[i] === " ") { l.sh.setAttribute("display", "none"); l.face.setAttribute("display", "none"); return; }
        const x = EX - (f - i - 0.5) * pitch;
        // raised: a lower copy offset toward the viewer, the face lifted above it
        const m = planeMatrix(P, [x, YT, TZ1], [1, 0, 0], [0, 1, 0]);
        l.sh.removeAttribute("display"); l.face.removeAttribute("display");
        if (l.face.textContent !== ghost[i]) l.sh.textContent = l.face.textContent = ghost[i];
        l.sh.setAttribute("transform", m + ` translate(0.28 ${(fs * 0.36 + 0.3).toFixed(2)})`);
        l.face.setAttribute("transform", m + ` translate(0 ${(fs * 0.36).toFixed(2)})`);
      });
      const t = -f * 0.8, c = Math.cos(t), s = Math.sin(t);
      reelMark.setAttribute("d", seg(P(34 + c * 1.3, -1 + s * 1.3, 8.2), P(34 + c * 3.6, -1 + s * 3.6, 7.6)));
    }

    // motion: the dial follows its letter (ζ ≈ 0.4), the lever squeezes and springs open (ζ ≈ 0.44), the tape feeds out (ζ ≈ 0.39)
    const posOf = (ch: string | undefined) => { const k = ch === undefined ? -1 : DIAL.indexOf(ch.toUpperCase()); return k < 0 ? DIAL.length - 1 : k; };
    const dialFor = (k: number, from: number) => { let th = TOP - k * STEP; while (th - from > Math.PI) th -= Math.PI * 2; while (from - th > Math.PI) th += Math.PI * 2; return th; };
    const dial = spring(dialFor(posOf(value[value.length - 1] ?? "A"), TOP), { k: 260, c: 13, eps: 0.0015 });
    dial.x = dial.t;
    const lev = spring(0, { k: 520, c: 20, eps: 0.004 });
    const feed = spring(value.length, { k: 420, c: 16, eps: 0.004 });
    let strokeEnd = -1, feedTo = value.length, hover = false, pressed = false, lit = posOf(value[value.length - 1] ?? "A");
    let drawn = { dial: NaN, lev: NaN, feed: NaN };

    function paint() {
      if (!lever) return;
      if (dial.x !== drawn.dial) { drawn.dial = dial.x; drawDial(dial.x); }
      if (lev.x !== drawn.lev) { drawn.lev = lev.x; drawLever(lerp(OPEN, SHUT, lev.x)); }
      if (feed.x !== drawn.feed) { drawn.feed = feed.x; drawTape(feed.x); }
    }

    const B = register(host, (dt, now) => {
      const stroking = now < strokeEnd;
      lev.t = stroking ? 1 : pressed ? 0.45 : hover ? 0.1 : 0;
      // the tape moves on once the lever lets go of the letter; it draws back at once
      if (!stroking) feed.t = feedTo;
      const a = stepS(dial, dt), b = stepS(lev, dt), c = stepS(feed, dt);
      paint();
      return a || b || c || stroking;
    });
    bag.add(B.unregister);

    function sync() {
      if (input.value !== value) input.value = value;
      input.maxLength = MAX();
      input.disabled = !!opts.disabled;
      input.setAttribute("aria-label", opts.label ?? "Label text");
      input.setAttribute("autocapitalize", upper() ? "characters" : "off");
      if (opts.placeholder) input.placeholder = opts.placeholder; else input.removeAttribute("placeholder");
      if (opts.name) input.name = opts.name; else input.removeAttribute("name");
      host.setAttribute("data-state", value ? "filled" : "empty");
      dialLetters.forEach((t, k) => t.setAttribute("class", k === lit ? "k-text hi" : "k-text"));
    }

    /** Moves the machine to `next`: new letters are embossed with a squeeze and fed out; fewer letters draw the tape back. */
    function show(next: string, prev: string) {
      const now = performance.now();
      if (next.length > prev.length || (next !== prev && next.length === prev.length)) {
        if (next.length > prev.length && !reducedMotion()) strokeEnd = now + STROKE;
        ghost = next;
      } else if (!ghost.startsWith(next)) ghost = next;
      feedTo = next.length;
      const last = next[next.length - 1];
      if (last !== undefined) { lit = posOf(last); dial.t = dialFor(lit, dial.t); }
      B.wake();
    }

    const ask = (raw: string) => {
      const next = clean(raw);
      if (next === value) { if (input.value !== value) keepCaret(() => { input.value = value; }); return; }
      if (opts.controlled) { keepCaret(() => { input.value = value; }); emit(opts.onValueChange, next); return; }
      const prev = value;
      value = next;
      keepCaret(() => sync());
      show(next, prev);
      emit(opts.onValueChange, next);
    };
    const keepCaret = (fn: () => void) => {
      const s = input.selectionStart, e = input.selectionEnd;
      fn();
      if (s !== null && e !== null && doc.activeElement === input) try { input.setSelectionRange(Math.min(s, input.value.length), Math.min(e, input.value.length)); } catch { /* not a text field */ }
    };
    bag.on(input, "input", () => ask(input.value));

    // pointer: anywhere on the label maker focuses the field, caret at the end; the lever gives under the hand
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0) return;
      input.focus({ preventScroll: true });
      try { input.setSelectionRange(input.value.length, input.value.length); } catch { /* not a text field */ }
      pressed = true; B.wake();
      e.preventDefault();
    });
    const release = () => { if (pressed) { pressed = false; B.wake(); } };
    bag.on(host, "pointerup", release);
    bag.on(host, "pointercancel", release);
    bag.on(host, "pointerenter", (e) => { if (e.pointerType === "mouse") { hover = true; B.wake(); } });
    bag.on(host, "pointerleave", () => { hover = false; release(); B.wake(); });

    build();
    bag.add(() => { input.remove(); host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state"); svg.replaceChildren(); });
    return {
      update(next, prev) {
        opts = next;
        const before = value;
        if (next.maxLength !== prev.maxLength) build();
        value = clean(next.value !== undefined ? next.value : value);
        keepCaret(() => sync());
        if (value !== before) show(value, before);
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
