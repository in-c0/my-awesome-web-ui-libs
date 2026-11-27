import { type CSSProperties, type ReactNode } from "react";
import { Auto } from "../auto";
import { Breakers } from "@in-c0/knurl/react";
import type { Finish } from "@in-c0/knurl";
import type { Doc, Prop } from "../data";

const Readout = ({ children }: { children: ReactNode }) => <output className="readout">{children}</output>;

const HOUSE = [{ id: "lights", label: "LIGHT" }, { id: "plugs", label: "PLUGS" }, { id: "oven", label: "OVEN" }, { id: "heat", label: "HEAT" }];
const ROW = [{ id: "l1", label: "L1" }, { id: "l2", label: "L2" }, { id: "pump", label: "PUMP" }, { id: "fan", label: "FAN" }, { id: "aux", label: "AUX" }, { id: "ups", label: "UPS" }];
// one breaker trips or resets per tick, walking along the row
const flipOne = (list: { id: string }[]) => (ids: string[], i: number) => {
  const id = list[(i * 5 + 1) % list.length].id;
  return ids.includes(id) ? ids.filter((x) => x !== id) : list.filter((x) => x.id === id || ids.includes(x.id)).map((x) => x.id);
};

const AutoBreakers = ({ finish, label, items, init, style }: { finish: Finish; label: string; items: { id: string; label: string }[]; init: string[]; style?: CSSProperties }) =>
  <Auto init={init} next={flipOne(items)} ms={2000}>{(v, set) => <Breakers finish={finish} label={label} items={items} value={v} onValueChange={set} style={style} />}</Auto>;

function BreakersHouse({ finish }: { finish: Finish }) {
  return <Auto init={["lights", "plugs"]} next={flipOne(HOUSE)} ms={2000}>{(on, setOn) => (
    <div className="demo-col">
      <Breakers finish={finish} label="House circuits" items={HOUSE} value={on} onValueChange={setOn} />
      <Readout>{on.length ? HOUSE.filter((x) => on.includes(x.id)).map((x) => x.label.toLowerCase()).join(" · ") : "all off"}</Readout>
    </div>
  )}</Auto>;
}

export function doc(meta: (id: string) => Pick<Doc, "id" | "name" | "role" | "summary" | "group">, base: (exclude?: string[]) => Prop[]): Doc {
  return {
    ...meta("breakers"),
    object: "A circuit-breaker panel: miniature breakers clipped to a DIN rail between two end stops, each with its terminal screws, wire entries, circuit label and a toggle handle in a slot on its raised front. Up is on. The handle throws across and rebounds off its stop, and a flag window in front of it lights when the circuit is on.",
    native: '<input type="checkbox"> × n in role="group"',
    keys: [["Tab", "Each breaker in turn"], ["Space", "Toggle the focused breaker; its handle is held while the key is down"], ["Click a breaker", "Toggle it"], ["Click the panel beside one", "Toggle the nearest breaker"]],
    examples: [
      { id: "default", title: "Default", text: "Four sample circuits, uncontrolled.", code: `<Breakers label="Circuits" defaultValue={["lights"]} />`, render: (f) => <AutoBreakers finish={f} label="Circuits" items={HOUSE} init={["lights"]} /> },
      { id: "controlled", title: "Controlled", text: "value is the ids that are on, in the items' order.", code: `const [on, setOn] = useState(["lights", "plugs"]);\n\n<Breakers label="House circuits" value={on} onValueChange={setOn}\n  items={[\n    { id: "lights", label: "LIGHT" },\n    { id: "plugs", label: "PLUGS" },\n    { id: "oven", label: "OVEN" },\n    { id: "heat", label: "HEAT" },\n  ]} />`, render: (f) => <BreakersHouse finish={f} /> },
      { id: "row", title: "A longer row", text: "Six breakers on one rail; short labels read best.", code: `<Breakers label="Plant room" name="circuits"\n  items={["L1", "L2", "PUMP", "FAN", "AUX", "UPS"].map((l) => ({ id: l.toLowerCase(), label: l }))}\n  defaultValue={["l1", "pump", "ups"]} />`, render: (f) => <AutoBreakers finish={f} label="Plant room" items={ROW} init={["l1", "pump", "ups"]} style={{ width: 360 }} /> },
    ],
    props: [
      { name: "items", type: "{ id: string; label: string }[]", def: "four sample circuits", desc: "The breakers, left to right. Labels show their first 5 characters; the full label is each checkbox's name." },
      { name: "value", type: "string[]", desc: "Controlled: the ids that are on. Pair with onValueChange." },
      { name: "defaultValue", type: "string[]", def: "[]", desc: "The ids that start on when uncontrolled." },
      { name: "onValueChange", type: "(ids: string[]) => void", desc: "Every id that is on, in the items' order." },
      ...base(),
    ],
  };
}

export function Hero({ finish }: { finish: Finish }) {
  return <AutoBreakers finish={finish} label="Circuits" items={HOUSE} init={["lights", "oven"]} style={{ width: 270 }} />;
}
