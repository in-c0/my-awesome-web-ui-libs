import { useState, type CSSProperties, type ReactNode } from "react";
import { Auto, AutoAct, blink, circle, cycle, flip, press, typing, wander, wanderPair, wind, type Lamp } from "./auto";
import { Annunciator, Caliper, Combo, Counter, Fader, Gauge, Gears, Joystick, Keycap, Knob, Presets, Rocker, Selector, Tank, Timer, Toggle, Track, Tray } from "@in-c0/knurl/react";
import { newDocs } from "./data-new";
import * as D_breakers from "./docs3/breakers";
import * as D_dip from "./docs3/dip";
import * as D_throttle from "./docs3/throttle";
import * as D_printer from "./docs3/printer";
import * as D_flap from "./docs3/flap";
import * as D_embosser from "./docs3/embosser";
import * as D_stamper from "./docs3/stamper";
import * as D_fan from "./docs3/fan";
import * as D_tabs from "./docs3/tabs";
import * as D_hourglass from "./docs3/hourglass";

import type { Finish } from "@in-c0/knurl";
import { CONTROLS } from "../../registry/controls.mjs";

export const SITE = (import.meta.env.VITE_SITE_URL as string | undefined) ?? "https://ui.ava.kim/knurl";
export const REPO = "https://github.com/in-c0/my-awesome-web-ui-libs/tree/main/packages/knurl";
export const NPM = "https://www.npmjs.com/package/@in-c0/knurl";

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
  return <Auto init={true} next={flip} ms={2200}>{(on, setOn) => <div className="demo-row"><Toggle finish={finish} label="Wi-Fi" checked={on} onCheckedChange={setOn} /><Readout>Wi-Fi {on ? "on" : "off"}</Readout></div>}</Auto>;
}
const AutoToggle = ({ finish, label, init = true, ms = 2200, style }: { finish: Finish; label: string; init?: boolean; ms?: number; style?: CSSProperties }) =>
  <Auto init={init} next={flip} ms={ms}>{(on, set) => <Toggle finish={finish} label={label} checked={on} onCheckedChange={set} style={style} />}</Auto>;
function FaderSteps({ finish }: { finish: Finish }) {
  return <Auto init={7} next={wander(0, 10)}>{(v, setV) => <div className="demo-col"><Fader finish={finish} label="Brightness" min={0} max={10} step={1} value={v} onValueChange={setV} /><Readout>{v} / 10</Readout></div>}</Auto>;
}
function FaderDb({ finish }: { finish: Finish }) {
  return <Auto init={-12} next={wander(-48, 6, 0.5)}>{(v, setV) => <div className="demo-col"><Fader finish={finish} label="Channel 1" min={-60} max={6} step={0.5} value={v} onValueChange={setV} format={(x) => `${x} dB`} /><Readout>{v > 0 ? "+" : ""}{v.toFixed(1)} dB</Readout></div>}</Auto>;
}
const AutoFader = ({ finish, label, init, style }: { finish: Finish; label: string; init: number; style?: CSSProperties }) =>
  <Auto init={init} next={wander(8, 92)}>{(v, set) => <Fader finish={finish} label={label} value={v} onValueChange={set} style={style} />}</Auto>;
function KnobCutoff({ finish }: { finish: Finish }) {
  return <Auto init={55} next={wander(5, 95)} ms={2000}>{(v, setV) => {
    const hz = Math.round(20 * Math.pow(1000, v / 100));
    return <div className="demo-row"><Knob finish={finish} label="Cutoff" value={v} onValueChange={setV} format={() => `${hz} Hz`} /><Readout>Cutoff {hz >= 1000 ? (hz / 1000).toFixed(1) + " kHz" : hz + " Hz"}</Readout></div>;
  }}</Auto>;
}
const AutoKnob = ({ finish, label, init, style }: { finish: Finish; label: string; init: number; style?: CSSProperties }) =>
  <Auto init={init} next={wander(5, 95)} ms={2000}>{(v, set) => <Knob finish={finish} label={label} value={v} onValueChange={set} style={style} />}</Auto>;
function KeyCount({ finish }: { finish: Finish }) {
  const [n, setN] = useState(0);
  return <AutoAct act={press()} ms={1700}><div className="demo-row"><Keycap finish={finish} legend="Enter" units={2.25} onPress={() => setN((x) => x + 1)} style={{ width: 170 }} /><Readout>Pressed {n}×</Readout></div></AutoAct>;
}
function KeyChord({ finish }: { finish: Finish }) {
  return <AutoAct act={press(220)} ms={2000}><div className="demo-row tight"><Keycap finish={finish} legend="⌘" label="Command" style={{ width: 96 }} /><Keycap finish={finish} legend="C" label="C" style={{ width: 96 }} /></div></AutoAct>;
}
const PRESETS = ["1", "2", "3", "4"];
const AutoPresets = ({ finish, init, style }: { finish: Finish; init: string; style?: CSSProperties }) =>
  <Auto init={init} next={cycle(PRESETS)}>{(v, set) => <Presets finish={finish} options={PRESETS} value={v} onValueChange={set} style={style} />}</Auto>;
