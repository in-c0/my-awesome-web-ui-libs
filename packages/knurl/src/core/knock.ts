import { spring, stepS } from "./motion";
import { register, type Disposer } from "./stage";

/**
 * A readout's answer to a finger: the whole instrument sinks into the page while it is
 * pressed and bounces back when it is let go, and it rises a hair under a hovering mouse.
 * The contact shadows stay on the bench, so the drop reads as a drop, and every outline
 * brightens while it is held.
 *
 * `group` is the instrument's root <g>; `depth` is how far it sinks, in viewBox units.
 * Calls `onKnock` on each press so the control can add its own reaction.
 */
export function knock(host: HTMLElement, group: SVGGElement, bag: Disposer, o: { depth?: number; onKnock?: (e: PointerEvent) => void; enabled?: () => boolean } = {}) {
  const depth = o.depth ?? 4;
  const push = spring(0, { k: 560, c: 15, eps: 0.004 }); // ζ ≈ 0.32: a clear bounce on the way back up
  let held = false, hover = false, last = NaN;
  const L = register(host, (dt) => {
    push.t = held ? 1 : hover ? -0.14 : 0;
    group.classList.toggle("k-knocked", held);
    const m = stepS(push, dt);
    if (push.x !== last) {
      last = push.x;
      const y = push.x * depth;
      group.setAttribute("transform", push.x === 0 ? "" : `translate(0 ${y.toFixed(3)})`);
      // the contact shadows stay on the bench
      for (const sh of group.querySelectorAll<SVGElement>(".k-shadow")) {
        sh.setAttribute("transform", push.x === 0 ? "" : `translate(0 ${(-y).toFixed(3)})`);
      }
    }
    return m;
  });
  bag.add(L.unregister);
  const ok = () => (o.enabled ? o.enabled() : true);
  bag.on(host, "pointerdown", (e) => {
    if (e.button !== 0 || !ok()) return;
    held = true;
    o.onKnock?.(e);
    L.wake();
  });
  const up = () => { if (held) { held = false; L.wake(); } };
  bag.on(host, "pointerup", up);
  bag.on(host, "pointercancel", up);
  bag.on(host, "pointerleave", () => { up(); if (hover) { hover = false; L.wake(); } });
  bag.on(host, "pointerenter", (e) => { if (e.pointerType === "mouse" && ok()) { hover = true; L.wake(); } });
  return { wake: L.wake };
}
