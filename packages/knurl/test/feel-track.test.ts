// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { track, type TrackOptions } from "../src/controls/track";
import { setReducedMotion } from "../src/core/motion";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => setReducedMotion(false));

const VW = 320, VH = 150;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mount = (o: TrackOptions) => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const c = track(el, o);
  el.querySelector("svg")!.getBoundingClientRect = () => ({ left: 0, top: 0, width: VW, height: VH, right: VW, bottom: VH, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return { el, c };
};
const ev = (type: string, x: number, y: number, pointerType = "mouse") => {
  const E: typeof MouseEvent = typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
  const e = new E(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...({ pointerType } as object) });
  if ((e as PointerEvent).pointerType !== pointerType) Object.defineProperty(e, "pointerType", { value: pointerType });
  return e;
};
const nums = (d: string | null) => (d ?? "").match(/-?\d+(\.\d+)?/g)!.map(Number);
/** Each station's name plate (its solid) and where its legend sits, in viewBox units. */
const stations = (el: HTMLElement) => [...el.querySelectorAll<SVGTextElement>("svg text")].map((t) => {
  const m = nums(t.getAttribute("transform"));
  return { text: t, plate: t.previousElementSibling as SVGGElement, x: m[4], y: m[5] };
});
const plateTop = (s: { plate: SVGGElement }) => Math.min(...nums(s.plate.querySelector(".k-fill")!.getAttribute("d")).filter((_, i) => i % 2 === 1));
/** The handcar's deck: the mean x of its outline. */
const carX = (el: HTMLElement) => {
  const car = [...el.querySelectorAll("svg > g > g")].pop()!;
  const n = nums(car.children[2].querySelector(".k-fill")!.getAttribute("d")).filter((_, i) => i % 2 === 0);
  return n.reduce((a, b) => a + b, 0) / n.length;
};

describe("track feel", () => {
  it("runs the handcar a little past its station and back", async () => {
    const { el, c } = mount({ current: 0 });
    const x0 = carX(el);
    c.update({ current: 3 });
    const xs: number[] = [];
    for (let k = 0; k < 90; k++) { await wait(16); xs.push(carX(el)); }
    const end = xs[xs.length - 1], peak = Math.max(...xs);
    expect(end).toBeGreaterThan(x0);
    // it overshoots by a visible amount, and settles back
    expect(peak - end).toBeGreaterThan(0.04 * (end - x0));
    expect(Math.abs(xs[xs.length - 10] - end)).toBeLessThan(0.5);
  });

  it("lands in one step under reduced motion", async () => {
    const { el, c } = mount({ current: 0 });
    setReducedMotion(true);
    c.update({ current: 2 });
    await wait(40);
    const a = carX(el);
    await wait(60);
    expect(carX(el)).toBe(a);
  });

  it("lifts and lights a reached station's plate under a mouse, not a finger", async () => {
    const { el } = mount({ current: 2, clickable: true });
    const s = stations(el)[1], top = plateTop(s);
    el.dispatchEvent(ev("pointermove", s.x, s.y, "touch"));
    await wait(100);
    expect(s.plate.classList.contains("k-lit")).toBe(false);
    el.dispatchEvent(ev("pointermove", s.x, s.y));
    expect(s.plate.classList.contains("k-lit")).toBe(true);
    await wait(300);
    // the plate rose on its stubs (screen y goes up)
    expect(plateTop(s)).toBeLessThan(top - 0.3);
    // a station not reached yet does not answer
    const later = stations(el)[3];
    el.dispatchEvent(ev("pointermove", later.x, later.y));
    expect(later.plate.classList.contains("k-lit")).toBe(false);
  });

  it("pushes a pressed station's plate down, and sets off on release", async () => {
    const on = vi.fn();
    const { el } = mount({ current: 2, clickable: true, onStepChange: on });
    const s = stations(el)[0], top = plateTop(s);
    el.dispatchEvent(ev("pointerdown", s.x, s.y));
    expect(on).not.toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe("Cart");
    await wait(150);
    expect(plateTop(s)).toBeGreaterThan(top + 0.5);
    el.dispatchEvent(ev("pointerup", s.x, s.y));
    expect(on).toHaveBeenCalledWith(0);
  });

  it("keeps focus on the step's button when the list is rebuilt", () => {
    const { el, c } = mount({ current: 2, clickable: true });
    const b = el.querySelectorAll("button")[1] as HTMLButtonElement;
    b.focus();
    c.update({ current: 1, clickable: true });
    expect(document.activeElement?.tagName).toBe("BUTTON");
    expect(document.activeElement?.textContent).toBe("Ship");
  });

  it("does nothing of its own on a read-only tap: no motion, no focus, no step change", async () => {
    const on = vi.fn();
    const { el } = mount({ current: 1, onStepChange: on });
    const x0 = carX(el), s = stations(el)[0];
    el.dispatchEvent(ev("pointerdown", s.x, s.y));
    el.dispatchEvent(ev("pointerup", s.x, s.y));
    await wait(80);
    expect(carX(el)).toBe(x0);
    expect(on).not.toHaveBeenCalled();
    expect(el.contains(document.activeElement)).toBe(false);
    expect(el.getAttribute("aria-valuenow")).toBe("2");
  });
});
