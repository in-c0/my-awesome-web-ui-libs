import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Auto } from "../auto";
import { Stamper } from "@in-c0/knurl/react";
import type { Finish } from "@in-c0/knurl";
import type { Doc, Prop } from "../data";

const Readout = ({ children }: { children: ReactNode }) => <output className="readout">{children}</output>;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shift = (v: string, days: number) => { const [y, m, d] = v.split("-").map(Number); return iso(new Date(y, m - 1, d + days)); };
const TODAY = iso(new Date());
// a date a few days to a few months away, so one band or several roll
const another = (v: string) => shift(v, [1, 3, 9, 32, 45, 400][Math.floor(Math.random() * 6)] * (Math.random() < 0.3 ? -1 : 1));

/**
 * The demo presses the stamp itself after each new date, the way a hand would: a touch on
 * the knob, held a moment. It does so only while nothing on the page has focus, and keeps
 * the focus the stamp takes from reaching the preview, so the demo neither steals focus
 * nor pauses itself.
 */
function useStamp(key: string, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const host = ref.current?.querySelector<HTMLElement>("[data-knurl=stamper]");
    if (!enabled || !host || (document.activeElement && document.activeElement !== document.body)) return;
    const stop = (e: Event) => e.stopPropagation();
    host.addEventListener("focusin", stop, true);
    host.addEventListener("focusout", stop, true);
    const r = host.getBoundingClientRect();
    const at = { clientX: r.left + r.width * 0.46, clientY: r.top + r.height * 0.1, button: 0, pointerId: 77, pointerType: "touch" };
    const t0 = setTimeout(() => host.dispatchEvent(new PointerEvent("pointerdown", at)), 380);
    const t1 = setTimeout(() => {
      host.dispatchEvent(new PointerEvent("pointerup", at));
      if (host.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      host.removeEventListener("focusin", stop, true);
      host.removeEventListener("focusout", stop, true);
    }, 560);
    return () => { clearTimeout(t0); clearTimeout(t1); host.removeEventListener("focusin", stop, true); host.removeEventListener("focusout", stop, true); };
  }, [key, enabled]);
  return ref;
}

type Rest = { min?: string; max?: string; onStamp?: (d: string) => void };

function StampRow({ v, set, user, finish, label, style, rest, children }: { v: string; set: (d: string) => void; user: { current: string | null }; finish: Finish; label: string; style?: CSSProperties; rest: Rest; children?: (v: string) => ReactNode }) {
  // only a date the demo set is stamped by the demo; one the visitor set waits for their press
  const ref = useStamp(v, user.current !== v);
  return (
    <div className="demo-row" ref={ref}>
      <Stamper finish={finish} label={label} value={v} onValueChange={(d) => { user.current = d; set(d); }} style={style} {...rest} />
      {children?.(v)}
    </div>
  );
}

/** A stamper whose date moves on every ~2 s and which stamps each new one. */
function AutoStamper({ finish, label, style, children, next = another, ...rest }: { finish: Finish; label: string; style?: CSSProperties; children?: (v: string) => ReactNode; next?: (v: string) => string } & Rest) {
  const user = useRef<string | null>(null);
  return <Auto init={TODAY} next={next} ms={2200}>{(v, set) => <StampRow v={v} set={set} user={user} finish={finish} label={label} style={style} rest={rest}>{children}</StampRow>}</Auto>;
}

function StamperReceived({ finish }: { finish: Finish }) {
  const [last, setLast] = useState("");
  return <AutoStamper finish={finish} label="Received on" onStamp={setLast}>{(v) => (
    <div className="demo-col" style={{ alignItems: "flex-start" }}>
      <Readout>Set to {v}</Readout>
      <Readout>{last ? `Stamped ${last}` : "Press the knob to stamp"}</Readout>
    </div>
  )}</AutoStamper>;
}

function StamperWindow({ finish }: { finish: Finish }) {
  const min = shift(TODAY, -7), max = shift(TODAY, 30);
  // a day somewhere inside the window, not the one set
  const inside = (v: string) => { let n = v; while (n === v) n = shift(min, Math.floor(Math.random() * 38)); return n; };
  return <AutoStamper finish={finish} label="Delivery date" min={min} max={max} next={inside}>{(v) => <Readout>Between {min} and {max}: {v}</Readout>}</AutoStamper>;
}

export function doc(meta: (id: string) => Pick<Doc, "id" | "name" | "role" | "summary" | "group">, base: (exclude?: string[]) => Prop[]): Doc {
  return {
    ...meta("stamper"),
    object: "A self-inking date stamp on a sheet of paper: two side plates on feet carry a bridge and an ink-pad cartridge, and inside them three rubber bands (day, month, year) run over knurled drive wheels on one axle, their faces turned up against the pad. A yoke on two guide posts with return springs holds the axle's ends in cam slots. Pressing the knob drives it down with weight; the bands swing over from the pad to the paper and print, the springs throw it back up, and the date is left on the paper in ink.",
    native: '<input type="date">',
    keys: [["Tab, ← →", "Move between day, month and year, as the platform's date field does"], ["↑ ↓", "Step the focused part"], ["Click a band", "Roll it on by one"], ["Scroll over a band", "Roll it either way"], ["Press anywhere else", "Stamp the date on the paper"]],
    examples: [
      { id: "default", title: "Default", text: "Starts today; each new date is stamped.", code: `<Stamper label="Date" />`, render: (f) => <AutoStamper finish={f} label="Date" /> },
      { id: "controlled", title: "Controlled, with onStamp", text: "The value is an ISO date string; onStamp fires each time it is printed.", code: `const [date, setDate] = useState("2026-10-30");\n\n<Stamper label="Received on" value={date} onValueChange={setDate}\n  onStamp={(d) => log(\`Received \${d}\`)} />`, render: (f) => <StamperReceived finish={f} /> },
      { id: "range", title: "Between two dates", text: "min and max hold the bands inside the window; a band that would roll out of it stops at the edge.", code: `<Stamper label="Delivery date" min="2026-10-23" max="2026-11-29"\n  value={date} onValueChange={setDate} />`, render: (f) => <StamperWindow finish={f} /> },
    ],
    props: [
      { name: "value", type: "string", desc: 'Controlled date, "YYYY-MM-DD". Pair with onValueChange.' },
      { name: "defaultValue", type: "string", def: "today", desc: "Starting date when uncontrolled." },
      { name: "min", type: "string", desc: 'Earliest date, "YYYY-MM-DD".' },
      { name: "max", type: "string", desc: 'Latest date, "YYYY-MM-DD".' },
      { name: "onValueChange", type: "(value: string) => void", desc: "Called with the new date, by band, wheel or keyboard." },
      { name: "onStamp", type: "(value: string) => void", desc: "Called with the date each time it is stamped on the paper." },
      ...base(),
    ],
  };
}

/** The gallery cell: a new date every ~2 s, rolled on the bands and stamped. */
export function Hero({ finish }: { finish: Finish }) {
  return <AutoStamper finish={finish} label="Date" style={{ width: 200 }} />;
}
