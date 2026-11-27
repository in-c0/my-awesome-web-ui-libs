import { type CSSProperties, type ReactNode } from "react";
import { Auto, cycle } from "../auto";
import { Flap } from "@in-c0/knurl/react";
import type { Finish } from "@in-c0/knurl";
import type { Doc, Prop } from "../data";

const Readout = ({ children }: { children: ReactNode }) => <output className="readout">{children}</output>;

const ALPHA = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const GATES = ["LHR", "CDG", "JFK", "HND", "SYD", "DXB"];
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
// a day picked at random, never the one showing: going back makes the drum run the long way round
const anyDay = (d: string) => { const rest = DAYS.filter((x) => x !== d); return rest[Math.floor(Math.random() * rest.length)]; };

const AutoFlap = ({ finish, label, options, init, ms, style }: { finish: Finish; label: string; options?: string[]; init: string; ms: number; style?: CSSProperties }) =>
  <Auto init={init} next={cycle(options ?? ALPHA)} ms={ms}>{(v, set) => <Flap finish={finish} label={label} options={options} value={v} onValueChange={set} style={style} />}</Auto>;

function FlapDepartures({ finish }: { finish: Finish }) {
  return <Auto init="CDG" next={cycle(GATES)} ms={1800}>{(to, setTo) => (
    <div className="demo-row">
      <Flap finish={finish} label="Destination" options={GATES} value={to} onValueChange={setTo} />
      <Readout>Next train to {to}</Readout>
    </div>
  )}</Auto>;
}

function FlapDays({ finish }: { finish: Finish }) {
  return <Auto init="WED" next={anyDay} ms={2600}>{(day, setDay) => (
    <div className="demo-col">
      <Flap finish={finish} label="Delivery day" name="day" options={DAYS} value={day} onValueChange={setDay} />
      <Readout>Deliver on {day.toLowerCase()}</Readout>
    </div>
  )}</Auto>;
}

export function doc(meta: (id: string) => Pick<Doc, "id" | "name" | "role" | "summary" | "group">, base: (exclude?: string[]) => Prop[]): Doc {
  return {
    ...meta("flap"),
    object: "One split-flap module from a station board: a housing on a mounting plate holds a drum of hinged flaps behind a window, the top half of the option on the top flap and the bottom half on the back of the one that fell before it. To change, flaps fall forward one after another, each in about 80 ms with a bounce on the stack; going back means going all the way round. On the side, a ratchet and pawl and a knurled advance wheel turn with the drum, and the lamp lights while it runs.",
    native: "<select>",
    keys: [["↑ ↓", "The option before or after; the flaps run forward to it"], ["Home / End", "First or last option"], ["Type a letter", "The first option that starts with it"], ["Click the module", "Drop the next flap"], ["Drag the wheel down, or scroll", "Turn the drum on a flap at a time"]],
    examples: [
      { id: "default", title: "Default", text: "The letters A to Z, one flap each.", code: `<Flap label="Letter" />`, render: (f) => <AutoFlap finish={f} label="Letter" init="A" ms={1200} /> },
      { id: "controlled", title: "Controlled, with wide flaps", text: "Up to six characters show on a flap; the module widens to the longest.", code: `const gates = ["LHR", "CDG", "JFK", "HND", "SYD", "DXB"];\nconst [to, setTo] = useState("CDG");\n\n<Flap label="Destination" options={gates} value={to} onValueChange={setTo} />`, render: (f) => <FlapDepartures finish={f} /> },
      { id: "round", title: "The long way round", text: "Flaps only fall forward: choosing an earlier option runs the drum on through the end and back to it.", code: `<Flap label="Delivery day" name="day" value={day} onValueChange={setDay}\n  options={["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]} />`, render: (f) => <FlapDays finish={f} /> },
    ],
    props: [
      { name: "options", type: "string[]", def: "A to Z", desc: "The flaps, in drum order. Up to 6 characters show." },
      { name: "value", type: "string", desc: "Controlled option. Pair with onValueChange." },
      { name: "defaultValue", type: "string", def: "the first option", desc: "Starting option when uncontrolled." },
      { name: "onValueChange", type: "(value: string) => void", desc: "Called with the chosen option, by click, wheel or keyboard." },
      ...base(),
    ],
  };
}

/** The gallery cell: a destination board cycling its codes. */
export function Hero({ finish }: { finish: Finish }) {
  return <AutoFlap finish={finish} label="Destination" options={GATES} init="LHR" ms={1800} style={{ width: 220 }} />;
}
