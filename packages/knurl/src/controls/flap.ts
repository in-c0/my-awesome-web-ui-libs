import { add3, bar, camera, cuboid, cyl, dot3, fit, flat, poly, poly3, prism3, proj, rad, rrect, scale3, seg, slab, toViewer, planeMatrix, type Rot, type Vec2, type Vec3 } from "../core/iso";
import { reducedMotion, spring, stepS } from "../core/motion";
import { define, emit, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, type Solid } from "../core/stage";

/**
 * Flap — a select, built as one split-flap display module, like a station
 * board's.
 *
 * A housing on a mounting plate holds a drum of hinged flaps behind a window:
 * the upper half of the option shows on the top flap, the lower half on the
 * back of the flap that fell before it. Choosing an option releases flaps one
 * after another until it shows; flaps only fall forward, so going back means
 * going all the way round, as on the real board. Each flap drops in about
 * 80 ms and bounces once on the stack. On the side, the drum's axle carries a
 * ratchet held by a pawl and a knurled advance wheel; the wheel turns a tooth
 * for every flap and a lamp on the front lights while the drum runs.
 *
 * A click on the module drops the next flap. Hovering it tips the top flap
 * forward a little, and pressing holds it at its release point. The advance
 * wheel can be dragged down or scrolled.
 *
 * Semantics come from a visually hidden native `<select>`.
 */

