import type { Finish } from "@in-c0/knurl";
import { Hero } from "./data";

/**
 * #embed?ids=toggle,knob,flap&finish=line&bg=0d1117 — the chosen controls in a row with no page around them,
 * playing their demos. It is what the animated previews for READMEs are recorded from.
 */
export function Embed() {
  const q = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const ids = (q.get("ids") ?? "toggle,knob,flap,combo,hourglass,printer").split(",");
  const finish = (q.get("finish") === "solid" ? "solid" : "line") as Finish;
  const bg = /^[0-9a-f]{3,8}$/i.test(q.get("bg") ?? "") ? `#${q.get("bg")}` : undefined; // to match the page it is shown on
  return (
    <div className="embed-strip" style={bg ? { background: bg } : undefined}>
      {ids.map((id) => <div className="embed-cell" key={id}><Hero id={id} finish={finish} /></div>)}
    </div>
  );
}
