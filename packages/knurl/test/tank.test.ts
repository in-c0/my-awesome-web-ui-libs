// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { tank } from "../src/controls/tank";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };

describe("tank", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = tank(el, { finish: "solid", theme: "dark", value: 40 });
    expect(el.getAttribute("data-knurl")).toBe("tank");
    expect(el.getAttribute("data-knurl-finish")).toBe("solid");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });

  it("is a meter by default with its aria values", () => {
    const el = host();
    tank(el, { value: 30, min: 0, max: 200, format: (v) => `${v} L` });
    expect(el.getAttribute("role")).toBe("meter");
    expect(el.getAttribute("aria-valuemin")).toBe("0");
    expect(el.getAttribute("aria-valuemax")).toBe("200");
    expect(el.getAttribute("aria-valuenow")).toBe("30");
    expect(el.getAttribute("aria-valuetext")).toBe("30 L");
    expect(el.getAttribute("aria-label")).toBe("Level");
  });

  it("follows a new value and role", () => {
    const el = host();
    const c = tank(el, { value: 20 });
    c.update({ value: 75, role: "progressbar", label: "Upload" });
    expect(el.getAttribute("role")).toBe("progressbar");
    expect(el.getAttribute("aria-valuenow")).toBe("75");
    expect(el.getAttribute("aria-label")).toBe("Upload");
  });

  it("marks the low and high thresholds on the scale", () => {
    const el = host();
    const c = tank(el, { value: 50 });
    const marks = () => el.querySelector("path.k-led.on")!.getAttribute("d") ?? "";
    expect(marks()).toBe("");
    c.update({ low: 10, high: 90 });
    expect(marks().match(/M/g)?.length).toBe(2);
  });

  it("leaves a host's own role alone", () => {
    const el = host();
    el.setAttribute("role", "img");
    tank(el, { value: 10 }).destroy();
    expect(el.getAttribute("role")).toBe("img");
  });
});
