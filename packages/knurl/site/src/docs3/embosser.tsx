import { type CSSProperties, type ReactNode } from "react";
import { Auto, typing } from "../auto";
import { Embosser } from "@in-c0/knurl/react";
import type { Finish } from "@in-c0/knurl";
import type { Doc, Prop } from "../data";

const Readout = ({ children }: { children: ReactNode }) => <output className="readout">{children}</output>;

const AutoEmbosser = ({ finish, label, words, ms = 420, style, ...rest }: { finish: Finish; label: string; words: string[]; ms?: number; style?: CSSProperties; maxLength?: number; uppercase?: boolean }) =>
  <Auto init="" next={typing(words, 4)} ms={ms}>{(v, set) => <Embosser finish={finish} label={label} value={v} onValueChange={set} style={style} {...rest} />}</Auto>;

function EmbosserShelf({ finish }: { finish: Finish }) {
  return <Auto init="" next={typing(["SPICES", "FLOUR"], 4)} ms={420}>{(text, setText) => (
    <div className="demo-col">
      <Embosser finish={finish} label="Shelf label" maxLength={8} value={text} onValueChange={setText} />
      <Readout>{text ? `${text.length} of 8 · ${text}` : "Type a label"}</Readout>
    </div>
  )}</Auto>;
}

export function doc(meta: (id: string) => Pick<Doc, "id" | "name" | "role" | "summary" | "group">, base: (exclude?: string[]) => Prop[]): Doc {
  return {
    ...meta("embosser"),
    object: "A handheld label maker: a head with a character dial under a lit index shoe and a knurled hub, a nose with the cutter where the tape comes out, a grip with a window onto the tape reel, and a squeeze lever on a pivot pin held open by its spring. Each typed character turns the dial to it, squeezes the lever and feeds the tape out with the letter raised on it; Backspace draws the tape back in a letter.",
    native: '<input type="text">',
    keys: [["Type", "Emboss the character and feed the tape"], ["Backspace", "Draw the tape back in by one letter"], ["← → Home End", "Move the caret, as in any text field"], ["Click the label maker", "Focus the field; the lever gives under the hand"]],
    examples: [
      { id: "default", title: "Default", text: "Up to 16 characters, embossed in capitals.", code: `<Embosser label="Label" />`, render: (f) => <AutoEmbosser finish={f} label="Label" words={["HELLO", "KNURL"]} /> },
      { id: "controlled", title: "Controlled, with a limit", text: "maxLength sets how much tape there is: the letters close up to fit it.", code: `const [text, setText] = useState("");\n\n<Embosser label="Shelf label" maxLength={8} value={text} onValueChange={setText} />`, render: (f) => <EmbosserShelf finish={f} /> },
      { id: "case", title: "Keeping the case", text: "With uppercase off, the tape takes the characters as typed.", code: `<Embosser label="File tab" uppercase={false} placeholder="Name the folder" />`, render: (f) => <AutoEmbosser finish={f} label="File tab" uppercase={false} words={["Taxes", "Receipts"]} /> },
    ],
    props: [
      { name: "value", type: "string", desc: "Controlled text. Pair with onValueChange." },
      { name: "defaultValue", type: "string", def: '""', desc: "Starting text when uncontrolled." },
      { name: "onValueChange", type: "(value: string) => void", desc: "Called with the text on every change." },
      { name: "maxLength", type: "number", def: "16", desc: "The most characters the tape takes." },
      { name: "uppercase", type: "boolean", def: "true", desc: "Emboss in capitals; the value is upper-cased with the tape." },
      { name: "placeholder", type: "string", desc: "The native field's placeholder, for screen readers; the tape starts blank." },
      ...base(),
    ],
  };
}

/** The gallery cell: a word typed in letter by letter, held, then cleared. */
export function Hero({ finish }: { finish: Finish }) {
  return <AutoEmbosser finish={finish} label="Label" words={["KNURL", "LABEL"]} style={{ width: 290 }} />;
}
