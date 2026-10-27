// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { caliper } from "../src/controls/caliper";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
const inputs = (el: HTMLElement) => el.querySelectorAll<HTMLInputElement>("input[type=range]");
const type = (i: HTMLInputElement, v: number) => { i.value = String(v); i.dispatchEvent(new Event("input")); };

describe("caliper", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = caliper(el, { finish: "solid", theme: "dark" });
    expect(el.getAttribute("data-knurl")).toBe("caliper");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });
  it("is two labelled native ranges with the default pair", () => {
    const el = host();
    caliper(el, { label: "Price", format: (v: number) => `$${v}` });
    const [a, b] = inputs(el);
    expect(inputs(el).length).toBe(2);
    expect(a.getAttribute("aria-label")).toBe("Price minimum");
    expect(b.getAttribute("aria-label")).toBe("Price maximum");
    expect([a.value, b.value]).toEqual(["25", "75"]);
    expect(b.getAttribute("aria-valuetext")).toBe("$75");
  });
  it("snaps, and never lets a jaw pass the other or close past minGap", () => {
    const el = host(), on = vi.fn();
    caliper(el, { min: 0, max: 10, step: 0.5, minGap: 1, defaultValue: [2.2, 6], onValueChange: on });
    const [a, b] = inputs(el);
    expect(a.value).toBe("2");
    type(a, 5.6);
    expect(on).toHaveBeenLastCalledWith([5, 6]);
    type(b, 3);
    expect(on).toHaveBeenLastCalledWith([5, 6]);
    type(b, 12);
    expect(on).toHaveBeenLastCalledWith([5, 10]);
    expect([a.value, b.value]).toEqual(["5", "10"]);
  });
  it("asks and waits when controlled", () => {
    const el = host(), on = vi.fn();
    const c = caliper(el, { value: [10, 40], controlled: true, onValueChange: on });
    const [a] = inputs(el);
    type(a, 20);
    expect(on).toHaveBeenLastCalledWith([20, 40]);
    expect(a.value).toBe("10");
    c.update({ value: [20, 40], controlled: true, onValueChange: on });
    expect(a.value).toBe("20");
  });
  it("commits on change", () => {
    const el = host(), done = vi.fn();
    caliper(el, { onValueCommit: done });
    inputs(el)[1].dispatchEvent(new Event("change"));
    expect(done).toHaveBeenCalledWith([25, 75]);
  });
});
