// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { tray } from "../src/controls/tray";

beforeAll(() => {
  // jsdom has no layout or animation frames: enough of both for a mount
  (globalThis as any).requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

const host = () => { const el = document.createElement("div"); document.body.appendChild(el); return el; };
const file = (name: string, type: string, size = 5) => new File(["x".repeat(size)], name, { type });

/** jsdom has no DataTransfer: a plain Event carrying one with `files` stands in for a drag event. */
function drag(el: Element, type: string, files: File[] = []) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "dataTransfer", { value: { files, dropEffect: "none", types: ["Files"] } });
  el.dispatchEvent(e);
  return e;
}

describe("tray", () => {
  it("mounts, draws and removes only what it added", () => {
    const el = host();
    el.className = "mine";
    const c = tray(el, { finish: "solid", theme: "dark", count: 3 });
    expect(el.getAttribute("data-knurl")).toBe("tray");
    expect(el.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThan(20);
    drag(el, "dragenter");
    c.destroy();
    c.destroy();
    expect(el.attributes.length).toBe(1);
    expect(el.className).toBe("mine");
    expect(el.childNodes.length).toBe(0);
  });

  it("has a native file input, a Choose files button and a polite live region", () => {
    const el = host();
    tray(el, { accept: ".pdf", multiple: false, name: "attachments" });
    const input = el.querySelector<HTMLInputElement>("input[type=file]")!;
    expect(input.accept).toBe(".pdf");
    expect(input.multiple).toBe(false);
    expect(input.name).toBe("attachments");
    const button = el.querySelector("button")!;
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("Choose files");
    expect(el.querySelector("[aria-live=polite]")).not.toBeNull();
  });

  it("opens the picker from its button", () => {
    const el = host();
    tray(el, {});
    const input = el.querySelector<HTMLInputElement>("input[type=file]")!;
    const open = vi.spyOn(input, "click");
    el.querySelector("button")!.click();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("lights on a drag over it and takes a drop", async () => {
    const el = host(), on = vi.fn();
    tray(el, { onFiles: on });
    expect(drag(el, "dragenter").defaultPrevented).toBe(true);
    expect(drag(el, "dragover").defaultPrevented).toBe(true);
    expect(el.getAttribute("data-state")).toBe("over");
    const files = [file("brief.pdf", "application/pdf"), file("plan.png", "image/png")];
    expect(drag(el, "drop", files).defaultPrevented).toBe(true);
    expect(el.getAttribute("data-state")).toBe("idle");
    expect(on).toHaveBeenCalledWith(files);
    await new Promise((r) => setTimeout(r, 60));
    expect(el.querySelector("[aria-live]")!.textContent).toBe("2 files added");
    // the top sheet carries the last file's type
    expect([...el.querySelectorAll("text")].map((t) => t.textContent)).toContain("PNG");
  });

  it("sorts a drop by accept and maxSize", () => {
    const el = host(), ok = vi.fn(), bad = vi.fn();
    tray(el, { accept: ".pdf,image/*", maxSize: 100, onFiles: ok, onReject: bad });
    const pdf = file("a.pdf", "application/pdf"), jpg = file("b.jpg", "image/jpeg"), txt = file("c.txt", "text/plain"), big = file("d.pdf", "application/pdf", 500);
    drag(el, "drop", [pdf, txt, jpg, big]);
    expect(ok).toHaveBeenCalledWith([pdf, jpg]);
    expect(bad).toHaveBeenCalledWith([txt, big]);
  });

  it("takes one file when multiple is false", () => {
    const el = host(), ok = vi.fn(), bad = vi.fn();
    tray(el, { multiple: false, onFiles: ok, onReject: bad });
    const a = file("a.pdf", "application/pdf"), b = file("b.pdf", "application/pdf");
    drag(el, "drop", [a, b]);
    expect(ok).toHaveBeenCalledWith([a]);
    expect(bad).toHaveBeenCalledWith([b]);
  });

  it("goes back to idle when the drag leaves", () => {
    const el = host();
    tray(el, {});
    drag(el, "dragenter"); drag(el, "dragenter"); drag(el, "dragleave");
    expect(el.getAttribute("data-state")).toBe("over");
    drag(el, "dragleave");
    expect(el.getAttribute("data-state")).toBe("idle");
  });

  it("shows the app's count when given one, at most ten sheets", () => {
    const el = host(), on = vi.fn();
    const c = tray(el, { count: 2, onFiles: on });
    const sheets = () => el.querySelectorAll("svg text").length;
    expect(sheets()).toBe(2);
    drag(el, "drop", [file("x.pdf", "application/pdf")]);
    expect(on).toHaveBeenCalledTimes(1);
    expect(sheets()).toBe(2); // controlled: waits for the app
    c.update({ count: 3, onFiles: on });
    expect(sheets()).toBe(3);
    c.update({ count: 25, onFiles: on });
    expect(sheets()).toBe(10);
    c.update({ count: 0, onFiles: on });
    expect(sheets()).toBe(0);
  });
});
