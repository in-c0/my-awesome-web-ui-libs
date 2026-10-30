import { type CSSProperties, type ReactNode } from "react";
import { Auto } from "../auto";
import { Dip } from "@in-c0/knurl/react";
import type { Finish } from "@in-c0/knurl";
import type { Doc, Prop } from "../data";

const Readout = ({ children }: { children: ReactNode }) => <output className="readout">{children}</output>;

// one switch flips per tick, never the same one twice running
const flipBit = (count: number) => (v: number, i: number) => v ^ (1 << ((i * 5 + 2) % count));
const bin = (v: number, n: number) => v.toString(2).padStart(n, "0");

const AutoDip = ({ finish, label, count, init, style }: { finish: Finish; label: string; count?: number; init: number; style?: CSSProperties }) =>
  <Auto init={init} next={flipBit(count ?? 8)} ms={1800}>{(v, set) => <Dip finish={finish} label={label} count={count} value={v} onValueChange={set} style={style} />}</Auto>;

function DipAddress({ finish }: { finish: Finish }) {
  return <Auto init={5} next={flipBit(4)} ms={1800}>{(v, setV) => (
    <div className="demo-row">
      <Dip finish={finish} label="Device address" count={4} value={v} onValueChange={setV} style={{ width: 190 }} />
      <Readout>Address 0x{v.toString(16).toUpperCase()}</Readout>
    </div>
  )}</Auto>;
}
const FLAGS = ["Boot from USB", "Verbose log", "Safe mode", "Fan always on", "Dim LEDs", "Factory reset"];
function DipFlags({ finish }: { finish: Finish }) {
  return <Auto init={0b010010} next={flipBit(6)} ms={2200}>{(v, setV) => (
    <div className="demo-row">
      <Dip finish={finish} label="Boot options" count={6} labels={FLAGS} value={v} onValueChange={setV} style={{ width: 220 }} />
      <ul className="demo-list">{FLAGS.map((f, i) => <li key={f}>{(v >> i) & 1 ? "●" : "○"} {f}</li>)}</ul>
    </div>
  )}</Auto>;
}

export function doc(meta: (id: string) => Pick<Doc, "id" | "name" | "role" | "summary" | "group">, base: (exclude?: string[]) => Prop[]): Doc {
  return {
    ...meta("dip"),
    object: "A DIP switch on a circuit board: a moulded package on gull-wing pins over the board's pads, a row of tiny sliders in their slots with ON along one edge and the positions numbered along the other. Behind it a row of LEDs, each wired to its switch by a trace, lights for every bit that is on.",
    native: '<input type="checkbox"> × count in role="group"',
    keys: [["Tab", "Each position in turn"], ["Space", "Flip the focused position; its slider is held while the key is down"], ["Click a position", "Flip it"], ["Click the board", "Flip the nearest position"]],
    examples: [
      { id: "default", title: "Default", text: "Eight positions; the value is a bitmask, position 1 being bit 0.", code: `const [bits, setBits] = useState(0b10100101);\n\n<Dip label="Config" value={bits} onValueChange={setBits} />`, render: (f) => <Auto init={0b10100101} next={flipBit(8)} ms={1800}>{(v, set) => <div className="demo-col"><Dip finish={f} label="Config" value={v} onValueChange={set} /><Readout>0b{bin(v, 8)}</Readout></div>}</Auto> },
      { id: "address", title: "An address", text: "Four switches set a device address, as on a bus card.", code: `<Dip label="Device address" count={4}\n  value={address} onValueChange={setAddress} />`, render: (f) => <DipAddress finish={f} /> },
      { id: "flags", title: "Named flags", text: "labels names each checkbox for screen readers; the drawing keeps its numbers.", code: `<Dip label="Boot options" count={6} value={flags} onValueChange={setFlags}\n  labels={["Boot from USB", "Verbose log", "Safe mode",\n    "Fan always on", "Dim LEDs", "Factory reset"]} />`, render: (f) => <DipFlags finish={f} /> },
    ],
    props: [
      { name: "count", type: "number", def: "8", desc: "How many positions, 2 to 12." },
      { name: "value", type: "number", desc: "Controlled bitmask: bit i is position i + 1. Pair with onValueChange." },
      { name: "defaultValue", type: "number", def: "0", desc: "Starting bitmask when uncontrolled." },
      { name: "onValueChange", type: "(value: number) => void", desc: "Called with the new bitmask." },
      { name: "labels", type: "string[]", def: '"Switch 1"…', desc: "Accessible names for the positions, in order." },
      ...base(),
    ],
  };
}

export function Hero({ finish }: { finish: Finish }) {
  return <AutoDip finish={finish} label="Config" init={0b10100101} style={{ width: 240 }} />;
}
