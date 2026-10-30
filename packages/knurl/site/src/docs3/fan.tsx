import type { ReactNode } from "react";
import { Auto, cycle } from "../auto";
import { Fan } from "@in-c0/knurl/react";
import type { Finish } from "@in-c0/knurl";
import type { Doc, Prop } from "../data";

/** Fan: a colour choice, built as a paint fan deck. */

type Meta = (id: string) => Pick<Doc, "id" | "name" | "role" | "summary" | "group">;
type Base = (exclude?: string[]) => Prop[];

// the control's own eight paint colours, in fan order
const PAINT = ["#28354d", "#2f6f73", "#8aa27a", "#d8a23d", "#c8643b", "#9b3a35", "#6d4c6f", "#b7aea0"];
const BRAND = [
  { value: "#0f172a", label: "Slate 900" },
  { value: "#2563eb", label: "Blue 600" },
  { value: "#0d9488", label: "Teal 600" },
  { value: "#f59e0b", label: "Amber 500" },
  { value: "#e11d48", label: "Rose 600" },
];
const NAMES: Record<string, string> = Object.fromEntries(BRAND.map((c) => [c.value, c.label]));

const Readout = ({ children }: { children: ReactNode }) => <output className="readout">{children}</output>;
const Swatch = ({ colour }: { colour: string }) => <span aria-hidden="true" style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: colour, marginRight: 8, verticalAlign: "-1px" }} />;

const AutoFan = ({ finish, label, init, width }: { finish: Finish; label: string; init: string; width?: number }) =>
  <Auto init={init} next={cycle(PAINT, true)} ms={2000}>{(v, set) => <Fan finish={finish} label={label} value={v} onValueChange={set} style={width ? { width } : undefined} />}</Auto>;

function FanBrand({ finish }: { finish: Finish }) {
  return <Auto init="#2563eb" next={cycle(BRAND.map((c) => c.value), true)} ms={2000}>{(v, set) => (
    <div className="demo-row">
      <Fan finish={finish} label="Accent colour" options={BRAND} value={v} onValueChange={set} />
      <Readout><Swatch colour={v} />{NAMES[v]} · {v}</Readout>
    </div>
  )}</Auto>;
}

function FanForm({ finish }: { finish: Finish }) {
  return <Auto init="#8aa27a" next={cycle(PAINT)} ms={2200}>{(v, set) => (
    <form className="demo-col" onSubmit={(e) => e.preventDefault()}>
      <Fan finish={finish} label="Wall colour" name="wall" value={v} onValueChange={set} />
      <Readout>wall={v}</Readout>
    </form>
  )}</Auto>;
}

export function doc(meta: Meta, base: Base): Doc {
  return {
    ...meta("fan"),
    object: "A paint fan deck: colour strips riveted on a slotted Chicago screw between two heavier covers, fanned open, each with its chip at the far end, a printed number and code lines. The chosen strip rides up the screw's barrel above the stack, tips its far end up and swings clear while its neighbours shuffle aside; its chip is outlined and its end marked with the accent.",
    native: '<input type="radio"> × n in role="radiogroup"',
    keys: [
      ["Arrow keys", "Next or previous colour"],
      ["Press a strip", "Pick it at once"],
      ["Drag across the fan", "Pick each strip the pointer passes"],
      ["Press beside the fan", "The strip in that direction"],
      ["Press the rivet", "The next colour round"],
    ],
    examples: [
      { id: "default", title: "Default", text: "Eight paint colours.", code: `<Fan label="Wall colour" onValueChange={(c) => paint(c)} />`, render: (f) => <AutoFan finish={f} label="Wall colour" init="#c8643b" /> },
      { id: "brand", title: "Your own palette", text: "Any CSS colours, each with a name for screen readers. The chips are filled with them; the rest of the deck follows the theme.", code: `const [accent, setAccent] = useState("#2563eb");\n\n<Fan label="Accent colour" value={accent} onValueChange={setAccent}\n  options={[\n    { value: "#0f172a", label: "Slate 900" },\n    { value: "#2563eb", label: "Blue 600" },\n    { value: "#0d9488", label: "Teal 600" },\n    { value: "#f59e0b", label: "Amber 500" },\n    { value: "#e11d48", label: "Rose 600" },\n  ]} />`, render: (f) => <FanBrand finish={f} /> },
      { id: "form", title: "In a form", text: "With name, the chosen colour submits with the form.", code: `<form>\n  <Fan label="Wall colour" name="wall" defaultValue="#8aa27a" />\n</form>`, render: (f) => <FanForm finish={f} /> },
    ],
    props: [
      { name: "options", type: "{ value: string; label: string }[]", def: "8 paint colours", desc: "The strips in fan order: value is any CSS colour (and the value reported), label its accessible name." },
      { name: "value", type: "string", desc: "Controlled colour. Pair with onValueChange." },
      { name: "defaultValue", type: "string", def: "options[0].value", desc: "Starting colour when uncontrolled." },
      { name: "onValueChange", type: "(value: string) => void", desc: "Called with the chosen colour's value." },
      ...base(),
    ],
  };
}

export function Hero({ finish }: { finish: Finish }) {
  return <AutoFan finish={finish} label="Colour" init="#d8a23d" width={250} />;
}
