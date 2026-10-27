// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { rocker } from "../src/controls/rocker";

beforeAll(() => {
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  // reduced motion: every response lands in one frame, so a frame shows where it is going
  (globalThis as any).matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); });

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
const mount = (el: HTMLElement, o: Parameters<typeof rocker>[1]) => { const c = rocker(el, o); live.push(c); return c; };
const frame = () => new Promise((r) => setTimeout(r, 40));
const pe = (t: EventTarget, type: string, o: { pointerType?: string; x?: number; y?: number } = {}) => {
  const e = new MouseEvent(type, { bubbles: type !== "pointerleave", cancelable: true, clientX: o.x ?? 0, clientY: o.y ?? 0, button: 0 });
  Object.defineProperty(e, "pointerType", { value: o.pointerType ?? "mouse" });
  Object.defineProperty(e, "pointerId", { value: 1 });
  t.dispatchEvent(e);
};
// the paddle's pose, read from its engraved legends
const pose = (el: HTMLElement) => el.querySelector("path.k-line.hi")!.getAttribute("d");

describe("rocker feel", () => {
  it("gives way on pointerdown and commits on release", async () => {
    const el = host(), on = vi.fn();
    mount(el, { onCheckedChange: on });
    const svg = el.querySelector("svg")!;
    await frame();
    const rest = pose(el);
    pe(svg, "pointerdown");
    await frame();
    const held = pose(el);
    expect(held).not.toBe(rest);
    expect(el.getAttribute("data-state")).toBe("off");
    expect(on).not.toHaveBeenCalled();
    pe(svg, "pointerup");
    svg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await frame();
    expect(el.getAttribute("data-state")).toBe("on");
    expect(on).toHaveBeenLastCalledWith(true);
    expect(pose(el)).not.toBe(held); // the press took it most of the way, not all of it
  });

  it("lets a press go without a change when the pointer leaves", async () => {
    const el = host(), on = vi.fn();
    mount(el, { onCheckedChange: on });
    await frame();
    const rest = pose(el);
    pe(el.querySelector("svg")!, "pointerdown");
    await frame();
    pe(el, "pointerleave");
    await frame();
    expect(pose(el)).toBe(rest);
    expect(on).not.toHaveBeenCalled();
  });

  it("leans under a hovering mouse, not under a touch", async () => {
    const el = host();
    mount(el, {});
    await frame();
    const rest = pose(el);
    pe(el, "pointermove", { pointerType: "touch" });
    await frame();
    expect(pose(el)).toBe(rest);
    pe(el, "pointermove");
    await frame();
    expect(pose(el)).not.toBe(rest);
    expect(el.getAttribute("data-state")).toBe("off");
    pe(el, "pointerleave");
    await frame();
    expect(pose(el)).toBe(rest);
  });

  it("holds pressed while Space is down", async () => {
    const el = host();
    mount(el, {});
    await frame();
    const rest = pose(el), input = el.querySelector("input")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    await frame();
    expect(pose(el)).not.toBe(rest);
    input.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true }));
    await frame();
    expect(pose(el)).toBe(rest);
  });

  it("springs back from a press when controlled and not answered", async () => {
    const el = host(), on = vi.fn();
    mount(el, { checked: false, controlled: true, onCheckedChange: on });
    const svg = el.querySelector("svg")!;
    await frame();
    const rest = pose(el);
    pe(svg, "pointerdown");
    pe(svg, "pointerup");
    svg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await frame();
    expect(on).toHaveBeenLastCalledWith(true);
    expect(el.getAttribute("data-state")).toBe("off");
    expect(pose(el)).toBe(rest);
  });
});
