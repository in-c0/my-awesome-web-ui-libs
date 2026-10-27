// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { combo } from "../src/controls/combo";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
const type = (i: HTMLInputElement, v: string) => { i.value = v; i.dispatchEvent(new Event("input")); };

describe("combo", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = combo(el, { finish: "solid", theme: "dark" });
    expect(el.getAttribute("data-knurl")).toBe("combo");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });
  it("is one native one-time-code input", () => {
    const el = host();
    combo(el, { length: 6, label: "Verification code" });
    const inputs = el.querySelectorAll("input");
    expect(inputs.length).toBe(1);
    const i = inputs[0];
    expect(i.getAttribute("inputmode")).toBe("numeric");
    expect(i.getAttribute("autocomplete")).toBe("one-time-code");
    expect(i.getAttribute("pattern")).toBe("[0-9]*");
    expect(i.maxLength).toBe(6);
    expect(i.getAttribute("aria-label")).toBe("Verification code");
    expect(el.getAttribute("data-state")).toBe("locked");
  });
  it("takes typed digits, drops the rest, and completes", () => {
    const el = host(), on = vi.fn(), done = vi.fn();
    combo(el, { onValueChange: on, onComplete: done });
    const i = el.querySelector("input")!;
    type(i, "4a2");
    expect(on).toHaveBeenLastCalledWith("42");
    expect(i.value).toBe("42");
    expect(done).not.toHaveBeenCalled();
    type(i, "428193");
    expect(on).toHaveBeenLastCalledWith("4281");
    expect(done).toHaveBeenCalledWith("4281");
  });
  it("rolls the wheel at the caret with the arrow keys", () => {
    const el = host(), on = vi.fn();
    combo(el, { defaultValue: "1290", onValueChange: on });
    const i = el.querySelector("input")!;
    i.setSelectionRange(2, 2);
    i.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect(on).toHaveBeenLastCalledWith("1200");
    i.setSelectionRange(0, 0);
    i.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(on).toHaveBeenLastCalledWith("0200");
  });
  it("opens itself on the code, and on unlocked", () => {
    const el = host(), done = vi.fn();
    const c = combo(el, { code: "2468", onComplete: done });
    const i = el.querySelector("input")!;
    type(i, "2467");
    expect(el.getAttribute("data-state")).toBe("locked");
    type(i, "2468");
    expect(el.getAttribute("data-state")).toBe("open");
    expect(done).toHaveBeenCalledTimes(2);
    type(i, "246");
    expect(el.getAttribute("data-state")).toBe("locked");
    c.update({ unlocked: true });
    expect(el.getAttribute("data-state")).toBe("open");
  });
  it("asks and waits when controlled", () => {
    const el = host(), on = vi.fn();
    const c = combo(el, { value: "12", controlled: true, onValueChange: on });
    const i = el.querySelector("input")!;
    type(i, "123");
    expect(on).toHaveBeenLastCalledWith("123");
    expect(i.value).toBe("12");
    c.update({ value: "123", controlled: true, onValueChange: on });
    expect(i.value).toBe("123");
  });
});
