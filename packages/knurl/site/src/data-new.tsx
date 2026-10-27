import { useEffect, useState, type ReactNode } from "react";
import { Annunciator, Caliper, Combo, Joystick, Rocker, Selector, Tank, Timer, Track, Tray } from "knurl-ui/react";
import type { Finish } from "knurl-ui";
import type { Doc, Prop } from "./data";

/** The v0.2 controls' pages: the same shape as the first eight, in data.tsx. */

const Readout = ({ children }: { children: ReactNode }) => <output className="readout">{children}</output>;

type Base = (exclude?: string[]) => Prop[];

function RockerMains({ finish }: { finish: Finish }) {
  const [on, setOn] = useState(false);
  return <div className="demo-row"><Rocker finish={finish} label="Mains power" checked={on} onCheckedChange={setOn} /><Readout>Mains {on ? "on" : "off"}</Readout></div>;
}
function RockerSelectAll({ finish }: { finish: Finish }) {
  const rows = ["Invoice 0412", "Invoice 0413", "Invoice 0414"];
  const [sel, setSel] = useState<string[]>(["Invoice 0413"]);
  const all = sel.length === rows.length;
  return (
    <div className="demo-row">
      <Rocker finish={finish} label="Select all rows" checked={all} indeterminate={sel.length > 0 && !all} onCheckedChange={(c) => setSel(c ? rows : [])} />
      <ul className="demo-list">{rows.map((r) => <li key={r}><label><input type="checkbox" checked={sel.includes(r)} onChange={(e) => setSel((s) => e.target.checked ? [...s, r] : s.filter((x) => x !== r))} /> {r}</label></li>)}</ul>
    </div>
  );
}
function CaliperPrice({ finish }: { finish: Finish }) {
  const [range, setRange] = useState<[number, number]>([40, 120]);
  return <div className="demo-col"><Caliper finish={finish} label="Price" min={0} max={200} step={5} value={range} onValueChange={setRange} format={(v) => `$${v}`} /><Readout>${range[0]} – ${range[1]}</Readout></div>;
}
function CaliperShift({ finish }: { finish: Finish }) {
  const [range, setRange] = useState<[number, number]>([9, 17]);
  return <div className="demo-col"><Caliper finish={finish} label="Shift" min={6} max={22} step={1} minGap={2} value={range} onValueChange={setRange} format={(v) => `${v}:00`} /><Readout>{range[0]}:00 – {range[1]}:00 · {range[1] - range[0]} h</Readout></div>;
}
function JoystickPan({ finish }: { finish: Finish }) {
  const [v, setV] = useState({ x: 0, y: 0 });
  return <div className="demo-row"><Joystick finish={finish} label="Pan camera" value={v} onValueChange={setV} /><Readout>x {v.x.toFixed(2)} · y {v.y.toFixed(2)}</Readout></div>;
}
function JoystickHold({ finish }: { finish: Finish }) {
  const [v, setV] = useState({ x: 0.4, y: -0.3 });
  return <div className="demo-row"><Joystick finish={finish} label="Aim" returnToCenter={false} value={v} onValueChange={setV} /><Readout>{Math.round(Math.hypot(v.x, v.y) * 100)}% at {Math.round((Math.atan2(v.y, v.x) * 180) / Math.PI)}°</Readout></div>;
}
function ComboLocker({ finish }: { finish: Finish }) {
  const [log, setLog] = useState("Try 2468");
  return <div className="demo-row"><Combo finish={finish} label="Locker PIN" code="2468" onComplete={(pin) => setLog(pin === "2468" ? "Opened" : `${pin} is wrong`)} /><Readout>{log}</Readout></div>;
}
function ComboSix({ finish }: { finish: Finish }) {
  const [pin, setPin] = useState("");
  return <div className="demo-col"><Combo finish={finish} label="Verification code" length={6} value={pin} onValueChange={setPin} unlocked={pin === "123456"} /><button className="btn sm" onClick={() => setPin("")}>Clear</button></div>;
}
function TrayInvoices({ finish }: { finish: Finish }) {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("Drop PDFs, or click the tray");
  return (
    <div className="demo-row">
      <Tray finish={finish} label="Attach invoices" accept=".pdf" maxSize={10_000_000} onFiles={(f) => { setFiles((x) => [...x, ...f]); setNote(`${f.length} added`); }} onReject={(f) => setNote(`${f.length} not a PDF under 10 MB`)} />
      <div className="demo-col" style={{ alignItems: "flex-start" }}><Readout>{note}</Readout><ul className="demo-list">{files.slice(-4).map((f, i) => <li key={i}>{f.name}</li>)}</ul></div>
    </div>
  );
}
function SelectorRange({ finish }: { finish: Finish }) {
  const [range, setRange] = useState("20V");
  return <div className="demo-row"><Selector finish={finish} label="Range" options={["200m", "2V", "20V", "200V", "2k", "20k"]} value={range} onValueChange={setRange} /><Readout>Range {range}</Readout></div>;
}
function TimerTea({ finish }: { finish: Finish }) {
  const [s, setS] = useState(4 * 60);
  const [done, setDone] = useState(false);
  return <div className="demo-row"><Timer finish={finish} label="Tea" value={s} onValueChange={(v) => { setS(v); setDone(false); }} onDone={() => setDone(true)} /><Readout>{done ? "Ready" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`}</Readout></div>;
}
function TimerPaused({ finish }: { finish: Finish }) {
  const [run, setRun] = useState(false);
  return <div className="demo-col"><Timer finish={finish} label="Exposure" defaultValue={90} running={run} /><button className="btn sm" onClick={() => setRun((r) => !r)}>{run ? "Pause" : "Start"}</button></div>;
}
function TankFill({ finish }: { finish: Finish }) {
  const [v, setV] = useState(10);
  useEffect(() => { const t = setInterval(() => setV((x) => (x >= 95 ? 10 : x + 17)), 1600); return () => clearInterval(t); }, []);
  return <div className="demo-row"><Tank finish={finish} label="Upload" role="progressbar" value={v} format={(x) => `${x}% uploaded`} /><Readout>{v}%</Readout></div>;
}
function TrackOnboarding({ finish }: { finish: Finish }) {
  const [step, setStep] = useState(3);
  return <div className="demo-col"><Track finish={finish} label="Setup" steps={["Account", "Team", "Repo", "Deploy", "Invite"]} current={step} clickable onStepChange={setStep} /><div className="demo-row tight"><button className="btn sm" onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</button><button className="btn sm" onClick={() => setStep((s) => Math.min(4, s + 1))}>Next</button></div></div>;
}
function AnnunciatorLive({ finish }: { finish: Finish }) {
  const names = ["CDN", "DNS", "TLS", "WAF", "S3", "LOGS", "CACHE", "SEARCH"];
  const [states, setStates] = useState<("off" | "ok" | "warn" | "alert")[]>(["ok", "ok", "ok", "warn", "ok", "off", "alert", "ok"]);
  useEffect(() => {
    const pick = ["ok", "ok", "ok", "warn", "alert", "off"] as const;
    const t = setInterval(() => setStates((s) => s.map((x, i) => (i === Math.floor(Math.random() * s.length) ? pick[Math.floor(Math.random() * pick.length)] : x))), 2200);
    return () => clearInterval(t);
  }, []);
  return <Annunciator finish={finish} label="Edge cluster" columns={4} items={names.map((n, i) => ({ id: n, label: n, state: states[i] }))} />;
}

export function newDocs(meta: (id: string) => Pick<Doc, "id" | "name" | "role" | "summary" | "group">, base: Base): Doc[] {
  return [
    {
      ...meta("rocker"),
      object: "A panel-mount rocker switch: a bezel on a screwed plate holds a paddle engraved I and O that rocks ±12° on its axle, and a lens in the paddle lights when it is on. Mixed sets the paddle level, like a centre-off rocker.",
      native: '<input type="checkbox">',
      keys: [["Space", "Toggle; from mixed it turns on"], ["Click the I half", "Turn on"], ["Click the O half", "Turn off"], ["Click elsewhere", "Toggle"]],
      examples: [
        { id: "default", title: "Default", text: "Uncontrolled.", code: `<Rocker label="Mains power" />`, render: (f) => <Rocker finish={f} label="Mains power" /> },
        { id: "controlled", title: "Controlled", text: "The state lives in your component.", code: `const [on, setOn] = useState(false);\n\n<Rocker label="Mains power" checked={on} onCheckedChange={setOn} />`, render: (f) => <RockerMains finish={f} /> },
        { id: "mixed", title: "Select all, with a mixed state", text: "A centre-off rocker for a partly selected list.", code: `const all = selected.length === rows.length;\n\n<Rocker label="Select all rows" checked={all}\n  indeterminate={selected.length > 0 && !all}\n  onCheckedChange={(c) => setSelected(c ? rows : [])} />`, render: (f) => <RockerSelectAll finish={f} /> },
      ],
      props: [
        { name: "checked", type: "boolean", desc: "Controlled state. Pair with onCheckedChange." },
        { name: "defaultChecked", type: "boolean", def: "false", desc: "Starting state when uncontrolled." },
        { name: "indeterminate", type: "boolean", def: "false", desc: "Paddle level in the middle, neither on nor off. Any user change clears it." },
        { name: "onCheckedChange", type: "(checked: boolean) => void", desc: "Called with the new state." },
        ...base(),
      ],
    },
    {
      ...meta("caliper"),
      object: "A vernier caliper on the bench: two sliding heads, each with a vernier plate, a knurled locking screw, a thumb roller and a jaw, ride a beam engraved with the steps. The gap between the jaws is lit, and a jaw never passes the other.",
      native: '<input type="range"> × 2',
      keys: [["Tab", "Between the minimum and maximum jaws"], ["← → ↑ ↓", "Step the focused jaw"], ["Page Up / Down", "Large step"], ["Press on the beam", "Move the nearer jaw there and drag it"], ["Drag the lit span", "Move both jaws together"]],
      examples: [
        { id: "default", title: "Default", text: "0 to 100, starting at 25–75.", code: `<Caliper label="Range" />`, render: (f) => <Caliper finish={f} label="Range" /> },
        { id: "price", title: "Price filter", text: "Steps of $5 on a 0–200 beam.", code: `const [range, setRange] = useState([40, 120]);\n\n<Caliper label="Price" min={0} max={200} step={5}\n  value={range} onValueChange={setRange}\n  format={(v) => \`$\${v}\`} />`, render: (f) => <CaliperPrice finish={f} /> },
        { id: "gap", title: "A minimum gap", text: "A shift at least two hours long.", code: `<Caliper label="Shift" min={6} max={22} minGap={2}\n  value={range} onValueChange={setRange}\n  format={(v) => \`\${v}:00\`} />`, render: (f) => <CaliperShift finish={f} /> },
      ],
      props: [
        { name: "value", type: "[number, number]", desc: "Controlled range. Pair with onValueChange." },
        { name: "defaultValue", type: "[number, number]", def: "[25, 75]", desc: "Starting range when uncontrolled." },
        { name: "min", type: "number", def: "0", desc: "Low end of the beam." },
        { name: "max", type: "number", def: "100", desc: "High end of the beam." },
        { name: "step", type: "number", def: "1", desc: "Snap interval; the scale's ticks are the steps when there are 100 or fewer." },
        { name: "minGap", type: "number", def: "0", desc: "Smallest distance the jaws keep between them." },
        { name: "onValueChange", type: "(value: [number, number]) => void", desc: "Every change, by pointer or keys." },
        { name: "onValueCommit", type: "(value: [number, number]) => void", desc: "Once, when a drag or key press settles." },
        { name: "format", type: "(v: number) => string", desc: "Each jaw's aria-valuetext." },
        ...base(),
      ],
    },
    {
      ...meta("joystick"),
      object: "An arcade joystick on a screwed plate: a dust washer, a shaft on a pivot and a ball top, inside a restrictor gate engraved on the plate. It leans toward the pointer and springs back to centre when you let go; a small lamp lights in the direction it is pushed.",
      native: '<input type="range"> × 2 (x, y)',
      keys: [["← →", "Nudge x by 10"], ["↑ ↓", "Nudge y by 10"], ["Drag", "Anywhere on the plate; the stick follows, clamped to the gate"], ["Release", "Springs back to centre (unless returnToCenter is false)"]],
      examples: [
        { id: "default", title: "Default", text: "Returns to centre on release.", code: `<Joystick label="Pan camera" onValueChange={({ x, y }) => pan(x, y)} />`, render: (f) => <Joystick finish={f} label="Pan camera" /> },
        { id: "read", title: "Reading the value", text: "x and y run from −1 to 1.", code: `const [v, setV] = useState({ x: 0, y: 0 });\n\n<Joystick label="Pan camera" value={v} onValueChange={setV} />`, render: (f) => <JoystickPan finish={f} /> },
        { id: "hold", title: "Holding position", text: "With returnToCenter off it stays where you leave it, like an aiming stick.", code: `<Joystick label="Aim" returnToCenter={false}\n  value={v} onValueChange={setV} />`, render: (f) => <JoystickHold finish={f} /> },
      ],
      props: [
        { name: "value", type: "{ x: number; y: number }", desc: "Controlled position, each axis −1…1." },
        { name: "defaultValue", type: "{ x: number; y: number }", def: "{ x: 0, y: 0 }", desc: "Starting position when uncontrolled." },
        { name: "returnToCenter", type: "boolean", def: "true", desc: "Springs back to centre when the pointer lets go." },
        { name: "onValueChange", type: "(v: { x: number; y: number }) => void", desc: "Every change." },
        { name: "onValueCommit", type: "(v: { x: number; y: number }) => void", desc: "Once, when a drag ends." },
        ...base(),
      ],
    },
    {
      ...meta("combo"),
      object: "A combination padlock: knurled number wheels behind a window roll the short way round to each digit, with the digits above and below foreshortened on the wheel's curve. When the code matches, the shackle springs up and swings open on its long leg.",
      native: '<input inputmode="numeric" autocomplete="one-time-code">',
      keys: [["Digits", "Set the wheels left to right (typing, paste or SMS autofill)"], ["Backspace", "Clear digits"], ["↑ ↓", "Roll the wheel at the caret"], ["Drag or wheel on a wheel", "Roll that digit"]],
      examples: [
        { id: "default", title: "Default", text: "Four wheels.", code: `<Combo label="PIN" />`, render: (f) => <Combo finish={f} label="PIN" /> },
        { id: "code", title: "A known code", text: "The lock opens itself on 2468.", code: `<Combo label="Locker PIN" code="2468"\n  onComplete={(pin) => open(pin)} />`, render: (f) => <ComboLocker finish={f} /> },
        { id: "server", title: "Checked by a server", text: "Six digits; unlocked opens it once the code is accepted. Try 123456.", code: `const [pin, setPin] = useState("");\n\n<Combo label="Verification code" length={6}\n  value={pin} onValueChange={setPin} unlocked={verified} />`, render: (f) => <ComboSix finish={f} /> },
      ],
      props: [
        { name: "length", type: "number", def: "4", desc: "How many wheels, 3 to 8." },
        { name: "value", type: "string", desc: "Controlled digits, left to right." },
        { name: "defaultValue", type: "string", def: '""', desc: "Starting digits when uncontrolled." },
        { name: "onValueChange", type: "(value: string) => void", desc: "Every change." },
        { name: "onComplete", type: "(value: string) => void", desc: "When every digit is set, or the lock opens." },
        { name: "code", type: "string", desc: "The combination: the lock opens itself when the value matches." },
        { name: "unlocked", type: "boolean", def: "false", desc: "Opens the shackle whatever the wheels read." },
        ...base(),
      ],
    },
    {
      ...meta("tray"),
      object: "A desk letter tray on four feet, its front cut low with a finger notch. Each file falls in as a sheet on a spring, turning a little as it lands, and the top sheet is stamped with the file type. A drag over it lights the rim; a rejected file shakes the tray.",
      native: '<input type="file"> opened by a <button>',
      keys: [["Enter / Space", "Open the file picker"], ["Click the tray", "Open the file picker"], ["Drag files over", "The rim lights and a ghost sheet hovers"], ["Drop", "Accepted files fall in; rejected ones shake the tray"]],
      examples: [
        { id: "default", title: "Default", text: "Any file type, several at once.", code: `<Tray label="Attach files" onFiles={(files) => upload(files)} />`, render: (f) => <Tray finish={f} label="Attach files" /> },
        { id: "invoices", title: "PDFs only, with a size limit", text: "Wrong types and files over 10 MB go to onReject.", code: `<Tray label="Attach invoices" accept=".pdf" maxSize={10_000_000}\n  onFiles={(f) => setFiles((x) => [...x, ...f])}\n  onReject={(f) => warn(f)} />`, render: (f) => <TrayInvoices finish={f} /> },
      ],
      props: [
        { name: "accept", type: "string", def: '""', desc: 'File types, as <input accept>: ".pdf,.png" or "image/*". Also filters drops.' },
        { name: "multiple", type: "boolean", def: "true", desc: "Takes several files at once." },
        { name: "count", type: "number", desc: "How many sheets show, when your app keeps the count." },
        { name: "onFiles", type: "(files: File[]) => void", desc: "Accepted files, from a drop or the picker." },
        { name: "onReject", type: "(files: File[]) => void", desc: "Files that did not match accept or maxSize." },
        { name: "maxSize", type: "number", desc: "Largest file to take, in bytes." },
        ...base(["disabled"]),
      ],
    },
    {
      ...meta("selector"),
      object: "A rotary selector switch: a tapered chicken-head knob on a fluted skirt and hex nut, over a dial plate with an engraved legend and tick per position. It snaps from detent to detent with a small overshoot; the current tick is lit.",
      native: '<input type="radio"> × n',
      keys: [["Arrow keys", "Next or previous position"], ["Click a legend or tick", "Turn straight there"], ["Drag around the knob", "Turn through the detents"], ["Wheel", "One detent"]],
      examples: [
        { id: "default", title: "Default", text: "Four positions.", code: `<Selector label="Fan" defaultValue="LOW" />`, render: (f) => <Selector finish={f} label="Fan" defaultValue="LOW" /> },
        { id: "range", title: "Six positions", text: "A test meter's range switch, controlled.", code: `const [range, setRange] = useState("20V");\n\n<Selector label="Range"\n  options={["200m", "2V", "20V", "200V", "2k", "20k"]}\n  value={range} onValueChange={setRange} />`, render: (f) => <SelectorRange finish={f} /> },
      ],
      props: [
        { name: "options", type: "string[]", def: '["OFF","LOW","MED","HIGH"]', desc: "The positions, clockwise. Legends show their first 4 characters." },
        { name: "value", type: "string", desc: "Controlled position." },
        { name: "defaultValue", type: "string", def: "options[0]", desc: "Starting position when uncontrolled." },
        { name: "onValueChange", type: "(value: string) => void", desc: "Called with the new position." },
        ...base(),
      ],
    },
    {
      ...meta("timer"),
      object: "A wind-up kitchen timer: a squat body on feet, a dial ring with minute numbers every five, a fixed index and a winding grip. The dial turns back toward zero as time passes, and a little bell shakes when it gets there.",
      native: '<input type="range"> in whole minutes',
      keys: [["← → ↑ ↓", "Wind by a minute"], ["Drag around the dial", "Wind it"], ["Wheel", "Add or remove a minute"]],
      examples: [
        { id: "default", title: "Default", text: "Wound to 10 minutes; it runs on its own.", code: `<Timer label="Pasta" defaultValue={600} onDone={() => drain()} />`, render: (f) => <Timer finish={f} label="Pasta" defaultValue={600} /> },
        { id: "controlled", title: "Controlled", text: "Your component keeps the seconds; onValueChange fires each whole second.", code: `const [s, setS] = useState(240);\n\n<Timer label="Tea" value={s} onValueChange={setS} onDone={() => ring()} />`, render: (f) => <TimerTea finish={f} /> },
        { id: "paused", title: "Start and pause", text: "running decides whether it counts down.", code: `<Timer label="Exposure" defaultValue={90} running={running} />`, render: (f) => <TimerPaused finish={f} /> },
      ],
      props: [
        { name: "value", type: "number", desc: "Controlled seconds remaining." },
        { name: "defaultValue", type: "number", def: "0", desc: "Starting seconds when uncontrolled." },
        { name: "max", type: "number", def: "3600", desc: "The most it winds to, in seconds." },
        { name: "running", type: "boolean", def: "true", desc: "Counts down whenever there is time left." },
        { name: "onValueChange", type: "(seconds: number) => void", desc: "When wound, and once per whole second while running." },
        { name: "onDone", type: "() => void", desc: "When it reaches zero." },
        ...base(),
      ],
    },
    {
      ...meta("tank"),
      object: "An upright storage tank on a bolted plinth: banded shell, dome lid with a bolt ring, manway and vent, an inlet through a valve with a handwheel, and a drain. The level rises in the sight glass on a slow, slightly sloshing spring; the meniscus is lit.",
      native: 'role="meter" or role="progressbar"',
      keys: [],
      examples: [
        { id: "default", title: "Default", text: "A level within a range, with alarm marks.", code: `<Tank label="Rainwater tank" value={3400} max={5000}\n  low={800} high={4600} format={(v) => \`\${v} litres\`} />`, render: (f) => <Tank finish={f} label="Rainwater tank" value={3400} max={5000} low={800} high={4600} format={(v) => `${v} litres`} /> },
        { id: "progress", title: "Progress", text: "Filling as work goes up.", code: `<Tank role="progressbar" label="Upload" value={percent} />`, render: (f) => <TankFill finish={f} /> },
      ],
      props: [
        { name: "value", type: "number", def: "min", desc: "The level shown in the sight glass." },
        { name: "min", type: "number", def: "0", desc: "Bottom of the scale." },
        { name: "max", type: "number", def: "100", desc: "Top of the scale." },
        { name: "low", type: "number", desc: "Marks a low threshold on the glass scale." },
        { name: "high", type: "number", desc: "Marks a high threshold on the glass scale." },
        { name: "role", type: '"meter" | "progressbar"', def: '"meter"', desc: "A level within a range, or work toward completion." },
        { name: "format", type: "(v: number) => string", desc: "Sets aria-valuetext." },
        ...base(["name", "disabled"]),
      ],
    },
    {
      ...meta("track"),
      object: "A narrow-gauge rail line: rails spiked to sleepers on a ballast bed, station posts with hooded signal lamps and name plates, and a buffer stop. A pump handcar rolls to the current station, its wheels turning and its beam rocking; passed lamps are lit, the current one with the accent.",
      native: 'role="progressbar" + a hidden <ol>',
      keys: [["Tab", "Each reached step (when clickable)"], ["Enter / Space", "Go back to that step"], ["Click a reached station", "The same, when clickable"]],
      examples: [
        { id: "default", title: "Default", text: "Checkout, at the third step.", code: `<Track label="Checkout" steps={["Cart", "Ship", "Pay", "Done"]} current={2} />`, render: (f) => <Track finish={f} label="Checkout" steps={["Cart", "Ship", "Pay", "Done"]} current={2} /> },
        { id: "clickable", title: "Going back", text: "With clickable, reached stations are buttons.", code: `const [step, setStep] = useState(3);\n\n<Track label="Setup" current={step} clickable onStepChange={setStep}\n  steps={["Account", "Team", "Repo", "Deploy", "Invite"]} />`, render: (f) => <TrackOnboarding finish={f} /> },
      ],
      props: [
        { name: "steps", type: "string[]", def: '["Cart","Ship","Pay","Done"]', desc: "The stations, in order. Plates show up to 6 characters." },
        { name: "current", type: "number", def: "0", desc: "Index of the current step." },
        { name: "clickable", type: "boolean", def: "false", desc: "Makes passed and current stations buttons." },
        { name: "onStepChange", type: "(index: number) => void", desc: "When a reached station is pressed." },
        ...base(["name", "disabled"]),
      ],
    },
    {
      ...meta("annunciator"),
      object: "An annunciator panel: a screwed bezel holding a grid of square lamps with engraved legends, and a TEST push-button. Off is dark, ok is lit, warn lights in the accent and alert blinks at 1.4 Hz. The test button lights every lamp for a second.",
      native: 'role="group" + a hidden <ul> and live region',
      keys: [["Tab", "The lamp-test button"], ["Enter / Space", "Lamp test"]],
      examples: [
        { id: "default", title: "Default", text: "Four services.", code: `<Annunciator label="Service health" items={[\n  { id: "api", label: "API", state: "ok" },\n  { id: "db", label: "DB", state: "ok" },\n  { id: "queue", label: "QUEUE", state: "warn" },\n  { id: "auth", label: "AUTH", state: "ok" },\n]} />`, render: (f) => <Annunciator finish={f} label="Service health" items={[{ id: "api", label: "API", state: "ok" }, { id: "db", label: "DB", state: "ok" }, { id: "queue", label: "QUEUE", state: "warn" }, { id: "auth", label: "AUTH", state: "ok" }]} /> },
        { id: "live", title: "Live states", text: "Eight lamps in two rows; states change as your data does. Warn and alert are announced.", code: `<Annunciator label="Edge cluster" columns={4}\n  items={services.map((s) => ({ id: s.id, label: s.name, state: s.state }))} />`, render: (f) => <AnnunciatorLive finish={f} /> },
      ],
      props: [
        { name: "items", type: '{ id: string; label: string; state: "off" | "ok" | "warn" | "alert" }[]', desc: "The lamps in reading order. Legends up to 6 characters." },
        { name: "columns", type: "number", def: "4", desc: "Lamps per row." },
        { name: "onTest", type: "() => void", desc: "When the lamp-test button is pressed." },
        ...base(["name", "disabled"]),
      ],
    },
  ];
}
