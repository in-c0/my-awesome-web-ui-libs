// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { timer } from "../src/controls/timer";

beforeAll(() => {
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  // reduced motion: every response lands in one frame, so a frame shows where it is going
  (globalThis as any).matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); });

const frame = () => new Promise((r) => setTimeout(r, 40));
/** A timer whose svg is laid out 1:1 with its viewBox, so client coordinates are drawing units. */
const mount = (o: Parameters<typeof timer>[1]) => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const c = timer(el, o);
  live.push(c);
  const svg = el.querySelector("svg")!;
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 180, width: 200, height: 180, x: 0, y: 0, toJSON() {} });
  return { el, svg, c };
};
const pe = (t: EventTarget, type: string, x: number, y: number, pointerType = "mouse") => {
  const e = new MouseEvent(type, { bubbles: type !== "pointerleave", cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, "pointerType", { value: pointerType });
  Object.defineProperty(e, "pointerId", { value: 1 });
  t.dispatchEvent(e);
};
const face = (el: HTMLElement) => el.querySelector("path.k-face")!.getAttribute("d")!;
// the zero mark on the dial: the second bright line (after the major ticks)
const zero = (el: HTMLElement) => el.querySelectorAll("path.k-line.hi")[1].getAttribute("d")!;
/** The dial's centre on screen: the middle of its face. */
const centre = (el: HTMLElement) => {
  const n = face(el).match(/-?[\d.]+/g)!.map(Number), xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] as const;
};

describe("timer feel", () => {
  it("sinks under a press at once and rises when let go, holding the clock meanwhile", async () => {
    const { el, svg } = mount({ defaultValue: 600 });
    await frame();
    const rest = face(el), [x, y] = centre(el);
    expect(el.getAttribute("data-state")).toBe("running");
    pe(svg, "pointerdown", x, y, "touch");
    await frame();
    expect(face(el)).not.toBe(rest);
    expect(el.getAttribute("data-state")).toBe("paused");
    pe(svg, "pointerup", x, y, "touch");
    await frame();
    expect(face(el)).toBe(rest);
    expect(el.getAttribute("data-state")).toBe("running");
  });

  it("eases round under a hovering mouse without winding, and not under a touch", async () => {
    const on = vi.fn();
    const { el, svg } = mount({ defaultValue: 600, running: false, onValueChange: on });
    await frame();
    const rest = zero(el), [x, y] = centre(el);
    pe(svg, "pointermove", x, y, "touch");
    await frame();
    expect(zero(el)).toBe(rest);
    pe(svg, "pointermove", x, y);
    await frame();
    expect(zero(el)).not.toBe(rest);
    expect(el.querySelector("input")!.value).toBe("600");
    expect(on).not.toHaveBeenCalled();
    pe(el, "pointerleave", 0, 0);
    await frame();
    expect(zero(el)).toBe(rest);
  });

  it("does not ease past its stop when fully wound", async () => {
    const { el, svg } = mount({ defaultValue: 3600, running: false });
    await frame();
    const rest = zero(el), [x, y] = centre(el);
    pe(svg, "pointermove", x, y);
    await frame();
    expect(zero(el)).toBe(rest);
  });

  it("still winds in whole minutes from its input", async () => {
    const on = vi.fn();
    const { el } = mount({ running: false, onValueChange: on });
    await frame();
    const before = zero(el), input = el.querySelector("input")!;
    input.value = "120"; input.dispatchEvent(new Event("input"));
    await frame();
    expect(on).toHaveBeenLastCalledWith(120);
    expect(zero(el)).not.toBe(before);
  });
});
