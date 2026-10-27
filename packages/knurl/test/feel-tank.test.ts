// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { tank } from "../src/controls/tank";
import { setReducedMotion } from "../src/core/motion";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => setReducedMotion(false));

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mount = (value: number) => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const c = tank(el, { value });
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 150, height: 208, right: 150, bottom: 208, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return { el, c };
};
const ev = (type: string, x: number, y: number, pointerType = "mouse") => {
  const E: typeof MouseEvent = typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
  const e = new E(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...({ pointerType } as object) });
  if ((e as PointerEvent).pointerType !== pointerType) Object.defineProperty(e, "pointerType", { value: pointerType });
  return e;
};
/** The meniscus: its height at the left and right walls of the glass, and the ripple across it. */
const surface = (el: HTMLElement) => {
  const n = (el.querySelector("svg path.k-line.accent")!.getAttribute("d") ?? "").match(/-?\d+(\.\d+)?/g)!.map(Number);
  // M-0.5 yl L0 yl C x1 y1 x2 y2 WW yr L WW+.5 yr
  return { yl: n[1], yr: n[n.length - 1], rip: (n[5] - n[7]) / 2, y: (n[1] + n[n.length - 1]) / 2 };
};

describe("tank feel", () => {
  it("rocks the surface and runs a ripple on a knock, without changing the value or taking focus", async () => {
    const { el } = mount(50);
    await wait(40);
    const s0 = surface(el);
    expect(s0.yl).toBeCloseTo(s0.yr, 2);
    el.dispatchEvent(ev("pointerdown", 20, 100));
    let tilt = 0, rip = 0;
    for (let k = 0; k < 20; k++) { await wait(16); const s = surface(el); tilt = Math.max(tilt, Math.abs(s.yl - s.yr)); rip = Math.max(rip, Math.abs(s.rip)); }
    // a clear tilt (glass units: the glass is 3.2 wide) and a ripple
    expect(tilt).toBeGreaterThan(0.8);
    expect(rip).toBeGreaterThan(0.2);
    expect(el.getAttribute("aria-valuenow")).toBe("50");
    expect(el.contains(document.activeElement)).toBe(false);
    expect(el.hasAttribute("tabindex")).toBe(false);
  });

  it("sloshes past a new level and settles inside about a second and a half", async () => {
    const { el, c } = mount(20);
    await wait(40);
    const y0 = surface(el).y;
    c.update({ value: 80 });
    const ys: number[] = [];
    for (let k = 0; k < 110; k++) { await wait(16); ys.push(surface(el).y); }
    const end = ys[ys.length - 1];
    // y runs down the glass: the level rose, so y fell, and went past where it settles
    expect(end).toBeLessThan(y0);
    expect(end - Math.min(...ys)).toBeGreaterThan(0.08 * (y0 - end));
    // settled: the last stretch moves no more than a hair
    const tail = ys.slice(-12);
    expect(Math.max(...tail) - Math.min(...tail)).toBeLessThan(0.15);
  });

  it("widens the glint on the glass under a mouse, not under a finger", () => {
    const { el } = mount(50);
    const shine = [...el.querySelectorAll<SVGPathElement>("svg path.k-line.lo")].find((p) => /V/.test(p.getAttribute("d") ?? ""))!;
    el.dispatchEvent(ev("pointerenter", 10, 10, "touch"));
    expect(shine.style.strokeWidth).toBe("");
    el.dispatchEvent(ev("pointerenter", 10, 10, "mouse"));
    expect(shine.style.strokeWidth).not.toBe("");
    el.dispatchEvent(ev("pointerleave", 10, 10, "mouse"));
    expect(shine.style.strokeWidth).toBe("");
  });

  it("lands in one step, flat, with no transition under reduced motion", async () => {
    const { el, c } = mount(20);
    setReducedMotion(true);
    c.update({ value: 80 });
    el.dispatchEvent(ev("pointerdown", 20, 100));
    el.dispatchEvent(ev("pointerenter", 10, 10, "mouse"));
    await wait(40);
    const a = surface(el);
    expect(a.yl).toBeCloseTo(a.yr, 2);
    expect(a.rip).toBeCloseTo(0, 2);
    await wait(60);
    expect(surface(el).y).toBe(a.y);
    const shine = [...el.querySelectorAll<SVGPathElement>("svg path.k-line.lo")].find((p) => /V/.test(p.getAttribute("d") ?? ""))!;
    expect(shine.style.transition).toBe("none");
  });
});
