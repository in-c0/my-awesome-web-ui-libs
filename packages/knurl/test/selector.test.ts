// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { selector } from "../src/controls/selector";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };

describe("selector", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = selector(el, { finish: "solid", theme: "dark" });
    expect(el.getAttribute("data-knurl")).toBe("selector");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });
  it("is a radio group of native radios, one per position", () => {
    const el = host();
    selector(el, { label: "Oven mode" });
    const group = el.querySelector("[role=radiogroup]")!;
    expect(group.getAttribute("aria-label")).toBe("Oven mode");
    const radios = el.querySelectorAll<HTMLInputElement>("input[type=radio]");
    expect([...radios].map((r) => r.value)).toEqual(["OFF", "LOW", "MED", "HIGH"]);
    expect(radios[0].checked).toBe(true);
    expect(new Set([...radios].map((r) => r.name)).size).toBe(1);
  });
  it("turns to a chosen position and reports it", () => {
    const el = host(), on = vi.fn();
    selector(el, { options: ["A", "B", "C"], defaultValue: "B", onValueChange: on });
    const radios = el.querySelectorAll<HTMLInputElement>("input[type=radio]");
    expect(radios[1].checked).toBe(true);
    radios[2].click();
    expect(on).toHaveBeenLastCalledWith("C");
    expect(el.getAttribute("data-state")).toBe("C");
    expect(el.querySelector(".k-text.hi")!.textContent).toBe("C");
  });
  it("asks and waits when controlled", () => {
    const el = host(), on = vi.fn();
    const c = selector(el, { options: ["A", "B"], value: "A", controlled: true, onValueChange: on });
    const radios = el.querySelectorAll<HTMLInputElement>("input[type=radio]");
    radios[1].click();
    expect(on).toHaveBeenLastCalledWith("B");
    expect(el.getAttribute("data-state")).toBe("A");
    expect(radios[0].checked).toBe(true);
    c.update({ options: ["A", "B"], value: "B", controlled: true, onValueChange: on });
    expect(el.getAttribute("data-state")).toBe("B");
    expect(radios[1].checked).toBe(true);
  });
  it("rebuilds when its options change and submits under a name", () => {
    const el = host();
    const c = selector(el, { name: "range" });
    c.update({ name: "range", options: ["2V", "20V", "200V"], value: "20V" });
    const radios = el.querySelectorAll<HTMLInputElement>("input[type=radio]");
    expect(radios.length).toBe(3);
    expect(radios[1].checked).toBe(true);
    expect(radios[0].name).toBe("range");
  });
});
