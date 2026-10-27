import { camera, cuboid, cyl, fit, flat, hull, lighting, planeMatrix, poly, poly3, prism3, proj, rad, rot, rrect, seg, slab, toViewer, SHADES, type Camera, type Projector, type Rot, type Vec2, type Vec3 } from "../core/iso";
import { reducedMotion, spring, stepS, type Spring } from "../core/motion";
import { define, emit, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, type Solid } from "../core/stage";

/**
 * Tray — a file drop zone, built as a desk letter tray.
 *
 * A shallow tray of acrylic panels on four rubber feet, its front panel cut
 * low with a finger notch so the stack shows through. Each file dropped in
 * adds a sheet that falls into the tray on a spring, turning a little as it
 * lands; the stack grows to ten sheets and then only shifts. Every sheet
 * carries its file's type on its corner. While a drag hovers over it the rim
 * lights and a ghost sheet hangs over the stack where the next will land; a
 * file it can't take makes the tray shake its head.
 *
 * Semantics come from a visually hidden `<input type="file">`, opened by a
 * visually hidden "Choose files" `<button>`, and a polite live region.
 */

export type TrayOptions = BaseOptions & {
  /** File types to take, as `<input accept>`: ".pdf,.png" or "image/*". Default: anything. */
  accept?: string;
  /** Takes several files at once. Default true. */
  multiple?: boolean;
  /** How many files are in the tray, when the app keeps the count; left out, the tray counts what it takes. */
  count?: number;
  /** Called with the accepted files from a drop or the picker. */
  onFiles?: (files: File[]) => void;
  /** Called with the files that didn't match `accept` or were larger than `maxSize`. */
  onReject?: (files: File[]) => void;
  /** The largest file to take, in bytes. */
  maxSize?: number;
};

const VW = 220, VH = 180;
const STACK = 10;

