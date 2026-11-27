import { camera, circle, cuboid, cyl, depth, fit, flat, hull, planeMatrix, poly, poly3, proj, rad, rot, rrect, seg, slab, turn, add3, unproj, type Vec2, type Vec3 } from "../core/iso";
import { reducedMotion, spring, stepS, type Spring } from "../core/motion";
import { define, emit, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, toView, type Solid } from "../core/stage";

/**
 * Breakers — a checkbox group, built as a circuit-breaker panel: a row of
 * miniature breakers clipped to a DIN rail between two end stops.
 *
 * Each breaker is a moulded module with its terminal screws, wire entries
 * and its circuit label, a toggle handle in a slot on its raised front, and a flag
 * window that shows the accent when the circuit is on. Up (away from you) is
 * on, as on a real panel. A handle throws across on a stiff spring and
 * rebounds off its stop; a press gives way at once toward the throw, and the
 * click commits it. Hovering a breaker with a mouse leans its handle a few
 * degrees toward the throw a click would make. A click anywhere on a module,
 * or on the panel beside it, toggles that breaker.
 *
 * Semantics come from one visually hidden `<input type="checkbox">` per
 * breaker inside a `role="group"`, so Tab, Space, screen readers and forms
 * behave as the platform's own.
 */

export type BreakerItem = { id: string; label: string };

export type BreakersOptions = BaseOptions & {
  /** The breakers, left to right. Labels read best at 5 characters or fewer. Default four sample circuits. */
  items?: BreakerItem[];
  /** The ids of the breakers that are on. Controlled; pair with onValueChange. */
  value?: string[];
  /** The ids that start on when uncontrolled. */
  defaultValue?: string[];
  /** Called with every id that is on, in the items' order. */
  onValueChange?: (ids: string[]) => void;
  /** Set by the React wrapper when `value` is controlled. */
  controlled?: boolean;
};

const VW = 300, VH = 160;
const THROW = 24;  // degrees from upright at each end
const LEAN = 6;    // how far a hover tips a handle toward its throw
const PUSH = 0.6;  // how much of the throw a held press takes
const SAMPLE: BreakerItem[] = [
  { id: "lights", label: "LIGHT" },
  { id: "plugs", label: "PLUGS" },
  { id: "oven", label: "OVEN" },
  { id: "heat", label: "HEAT" },
];
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

