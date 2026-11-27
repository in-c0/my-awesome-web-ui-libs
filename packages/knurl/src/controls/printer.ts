import { camera, circle, cuboid, cyl, fit, flat, planeMatrix, poly, poly3, proj, rad, rrect, seg, slab, type Vec3 } from "../core/iso";
import { reducedMotion, tdone, tset, tval, tween } from "../core/motion";
import { define, keepAttrs, num, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid } from "../core/stage";

/**
 * Printer — a notification log, built as a receipt printer.
 *
 * A squat printer on rubber feet, with its roll cover, the paper exit and a
 * serrated tear bar, a FEED key, a power lamp and an activity lamp. Each new
 * message prints onto the strip as it feeds up out of the slot, so its lines
 * appear as they pass the print head; older tickets are pushed up, and past
 * `max` the oldest is torn off at its perforation and drifts away. A ticket
 * carries a tone mark (info, ok, warn, or an alert block in the accent), the
 * first few characters of the message, its number and a line or two of print.
 * The activity lamp is lit while the paper feeds. Several messages at once
 * print one after another.
 *
 * It is a readout: it has no click behaviour of its own. The host is a
 * `role="log"` with `aria-live="polite"`, and a visually hidden list holds
 * the full text of every ticket on the paper.
 */

export type PrinterTone = "info" | "ok" | "warn" | "alert";
export type PrinterMessage = { id: string; text: string; tone?: PrinterTone };

export type PrinterOptions = BaseOptions & {
  /** The messages, oldest first. The last `max` are on the paper; a new id prints a new ticket. */
  messages?: PrinterMessage[];
  /** How many tickets stay on the paper before the oldest is torn off, 1 to 6. Default 3. */
  max?: number;
};

const VW = 200, VH = 230;
const TH = 14;     // a ticket's length along the paper
const LEAD = 3;    // blank paper between the newest ticket and the slot
const FEED = 620;  // ms to feed one ticket
const GAP = 140;   // ms between tickets when several print in a row
const TEAR = 560;  // ms a torn ticket takes to drift away
const TILT = rad(9); // the paper leans back a little as it leaves the slot
const TONES: readonly PrinterTone[] = ["info", "ok", "warn", "alert"];
let uid = 0;

