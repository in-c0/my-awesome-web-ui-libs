import { bar, camera, circle, cyl, fit, loft, poly, proj, rad, rrect, seg, slab, type Vec2, type Vec3 } from "../core/iso";
import { reducedMotion, spring, stepS } from "../core/motion";
import { define, emit, nativeInput, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid } from "../core/stage";

/**
 * Toggle — a switch, built as a bat-handle toggle on a panel.
 *
 * A hex nut and threaded bushing hold the lever; it snaps across on a stiff
 * spring with a little overshoot, the way a real toggle's cam throws it. The
 * indicator lamp beside it lights with the accent when on. Hovering leans the
 * lever a few degrees toward its other throw.
 *
 * Semantics come from a visually hidden `<input type="checkbox" role="switch">`.
 */

export type ToggleOptions = BaseOptions & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Set by the React wrapper when `checked` is controlled: the control asks, the prop decides. */
  controlled?: boolean;
};

const VW = 200, VH = 140;
const THROW = 26; // degrees from upright at each end

export const toggle = define<ToggleOptions>({
  id: "toggle",
  label: "Switch",
  vw: VW,
  vh: VH,
  width: 132,
  keys: ["checked", "defaultChecked", "onCheckedChange", "controlled"],
  controlKey: "checked",
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    const C = camera(45, 30);
    const PX = 34, PY = 22, PZ = 4;
    const NX = -8; // nut/lever centre on x
    const ext: Vec3[] = [[-PX, -PY, 0], [PX, PY, 0], [-PX, PY, 0], [PX, -PY, 0], [-PX, -PY, PZ + 34], [PX, PY, PZ + 34]];
    fit(C, ext, VW / 2, VH / 2 + 4, VW - 24, VH - 20);
    const P = proj(C);

    const g = mk("g", {}, svg);
    // shadow, panel, screws, throw marks
    shadow(g, poly(rrect(-PX, -PY, PX, PY, 5).map((q) => P(q.u, q.v + 3, 0))));
    solid(g).put(slab(C, P, -PX, -PY, PX, PY, 5, 0, PZ));
    const bevel = line(g, "lo");
    bevel.setAttribute("d", poly(rrect(-PX + 2.2, -PY + 2.2, PX - 2.2, PY - 2.2, 3).map((q) => P(q.u, q.v, PZ))));
    const screws = line(g, "edge");
    const slots: string[] = [];
    for (const [x, y] of [[-PX + 5.5, -PY + 5.5], [PX - 5.5, -PY + 5.5], [-PX + 5.5, PY - 5.5], [PX - 5.5, PY - 5.5]]) {
      solid(g).put(cyl(C, P, x, y, 2, PZ, PZ + 0.7, 20));
      const a = rad(35);
      slots.push(seg(P(x - Math.cos(a) * 1.4, y - Math.sin(a) * 1.4, PZ + 0.7), P(x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4, PZ + 0.7)));
    }
    screws.setAttribute("d", slots.join(""));
    // the throw marks: a short bar at each end of the lever's travel, the "on" one longer
    const marks = line(g, "mid");
    const offEnd = NX - 15, onEnd = NX + 15;
    marks.setAttribute("d", seg(P(offEnd, -3, PZ), P(offEnd, 3, PZ)) + seg(P(onEnd - 1.5, -4, PZ), P(onEnd - 1.5, 4, PZ)) + seg(P(onEnd + 1.5, -4, PZ), P(onEnd + 1.5, 4, PZ)));

    // the indicator lamp: bezel, lens, glow
    const LX = 22, LY = 0;
    solid(g).put(cyl(C, P, LX, LY, 5.2, PZ, PZ + 1.6, 32));
    solid(g).put(cyl(C, P, LX, LY, 3.8, PZ + 1.6, PZ + 2.4, 32));
    const glow = mk("path", { class: "k-glow", d: poly(circle(LX, LY, 4.6, 24).map((q) => P(q.u, q.v, PZ + 3))) }, g);
    const lensTop = poly(circle(LX, LY, 2.7, 24).map((q) => P(q.u, q.v, PZ + 3.2)));
    solid(g).put(cyl(C, P, LX, LY, 2.7, PZ + 2.4, PZ + 3.2, 24));
    const lens = mk("path", { class: "k-led", d: lensTop }, g);

    // the washer, the hex nut, the threaded bushing
    solid(g).put(cyl(C, P, NX, 0, 9, PZ, PZ + 0.8, 40));
    solid(g).put(loft(C, P, circle(NX, 0, 8, 6, rad(15)), PZ + 0.8, PZ + 4.4));
    const z0 = PZ + 4.4, z1 = z0 + 4.6;
    solid(g).put(cyl(C, P, NX, 0, 4.6, z0, z1, 32));
    const threads = line(g, "lo");
    threads.setAttribute("d", [1, 2, 3].map((k) => {
      const z = z0 + (k * (z1 - z0)) / 4, ring = circle(NX, 0, 4.6, 32);
      // the front half only
      return ring.filter((q) => q.nu * Math.sin(rad(45)) + q.nv * Math.cos(rad(45)) > 0.05).map((q) => P(q.u, q.v, z));
    }).map((pts) => "M" + pts.map((p) => p[0].toFixed(2) + " " + p[1].toFixed(2)).join("L")).join(""));
    const collar = solid(g);
    collar.put(cyl(C, P, NX, 0, 3.2, z1, z1 + 1.2, 28));

    // the lever: a tapered bat from the pivot, and its rounded tip
    const lg = mk("g", {}, g);
    const lever = mk("path", { class: "k-fill" }, lg);
    const leverEdge = mk("path", { class: "k-edge" }, lg);
    const leverHi = mk("path", { class: "k-line lo" }, lg);
    const tip = mk("path", { class: "k-fill" }, lg);
    const tipEdge = mk("path", { class: "k-edge" }, lg);
    const tipTop = mk("path", { class: "k-top" }, lg);
    const pivot: Vec3 = [NX, 0, z1 + 1.2];
    const LEN = 22;

    function drawLever(deg: number) {
      const a = rad(deg), b: Vec3 = [pivot[0] + Math.sin(a) * LEN, 0, pivot[2] + Math.cos(a) * LEN];
      const s = bar(P, pivot, b, 1.9, 2.9, 28);
      lever.setAttribute("d", s.sil);
      leverEdge.setAttribute("d", s.sil);
      // a highlight down the bat's lit side
      const off = 1.2;
      const p0 = P(pivot[0] - Math.cos(a) * off * 0.6, -off, pivot[2] + Math.sin(a) * off * 0.6);
      const p1 = P(b[0] - Math.cos(a) * off, -off, b[2] + Math.sin(a) * off);
      leverHi.setAttribute("d", seg(p0, p1));
      const t = bar(P, b, [b[0] + Math.sin(a) * 1.4, 0, b[2] + Math.cos(a) * 1.4], 2.9, 2.1, 28);
      tip.setAttribute("d", t.sil);
      tipEdge.setAttribute("d", t.sil);
      tipTop.setAttribute("d", t.cap);
    }

    // state
    const input = nativeInput(ctx, { type: "checkbox", role: "switch" });
    host.setAttribute("data-knurl-hit", "");
    let on = !!(o.checked ?? o.defaultChecked);
    let opts = o;
    let hover = 0;
    const sp = spring(on ? THROW : -THROW, { k: 420, c: 16, eps: 0.02 });
    const target = () => (on ? THROW : -THROW) + (on ? -1 : 1) * hover * 7;

    const sync = () => {
      input.checked = on;
      input.disabled = !!opts.disabled;
      input.setAttribute("aria-label", opts.label ?? "Switch");
      if (opts.name) input.name = opts.name; else input.removeAttribute("name");
      lens.classList.toggle("on", on);
      glow.classList.toggle("on", on);
      collar.lit(on);
      host.setAttribute("data-state", on ? "on" : "off");
    };
    sync();

    const B = register(host, (dt) => {
      sp.t = target();
      const moving = stepS(sp, dt);
      drawLever(sp.x);
      return moving;
    });
    bag.add(B.unregister);
    if (reducedMotion()) drawLever(sp.t);

    const ask = (next: boolean) => {
      if (opts.controlled) { input.checked = on; emit(opts.onCheckedChange, next); return; }
      on = next; sync(); B.wake(); emit(opts.onCheckedChange, next);
    };
    bag.on(input, "change", () => ask(input.checked));
    bag.on(host, "click", (e) => {
      if (opts.disabled || e.target === input) return;
      input.focus({ preventScroll: true });
      ask(!on);
    });
    bag.on(host, "pointerenter", (e) => { if (e.pointerType === "mouse") { hover = 1; B.wake(); } });
    bag.on(host, "pointerleave", () => { hover = 0; B.wake(); });

    bag.add(() => { input.remove(); host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state"); svg.replaceChildren(); });

    return {
      update(next) {
        opts = next;
        if (next.checked !== undefined && next.checked !== on) { on = next.checked; B.wake(); }
        sync();
      },
      destroy: bag.dispose,
    };
  },
});

export type { Vec2 };
