// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { dip } from "../src/controls/dip";

beforeAll(() => {
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); });

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
const mount = (el: HTMLElement, o: Parameters<typeof dip>[1] = {}) => { const c = dip(el, o); live.push(c); return c; };
const frame = () => new Promise((r) => setTimeout(r, 40));
const pe = (t: EventTarget, type: string, o: { pointerType?: string } = {}) => {
  const e = new MouseEvent(type, { bubbles: type !== "pointerleave", cancelable: true, button: 0 });
  Object.defineProperty(e, "pointerType", { value: o.pointerType ?? "mouse" });
  Object.defineProperty(e, "pointerId", { value: 1 });
  t.dispatchEvent(e);
};
const boxes = (el: HTMLElement) => [...el.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
// the sliders' poses, read from their grip lines
const poses = (el: HTMLElement) => [...el.querySelectorAll("svg g > g > path.k-line.lo")].map((p) => p.getAttribute("d")).join("|");

describe("dip", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = dip(el, { finish: "solid", theme: "dark" });
    expect(el.getAttribute("data-knurl")).toBe("dip");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });

  it("is a group of native checkboxes, one per bit, clamped to 2–12", () => {
    const el = host();
    const c = mount(el, { defaultValue: 0b101, labels: ["Boot", "Debug"] });
    expect(el.querySelector("[role=group]")!.getAttribute("aria-label")).toBe("DIP switch");
    expect(boxes(el).length).toBe(8);
    expect(boxes(el).map((b) => b.checked).slice(0, 4)).toEqual([true, false, true, false]);
    expect(boxes(el).map((b) => b.getAttribute("aria-label")).slice(0, 3)).toEqual(["Boot", "Debug", "Switch 3"]);
    c.update({ count: 40 });
    expect(boxes(el).length).toBe(12);
    c.update({ count: 1 });
    expect(boxes(el).length).toBe(2);
  });

  it("reports the bitmask from the keyboard's native activation", () => {
    const el = host(), on = vi.fn();
    mount(el, { count: 4, defaultValue: 1, onValueChange: on });
    boxes(el)[3].click();
    expect(on).toHaveBeenLastCalledWith(9);
    boxes(el)[0].click();
    expect(on).toHaveBeenLastCalledWith(8);
    expect(el.getAttribute("data-state")).toBe("8");
    // an LED lights for every bit that is on
    expect(el.querySelectorAll("path.k-led.on").length).toBe(1);
  });

  it("flips the position under a click, after giving way on the press", async () => {
    const el = host(), on = vi.fn();
    mount(el, { count: 4, onValueChange: on });
    const svg = el.querySelector("svg")!;
    await frame();
    const rest = poses(el);
    pe(el, "pointermove");
    await frame();
    const lean = poses(el);
    expect(lean).not.toBe(rest);
    pe(svg, "pointerdown");
    await frame();
    expect(poses(el)).not.toBe(lean);
    expect(on).not.toHaveBeenCalled();
    pe(svg, "pointerup");
    svg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(on).toHaveBeenCalledTimes(1);
    expect(on.mock.calls[0][0]).toBeGreaterThan(0);
  });

  it("asks and waits when controlled", () => {
    const el = host(), on = vi.fn();
    const c = mount(el, { count: 4, value: 0, controlled: true, onValueChange: on });
    boxes(el)[1].click();
    expect(on).toHaveBeenLastCalledWith(2);
    expect(boxes(el)[1].checked).toBe(false);
    c.update({ count: 4, value: 6, controlled: true, onValueChange: on });
    expect(boxes(el).map((b) => b.checked)).toEqual([false, true, true, false]);
  });

  it("masks a value wider than its positions", () => {
    const el = host();
    mount(el, { count: 3, value: 0xff });
    expect(el.getAttribute("data-state")).toBe("7");
  });
});
