// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { track } from "../src/controls/track";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };

describe("track", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = track(el, { finish: "solid", theme: "dark", clickable: true, current: 2 });
    expect(el.getAttribute("data-knurl")).toBe("track");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });
  it("is a progressbar of steps with an ordered list", () => {
    const el = host();
    const c = track(el, { current: 1 });
    expect(el.getAttribute("role")).toBe("progressbar");
    expect(el.getAttribute("aria-valuemin")).toBe("1");
    expect(el.getAttribute("aria-valuemax")).toBe("4");
    expect(el.getAttribute("aria-valuenow")).toBe("2");
    expect(el.getAttribute("aria-valuetext")).toBe("Step 2 of 4: Ship");
    const items = el.querySelectorAll("ol > li");
    expect([...items].map((li) => li.textContent)).toEqual(["Cart", "Ship", "Pay", "Done"]);
    expect(items[1].getAttribute("aria-current")).toBe("step");
    expect(el.querySelectorAll("button").length).toBe(0);
    c.update({ current: 3 });
    expect(el.getAttribute("aria-valuetext")).toBe("Step 4 of 4: Done");
    expect(el.querySelectorAll("ol > li")[3].getAttribute("aria-current")).toBe("step");
  });
  it("clamps current to the steps", () => {
    const el = host();
    track(el, { steps: ["A", "B"], current: 9 });
    expect(el.getAttribute("aria-valuenow")).toBe("2");
  });
  it("makes reached steps buttons when clickable", () => {
    const el = host(), on = vi.fn();
    const c = track(el, { steps: ["Plan", "Build", "Test"], current: 1, clickable: true, onStepChange: on });
    const buttons = el.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    buttons[0].click();
    expect(on).toHaveBeenLastCalledWith(0);
    c.update({ clickable: false });
    expect(el.querySelectorAll("button").length).toBe(0);
  });
});
