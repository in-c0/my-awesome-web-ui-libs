// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { combo } from "../src/controls/combo";
import { setReducedMotion } from "../src/core/motion";

beforeAll(() => {
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); setReducedMotion(false); });
const VW = 240, VH = 210;
const mount = (o: Parameters<typeof combo>[1] = {}) => {
  const el = document.createElement("div"); document.body.appendChild(el);
  live.push(combo(el, o));
  el.querySelector("svg")!.getBoundingClientRect = () => ({ left: 0, top: 0, width: VW, height: VH, right: VW, bottom: VH, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return el;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Waits until `ok` holds (springs run on the frame clock, which a busy machine slows), or gives up after 5 s. */
const until = async (ok: () => boolean) => { for (let t = 0; t < 5000 && !ok(); t += 25) await wait(25); };
const ptr = (el: Element, type: string, [x, y]: number[], pointerType = "mouse") =>
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerType, pointerId: 1, clientX: x, clientY: y }));
/** The first wheel's "0" (the reading at rest): where it is on screen, and its transform. */
const zero = (el: Element) => el.querySelectorAll("svg text")[0];
const spot = (el: Element) => { const m = /matrix\(([^)]+)\)/.exec(zero(el).getAttribute("transform")!)![1].split(/[ ,]+/).map(Number); return [m[4], m[5]]; };

describe("combo feel", () => {
  it("rolls a pressed wheel partway at once, and completes the roll on release", async () => {
    const on = vi.fn();
    const el = mount({ onValueChange: on });
    await wait(30);
    const at = spot(el), rest = zero(el).getAttribute("transform");
    ptr(el, "pointerdown", at);
    await wait(60);
    expect(zero(el).getAttribute("transform")).not.toBe(rest);
    expect(on).not.toHaveBeenCalled();
    ptr(el, "pointerup", at);
    expect(on).toHaveBeenLastCalledWith("1");
  });

  it("turns a wheel a few degrees under a hovering mouse, not a touch, and changes nothing", async () => {
    const on = vi.fn();
    const el = mount({ onValueChange: on });
    await wait(30);
    const at = spot(el), rest = zero(el).getAttribute("transform");
    ptr(el, "pointermove", at, "touch");
    await wait(100);
    expect(zero(el).getAttribute("transform")).toBe(rest);
    ptr(el, "pointermove", at);
    await wait(100);
    expect(zero(el).getAttribute("transform")).not.toBe(rest);
    ptr(el, "pointerleave", at);
    await until(() => zero(el).getAttribute("transform") === rest);
    expect(zero(el).getAttribute("transform")).toBe(rest);
    expect(on).not.toHaveBeenCalled();
  });

  it("asks when controlled, and the pressed wheel rolls back if the answer doesn't come", async () => {
    const on = vi.fn();
    const el = mount({ value: "", controlled: true, onValueChange: on });
    await wait(30);
    const at = spot(el), rest = zero(el).getAttribute("transform");
    ptr(el, "pointerdown", at);
    ptr(el, "pointerup", at);
    expect(on).toHaveBeenLastCalledWith("1");
    expect(el.querySelector("input")!.value).toBe("");
    await until(() => zero(el).getAttribute("transform") === rest);
    expect(zero(el).getAttribute("transform")).toBe(rest);
  });

  it("keeps the shackle tug for a press off the wheels", async () => {
    const el = mount();
    await wait(30);
    const legs = () => el.querySelector("svg")!.innerHTML;
    const before = legs();
    ptr(el, "pointerdown", [4, 4]);
    await wait(40);
    expect(legs()).not.toBe(before);
  });

  it("lands in one step under reduced motion", async () => {
    const el = mount();
    await wait(20);
    setReducedMotion(true);
    const at = spot(el);
    ptr(el, "pointerdown", at);
    await wait(40);
    const a = zero(el).getAttribute("transform");
    await wait(40);
    expect(zero(el).getAttribute("transform")).toBe(a);
  });
});