function PresetsBand({ finish }: { finish: Finish }) {
  const f: Record<string, string> = { FM: "87.5–108 MHz", AM: "530–1700 kHz", LW: "153–279 kHz" };
  return <Auto init="FM" next={cycle(["FM", "AM", "LW"])}>{(v, setV) => <div className="demo-col"><Presets finish={finish} label="Band" options={["FM", "AM", "LW"]} value={v} onValueChange={setV} /><Readout>{v} · {f[v]}</Readout></div>}</Auto>;
}
const bump = (max: number) => (v: number) => (v >= max - 13 ? 0 : v + 1 + Math.floor(Math.random() * 13));
const AutoCounter = ({ finish, label, init, max, style }: { finish: Finish; label: string; init: number; max?: number; style?: CSSProperties }) =>
  <Auto init={init} next={bump(max ?? 999)} ms={1500}>{(v, set) => <Counter finish={finish} label={label} max={max} value={v} onValueChange={set} style={style} />}</Auto>;
function CounterOdo({ finish }: { finish: Finish }) {
  return <Auto init={1287} next={bump(9999)} ms={1500}>{(v, setV) => <div className="demo-col"><Counter finish={finish} label="Trip" max={9999} value={v} onValueChange={setV} /><button className="btn sm" onClick={() => setV(Math.min(9999, v + 13))}>Drive 13 km</button></div>}</Auto>;
}
// an upload that runs, holds at 100% and starts over
const upload = (_: number, i: number) => { const p = (i + 1) % 22; return p === 0 ? 0 : Math.min(100, p * 6.5 + Math.random() * 4); };
function GaugeUpload({ finish }: { finish: Finish }) {
  return <Auto init={0} next={upload} ms={280} tap="[data-knurl=gauge]">{(v) => <div className="demo-row"><Gauge finish={finish} label="Uploading report.pdf" value={v} peak={false} /><Readout>{Math.round(v)}% of 4.2 MB</Readout></div>}</Auto>;
}
function GaugeMeter({ finish }: { finish: Finish }) {
  return <Auto init={62} next={wander(10, 95)} ms={2000} tap="[data-knurl=gauge]">{(v, setV) => <div className="demo-row"><Gauge finish={finish} role="meter" label="CPU load" value={v} format={(x) => `${x}%`} /><Fader finish={finish} label="Load" value={v} onValueChange={setV} style={{ width: 200 }} /></div>}</Auto>;
}
function GearsSwitch({ finish }: { finish: Finish }) {
  return <Auto init={true} next={flip} ms={3200}>{(on, setOn) => <div className="demo-row"><Gears finish={finish} spinning={on} label={on ? "Syncing" : "Idle"} /><Toggle finish={finish} label="Sync" checked={on} onCheckedChange={setOn} /></div>}</Auto>;
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
      { id: "default", title: "Default", text: "Uncontrolled, starting on.", code: `<Toggle label="Airplane mode" defaultChecked />`, render: (f) => <AutoToggle finish={f} label="Airplane mode" /> },
      { id: "controlled", title: "Controlled", text: "The state lives in your component; the lever moves when the prop does.", code: `const [on, setOn] = useState(true);\n\n<Toggle label="Wi-Fi" checked={on} onCheckedChange={setOn} />`, render: (f) => <ToggleControlled finish={f} /> },
      { id: "solid", title: "Solid finish", text: "The same geometry with four-tone shaded sides and a contact shadow.", code: `<Toggle finish="solid" label="Heater" />`, render: () => <AutoToggle finish="solid" label="Heater" init={false} /> },
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
      { id: "default", title: "Default", text: "0 to 100 in steps of 1.", code: `<Fader label="Volume" defaultValue={60} />`, render: (f) => <AutoFader finish={f} label="Volume" init={60} /> },
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
      { id: "default", title: "Default", text: "Drag up to turn up.", code: `<Knob label="Gain" defaultValue={35} />`, render: (f) => <AutoKnob finish={f} label="Gain" init={35} /> },
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
      { id: "default", title: "Default", text: "A 1u key with a one-character legend.", code: `<Keycap legend="A" onPress={() => type("a")} />`, render: (f) => <AutoAct act={press()} ms={1600}><Keycap finish={f} legend="A" /></AutoAct> },
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
      { id: "default", title: "Default", text: "Four numbered presets.", code: `<Presets defaultValue="2" />`, render: (f) => <AutoPresets finish={f} init="2" /> },
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
      { id: "default", title: "Default", text: "0 to 99: two drums.", code: `<Counter label="Guests" max={99} defaultValue={4} />`, render: (f) => <AutoCounter finish={f} label="Guests" max={99} init={4} /> },
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
      { id: "progress", title: "Progress", text: "Bound to an upload: it runs, holds at 100% and starts over.", code: `<Gauge label="Uploading report.pdf" value={percent} peak={false} />`, render: (f) => <GaugeUpload finish={f} /> },
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
    keys: [["Tap", "A gentle push: the train speeds up a little and eases back"]],
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
  D_breakers.doc(meta, base), D_dip.doc(meta, base), D_throttle.doc(meta, base), D_printer.doc(meta, base), D_flap.doc(meta, base), D_embosser.doc(meta, base), D_stamper.doc(meta, base), D_fan.doc(meta, base), D_tabs.doc(meta, base), D_hourglass.doc(meta, base),
];

