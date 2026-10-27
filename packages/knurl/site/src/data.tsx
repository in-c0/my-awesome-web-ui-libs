import { useEffect, useRef, useState, type ReactNode } from "react";
import { Annunciator, Caliper, Combo, Counter, Fader, Gauge, Gears, Joystick, Keycap, Knob, Presets, Rocker, Selector, Tank, Timer, Toggle, Track, Tray } from "knurl-ui/react";
import { newDocs } from "./data-new";
import type { Finish } from "knurl-ui";
import { CONTROLS } from "../../registry/controls.mjs";

export const SITE = (import.meta.env.VITE_SITE_URL as string | undefined) ?? "https://in-c0.github.io/knurl";
export const REPO = "https://github.com/in-c0/knurl";
export const NPM = "https://www.npmjs.com/package/knurl-ui";

export type Prop = { name: string; type: string; def?: string; desc: string };
export type Example = { id: string; title: string; text: string; code: string; render: (f: Finish) => ReactNode };
export type Doc = {
  id: string; name: string; role: string; summary: string; group: "Inputs" | "Choices" | "Readouts";
  object: string; // what the object is, in one sentence
  keys: [string, string][];
  examples: Example[];
  props: Prop[];
  native: string;
};

const BASE: Prop[] = [
  { name: "finish", type: '"line" | "solid"', def: '"line"', desc: "Hairlines on plates, or shaded sides with lit lids and a contact shadow." },
  { name: "theme", type: '"auto" | "light" | "dark"', def: '"auto"', desc: "auto follows .dark / data-theme on an ancestor, then color-scheme." },
  { name: "label", type: "string", desc: "The accessible name. Each control has an English default." },
  { name: "disabled", type: "boolean", def: "false", desc: "Dims the control and stops input." },
  { name: "name", type: "string", desc: "Form field name: the value submits with the surrounding <form>." },
];
const RANGE: Prop[] = [
  { name: "value", type: "number", desc: "Controlled value. Pair with onValueChange." },
  { name: "defaultValue", type: "number", def: "min", desc: "Starting value when uncontrolled." },
  { name: "min", type: "number", def: "0", desc: "Lowest value." },
  { name: "max", type: "number", def: "100", desc: "Highest value." },
  { name: "step", type: "number", def: "1", desc: "Values snap to min + k·step. 0 is continuous." },
  { name: "onValueChange", type: "(value: number) => void", desc: "Every change, from pointer, wheel or keys." },
  { name: "onValueCommit", type: "(value: number) => void", desc: "Once, when a drag or key press settles." },
  { name: "format", type: "(value: number) => string", desc: "Sets aria-valuetext, e.g. v => `${v} dB`." },
];

const Readout = ({ children }: { children: ReactNode }) => <output className="readout">{children}</output>;

