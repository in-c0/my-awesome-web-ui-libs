// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { throttle } from "../src/controls/throttle";

beforeAll(() => {
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); });

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
const mount = (el: HTMLElement, o: Parameters<typeof throttle>[1] = {}) => {
  const c = throttle(el, o); live.push(c);
  // one viewBox unit per pixel, so a client point is a point in the drawing
  el.querySelector("svg")!.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return c;
};
const frame = () => new Promise((r) => setTimeout(r, 40));
const pe = (t: EventTarget, type: string, x: number, y: number, pointerType = "mouse") => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(e, "pointerType", { value: pointerType });
  Object.defineProperty(e, "pointerId", { value: 1 });
  t.dispatchEvent(e);
};
/** The grip ball's centre on screen: the mean of its outline's points. */
const ball = (el: HTMLElement) => {
  const solids = el.querySelectorAll("svg g.k-solid");
  const d = solids[solids.length - 1].querySelector(".k-fill")!.getAttribute("d")!;
  const n = d.match(/-?[\d.]+/g)!.map(Number);
  let x = 0, y = 0;
  for (let i = 0; i < n.length; i += 2) { x += n[i]; y += n[i + 1]; }
  return [x / (n.length / 2), y / (n.length / 2)];
};

describe("throttle", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = throttle(el, { finish: "solid", theme: "dark" });
    expect(el.getAttribute("data-knurl")).toBe("throttle");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });

  it("is a vertical native range", () => {
    const el = host();
    mount(el, { min: 0, max: 10, step: 0.5, defaultValue: 3.3, format: (v: number) => `${v * 10}%` });
    const input = el.querySelector("input")!;
    expect(input.type).toBe("range");
    expect(input.getAttribute("aria-orientation")).toBe("vertical");
    expect(input.getAttribute("aria-label")).toBe("Throttle");
    expect(input.value).toBe("3.5");
    expect(input.getAttribute("aria-valuetext")).toBe("35%");
  });

  it("changes from the keyboard's native input", () => {
    const el = host(), on = vi.fn();
    mount(el, { onValueChange: on });
    const input = el.querySelector("input")!;
    input.value = "40"; input.dispatchEvent(new Event("input"));
    expect(on).toHaveBeenLastCalledWith(40);
  });

  it("moves the lever to a press and clicks into a nearby notch", async () => {
    const ref = host();
    mount(ref, { value: 52 });
    await frame();
    const [x, y] = ball(ref);
    const el = host(), on = vi.fn(), done = vi.fn();
    mount(el, { value: 0, notches: [50], onValueChange: on, onValueCommit: done });
    await frame();
    const before = ball(el);
    pe(el, "pointerdown", x, y);
    expect(on).toHaveBeenLastCalledWith(50);
    await frame();
    expect(ball(el)).not.toEqual(before);
    // the notch's mark lights
    expect(el.querySelectorAll("path.k-line.accent").length).toBeGreaterThan(1);
    pe(el, "pointerup", x, y);
    expect(done).toHaveBeenCalledWith(50);
  });

  it("leans toward a hovering mouse, not a touch", async () => {
    const ref = host();
    mount(ref, { value: 90 });
    await frame();
    const [x, y] = ball(ref);
    const el = host(), on = vi.fn();
    mount(el, { value: 10, onValueChange: on });
    await frame();
    const rest = ball(el);
    pe(el, "pointermove", x, y, "touch");
    await frame();
    expect(ball(el)).toEqual(rest);
    pe(el, "pointermove", x, y);
    await frame();
    expect(ball(el)).not.toEqual(rest);
    expect(on).not.toHaveBeenCalled();
  });

  it("asks and waits when controlled", () => {
    const el = host(), on = vi.fn();
    const c = mount(el, { value: 20, controlled: true, onValueChange: on });
    const input = el.querySelector("input")!;
    input.value = "60"; input.dispatchEvent(new Event("input"));
    expect(on).toHaveBeenLastCalledWith(60);
    expect(input.value).toBe("20");
    c.update({ value: 60, controlled: true, onValueChange: on });
    expect(input.value).toBe("60");
  });
});