export type FlapOptions = BaseOptions & {
  /** The options, in drum order. Short legends read best (up to 6 characters are shown). Default A to Z. */
  options?: string[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Set by the React wrapper when `value` is controlled. */
  controlled?: boolean;
};

const VW = 240, VH = 170;
const AZ = 30, EL = 26;
const FH = 8.6, GAP = 0.32, FS = 12, TH = 0.22; // flap height from the axle, the split, the legend's size, half a flap's thickness
const FALL = 80, BOUNCE = 120, EVERY = 70; // ms: one flap's drop, its bounce on the stack, the release interval
const REST = rad(-3), FAN = rad(-13); // the top flap leans back on its stop; the next one waits further back
const ALPHA = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
let uid = 0;

/** A flap's frame at angle φ about the drum axle (0 is up, π hangs down, positive falls toward the viewer). */
const along = (phi: number): Vec3 => [0, Math.sin(phi), Math.cos(phi)];
const normal = (phi: number): Vec3 => [0, Math.cos(phi), -Math.sin(phi)];

export const flap = define<FlapOptions>({
  id: "flap",
  label: "Flap",
  vw: VW,
  vh: VH,
  width: 200,
  keys: ["options", "value", "defaultValue", "onValueChange", "controlled"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg, doc } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(AZ, EL);
    let P = proj(C);
    const V = toViewer(C);
    const g = mk("g", {}, svg);
    const id = "knurl-flap-" + ++uid;

    const select = doc.createElement("select");
    select.setAttribute("data-knurl-sr", "");
    host.appendChild(select);
    host.setAttribute("data-knurl-hit", "");

    const list = () => (Array.isArray(opts.options) && opts.options.length ? opts.options.map(String) : ALPHA);

    // geometry, set by build
    let N = 26, FW = 8, HX = 0, HD = 9, ZA = 0, YA = 0, WX = 0, WZ0 = 0, WZ1 = 0, XW = 0;
    const HZ0 = 3, RR = 6, RK = 4.4; // the housing's foot; the ratchet's and the knurled wheel's radius

    type Card = { body: Solid; front: SVGGElement; back: SVGGElement; ft: SVGTextElement; bt: SVGTextElement };
    let fan: Card[] = [], lower: Card, top: Card, flights: Card[] = [];
    let lamp: SVGPathElement, glow: SVGPathElement;
    let wheelG: SVGGElement;
    let knurl: Solid, knurlRibs: SVGPathElement, cap: SVGPathElement, capSlot: SVGPathElement, teeth: SVGPathElement, pawl: SVGPathElement, pawlEdge: SVGPathElement;
    let opt: string[] = [];

    const front = (pts: readonly Vec2[], y = HD) => poly(pts.map(([x, z]) => P(x, y, z)));
    const ringX = (x: number, y: number, z: number, r: number, k = 18) => poly(Array.from({ length: k }, (_, i) => P(x, y + Math.cos((i / k) * Math.PI * 2) * r, z + Math.sin((i / k) * Math.PI * 2) * r)));
    const ringY = (x: number, z: number, r: number, k = 16) => front(Array.from({ length: k }, (_, i): Vec2 => [x + Math.cos((i / k) * Math.PI * 2) * r, z + Math.sin((i / k) * Math.PI * 2) * r]));
    /** A cylinder along x from x0 to x1 about (y, z), turned by `ph`. */
    const RY: Rot = [[0, 0, -1], [0, 1, 0], [1, 0, 0]];
    const drumX = (x0: number, x1: number, y: number, z: number, r: number, k = 28, ph = 0) => {
      const ring: Vec2[] = Array.from({ length: k }, (_, i) => { const t = ph + (i / k) * Math.PI * 2; return [Math.cos(t) * r, Math.sin(t) * r]; });
      const p = prism3([(x0 + x1) / 2, y, z], ring, (x1 - x0) / 2, RY);
      const s = poly3(C, P, p.verts, p.faces);
      s.crease = poly(p.verts.slice(k).map((v) => P(v[0], v[1], v[2])));
      return s;
    };

    function card(parent: Element, withText: boolean): Card {
      const cg = mk("g", {}, parent);
      const body = solid(cg);
      const mkHalf = (half: "u" | "l") => {
        const tg = mk("g", {}, cg);
        const cl = mk("g", { "clip-path": `url(#${id}-${half})` }, tg);
        const t = mk("text", { class: "k-text hi", "text-anchor": "middle", y: (FS * 0.36).toFixed(2) }, cl) as SVGTextElement;
        t.style.fontSize = FS + "px";
        t.style.letterSpacing = "0.02em";
        return { tg, t };
      };
      const f = mkHalf("u"), b = mkHalf("l");
      if (!withText) { f.tg.setAttribute("display", "none"); b.tg.setAttribute("display", "none"); }
      return { body, front: f.tg, back: b.tg, ft: f.t, bt: b.t };
    }

    const axle: Vec3 = [0, 0, 0];
    /** Puts a card at angle φ: the front carries the top half of `a`, the back the bottom half of `b`. */
    function place(c: Card, phi: number, a: string | null, b: string | null) {
      const t = along(phi), n = normal(phi);
      const len = FH - GAP;
      const box = cuboid(add3(axle, scale3(t, GAP + len / 2)), FW, TH, len / 2, [[1, 0, 0], n, t]);
      c.body.put(poly3(C, P, box.verts, box.faces));
      const seen = dot3(n, V) > 0;
      if (a === null) c.front.setAttribute("display", "none");
      else {
        c.front.setAttribute("display", seen ? "inline" : "none");
        if (seen) { c.front.setAttribute("transform", planeMatrix(P, add3(axle, scale3(n, TH + 0.02)), [1, 0, 0], scale3(t, -1))); if (c.ft.textContent !== a) c.ft.textContent = a; }
      }
      if (b === null) c.back.setAttribute("display", "none");
      else {
        c.back.setAttribute("display", seen ? "none" : "inline");
        if (!seen) { c.back.setAttribute("transform", planeMatrix(P, add3(axle, scale3(n, -TH - 0.02)), [1, 0, 0], t)); if (c.bt.textContent !== b) c.bt.textContent = b; }
      }
    }

    function build() {
      g.replaceChildren();
      opt = list();
      N = opt.length;
      const longest = Math.min(6, Math.max(1, ...opt.map((s) => s.length)));
      FW = (longest * FS * 0.6) / 2 + 2.4;
      WX = FW + 4;
      ZA = HZ0 + 5.6 + FH;
      WZ0 = ZA - FH - 0.8; WZ1 = ZA + FH + 3.4;
      HX = WX + 3.6; HD = 9; YA = HD - 4;
      axle[1] = YA; axle[2] = ZA;
      const HZ1 = WZ1 + 3.4;
      XW = HX + 2.6; // the advance wheel's middle
      const PX0 = -HX - 3, PX1 = HX + 8.5, PY0 = -HD - 3, PY1 = HD + 4.5;
      const ext: Vec3[] = [[PX0, PY0, 0], [PX1, PY1, 0], [PX0, PY1, 0], [PX1, PY0, 0], [-HX, -HD, HZ1], [HX, -HD, HZ1], [XW, YA, ZA + RR]];
      fit(C, ext, VW / 2, VH / 2 + 1, VW - 20, VH - 16);
      P = proj(C);

      // the mounting plate on four screws
      shadow(g, flat(P, rrect(PX0, PY0 + 3, PX1, PY1 + 3, 4), 0));
      solid(g).put(slab(C, P, PX0, PY0, PX1, PY1, 4, 0, HZ0));
      line(g, "lo").setAttribute("d", flat(P, rrect(PX0 + 2, PY0 + 2, PX1 - 2, PY1 - 2, 2.4), HZ0));
      const screws: string[] = [];
      for (const [x, y] of [[PX0 + 4, PY0 + 4], [PX1 - 4, PY0 + 4], [PX0 + 4, PY1 - 4], [PX1 - 4, PY1 - 4]]) {
        solid(g).put(cyl(C, P, x, y, 1.7, HZ0, HZ0 + 0.6, 18));
        screws.push(seg(P(x - 1.2, y + 0.4, HZ0 + 0.6), P(x + 1.2, y - 0.4, HZ0 + 0.6)));
      }
      line(g, "edge").setAttribute("d", screws.join(""));

      // the housing: its lid seam, two lid screws, and the bezel round the front
      solid(g).put(slab(C, P, -HX, -HD, HX, HD, 2, HZ0, HZ1));
      line(g, "lo").setAttribute("d", flat(P, rrect(-HX + 1.6, -HD + 1.6, HX - 1.6, HD - 1.6, 1.2), HZ1));
      const lid: string[] = [];
      for (const x of [-HX + 4, HX - 4]) {
        solid(g).put(cyl(C, P, x, -HD + 4.5, 1.3, HZ1, HZ1 + 0.5, 16));
        lid.push(seg(P(x - 0.9, -HD + 4.8, HZ1 + 0.5), P(x + 0.9, -HD + 4.2, HZ1 + 0.5)));
      }
      line(g, "edge").setAttribute("d", lid.join(""));
      line(g, "lo").setAttribute("d", front([[-HX + 1.4, HZ0 + 1.4], [HX - 1.4, HZ0 + 1.4], [HX - 1.4, HZ1 - 1.4], [-HX + 1.4, HZ1 - 1.4]]));

      // the window and what is seen through it: the drum's back wall, the left reveal and the sill, the flap discs, the flaps
      const BACK = YA - 3.6;
      const defs = mk("defs", {}, g);
      mk("path", { d: front([[-WX, WZ0], [WX, WZ0], [WX, WZ1], [-WX, WZ1]]) }, mk("clipPath", { id }, defs));
      // the halves a flap's legend is cut to, in the flap's own frame
      mk("rect", { x: -FW, y: -FH - 1, width: 2 * FW, height: FH + 1 - GAP }, mk("clipPath", { id: id + "-u" }, defs));
      mk("rect", { x: -FW, y: GAP, width: 2 * FW, height: FH + 1 - GAP }, mk("clipPath", { id: id + "-l" }, defs));
      const win = mk("g", { "clip-path": `url(#${id})` }, g);
      mk("path", { class: "k-slot", d: front([[-WX, WZ0], [WX, WZ0], [WX, WZ1], [-WX, WZ1]], BACK) }, win);
      mk("path", { class: "k-slot", d: poly([P(-WX, BACK, WZ0), P(-WX, HD, WZ0), P(-WX, HD, WZ1), P(-WX, BACK, WZ1)]) }, win);
      mk("path", { class: "k-slot", d: poly([P(-WX, BACK, WZ0), P(WX, BACK, WZ0), P(WX, HD, WZ0), P(-WX, HD, WZ0)]) }, win);
      line(win, "edge").setAttribute("d", seg(P(-WX, BACK, WZ0), P(-WX, HD, WZ0)) + seg(P(-WX, BACK, WZ0), P(WX, BACK, WZ0)) + seg(P(-WX, BACK, WZ0), P(-WX, BACK, WZ1)));
      // the drum: its axle across the window, and a flap disc at each end of it
      solid(win).put(drumX(-WX, WX, YA, ZA, 0.9, 14));
      for (const x of [-FW - 1.8, FW + 0.6]) solid(win).put(drumX(x, x + 1.2, YA, ZA, 3.1, 24));
      fan = [3, 2, 1].map((k) => card(win, k === 1));
      lower = card(win, true);
      top = card(win, true);
      flights = [0, 1, 2, 3].map(() => card(win, true));
      // the bezel round the window, four rivets, the run lamp
      line(g, "edge").setAttribute("d", front([[-WX - 0.8, WZ0 - 0.8], [WX + 0.8, WZ0 - 0.8], [WX + 0.8, WZ1 + 0.8], [-WX - 0.8, WZ1 + 0.8]]));
      mk("path", { class: "k-face", d: [[-HX + 3, HZ0 + 3], [HX - 3, HZ1 - 3], [-HX + 3, HZ1 - 3]].map(([x, z]) => ringY(x, z, 0.9)).join("") }, g);
      const LX = HX - 3.4, LZ = HZ0 + 3;
      mk("path", { class: "k-face", d: ringY(LX, LZ, 1.7) }, g);
      glow = mk("path", { class: "k-glow", d: ringY(LX, LZ, 1.9) }, g);
      lamp = mk("path", { class: "k-led", d: ringY(LX, LZ, 1.05) }, g);

      // the side: the axle's bearing boss, the ratchet and its pawl, the knurled wheel and the axle cap
      const X0 = HX;
      solid(g).put(drumX(X0, X0 + 1, YA, ZA, 2.6, 24));
      // the pawl's pivot screw and its leaf spring, behind the ratchet
      const PV: Vec3 = [X0 + 0.9, YA - RR - 2.6, ZA + 3.6];
      solid(g).put(drumX(X0, X0 + 1.6, PV[1], PV[2], 1.2, 16));
      line(g, "edge").setAttribute("d", seg(P(X0 + 1.6, PV[1] - 0.8, PV[2] - 0.2), P(X0 + 1.6, PV[1] + 0.8, PV[2] + 0.2)));
      wheelG = mk("g", {}, g);
      const ratchet = solid(wheelG);
      ratchet.put(drumX(X0 + 1, X0 + 1.7, YA, ZA, RR, 40));
      teeth = line(wheelG, "edge");
      const pg = mk("g", { class: "k-solid" }, wheelG);
      pawl = mk("path", { class: "k-fill" }, pg);
      pawlEdge = mk("path", { class: "k-edge" }, pg);
      knurl = solid(wheelG);
      knurlRibs = line(wheelG, "lo");
      cap = mk("path", { class: "k-face" }, wheelG);
      capSlot = line(wheelG, "edge");
      pawlAt = PV;
      sync();
      drawn = { a: NaN, top: NaN };
    }

    let pawlAt: Vec3 = [0, 0, 0];
    const TEETH = () => N * Math.max(1, Math.ceil(16 / N));
    /** The side wheels at drum angle `a` (radians, positive turns the flaps forward). */
    function drawWheel(a: number) {
      const X1 = HX + 1.7, x0 = X1, x1 = X1 + 2.6, nT = TEETH(), st = (Math.PI * 2) / nT;
      // ratchet teeth: a sawtooth on its outer face
      const pts: Vec2[] = [];
      for (let k = 0; k < nT; k++) {
        const t0 = -a + k * st;
        for (const [dt, r] of [[0, RR], [st * 0.82, RR - 1.1], [st * 0.82, RR - 0.05]] as const) {
          const t = t0 + dt;
          pts.push(P(X1, YA + Math.cos(t) * r, ZA + Math.sin(t) * r));
        }
      }
      teeth.setAttribute("d", poly(pts));
      // the pawl rides the teeth: lifted as a tooth passes under its tip
      const frac = ((a / st) % 1 + 1) % 1, lift = 0.9 * (1 - frac);
      const tipT = rad(124), tip: Vec3 = [X1 - 0.3, YA + Math.cos(tipT) * (RR - 0.6 + lift), ZA + Math.sin(tipT) * (RR - 0.6 + lift)];
      const b = bar(P, pawlAt, tip, 0.75, 0.55, 16);
      pawl.setAttribute("d", b.sil); pawlEdge.setAttribute("d", b.sil);
      knurl.put(drumX(x0, x1, YA, ZA, RK, 32, -a));
      const ribs: string[] = [];
      for (let k = 0; k < 32; k++) {
        const t = -a + (k / 32) * Math.PI * 2;
        // ribs on the part of the rim that faces the viewer
        const ny = Math.cos(t), nz = Math.sin(t);
        if (ny * V[1] + nz * V[2] < 0.12) continue;
        ribs.push(seg(P(x0 + 0.25, YA + ny * RK, ZA + nz * RK), P(x1 - 0.25, YA + ny * RK, ZA + nz * RK)));
      }
      knurlRibs.setAttribute("d", ribs.join(""));
      cap.setAttribute("d", ringX(x1, YA, ZA, 1.5));
      const ca = Math.cos(-a), sa = Math.sin(-a);
      capSlot.setAttribute("d", seg(P(x1, YA + ca * 1.1, ZA + sa * 1.1), P(x1, YA - ca * 1.1, ZA - sa * 1.1)));
    }

    // the drum: `head` is the option on the top flap, `low` the one on the bottom; flights are flaps in the air
    let value = "", head = 0, low = 0;
    type Flight = { c: number; t0: number; phi0: number };
    let air: Flight[] = [];
    let lastDrop = -1e9, lean = 0, pressed = false;
    const topSp = spring(REST, { k: 420, c: 16, eps: 0.002 });
    const wheel = spring(0, { k: 420, c: 16, eps: 0.002 });
    let turns = 0, wheelLean = 0;
    let drawn = { a: NaN, top: NaN };
    const index = () => Math.max(0, opt.indexOf(value));
    const at = (i: number) => opt[((i % N) + N) % N] ?? "";

    /** The angle of a falling flap, `t` ms after its release: it gathers speed, lands, and bounces once on the stack. */
    function fallAngle(f: Flight, t: number) {
      if (t < FALL) { const u = t / FALL; return f.phi0 + (Math.PI - f.phi0) * u * u; }
      const v = Math.min(1, (t - FALL) / BOUNCE);
      return Math.PI - rad(16) * Math.abs(Math.sin(2 * Math.PI * v)) * (1 - v) * (1 - v);
    }

    function paint(now: number) {
      // the waiting flaps, the bottom flap, the top flap, then the falling ones, oldest first
      fan.forEach((c, i) => place(c, FAN - rad(10) * (fan.length - 1 - i), i === fan.length - 1 ? at(head + 1) : null, null));
      place(lower, Math.PI, null, at(air.length ? air[0].c : low));
      place(top, topSp.x, at(head), null);
      flights.forEach((c, i) => {
        const f = air[i];
        c.body.g.parentElement!.setAttribute("display", f ? "inline" : "none");
        if (f) place(c, fallAngle(f, now - f.t0), at(f.c), at(f.c + 1));
      });
      if (wheel.x !== drawn.a) { drawn.a = wheel.x; drawWheel(wheel.x); }
    }

    const B = register(host, (dt, now) => {
      if (!opt.length) return false;
      const goal = index();
      if (reducedMotion()) {
        head = low = goal; air = []; turns = Math.round(turns);
      } else if (head !== goal && now - lastDrop >= EVERY && !pressed) {
        // release the next flap from wherever the top flap is leaning
        air.push({ c: head, t0: now, phi0: topSp.x });
        head = (head + 1) % N; lastDrop = now; turns += 1;
        topSp.x = FAN; topSp.v = 0;
      }
      air = air.filter((f) => { if (now - f.t0 < FALL + BOUNCE) return true; low = (f.c + 1) % N; return false; });
      const running = air.length > 0 || head !== goal;
      topSp.t = pressed ? rad(24) : REST + lean;
      const m1 = stepS(topSp, dt);
      wheel.t = turns * ((Math.PI * 2) / N) + wheelLean;
      const m2 = stepS(wheel, dt);
      paint(now);
      lamp.classList.toggle("on", running);
      glow.classList.toggle("on", running);
      return m1 || m2 || running;
    });
    bag.add(B.unregister);

    function sync() {
      select.disabled = !!opts.disabled;
      select.setAttribute("aria-label", opts.label ?? "Flap");
      if (opts.name) select.name = opts.name; else select.removeAttribute("name");
      if (select.value !== value) select.value = value;
      host.setAttribute("data-state", value);
    }

    function rebuild() {
      build();
      select.replaceChildren(...opt.map((v) => { const op = doc.createElement("option"); op.value = v; op.textContent = v; return op; }));
      const first = opts.value ?? (value || undefined) ?? opts.defaultValue;
      value = opt.includes(first as string) ? (first as string) : opts.defaultValue !== undefined && opt.includes(opts.defaultValue) ? opts.defaultValue : opt[0];
      head = low = index(); air = [];
      sync();
      topSp.x = topSp.t = REST; topSp.v = 0;
      wheel.x = wheel.t = turns * ((Math.PI * 2) / N); wheel.v = 0;
      paint(performance.now());
      B.wake();
    }

    const ask = (v: string) => {
      if (v === value || !opt.includes(v)) { select.value = value; return; }
      if (opts.controlled) { select.value = value; emit(opts.onValueChange, v); return; }
      value = v; sync(); B.wake(); emit(opts.onValueChange, v);
    };
    const next = () => ask(at(index() + 1));
    bag.on(select, "change", () => ask(select.value));
    bag.on(select, "input", () => ask(select.value));

    // pointer: the advance wheel on the side, or the module (anything else), which drops the next flap
    const view = (e: { clientX: number; clientY: number }): Vec2 => {
      const r = svg.getBoundingClientRect();
      return [((e.clientX - r.left) / (r.width || 1)) * VW, ((e.clientY - r.top) / (r.height || 1)) * VH];
    };
    const onWheel = (e: { clientX: number; clientY: number }) => {
      const [sx, sy] = view(e), c = P(XW, YA, ZA);
      return Math.hypot(sx - c[0], sy - c[1]) < RR * C.S * 1.15;
    };
    let drag: { y: number; acc: number; moved: boolean } | null = null;
    const STEP = () => (Math.PI * 2) / N;
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0 || !opt.length) return;
      select.focus({ preventScroll: true });
      host.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      if (onWheel(e)) {
        // the thumb takes up the wheel's slack against the pawl
        drag = { y: e.clientY, acc: 0, moved: false };
        wheelLean = STEP() * 0.3;
      } else {
        // the top flap gives under the finger, held at its release point
        pressed = true;
      }
      B.wake();
    });
    bag.on(host, "pointermove", (e) => {
      if (drag) {
        // dragging the wheel's front down turns the drum forward; the ratchet stops it going back
        const r = svg.getBoundingClientRect(), px = Math.max(8, (STEP() * RK * C.S * r.width) / VW * 1.6);
        const d = Math.max(0, (e.clientY - drag.y) / px), steps = Math.floor(d) - drag.acc;
        if (d > 0.15) drag.moved = true;
        if (steps > 0) { drag.acc += steps; for (let k = 0; k < steps; k++) next(); }
        wheelLean = (d - Math.floor(d)) * STEP() * 0.45;
        B.wake();
        return;
      }
      if (e.pointerType !== "mouse" || opts.disabled || pressed) return;
      // hover: the top flap tips toward its fall, or the wheel turns a few degrees
      const w = onWheel(e);
      const l = w ? 0 : rad(7), wl = w ? rad(5) : 0;
      if (l !== lean || wl !== wheelLean) { lean = l; wheelLean = wl; B.wake(); }
    });
    const end = (commit: boolean) => {
      const was = pressed, d = drag;
      pressed = false; drag = null; wheelLean = 0;
      if (commit && !opts.disabled && (was || (d && !d.moved))) next();
      B.wake();
    };
    bag.on(host, "pointerup", () => end(true));
    bag.on(host, "pointercancel", () => end(false));
    bag.on(host, "pointerleave", () => { if (!drag && !pressed) { lean = 0; wheelLean = 0; B.wake(); } });
    bag.on(host, "wheel", (e) => {
      if (opts.disabled || !opt.length) return;
      e.preventDefault();
      // down turns the drum on a flap; up asks for the one before, which the drum reaches the long way round
      ask(at(index() + (e.deltaY > 0 ? 1 : -1)));
    }, { passive: false });

    rebuild();
    bag.add(() => { select.remove(); host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state"); svg.replaceChildren(); });
    return {
      update(nextO, prev) {
        opts = nextO;
        if (JSON.stringify(nextO.options) !== JSON.stringify(prev.options)) { rebuild(); return; }
        if (nextO.value !== undefined && nextO.value !== value && opt.includes(nextO.value)) value = nextO.value;
        sync();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