export const printer = define<PrinterOptions>({
  id: "printer",
  label: "Notifications",
  vw: VW,
  vh: VH,
  width: 170,
  keys: ["messages", "max"],
  mount(ctx, o) {
    const { host, svg, doc } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(26, 26);
    let P = proj(C);
    const id = "knurl-printer-" + ++uid;
    const defs = mk("defs", {}, svg);
    const g = mk("g", {}, svg);

    // semantics: a polite log, and the list of what is on the paper
    bag.add(keepAttrs(host, ["role", "aria-live", "aria-label"]));
    const list = doc.createElement("ul");
    list.setAttribute("data-knurl-sr", "");
    host.appendChild(list);

    const BX = 26, BY = 16, FZ = 2, ZT = FZ + 16, SY = 5, PW = 40;
    const st = Math.sin(TILT), ct = Math.cos(TILT);
    const U: Vec3 = [1, 0, 0], V: Vec3 = [0, st, -ct]; // across the paper, and down it
    /** The paper's frame at height h above the slot: its top-left corner, across, down. */
    const frame = (h: number, turn = 0, pivot: [number, number] = [PW, TH]) => {
      const o: Vec3 = [-PW / 2, SY - h * st, ZT + h * ct];
      if (!turn) return planeMatrix(P, o, U, V);
      // turned in the paper's plane about a point of the ticket (its lower corner, where the tear ends)
      const c = Math.cos(turn), s = Math.sin(turn);
      const u: Vec3 = [U[0] * c + V[0] * s, U[1] * c + V[1] * s, U[2] * c + V[2] * s];
      const v: Vec3 = [V[0] * c - U[0] * s, V[1] * c - U[1] * s, V[2] * c - U[2] * s];
      const w: Vec3 = [o[0] + pivot[0] * U[0] + pivot[1] * V[0], o[1] + pivot[0] * U[1] + pivot[1] * V[1], o[2] + pivot[0] * U[2] + pivot[1] * V[2]];
      return planeMatrix(P, [w[0] - pivot[0] * u[0] - pivot[1] * v[0], w[1] - pivot[0] * u[1] - pivot[1] * v[1], w[2] - pivot[0] * u[2] - pivot[1] * v[2]], u, v);
    };

    type Ticket = { m: PrinterMessage; serial: number; g: SVGGElement; top: SVGPathElement; key: string };
    type Torn = { t: Ticket; h: number; t0: number };
    let live: Ticket[] = [];   // on the paper, oldest first
    let torn: Torn[] = [];     // drifting away
    let queue: PrinterMessage[] = [];
    let wanted = new Set<string>();
    const items = new Map<string, HTMLLIElement>();
    let printed = 0, nextAt = 0, serial = 0;
    const feed = tween(LEAD, FEED);
    let paper: SVGGElement, blank: SVGGElement, blankTop: SVGPathElement, lamp: SVGPathElement, glow: SVGPathElement;

    const max = () => Math.max(1, Math.min(6, Math.round(num(opts.max, 3))));
    const messages = (): PrinterMessage[] =>
      (Array.isArray(opts.messages) ? opts.messages : []).map((m, i) => ({ id: String(m?.id ?? i), text: String(m?.text ?? ""), tone: TONES.includes(m?.tone as PrinterTone) ? m.tone : "info" }));

    const zig = (w: number) => {
      let d = "M0 0";
      for (let x = 1; x <= w; x += 1) d += `L${x} ${x % 2 ? -0.55 : 0}`;
      return d;
    };
    const sideEdges = `M0 0L0 ${TH}M${PW} 0L${PW} ${TH}`;

    function build() {
      g.replaceChildren();
      defs.replaceChildren();
      const top = (max() + 0.4) * TH + LEAD;
      const ext: Vec3[] = [[-BX, -BY, 0], [BX, BY, 0], [-BX, BY, 0], [BX, -BY, 0], [-PW / 2, SY - top * st, ZT + top * ct], [PW / 2, SY - top * st, ZT + top * ct]];
      fit(C, ext, VW / 2, VH / 2 + 4, VW - 18, VH - 16);
      P = proj(C);

      // four rubber feet, then the body with its rounded corners
      shadow(g, flat(P, rrect(-BX, -BY + 3, BX, BY + 3, 4), 0));
      for (const [x, y] of [[-BX + 5, -BY + 4], [BX - 5, -BY + 4], [-BX + 5, BY - 4], [BX - 5, BY - 4]]) solid(g).put(cyl(C, P, x, y, 2.6, 0, FZ, 20));
      solid(g).put(slab(C, P, -BX, -BY, BX, BY, 4, FZ, ZT));
      // the roll cover's seam and its two hinge knuckles at the back, the cover-open key beside the slot
      line(g, "lo").setAttribute("d", flat(P, rrect(-BX + 2.2, -BY + 2.2, BX - 2.2, SY - 2.6, 2.4), ZT));
      for (const x of [-BX + 8, BX - 8]) solid(g).put(slab(C, P, x - 3, -BY + 0.6, x + 3, -BY + 2.4, 0.6, ZT, ZT + 0.6));
      line(g, "lo").setAttribute("d", seg(P(-BX + 2.2, SY + 3.4, ZT), P(BX - 2.2, SY + 3.4, ZT)));
      // the vents on the near side
      const vents: string[] = [];
      for (let k = 0; k < 6; k++) {
        const y = -BY + 6 + k * 2.6;
        vents.push(poly([P(BX, y, ZT - 5), P(BX, y + 1.1, ZT - 5), P(BX, y + 1.1, ZT - 11), P(BX, y, ZT - 11)]));
      }
      mk("path", { class: "k-slot", d: vents.join("") }, g);
      // the front: a seam round the bezel, the power and activity lamps, the FEED key
      line(g, "lo").setAttribute("d", poly([P(-BX + 3, BY, ZT - 2), P(BX - 3, BY, ZT - 2), P(BX - 3, BY, FZ + 2), P(-BX + 3, BY, FZ + 2)]));
      const front = (x: number, z: number, r: number) => poly(circle(0, 0, r, 18).map((q) => P(x + q.u, BY, z + q.v)));
      mk("path", { class: "k-dot", d: front(-BX + 7, ZT - 6, 0.8) }, g);
      glow = mk("path", { class: "k-glow", d: front(-BX + 11, ZT - 6, 2.2) }, g);
      lamp = mk("path", { class: "k-led", d: front(-BX + 11, ZT - 6, 0.9) }, g);
      const legend = (s: string, x: number, z: number, size: number) => {
        const t = mk("text", { class: "k-text", "text-anchor": "middle" }, g) as SVGTextElement;
        t.textContent = s;
        t.style.fontSize = size + "px";
        t.setAttribute("transform", planeMatrix(P, [x, BY, z], [1, 0, 0], [0, 0, -1]));
      };
      legend("PWR", -BX + 7, ZT - 8.6, 1.7);
      legend("PRT", -BX + 11, ZT - 8.6, 1.7);
      const key = cuboid([BX - 9, BY + 0.5, ZT - 7], 3.6, 0.5, 1.9);
      solid(g).put(poly3(C, P, key.verts, key.faces));
      legend("FEED", BX - 9, ZT - 3.4, 2);
      // the paper exit, cut across the top
      mk("path", { class: "k-slot", d: flat(P, rrect(-PW / 2 - 2, SY - 0.9, PW / 2 + 2, SY + 0.9, 0.6), ZT) }, g);

      // the paper: everything above the slot, clipped at the slot's line
      const a = P(-BX * 3, SY, ZT), b = P(BX * 3, SY, ZT);
      const clip = mk("clipPath", { id }, defs);
      mk("path", { d: poly([a, b, [b[0], b[1] - 600], [a[0], a[1] - 600]]) }, clip);
      paper = mk("g", { "clip-path": `url(#${id})` }, g);
      blank = mk("g", {}, paper);
      mk("path", { class: "k-face", d: `M0 0H${PW}V${TH * 2}H0Z`, style: "stroke:none" }, blank);
      line(blank, "edge").setAttribute("d", `M0 0L0 ${TH * 2}M${PW} 0L${PW} ${TH * 2}`);
      blankTop = line(blank, "edge");
      for (const t of live) paper.insertBefore(t.g, blank);
      for (const x of torn) x.t.g.remove();
      torn = [];

      // the tear bar in front of the paper, its teeth along its back edge
      const tb = cuboid([0, SY + 1.5, ZT + 0.35], PW / 2 + 2.6, 0.7, 0.35);
      solid(g).put(poly3(C, P, tb.verts, tb.faces));
      const teeth: string[] = [];
      for (let k = 0; k <= 30; k++) {
        const x = -PW / 2 - 1 + ((PW + 2) * k) / 30;
        teeth.push(`${k ? "L" : "M"}${P(x, SY + 0.8 - (k % 2 ? 0.5 : 0), ZT + 0.7).map((n) => n.toFixed(2)).join(" ")}`);
      }
      line(g, "edge").setAttribute("d", teeth.join(""));
      const screws: string[] = [];
      for (const x of [-PW / 2 - 1.6, PW / 2 + 1.6]) {
        solid(g).put(cyl(C, P, x, SY + 1.5, 0.55, ZT + 0.7, ZT + 0.95, 12));
        screws.push(seg(P(x - 0.4, SY + 1.5, ZT + 0.95), P(x + 0.4, SY + 1.5, ZT + 0.95)));
      }
      line(g, "lo").setAttribute("d", screws.join(""));
    }

    /** A ticket's drawing in the paper's own frame (x across, y down, in world units). */
    function ticket(m: PrinterMessage, n: number): Ticket {
      const tg = mk("g", {}) as SVGGElement;
      mk("path", { class: "k-face", d: `M0 0H${PW}V${TH}H0Z`, style: "stroke:none" }, tg);
      line(tg, "edge").setAttribute("d", sideEdges);
      const top = line(tg, "mid dash");
      top.setAttribute("d", `M0 0H${PW}`);
      // the tone mark
      const mark = mk("g", { transform: "translate(4.2 4.6)" }, tg);
      if (m.tone === "alert") {
        mk("path", { class: "k-led on", d: "M-1.7 -1.7H1.7V1.7H-1.7Z" }, mark);
      } else if (m.tone === "warn") {
        line(mark, "hi").setAttribute("d", "M0 -1.8L1.9 1.5H-1.9Z" + "M0 -0.5V0.5");
      } else if (m.tone === "ok") {
        line(mark, "hi").setAttribute("d", "M-1.5 0L-0.4 1.2L1.6 -1.2");
      } else {
        line(mark, "hi").setAttribute("d", poly(circle(0, 0, 1.7, 16).map((q) => [q.u, q.v])) + "M0 -0.2V1");
      }
      // the first characters of the message, its number, and the lines of print below
      const head = mk("text", { class: "k-text hi" }, tg) as SVGTextElement;
      const word = m.text.trim().slice(0, 11);
      head.textContent = word.length < m.text.trim().length ? word.replace(/\s+\S*$/, "") || word : word;
      head.style.fontSize = "2.5px";
      head.setAttribute("x", "7.8"); head.setAttribute("y", "5.5");
      const no = mk("text", { class: "k-text", "text-anchor": "end" }, tg) as SVGTextElement;
      no.textContent = "#" + String(n).padStart(3, "0");
      no.style.fontSize = "2px";
      no.setAttribute("x", String(PW - 2.4)); no.setAttribute("y", "5.4");
      const len = m.text.length;
      const l1 = Math.min(PW - 5, 10 + (len * 1.3) % 24), l2 = Math.min(PW - 14, 6 + (len * 2.1) % 17);
      line(tg, "mid").setAttribute("d", `M2.6 9H${2.6 + l1}` + (len > 14 ? `M2.6 11.2H${2.6 + l2}` : ""));
      return { m, serial: printed, g: tg, top, key: m.text + "|" + m.tone };
    }

    const tear = (t: Ticket, now: number) => {
      live = live.filter((x) => x !== t);
      if (reducedMotion()) { t.g.remove(); return; }
      torn.push({ t, h: tval(feed, now) - t.serial * TH, t0: now });
    };
    const start = (m: PrinterMessage, now: number) => {
      const t = ticket(m, ++serial);
      printed++;
      live.push(t);
      paper.insertBefore(t.g, blank);
      tset(feed, printed * TH + LEAD, now, 0);
      nextAt = now + FEED + GAP;
      // the paper past max is torn off as the new ticket pushes it up
      while (live.length > max()) tear(live[0], now);
    };

    /** Puts the paper where the feed has it at `now`; returns whether it is still feeding. */
    function place(now: number) {
      const f = tval(feed, now);
      live.forEach((t, i) => {
        t.g.setAttribute("transform", frame(f - t.serial * TH));
        t.top.setAttribute("class", i === 0 ? "k-line edge" : "k-line mid dash");
        t.top.setAttribute("d", i === 0 ? zig(PW) : `M0 0H${PW}`);
      });
      blank.setAttribute("transform", frame(f - printed * TH));
      blankTop.setAttribute("d", live.length ? "" : zig(PW));
      torn = torn.filter((x) => {
        const p = (now - x.t0) / TEAR;
        if (p >= 1) { x.t.g.remove(); return false; }
        const e = 1 - (1 - p) * (1 - p);
        x.t.g.setAttribute("transform", frame(x.h + e * TH * 0.9, -rad(9) * e));
        x.t.g.style.opacity = String(Math.round((1 - p) * 1000) / 1000);
        return true;
      });
      const busy = !tdone(feed, now);
      lamp.classList.toggle("on", busy);
      glow.classList.toggle("on", busy);
      return busy;
    }

    build();
    const B = register(host, (_dt, now) => {
      if (queue.length && now >= nextAt && tdone(feed, now)) start(queue.shift()!, now);
      if (!queue.length && tdone(feed, now)) {
        // whatever is no longer among the messages goes, and the paper above it with it
        const k = live.map((t) => wanted.has(t.m.id)).lastIndexOf(false);
        for (const t of live.slice(0, k + 1)) tear(t, now);
      }
      const busy = place(now);
      return busy || queue.length > 0 || torn.length > 0;
    });
    bag.add(B.unregister);

    // the messages as they stand: the first set comes up already printed; later ones print in turn
    function take(first: boolean) {
      const all = messages(), keep = all.slice(-max());
      wanted = new Set(keep.map((m) => m.id));
      const known = new Set([...live.map((t) => t.m.id), ...queue.map((m) => m.id)]);
      // a ticket whose text changed is reprinted in place
      for (const t of live) {
        const m = keep.find((x) => x.id === t.m.id);
        if (m && m.text + "|" + m.tone !== t.key) {
          const fresh = ticket(m, t.serial + 1);
          fresh.serial = t.serial;
          t.g.replaceWith(fresh.g);
          Object.assign(t, fresh);
        }
      }
      const fresh = keep.filter((m) => !known.has(m.id));
      queue = queue.filter((m) => wanted.has(m.id));
      if (first) {
        for (const m of fresh) {
          const t = ticket(m, ++serial);
          printed++;
          live.push(t); paper.insertBefore(t.g, blank);
        }
        feed.from = feed.to = printed * TH + LEAD;
      } else queue.push(...fresh);
      // the list says at once what the paper will show: new items are appended and dropped ones removed, so nothing is announced twice
      for (const [k, li] of items) if (!wanted.has(k)) { li.remove(); items.delete(k); }
      for (const m of keep) {
        let li = items.get(m.id);
        if (!li) { li = doc.createElement("li"); items.set(m.id, li); list.appendChild(li); }
        const text = m.tone && m.tone !== "info" ? `${m.tone === "ok" ? "OK" : m.tone === "warn" ? "Warning" : "Alert"}: ${m.text}` : m.text;
        if (li.textContent !== text) li.textContent = text;
      }
      host.setAttribute("role", "log");
      host.setAttribute("aria-live", "polite");
      host.setAttribute("aria-label", opts.label ?? "Notifications");
    }
    take(true);
    place(performance.now());
    B.wake();

    bag.add(() => { list.remove(); svg.replaceChildren(); });
    return {
      update(next, prev) {
        opts = next;
        if (max() !== Math.max(1, Math.min(6, Math.round(num(prev.max, 3))))) build();
        take(false);
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
