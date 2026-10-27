// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { tray } from "../src/controls/tray";
import { setReducedMotion } from "../src/core/motion";

beforeAll(() => {
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); setReducedMotion(false); });
const mount = (o: Parameters<typeof tray>[1] = {}) => { const el = document.createElement("div"); document.body.appendChild(el); live.push(tray(el, o)); return el; };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Waits until `ok` holds (springs run on the frame clock, which a busy machine slows), or gives up after 5 s. */
const until = async (ok: () => boolean) => { for (let t = 0; t < 5000 && !ok(); t += 25) await wait(25); };
const ptr = (el: Element, type: string, pointerType = "mouse") => el.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerType, pointerId: 1 }));
/** The tray above its feet: the group that sinks on a press. */
const body = (el: Element) => el.querySelector("svg > g")!.children[1] as SVGGElement;
const land = (el: Element) => el.querySelector<SVGPathElement>("path.dash.edge")!;

describe("tray feel", () => {
  it("sinks onto its feet the moment it is pressed, and comes back up after", async () => {
    const el = mount({ count: 3 });
    expect(body(el).getAttribute("transform")).toBeNull();
    ptr(el, "pointerdown");
    await wait(50);
    expect(body(el).getAttribute("transform")).toMatch(/^translate\(/);
    ptr(el, "pointerup");
    await until(() => body(el).getAttribute("transform") === null);
    expect(body(el).getAttribute("transform")).toBeNull();
  });

  it("still opens the picker from a click on the drawing", () => {
    const el = mount();
    const open = vi.spyOn(el.querySelector<HTMLInputElement>("input[type=file]")!, "click");
    ptr(el, "pointerdown"); ptr(el, "pointerup");
    el.querySelector("svg")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("anticipates a mouse, not a touch: an empty tray shows where a sheet would land", async () => {
    const el = mount();
    ptr(el, "pointerenter", "touch");
    await wait(120);
    expect(land(el).getAttribute("d") ?? "").toBe("");
    ptr(el, "pointerenter", "mouse");
    await wait(120);
    expect(land(el).getAttribute("d")).toMatch(/^M/);
    ptr(el, "pointerleave");
    await until(() => (land(el).getAttribute("d") ?? "") === "");
    expect(land(el).getAttribute("d") ?? "").toBe("");
  });

  it("lands in one step under reduced motion", async () => {
    const el = mount({ count: 2 });
    await wait(20);
    setReducedMotion(true);
    ptr(el, "pointerdown");
    await wait(40);
    const t = body(el).getAttribute("transform");
    expect(t).toMatch(/^translate\(/);
    await wait(40);
    expect(body(el).getAttribute("transform")).toBe(t);
    ptr(el, "pointerup");
    await wait(40);
    expect(body(el).getAttribute("transform")).toBeNull();
  });

  it("does nothing on a press while disabled", async () => {
    const el = mount({ disabled: true });
    ptr(el, "pointerdown");
    await wait(50);
    expect(body(el).getAttribute("transform")).toBeNull();
  });
});
