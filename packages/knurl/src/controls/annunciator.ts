import { camera, circle, cyl, depth, fit, flat, inset, planeMatrix, proj, rad, rrect, seg, slab, unproj, type Vec3 } from "../core/iso";
import { reducedMotion, spring, stepS } from "../core/motion";
import { define, emit, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, toView, type Solid } from "../core/stage";

/**
 * Annunciator — a status panel, built as an annunciator: the grid of
 * labelled warning lamps in a cockpit or control room.
 *
 * A bezel frame on four screws holds a grid of square lamp tiles, each a
 * lens with a short engraved legend. A lamp is dark when off, lit in the
 * high tone when ok, and lit with the accent on a warning; an alert blinks
 * at 1.4 Hz (steady under reduced motion). The push-button on the frame's
 * side is a real lamp test: pressing it lights every lamp for a second.
 *
 * The host is a `role="group"`; a visually hidden list reads each lamp's
 * state, a polite live region announces a lamp turning warn or alert, and
 * the test button is a real `<button>`.
 */

export type AnnunciatorState = "off" | "ok" | "warn" | "alert";
export type AnnunciatorItem = { id: string; label: string; state: AnnunciatorState };

export type AnnunciatorOptions = BaseOptions & {
  /** The lamps, in reading order. Legends read best at 6 characters or fewer. Default four sample lamps. */
  items?: AnnunciatorItem[];
  /** Lamps per row. Default 4, or fewer when there are fewer lamps. */
  columns?: number;
  /** Called when the lamp-test button is pressed. */
  onTest?: () => void;
};

const VW = 280, VH = 132;
const BLINK = 1.4;   // Hz
const TEST = 1000;   // ms the lamp test holds every lamp lit
const STATES: readonly AnnunciatorState[] = ["off", "ok", "warn", "alert"];
const SAMPLE: AnnunciatorItem[] = [
  { id: "api", label: "API", state: "ok" },
  { id: "db", label: "DB", state: "ok" },
  { id: "queue", label: "QUEUE", state: "warn" },
  { id: "auth", label: "AUTH", state: "off" },
];
const FONT = '500 4px/1 ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace';

