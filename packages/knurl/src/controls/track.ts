import { camera, circle, cuboid, fit, flat, loft, planeMatrix, poly3, proj, rot, rrect, seg, slab, turn, type Vec3 } from "../core/iso";
import { spring, stepS } from "../core/motion";
import { define, emit, type BaseOptions } from "../core/control";
import { disposer, line, mk, register, shadow, solid, toView, type Solid } from "../core/stage";

/**
 * Track — step progress (a stepper), built as a narrow-gauge line on its bed.
 *
 * Two rails spiked to sleepers run on ballast past a row of station posts to
 * a buffer stop. Each post carries a signal lamp and a small name plate with
 * the step's legend engraved on it. A handcar rides the rails to the current
 * station on a calm spring, its wheels turning as it goes; stations it has
 * passed have their lamp on, the current one is lit with the accent, the
 * rest are dark.
 *
 * The host is a progressbar (step n of N), with a visually hidden ordered
 * list of the steps under it; when `clickable`, each reached step in the list
 * is a real `<button>`.
 */

export type TrackOptions = BaseOptions & {
  /** The stations, in order. Short legends (up to 6 characters) read best. Default ["Cart","Ship","Pay","Done"]. */
  steps?: string[];
  /** The current step's index, from 0. */
  current?: number;
  /** Called with a step's index when a reached station is pressed (only when `clickable`). */
  onStepChange?: (index: number) => void;
  /** Makes the passed and current stations buttons that call `onStepChange`. Default false. */
  clickable?: boolean;
};

const VW = 320, VH = 150;

