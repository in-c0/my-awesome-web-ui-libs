// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { printer, type PrinterMessage } from "../src/controls/printer";

beforeAll(() => {
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  // reduced motion: a feed lands at once, so each queued ticket prints a frame after the last
  (globalThis as any).matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
});
const live: { destroy(): void }[] = [];
afterEach(() => { live.splice(0).forEach((c) => c.destroy()); });

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
const mount = (el: HTMLElement, o: Parameters<typeof printer>[1] = {}) => { const c = printer(el, o); live.push(c); return c; };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const items = (el: HTMLElement) => [...el.querySelectorAll("li")].map((l) => l.textContent);
const msg = (id: string, text: string, tone?: PrinterMessage["tone"]): PrinterMessage => ({ id, text, tone });
const tickets = (el: HTMLElement) => el.querySelectorAll("svg g[clip-path] > g").length - 1; // less the blank lead

describe("printer", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = printer(el, { finish: "solid", theme: "dark", messages: [msg("a", "Saved")] });
    expect(el.getAttribute("data-knurl")).toBe("printer");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });

  it("draws a whole printer with no messages", () => {
    const el = host();
    mount(el);
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    expect(items(el)).toEqual([]);
  });

  it("is a polite log holding the full text of each ticket", () => {
    const el = host();
    mount(el, { label: "Build log", messages: [msg("a", "Build passed on main", "ok"), msg("b", "Disk 82% full", "warn"), msg("c", "Queue drained")] });
    expect(el.getAttribute("role")).toBe("log");
    expect(el.getAttribute("aria-live")).toBe("polite");
    expect(el.getAttribute("aria-label")).toBe("Build log");
    expect(items(el)).toEqual(["OK: Build passed on main", "Warning: Disk 82% full", "Queue drained"]);
    expect(tickets(el)).toBe(3);
  });

  it("prints new messages and drops the oldest past max", async () => {
    const el = host();
    const first = [msg("a", "One"), msg("b", "Two")];
    const c = mount(el, { max: 2, messages: first });
    c.update({ max: 2, messages: [...first, msg("c", "Three", "alert")] });
    expect(items(el)).toEqual(["Two", "Alert: Three"]);
    await wait(60);
    expect(tickets(el)).toBe(2);
    // several at once print in turn; only the last max stay
    c.update({ max: 2, messages: [...first, msg("c", "Three", "alert"), msg("d", "Four"), msg("e", "Five"), msg("f", "Six")] });
    expect(items(el)).toEqual(["Five", "Six"]);
    await wait(400);
    expect(tickets(el)).toBe(2);
    expect(items(el)).toEqual(["Five", "Six"]);
  });

  it("tears off a ticket whose message is gone", async () => {
    const el = host();
    const c = mount(el, { messages: [msg("a", "One"), msg("b", "Two")] });
    c.update({ messages: [] });
    await wait(60);
    expect(items(el)).toEqual([]);
    expect(tickets(el)).toBe(0);
  });

  it("has no click behaviour of its own and restores the host's own role", () => {
    const el = host();
    el.setAttribute("role", "region");
    const c = printer(el, { messages: [msg("a", "One")] });
    expect(el.hasAttribute("data-knurl-hit")).toBe(false);
    const before = el.innerHTML;
    el.querySelector("svg")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(el.innerHTML).toBe(before);
    c.destroy();
    expect(el.getAttribute("role")).toBe("region");
  });
});