export const annunciator = define<AnnunciatorOptions>({
  id: "annunciator",
  label: "Status panel",
  vw: VW,
  vh: VH,
  width: 300,
  keys: ["items", "columns", "onTest"],
  mount(ctx, o) {
    const { host, svg, doc } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(20, 40);
    let P = proj(C);
    const g = mk("g", {}, svg);

    // semantics: a group, a list of the lamps, a live region and the test button
    const list = doc.createElement("ul");
    list.setAttribute("data-knurl-sr", "");
    const live = doc.createElement("div");
    live.setAttribute("data-knurl-sr", "");
    live.setAttribute("aria-live", "polite");
    const button = doc.createElement("button");
    button.type = "button";
    button.setAttribute("data-knurl-sr", "");
    button.textContent = "Lamp test";
    host.append(list, live, button);
    host.setAttribute("data-knurl-hit", "");

    type Lamp = { item: AnnunciatorItem; body: Solid; rim: SVGPathElement; glow: SVGPathElement; lens: SVGPathElement; text: SVGTextElement; li: HTMLLIElement; look: string };
    let lamps: Lamp[] = [];
    let cap: Solid | null = null;
    let BCX = 0, BCY = 0, ZB = 0;
    const T = 16, GAP = 2.2, M = 6.2, SIDE = 15, FZ = 4.2, LZ = 2.4, BR = 3.4;

    const items = (): AnnunciatorItem[] => {
      const src = Array.isArray(opts.items) && opts.items.length ? opts.items : SAMPLE;
      return src.map((it, i) => ({ id: String(it.id ?? i), label: String(it.label ?? ""), state: STATES.includes(it.state) ? it.state : "off" }));
    };

    function build() {
      g.replaceChildren();
      list.replaceChildren();
      const its = items(), n = its.length;
      const cols = Math.max(1, Math.min(n, Math.round(Number(opts.columns)) || Math.min(4, n)));
      const rows = Math.ceil(n / cols);
      const gw = cols * T + (cols - 1) * GAP, gh = rows * T + (rows - 1) * GAP;
      const FW = M + gw + M + SIDE, FD = M + gh + M;
      const X0 = -FW / 2, X1 = FW / 2, Y0 = -FD / 2, Y1 = FD / 2;
      const ext: Vec3[] = [[X0, Y0, 0], [X1, Y1, 0], [X0, Y1, 0], [X1, Y0, 0], [X0, Y0, FZ + LZ + 1], [X1, Y0, FZ + LZ + 1]];
      fit(C, ext, VW / 2, VH / 2 + 2, VW - 20, VH - 18);
      P = proj(C);

      // the frame on its screws, its bevel, and the dark window the lamps sit in
      shadow(g, flat(P, rrect(X0, Y0 + 3, X1, Y1 + 3, 4), 0));
      solid(g).put(slab(C, P, X0, Y0, X1, Y1, 4, 0, FZ));
      line(g, "lo").setAttribute("d", flat(P, rrect(X0 + 1.8, Y0 + 1.8, X1 - 1.8, Y1 - 1.8, 2.6), FZ));
      const slots: string[] = [];
      for (const [x, y] of [[X0 + 3.4, Y0 + 3.4], [X1 - 3.4, Y0 + 3.4], [X0 + 3.4, Y1 - 3.4], [X1 - 3.4, Y1 - 3.4]]) {
        solid(g).put(cyl(C, P, x, y, 1.5, FZ, FZ + 0.5, 18));
        const a = rad(x * y > 0 ? 40 : -25);
        slots.push(seg(P(x - Math.cos(a) * 1.05, y - Math.sin(a) * 1.05, FZ + 0.5), P(x + Math.cos(a) * 1.05, y + Math.sin(a) * 1.05, FZ + 0.5)));
      }
      line(g, "edge").setAttribute("d", slots.join(""));
      const GX0 = X0 + M, GY0 = Y0 + M;
      mk("path", { class: "k-slot", d: flat(P, rrect(GX0 - 1.6, GY0 - 1.6, GX0 + gw + 1.6, GY0 + gh + 1.6, 1.4), FZ) }, g);
      // the seam between the lamp field and the test column
      const SX = GX0 + gw + M - 1.2;
      line(g, "lo").setAttribute("d", seg(P(SX, Y0 + 1.8, FZ), P(SX, Y1 - 1.8, FZ)));

      // the lamps, back to front
      const cells = its.map((item, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const x0 = GX0 + c * (T + GAP), y0 = GY0 + r * (T + GAP);
        return { item, x0, y0 };
      }).sort((a, b) => depth(C, a.x0, a.y0, 0) - depth(C, b.x0, b.y0, 0));
      const byIndex = new Map<AnnunciatorItem, Lamp>();
      for (const { item, x0, y0 } of cells) {
        const x1 = x0 + T, y1 = y0 + T, zt = FZ + LZ;
        const lg = mk("g", {}, g);
        const body = solid(lg);
        body.put(slab(C, P, x0, y0, x1, y1, 1.2, FZ, zt));
        const lid = rrect(x0 + 1.3, y0 + 1.3, x1 - 1.3, y1 - 1.3, 0.8);
        const glow = mk("path", { class: "k-glow", d: flat(P, inset(lid, -0.6), zt + 0.2) }, lg);
        const lens = mk("path", { class: "k-face", d: flat(P, lid, zt) }, lg);
        const rim = line(lg, "lo");
        // the lens's inner moulding and the two lamp-retainer notches on its near edge
        const cx = (x0 + x1) / 2;
        rim.setAttribute("d", flat(P, inset(lid, 1.3), zt) + seg(P(cx - 2.2, y1 - 0.6, zt), P(cx - 2.2, y1, zt)) + seg(P(cx + 2.2, y1 - 0.6, zt), P(cx + 2.2, y1, zt)));
        const label = item.label.slice(0, 6);
        const text = mk("text", { "text-anchor": "middle", "stroke-width": 0 }, lg) as SVGTextElement;
        text.textContent = label;
        text.style.font = FONT;
        text.style.fontSize = Math.min(4, 9.6 / Math.max(1, label.length * 0.62)).toFixed(2) + "px";
        text.style.stroke = "none";
        text.setAttribute("transform", planeMatrix(P, [cx, (y0 + y1) / 2, zt], [1, 0, 0], [0, 1, 0]) + " translate(0 1.4)");
        byIndex.set(item, { item, body, rim, glow, lens, text, li: doc.createElement("li"), look: "" });
      }
      lamps = its.map((it) => byIndex.get(it)!);
      for (const l of lamps) list.appendChild(l.li);

      // the test column: a guarded push-button over its engraved legend
      BCX = SX + (X1 - 1.8 - SX) / 2; BCY = Y0 + Math.min(FD / 2, 10.5);
      solid(g).put(cyl(C, P, BCX, BCY, 4.4, FZ, FZ + 0.6, 36));
      solid(g).put(cyl(C, P, BCX, BCY, 3.7, FZ + 0.6, FZ + 1.8, 36));
      mk("path", { class: "k-slot", d: flat(P, circle(BCX, BCY, 2.9, 32), FZ + 1.8) }, g);
      ZB = FZ + 1.8;
      cap = solid(g);
      const tt = mk("text", { class: "k-text", "text-anchor": "middle" }, g) as SVGTextElement;
      tt.textContent = "TEST";
      tt.style.font = FONT;
      tt.style.fontSize = "2.6px";
      tt.setAttribute("transform", planeMatrix(P, [BCX, BCY + 7.4, FZ], [1, 0, 0], [0, 1, 0]));
      line(g, "mid").setAttribute("d", seg(P(BCX - 3.4, BCY + 8.6, FZ), P(BCX + 3.4, BCY + 8.6, FZ)));
      drawCap(press.x, true);
      paint(performance.now());
      describe(false);
    }

    let capZ = NaN;
    function drawCap(z: number, force = false) {
      if (!cap || (z === capZ && !force)) return;
      capZ = z;
      cap.put(cyl(C, P, BCX, BCY, 2.5, ZB - 1.2, ZB + 1.6 - z, 28));
    }

    // what each lamp shows: "off", "ok" or "lit" (the accent)
    let testUntil = -1;
    const lookOf = (s: AnnunciatorState, now: number) => {
      if (now < testUntil) return "lit";
      if (s === "warn") return "lit";
      if (s === "alert") return reducedMotion() || ((now / 1000) * BLINK) % 1 < 0.5 ? "lit" : "off";
      return s;
    };
    function paint(now: number) {
      for (const l of lamps) {
        const look = lookOf(l.item.state, now);
        if (look === l.look) continue;
        l.look = look;
        l.lens.setAttribute("class", look === "lit" ? "k-led on" : look === "ok" ? "k-dot" : "k-face");
        l.glow.classList.toggle("on", look === "lit");
        l.text.setAttribute("class", look === "off" ? "k-text" : "k-face");
        l.body.lit(look !== "off");
      }
    }

    const press = spring(0, { k: 520, c: 22, eps: 0.01 });
    let down = false;
    const B = register(host, (dt, now) => {
      press.t = down ? 1.1 : 0;
      const m = stepS(press, dt);
      drawCap(press.x);
      paint(now);
      const blinking = !reducedMotion() && lamps.some((l) => l.item.state === "alert");
      return m || now < testUntil + 50 || blinking;
    });
    bag.add(B.unregister);
    build();

    // the hidden list, and the announcement when a lamp turns warn or alert
    function describe(announce: boolean, prev?: Map<string, AnnunciatorState>) {
      host.setAttribute("role", "group");
      host.setAttribute("aria-label", opts.label ?? "Status panel");
      button.disabled = !!opts.disabled;
      button.setAttribute("aria-label", "Lamp test");
      const news: string[] = [];
      for (const l of lamps) {
        l.li.textContent = `${l.item.label}: ${l.item.state}`;
        const was = prev?.get(l.item.id);
        if (announce && (l.item.state === "warn" || l.item.state === "alert") && was !== l.item.state) news.push(`${l.item.label}: ${l.item.state}`);
      }
      if (news.length) live.textContent = news.join(", ");
    }

    const test = () => {
      testUntil = performance.now() + TEST;
      paint(performance.now());
      B.wake();
      emit(opts.onTest);
    };
    const onButton = (e: { clientX: number; clientY: number }) => {
      const q = toView(svg, e, VW, VH);
      for (const z of [ZB + 1.6, FZ + 1.8]) {
        const w = unproj(C, q[0], q[1], z);
        if (Math.hypot(w[0] - BCX, w[1] - BCY) < 4.6) return true;
      }
      return false;
    };
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0 || !onButton(e)) return;
      host.setPointerCapture?.(e.pointerId);
      button.focus({ preventScroll: true });
      down = true;
      test();
      e.preventDefault();
    });
    const release = () => { if (down) { down = false; B.wake(); } };
    bag.on(host, "pointerup", release);
    bag.on(host, "pointercancel", release);
    // the platform's own activation: Enter, Space and assistive tech
    bag.on(button, "click", () => {
      if (opts.disabled) return;
      down = true;
      setTimeout(release, 140);
      test();
    });

    bag.add(() => {
      list.remove(); live.remove(); button.remove();
      for (const n of ["data-knurl-hit", "role", "aria-label"]) host.removeAttribute(n);
      svg.replaceChildren();
    });
    return {
      update(next, prev) {
        const before = new Map(lamps.map((l) => [l.item.id, l.item.state] as const));
        opts = next;
        const its = items();
        const same = lamps.length === its.length && its.every((it, i) => it.id === lamps[i].item.id && it.label === lamps[i].item.label);
        if (!same || next.columns !== prev.columns) build();
        else its.forEach((it, i) => { lamps[i].item = it; });
        describe(true, before);
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
