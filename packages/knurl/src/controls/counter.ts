import { camera, cyl, fit, flat, planeMatrix, proj, rrect, seg, slab, type Vec2, type Vec3 } from "../core/iso";
import { spring, stepS, type Spring } from "../core/motion";
import { define } from "../core/control";
import { range, RANGE_KEYS, type RangeOptions } from "../core/range";
import { disposer, line, mk, register, shadow, solid, type Solid } from "../core/stage";

/**
 * Counter — a number field, built as a mechanical tally counter.
 *
 * Number drums behind a window roll like an odometer: the ones roll freely
 * and each higher drum turns only while the one below it carries. Two keys on
 * the deck step down and up; holding one repeats. The drums also answer the
 * wheel, a vertical drag and the arrow keys.
 *
 * Semantics come from a visually hidden `<input type="number">`.
 */

export type CounterOptions = RangeOptions;

const VW = 280, VH = 150;
let cid = 0;

export const counter = define<CounterOptions>({
  id: "counter",
  label: "Counter",
  vw: VW,
  vh: VH,
  width: 220,
  keys: RANGE_KEYS,
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg } = ctx;
    const bag = disposer();
    let opts = { ...o, min: Math.max(0, o.min ?? 0), max: o.max ?? 999 };
    const C = camera(28, 30);
    let P = proj(C);
    const g = mk("g", {}, svg);
    const id = "knurl-c" + ++cid;

    const r = range(ctx, opts, "number", "Counter", () => B.wake());
    host.setAttribute("data-knurl-hit", "");

    type Drum = { group: SVGGElement; a: SVGTextElement; b: SVGTextElement };
    let drums: Drum[] = [];
    let keyDown: Solid, keyUp: Solid, signs: SVGPathElement;
    let HX0 = 0, HX1 = 0, DW = 0;
    const HY = 10, HZ0 = 4, HZ1 = 20, WZ0 = 8.5, WZ1 = 17, DH = 8.5;
    const KX = 8; // key half-size

    function build() {
      g.replaceChildren();
      const n = Math.max(1, String(Math.floor(r.max)).length);
      DW = 7.4;
      const winW = n * DW + 4;
      HX0 = -winW / 2 - 9; HX1 = winW / 2 + 5;
      const kx0 = HX1 + 6, kx1 = kx0 + 2 * KX + 4 + 2 * KX;
      const BX0 = HX0 - 6, BX1 = kx1 + 6, BY = HY + 8;
      const ext: Vec3[] = [[BX0, -BY, 0], [BX1, BY, 0], [BX0, BY, 0], [BX1, -BY, 0], [HX0, -HY, HZ1], [HX1, -HY, HZ1]];
      fit(C, ext, VW / 2, VH / 2 + 2, VW - 22, VH - 18);
      P = proj(C);

      shadow(g, flat(P, rrect(BX0, -BY + 3, BX1, BY + 3, 4), 0));
      solid(g).put(slab(C, P, BX0, -BY, BX1, BY, 4, 0, HZ0));
      line(g, "lo").setAttribute("d", flat(P, rrect(BX0 + 2, -BY + 2, BX1 - 2, BY - 2, 2.4), HZ0));
      const screws: string[] = [];
      for (const [x, y] of [[BX0 + 4, -BY + 4], [BX0 + 4, BY - 4], [BX1 - 4, -BY + 4], [BX1 - 4, BY - 4]]) {
        solid(g).put(cyl(C, P, x, y, 1.6, HZ0, HZ0 + 0.6, 16));
        screws.push(seg(P(x - 1.1, y + 0.4, HZ0 + 0.6), P(x + 1.1, y - 0.4, HZ0 + 0.6)));
      }
      line(g, "edge").setAttribute("d", screws.join(""));

      // the housing, its seam, and the drum axle's end cap on its side
      solid(g).put(slab(C, P, HX0, -HY, HX1, HY, 2.2, HZ0, HZ1));
      line(g, "lo").setAttribute("d", flat(P, rrect(HX0 + 1.5, -HY + 1.5, HX1 - 1.5, HY - 1.5, 1.4), HZ1));
      const capC = P(HX1, 0, (WZ0 + WZ1) / 2);
      void capC;
      const face = (x0: number, z0: number, x1: number, z1: number): string =>
        "M" + ([[x0, z0], [x1, z0], [x1, z1], [x0, z1]] as Vec2[]).map(([x, z]) => P(x, HY, z).map((q) => q.toFixed(2)).join(" ")).join("L") + "Z";

      // the window, with a clip in the face's own frame for the drums
      const wx0 = -winW / 2, wx1 = winW / 2;
      mk("path", { class: "k-slot", d: face(wx0, WZ0, wx1, WZ1) }, g);
      const fm = planeMatrix(P, [wx0, HY, WZ1], [1, 0, 0], [0, 0, -1]);
      const defs = mk("defs", {}, g);
      const clip = mk("clipPath", { id }, defs);
      mk("rect", { x: 0.6, y: 0.6, width: winW - 1.2, height: WZ1 - WZ0 - 1.2 }, clip);
      const win = mk("g", { transform: fm }, g);
      const inner = mk("g", { "clip-path": `url(#${id})` }, win);
      drums = Array.from({ length: n }, (_, i) => {
        const gx = mk("g", {}, inner);
        const x = 2 + (n - 1 - i) * DW + DW / 2;
        const a = mk("text", { class: "k-text hi", "text-anchor": "middle", x }, gx) as SVGTextElement;
        const b = mk("text", { class: "k-text hi", "text-anchor": "middle", x }, gx) as SVGTextElement;
        a.style.fontSize = b.style.fontSize = "7px";
        return { group: gx, a, b };
      });
      const seps: string[] = [];
      for (let i = 1; i < n; i++) { const x = 2 + i * DW; seps.push(`M${x} 0.6L${x} ${WZ1 - WZ0 - 0.6}`); }
      mk("path", { class: "k-line lo", d: seps.join("") }, win);
      // the reading line across the window
      mk("path", { class: "k-line accent", d: `M-1.6 ${(WZ1 - WZ0) / 2}L0 ${(WZ1 - WZ0) / 2}` }, win);
      line(g, "edge").setAttribute("d", face(wx0 - 1, WZ0 - 1, wx1 + 1, WZ1 + 1));

      // the two keys on the deck
      solid(g).put(slab(C, P, kx0 - 1, -KX - 1, kx1 + 1, KX + 1, 2, HZ0, HZ0 + 1.2));
      keyDown = solid(g); keyUp = solid(g);
      signs = line(g, "hi");
      keyX = [kx0 + KX, kx1 - KX];
      drawKeys();
      lastV = NaN;
    }

    let keyX: [number, number] = [0, 0];
    const ks: Spring[] = [spring(0, { k: 600, c: 24 }), spring(0, { k: 600, c: 24 })];
    function drawKeys() {
      const out: string[] = [];
      [keyDown, keyUp].forEach((k, i) => {
        const x = keyX[i], z0 = HZ0 + 1.2, z1 = z0 + 5 - ks[i].x;
        k.put(slab(C, P, x - KX + 0.5, -KX + 0.5, x + KX - 0.5, KX - 0.5, 2, z0, z1));
        out.push(seg(P(x - 3, 0, z1), P(x + 3, 0, z1)));
        if (i === 1) out.push(seg(P(x, -3, z1), P(x, 3, z1)));
      });
      signs.setAttribute("d", out.join(""));
    }

    let lastV = NaN;
    const vs = spring(r.value, { k: 140, c: 22, eps: 0.002 });
    function drawDrums(V: number) {
      if (V === lastV) return;
      lastV = V;
      const H = WZ1 - WZ0;
      V = Math.max(0, V);
      drums.forEach((d, i) => {
        const p10 = 10 ** i, below = V % p10;
        let digit = Math.floor(V / p10) % 10, frac = i === 0 ? V % 1 : below > p10 - 1 ? below - (p10 - 1) : 0;
        if (i === 0) digit = Math.floor(V) % 10;
        const y = H / 2 + 2.5 - frac * H;
        d.a.setAttribute("y", y.toFixed(2));
        d.b.setAttribute("y", (y + H).toFixed(2));
        d.a.textContent = String(digit);
        d.b.textContent = String((digit + 1) % 10);
      });
    }

    let pressed = -1, repeat = 0, drag: { y: number; v: number } | null = null;
    const B = register(host, (dt) => {
      vs.t = r.value;
      let m = stepS(vs, dt);
      drawDrums(vs.x);
      ks[0].t = pressed === 0 ? 2.4 : 0; ks[1].t = pressed === 1 ? 2.4 : 0;
      const k0 = stepS(ks[0], dt), k1 = stepS(ks[1], dt);
      if (k0 || k1 || pressed >= 0) drawKeys();
      return m || k0 || k1;
    });
    bag.add(B.unregister);
    build();
    drawDrums(vs.x);

    // pointer: a key steps and repeats while held; elsewhere a vertical drag rolls the drums
    const step = () => (r.step > 0 ? r.step : 1);
    const keyAt = (e: PointerEvent) => {
      const b = svg.getBoundingClientRect();
      const sx = ((e.clientX - b.left) / b.width) * VW, sy = ((e.clientY - b.top) / b.height) * VH;
      for (let i = 0; i < 2; i++) {
        const c = P(keyX[i], 0, HZ0 + 4);
        if (Math.abs(sx - c[0]) < KX * C.S * 0.95 && Math.abs(sy - c[1]) < KX * C.S * 0.75) return i;
      }
      return -1;
    };
    const fire = () => r.ask(r.value + (pressed === 1 ? step() : -step()));
    const stopRepeat = () => { clearTimeout(repeat); repeat = 0; };
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0) return;
      host.setPointerCapture?.(e.pointerId);
      r.input.focus({ preventScroll: true });
      e.preventDefault();
      const k = keyAt(e);
      if (k >= 0) {
        pressed = k; fire(); B.wake();
        const go = (ms: number) => { repeat = window.setTimeout(() => { fire(); go(Math.max(40, ms * 0.82)); }, ms); };
        go(420);
      } else drag = { y: e.clientY, v: r.value };
    });
    bag.on(host, "pointermove", (e) => { if (drag) r.ask(drag.v + Math.round((drag.y - e.clientY) / 10) * step()); });
    const end = () => { stopRepeat(); if (pressed >= 0 || drag) r.commit(); pressed = -1; drag = null; B.wake(); };
    bag.on(host, "pointerup", end);
    bag.on(host, "pointercancel", end);
    bag.on(host, "wheel", (e) => { if (opts.disabled) return; e.preventDefault(); r.ask(r.value + (e.deltaY < 0 ? step() : -step())); }, { passive: false });
    bag.add(stopRepeat);

    bag.add(() => { r.destroy(); host.removeAttribute("data-knurl-hit"); svg.replaceChildren(); });
    return {
      update(next) {
        const before = r.max;
        opts = { ...next, min: Math.max(0, next.min ?? 0), max: next.max ?? 999 };
        r.update(opts);
        if (String(Math.floor(r.max)).length !== String(Math.floor(before)).length) build();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
