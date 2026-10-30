// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { embosser } from "../src/controls/embosser";
import { setReducedMotion } from "../src/core/motion";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); setReducedMotion(false); });
const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
const mount = (o: Parameters<typeof embosser>[1] = {}) => { const el = host(); const c = embosser(el, o); live.push(c); return { el, c, input: el.querySelector("input")! }; };
const type = (input: HTMLInputElement, v: string) => { input.value = v; input.dispatchEvent(new Event("input", { bubbles: true })); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean) => { for (let t = 0; t < 5000 && !ok(); t += 25) await wait(25); };
/** The raised letters on the tape, left to right. */
const tape = (el: Element) => [...el.querySelectorAll<SVGTextElement>("svg text.k-text.hi")].filter((t) => t.getAttribute("display") !== "none" && (t.style.fontWeight === "700")).map((t) => t.textContent).join("");

describe("embosser", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = embosser(el, { finish: "solid", theme: "dark", defaultValue: "abc" });
    expect(el.getAttribute("data-knurl")).toBe("embosser");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });
  it("is a native text field, labelled, with its limit and placeholder", () => {
    const { input } = mount({ label: "Shelf label", placeholder: "Type a label", name: "shelf" });
    expect(input.type).toBe("text");
    expect(input.getAttribute("aria-label")).toBe("Shelf label");
    expect(input.maxLength).toBe(16);
    expect(input.placeholder).toBe("Type a label");
    expect(input.name).toBe("shelf");
  });
  it("embosses typing in capitals and reports it", async () => {
    const on = vi.fn();
    const { el, input } = mount({ onValueChange: on });
    setReducedMotion(true);
    type(input, "h"); type(input, "hi");
    expect(on).toHaveBeenLastCalledWith("HI");
    expect(input.value).toBe("HI");
    expect(el.getAttribute("data-state")).toBe("filled");
    await until(() => tape(el) === "HI");
    expect(tape(el)).toBe("HI");
  });
  it("keeps the case it is given when uppercase is off", () => {
    const on = vi.fn();
    const { input } = mount({ uppercase: false, onValueChange: on });
    type(input, "Box 4");
    expect(on).toHaveBeenLastCalledWith("Box 4");
  });
  it("peels the last letter back into the head on backspace", async () => {
    const on = vi.fn();
    const { el, input } = mount({ defaultValue: "CAT", onValueChange: on });
    setReducedMotion(true);
    await until(() => tape(el) === "CAT");
    type(input, "CA");
    expect(on).toHaveBeenLastCalledWith("CA");
    await until(() => tape(el) === "CA");
    expect(tape(el)).toBe("CA");
  });
  it("takes no more than maxLength characters", () => {
    const on = vi.fn();
    const { input, c } = mount({ onValueChange: on });
    type(input, "abcdefghijklmnopqrstuvwxyz");
    expect(on).toHaveBeenLastCalledWith("ABCDEFGHIJKLMNOP");
    c.update({ maxLength: 4 });
    expect(input.maxLength).toBe(4);
    expect(input.value).toBe("ABCD");
  });
  it("focuses the field on a press anywhere, without embossing", () => {
    const on = vi.fn();
    const { el, input } = mount({ defaultValue: "OK", onValueChange: on });
    el.querySelector("svg")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse", pointerId: 1 }));
    expect(document.activeElement).toBe(input);
    el.querySelector("svg")!.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse", pointerId: 1 }));
    expect(on).not.toHaveBeenCalled();
  });
  it("squeezes the lever when a letter is typed", async () => {
    const { el, input } = mount();
    await wait(30);
    const lever = () => [...el.querySelectorAll("svg .k-solid")].map((s) => s.querySelector(".k-edge")!.getAttribute("d")).join("|");
    const rest = lever();
    type(input, "A");
    await wait(50);
    expect(lever()).not.toBe(rest);
  });
  it("asks and waits when controlled", () => {
    const on = vi.fn();
    const { el, input, c } = mount({ value: "AB", controlled: true, onValueChange: on });
    type(input, "ABC");
    expect(on).toHaveBeenLastCalledWith("ABC");
    expect(input.value).toBe("AB");
    expect(el.getAttribute("data-state")).toBe("filled");
    c.update({ value: "ABC", controlled: true, onValueChange: on });
    expect(input.value).toBe("ABC");
  });
});
