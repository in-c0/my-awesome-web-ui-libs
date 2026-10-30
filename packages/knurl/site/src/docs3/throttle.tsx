import { type CSSProperties, type ReactNode } from "react";
import { Auto, cycle, wander } from "../auto";
import { Throttle } from "@in-c0/knurl/react";
import type { Finish } from "@in-c0/knurl";
import type { Doc, Prop } from "../data";

const Readout = ({ children }: { children: ReactNode }) => <output className="readout">{children}</output>;

const NOTCHES = [0, 25, 50, 75, 100];
const FLAPS = [0, 10, 20, 30, 40];
const AutoThrottle = ({ finish, label, style }: { finish: Finish; label: string; style?: CSSProperties }) =>
  <Auto init={30} next={wander(0, 100)} ms={2200}>{(v, set) => <Throttle finish={finish} label={label} value={v} onValueChange={set} style={style} />}</Auto>;

function ThrottleNotches({ finish }: { finish: Finish }) {
  return <Auto init={50} next={cycle(NOTCHES, true)} ms={1900}>{(v, setV) => (
    <div className="demo-row">
      <Throttle finish={finish} label="Power" notches={NOTCHES} value={v} onValueChange={setV} format={(x) => `${x}% power`} />
      <Readout>{v}%</Readout>
    </div>
  )}</Auto>;
}
function ThrottleFlaps({ finish }: { finish: Finish }) {
  return <Auto init={10} next={cycle(FLAPS, true)} ms={2100}>{(v, setV) => (
    <div className="demo-row">
      <Throttle finish={finish} label="Flaps" min={0} max={40} step={1} notches={FLAPS} value={v} onValueChange={setV} format={(x) => `${x}°`} />
      <Readout>Flaps {v}°</Readout>
    </div>
  )}</Auto>;
}

export function doc(meta: (id: string) => Pick<Doc, "id" | "name" | "role" | "summary" | "group">, base: (exclude?: string[]) => Prop[]): Doc {
  return {
    ...meta("throttle"),
    object: "A throttle quadrant: a lever on a pivot inside a curved housing comes up through a gate cut along the arc and ends in a grip ball, with the pivot hub and a friction-lock knob on the side. Each detent is a notch cut into the gate: the lever clicks into it when it comes near, with a small overshoot, and the notch's mark lights. The gate is lit from idle up to the lever. Forward is more.",
    native: '<input type="range" aria-orientation="vertical">',
    keys: [["↑ →", "More, by a step"], ["↓ ←", "Less, by a step"], ["Page Up / Down", "Large step"], ["Home / End", "Idle / full"], ["Press on the quadrant", "Move the lever there, into a notch if one is near"], ["Drag", "The lever follows, clicking through the notches"]],
    examples: [
      { id: "default", title: "Default", text: "0 to 100, without detents.", code: `<Throttle label="Throttle" defaultValue={30} />`, render: (f) => <AutoThrottle finish={f} label="Throttle" /> },
      { id: "notches", title: "Detents", text: "A notch every quarter; the lever clicks into one within 4% of the range.", code: `const [v, setV] = useState(50);\n\n<Throttle label="Power" notches={[0, 25, 50, 75, 100]}\n  value={v} onValueChange={setV} format={(x) => \`\${x}% power\`} />`, render: (f) => <ThrottleNotches finish={f} /> },
      { id: "flaps", title: "A flap lever", text: "Any range, with a detent at each setting.", code: `<Throttle label="Flaps" min={0} max={40} notches={[0, 10, 20, 30, 40]}\n  value={flaps} onValueChange={setFlaps} format={(x) => \`\${x}°\`} />`, render: (f) => <ThrottleFlaps finish={f} /> },
    ],
    props: [
      { name: "value", type: "number", desc: "Controlled value. Pair with onValueChange." },
      { name: "defaultValue", type: "number", def: "min", desc: "Starting value when uncontrolled." },
      { name: "min", type: "number", def: "0", desc: "Idle, with the lever back toward you." },
      { name: "max", type: "number", def: "100", desc: "Full, with the lever forward." },
      { name: "step", type: "number", def: "1", desc: "Values snap to min + k·step. 0 is continuous." },
      { name: "notches", type: "number[]", def: "[]", desc: "Values the lever clicks into, each a notch in the gate. Legends show up to 3 characters." },
      { name: "onValueChange", type: "(value: number) => void", desc: "Every change, from pointer or keys." },
      { name: "onValueCommit", type: "(value: number) => void", desc: "Once, when a drag or key press settles." },
      { name: "format", type: "(value: number) => string", desc: "Sets aria-valuetext." },
      ...base(),
    ],
  };
}

export function Hero({ finish }: { finish: Finish }) {
  return <Auto init={50} next={cycle(NOTCHES, true)} ms={1900}>{(v, set) => <Throttle finish={finish} label="Throttle" notches={NOTCHES} value={v} onValueChange={set} style={{ width: 150 }} />}</Auto>;
}
