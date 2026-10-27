// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as K from "../src/index";
import { counter, fader, gauge, gears, keycap, knob, presets, toggle } from "../src/index";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };

describe("every control", () => {
  const all = Object.fromEntries(Object.entries(K).filter(([, v]) => typeof v === "function" && "keys" in v)) as Record<string, (el: HTMLElement, o?: any) => { update(o: any): void; destroy(): void }>;
  it("exports all eighteen", () => expect(Object.keys(all).length).toBe(18));
  for (const [id, mount] of Object.entries(all)) {
    it(`${id} mounts, draws and removes only what it added`, () => {
      const el = host();
      el.className = "mine";
      const c = mount(el, { finish: "solid", theme: "dark" });
      expect(el.getAttribute("data-knurl")).toBe(id);
      expect(el.getAttribute("data-knurl-finish")).toBe("solid");
      expect(el.getAttribute("data-knurl-theme")).toBe("dark");
      expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
      c.update({ finish: undefined });
      expect(el.getAttribute("data-knurl-finish")).toBe("line");
      c.destroy();
      c.destroy();
      expect(el.attributes.length).toBe(1);
      expect(el.className).toBe("mine");
      expect(el.childNodes.length).toBe(0);
    });
  }
});

describe("toggle", () => {
  it("toggles through its native switch and reports it", () => {
    const el = host(), on = vi.fn();
    toggle(el, { onCheckedChange: on });
    const input = el.querySelector("input")!;
    expect(input.getAttribute("role")).toBe("switch");
    input.click();
    expect(on).toHaveBeenLastCalledWith(true);
    expect(el.getAttribute("data-state")).toBe("on");
  });
  it("asks and waits when controlled", () => {
    const el = host(), on = vi.fn();
    const c = toggle(el, { checked: false, controlled: true, onCheckedChange: on });
    el.querySelector("input")!.click();
    expect(on).toHaveBeenLastCalledWith(true);
    expect(el.getAttribute("data-state")).toBe("off");
    c.update({ checked: true, controlled: true, onCheckedChange: on });
    expect(el.getAttribute("data-state")).toBe("on");
  });
});

describe("range controls", () => {
  it("fader snaps and clamps to its step and limits", () => {
    const el = host(), on = vi.fn();
    fader(el, { min: 0, max: 10, step: 0.5, defaultValue: 3.3, onValueChange: on });
    const input = el.querySelector("input")!;
    expect(input.value).toBe("3.5");
    input.value = "12"; input.dispatchEvent(new Event("input"));
    expect(on).toHaveBeenLastCalledWith(10);
  });
  it("knob carries aria-valuetext from format", () => {
    const el = host();
    knob(el, { value: 40, format: (v: number) => `${v} dB` });
    expect(el.querySelector("input")!.getAttribute("aria-valuetext")).toBe("40 dB");
  });
  it("counter keeps its minimum at zero or above", () => {
    const el = host();
    counter(el, { min: -5, value: -3 });
    expect(el.querySelector("input")!.value).toBe("0");
  });
});

describe("presets", () => {
  it("is a radio group of native radios", () => {
    const el = host(), on = vi.fn();
    presets(el, { options: ["FM", "AM"], defaultValue: "AM", onValueChange: on });
    const radios = el.querySelectorAll<HTMLInputElement>("input[type=radio]");
    expect(radios.length).toBe(2);
    expect(radios[1].checked).toBe(true);
    radios[0].click();
    expect(on).toHaveBeenLastCalledWith("FM");
  });
});

describe("status controls", () => {
  it("gauge sets progressbar values", () => {
    const el = host();
    const c = gauge(el, { value: 30 });
    expect(el.getAttribute("role")).toBe("progressbar");
    c.update({ value: 70, role: "meter" });
    expect(el.getAttribute("role")).toBe("meter");
    expect(el.getAttribute("aria-valuenow")).toBe("70");
  });
  it("gears is a status", () => {
    const el = host();
    gears(el, { spinning: false });
    expect(el.getAttribute("role")).toBe("status");
    expect(el.getAttribute("aria-busy")).toBe("false");
  });
  it("keycap presses on its button's click", () => {
    const el = host(), on = vi.fn();
    keycap(el, { legend: "A", onPress: on });
    el.querySelector("button")!.click();
    expect(on).toHaveBeenCalledTimes(1);
  });
});
