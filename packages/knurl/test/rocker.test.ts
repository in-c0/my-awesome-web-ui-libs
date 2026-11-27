// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { rocker } from "../src/controls/rocker";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };

describe("rocker", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = rocker(el, { finish: "solid", theme: "dark" });
    expect(el.getAttribute("data-knurl")).toBe("rocker");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });
  it("is a native checkbox and reports a change", () => {
    const el = host(), on = vi.fn();
    rocker(el, { onCheckedChange: on, label: "Mains" });
    const input = el.querySelector("input")!;
    expect(input.type).toBe("checkbox");
    expect(input.getAttribute("role")).toBeNull();
    expect(input.getAttribute("aria-label")).toBe("Mains");
    expect(el.getAttribute("data-state")).toBe("off");
    input.click();
    expect(on).toHaveBeenLastCalledWith(true);
    expect(input.checked).toBe(true);
    expect(el.getAttribute("data-state")).toBe("on");
  });
  it("shows indeterminate as centre-off, and leaves it on a change", () => {
    const el = host(), on = vi.fn();
    rocker(el, { indeterminate: true, onCheckedChange: on });
    const input = el.querySelector("input")!;
    expect(input.indeterminate).toBe(true);
    expect(el.getAttribute("data-state")).toBe("mixed");
    input.click();
    expect(on).toHaveBeenLastCalledWith(true);
    expect(input.indeterminate).toBe(false);
    expect(el.getAttribute("data-state")).toBe("on");
  });
  it("asks and waits when controlled", () => {
    const el = host(), on = vi.fn();
    const c = rocker(el, { checked: false, controlled: true, onCheckedChange: on });
    const input = el.querySelector("input")!;
    input.click();
    expect(on).toHaveBeenLastCalledWith(true);
    expect(input.checked).toBe(false);
    expect(el.getAttribute("data-state")).toBe("off");
    c.update({ checked: true, controlled: true, onCheckedChange: on });
    expect(el.getAttribute("data-state")).toBe("on");
    c.update({ checked: true, indeterminate: true, controlled: true, onCheckedChange: on });
    expect(el.getAttribute("data-state")).toBe("mixed");
  });
  it("submits with a form under its name", () => {
    const el = host();
    rocker(el, { name: "power", defaultChecked: true });
    const input = el.querySelector("input")!;
    expect(input.name).toBe("power");
    expect(input.checked).toBe(true);
  });
});
