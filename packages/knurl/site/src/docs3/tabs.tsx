import { Auto, cycle } from "../auto";
import { Tabs } from "@in-c0/knurl/react";
import type { Finish } from "@in-c0/knurl";
import type { Doc, Prop } from "../data";

/** Tabs: a tablist, built as a card-index drawer. */

type Meta = (id: string) => Pick<Doc, "id" | "name" | "role" | "summary" | "group">;
type Base = (exclude?: string[]) => Prop[];

const next = (n: number) => (i: number) => (i + 1) % n;

const AutoTabs = ({ finish, label, tabs, init = 0, width }: { finish: Finish; label: string; tabs?: string[]; init?: number; width?: number }) =>
  <Auto init={init} next={next(tabs?.length ?? 4)} ms={2000}>{(v, set) => <Tabs finish={finish} label={label} tabs={tabs} value={v} onValueChange={set} style={width ? { width } : undefined} />}</Auto>;

const PANELS = [
  { tab: "Specs", text: "Aluminium body, 1.2 kg, USB-C." },
  { tab: "Price", text: "$249, or $21 a month." },
  { tab: "Ship", text: "Ships in 2 days, free over $100." },
  { tab: "FAQ", text: "Two-year warranty, 30-day returns." },
];

function TabsPanels({ finish }: { finish: Finish }) {
  return <Auto init={0} next={next(PANELS.length)} ms={2200}>{(v, set) => (
    <div className="demo-col">
      <Tabs finish={finish} label="Product details" tabs={PANELS.map((p) => p.tab)} ids={PANELS.map((_, i) => `panel-${i}`)} value={v} onValueChange={set} />
      {PANELS.map((p, i) => (
        <div key={p.tab} id={`panel-${i}`} role="tabpanel" aria-label={p.tab} hidden={i !== v} className="readout" tabIndex={0}>{p.text}</div>
      ))}
    </div>
  )}</Auto>;
}

const MAIL = ["Inbox", "Sent", "Drafts", "Spam", "Trash", "Arch"];

export function doc(meta: Meta, base: Base): Doc {
  return {
    ...meta("tabs"),
    object: "A card-index drawer: a dovetailed wooden drawer with a brass label holder and a cup pull, holding a run of record cards against a follower block. Each tab is a guide card with its tab cut at its own place along the top, so every label shows. The selected card rises out of the drawer with a signal clip on its tab; switching drops the old card, lifts the new one, and the record cards beside them jostle.",
    native: 'role="tablist" with role="tab" <button>s',
    keys: [
      ["Tab", "Into the selected tab, then on to your panel"],
      ["← → (↑ ↓)", "Previous or next tab, wrapping; selection follows focus"],
      ["Home / End", "First or last tab"],
      ["Press a card's tab", "Select it at once"],
      ["Press the drawer", "The next tab"],
    ],
    examples: [
      { id: "default", title: "Default", text: "Four tabs; the app renders the selected panel.", code: `const [tab, setTab] = useState(0);\n\n<Tabs label="Product" tabs={["Home", "Specs", "Price", "Notes"]}\n  value={tab} onValueChange={setTab} />`, render: (f) => <AutoTabs finish={f} label="Product" /> },
      { id: "panels", title: "Linked to your panels", text: "The panels are yours. Give each one an id and pass the ids, so each tab's aria-controls points at its panel.", code: `<Tabs label="Product details" tabs={["Specs", "Price", "Ship", "FAQ"]}\n  ids={["panel-0", "panel-1", "panel-2", "panel-3"]}\n  value={tab} onValueChange={setTab} />\n\n{panels.map((p, i) => (\n  <div key={i} id={\`panel-\${i}\`} role="tabpanel" hidden={i !== tab}>{p}</div>\n))}`, render: (f) => <TabsPanels finish={f} /> },
      { id: "six", title: "Six tabs", text: "Up to six short labels read well; each tab is cut further along the card.", code: `<Tabs label="Mail" tabs={["Inbox", "Sent", "Drafts", "Spam", "Trash", "Arch"]} />`, render: (f) => <Auto init={2} next={cycle([0, 1, 2, 3, 4, 5], true)} ms={1800}>{(v, set) => <Tabs finish={f} label="Mail" tabs={MAIL} value={v} onValueChange={set} />}</Auto> },
    ],
    props: [
      { name: "tabs", type: "string[]", def: '["Home","Specs","Price","Notes"]', desc: "The tabs, front card first. The cards show up to 6 characters; the buttons carry the full label." },
      { name: "value", type: "number", desc: "Controlled index of the selected tab. Pair with onValueChange." },
      { name: "defaultValue", type: "number", def: "0", desc: "Starting index when uncontrolled." },
      { name: "onValueChange", type: "(index: number) => void", desc: "Called with the new index, from pointer or keys." },
      { name: "ids", type: "string[]", desc: "Your panels' element ids in tab order: each tab gets aria-controls for its panel." },
      ...base(["name"]),
    ],
  };
}

export function Hero({ finish }: { finish: Finish }) {
  return <AutoTabs finish={finish} label="Tabs" init={1} width={250} />;
}
