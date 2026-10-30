// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fan, FAN_COLOURS } from "../src/controls/fan";

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
/** A fan whose svg is laid out 1:1 with its viewBox, so client coordinates are drawing units. */
const mount = (o: Parameters<typeof fan>[1] = {}) => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const c = fan(el, o);
  live.push(c);
  const svg = el.querySelector("svg")!;
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, right: 260, bottom: 170, width: 260, height: 170, x: 0, y: 0, toJSON() {} });
  return { el, svg, c };
};
const pe = (t: EventTarget, type: string, x: number, y: number, pointerType = "mouse") => {
  const e = new MouseEvent(type, { bubbles: type !== "pointerleave", cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, "pointerType", { value: pointerType });
  Object.defineProperty(e, "pointerId", { value: 1 });
  t.dispatchEvent(e);
};
const nums = (d: string) => d.match(/-?[\d.]+/g)!.map(Number);
/** The chips, in option order: each strip's chip is the path filled with its colour, in the strip numbered i + 1 (strips are painted by height, not in order). */
const chips = (el: HTMLElement) => [...el.querySelectorAll("text")]
  .sort((a, b) => Number(a.textContent) - Number(b.textContent))
  .map((t) => [...t.parentElement!.querySelectorAll<SVGPathElement>("path.k-face")].find((p) => p.style.fill)!);
/** A point inside strip i's chip, on the side its neighbour leaves showing. */
const onChip = (el: HTMLElement, i: number): [number, number] => {
  const n = nums(chips(el)[i].getAttribute("d")!);
  const [ax, ay, bx, by, cx, cy, dx, dy] = n;
  const mx = (ax + bx) / 2, my = (ay + by) / 2, ox = (ax + bx + cx + dx) / 4, oy = (ay + by + cy + dy) / 4;
  return [mx + (ox - mx) * 0.25, my + (oy - my) * 0.25];
};

describe("fan", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.className = "mine";
    const c = fan(el, { finish: "solid", theme: "dark" });
    expect(el.getAttribute("data-knurl")).toBe("fan");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });

  it("is a labelled radio group of native radios, one per colour, with the colours as values", () => {
    const { el } = mount({ label: "Wall colour" });
    const group = el.querySelector("[role=radiogroup]")!;
    expect(group.getAttribute("aria-label")).toBe("Wall colour");
    const radios = [...el.querySelectorAll<HTMLInputElement>("input[type=radio]")];
    expect(radios.map((r) => r.value)).toEqual(FAN_COLOURS.map((c) => c.value));
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual(FAN_COLOURS.map((c) => c.label));
    expect(radios[0].checked).toBe(true);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    // the chips carry the option colours; nothing else is painted inline
    expect(chips(el).map((p) => p.style.fill.replace(/\s/g, ""))).toHaveLength(FAN_COLOURS.length);
  });

  it("changes through its native radios and reports it", () => {
    const on = vi.fn();
    const { el } = mount({ options: [{ value: "red", label: "Red" }, { value: "blue", label: "Blue" }], onValueChange: on, name: "paint" });
    const radios = el.querySelectorAll<HTMLInputElement>("input[type=radio]");
    expect(radios[0].name).toBe("paint");
    radios[1].click();
    expect(on).toHaveBeenLastCalledWith("blue");
    expect(el.getAttribute("data-state")).toBe("blue");
    expect(radios[1].checked).toBe(true);
  });

  it("asks and waits when controlled", () => {
    const on = vi.fn();
    const opts = [{ value: "red", label: "Red" }, { value: "blue", label: "Blue" }];
    const { el, c } = mount({ options: opts, value: "red", controlled: true, onValueChange: on });
    const radios = el.querySelectorAll<HTMLInputElement>("input[type=radio]");
    radios[1].click();
    expect(on).toHaveBeenLastCalledWith("blue");
    expect(el.getAttribute("data-state")).toBe("red");
    expect(radios[0].checked).toBe(true);
    c.update({ options: opts, value: "blue", controlled: true, onValueChange: on });
    expect(el.getAttribute("data-state")).toBe("blue");
    expect(radios[1].checked).toBe(true);
  });

  it("picks a strip the moment it is pressed, and lifts it with its chip outlined", async () => {
    const on = vi.fn();
    const { el, svg } = mount({ defaultValue: FAN_COLOURS[4].value, onValueChange: on });
    await frame();
    const before = chips(el)[1].getAttribute("d");
    const [x, y] = onChip(el, 1);
    pe(svg, "pointerdown", x, y, "touch");
    expect(on).toHaveBeenLastCalledWith(FAN_COLOURS[1].value);
    expect(el.getAttribute("data-state")).toBe(FAN_COLOURS[1].value);
    await frame();
    expect(chips(el)[1].getAttribute("d")).not.toBe(before);
    // the lit outline sits on the chosen chip
    const ring = [...el.querySelectorAll("path.k-line.hi")].find((p) => p.getAttribute("d"));
    expect(ring!.getAttribute("d")).toBe(chips(el)[1].getAttribute("d"));
    pe(svg, "pointerup", x, y, "touch");
  });

  it("lifts the strip under a hovering mouse a little without choosing it", async () => {
    const on = vi.fn();
    const { el, svg } = mount({ defaultValue: FAN_COLOURS[4].value, onValueChange: on });
    await frame();
    const rest = chips(el)[1].getAttribute("d");
    const [x, y] = onChip(el, 1);
    pe(svg, "pointermove", x, y, "touch");
    await frame();
    expect(chips(el)[1].getAttribute("d")).toBe(rest);
    pe(svg, "pointermove", x, y);
    await frame();
    expect(chips(el)[1].getAttribute("d")).not.toBe(rest);
    expect(on).not.toHaveBeenCalled();
    pe(el, "pointerleave", 0, 0);
    await frame();
    expect(chips(el)[1].getAttribute("d")).toBe(rest);
  });

  it("picks the strip in that direction for a press away from every strip, and the next one on the rivet", async () => {
    const on = vi.fn();
    const { el, svg } = mount({ defaultValue: FAN_COLOURS[4].value, onValueChange: on });
    await frame();
    // far out to the right of the fan: its last strip
    pe(svg, "pointerdown", 258, 60);
    expect(on).toHaveBeenLastCalledWith(FAN_COLOURS[7].value);
    pe(svg, "pointerup", 258, 60);
    // the rivet's head: the next strip round, wrapping to the first
    const head = [...el.querySelectorAll("path.k-line.edge")].pop()!;
    const [x0, y0, x1, y1] = nums(head.getAttribute("d")!);
    pe(svg, "pointerdown", (x0 + x1) / 2, (y0 + y1) / 2);
    expect(on).toHaveBeenLastCalledWith(FAN_COLOURS[0].value);
  });

  it("rebuilds when its options change", () => {
    const { el, c } = mount();
    c.update({ options: [{ value: "#000", label: "Black" }, { value: "#fff", label: "White" }, { value: "#f00", label: "Red" }], value: "#fff" });
    const radios = el.querySelectorAll<HTMLInputElement>("input[type=radio]");
    expect(radios.length).toBe(3);
    expect(radios[1].checked).toBe(true);
    expect(chips(el).length).toBe(3);
  });
});
