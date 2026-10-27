// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { annunciator, type AnnunciatorItem } from "../src/controls/annunciator";
import { setReducedMotion } from "../src/core/motion";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => setReducedMotion(false));

const VW = 280, VH = 132;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
/** Mounts with the svg laid out 1:1 in viewBox units, so a client point is a viewBox point. */
const mount = (items: AnnunciatorItem[]) => {
  const el = host();
  const c = annunciator(el, { items });
  el.querySelector("svg")!.getBoundingClientRect = () => ({ left: 0, top: 0, width: VW, height: VH, right: VW, bottom: VH, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return { el, c };
};
const ev = (type: string, x: number, y: number, pointerType = "mouse") => {
  const E: typeof MouseEvent = typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
  const e = new E(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...({ pointerType } as object) });
  if ((e as PointerEvent).pointerType !== pointerType) Object.defineProperty(e, "pointerType", { value: pointerType });
  return e;
};
/** Each lamp's accent layer, and the centre of its lens in viewBox units. */
const lamps = (el: HTMLElement) => [...el.querySelectorAll<SVGPathElement>("svg path.k-led")].map((p) => {
  const n = (p.getAttribute("d") ?? "").match(/-?\d+(\.\d+)?/g)!.map(Number);
  let x = 0, y = 0;
  for (let i = 0; i < n.length; i += 2) { x += n[i]; y += n[i + 1]; }
  return { p, top: p.parentElement as unknown as SVGGElement, glow: p.parentElement!.querySelector<SVGPathElement>(".k-glow")!, x: x / (n.length / 2), y: y / (n.length / 2) };
});
const lit = (el: HTMLElement) => lamps(el).map((l) => Number(l.p.style.opacity || 0));
const eight = Array.from({ length: 8 }, (_, i) => ({ id: "l" + i, label: "L" + i, state: "ok" as const }));

describe("annunciator feel", () => {
  it("warms its lamps up rather than lighting them in the same frame", async () => {
    const { el } = mount(eight);
    el.querySelector("button")!.click();
    // every lamp is committed to the test at once (its class), but none has warmed up yet
    expect(el.querySelectorAll("svg .k-led.on").length).toBe(8);
    expect(Math.max(...lit(el))).toBe(0);
    await wait(60);
    const a = lit(el);
    // the test runs through them in order: the first lamps are coming up while the last are still dark
    expect(Math.max(...a)).toBeGreaterThan(0.3);
    expect(Math.min(...a)).toBe(0);
    await wait(400);
    expect(Math.min(...lit(el))).toBeGreaterThan(0.95);
  });

  it("goes out lamp by lamp after a second, with a fade", async () => {
    const { el } = mount(eight);
    el.querySelector("button")!.click();
    await wait(1080);
    const a = lit(el);
    // the first lamps are cooling while the later ones still hold
    expect(Math.min(...a)).toBeLessThan(0.9);
    expect(Math.max(...a)).toBeGreaterThan(0.95);
    await wait(900);
    expect(Math.max(...lit(el))).toBe(0);
    expect(el.querySelectorAll("svg .k-led.on").length).toBe(0);
  });

  it("lights every lamp in one step under reduced motion", async () => {
    const { el } = mount(eight);
    setReducedMotion(true);
    el.querySelector("button")!.click();
    await wait(40);
    expect(Math.min(...lit(el))).toBe(1);
  });

  it("dips a pressed lamp into the bezel, and runs the test", async () => {
    const { el } = mount(eight.slice(0, 4));
    const ls = lamps(el), l = ls[0];
    el.dispatchEvent(ev("pointerdown", l.x, l.y));
    await wait(120);
    const dy = (g: SVGGElement) => Number((g.getAttribute("transform") ?? "").match(/translate\(0 (-?[\d.]+)\)/)?.[1] ?? 0);
    expect(dy(l.top)).toBeGreaterThan(0.5);
    for (const o of ls) if (o !== l) expect(dy(o.top)).toBe(0);
    expect(Math.max(...lit(el))).toBeGreaterThan(0.3);
    el.dispatchEvent(ev("pointerup", l.x, l.y));
    await wait(500);
    expect(Math.abs(dy(l.top))).toBeLessThan(0.02);
  });

  it("warms a lamp under a mouse, but not under a finger", async () => {
    const items = [{ id: "a", label: "A", state: "off" as const }, { id: "b", label: "B", state: "off" as const }];
    const { el } = mount(items);
    const [a] = lamps(el);
    el.dispatchEvent(ev("pointermove", a.x, a.y, "touch"));
    await wait(120);
    expect(Number(a.glow.style.opacity || 0)).toBe(0);
    el.dispatchEvent(ev("pointermove", a.x, a.y, "mouse"));
    await wait(200);
    expect(Number(a.glow.style.opacity)).toBeGreaterThan(0.1);
    // still only a hint: the lamp is not lit
    expect(Number(a.p.style.opacity)).toBeLessThan(0.15);
    el.dispatchEvent(ev("pointerleave", 0, 0, "mouse"));
    await wait(500);
    expect(Number(a.glow.style.opacity)).toBe(0);
  });

  it("eases an alert's blink instead of switching it", async () => {
    const { el } = mount([{ id: "a", label: "A", state: "alert" }]);
    const seen = new Set<number>();
    for (let k = 0; k < 50; k++) { await wait(16); seen.add(Math.round(lit(el)[0] * 10)); }
    // values between off and on show up: the lamp passes through them
    expect([...seen].filter((v) => v > 0 && v < 10).length).toBeGreaterThan(2);
  });
});
