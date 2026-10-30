// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { stamper } from "../src/controls/stamper";
import { setReducedMotion } from "../src/core/motion";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); setReducedMotion(false); });
const VW = 240, VH = 240;
const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
const mount = (o: Parameters<typeof stamper>[1] = {}) => {
  const el = host();
  const c = stamper(el, o);
  live.push(c);
  el.querySelector("svg")!.getBoundingClientRect = () => ({ left: 0, top: 0, width: VW, height: VH, right: VW, bottom: VH, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return { el, c, input: el.querySelector("input")! };
};
const ptr = (el: Element, type: string, [x, y]: number[], pointerType = "mouse") =>
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerType, pointerId: 1, clientX: x, clientY: y }));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean) => { for (let t = 0; t < 5000 && !ok(); t += 25) await wait(25); };
/** Where each band's reading row is on screen: day, month, year (from its run's transform). */
const bands = (el: Element) => [...el.querySelectorAll("svg g[transform] > g[clip-path]")].map((c) => {
  const m = /matrix\(([^)]+)\)/.exec(c.parentElement!.getAttribute("transform")!)![1].split(/[ ,]+/).map(Number);
  return [m[4], m[5]];
});
const set = (input: HTMLInputElement, v: string) => { input.value = v; input.dispatchEvent(new Event("input", { bubbles: true })); };
const ink = (el: Element) => [...el.querySelectorAll("svg text.k-led")].map((t) => t.textContent).join(" ");

describe("stamper", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = stamper(el, { finish: "solid", theme: "dark" });
    expect(el.getAttribute("data-knurl")).toBe("stamper");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });
  it("is a native date field, labelled, starting today by default", () => {
    const { input } = mount({ label: "Received on", name: "received" });
    expect(input.type).toBe("date");
    expect(input.getAttribute("aria-label")).toBe("Received on");
    expect(input.name).toBe("received");
    const t = new Date(), today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    expect(input.value).toBe(today);
  });
  it("reads the date on its bands and on the paper", () => {
    const { el } = mount({ defaultValue: "2026-10-30" });
    const text = [...el.querySelectorAll("svg text")].map((t) => t.textContent);
    expect(text).toEqual(expect.arrayContaining(["30", "OCT", "2026"]));
    expect(ink(el)).toBe("30 OCT 2026");
  });
  it("changes through the native field, as the keyboard does, and reports it", () => {
    const on = vi.fn();
    const { el, input } = mount({ defaultValue: "2026-10-30", onValueChange: on });
    set(input, "2027-01-02");
    expect(on).toHaveBeenLastCalledWith("2027-01-02");
    expect(el.getAttribute("data-state")).toBe("2027-01-02");
    set(input, "");
    expect(input.value).toBe("2027-01-02");
  });
  it("keeps to min and max", () => {
    const on = vi.fn();
    const { el, input } = mount({ defaultValue: "2026-01-01", min: "2026-03-01", max: "2026-03-31", onValueChange: on });
    expect(input.value).toBe("2026-03-01");
    expect(input.min).toBe("2026-03-01");
    expect(input.max).toBe("2026-03-31");
    set(input, "2026-05-10");
    expect(on).toHaveBeenLastCalledWith("2026-03-31");
    // the month band can't roll past the last day allowed
    ptr(el, "pointerdown", bands(el)[1]); ptr(el, "pointerup", bands(el)[1]);
    expect(el.getAttribute("data-state")).toBe("2026-03-31");
  });
  it("rolls a clicked band on by one: day, month, year, each on its own", () => {
    const on = vi.fn();
    const { el } = mount({ defaultValue: "2026-01-31", onValueChange: on });
    const [d, m, y] = bands(el);
    ptr(el, "pointerdown", d); ptr(el, "pointerup", d);
    // the day band wraps inside its month
    expect(on).toHaveBeenLastCalledWith("2026-01-01");
    ptr(el, "pointerdown", m); ptr(el, "pointerup", m);
    expect(on).toHaveBeenLastCalledWith("2026-02-01");
    ptr(el, "pointerdown", y); ptr(el, "pointerup", y);
    expect(on).toHaveBeenLastCalledWith("2027-02-01");
  });
  it("keeps the day inside a shorter month", () => {
    const on = vi.fn();
    const { el } = mount({ defaultValue: "2026-01-31", onValueChange: on });
    const m = bands(el)[1];
    ptr(el, "pointerdown", m); ptr(el, "pointerup", m);
    expect(on).toHaveBeenLastCalledWith("2026-02-28");
  });
  it("rolls a band under the wheel, both ways", () => {
    const on = vi.fn();
    const { el } = mount({ defaultValue: "2026-06-15", onValueChange: on });
    const [x, y] = bands(el)[0];
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -40, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    expect(on).toHaveBeenLastCalledWith("2026-06-16");
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: 40, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    expect(on).toHaveBeenLastCalledWith("2026-06-15");
  });
  it("stamps the date on the paper when pressed anywhere off the bands", async () => {
    const stamp = vi.fn();
    const { el, input, c } = mount({ defaultValue: "2026-10-30", onStamp: stamp });
    c.update({ value: "2026-11-02" });
    expect(ink(el)).toBe("30 OCT 2026");
    ptr(el, "pointerdown", [VW / 2, 6], "touch");
    expect(document.activeElement).toBe(input);
    ptr(el, "pointerup", [VW / 2, 6], "touch");
    // a quick click still goes all the way down before it comes back
    await until(() => stamp.mock.calls.length > 0);
    expect(stamp).toHaveBeenCalledWith("2026-11-02");
    expect(ink(el)).toBe("02 NOV 2026");
  });
  it("asks and waits when controlled", () => {
    const on = vi.fn();
    const { el, input, c } = mount({ value: "2026-10-30", controlled: true, onValueChange: on });
    set(input, "2026-10-31");
    expect(on).toHaveBeenLastCalledWith("2026-10-31");
    expect(input.value).toBe("2026-10-30");
    expect(el.getAttribute("data-state")).toBe("2026-10-30");
    c.update({ value: "2026-10-31", controlled: true, onValueChange: on });
    expect(el.getAttribute("data-state")).toBe("2026-10-31");
  });
});