export const breakers = define<BreakersOptions>({
  id: "breakers",
  label: "Circuit breakers",
  vw: VW,
  vh: VH,
  width: 280,
  keys: ["items", "value", "defaultValue", "onValueChange", "controlled"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg, doc } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(28, 40);
    let P = proj(C);
    const g = mk("g", {}, svg);
    const group = doc.createElement("div");
    group.setAttribute("role", "group");
    group.setAttribute("data-knurl-sr", "");
    host.appendChild(group);
    host.setAttribute("data-knurl-hit", "");
    const gname = "knurl-breakers-" + ++uid;

    type Module = {
      item: BreakerItem; i: number; cx: number; x0: number; x1: number;
      input: HTMLInputElement; stem: Solid; cap: Solid; grip: SVGPathElement;
      flag: SVGPathElement; glow: SVGPathElement; text: SVGTextElement;
      sp: Spring; drawn: number; hit: Vec2[];
    };
    let mods: Module[] = [];
    const on = new Set<string>((o.value ?? o.defaultValue ?? []).map(String));
    let hover = -1, held = -1, focus = -1;
    let still: { x: number; y: number } | null = null; // where a press was let go: no lean until the mouse moves on
    // the module's profile, in world units: width, pitch, shoulders, raised front, the handle's pivot
    const MW = 12, GAP = 0.5, PITCH = MW + GAP, SY = 17, HY = 8.5, PZ = 3, RZ = PZ + 2.2, ZS = RZ + 6, ZH = ZS + 6, ZP = ZH - 1.4;

    const items = (): BreakerItem[] => {
      const src = Array.isArray(opts.items) && opts.items.length ? opts.items : SAMPLE;
      return src.map((it, i) => ({ id: String(it.id ?? i), label: String(it.label ?? "") }));
    };

    function build() {
      g.replaceChildren();
      group.replaceChildren();
      const its = items(), n = its.length;
      const span = n * PITCH - GAP, X0 = -span / 2;
      const ES = 3.4, RX = span / 2 + ES + 8.5, PX = RX + 4.5, PY = SY + 5, RW = 6.5;
      const ext: Vec3[] = [[-PX, -PY, 0], [PX, PY, 0], [-PX, PY, 0], [PX, -PY, 0], [-span / 2, -6, ZH + 8], [span / 2, -6, ZH + 8]];
      fit(C, ext, VW / 2, VH / 2 + 3, VW - 20, VH - 16);
      P = proj(C);

      // the back panel on four screws
      shadow(g, flat(P, rrect(-PX, -PY + 3, PX, PY + 3, 4), 0));
      solid(g).put(slab(C, P, -PX, -PY, PX, PY, 4, 0, PZ));
      line(g, "lo").setAttribute("d", flat(P, rrect(-PX + 2, -PY + 2, PX - 2, PY - 2, 2.6), PZ));
      const slots: string[] = [];
      for (const [x, y] of [[-PX + 4.5, -PY + 4.5], [PX - 4.5, -PY + 4.5], [-PX + 4.5, PY - 4.5], [PX - 4.5, PY - 4.5]]) {
        solid(g).put(cyl(C, P, x, y, 1.9, PZ, PZ + 0.6, 20));
        const a = rad(x * y > 0 ? 35 : -20);
        slots.push(seg(P(x - Math.cos(a) * 1.35, y - Math.sin(a) * 1.35, PZ + 0.6), P(x + Math.cos(a) * 1.35, y + Math.sin(a) * 1.35, PZ + 0.6)));
      }

      // the DIN rail: its top-hat channel, and at each end an oblong slot with the screw that holds it
      solid(g).put(slab(C, P, -RX, -RW, RX, RW, 0.5, PZ, RZ));
      mk("path", { class: "k-slot", d: flat(P, rrect(-RX + 0.6, -3.6, RX - 0.6, 3.6, 0.4), RZ) }, g);
      line(g, "lo").setAttribute("d", seg(P(-RX, -RW + 1, RZ), P(RX, -RW + 1, RZ)) + seg(P(-RX, RW - 1, RZ), P(RX, RW - 1, RZ)));
      for (const x of [-RX + 3.8, RX - 3.8]) {
        mk("path", { class: "k-face", d: flat(P, rrect(x - 2.4, -1.3, x + 2.4, 1.3, 1.3), RZ) }, g);
        solid(g).put(cyl(C, P, x - 0.6, 0, 1.5, RZ, RZ + 0.6, 18));
        slots.push(seg(P(x - 1.7, 0.3, RZ + 0.6), P(x + 0.5, -0.3, RZ + 0.6)));
      }
      line(g, "edge").setAttribute("d", slots.join(""));

      // an end stop clamped to the rail on each side of the row
      const stop = (xa: number, xb: number) => {
        solid(g).put(slab(C, P, xa, -RW - 1.6, xb, RW + 1.6, 0.6, RZ, RZ + 5));
        const xc = (xa + xb) / 2;
        solid(g).put(cyl(C, P, xc, -2.5, 1.2, RZ + 5, RZ + 5.5, 16));
        line(g, "edge").setAttribute("d", seg(P(xc - 0.85, -2.5, RZ + 5.5), P(xc + 0.85, -2.5, RZ + 5.5)));
        line(g, "lo").setAttribute("d", seg(P(xa + 0.6, 2.4, RZ + 5), P(xb - 0.6, 2.4, RZ + 5)) + seg(P(xa + 0.6, 3.6, RZ + 5), P(xb - 0.6, 3.6, RZ + 5)));
      };
      stop(X0 - ES - 0.5, X0 - 0.5);

      // the breakers, back to front (with the camera at 28°, +x is nearer)
      const firstOn = new Set(on);
      mods = its.map((item, i) => {
        const x0 = X0 + i * PITCH, x1 = x0 + MW, cx = (x0 + x1) / 2;
        // the shoulders, their terminal screws (sunk in a well) and the wire entries on the near end
        solid(g).put(slab(C, P, x0, -SY, x1, SY, 0.9, RZ, ZS));
        const screws: string[] = [];
        for (const y of [-13, 13]) {
          mk("path", { class: "k-slot", d: flat(P, circle(cx, y, 2.3, 24), ZS) }, g);
          solid(g).put(cyl(C, P, cx, y, 1.6, ZS - 1, ZS - 0.4, 20));
          screws.push(seg(P(cx - 1.1, y, ZS - 0.4), P(cx + 1.1, y, ZS - 0.4)) + seg(P(cx, y - 1.1, ZS - 0.4), P(cx, y + 1.1, ZS - 0.4)));
        }
        line(g, "edge").setAttribute("d", screws.join(""));
        mk("path", { class: "k-slot", d: poly([P(cx - 2.6, SY, RZ + 1.3), P(cx + 2.6, SY, RZ + 1.3), P(cx + 2.6, SY, RZ + 3.7), P(cx - 2.6, SY, RZ + 3.7)]) }, g);
        // the raised front, its handle slot, the I and O marks and the flag window
        solid(g).put(slab(C, P, x0 + 0.3, -HY, x1 - 0.3, HY, 0.9, ZS, ZH));
        mk("path", { class: "k-slot", d: flat(P, rrect(cx - 2.6, -3.7, cx + 2.6, 3.7, 0.8), ZH) }, g);
        line(g, "hi").setAttribute("d", seg(P(cx - 4.4, -3.4, ZH), P(cx - 4.4, -1.4, ZH)) + flat(P, circle(cx - 4.4, 2.4, 0.9, 16), ZH));
        mk("path", { class: "k-slot", d: flat(P, rrect(cx - 2.8, 4.6, cx + 2.8, 7.6, 0.5), ZH) }, g);
        const glow = mk("path", { class: "k-glow", d: flat(P, rrect(cx - 3.2, 4.2, cx + 3.2, 8, 0.8), ZH + 0.1) }, g);
        const flag = mk("path", { class: "k-led", d: flat(P, rrect(cx - 2.1, 5.2, cx + 2.1, 7, 0.3), ZH) }, g);
        // the circuit's label, on the module's near face
        const text = mk("text", { class: "k-text", "text-anchor": "middle" }, g) as SVGTextElement;
        const label = item.label.slice(0, 5);
        text.textContent = label;
        text.style.fontSize = (label.length > 4 ? 2.5 : 2.9) + "px";
        text.setAttribute("transform", planeMatrix(P, [cx, HY, (ZS + ZH) / 2], [1, 0, 0], [0, 0, -1]) + " translate(0 1)");

        const input = doc.createElement("input");
        input.type = "checkbox";
        input.value = item.id;
        input.setAttribute("aria-label", item.label || `Circuit ${i + 1}`);
        group.appendChild(input);
        const lit = firstOn.has(item.id);
        // the hit shape: the module's footprint, its front and the handle's reach
        const hp: Vec2[] = [];
        for (const x of [x0, x1]) {
          for (const y of [-SY, SY]) hp.push(P(x, y, RZ), P(x, y, ZS));
          for (const y of [-HY, HY]) hp.push(P(x, y, ZH));
          for (const y of [-6, 6]) hp.push(P(x, y, ZH + 8));
        }
        return {
          item, i, cx, x0, x1, input, stem: null as unknown as Solid, cap: null as unknown as Solid, grip: null as unknown as SVGPathElement,
          flag, glow, text, sp: spring(lit ? THROW : -THROW, { k: 420, c: 16, eps: 0.02 }), drawn: NaN, hit: hull(hp),
        };
      });
      stop(X0 + span + 0.5, X0 + span + ES + 0.5);

      // the handles sit above every module's front, so they go on last
      for (const m of mods) {
        const hg = mk("g", {}, g);
        m.stem = solid(hg);
        m.cap = solid(hg);
        m.grip = line(hg, "lo");
      }
      // ids that are no longer breakers drop out
      for (const id of [...on]) if (!its.some((it) => it.id === id)) on.delete(id);
      hover = held = focus = -1;
      sync();
      for (const m of mods) drawHandle(m, m.sp.x);
    }

    /** A handle turned `deg` about its pivot: positive is toward on (away from the viewer). */
    function drawHandle(m: Module, deg: number) {
      if (deg === m.drawn) return;
      m.drawn = deg;
      const R = rot("x", rad(deg)), c: Vec3 = [m.cx, 0, ZP];
      const st = cuboid(c, 1.9, 1.2, 3.6, R, [0, 0, -3.6]);
      m.stem.put(poly3(C, P, st.verts, st.faces));
      const cp = cuboid(c, 2.3, 1.9, 0.8, R, [0, 0, -7.8]);
      m.cap.put(poly3(C, P, cp.verts, cp.faces));
      const at = (x: number, y: number, z: number) => { const w = add3(c, turn(R, [x, y, z])); return P(w[0], w[1], w[2]); };
      m.grip.setAttribute("d", seg(at(-1.6, -0.7, 8.6), at(1.6, -0.7, 8.6)) + seg(at(-1.6, 0.7, 8.6), at(1.6, 0.7, 8.6)));
    }

    function sync() {
      group.setAttribute("aria-label", opts.label ?? "Circuit breakers");
      for (const m of mods) {
        const lit = on.has(m.item.id);
        m.input.checked = lit;
        m.input.disabled = !!opts.disabled;
        if (opts.name) m.input.name = opts.name; else m.input.removeAttribute("name");
        m.flag.classList.toggle("on", lit);
        m.glow.classList.toggle("on", lit);
        m.text.setAttribute("class", m.i === focus || m.i === hover ? "k-text hi" : "k-text");
      }
    }

    const end = (s: boolean) => (s ? THROW : -THROW);
    const target = (m: Module) => {
      const b = end(on.has(m.item.id)), other = -b;
      if (m.i === held) return b + (other - b) * PUSH;
      return m.i === hover && !still ? b + Math.sign(other - b) * LEAN : b;
    };
    // a throw rebounds off the stop at each end of the slot
    const stopAt = (x: number) => (x > THROW ? 2 * THROW - x : x < -THROW ? -2 * THROW - x : x);

    build();
    const B = register(host, (dt) => {
      let moving = false;
      for (const m of mods) {
        m.sp.t = target(m);
        m.sp.c = m.i === held ? 30 : 16;
        if (stepS(m.sp, dt)) moving = true;
        drawHandle(m, stopAt(m.sp.x));
      }
      return moving;
    });
    bag.add(B.unregister);
    if (reducedMotion()) for (const m of mods) drawHandle(m, m.sp.t);

    const ids = (flip: Module, next: boolean) => mods.filter((m) => (m === flip ? next : on.has(m.item.id))).map((m) => m.item.id);
    const ask = (m: Module, next: boolean) => {
      if (next === on.has(m.item.id)) { m.input.checked = next; return; }
      const value = ids(m, next);
      if (opts.controlled) { m.input.checked = !next; emit(opts.onValueChange, value); return; }
      if (next) on.add(m.item.id); else on.delete(m.item.id);
      sync(); B.wake(); emit(opts.onValueChange, value);
    };
    bag.on(group, "change", (e) => {
      const m = mods.find((x) => x.input === e.target);
      if (m) ask(m, m.input.checked);
    });

    // pointer: the module under the pointer, nearest first; off every module, the column it is in
    const moduleAt = (e: { clientX: number; clientY: number }) => {
      if (!mods.length) return -1;
      const q = toView(svg, e, VW, VH);
      const order = mods.slice().sort((a, b) => depth(C, b.cx, 0, 0) - depth(C, a.cx, 0, 0));
      for (const m of order) if (inside(q, m.hit)) return m.i;
      const [x] = unproj(C, q[0], q[1], ZS);
      let best = 0, d = 1e9;
      for (const m of mods) { const dm = Math.abs(x - m.cx); if (dm < d) { d = dm; best = m.i; } }
      return best;
    };
    const setHover = (i: number) => { if (i !== hover) { hover = i; sync(); B.wake(); } };
    const hold = (i: number) => { if (i !== held) { held = i; B.wake(); } };
    bag.on(host, "pointermove", (e) => {
      if (e.pointerType !== "mouse" || opts.disabled) return;
      if (still && Math.hypot(e.clientX - still.x, e.clientY - still.y) > 6) { still = null; B.wake(); }
      setHover(moduleAt(e));
    });
    bag.on(host, "pointerleave", () => { still = null; hold(-1); setHover(-1); });
    // a press gives way at once toward the throw; the click on release commits it
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0 || e.target instanceof HTMLInputElement) return;
      const i = moduleAt(e);
      if (i < 0) return;
      mods[i].input.focus({ preventScroll: true });
      hold(i);
    });
    bag.on(host, "pointerup", (e) => { if (held >= 0) still = { x: e.clientX, y: e.clientY }; hold(-1); });
    bag.on(host, "pointercancel", () => hold(-1));
    bag.on(host, "click", (e) => {
      if (opts.disabled || e.target instanceof HTMLInputElement) return;
      const i = moduleAt(e);
      const m = mods[i];
      if (!m) return;
      m.input.focus({ preventScroll: true });
      ask(m, !on.has(m.item.id));
    });
    // Space: the handle is held while the key is down (the checkbox flips on keyup)
    bag.on(group, "keydown", (e) => {
      const m = mods.find((x) => x.input === e.target);
      if (m && e.key === " " && !opts.disabled) hold(m.i);
    });
    bag.on(group, "keyup", (e) => { if (e.key === " ") hold(-1); });
    bag.on(group, "focusin", (e) => { const m = mods.find((x) => x.input === e.target); focus = m ? m.i : -1; sync(); });
    bag.on(group, "focusout", () => { focus = -1; hold(-1); sync(); });

    bag.add(() => { group.remove(); host.removeAttribute("data-knurl-hit"); svg.replaceChildren(); });
    return {
      update(next, prev) {
        opts = next;
        if (Array.isArray(next.value)) {
          on.clear();
          for (const id of next.value) on.add(String(id));
        }
        if (JSON.stringify(next.items) !== JSON.stringify(prev.items)) build();
        else sync();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
