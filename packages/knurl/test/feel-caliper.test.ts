// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { caliper } from "../src/controls/caliper";
import { setReducedMotion } from "../src/core/motion";

beforeAll(() => {
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); setReducedMotion(false); });
const VW = 340, VH = 150;
const mount = (o: Parameters<typeof caliper>[1] = {}) => {
  const el = document.createElement("div"); document.body.appendChild(el);
  live.push(caliper(el, o));
  el.querySelector("svg")!.getBoundingClientRect = () => ({ left: 0, top: 0, width: VW, height: VH, right: VW, bottom: VH, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return el;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Waits until `ok` holds (springs run on the frame clock, which a busy machine slows), or gives up after 5 s. */
const until = async (ok: () => boolean) => { for (let t = 0; t < 5000 && !ok(); t += 25) await wait(25); };
const ptr = (el: Element, type: string, [x, y]: number[], pointerType = "mouse") =>
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerType, pointerId: 1, clientX: x, clientY: y }));
/** The lit span's two ends on screen (it runs along the groove from the lo jaw to the hi jaw). */
const span = (el: Element) => el.querySelector("path.k-line.accent")!.getAttribute("d")!.match(/-?[\d.]+/g)!.map(Number);
/** A point on the lo head, a little way back from its measuring face, given the span is `world` units long. */
const onLoHead = (el: Element, world: number) => { const [ax, ay, bx, by] = span(el), f = 6 / world; return [ax - (bx - ax) * f, ay - (by - ay) * f]; };
// the default pair 25…75 on 0…100 spans 58 of the beam's 116 units
const SPAN = 58;
const heads = (el: Element) => [...el.querySelectorAll("svg > g > g")].filter((g) => g.querySelector(".k-solid")).map((g) => g.getAttribute("transform") ?? "").join("|");

describe("caliper feel", () => {
  it("lifts the head under a hovering mouse, not under a touch, and changes nothing", async () => {
    const on = vi.fn();
    const el = mount({ onValueChange: on });
    await wait(30);
    const at = onLoHead(el, SPAN), rest = heads(el);
    ptr(el, "pointermove", at, "touch");
    await wait(100);
    expect(heads(el)).toBe(rest);
    ptr(el, "pointermove", at);
    await wait(100);
    expect(heads(el)).not.toBe(rest);
    expect(on).not.toHaveBeenCalled();
    ptr(el, "pointerleave", at);
    await until(() => heads(el) === rest);
    expect(heads(el)).toBe(rest);
  });

  it("takes hold of a pressed head at once, before it moves, and lets go on release", async () => {
    const on = vi.fn(), done = vi.fn();
    const el = mount({ onValueChange: on, onValueCommit: done });
    await wait(30);
    const at = onLoHead(el, SPAN), rest = heads(el);
    ptr(el, "pointerdown", at);
    await wait(50);
    expect(heads(el)).not.toBe(rest);
    expect(el.querySelector(".k-solid.k-lit")).not.toBeNull();
    expect(on).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(el.querySelectorAll("input")[0]);
    ptr(el, "pointerup", at);
    expect(done).toHaveBeenCalledWith([25, 75]);
    await until(() => heads(el) === rest);
    expect(heads(el)).toBe(rest);
    expect(el.querySelector(".k-solid.k-lit")).toBeNull();
  });

  it("still sends the nearer jaw to a press on the beam, and asks first when controlled", async () => {
    const on = vi.fn();
    const el = mount({ value: [25, 75], controlled: true, onValueChange: on });
    const [ax, ay, bx, by] = span(el);
    // a quarter of the way along the span: nearer the lo jaw. A click there (no drag) moves it on release
    const at = [ax + (bx - ax) * 0.25, ay + (by - ay) * 0.25];
    ptr(el, "pointerdown", at);
    ptr(el, "pointerup", at);
    const [lo, hi] = on.mock.lastCall![0];
    expect(lo).toBeGreaterThan(30);
    expect(lo).toBeLessThan(45);
    expect(hi).toBe(75);
    expect(el.querySelectorAll("input")[0].value).toBe("25");
  });

  it("lands in one step under reduced motion", async () => {
    const el = mount();
    await wait(20);
    setReducedMotion(true);
    const at = onLoHead(el, SPAN);
    ptr(el, "pointermove", at);
    await wait(40);
    const a = heads(el);
    await wait(40);
    expect(heads(el)).toBe(a);
  });
});
