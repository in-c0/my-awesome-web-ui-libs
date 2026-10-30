// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { tabs } from "../src/controls/tabs";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  // reduced motion: every spring lands in one frame, so a frame shows where it is going
  (globalThis as any).matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); });

const frame = () => new Promise((r) => setTimeout(r, 40));
/** A drawer whose svg is laid out 1:1 with its viewBox, so client coordinates are drawing units. */
const mount = (o: Parameters<typeof tabs>[1] = {}) => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const c = tabs(el, o);
  live.push(c);
  const svg = el.querySelector("svg")!;
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, right: 240, bottom: 190, width: 240, height: 190, x: 0, y: 0, toJSON() {} });
  return { el, svg, c };
};
const pe = (t: EventTarget, type: string, x: number, y: number, pointerType = "mouse") => {
  const e = new MouseEvent(type, { bubbles: type !== "pointerleave", cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, "pointerType", { value: pointerType });
  Object.defineProperty(e, "pointerId", { value: 1 });
  t.dispatchEvent(e);
};
const key = (t: Element, k: string) => t.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const tabEls = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>("[role=tab]")];
/** Where tab i's label sits on the drawing: the middle of its tab. */
const onTab = (el: HTMLElement, label: string): [number, number] => {
  const t = [...el.querySelectorAll("text")].find((x) => x.textContent === label)!;
  const m = t.getAttribute("transform")!.match(/matrix\(([^)]+)\)/)![1].split(/\s+/).map(Number);
  return [m[4], m[5]];
};
const faceOf = (el: HTMLElement, label: string) => [...el.querySelectorAll("text")].find((x) => x.textContent === label)!.parentElement!.querySelector("path.k-face")!.getAttribute("d");

describe("tabs", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.className = "mine";
    const c = tabs(el, { finish: "solid", theme: "dark" });
    expect(el.getAttribute("data-knurl")).toBe("tabs");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });

  it("is a labelled tablist of tab buttons with one selected and a roving tabindex", () => {
    const { el } = mount({ label: "Product", tabs: ["One", "Two", "Three"], defaultValue: 1, ids: ["p1", "p2", "p3"] });
    const list = el.querySelector("[role=tablist]")!;
    expect(list.getAttribute("aria-label")).toBe("Product");
    const ts = tabEls(el);
    expect(ts.map((t) => t.textContent)).toEqual(["One", "Two", "Three"]);
    expect(ts.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    expect(ts.map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
    expect(ts.map((t) => t.getAttribute("aria-controls"))).toEqual(["p1", "p2", "p3"]);
    expect(el.getAttribute("data-state")).toBe("1");
  });

  it("moves with arrow keys, Home and End, wrapping, and selection follows focus", () => {
    const on = vi.fn();
    const { el } = mount({ onValueChange: on });
    const ts = tabEls(el);
    ts[0].focus();
    key(ts[0], "ArrowRight");
    expect(on).toHaveBeenLastCalledWith(1);
    expect(document.activeElement).toBe(ts[1]);
    expect(ts[1].getAttribute("aria-selected")).toBe("true");
    expect(ts[1].tabIndex).toBe(0);
    key(ts[1], "End");
    expect(on).toHaveBeenLastCalledWith(3);
    key(ts[3], "ArrowRight");
    expect(on).toHaveBeenLastCalledWith(0);
    key(ts[0], "ArrowLeft");
    expect(on).toHaveBeenLastCalledWith(3);
    key(ts[3], "Home");
    expect(on).toHaveBeenLastCalledWith(0);
  });

  it("selects a tab its button is activated on", () => {
    const on = vi.fn();
    const { el } = mount({ onValueChange: on });
    tabEls(el)[2].click();
    expect(on).toHaveBeenLastCalledWith(2);
    expect(el.getAttribute("data-state")).toBe("2");
  });

  it("asks and waits when controlled", () => {
    const on = vi.fn();
    const { el, c } = mount({ value: 0, controlled: true, onValueChange: on });
    tabEls(el)[2].click();
    expect(on).toHaveBeenLastCalledWith(2);
    expect(tabEls(el)[0].getAttribute("aria-selected")).toBe("true");
    c.update({ value: 2, controlled: true, onValueChange: on });
    expect(tabEls(el)[2].getAttribute("aria-selected")).toBe("true");
    expect(el.getAttribute("data-state")).toBe("2");
  });

  it("selects a card the moment its tab is pressed, and the next tab for a press on the drawer", async () => {
    const on = vi.fn();
    const { el, svg } = mount({ onValueChange: on });
    await frame();
    const before = faceOf(el, "Price");
    const [x, y] = onTab(el, "Price");
    pe(svg, "pointerdown", x, y, "touch");
    expect(on).toHaveBeenLastCalledWith(2);
    expect(document.activeElement).toBe(tabEls(el)[2]);
    await frame();
    expect(faceOf(el, "Price")).not.toBe(before); // risen
    // the drawer's front: the next tab
    pe(svg, "pointerdown", 120, 175, "touch");
    expect(on).toHaveBeenLastCalledWith(3);
  });

  it("lifts the card under a hovering mouse a little without selecting it", async () => {
    const on = vi.fn();
    const { el, svg } = mount({ onValueChange: on });
    await frame();
    const rest = faceOf(el, "Notes");
    const [x, y] = onTab(el, "Notes");
    pe(svg, "pointermove", x, y, "touch");
    await frame();
    expect(faceOf(el, "Notes")).toBe(rest);
    pe(svg, "pointermove", x, y);
    await frame();
    expect(faceOf(el, "Notes")).not.toBe(rest);
    expect(on).not.toHaveBeenCalled();
    pe(el, "pointerleave", 0, 0);
    await frame();
    expect(faceOf(el, "Notes")).toBe(rest);
  });

  it("rebuilds when its tabs change, clamping the value", () => {
    const { el, c } = mount({ defaultValue: 3 });
    c.update({ tabs: ["A", "B"] });
    expect(tabEls(el).map((t) => t.textContent)).toEqual(["A", "B"]);
    expect(el.getAttribute("data-state")).toBe("1");
  });
});
