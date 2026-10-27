// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { selector } from "../src/controls/selector";

beforeAll(() => {
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  // reduced motion: every response lands in one frame, so a frame shows where it is going
  (globalThis as any).matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); });

const frame = () => new Promise((r) => setTimeout(r, 40));
/** A selector whose svg is laid out 1:1 with its viewBox, so client coordinates are drawing units. */
const mount = (o: Parameters<typeof selector>[1]) => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const c = selector(el, o);
  live.push(c);
  const svg = el.querySelector("svg")!;
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 170, width: 200, height: 170, x: 0, y: 0, toJSON() {} });
  return { el, svg, c };
};
const pe = (t: EventTarget, type: string, x: number, y: number, pointerType = "mouse") => {
  const e = new MouseEvent(type, { bubbles: type !== "pointerleave", cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, "pointerType", { value: pointerType });
  Object.defineProperty(e, "pointerId", { value: 1 });
  t.dispatchEvent(e);
};
// the knob's pointer line: the last bright line drawn
const pointer = (el: HTMLElement) => { const ps = el.querySelectorAll("path.k-line.hi"); return ps[ps.length - 1].getAttribute("d")!; };
const hub = (el: HTMLElement) => pointer(el).match(/-?[\d.]+/g)!.slice(0, 2).map(Number) as [number, number];

describe("selector feel", () => {
  it("leans toward the position under a hovering mouse and brightens its tick, without choosing it", async () => {
    const { el, svg } = mount({ onValueChange: vi.fn() });
    await frame();
    const rest = pointer(el);
    const [hx, hy] = hub(el);
    pe(svg, "pointermove", hx + 60, hy + 4, "touch");
    await frame();
    expect(pointer(el)).toBe(rest);
    pe(svg, "pointermove", hx + 60, hy + 4);
    await frame();
    expect(pointer(el)).not.toBe(rest);
    expect(el.getAttribute("data-state")).toBe("OFF");
    expect(el.querySelectorAll("path.k-line.hi").length).toBe(2); // the hovered position's tick, and the pointer
    pe(el, "pointerleave", 0, 0);
    await frame();
    expect(pointer(el)).toBe(rest);
    expect(el.querySelectorAll("path.k-line.hi").length).toBe(1);
  });

  it("sinks and starts round on pointerdown on the knob, and clicks on to the next position on release", async () => {
    const on = vi.fn();
    const { el, svg } = mount({ onValueChange: on });
    await frame();
    const rest = pointer(el);
    const [hx, hy] = hub(el);
    pe(svg, "pointerdown", hx, hy, "touch");
    await frame();
    expect(pointer(el)).not.toBe(rest);
    expect(el.getAttribute("data-state")).toBe("OFF");
    expect(on).not.toHaveBeenCalled();
    pe(svg, "pointerup", hx, hy, "touch");
    await frame();
    expect(on).toHaveBeenLastCalledWith("LOW");
    expect(el.getAttribute("data-state")).toBe("LOW");
  });

  it("returns to its detent after a press when controlled and not answered", async () => {
    const on = vi.fn();
    const { el, svg } = mount({ value: "OFF", controlled: true, onValueChange: on });
    await frame();
    const rest = pointer(el);
    const [hx, hy] = hub(el);
    pe(svg, "pointerdown", hx, hy, "touch");
    pe(svg, "pointerup", hx, hy, "touch");
    await frame();
    expect(on).toHaveBeenLastCalledWith("LOW");
    expect(el.getAttribute("data-state")).toBe("OFF");
    expect(pointer(el)).toBe(rest);
  });
});