export const track = define<TrackOptions>({
  id: "track",
  label: "Progress",
  vw: VW,
  vh: VH,
  width: 300,
  keys: ["steps", "current", "onStepChange", "clickable"],
  mount(ctx, o) {
    const { host, svg, doc } = ctx;
    const bag = disposer();
    let opts = o;
    const C = camera(30, 32);
    let P = proj(C);
    const g = mk("g", {}, svg);
    const list = doc.createElement("ol");
    list.setAttribute("data-knurl-sr", "");
    host.appendChild(list);

    const G = 3.2, BY = 9, BZ = 2.2, RZ0 = BZ + 0.9, RZ = RZ0 + 1.2; // half-gauge, bed half-width and height, rail foot and head
    const SY = -BY - 6; // station posts' line, behind the bed
    const PZ = 19, NZ = 11.4; // post height, name plate's foot
    type Station = { name: string; x: number; lamp: SVGPathElement; glow: SVGPathElement; plate: Solid; text: SVGTextElement };
    let stations: Station[] = [];
    let X0 = 0, X1 = 0, XS0 = 0, XS1 = 0;
    let carG: SVGGElement;
    let car: { deck: Solid; frame: Solid; wheels: Solid[]; spokes: SVGPathElement; post: Solid; beam: Solid; bars: Solid[]; handles: SVGPathElement; seats: SVGPathElement; lamp: SVGPathElement };

    const names = () => (Array.isArray(opts.steps) && opts.steps.length ? opts.steps.map(String) : ["Cart", "Ship", "Pay", "Done"]);
    const N = () => names().length;
    const cur = () => {
      const c = Math.round(typeof opts.current === "number" && Number.isFinite(opts.current) ? opts.current : 0);
      return Math.max(0, Math.min(N() - 1, c));
    };

    function build() {
      g.replaceChildren();
      const nm = names(), n = nm.length;
      const gap = Math.max(26, Math.min(40, 132 / Math.max(1, n - 1)));
      XS0 = -((n - 1) * gap) / 2; XS1 = -XS0;
      X0 = XS0 - 20; X1 = XS1 + 22;
      const ext: Vec3[] = [[X0, SY - 4, 0], [X1, BY, 0], [X0, BY, 0], [X1, SY - 4, 0], [X0, SY, PZ + 5], [X1, SY, PZ + 5]];
      fit(C, ext, VW / 2, VH / 2 + 2, VW - 18, VH - 16);
      P = proj(C);

      // the bed: a ballast shoulder, its top, scattered stones along the shoulder
      shadow(g, flat(P, rrect(X0, -BY + 3, X1, BY + 3, 3), 0));
      solid(g).put(loft(C, P, rrect(X0, -BY, X1, BY, 2.5), 0, BZ, rrect(X0 + 1.4, -BY + 1.4, X1 - 1.4, BY - 1.4, 1.6)));
      const stones: string[] = [];
      for (let x = X0 + 4, k = 0; x < X1 - 3; x += 3.1, k++) {
        const y = (k % 2 ? 1 : -1) * (BY - 2.6 + (k % 3) * 0.3);
        stones.push(seg(P(x, y, BZ), P(x + 0.8, y + 0.2, BZ)));
      }
      line(g, "lo").setAttribute("d", stones.join(""));

      // the station posts, behind the line: footing, post, lamp hood and lens, the name plate
      stations = nm.map((name, i) => {
        const x = XS0 + i * gap;
        solid(g).put(slab(C, P, x - 2.6, SY - 2.6, x + 2.6, SY + 2.6, 0.6, 0, 1.4));
        line(g, "edge").setAttribute("d", [[-1.6, -1.6], [1.6, 1.6], [-1.6, 1.6], [1.6, -1.6]].map(([dx, dy]) => seg(P(x + dx - 0.3, SY + dy, 1.4), P(x + dx + 0.3, SY + dy, 1.4))).join(""));
        solid(g).put(slab(C, P, x - 0.9, SY - 0.9, x + 0.9, SY + 0.9, 0.3, 1.4, PZ));
        // the name plate, on two stubs in front of the post
        const plate = solid(g);
        const pw = Math.max(5, Math.min(6, name.length) * 1.15 + 2.6);
        plate.put(slab(C, P, x - pw, SY + 1.2, x + pw, SY + 1.9, 0.2, NZ, NZ + 4.2));
        const text = mk("text", { class: "k-text", "text-anchor": "middle", transform: planeMatrix(P, [x, SY + 1.9, NZ + 2.1], [1, 0, 0], [0, 0, -1]) + " translate(0 1.2)" }, g) as SVGTextElement;
        text.style.fontSize = "3.4px";
        text.textContent = name.slice(0, 6);
        // the plate's two screws, into the post's stubs
        line(g, "edge").setAttribute("d", [1 - pw, pw - 1].map((dx) => seg(P(x + dx - 0.35, SY + 1.9, NZ + 3.1), P(x + dx + 0.35, SY + 1.9, NZ + 3.5))).join(""));
        // the lamp: a hood on the post's top, with the lens facing the line
        solid(g).put(slab(C, P, x - 2.2, SY - 1.6, x + 2.2, SY + 1.6, 0.8, PZ, PZ + 4.4));
        solid(g).put(slab(C, P, x - 2.6, SY - 2, x + 2.6, SY + 2.6, 0.6, PZ + 4.4, PZ + 5));
        const ring = circle(0, 0, 1.4, 20);
        const lens = (r: number) => "M" + ring.map((q) => P(x + q.u * r / 1.4, SY + 1.6, PZ + 2.2 + q.v * r / 1.4).map((v) => v.toFixed(2)).join(" ")).join("L") + "Z";
        const glow = mk("path", { class: "k-glow", d: lens(2.4) }, g);
        const lamp = mk("path", { class: "k-led", d: lens(1.4) }, g);
        return { name, x, lamp, glow, plate, text };
      });

      // the sleepers, then the rails on them, spiked at each sleeper; a buffer stop at the far end
      const sleepers: string[] = [];
      for (let x = X0 + 4; x <= X1 - 4; x += 4.6) {
        solid(g).put(slab(C, P, x - 1.3, -G - 2.8, x + 1.3, G + 2.8, 0.3, BZ, RZ0));
        for (const y of [-G, G]) for (const s of [-1, 1]) sleepers.push(seg(P(x - 0.5, y + s * 0.95, RZ0), P(x + 0.5, y + s * 0.95, RZ0)));
      }
      line(g, "edge").setAttribute("d", sleepers.join(""));
      for (const y of [-G, G]) {
        solid(g).put(slab(C, P, X0 + 2, y - 0.75, X1 - 5, y + 0.75, 0.2, RZ0, RZ0 + 0.4));
        solid(g).put(slab(C, P, X0 + 2, y - 0.4, X1 - 5, y + 0.4, 0.2, RZ0 + 0.4, RZ));
      }
      // rail joints with fishplates
      const joints: string[] = [];
      for (const x of [XS0 - 8, (XS0 + XS1) / 2, XS1 + 8]) for (const y of [-G, G]) joints.push(seg(P(x, y - 0.4, RZ), P(x, y + 0.4, RZ)));
      line(g, "lo").setAttribute("d", joints.join(""));
      // the buffer stop: two raked struts and a beam with two buffers facing the line
      const bx = X1 - 6.5;
      solid(g).put(slab(C, P, bx - 1, -G - 2.6, bx + 3, G + 2.6, 0.4, RZ0, RZ0 + 1.2));
      solid(g).put(slab(C, P, bx + 1.2, -G - 1.6, bx + 3.4, G + 1.6, 0.4, RZ0 + 1.2, RZ + 6.4));
      solid(g).put(slab(C, P, bx - 0.6, -G - 3.4, bx + 1.4, G + 3.4, 0.4, RZ + 3.4, RZ + 6.4));
      const buffers: string[] = [];
      for (const y of [-G - 1.6, G + 1.6]) buffers.push(seg(P(bx - 0.6, y, RZ + 4.9), P(bx - 2.2, y, RZ + 4.9)));
      line(g, "hi").setAttribute("d", buffers.join(""));
      const bufHeads: string[] = [];
      for (const y of [-G - 1.6, G + 1.6]) bufHeads.push(seg(P(bx - 2.2, y - 1, RZ + 4.9), P(bx - 2.2, y + 1, RZ + 4.9)));
      line(g, "hi").setAttribute("d", bufHeads.join(""));
      line(g, "lo").setAttribute("d", seg(P(bx - 0.6, -G - 2.6, RZ + 6.4), P(bx - 0.6, G + 2.6, RZ + 6.4)));

      // the handcar, nearer than the rails it sits on
      carG = mk("g", {}, g);
      const wheelsBack = mk("g", {}, carG);
      const frame = solid(carG);
      const deck = solid(carG), seats = line(carG, "lo");
      const post = solid(carG), beam = solid(carG), bars = [solid(carG), solid(carG)], handles = line(carG, "lo");
      const lamp = line(carG, "hi");
      const wheelsFront = mk("g", {}, carG);
      const wheels = [solid(wheelsBack), solid(wheelsBack), solid(wheelsFront), solid(wheelsFront)];
      const spokes = line(wheelsFront, "edge");
      car = { deck, frame, wheels, spokes, post, beam, bars, handles, seats, lamp };
      last = NaN;
    }

    let last = NaN;
    const R = 2.3; // wheel radius
    function drawCar(x: number) {
      if (x === last) return;
      last = x;
      const zW = RZ; // axle height above the rail head is R, so the wheel stands on the rail
      const z0 = RZ + R + 0.4, z1 = z0 + 1.1;
      const ax = [x - 3.8, x + 3.8];
      // back wheels (far rail), then front wheels (near rail)
      const wl = [[ax[0], -G], [ax[1], -G], [ax[0], G], [ax[1], G]] as const;
      wl.forEach(([wx, wy], i) => car.wheels[i].put(lyingWheel(wx, wy + (wy < 0 ? -0.2 : 0.2), zW)));
      const spin = -x / R, sp: string[] = [];
      for (const wx of ax) for (let k = 0; k < 3; k++) {
        const a = spin + (k * Math.PI) / 3, ca = Math.cos(a) * (R - 0.5), sa = Math.sin(a) * (R - 0.5);
        sp.push(seg(P(wx - ca, G + 0.75, zW + R - sa), P(wx + ca, G + 0.75, zW + R + sa)));
      }
      car.spokes.setAttribute("d", sp.join(""));
      car.frame.put(slab(C, P, x - 5.8, -G + 0.2, x + 5.8, G - 0.2, 0.4, RZ + R - 0.4, z0));
      car.deck.put(slab(C, P, x - 7, -G - 2, x + 7, G + 2, 0.8, z0, z1));
      // deck planks
      const planks: string[] = [];
      for (const dx of [-3.5, 0, 3.5]) planks.push(seg(P(x + dx, -G - 1.4, z1), P(x + dx, G + 1.4, z1)));
      car.seats.setAttribute("d", planks.join(""));
      // the pump: a post and a walking beam that rocks as the car is driven, a handle bar across each end
      const zp = z1 + 6;
      car.post.put(slab(C, P, x - 0.8, -0.8, x + 0.8, 0.8, 0.3, z1, zp));
      const tilt = Math.sin(-x / 5) * 0.32, R_ = rot("y", tilt);
      const bm = cuboid([x, 0, zp + 0.4], 5.2, 0.5, 0.4, R_);
      car.beam.put(poly3(C, P, bm.verts, bm.faces));
      const hs: string[] = [];
      [-5, 5].forEach((dx, i) => {
        const e = turn(R_, [dx, 0, 0]), c: Vec3 = [x + e[0], 0, zp + 0.4 + e[2]], hb = cuboid(c, 0.45, 2.9, 0.45, R_);
        car.bars[i].put(poly3(C, P, hb.verts, hb.faces));
        // the grips' wear bands
        for (const y of [-2, 2]) hs.push(seg(P(c[0] - 0.45, y, c[2] + 0.45), P(c[0] + 0.45, y, c[2] + 0.45)));
      });
      // the pivot pin through the beam
      const pin = P(x, 0.5, zp + 0.4);
      hs.push(seg([pin[0] - 0.5, pin[1]], [pin[0] + 0.5, pin[1]]));
      car.handles.setAttribute("d", hs.join(""));
      // the axle-box covers on the near side
      car.lamp.setAttribute("d", ax.map((wx) => seg(P(wx - 0.5, G + 0.75, RZ + R), P(wx + 0.5, G + 0.75, RZ + R))).join(""));
    }
    /** A wheel: a short cylinder lying across the line, its axle along y, standing on the rail head at z. */
    function lyingWheel(x: number, y: number, z: number) {
      const n = 24, verts: Vec3[] = [];
      for (const s of [-0.55, 0.55]) for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; verts.push([x + Math.cos(a) * R, y + s, z + R + Math.sin(a) * R]); }
      const faces: number[][] = [Array.from({ length: n }, (_, k) => k), Array.from({ length: n }, (_, k) => 2 * n - 1 - k)];
      for (let k = 0; k < n; k++) faces.push([k, n + k, n + (k + 1) % n, (k + 1) % n]);
      return poly3(C, P, verts, faces);
    }

    const xAt = (i: number) => stations[i]?.x ?? 0;
    const sp = spring(0, { k: 120, c: 22, eps: 0.02 });

    function sync() {
      const nm = names(), n = nm.length, c = cur();
      host.setAttribute("role", "progressbar");
      host.setAttribute("aria-label", opts.label ?? "Progress");
      host.setAttribute("aria-valuemin", "1");
      host.setAttribute("aria-valuemax", String(n));
      host.setAttribute("aria-valuenow", String(c + 1));
      host.setAttribute("aria-valuetext", `Step ${c + 1} of ${n}: ${nm[c]}`);
      list.replaceChildren();
      nm.forEach((name, i) => {
        const li = doc.createElement("li");
        if (i === c) li.setAttribute("aria-current", "step");
        if (opts.clickable && i <= c) {
          const b = doc.createElement("button");
          b.type = "button";
          b.textContent = name;
          b.disabled = !!opts.disabled;
          b.addEventListener("click", () => emit(opts.onStepChange, i));
          li.appendChild(b);
        } else li.textContent = name;
        list.appendChild(li);
      });
      if (opts.clickable) host.setAttribute("data-knurl-hit", ""); else host.removeAttribute("data-knurl-hit");
      stations.forEach((s, i) => {
        s.lamp.classList.toggle("on", i === c);
        s.lamp.setAttribute("class", i === c ? "k-led on" : i < c ? "k-dot" : "k-led");
        s.glow.classList.toggle("on", i === c);
        s.text.setAttribute("class", i <= c ? "k-text hi" : "k-text");
        s.plate.lit(i === c);
      });
    }

    build();
    sp.x = sp.t = xAt(cur());
    sync();
    const B = register(host, (dt) => {
      sp.t = xAt(cur());
      const m = stepS(sp, dt);
      drawCar(sp.x);
      return m;
    });
    bag.add(B.unregister);

    // pointer: a press on a reached station's post or plate, or the line beside it, picks it
    bag.on(host, "pointerdown", (e) => {
      if (opts.disabled || !opts.clickable || e.button !== 0) return;
      const [sx, sy] = toView(svg, e, VW, VH);
      const c = cur();
      let best = -1, bd = 1e9;
      stations.forEach((s, i) => {
        const a = P(s.x, SY, PZ + 5), b = P(s.x, 0, 0);
        const d = Math.abs(sx - (a[0] + b[0]) / 2) + (sy < a[1] - 4 || sy > b[1] + 6 ? 1e6 : 0);
        if (d < bd) { bd = d; best = i; }
      });
      if (best < 0 || best > c || bd > 14) return;
      (list.querySelectorAll("button")[best] as HTMLButtonElement | undefined)?.focus({ preventScroll: true });
      emit(opts.onStepChange, best);
      e.preventDefault();
    });

    bag.add(() => {
      list.remove();
      for (const n of ["role", "aria-label", "aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-valuetext", "data-knurl-hit"]) host.removeAttribute(n);
      svg.replaceChildren();
    });
    return {
      update(next, prev) {
        opts = next;
        if (JSON.stringify(next.steps) !== JSON.stringify(prev.steps)) { build(); sp.x = Math.max(XS0, Math.min(XS1, sp.x)); }
        sync();
        B.wake();
      },
      destroy: bag.dispose,
    };
  },
});