function ToggleControlled({ finish }: { finish: Finish }) {
  const [on, setOn] = useState(true);
  return <div className="demo-row"><Toggle finish={finish} label="Wi-Fi" checked={on} onCheckedChange={setOn} /><Readout>Wi-Fi {on ? "on" : "off"}</Readout></div>;
}
function FaderSteps({ finish }: { finish: Finish }) {
  const [v, setV] = useState(7);
  return <div className="demo-col"><Fader finish={finish} label="Brightness" min={0} max={10} step={1} value={v} onValueChange={setV} /><Readout>{v} / 10</Readout></div>;
}
function FaderDb({ finish }: { finish: Finish }) {
  const [v, setV] = useState(-12);
  return <div className="demo-col"><Fader finish={finish} label="Channel 1" min={-60} max={6} step={0.5} value={v} onValueChange={setV} format={(x) => `${x} dB`} /><Readout>{v > 0 ? "+" : ""}{v.toFixed(1)} dB</Readout></div>;
}
function KnobCutoff({ finish }: { finish: Finish }) {
  const [v, setV] = useState(55);
  const hz = Math.round(20 * Math.pow(1000, v / 100));
  return <div className="demo-row"><Knob finish={finish} label="Cutoff" value={v} onValueChange={setV} format={() => `${hz} Hz`} /><Readout>Cutoff {hz >= 1000 ? (hz / 1000).toFixed(1) + " kHz" : hz + " Hz"}</Readout></div>;
}
function KeyCount({ finish }: { finish: Finish }) {
  const [n, setN] = useState(0);
  return <div className="demo-row"><Keycap finish={finish} legend="Enter" units={2.25} onPress={() => setN((x) => x + 1)} style={{ width: 170 }} /><Readout>Pressed {n}×</Readout></div>;
}
function KeyChord({ finish }: { finish: Finish }) {
  return <div className="demo-row tight"><Keycap finish={finish} legend="⌘" label="Command" style={{ width: 96 }} /><Keycap finish={finish} legend="C" label="C" style={{ width: 96 }} /></div>;
}
function PresetsBand({ finish }: { finish: Finish }) {
  const [v, setV] = useState("FM");
  const f: Record<string, string> = { FM: "87.5–108 MHz", AM: "530–1700 kHz", LW: "153–279 kHz" };
  return <div className="demo-col"><Presets finish={finish} label="Band" options={["FM", "AM", "LW"]} value={v} onValueChange={setV} /><Readout>{v} · {f[v]}</Readout></div>;
}
function CounterOdo({ finish }: { finish: Finish }) {
  const [v, setV] = useState(1287);
  return <div className="demo-col"><Counter finish={finish} label="Trip" max={9999} value={v} onValueChange={setV} /><button className="btn sm" onClick={() => setV((x) => Math.min(9999, x + 13))}>Drive 13 km</button></div>;
}
function GaugeUpload({ finish }: { finish: Finish }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let x = 0;
    const t = setInterval(() => { x = Math.min(100, x + 3 + Math.random() * 9); setV(x); if (x >= 100) clearInterval(t); }, 260);
    return () => clearInterval(t);
  }, []);
  return <div className="demo-row"><Gauge finish={finish} label="Uploading report.pdf" value={v} peak={false} /><Readout>{Math.round(v)}% of 4.2 MB</Readout></div>;
}
function GaugeMeter({ finish }: { finish: Finish }) {
  const [v, setV] = useState(62);
  return <div className="demo-row"><Gauge finish={finish} role="meter" label="CPU load" value={v} format={(x) => `${x}%`} /><Fader finish={finish} label="Load" value={v} onValueChange={setV} style={{ width: 200 }} /></div>;
}
function GearsSwitch({ finish }: { finish: Finish }) {
  const [on, setOn] = useState(true);
  return <div className="demo-row"><Gears finish={finish} spinning={on} label={on ? "Syncing" : "Idle"} /><Toggle finish={finish} label="Sync" checked={on} onCheckedChange={setOn} /></div>;
}

/** A fresh mount on every replay: the parent bumps `key`. */
export function useReplay() { const [k, setK] = useState(0); return [k, () => setK((x) => x + 1)] as const; }

const meta = (id: string) => CONTROLS.find((c: { id: string }) => c.id === id) as Pick<Doc, "id" | "name" | "role" | "summary" | "group">;
const base = (exclude: string[] = []) => BASE.filter((p) => !exclude.includes(p.name));

