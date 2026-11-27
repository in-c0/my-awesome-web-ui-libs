// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { timer, timeText } from "../src/controls/timer";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); vi.useRealTimers(); });

const live: { destroy(): void }[] = [];
const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
// every control is destroyed after its test, so the shared frame loop starts afresh under each test's clock
const mount: typeof timer = ((el: HTMLElement, o?: object) => { const c = timer(el, o as never); live.push(c); return c; }) as typeof timer;

describe("timer", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = mount(el, { finish: "solid", theme: "dark", value: 600 });
    expect(el.getAttribute("data-knurl")).toBe("timer");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.update({ finish: undefined });
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });

  it("is a timer with a native slider in whole minutes", () => {
    const el = host();
    mount(el, { label: "Proofing", defaultValue: 750, running: false });
    const input = el.querySelector("input")!;
    expect(el.getAttribute("role")).toBe("timer");
    expect(input.type).toBe("range");
    expect([input.min, input.max, input.step]).toEqual(["0", "3600", "60"]);
    expect(input.getAttribute("aria-label")).toBe("Proofing");
    expect(input.getAttribute("aria-valuetext")).toBe("12 minutes 30 seconds");
    expect(el.getAttribute("data-state")).toBe("paused");
  });

  it("winds from its input in minutes and reports it", () => {
    const el = host(), on = vi.fn();
    mount(el, { running: false, onValueChange: on });
    const input = el.querySelector("input")!;
    input.value = "300"; input.dispatchEvent(new Event("input"));
    expect(on).toHaveBeenLastCalledWith(300);
    expect(input.getAttribute("aria-valuetext")).toBe("5 minutes");
  });

  it("counts down each whole second and calls onDone once", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance", "Date"] });
    const el = host(), on = vi.fn(), done = vi.fn();
    mount(el, { defaultValue: 3, onValueChange: on, onDone: done });
    expect(el.getAttribute("data-state")).toBe("running");
    vi.advanceTimersByTime(1050);
    expect(on).toHaveBeenLastCalledWith(2);
    vi.advanceTimersByTime(2100);
    expect(on.mock.calls.map((c) => c[0])).toEqual([2, 1, 0]);
    expect(done).toHaveBeenCalledTimes(1);
    expect(el.getAttribute("data-state")).toBe("done");
    vi.advanceTimersByTime(4000);
    expect(done).toHaveBeenCalledTimes(1);
    expect(el.getAttribute("data-state")).toBe("idle");
  });

  it("asks and waits when controlled, and keeps time from its value", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance", "Date"] });
    const el = host(), on = vi.fn();
    const c = mount(el, { value: 120, controlled: true, onValueChange: on });
    const input = el.querySelector("input")!;
    input.value = "600"; input.dispatchEvent(new Event("input"));
    expect(on).toHaveBeenLastCalledWith(600);
    expect(input.value).toBe("120");
    vi.advanceTimersByTime(1050);
    expect(on).toHaveBeenLastCalledWith(119);
    // the parent echoes the tick back: the clock keeps running
    c.update({ value: 119, controlled: true, onValueChange: on });
    vi.advanceTimersByTime(1000);
    expect(on).toHaveBeenLastCalledWith(118);
    // a value from elsewhere rewinds it
    c.update({ value: 600, controlled: true, onValueChange: on });
    expect(input.value).toBe("600");
  });

  it("holds still when not running", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance", "Date"] });
    const el = host(), on = vi.fn();
    const c = mount(el, { defaultValue: 60, running: false, onValueChange: on });
    vi.advanceTimersByTime(3000);
    expect(on).not.toHaveBeenCalled();
    c.update({ running: true });
    vi.advanceTimersByTime(1050);
    expect(on).toHaveBeenLastCalledWith(59);
  });

  it("words the time", () => {
    expect(timeText(750)).toBe("12 minutes 30 seconds");
    expect(timeText(60)).toBe("1 minute");
    expect(timeText(1)).toBe("1 second");
    expect(timeText(0)).toBe("0 seconds");
  });
});
