import type { ComponentProps, CSSProperties } from "react";
import { Auto } from "../auto";
import { Printer } from "@in-c0/knurl/react";
import type { Finish } from "@in-c0/knurl";
import type { Doc, Prop } from "../data";

type PrinterMessage = NonNullable<ComponentProps<typeof Printer>["messages"]>[number];
type Line = Omit<PrinterMessage, "id">;
const BUILD: Line[] = [
  { text: "Build #412 passed", tone: "ok" },
  { text: "Deploying to staging", tone: "info" },
  { text: "Disk 82% full on db-2", tone: "warn" },
  { text: "Staging is live", tone: "ok" },
  { text: "Health check failed", tone: "alert" },
  { text: "Rolled back to #411", tone: "info" },
];
const ORDERS: Line[] = [
  { text: "Table 4 · 2 flat white", tone: "info" },
  { text: "Table 9 · ramen, no egg", tone: "info" },
  { text: "Out of oat milk", tone: "warn" },
  { text: "Table 4 paid", tone: "ok" },
  { text: "Table 2 · 3 bao", tone: "info" },
  { text: "Fryer too hot", tone: "alert" },
  { text: "Table 9 paid", tone: "ok" },
];
/** A message log that gets the next line of `script` each tick, keeping the last few. */
const feed = (script: Line[]) => (log: PrinterMessage[], i: number) => [...log, { id: "m" + (i + 100), ...script[i % script.length] }].slice(-8);
const seed = (script: Line[], n: number): PrinterMessage[] => script.slice(0, n).map((m, i) => ({ id: "s" + i, ...m }));

const AutoPrinter = ({ finish, label, script, max, n = 2, style }: { finish: Finish; label: string; script: Line[]; max?: number; n?: number; style?: CSSProperties }) =>
  <Auto init={seed(script, n)} next={feed(script.slice(n).concat(script.slice(0, n)))} ms={1800} tap="[data-knurl=printer]">{(log) => <Printer finish={finish} label={label} messages={log} max={max} style={style} />}</Auto>;

export function doc(meta: (id: string) => Pick<Doc, "id" | "name" | "role" | "summary" | "group">, base: (exclude?: string[]) => Prop[]): Doc {
  return {
    ...meta("printer"),
    object: "A receipt printer on rubber feet, with its roll cover, the paper exit and a serrated tear bar, a FEED key and power and print lamps. Each message prints on the strip as it feeds out of the slot, so its lines appear as they pass the print head; older tickets are pushed up and, past max, torn off at the perforation. An alert's ticket carries a block in the accent, and the print lamp is lit while the paper feeds.",
    native: 'role="log" aria-live="polite" + a hidden <ul>',
    keys: [],
    examples: [
      { id: "default", title: "Default", text: "A deploy log: each new id prints a ticket. Click it to print the next.", code: `const [log, setLog] = useState<PrinterMessage[]>([]);\nconst notify = (text: string, tone?: "info" | "ok" | "warn" | "alert") =>\n  setLog((l) => [...l, { id: crypto.randomUUID(), text, tone }]);\n\n<Printer label="Deploys" messages={log} />`, render: (f) => <AutoPrinter finish={f} label="Deploys" script={BUILD} /> },
      { id: "orders", title: "A longer roll", text: "max keeps five tickets on the paper before the oldest is torn off.", code: `<Printer label="Kitchen orders" messages={orders} max={5} />`, render: (f) => <AutoPrinter finish={f} label="Kitchen orders" script={ORDERS} max={5} n={4} style={{ width: 190 }} /> },
    ],
    props: [
      { name: "messages", type: '{ id: string; text: string; tone?: "info" | "ok" | "warn" | "alert" }[]', def: "[]", desc: "Oldest first. A new id prints a ticket; the full text goes to the log, the paper shows its first few characters." },
      { name: "max", type: "number", def: "3", desc: "Tickets kept on the paper, 1 to 6, before the oldest is torn off." },
      ...base(["name", "disabled"]),
    ],
  };
}

export function Hero({ finish }: { finish: Finish }) {
  return <AutoPrinter finish={finish} label="Notifications" script={BUILD} style={{ width: 150 }} />;
}