export const DOCS: Doc[] = [
  {
    ...meta("toggle"),
    object: "A bat-handle toggle on a panel: a hex nut and threaded bushing hold the lever, which snaps across on a stiff spring, and a lamp lights when it is on.",
    native: '<input type="checkbox" role="switch">',
    keys: [["Space", "Toggle"], ["Click", "Toggle anywhere on the panel"]],
    examples: [
      { id: "default", title: "Default", text: "Uncontrolled, starting on.", code: `<Toggle label="Airplane mode" defaultChecked />`, render: (f) => <Toggle finish={f} label="Airplane mode" defaultChecked /> },
      { id: "controlled", title: "Controlled", text: "The state lives in your component; the lever moves when the prop does.", code: `const [on, setOn] = useState(true);\n\n<Toggle label="Wi-Fi" checked={on} onCheckedChange={setOn} />`, render: (f) => <ToggleControlled finish={f} /> },
      { id: "solid", title: "Solid finish", text: "The same geometry with four-tone shaded sides and a contact shadow.", code: `<Toggle finish="solid" label="Heater" />`, render: () => <Toggle finish="solid" label="Heater" /> },
    ],
    props: [
      { name: "checked", type: "boolean", desc: "Controlled state. Pair with onCheckedChange." },
      { name: "defaultChecked", type: "boolean", def: "false", desc: "Starting state when uncontrolled." },
      { name: "onCheckedChange", type: "(checked: boolean) => void", desc: "Called with the new state." },
      ...BASE,
    ],
  },
  {
    ...meta("fader"),
    object: "A mixing-desk fader: a cap with a lit index line rides a slot over a ruler. When there are 40 steps or fewer, the ruler's ticks are the steps.",
    native: '<input type="range">',
    keys: [["← →  ↑ ↓", "One step"], ["Page Up / Down", "Ten steps"], ["Home / End", "Min / max"], ["Drag", "Anywhere on the strip"]],
    examples: [
      { id: "default", title: "Default", text: "0 to 100 in steps of 1.", code: `<Fader label="Volume" defaultValue={60} />`, render: (f) => <Fader finish={f} label="Volume" defaultValue={60} /> },
      { id: "steps", title: "Steps", text: "Ten steps: the ruler draws one tick per step.", code: `const [v, setV] = useState(7);\n\n<Fader label="Brightness" min={0} max={10} step={1}\n  value={v} onValueChange={setV} />`, render: (f) => <FaderSteps finish={f} /> },
      { id: "decibels", title: "Decibels", text: "A negative range in half-dB steps, read out to screen readers with format.", code: `<Fader label="Channel 1" min={-60} max={6} step={0.5}\n  value={v} onValueChange={setV}\n  format={(x) => \`\${x} dB\`} />`, render: (f) => <FaderDb finish={f} /> },
    ],
    props: [...RANGE, ...BASE],
  },
  {
    ...meta("knob"),
    object: "A knurled knob on a panel: a skirt with a pointer notch, a tapered body whose knurl turns with it, and a cap with a lit index over a 270° scale.",
    native: '<input type="range">',
    keys: [["↑ ↓  ← →", "One step"], ["Drag up / down", "160 px is the whole sweep"], ["Shift + drag", "Fine: one fifth the speed"], ["Wheel", "One step per notch"]],
    examples: [
      { id: "default", title: "Default", text: "Drag up to turn up.", code: `<Knob label="Gain" defaultValue={35} />`, render: (f) => <Knob finish={f} label="Gain" defaultValue={35} /> },
      { id: "cutoff", title: "Log scale readout", text: "The knob stays linear; your component maps it to 20 Hz – 20 kHz.", code: `const [v, setV] = useState(55);\nconst hz = Math.round(20 * Math.pow(1000, v / 100));\n\n<Knob label="Cutoff" value={v} onValueChange={setV}\n  format={() => \`\${hz} Hz\`} />`, render: (f) => <KnobCutoff finish={f} /> },
    ],
    props: [...RANGE, ...BASE],
  },
  {
    ...meta("keycap"),
    object: "One mechanical key in a plate: a sculpted cap on a switch housing with its legend on the dished top. It travels down when pressed and bounces back.",
    native: "<button>",
    keys: [["Enter / Space", "Press"], ["Click", "Fires on release, inside the key"]],
    examples: [
      { id: "default", title: "Default", text: "A 1u key with a one-character legend.", code: `<Keycap legend="A" onPress={() => type("a")} />`, render: (f) => <Keycap finish={f} legend="A" /> },
      { id: "wide", title: "Wide key", text: "2u and wider keys show their stabiliser wire under the cap.", code: `<Keycap legend="Enter" units={2.25}\n  onPress={() => setN((n) => n + 1)} />`, render: (f) => <KeyCount finish={f} /> },
      { id: "chord", title: "A chord", text: "Keys are inline elements; lay them out like text.", code: `<Keycap legend="⌘" label="Command" />\n<Keycap legend="C" />`, render: (f) => <KeyChord finish={f} /> },
    ],
    props: [
      { name: "legend", type: "string", desc: "Printed on the cap. One to three characters read best; longer words shrink." },
      { name: "units", type: "number", def: "1", desc: "Key width in key units, 1 to 2.75." },
      { name: "onPress", type: "() => void", desc: "Called on release, from pointer, keyboard or assistive tech." },
      ...BASE,
    ],
  },
  {
    ...meta("presets"),
    object: "A bank of latching preset keys, like an old car radio's. Pressing one latches it down and throws the last one up with a bounce; the latched key shows an accent bar on its nose.",
    native: '<input type="radio"> × n',
    keys: [["← →  ↑ ↓", "Move and select"], ["Tab", "Into and out of the group"]],
    examples: [
      { id: "default", title: "Default", text: "Four numbered presets.", code: `<Presets defaultValue="2" />`, render: (f) => <Presets finish={f} defaultValue="2" /> },
      { id: "band", title: "Band selector", text: "Short legends, controlled.", code: `const [band, setBand] = useState("FM");\n\n<Presets label="Band" options={["FM", "AM", "LW"]}\n  value={band} onValueChange={setBand} />`, render: (f) => <PresetsBand finish={f} /> },
    ],
    props: [
      { name: "options", type: "string[]", def: '["1","2","3","4"]', desc: "The keys, left to right." },
      { name: "value", type: "string", desc: "Controlled selection." },
      { name: "defaultValue", type: "string", def: "options[0]", desc: "Starting selection when uncontrolled." },
      { name: "onValueChange", type: "(value: string) => void", desc: "Called with the newly latched option." },
      ...BASE,
    ],
  },
  {
    ...meta("counter"),
    object: "A tally counter: number drums behind a window roll like an odometer, each turning only while the one below it carries. Two keys on the deck step down and up.",
    native: '<input type="number">',
    keys: [["↑ ↓", "One step"], ["Hold − / +", "Repeats, faster the longer you hold"], ["Drag up / down", "10 px per step"], ["Wheel", "One step per notch"]],
    examples: [
      { id: "default", title: "Default", text: "0 to 99: two drums.", code: `<Counter label="Guests" max={99} defaultValue={4} />`, render: (f) => <Counter finish={f} label="Guests" max={99} defaultValue={4} /> },
      { id: "odometer", title: "Odometer", text: "A jump of 13 rolls the ones drum and carries into the tens.", code: `const [km, setKm] = useState(1287);\n\n<Counter label="Trip" max={9999} value={km} onValueChange={setKm} />\n<button onClick={() => setKm((x) => x + 13)}>Drive 13 km</button>`, render: (f) => <CounterOdo finish={f} /> },
    ],
    props: [...RANGE.map((p) => p.name === "max" ? { ...p, def: "999", desc: "Highest value; its digit count sets the number of drums." } : p.name === "min" ? { ...p, desc: "Lowest value, never below 0." } : p), ...BASE],
  },
  {
    ...meta("gauge"),
    object: "A dial gauge on a bench block: a knurled bezel, a 270° scale with a red zone, and a needle on an underdamped spring that overshoots a little and settles. A tell-tale hand keeps the peak.",
    native: 'role="progressbar" or role="meter"',
    keys: [],
    examples: [
      { id: "progress", title: "Progress", text: "Bound to an upload. Replay to run it again.", code: `<Gauge label="Uploading report.pdf" value={percent} peak={false} />`, render: (f) => <GaugeUpload finish={f} /> },
      { id: "meter", title: "Meter", text: "A level within a range. The tell-tale stays at the highest value seen.", code: `const [load, setLoad] = useState(62);\n\n<Gauge role="meter" label="CPU load" value={load} />\n<Fader label="Load" value={load} onValueChange={setLoad} />`, render: (f) => <GaugeMeter finish={f} /> },
    ],
    props: [
      { name: "value", type: "number", def: "min", desc: "The reading. The needle swings to it on a spring." },
      { name: "min", type: "number", def: "0", desc: "Start of the scale." },
      { name: "max", type: "number", def: "100", desc: "End of the scale." },
      { name: "role", type: '"progressbar" | "meter"', def: '"progressbar"', desc: "Work toward completion, or a level within a range." },
      { name: "peak", type: "boolean", def: "true", desc: "Shows the tell-tale hand at the highest value seen." },
      { name: "format", type: "(value: number) => string", desc: "Sets aria-valuetext." },
      ...BASE.filter((p) => p.name !== "name" && p.name !== "disabled"),
    ],
  },
  {
    ...meta("gears"),
    object: "A gear train on a plate: a 24-tooth driver and 16- and 12-tooth followers, so the small gear turns twice as fast as the big one. It eases up to speed and coasts down when it stops.",
    native: 'role="status" aria-busy',
    keys: [],
    examples: [
      { id: "default", title: "Default", text: "A quarter turn of the driver per second.", code: `<Gears label="Loading" />`, render: (f) => <Gears finish={f} /> },
      { id: "switch", title: "Start and stop", text: "Turning it off lets the train coast to a stop.", code: `const [on, setOn] = useState(true);\n\n<Gears spinning={on} label={on ? "Syncing" : "Idle"} />\n<Toggle label="Sync" checked={on} onCheckedChange={setOn} />`, render: (f) => <GearsSwitch finish={f} /> },
    ],
    props: [
      { name: "spinning", type: "boolean", def: "true", desc: "Whether it turns; sets aria-busy." },
      { name: "speed", type: "number", def: "0.25", desc: "Driver revolutions per second." },
      ...BASE.filter((p) => p.name !== "name" && p.name !== "disabled"),
    ],
  },
  ...newDocs(meta, base),
];

