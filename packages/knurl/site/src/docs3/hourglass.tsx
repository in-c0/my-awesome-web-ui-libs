import type { ReactNode } from "react";
import { Auto } from "../auto";
import { Hourglass } from "@in-c0/knurl/react";
import type { Finish } from "@in-c0/knurl";
import type { Doc, Prop } from "../data";

/** Hourglass: progress, built as a sand glass in a turned frame. */

type Meta = (id: string) => Pick<Doc, "id" | "name" | "role" | "summary" | "group">;
type Base = (exclude?: string[]) => Prop[];

const Readout = ({ children }: { children: ReactNode }) => <output className="readout">{children}</output>;
// work in steps of a fifth, then a pause at done, then start over
const step = (x: number) => (x >= 100 ? 0 : Math.min(100, x + 20));

function HourglassExport({ finish }: { finish: Finish }) {
  return <Auto init={20} next={step} ms={1600} tap="[data-knurl=hourglass]">{(v) => (
    <div className="demo-row">
      <Hourglass finish={finish} label="Export" value={v} />
      <Readout>{v >= 100 ? "Exported" : `${v}% exported`}</Readout>
    </div>
  )}</Auto>;
}

function HourglassPaused({ finish }: { finish: Finish }) {
  return <Auto init={true} next={(b: boolean) => !b} ms={3200}>{(run, setRun) => (
    <div className="demo-col">
      <Hourglass finish={finish} label="Syncing" running={run} />
      <button className="btn sm" onClick={() => setRun(!run)}>{run ? "Pause" : "Resume"}</button>
    </div>
  )}</Auto>;
}

export function doc(meta: Meta, base: Base): Doc {
  return {
    ...meta("hourglass"),
    object: "A sand glass in a turned frame: two end caps with a boss and a groove, three beaded spindles, and a glass of two bulbs whose domes sit in turned cups. Sand streams through the neck, the top charge sinks with a crater over the neck and the pile below grows as a cone. Indeterminate, it turns the whole glass end over end when the top runs empty, slow to start and with a small overshoot, the sand sliding across as it passes level.",
    native: 'role="progressbar" (aria-valuenow, or aria-busy)',
    keys: [["Click", "Indeterminate: the rest of the sand rushes through and the glass turns over"]],
    examples: [
      { id: "default", title: "Determinate", text: "value from 0 to max splits the sand; it moves to a new value smoothly. Click it to step the demo.", code: `<Hourglass label="Export" value={percent} />`, render: (f) => <HourglassExport finish={f} /> },
      { id: "indeterminate", title: "Indeterminate", text: "Without a value it runs on its own and turns itself over, like a real hourglass. Click it and the rest of the sand rushes through, then it turns. Under reduced motion it holds still.", code: `<Hourglass label="Loading" />`, render: (f) => <Hourglass finish={f} label="Loading" /> },
      { id: "paused", title: "Paused", text: "running={false} holds the sand where it is and sets aria-busy to false.", code: `<Hourglass label="Syncing" running={running} />`, render: (f) => <HourglassPaused finish={f} /> },
    ],
    props: [
      { name: "value", type: "number", desc: "Progress from 0 to max. Leave it out for an indeterminate glass." },
      { name: "max", type: "number", def: "100", desc: "The value that means done; pass 1 for a 0–1 fraction." },
      { name: "running", type: "boolean", def: "true", desc: "Whether sand runs. False pauses an indeterminate glass and stops the stream." },
      ...base(["name", "disabled"]),
    ],
  };
}

export function Hero({ finish }: { finish: Finish }) {
  return <Hourglass finish={finish} label="Loading" style={{ width: 130 }} />;
}