/** The live control a gallery cell shows. */
export function Hero({ id, finish }: { id: string; finish: Finish }) {
  switch (id) {
    case "toggle": return <AutoToggle finish={finish} label="Power" style={{ width: 160 }} />;
    case "fader": return <AutoFader finish={finish} label="Volume" init={64} style={{ width: 250 }} />;
    case "knob": return <AutoKnob finish={finish} label="Gain" init={40} style={{ width: 176 }} />;
    case "keycap": return <AutoAct act={press()} ms={1600}><Keycap finish={finish} legend="Esc" style={{ width: 150 }} /></AutoAct>;
    case "presets": return <AutoPresets finish={finish} init="3" style={{ width: 240 }} />;
    case "counter": return <AutoCounter finish={finish} label="Count" init={42} style={{ width: 210 }} />;
    case "gauge": return <Auto init={38} next={wander(20, 88)} ms={2400} tap="[data-knurl=gauge]">{(v) => <Gauge finish={finish} role="meter" label="Pressure" value={v} style={{ width: 176 }} />}</Auto>;
    case "gears": return <Gears finish={finish} style={{ width: 170 }} />;
    case "rocker": return <Auto init={true} next={flip} ms={2400}>{(on, set) => <Rocker finish={finish} label="Mains" checked={on} onCheckedChange={set} style={{ width: 160 }} />}</Auto>;
    case "caliper": return <Auto init={[30, 65] as [number, number]} next={wanderPair(0, 100)} ms={2200}>{(v, set) => <Caliper finish={finish} label="Range" value={v} onValueChange={set} style={{ width: 270 }} />}</Auto>;
    case "joystick": return <Auto init={{ x: 0, y: 0 }} next={circle} ms={650}>{(v, set) => <Joystick finish={finish} label="Stick" value={v} onValueChange={set} style={{ width: 170 }} />}</Auto>;
    case "combo": return <Auto init="" next={typing(["1234"])} ms={700}>{(v, set) => <Combo finish={finish} label="PIN" code="1234" value={v} onValueChange={set} style={{ width: 170 }} />}</Auto>;
    case "tray": return <Auto init={2} next={(n: number) => (n >= 6 ? 0 : n + 1)} ms={1300}>{(n) => <Tray finish={finish} label="Drop files" count={n} style={{ width: 200 }} />}</Auto>;
    case "selector": return <Auto init="MED" next={cycle(["OFF", "LOW", "MED", "HIGH"], true)} ms={1700}>{(v, set) => <Selector finish={finish} label="Mode" value={v} onValueChange={set} style={{ width: 180 }} />}</Auto>;
    case "timer": return <Auto init={7 * 60} next={wind} ms={500}>{(v, set) => <Timer finish={finish} label="Timer" value={v} onValueChange={set} style={{ width: 170 }} />}</Auto>;
    case "tank": return <Auto init={62} next={wander(18, 92)} ms={2600} tap="[data-knurl=tank]">{(v) => <Tank finish={finish} label="Level" value={v} low={15} high={85} style={{ width: 130 }} />}</Auto>;
    case "track": return <Auto init={1} next={(c: number) => (c + 1) % 4} ms={1800} tap="[data-knurl=track]">{(c) => <Track finish={finish} label="Checkout" current={c} style={{ width: 270 }} />}</Auto>;
    case "breakers": return <D_breakers.Hero finish={finish} />;
    case "dip": return <D_dip.Hero finish={finish} />;
    case "throttle": return <D_throttle.Hero finish={finish} />;
    case "printer": return <D_printer.Hero finish={finish} />;
    case "flap": return <D_flap.Hero finish={finish} />;
    case "embosser": return <D_embosser.Hero finish={finish} />;
    case "stamper": return <D_stamper.Hero finish={finish} />;
    case "fan": return <D_fan.Hero finish={finish} />;
    case "tabs": return <D_tabs.Hero finish={finish} />;
    case "hourglass": return <D_hourglass.Hero finish={finish} />;
    case "annunciator": return <Auto init={LAMPS} next={blink} ms={1500}>{(items) => <Annunciator finish={finish} label="Services" items={items} style={{ width: 260 }} />}</Auto>;
  }
  return null;
}

const LAMPS: Lamp[] = [{ id: "api", label: "API", state: "ok" }, { id: "db", label: "DB", state: "ok" }, { id: "queue", label: "QUEUE", state: "warn" }, { id: "auth", label: "AUTH", state: "ok" }];