/** The live control a gallery cell shows. */
export function Hero({ id, finish }: { id: string; finish: Finish }) {
  const ref = useRef<HTMLDivElement>(null);
  void ref;
  switch (id) {
    case "toggle": return <Toggle finish={finish} label="Power" defaultChecked style={{ width: 160 }} />;
    case "fader": return <Fader finish={finish} label="Volume" defaultValue={64} style={{ width: 250 }} />;
    case "knob": return <Knob finish={finish} label="Gain" defaultValue={40} style={{ width: 176 }} />;
    case "keycap": return <Keycap finish={finish} legend="Esc" style={{ width: 150 }} />;
    case "presets": return <Presets finish={finish} options={["1", "2", "3", "4"]} defaultValue="3" style={{ width: 240 }} />;
    case "counter": return <Counter finish={finish} label="Count" defaultValue={42} style={{ width: 210 }} />;
    case "gauge": return <GaugeHero finish={finish} />;
    case "gears": return <Gears finish={finish} style={{ width: 170 }} />;
    case "rocker": return <Rocker finish={finish} label="Mains" defaultChecked style={{ width: 160 }} />;
    case "caliper": return <Caliper finish={finish} label="Range" defaultValue={[30, 65]} style={{ width: 270 }} />;
    case "joystick": return <Joystick finish={finish} label="Stick" style={{ width: 170 }} />;
    case "combo": return <Combo finish={finish} label="PIN" code="1234" defaultValue="07" style={{ width: 170 }} />;
    case "tray": return <Tray finish={finish} label="Drop files" count={3} style={{ width: 200 }} />;
    case "selector": return <Selector finish={finish} label="Mode" defaultValue="MED" style={{ width: 180 }} />;
    case "timer": return <Timer finish={finish} label="Timer" defaultValue={7 * 60} style={{ width: 170 }} />;
    case "tank": return <Tank finish={finish} label="Level" value={62} low={15} high={85} style={{ width: 130 }} />;
    case "track": return <Track finish={finish} label="Checkout" current={1} style={{ width: 270 }} />;
    case "annunciator": return <Annunciator finish={finish} label="Services" style={{ width: 260 }} />;
  }
  return null;
}

function GaugeHero({ finish }: { finish: Finish }) {
  const [v, setV] = useState(38);
  useEffect(() => {
    const t = setInterval(() => setV(25 + Math.round(Math.random() * 60)), 2400);
    return () => clearInterval(t);
  }, []);
  return <Gauge finish={finish} role="meter" label="Pressure" value={v} style={{ width: 176 }} />;
}