/** Whether a file matches an `accept` list. */
export function accepts(file: File, accept: string | undefined): boolean {
  const list = (accept ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return true;
  const name = (file.name || "").toLowerCase(), type = (file.type || "").toLowerCase();
  return list.some((a) => a.startsWith(".") ? name.endsWith(a) : a.endsWith("/*") ? type.startsWith(a.slice(0, -1)) : type === a);
}

/** A file's type legend: its extension in capitals, at most four letters. */
const legendOf = (f: File) => {
  const m = /\.([a-z0-9]{1,8})$/i.exec(f.name || "");
  return m ? m[1].slice(0, 4).toUpperCase() : "";
};

/** Repeatable noise in [0, 1) for sheet n. */
const rnd = (n: number, k: number) => { const x = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

/** Orients a screen polygon so it winds positively: overlapping pieces then fill as one under nonzero. */
function wind(pts: Vec2[]): Vec2[] {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a < 0 ? pts.slice().reverse() : pts;
}

/**
 * A panel cut to any outline (concave too), standing in the x–z plane and
 * extruded from y0 back to y1 forward: the front panel with its finger notch.
 * `prof` is (x, z), counter-clockwise.
 */
function panel(parent: Element, C: Camera, P: Projector, prof: readonly Vec2[], y0: number, y1: number) {
  const V = toViewer(C), light = lighting(C), n = prof.length;
  const g = mk("g", { class: "k-solid" }, parent);
  const fill = mk("path", { class: "k-fill" }, g);
  const sh = [0, 1, 2, 3].map((i) => mk("path", { class: "k-shade", "data-s": i }, g));
  const top = mk("path", { class: "k-top" }, g);
  const edge = mk("path", { class: "k-edge" }, g);
  const pieces: string[] = [], buckets: string[][] = Array.from({ length: SHADES }, () => []), tops: string[] = [], edges: string[] = [];
  const at = (p: Vec2, y: number) => P(p[0], y, p[1]);
  const vis: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const a = prof[i], b = prof[(i + 1) % n];
    let nx = b[1] - a[1], nz = -(b[0] - a[0]);
    const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
    vis[i] = nx * V[0] + nz * V[2] > 1e-6;
    if (!vis[i]) continue;
    const q = wind([at(a, y1), at(b, y1), at(b, y0), at(a, y0)]), d = poly(q);
    pieces.push(d);
    if (nz > 0.6) tops.push(d); else buckets[Math.min(SHADES - 1, Math.floor(light(Math.sign(nx) || 1, 0) * SHADES))].push(d);
    edges.push(seg(at(a, y0), at(b, y0)));
  }
  for (let i = 0; i < n; i++) if (vis[i] !== vis[(i + n - 1) % n]) edges.push(seg(at(prof[i], y1), at(prof[i], y0)));
  const front = poly(wind(prof.map((p) => at(p, y1))));
  buckets[Math.min(SHADES - 1, Math.floor(light(0, 1) * SHADES))].push(front);
  fill.setAttribute("d", pieces.join("") + front);
  sh.forEach((p, i) => p.setAttribute("d", buckets[i].join("")));
  top.setAttribute("d", tops.join(""));
  edge.setAttribute("d", edges.join("") + front);
  return { g, lit(on: boolean) { g.classList.toggle("k-lit", on); } };
}

type Sheet = {
  ord: number;
  legend: string;
  z: Spring;
  /** When it starts to fall, in ms of the loop's clock (a drop of several files staggers them). */
  t0: number;
  g: SVGGElement;
  body: Solid;
  print: SVGGElement;
  text: SVGTextElement;
  key: string;
};

export const tray = define<TrayOptions>({
  id: "tray",
  label: "Choose files",
  vw: VW,
  vh: VH,
  width: 200,
  keys: ["accept", "multiple", "count", "onFiles", "onReject", "maxSize"],
  mount(ctx, o) {
    const { host, svg, doc } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(34, 32);

    const TX = 13, TY = 17, WT = 1.1; // outer half-size and panel thickness
    const Z0 = 1.4, FZ = 2.4; // panels' foot (over the feet) and the floor
    const HB = FZ + 7.4, HF = FZ + 4.4; // side panels' height at the back and the front
    const SX = 10.2, SY = 14.4, TH = 0.38; // a sheet's half-size and thickness
    const ZG = FZ + STACK * TH + 9; // the ghost's height over the floor
    const ext: Vec3[] = [[-TX, -TY, 0], [TX, TY, 0], [-TX, TY, 0], [TX, -TY, 0], [-TX, -TY, HB + 1], [TX, -TY, HB + 1], [-SX, -SY, ZG + 2], [SX, -SY, ZG + 2]];
    fit(C, ext, VW / 2, VH / 2, VW - 16, VH - 14);
    const P = proj(C);
    const root = mk("g", {}, svg);
    const g = mk("g", {}, root);

    // feet, floor, the back panel and the left side
    shadow(g, flat(P, rrect(-TX, -TY + 3, TX, TY + 3, 2), 0));
    for (const [x, y] of [[-TX + 3, -TY + 3], [TX - 3, -TY + 3], [-TX + 3, TY - 3], [TX - 3, TY - 3]]) {
      solid(g).put(cyl(C, P, x, y, 1.7, 0, Z0, 20));
    }
    solid(g).put(slab(C, P, -TX + WT - 0.2, -TY + WT - 0.2, TX - WT + 0.2, TY - WT + 0.2, 0.6, Z0, FZ));
    const backPanel = solid(g);
    backPanel.put(slab(C, P, -TX + WT, -TY, TX - WT, -TY + WT, 0, Z0, HB - 0.6));
    // a side panel: its profile in (y, z), sloping from the tall back to the low front, turned so its thickness runs along x
    const sideRing: Vec2[] = [[-TY, Z0], [TY, Z0], [TY, HF], [TY - 1.2, HF + 0.45], [-TY + 2.4, HB], [-TY, HB]];
    const SIDE: Rot = [[0, 1, 0], [0, 0, 1], [1, 0, 0]];
    const side = (x: number) => { const s = prism3([x, 0, 0], sideRing, WT / 2, SIDE); return poly3(C, P, s.verts, s.faces); };
    const leftPanel = solid(g);
    leftPanel.put(side(-TX + WT / 2));
    // the pegs a second tray stacks on, at the back corners
    const peg = (x: number) => { solid(g).put(cyl(C, P, x, -TY + 2, 0.75, HB, HB + 1.1, 16)); };
    peg(-TX + WT / 2);

    // the floor: two runners keep the paper off the bottom
    const runners = line(g, "lo");
    runners.setAttribute("d", [-5, 5].map((x) => seg(P(x, -TY + WT + 1.6, FZ), P(x, TY - WT - 1.6, FZ))).join(""));

    // the stack, built from the bottom up
    const stackG = mk("g", {}, g);
    // where the next sheet will land, while a drag is over
    const land = mk("path", { class: "k-line edge dash" }, g);
    let sheets: Sheet[] = [];
    let ords = 0;

    // the front panel, cut low with a finger notch, then the right side; sheets still in the air go over both
    const RN = 4.6, NZ = HF - 2.2, notch: Vec2[] = [];
    for (let k = 0; k <= 16; k++) { const a = -(k / 16) * Math.PI; notch.push([Math.cos(a) * RN, HF + (Math.sin(a) * (HF - NZ) * RN) / RN]); }
    const front = panel(g, C, P, [[-TX + WT, Z0], [TX - WT, Z0], [TX - WT, HF], ...notch, [-TX + WT, HF]], TY - WT, TY);
    // a countersunk screw head on a face, with its slot
    const screw = (c: Vec3, u: Vec3, v: Vec3) => {
      const sg = mk("g", { transform: planeMatrix(P, c, u, v) }, g);
      mk("circle", { class: "k-face", r: 0.62 }, sg);
      mk("path", { class: "k-line edge", d: "M-0.4 0.18L0.4 -0.18" }, sg);
    };
    // the front panel's joint screws
    for (const x of [-TX + WT + 0.9, TX - WT - 0.9]) screw([x, TY, (Z0 + HF) / 2], [1, 0, 0], [0, 0, -1]);
    const midG = mk("g", {}, g);
    const rightPanel = solid(g);
    rightPanel.put(side(TX - WT / 2));
    peg(TX - WT / 2);
    // the right panel's outside: a joint screw at each end and the maker's moulded mark
    {
      const s = (y: number, z: number) => P(TX, y, z);
      for (const [y, z] of [[TY - 1.6, (Z0 + HF) / 2], [-TY + 1.6, (Z0 + HB) / 2 + 1]]) screw([TX, y, z], [0, -1, 0], [0, 0, -1]);
      line(g, "lo").setAttribute("d", poly(([[TY - 11, Z0 + 1.2], [TY - 4.2, Z0 + 1.2], [TY - 4.2, Z0 + 3], [TY - 11, Z0 + 3]] as Vec2[]).map(([y, z]) => s(y, z))));
    }

    const airG = mk("g", {}, g);
    const ghost = mk("g", { class: "k-ghost" }, g);
    const ghostBody = mk("path", { class: "k-fill" }, ghost);
    const ghostEdge = mk("path", { class: "k-line hi dash" }, ghost);
    const ghostFold = mk("path", { class: "k-line edge" }, ghost);
    ghost.style.opacity = "0";

    // a sheet: a thin slab, turned a little, with a header, lines of text and its file type printed on it
    const turnOf = (ord: number) => rad((rnd(ord, 1) - 0.5) * 5.5);
    const offOf = (ord: number): Vec2 => [(rnd(ord, 2) - 0.5) * 1.4, (rnd(ord, 3) - 0.5) * 1.1];
    function makeSheet(ord: number, legend: string, z: number, t0: number): Sheet {
      const sg = mk("g", {}, stackG);
      const body = solid(sg);
      const print = mk("g", {}, sg);
      const lines: string[] = ["M3 3.4H8.4", "M3 5.2H6.6", "M3 7.8H17.4"];
      for (let k = 0; k < 8; k++) {
        const w = 14.6 - rnd(ord * 7 + k, 4) * 6 * (k % 4 === 3 ? 1.6 : 0.5);
        lines.push(`M3 ${(10 + k * 2.1).toFixed(2)}H${(3 + w).toFixed(2)}`);
      }
      mk("path", { class: "k-line lo", d: lines.join("") }, print);
      // the file type, stamped in a box in the top corner
      const w = 1.2 + legend.length * 1.5;
      if (legend) mk("path", { class: "k-line edge", d: `M${17.6 - w} 2.1H17.6V5.5H${17.6 - w}Z` }, print);
      const text = mk("text", { class: "k-text hi", x: 17.6 - w / 2, y: 4.62, "text-anchor": "middle" }, print) as SVGTextElement;
      text.style.fontSize = "2.4px";
      text.textContent = legend;
      return { ord, legend, z: spring(z, { k: 150, c: 22, eps: 0.004 }), t0, g: sg, body, print, text, key: "" };
    }

    function drawSheet(s: Sheet, rest: number) {
      const air = Math.max(0, s.z.x - rest);
      const a = turnOf(s.ord) + air * 0.022 * (rnd(s.ord, 5) > 0.5 ? 1 : -1);
      const [ox, oy] = offOf(s.ord), cx = ox + air * 0.08, cy = oy - air * 0.05, zt = s.z.x + TH;
      const key = [a, cx, cy, zt].map((n) => n.toFixed(3)).join();
      if (key === s.key) return;
      s.key = key;
      const b = cuboid([cx, cy, s.z.x + TH / 2], SX, SY, TH / 2, rot("z", a));
      s.body.put(poly3(C, P, b.verts, b.faces));
      const ca = Math.cos(a), sa = Math.sin(a);
      const o: Vec3 = [cx - SX * ca + SY * sa, cy - SX * sa - SY * ca, zt];
      s.print.setAttribute("transform", planeMatrix(P, o, [ca, sa, 0], [-sa, ca, 0]));
    }

    // state
    const input = doc.createElement("input");
    input.type = "file";
    input.setAttribute("data-knurl-sr", "");
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    host.appendChild(input);
    const button = doc.createElement("button");
    button.type = "button";
    button.setAttribute("data-knurl-sr", "");
    button.textContent = "Choose files";
    host.appendChild(button);
    const live = doc.createElement("div");
    live.setAttribute("data-knurl-sr", "");
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    host.appendChild(live);
    host.setAttribute("data-knurl-hit", "");

    let own = 0; // the count when the app doesn't keep it
    const countOf = () => (typeof opts.count === "number" && Number.isFinite(opts.count) ? Math.max(0, Math.floor(opts.count)) : own);
    let pending: string[] = []; // legends for sheets the app is about to count in
    let depthN = 0, over = false;
    const hov = spring(0, { k: 200, c: 26, eps: 0.004 });
    const wob = spring(0, { k: 700, c: 9, eps: 0.004 });

    const restOf = (i: number) => FZ + i * TH;
    /** Brings the sheets in line with the count: new ones fall in from above, staggered; gone ones lift off the top. */
    function settle(now: number, fall = true) {
      const n = countOf();
      let last = ords;
      if (n > ords) {
        const add = n - ords;
        for (let k = 0; k < add; k++) {
          const ord = ++last;
          if (ord <= n - STACK) continue; // under the visible ten: never seen
          const legend = pending.length ? pending.shift()! : "";
          const shown = Math.min(sheets.length, STACK);
          sheets.push(fall ? makeSheet(ord, legend, restOf(shown) + 16 + k * 1.5, now + Math.min(k, 6) * 110) : makeSheet(ord, legend, 0, -1e9));
        }
      } else if (n < ords) {
        sheets = sheets.filter((s) => { if (s.ord > n) { s.g.remove(); return false; } return true; });
        // bring back sheets that were under the visible ten
        const low = Math.max(1, n - STACK + 1), have = new Set(sheets.map((s) => s.ord));
        const back: Sheet[] = [];
        for (let ord = low; ord <= n; ord++) if (!have.has(ord)) back.push(makeSheet(ord, "", 0, -1e9));
        if (back.length) { sheets = back.concat(sheets); for (const s of sheets) stackG.appendChild(s.g); }
      }
      ords = n;
      pending = [];
      // keep the top ten
      while (sheets.length > STACK) sheets.shift()!.g.remove();
      // sheets that were already there sit at rest now, drawn without waiting for a frame (the tray may be offscreen)
      sheets.forEach((s, i) => { s.z.t = restOf(i); if (s.t0 < -1e8 && !s.key) { s.z.x = restOf(i); drawSheet(s, restOf(i)); } });
    }

    const wx = P(1, 0, 0), w0 = P(0, 0, 0), foot = P(0, TY, 0), WX: Vec2 = [wx[0] - w0[0], wx[1] - w0[1]];
    let lastWob = NaN, lit = false;
    const B = register(host, (dt, now) => {
      let moving = false;
      sheets.forEach((s, i) => {
        if (now < s.t0) { s.g.style.display = "none"; moving = true; return; }
        s.g.style.display = "";
        const rest = restOf(i);
        if (stepS(s.z, dt)) moving = true;
        // over the front panel's top it is in front of that panel; over the back's, in front of the sides too
        const parent = s.z.x > HB + 0.3 ? airG : s.z.x > HF + 0.3 ? midG : stackG;
        if (s.g.parentNode !== parent) parent.appendChild(s.g);
        drawSheet(s, rest);
      });
      // the ghost over the stack, and a dashed outline where it will land
      hov.t = over ? 1 : 0;
      if (stepS(hov, dt)) moving = true;
      const top = restOf(Math.min(sheets.length, STACK));
      if (hov.x > 0.002) {
        const bob = over && !reducedMotion() ? Math.sin(now / 420) * 0.5 : 0;
        if (over && !reducedMotion()) moving = true;
        const z = top + 4 + 3.5 * hov.x + bob, a = rad(-2);
        const b = cuboid([0, 0, z], SX, SY, TH / 2, rot("z", a));
        const pts = b.verts.slice(4).map((v) => P(v[0], v[1], v[2]));
        ghostEdge.setAttribute("d", poly(pts));
        const lid = b.verts.slice(0, 4).map((v) => P(v[0], v[1], v[2]));
        ghostBody.setAttribute("d", poly(hull(pts.concat(lid))));
        ghostFold.setAttribute("d", seg(lid[1], pts[1]) + seg(lid[2], pts[2]) + seg(lid[3], pts[3]));
        land.setAttribute("d", flat(P, rrect(-SX, -SY, SX, SY, 0.2), top));
        ghost.style.opacity = hov.x.toFixed(3);
        land.style.opacity = hov.x.toFixed(3);
      } else if (ghost.style.opacity !== "0") { ghost.style.opacity = "0"; land.setAttribute("d", ""); }
      if (lit !== over) { lit = over; for (const s of [backPanel, leftPanel, rightPanel, front]) s.lit(over); }
      // a head-shake along the tray's width
      if (stepS(wob, dt)) moving = true;
      if (wob.x !== lastWob) {
        lastWob = wob.x;
        // slides along its width and rocks a little on its feet
        root.setAttribute("transform", wob.x === 0 ? "" : `translate(${(WX[0] * wob.x).toFixed(2)} ${(WX[1] * wob.x).toFixed(2)}) rotate(${(wob.x * 0.9).toFixed(2)} ${foot[0].toFixed(2)} ${foot[1].toFixed(2)})`);
      }
      return moving;
    });
    bag.add(B.unregister);
    settle(performance.now(), false);
    B.wake();

    const sync = () => {
      input.accept = opts.accept ?? "";
      input.multiple = opts.multiple !== false;
      input.disabled = button.disabled = !!opts.disabled;
      if (opts.name) input.name = opts.name; else input.removeAttribute("name");
      button.setAttribute("aria-label", opts.label ?? "Choose files");
      host.setAttribute("data-state", over ? "over" : "idle");
    };
    sync();

    const say = (text: string) => { live.textContent = ""; setTimeout(() => { live.textContent = text; }, 30); };
    const plural = (n: number) => (n === 1 ? "1 file" : `${n} files`);
    function take(list: ArrayLike<File> | null | undefined) {
      const files = Array.from(list ?? []);
      if (!files.length || opts.disabled) return;
      const ok: File[] = [], bad: File[] = [];
      for (const f of files) {
        const fits = accepts(f, opts.accept) && !(typeof opts.maxSize === "number" && f.size > opts.maxSize);
        (fits && (opts.multiple !== false || !ok.length) ? ok : bad).push(f);
      }
      if (ok.length) {
        pending = pending.concat(ok.map(legendOf));
        if (typeof opts.count !== "number") { own += ok.length; settle(performance.now()); }
        emit(opts.onFiles, ok);
      }
      if (bad.length) { wob.v = 60; emit(opts.onReject, bad); }
      say(ok.length && bad.length ? `${plural(ok.length)} added, ${bad.length} not accepted` : ok.length ? `${plural(ok.length)} added` : `${plural(bad.length)} not accepted`);
      B.wake();
    }

    const hover = (on: boolean) => { if (over === on) return; over = on; sync(); B.wake(); };
    bag.on(host, "dragenter", (e) => { if (opts.disabled) return; e.preventDefault(); depthN++; hover(true); });
    bag.on(host, "dragover", (e) => {
      if (opts.disabled) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      hover(true);
    });
    bag.on(host, "dragleave", () => { depthN = Math.max(0, depthN - 1); if (!depthN) hover(false); });
    bag.on(host, "drop", (e) => {
      e.preventDefault();
      depthN = 0; hover(false);
      take(e.dataTransfer?.files);
    });
    bag.on(input, "change", () => {
      take(input.files);
      if (!opts.name) input.value = "";
    });
    const pick = () => { if (!opts.disabled) input.click(); };
    bag.on(button, "click", pick);
    bag.on(host, "pointerdown", (e) => { if (opts.disabled || e.button !== 0) return; button.focus({ preventScroll: true }); });
    bag.on(host, "click", (e) => { if (e.target === input || e.target === button) return; pick(); });

    bag.add(() => {
      input.remove(); button.remove(); live.remove();
      host.removeAttribute("data-knurl-hit"); host.removeAttribute("data-state");
      svg.replaceChildren();
    });
    return {
      update(next) {
        const before = countOf();
        opts = next;
        sync();
        if (countOf() !== before || countOf() !== ords) settle(performance.now());
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
