import { camera, cyl, fit, flat, inset, loft, planeMatrix, proj, rrect, seg, slab, type Vec3 } from "../core/iso";
import { spring, stepS } from "../core/motion";
import { define, emit, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid } from "../core/stage";

/**
 * Keycap — a button, built as one mechanical key in a plate.
 *
 * A sculpted cap on a switch housing, its legend printed on the dished top.
 * It travels 4 mm down when pressed and springs back with a little bounce.
 * Pointer, Enter and Space all press it; it fires `onPress` on release, as a
 * button does.
 *
 * Semantics come from a visually hidden `<button>`.
 */

export type KeycapOptions = BaseOptions & {
  /** The legend printed on the cap: a character or a short word. */
  legend?: string;
  /** Width in key units: 1, 1.5, 2 or 2.25 (a 2u and wider key shows its stabiliser). */
  units?: number;
  onPress?: () => void;
};

const VW = 200, VH = 150;

export const keycap = define<KeycapOptions>({
  id: "keycap",
  label: "Button",
  vw: VW,
  vh: VH,
  width: 120,
  keys: ["legend", "units", "onPress"],
  mount(ctx, o) {
    const { host, svg, doc } = ctx;
    const bag = disposer();
    let opts = o;
    const g = mk("g", {}, svg);
    const C = camera(45, 32);
    let P = proj(C);

    const button = doc.createElement("button");
    button.type = "button";
    button.setAttribute("data-knurl-sr", "");
    host.appendChild(button);
    host.setAttribute("data-knurl-hit", "");

    // geometry, rebuilt when the width or legend changes
    let cap = { body: solid(g), dish: line(g, "lo"), text: mk("text", { class: "k-text hi", "text-anchor": "middle" }, g) as SVGTextElement, z: 0 };
    let W = 0, Z0 = 0;
    const D = 9, TRAVEL = 3.6, CAPH = 7.8;

    function build() {
      g.replaceChildren();
      const u = Math.max(1, Math.min(2.75, Number(opts.units) || 1));
      W = 9 + (u - 1) * 9.5; // half-width of a cap: 1u is 18 wide
      const PW = W + 7, PD = D + 7, PZ = 3;
      Z0 = PZ + 3.2; // the cap's foot at rest
      const ext: Vec3[] = [[-PW, -PD, 0], [PW, PD, 0], [-PW, PD, 0], [PW, -PD, 0], [-W, -D, Z0 + CAPH], [W, D, Z0 + CAPH]];
      const want = VW / VH, span = 1 + (u - 1) * 0.55;
      void want;
      fit(C, ext, VW / 2, VH / 2 + 3, (VW - 30) * Math.min(1, span / 1), VH - 26);
      P = proj(C);
      shadow(g, flat(P, rrect(-PW, -PD + 3, PW, PD + 3, 4), 0));
      solid(g).put(slab(C, P, -PW, -PD, PW, PD, 4, 0, PZ));
      line(g, "lo").setAttribute("d", flat(P, rrect(-PW + 2, -PD + 2, PW - 2, PD - 2, 2.4), PZ));
      const screws: string[] = [];
      for (const x of [-PW + 4, PW - 4]) for (const y of [-PD + 4, PD - 4]) {
        solid(g).put(cyl(C, P, x, y, 1.5, PZ, PZ + 0.5, 16));
        screws.push(seg(P(x - 1, y + 0.4, PZ + 0.5), P(x + 1, y - 0.4, PZ + 0.5)));
      }
      line(g, "edge").setAttribute("d", screws.join(""));
      // the cutout and the switch housing in it
      mk("path", { class: "k-slot", d: flat(P, rrect(-W - 0.6, -D - 0.6, W + 0.6, D + 0.6, 1.2), PZ) }, g);
      solid(g).put(slab(C, P, -7, -7, 7, 7, 1.4, PZ, PZ + 2.6));
      if (u >= 2) {
        // stabiliser housings and the wire between them, seen under the cap's skirt
        for (const x of [-W + 5, W - 5]) solid(g).put(slab(C, P, x - 2.4, -4, x + 2.4, 4, 0.8, PZ, PZ + 2.2));
        line(g, "edge").setAttribute("d", seg(P(-W + 5, 5.2, PZ + 0.6), P(W - 5, 5.2, PZ + 0.6)));
      }
      cap = { body: solid(g), dish: line(g, "lo"), text: mk("text", { class: "k-text hi", "text-anchor": "middle" }, g) as SVGTextElement, z: NaN };
      cap.text.textContent = opts.legend ?? "";
      const fs = (opts.legend ?? "").length > 2 ? 3.2 : 5;
      cap.text.style.fontSize = fs + "px";
      drawCap(sp.x);
    }

    function drawCap(z: number) {
      if (z === cap.z) return;
      cap.z = z;
      const zf = Z0 - z, zt = zf + CAPH;
      const foot = rrect(-W, -D, W, D, 2.2, 6), lid = rrect(-W + 2.6, -D + 2.4, W - 2.6, D - 1.4, 2.8, 6);
      // the lid is pulled back a little: cylindrical-profile caps lean toward the typist
      cap.body.put(loft(C, P, foot, zf, zt, lid));
      cap.dish.setAttribute("d", flat(P, inset(lid, 1.2), zt));
      cap.text.setAttribute("transform", planeMatrix(P, [0, 0.6, zt], [1, 0, 0], [0, 1, 0]) + " translate(0 1.8)");
    }

    const sp = spring(0, { k: 520, c: 22, eps: 0.01 });
    let down = false;
    const B = register(host, (dt) => {
      sp.t = down ? TRAVEL : 0;
      const m = stepS(sp, dt);
      drawCap(sp.x);
      return m;
    });
    bag.add(B.unregister);
    build();

    const sync = () => {
      button.disabled = !!opts.disabled;
      button.setAttribute("aria-label", opts.label ?? (opts.legend || "Button"));
      host.setAttribute("data-state", down ? "pressed" : "idle");
    };
    sync();

    const press = (on: boolean) => { if (down === on) return; down = on; sync(); B.wake(); };
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0) return;
      host.setPointerCapture?.(e.pointerId);
      button.focus({ preventScroll: true });
      press(true);
      e.preventDefault();
    });
    bag.on(host, "pointerup", (e) => {
      if (!down) return;
      press(false);
      const r = host.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) emit(opts.onPress);
    });
    bag.on(host, "pointercancel", () => press(false));
    bag.on(button, "keydown", (e) => { if (e.key === " " || e.key === "Enter") { press(true); if (e.key === " ") e.preventDefault(); } });
    bag.on(button, "keyup", (e) => { if (e.key === " " || e.key === "Enter") press(false); });
    // the platform's own click: keyboard activation and assistive tech
    bag.on(button, "click", (e) => { if (e.detail === 0 || e.isTrusted === false) { press(true); setTimeout(() => press(false), 120); } emit(opts.onPress); });
    bag.on(button, "blur", () => press(false));

    bag.add(() => { button.remove(); host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state"); svg.replaceChildren(); });
    return {
      update(next, prev) {
        opts = next;
        if (next.units !== prev.units || next.legend !== prev.legend) build();
        sync();
      },
      destroy: bag.dispose,
    };
  },
});
