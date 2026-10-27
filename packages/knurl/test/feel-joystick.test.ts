// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { joystick } from "../src/controls/joystick";
import { setReducedMotion } from "../src/core/motion";

beforeAll(() => {
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); setReducedMotion(false); });
const VW = 200, VH = 180;
const mount = (o: Parameters<typeof joystick>[1] = {}) => {
  const el = document.createElement("div"); document.body.appendChild(el);
  live.push(joystick(el, o));
  // jsdom has no layout: one screen pixel per viewBox unit
  el.querySelector("svg")!.getBoundingClientRect = () => ({ left: 0, top: 0, width: VW, height: VH, right: VW, bottom: VH, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return el;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ptr = (el: Element, type: string, x: number, y: number, pointerType = "mouse") =>
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerType, pointerId: 1, clientX: x, clientY: y }));
const drawing = (el: Element) => el.querySelector("svg")!.innerHTML;

describe("joystick feel", () => {
  it("leans toward a hovering mouse without changing its value", async () => {
    const on = vi.fn();
    const el = mount({ onValueChange: on });
    await wait(30);
    const rest = drawing(el);
    ptr(el, "pointermove", VW - 10, VH / 2, "touch");
    await wait(120);
    expect(drawing(el)).toBe(rest);
    ptr(el, "pointermove", VW - 10, VH / 2);
    await wait(120);
    expect(drawing(el)).not.toBe(rest);
    expect(on).not.toHaveBeenCalled();
    expect(el.querySelectorAll("input")[0].value).toBe("0");
    ptr(el, "pointerleave", VW - 10, VH / 2);
    await wait(1500);
    expect(drawing(el)).toBe(rest);
  });

  it("takes a press at once and springs home on release", async () => {
    const on = vi.fn();
    const el = mount({ onValueChange: on });
    await wait(30);
    const rest = drawing(el);
    ptr(el, "pointerdown", VW / 2 + 12, VH / 2);
    await wait(20);
    expect(drawing(el)).not.toBe(rest);
    ptr(el, "pointerup", VW / 2 + 12, VH / 2);
    expect(on).toHaveBeenLastCalledWith({ x: 0, y: 0 });
    await wait(2000);
    expect(drawing(el)).toBe(rest);
  });

  it("stays put after a drag when returnToCenter is false", async () => {
    const on = vi.fn();
    const el = mount({ onValueChange: on, returnToCenter: false });
    ptr(el, "pointerdown", VW / 2 + 12, VH / 2);
    ptr(el, "pointerup", VW / 2 + 12, VH / 2);
    const last = on.mock.calls.at(-1)![0];
    expect(last.x).toBeGreaterThan(0);
    expect(Number(el.querySelectorAll("input")[0].value)).toBe(Math.round(last.x * 100));
  });

  it("lands in one step under reduced motion", async () => {
    const el = mount();
    await wait(20);
    setReducedMotion(true);
    ptr(el, "pointermove", VW - 10, VH / 2);
    await wait(40);
    const a = drawing(el);
    await wait(40);
    expect(drawing(el)).toBe(a);
  });
});
