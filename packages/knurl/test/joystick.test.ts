// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { joystick } from "../src/controls/joystick";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); vi.useRealTimers(); });

const live: { destroy(): void }[] = [];
const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
// every control is destroyed after its test, so the shared frame loop starts afresh under each test's clock
const mount: typeof joystick = ((el: HTMLElement, o?: object) => { const c = joystick(el, o as never); live.push(c); return c; }) as typeof joystick;
const nudge = (i: HTMLInputElement, v: number) => { i.value = String(v); i.dispatchEvent(new Event("input")); i.dispatchEvent(new Event("change")); };

describe("joystick", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = mount(el, { finish: "solid", theme: "dark" });
    expect(el.getAttribute("data-knurl")).toBe("joystick");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });

  it("is two native sliders, one per axis, named from the label", () => {
    const el = host();
    mount(el, { label: "Camera", defaultValue: { x: 0.5, y: -0.3 } });
    const [x, y] = el.querySelectorAll<HTMLInputElement>("input[type=range]");
    expect(x.getAttribute("aria-label")).toBe("Camera X");
    expect(y.getAttribute("aria-label")).toBe("Camera Y");
    expect([x.min, x.max, y.min, y.max]).toEqual(["-100", "100", "-100", "100"]);
    expect(x.value).toBe("50");
    expect(y.value).toBe("-30");
    expect(x.getAttribute("aria-valuetext")).toBe("50% right");
    expect(y.getAttribute("aria-valuetext")).toBe("30% down");
  });

  it("moves one axis from its input, keeps it there and reports it", () => {
    const el = host(), on = vi.fn(), commit = vi.fn();
    mount(el, { onValueChange: on, onValueCommit: commit });
    const [x, y] = el.querySelectorAll<HTMLInputElement>("input");
    nudge(x, 80);
    expect(on).toHaveBeenLastCalledWith({ x: 0.8, y: 0 });
    nudge(y, 100);
    expect(on).toHaveBeenLastCalledWith({ x: 0.8, y: 1 });
    expect(commit).toHaveBeenLastCalledWith({ x: 0.8, y: 1 });
    expect(el.getAttribute("data-state")).toBe("pushed");
    expect(x.value).toBe("80");
  });

  it("asks and waits when controlled", () => {
    const el = host(), on = vi.fn();
    const c = mount(el, { value: { x: 0, y: 0 }, controlled: true, onValueChange: on });
    const [x] = el.querySelectorAll<HTMLInputElement>("input");
    nudge(x, 40);
    expect(on).toHaveBeenLastCalledWith({ x: 0.4, y: 0 });
    expect(x.value).toBe("0");
    c.update({ value: { x: 0.4, y: 0 }, controlled: true, onValueChange: on });
    expect(x.value).toBe("40");
  });

  it("clamps values to -1…1", () => {
    const el = host();
    mount(el, { value: { x: 3, y: -2 } });
    const [x, y] = el.querySelectorAll<HTMLInputElement>("input");
    expect([x.value, y.value]).toEqual(["100", "-100"]);
  });
});
