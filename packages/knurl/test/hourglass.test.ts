// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { hourglass } from "../src/controls/hourglass";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
const frame = () => new Promise((r) => setTimeout(r, 40));

describe("hourglass", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = hourglass(el, { finish: "solid", theme: "dark", value: 30 });
    expect(el.getAttribute("data-knurl")).toBe("hourglass");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    expect(el.getAttribute("data-knurl-finish")).toBe("line");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });

  it("puts back a role and label the host already had", () => {
    const el = host();
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", "Mine");
    const c = hourglass(el);
    expect(el.getAttribute("role")).toBe("progressbar");
    c.destroy();
    expect(el.getAttribute("role")).toBe("img");
    expect(el.getAttribute("aria-label")).toBe("Mine");
    expect(el.hasAttribute("aria-busy")).toBe(false);
  });

  it("is a determinate progressbar with a value", () => {
    const el = host();
    const c = hourglass(el, { value: 40, label: "Export" });
    expect(el.getAttribute("role")).toBe("progressbar");
    expect(el.getAttribute("aria-label")).toBe("Export");
    expect(el.getAttribute("aria-valuemin")).toBe("0");
    expect(el.getAttribute("aria-valuemax")).toBe("100");
    expect(el.getAttribute("aria-valuenow")).toBe("40");
    expect(el.hasAttribute("aria-busy")).toBe(false);
    c.update({ value: 0.25, max: 1 });
    expect(el.getAttribute("aria-valuemax")).toBe("1");
    expect(el.getAttribute("aria-valuenow")).toBe("0.25");
    c.update({ value: 140, max: undefined });
    expect(el.getAttribute("aria-valuenow")).toBe("100");
    expect(el.getAttribute("data-state")).toBe("done");
    c.destroy();
  });

  it("is an indeterminate, busy progressbar without a value, and says so when paused", () => {
    const el = host();
    const c = hourglass(el);
    expect(el.getAttribute("role")).toBe("progressbar");
    expect(el.getAttribute("aria-label")).toBe("Progress");
    expect(el.hasAttribute("aria-valuenow")).toBe(false);
    expect(el.getAttribute("aria-busy")).toBe("true");
    c.update({ running: false });
    expect(el.getAttribute("aria-busy")).toBe("false");
    c.update({ running: undefined, value: 10 });
    expect(el.getAttribute("aria-valuenow")).toBe("10");
    expect(el.hasAttribute("aria-busy")).toBe(false);
    c.update({ value: undefined });
    expect(el.hasAttribute("aria-valuenow")).toBe(false);
    expect(el.getAttribute("aria-busy")).toBe("true");
    c.destroy();
  });

  it("splits the sand by progress: more run at a higher value", async () => {
    const el = host();
    const c = hourglass(el, { value: 10 });
    const sand = () => [...el.querySelectorAll("path.k-dot.lo")].map((p) => (p.getAttribute("d") ?? "").length);
    await frame();
    const low = sand();
    c.update({ value: 90 });
    await new Promise((r) => setTimeout(r, 1500));
    const high = sand();
    expect(high).not.toEqual(low);
    // done: nothing left on top, and the stream stops
    c.update({ value: 100 });
    await new Promise((r) => setTimeout(r, 1500));
    expect(el.querySelector("path.k-line.accent.dash")!.getAttribute("d")).toBe("");
    c.destroy();
  });

  it("has no pointer behaviour of its own", () => {
    const el = host();
    const c = hourglass(el, { value: 50 });
    expect(el.hasAttribute("data-knurl-hit")).toBe(false);
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
    expect(el.getAttribute("aria-valuenow")).toBe("50");
    expect(el.querySelector("input,button")).toBeNull();
    c.destroy();
  });
});
