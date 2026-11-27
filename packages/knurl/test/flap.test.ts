// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { flap } from "../src/controls/flap";
import { setReducedMotion } from "../src/core/motion";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); setReducedMotion(false); });
const VW = 240, VH = 170;
const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
const mount = (o: Parameters<typeof flap>[1] = {}) => {
  const el = host();
  live.push(flap(el, o));
  el.querySelector("svg")!.getBoundingClientRect = () => ({ left: 0, top: 0, width: VW, height: VH, right: VW, bottom: VH, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return el;
};
const ptr = (el: Element, type: string, x = 4, y = 4, pointerType = "mouse") =>
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerType, pointerId: 1, clientX: x, clientY: y }));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean) => { for (let t = 0; t < 5000 && !ok(); t += 25) await wait(25); };
/** The legends on show: the bottom flap's, the top flap's and any flap's in the air (the waiting flaps come first in the drawing). */
const shown = (el: Element) => [...el.querySelectorAll<SVGTextElement>("svg text")].slice(6).filter((t) => t.closest("[display=none]") === null && t.textContent).map((t) => t.textContent);

describe("flap", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = flap(el, { finish: "solid", theme: "dark" });
    expect(el.getAttribute("data-knurl")).toBe("flap");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });
  it("is a native select with one option per flap, named and labelled", () => {
    const el = mount({ label: "Platform", name: "plat", options: ["1", "2", "3"], defaultValue: "2" });
    const sel = el.querySelector("select")!;
    expect(sel.getAttribute("aria-label")).toBe("Platform");
    expect(sel.name).toBe("plat");
    expect([...sel.options].map((x) => x.value)).toEqual(["1", "2", "3"]);
    expect(sel.value).toBe("2");
    expect(el.getAttribute("data-state")).toBe("2");
  });
  it("defaults to the alphabet, starting at A", () => {
    const el = mount();
    const sel = el.querySelector("select")!;
    expect(sel.options.length).toBe(26);
    expect(sel.value).toBe("A");
    expect(shown(el)).toContain("A");
  });
  it("changes through the native select, as the keyboard does, and reports it", () => {
    const on = vi.fn();
    const el = mount({ options: ["LHR", "CDG", "JFK"], onValueChange: on });
    const sel = el.querySelector("select")!;
    sel.value = "JFK";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    expect(on).toHaveBeenLastCalledWith("JFK");
    expect(el.getAttribute("data-state")).toBe("JFK");
  });
  it("flips forward through every flap in between to reach the choice", async () => {
    const el = mount({ options: ["A", "B", "C", "D"], defaultValue: "C" });
    const c = live[live.length - 1] as ReturnType<typeof flap>;
    const seen = new Set<string>();
    // asking for the one before goes the long way round: C → D → A → B
    c.update({ value: "B" });
    for (let t = 0; t < 2000 && el.querySelector("[data-knurl] text") && !(shown(el).every((s) => s === "B") && seen.size > 1); t += 10) { shown(el).forEach((s) => seen.add(s!)); await wait(10); }
    expect(seen.has("D")).toBe(true);
    expect(seen.has("A")).toBe(true);
    await until(() => shown(el).every((s) => s === "B"));
    expect(shown(el).every((s) => s === "B")).toBe(true);
  });
  it("drops the next flap on a click, and holds the top flap while pressed", async () => {
    const on = vi.fn();
    const el = mount({ options: ["A", "B", "C"], onValueChange: on });
    await wait(30);
    ptr(el, "pointerdown");
    expect(document.activeElement).toBe(el.querySelector("select"));
    expect(on).not.toHaveBeenCalled();
    ptr(el, "pointerup");
    expect(on).toHaveBeenLastCalledWith("B");
    ptr(el, "pointerdown"); ptr(el, "pointerup");
    ptr(el, "pointerdown"); ptr(el, "pointerup");
    // after the last flap the drum comes round to the first
    expect(on).toHaveBeenLastCalledWith("A");
  });
  it("turns on a flap for each notch of the wheel, down forward and up the long way round", () => {
    const on = vi.fn();
    const el = mount({ options: ["A", "B", "C"], onValueChange: on });
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: 40, bubbles: true, cancelable: true }));
    expect(on).toHaveBeenLastCalledWith("B");
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -40, bubbles: true, cancelable: true }));
    expect(on).toHaveBeenLastCalledWith("A");
  });
  it("asks and waits when controlled", () => {
    const on = vi.fn();
    const el = mount({ options: ["A", "B"], value: "A", controlled: true, onValueChange: on });
    const c = live[live.length - 1] as ReturnType<typeof flap>;
    ptr(el, "pointerdown"); ptr(el, "pointerup");
    expect(on).toHaveBeenLastCalledWith("B");
    expect(el.getAttribute("data-state")).toBe("A");
    expect(el.querySelector("select")!.value).toBe("A");
    c.update({ options: ["A", "B"], value: "B", controlled: true, onValueChange: on });
    expect(el.getAttribute("data-state")).toBe("B");
    expect(el.querySelector("select")!.value).toBe("B");
  });
  it("jumps straight to the choice under reduced motion", async () => {
    const el = mount({ options: ["A", "B", "C", "D"] });
    const c = live[live.length - 1] as ReturnType<typeof flap>;
    setReducedMotion(true);
    c.update({ value: "D" });
    await wait(40);
    expect(shown(el).every((s) => s === "D")).toBe(true);
  });
  it("rebuilds when its options change", () => {
    const el = mount({ options: ["A", "B"] });
    const c = live[live.length - 1] as ReturnType<typeof flap>;
    c.update({ options: ["X", "Y", "Z"], value: "Z" });
    expect([...el.querySelector("select")!.options].map((x) => x.value)).toEqual(["X", "Y", "Z"]);
    expect(el.getAttribute("data-state")).toBe("Z");
  });
});
