import { camera, circle, cyl, depth, fit, flat, inset, planeMatrix, proj, rad, rrect, seg, slab, unproj, type Vec3 } from "../core/iso";
import { reducedMotion, spring, stepS, type Spring } from "../core/motion";
import { define, emit, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, toView, type Solid } from "../core/stage";

/**
 * Annunciator — a status panel, built as an annunciator: the grid of
 * labelled warning lamps in a cockpit or control room.
 *
 * A bezel frame on four screws holds a grid of square lamp tiles, each a
 * lens with a short engraved legend. A lamp is dark when off, lit in the
 * high tone when ok, and lit with the accent on a warning; an alert blinks
 * at 1.4 Hz (steady under reduced motion). The lamps are incandescent: they
 * warm up in about a tenth of a second and cool down in a quarter, so a
 * blink eases rather than switches. The push-button on the frame's side is a
 * real lamp test: pressing it lights every lamp for a second, one after
 * another in reading order, and they go out in the same order. The lamps are
 * push-to-test as well: a pressed lamp dips into the bezel. Hovering a lamp
 * with a mouse warms it a little and leans it toward the press; hovering
 * the button leans its cap down.
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
const STAGGER = 32;  // ms between lamps as the test runs through them in reading order
const WARM = 35, COOL = 80; // ms: a filament's time constants, so ~100 ms to light and ~240 ms to go dark
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

    /**
     * A lamp: its tile, and over the dark lens two layers that fade with the
     * filament — the high-tone "ok" layer and the accent "lit" layer — and
     * the glow. `ok`, `lit` and `gl` are how bright each is now, 0..1;
     * `from`/`until` are this lamp's window in the lamp test.
     */
    type Lamp = {
      item: AnnunciatorItem; i: number; x0: number; y0: number;
      body: Solid; top: SVGGElement; rim: SVGPathElement; glow: SVGPathElement; lens: SVGPathElement; okL: SVGPathElement; litL: SVGPathElement; text: SVGTextElement; li: HTMLLIElement;
      ok: number; lit: number; gl: number; okT: number; litT: number; glT: number; from: number; until: number; dip: Spring; dz: number; cls: string; shown: string;
    };
    let lamps: Lamp[] = [];
    let hovered: Lamp | null = null, pushed: Lamp | null = null, hoverCap = false;
    let ZU = 1; // screen units one world unit of height moves a point up
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
      ZU = P(0, 0, 0)[1] - P(0, 0, 1)[1];

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
        // everything on the lens moves with it when the lamp is pushed
        const top = mk("g", {}, lg);
        const lid = rrect(x0 + 1.3, y0 + 1.3, x1 - 1.3, y1 - 1.3, 0.8), dl = flat(P, lid, zt);
        const glow = mk("path", { class: "k-glow", d: flat(P, inset(lid, -0.6), zt + 0.2) }, top);
        const lens = mk("path", { class: "k-face", d: dl }, top);
        const okL = mk("path", { class: "k-dot", d: dl }, top);
        const litL = mk("path", { class: "k-led", d: dl }, top);
        // the filament fades these frame by frame; the stylesheet's own transitions would lag it
        for (const p of [glow, okL, litL]) { p.style.transition = "none"; p.style.opacity = "0"; }
        const rim = line(top, "lo");
        // the lens's inner moulding and the two lamp-retainer notches on its near edge
        const cx = (x0 + x1) / 2;
        rim.setAttribute("d", flat(P, inset(lid, 1.3), zt) + seg(P(cx - 2.2, y1 - 0.6, zt), P(cx - 2.2, y1, zt)) + seg(P(cx + 2.2, y1 - 0.6, zt), P(cx + 2.2, y1, zt)));
        const label = item.label.slice(0, 6);
        const text = mk("text", { "text-anchor": "middle", "stroke-width": 0 }, top) as SVGTextElement;
        text.textContent = label;
        text.style.font = FONT;
        text.style.fontSize = Math.min(4, 9.6 / Math.max(1, label.length * 0.62)).toFixed(2) + "px";
        text.style.stroke = "none";
        text.setAttribute("transform", planeMatrix(P, [cx, (y0 + y1) / 2, zt], [1, 0, 0], [0, 1, 0]) + " translate(0 1.4)");
        byIndex.set(item, {
          item, i: 0, x0, y0, body, top, rim, glow, lens, okL, litL, text, li: doc.createElement("li"),
          ok: 0, lit: 0, gl: 0, okT: 0, litT: 0, glT: 0, from: -1, until: -1, dip: spring(0, { k: 520, c: 22, eps: 0.01 }), dz: NaN, cls: "", shown: "",
        });
      }
      lamps = its.map((it) => byIndex.get(it)!);
      hovered = pushed = null;
      lamps.forEach((l, i) => { l.i = i; list.appendChild(l.li); });

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
      // a rebuilt panel comes up as it is, without warming up
      aim(performance.now());
      for (const l of lamps) { l.ok = l.okT; l.lit = l.litT; l.gl = l.glT; drawLamp(l, 0); show(l); }
      describe(false);
    }

    let capZ = NaN;
    function drawCap(z: number, force = false) {
      if (!cap || (z === capZ && !force)) return;
      capZ = z;
      cap.put(cyl(C, P, BCX, BCY, 2.5, ZB - 1.2, ZB + 1.6 - z, 28));
    }

    // what each lamp shows: "off", "ok" or "lit" (the accent)
    const lookOf = (l: Lamp, now: number) => {
      if (now >= l.from && now < l.until) return "lit";
      const s = l.item.state;
      if (s === "warn") return "lit";
      if (s === "alert") return reducedMotion() || ((now / 1000) * BLINK) % 1 < 0.5 ? "lit" : "off";
      return s;
    };
    /** Where each lamp's filament is heading now, and the classes that follow from that at once. */
    function aim(now: number) {
      for (const l of lamps) {
        const look = lookOf(l, now), hot = l === hovered || l === pushed;
        // a hovered or pushed lamp's filament warms a little before the test reaches it: a faint tint and halo
        l.litT = look === "lit" ? 1 : hot ? 0.07 : 0;
        l.glT = look === "lit" ? 1 : hot ? 0.55 : 0;
        l.okT = l.item.state === "ok" && look !== "off" ? 1 : 0;
        // a lamp the test has reached or is about to reach counts as on: its warm-up is only a delay
        const on = l.litT > 0 || l.lit > 0.002 || now < l.until;
        const cls = on ? "k-led on" : "k-led";
        if (cls !== l.cls) { l.cls = cls; l.litL.setAttribute("class", cls); }
        l.glow.classList.toggle("on", look === "lit");
      }
    }
    /** A filament's brightness after dt seconds heading for t: it warms faster than it cools. */
    const follow = (a: number, t: number, dt: number, warm: number, cool: number) => {
      if (reducedMotion()) return t;
      const n = t + (a - t) * Math.exp((-dt * 1000) / (t > a ? warm : cool));
      return Math.abs(n - t) < 0.004 ? t : n;
    };
    const o3 = (x: number) => String(Math.round(x * 1000) / 1000);
    function show(l: Lamp) {
      const key = `${l.ok} ${l.lit} ${l.gl} ${l === hovered}`;
      if (key === l.shown) return;
      l.shown = key;
      const b = Math.max(l.ok, l.lit);
      l.okL.style.opacity = o3(l.ok);
      l.litL.style.opacity = o3(l.lit);
      // the glow trails the lens a little: it is the light round the lamp, and a hovered lit lamp's halo swells
      l.glow.style.opacity = o3(0.35 * l.gl * (l === hovered && l.litT === 1 ? 1.35 : 1));
      l.lens.style.strokeOpacity = o3(1 - b);
      l.text.setAttribute("class", b > 0.5 ? "k-face" : "k-text");
      l.body.lit(b > 0.5 || l === hovered);
    }
    /** The lamp pushed z units into the bezel (negative: proud of it). */
    function drawLamp(l: Lamp, z: number) {
      if (z === l.dz) return;
      l.dz = z;
      l.body.put(slab(C, P, l.x0, l.y0, l.x0 + T, l.y0 + T, 1.2, FZ, FZ + LZ - z));
      l.top.setAttribute("transform", z ? `translate(0 ${(z * ZU).toFixed(3)})` : "");
    }

    const press = spring(0, { k: 520, c: 22, eps: 0.01 });
    let down = false;
    const B = register(host, (dt, now) => {
      // the TEST cap dips on a press and leans a little toward it under a mouse
      press.t = down ? 1.1 : hoverCap ? 0.3 : 0;
      let m = stepS(press, dt);
      drawCap(press.x);
      aim(now);
      for (const l of lamps) {
        // a pushed lamp dips into the bezel on the TEST cap's spring; a hovered one leans toward it
        l.dip.t = l === pushed ? 0.9 : l === hovered ? 0.25 : 0;
        if (stepS(l.dip, dt)) m = true;
        drawLamp(l, l.dip.x);
        l.ok = follow(l.ok, l.okT, dt, WARM, COOL);
        l.lit = follow(l.lit, l.litT, dt, WARM, COOL);
        l.gl = follow(l.gl, l.glT, dt, WARM * 1.6, COOL * 1.25);
        if (l.ok !== l.okT || l.lit !== l.litT || l.gl !== l.glT || now < l.until + 50) m = true;
        show(l);
      }
      const blinking = !reducedMotion() && lamps.some((l) => l.item.state === "alert");
      return m || blinking;
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

    // the test runs through the lamps in reading order, and they go out in that order a second later
    const test = () => {
      const now = performance.now(), n = lamps.length;
      const gap = reducedMotion() ? 0 : Math.min(STAGGER, 320 / Math.max(1, n - 1));
      for (const l of lamps) {
        const at = now + l.i * gap;
        // a lamp still lit from a test a moment ago stays lit
        if (!(now >= l.from && now < l.until)) l.from = at;
        l.until = at + TEST;
      }
      aim(now);
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
    // the lamp under a point, tested on the lens plane
    const lampAt = (e: { clientX: number; clientY: number }) => {
      const q = toView(svg, e, VW, VH), [x, y] = unproj(C, q[0], q[1], FZ + LZ);
      return lamps.find((l) => x >= l.x0 && x <= l.x0 + T && y >= l.y0 && y <= l.y0 + T) ?? null;
    };
    bag.on(host, "pointermove", (e) => {
      if (e.pointerType !== "mouse" || opts.disabled) return;
      const h = lampAt(e), c = !h && onButton(e);
      if (h !== hovered || c !== hoverCap) { hovered = h; hoverCap = c; B.wake(); }
    });
    bag.on(host, "pointerleave", () => { if (hovered || hoverCap) { hovered = null; hoverCap = false; B.wake(); } });
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || e.button !== 0) return;
      host.setPointerCapture?.(e.pointerId);
      button.focus({ preventScroll: true });
      // the TEST button dips; a press on a lamp dips that lamp, a push-to-test, as on a real panel
      down = onButton(e);
      pushed = down ? null : lampAt(e);
      test();
      e.preventDefault();
    });
    const release = () => { if (down || pushed) { down = false; pushed = null; B.wake(); } };
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
