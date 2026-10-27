import { camera, cyl, fit, flat, planeMatrix, proj, rrect, seg, slab, type Vec3 } from "../core/iso";
import { spring, stepS, type Spring } from "../core/motion";
import { define, emit, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, type Solid } from "../core/stage";

/**
 * Presets — a radio group, built as a bank of latching preset keys, like an
 * old car radio's. Pressing one latches it down and throws the last one back
 * up with a bounce. The latched key shows an accent bar on its nose.
 *
 * Semantics come from visually hidden native radio inputs, so arrow keys,
 * screen readers and forms behave as the platform's own.
 */

export type PresetsOptions = BaseOptions & {
  /** The keys, left to right. A short legend for each (1–3 characters read best). Default ["1","2","3","4"]. */
  options?: string[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  controlled?: boolean;
};

const VW = 300, VH = 150;
let uid = 0;

export const presets = define<PresetsOptions>({
  id: "presets",
  label: "Presets",
  vw: VW,
  vh: VH,
  width: 260,
  keys: ["options", "value", "defaultValue", "onValueChange", "controlled"],
  controlKey: "value",
  mount(ctx, o) {
    const { host, svg, doc } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(38, 32);
    let P = proj(C);
    const g = mk("g", {}, svg);
    const group = doc.createElement("div");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("data-knurl-sr", "");
    host.appendChild(group);
    host.setAttribute("data-knurl-hit", "");
    const gname = "knurl-presets-" + ++uid;

    type Key = { v: string; x0: number; x1: number; body: Solid; nose: SVGPathElement; text: SVGTextElement; sp: Spring; input: HTMLInputElement; z: number };
    let keys: Key[] = [];
    let value = "";
    let hover = -1;
    const KW = 11, GAP = 2.4, KD = 30, KH = 6, DROP = 3.2, BZ = 4; // key half-width… key length, height, how far a latched key sits down, base height

    const list = () => (Array.isArray(opts.options) && opts.options.length ? opts.options.map(String) : ["1", "2", "3", "4"]);

    function build() {
      g.replaceChildren();
      group.replaceChildren();
      const opt = list(), n = opt.length;
      const span = n * KW * 2 + (n - 1) * GAP, X0 = -span / 2;
      const BX = span / 2 + 7, BY0 = -KD / 2 - 9, BY1 = KD / 2 + 3;
      const ext: Vec3[] = [[-BX, BY0, 0], [BX, BY1, 0], [-BX, BY1, 0], [BX, BY0, 0], [-BX, BY0, BZ + 12], [BX, BY0, BZ + 12]];
      fit(C, ext, VW / 2, VH / 2 + 2, VW - 22, VH - 18);
      P = proj(C);
      shadow(g, flat(P, rrect(-BX, BY0 + 3, BX, BY1 + 3, 4), 0));
      solid(g).put(slab(C, P, -BX, BY0, BX, BY1, 4, 0, BZ));
      // the back housing the keys slide into, with its slots and a vent
      const HY1 = BY0 + 10;
      solid(g).put(slab(C, P, -BX + 2, BY0 + 1.5, BX - 2, HY1, 2.5, BZ, BZ + 12));
      const vents: string[] = [];
      for (let k = 0; k < 9; k++) {
        const x = -BX + 10 + k * 3.2;
        vents.push(seg(P(x, BY0 + 4, BZ + 12), P(x, HY1 - 3, BZ + 12)));
      }
      line(g, "lo").setAttribute("d", vents.join(""));
      const lamp = mk("path", { class: "k-led on", d: flat(P, rrect(BX - 14, BY0 + 4, BX - 7, HY1 - 3.5, 1.2), BZ + 12) }, g);
      void lamp;
      line(g, "lo").setAttribute("d", flat(P, rrect(-BX + 2, HY1 + 1.5, BX - 2, BY1 - 1.5, 2), BZ));

      keys = opt.map((v, i) => {
        const x0 = X0 + i * (KW * 2 + GAP), x1 = x0 + KW * 2;
        // the slot in the housing's face
        mk("path", { class: "k-slot", d: [[x0 - 0.5, BZ + 1], [x1 + 0.5, BZ + 1], [x1 + 0.5, BZ + KH + 1.5], [x0 - 0.5, BZ + KH + 1.5]].map((p, k) => (k ? "L" : "M") + P(p[0], HY1, p[1]).map((n) => n.toFixed(2)).join(" ")).join("") + "Z" }, g);
        const kg = mk("g", {}, g);
        const body = solid(kg);
        const nose = line(kg, "lo");
        const text = mk("text", { class: "k-text hi", "text-anchor": "middle" }, kg) as SVGTextElement;
        text.textContent = v.slice(0, 3);
        text.style.fontSize = v.length > 1 ? "4.4px" : "6px";
        const input = doc.createElement("input");
        input.type = "radio"; input.name = opts.name || gname; input.value = v;
        input.setAttribute("aria-label", v);
        group.appendChild(input);
        return { v, x0, x1, body, nose, text, sp: spring(0, { k: 380, c: 14, eps: 0.01 }), input, z: NaN };
      });
      const firstV = opts.value ?? value ?? opts.defaultValue;
      value = opt.includes(firstV as string) ? (firstV as string) : opts.defaultValue && opt.includes(opts.defaultValue) ? opts.defaultValue : opt[0];
      keys.forEach((k) => { k.sp.x = k.sp.t = k.v === value ? DROP : 0; });
      // keys are painted left to right: with the camera at 38°, a key's right side is the one that shows
      sync();
      keys.forEach((k) => drawKey(k, k.sp.x));
    }

    function drawKey(k: Key, z: number) {
      if (z === k.z) return;
      k.z = z;
      const HY1 = -KD / 2 - 9 + 10;
      const zt = BZ + KH - z, y0 = HY1, y1 = HY1 + KD;
      k.body.put(slab(C, P, k.x0, y0, k.x1, y1, 1.6, BZ + 0.5 - z * 0.15, zt));
      const cx = (k.x0 + k.x1) / 2;
      // grip ribs near the nose, and the accent bar on the nose of the latched key
      const ribs: string[] = [];
      for (const dy of [y1 - 3, y1 - 5, y1 - 7]) ribs.push(seg(P(k.x0 + 3, dy, zt), P(k.x1 - 3, dy, zt)));
      k.nose.setAttribute("d", ribs.join(""));
      k.nose.setAttribute("class", "k-line lo");
      const lit = k.v === value;
      k.body.lit(lit);
      k.text.setAttribute("transform", planeMatrix(P, [cx, y0 + 10, zt], [1, 0, 0], [0, 1, 0]) + " translate(0 2)");
      let bar = k.body.g.parentElement!.querySelector<SVGPathElement>(".k-bar");
      if (!bar) { bar = mk("path", { class: "k-line accent k-bar" }, k.body.g.parentElement); }
      const zb = BZ + 0.5 - z * 0.15 + (zt - (BZ + 0.5 - z * 0.15)) / 2;
      bar.setAttribute("d", lit ? seg(P(cx - 5, y1, zb), P(cx + 5, y1, zb)) : "");
    }

    const B = register(host, (dt) => {
      let m = false;
      keys.forEach((k, i) => {
        k.sp.t = k.v === value ? DROP : i === hover ? 0.9 : 0;
        if (stepS(k.sp, dt)) m = true;
        drawKey(k, k.sp.x);
      });
      return m;
    });
    bag.add(B.unregister);

    function sync() {
      group.setAttribute("aria-label", opts.label ?? "Presets");
      host.setAttribute("data-state", value);
      for (const k of keys) {
        k.input.checked = k.v === value;
        k.input.disabled = !!opts.disabled;
        k.input.name = opts.name || gname;
        k.z = NaN;
      }
    }

    const ask = (v: string) => {
      if (v === value) return;
      if (opts.controlled) { sync(); emit(opts.onValueChange, v); return; }
      value = v; sync(); B.wake(); emit(opts.onValueChange, v);
    };
    bag.on(group, "change", (e) => { const t = e.target as HTMLInputElement; if (t.checked) ask(t.value); });

    // pointer: the key under the pointer, tested on the keys' top plane
    const keyAt = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / r.width) * VW, sy = ((e.clientY - r.top) / r.height) * VH;
      for (const k of keys) {
        const a = P(k.x0, -KD / 2 + 1, BZ + KH), b = P(k.x1, -KD / 2 + 1, BZ + KH), c = P(k.x1, KD / 2 + 1, BZ + KH), d = P(k.x0, KD / 2 + 1, BZ + KH);
        // point in the parallelogram, extended down by the key's height for its nose
        const pts = [a, b, [c[0], c[1] + 12], [d[0], d[1] + 12]];
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > sy) !== (yj > sy) && sx < ((xj - xi) * (sy - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) return keys.indexOf(k);
      }
      return -1;
    };
    bag.on(host, "pointermove", (e) => { if (e.pointerType !== "mouse") return; const h = keyAt(e); if (h !== hover) { hover = h; B.wake(); } });
    bag.on(host, "pointerleave", () => { hover = -1; B.wake(); });
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0) return;
      const i = keyAt(e);
      if (i < 0) return;
      keys[i].input.focus({ preventScroll: true });
      ask(keys[i].v);
      e.preventDefault();
    });

    build();
    bag.add(() => { group.remove(); host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state"); svg.replaceChildren(); });
    return {
      update(next, prev) {
        opts = next;
        if (next.value !== undefined && next.value !== value) { value = next.value; B.wake(); }
        if (JSON.stringify(next.options) !== JSON.stringify(prev.options)) build(); else sync();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
