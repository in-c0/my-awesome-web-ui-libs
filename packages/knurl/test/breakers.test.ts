// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { breakers } from "../src/controls/breakers";

beforeAll(() => {
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  // reduced motion: every spring lands in one frame, so a frame shows where it is going
  (globalThis as any).matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); });

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
const mount = (el: HTMLElement, o: Parameters<typeof breakers>[1] = {}) => { const c = breakers(el, o); live.push(c); return c; };
const frame = () => new Promise((r) => setTimeout(r, 40));
const pe = (t: EventTarget, type: string, o: { pointerType?: string } = {}) => {
  const e = new MouseEvent(type, { bubbles: type !== "pointerleave", cancelable: true, button: 0 });
  Object.defineProperty(e, "pointerType", { value: o.pointerType ?? "mouse" });
  Object.defineProperty(e, "pointerId", { value: 1 });
  t.dispatchEvent(e);
};
const ITEMS = [{ id: "a", label: "LIGHT" }, { id: "b", label: "PLUGS" }, { id: "c", label: "OVEN" }];
// every handle's pose, read from its grip lines
const poses = (el: HTMLElement) => [...el.querySelectorAll("svg g > path.k-line.lo")].map((p) => p.getAttribute("d")).join("|");

describe("breakers", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = breakers(el, { finish: "solid", theme: "dark" });
    expect(el.getAttribute("data-knurl")).toBe("breakers");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });

  it("is a labelled group of native checkboxes", () => {
    const el = host();
    mount(el, { items: ITEMS, defaultValue: ["b"], label: "Kitchen" });
    const group = el.querySelector("[role=group]")!;
    expect(group.getAttribute("aria-label")).toBe("Kitchen");
    const boxes = [...group.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
    expect(boxes.map((b) => b.getAttribute("aria-label"))).toEqual(["LIGHT", "PLUGS", "OVEN"]);
    expect(boxes.map((b) => b.checked)).toEqual([false, true, false]);
  });

  it("toggles from the keyboard's native activation and reports the ids that are on, in order", () => {
    const el = host(), on = vi.fn();
    mount(el, { items: ITEMS, defaultValue: ["c"], onValueChange: on });
    const boxes = el.querySelectorAll<HTMLInputElement>("input");
    boxes[0].click();
    expect(on).toHaveBeenLastCalledWith(["a", "c"]);
    boxes[2].click();
    expect(on).toHaveBeenLastCalledWith(["a"]);
    expect([...boxes].map((b) => b.checked)).toEqual([true, false, false]);
  });

  it("toggles the breaker under a click on the drawing", () => {
    const el = host(), on = vi.fn();
    mount(el, { items: ITEMS, onValueChange: on });
    el.querySelector("svg")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(on).toHaveBeenCalledTimes(1);
    expect(on.mock.calls[0][0]).toHaveLength(1);
  });

  it("gives way on pointerdown, leans under a mouse only, and commits on the click", async () => {
    const el = host(), on = vi.fn();
    mount(el, { items: ITEMS, onValueChange: on });
    const svg = el.querySelector("svg")!;
    await frame();
    const rest = poses(el);
    pe(el, "pointermove", { pointerType: "touch" });
    await frame();
    expect(poses(el)).toBe(rest);
    pe(el, "pointermove");
    await frame();
    const leaning = poses(el);
    expect(leaning).not.toBe(rest);
    pe(svg, "pointerdown");
    await frame();
    const held = poses(el);
    expect(held).not.toBe(leaning);
    expect(on).not.toHaveBeenCalled();
    pe(svg, "pointerup");
    svg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await frame();
    expect(on).toHaveBeenCalledTimes(1);
    expect(poses(el)).not.toBe(held);
    pe(el, "pointerleave");
  });

  it("lights the flag of every breaker that is on", () => {
    const el = host();
    mount(el, { items: ITEMS, defaultValue: ["a", "c"] });
    expect(el.querySelectorAll("path.k-led.on").length).toBe(2);
  });

  it("asks and waits when controlled", () => {
    const el = host(), on = vi.fn();
    const c = mount(el, { items: ITEMS, value: [], controlled: true, onValueChange: on });
    const box = el.querySelectorAll<HTMLInputElement>("input")[1];
    box.click();
    expect(on).toHaveBeenLastCalledWith(["b"]);
    expect(box.checked).toBe(false);
    c.update({ items: ITEMS, value: ["b"], controlled: true, onValueChange: on });
    expect(box.checked).toBe(true);
    expect(el.querySelectorAll("path.k-led.on").length).toBe(1);
  });

  it("rebuilds for new items and submits under a form name", () => {
    const el = host();
    const c = mount(el, { items: ITEMS, name: "circuits" });
    c.update({ items: [...ITEMS, { id: "d", label: "HEAT" }], name: "circuits" });
    const boxes = el.querySelectorAll<HTMLInputElement>("input");
    expect(boxes.length).toBe(4);
    expect(boxes[3].name).toBe("circuits");
    expect(boxes[3].value).toBe("d");
  });
});
