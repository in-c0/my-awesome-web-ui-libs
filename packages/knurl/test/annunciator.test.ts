// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { annunciator } from "../src/controls/annunciator";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
const items = [
  { id: "api", label: "API", state: "ok" as const },
  { id: "db", label: "DB", state: "ok" as const },
  { id: "q", label: "QUEUE", state: "off" as const },
];

describe("annunciator", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = annunciator(el, { finish: "solid", theme: "dark" });
    expect(el.getAttribute("data-knurl")).toBe("annunciator");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });
  it("is a labelled group with a list of its lamps", () => {
    const el = host();
    annunciator(el, { items, label: "Services" });
    expect(el.getAttribute("role")).toBe("group");
    expect(el.getAttribute("aria-label")).toBe("Services");
    const li = [...el.querySelectorAll("ul > li")].map((n) => n.textContent);
    expect(li).toEqual(["API: ok", "DB: ok", "QUEUE: off"]);
    expect(el.querySelectorAll("svg text").length).toBe(4); // three legends and TEST
  });
  it("defaults to four sample lamps", () => {
    const el = host();
    annunciator(el);
    expect(el.querySelectorAll("ul > li").length).toBe(4);
  });
  it("announces a lamp that turns warn or alert", () => {
    const el = host();
    const c = annunciator(el, { items });
    const live = el.querySelector("[aria-live=polite]")!;
    expect(live.textContent).toBe("");
    c.update({ items: items.map((it) => (it.id === "db" ? { ...it, state: "alert" as const } : it)) });
    expect(live.textContent).toBe("DB: alert");
    expect(el.querySelectorAll("ul > li")[1].textContent).toBe("DB: alert");
    c.update({ items: items.map((it) => (it.id === "db" ? { ...it, state: "ok" as const } : it)) });
    expect(live.textContent).toBe("DB: alert");
  });
  it("runs a lamp test from its native button", () => {
    const el = host(), on = vi.fn();
    annunciator(el, { items, onTest: on });
    const b = el.querySelector("button")!;
    expect(b.type).toBe("button");
    b.click();
    expect(on).toHaveBeenCalledTimes(1);
    expect(el.querySelectorAll("svg .k-led.on").length).toBe(3);
  });
});
