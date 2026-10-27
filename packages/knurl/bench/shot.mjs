// Renders controls straight from src/controls/<id>.ts and screenshots them.
//   node bench/shot.mjs <id[,id…]> <out.png> [deviceScale] [optionsJSON]
// optionsJSON: { "<id>": [ {…options for cell 1}, {…cell 2} ] } (one cell per entry; default two cells of {}).
// Env: W=<px> control width (default 132), ROWS='[["light","line"],["dark","solid"]]' (default all four).
// Each run uses its own temp files, so several can run at once.
import { build } from "esbuild";
import { chromium } from "/home/claude/tools/node_modules/playwright/index.mjs";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const [ids, out, zoom = "2", extra = "{}"] = process.argv.slice(2);
const list = ids.split(",");
const dir = mkdtempSync(join(tmpdir(), "knurl-bench-"));
const root = resolve(".");
const rows = process.env.ROWS || JSON.stringify([["light", "line"], ["light", "solid"], ["dark", "line"], ["dark", "solid"]]);
writeFileSync(join(dir, "entry.ts"), `
${list.map((id) => `import { ${id} } from ${JSON.stringify(join(root, "src/controls", id + ".ts"))};`).join("\n")}
const F: Record<string, any> = { ${list.join(", ")} };
const EXTRA = ${extra};
const ROWS = ${rows};
for (const [theme, finish] of ROWS) {
  const row = document.createElement("div"); row.className = "row " + theme; document.body.appendChild(row);
  for (const id of ${JSON.stringify(list)}) for (const o of (EXTRA[id] ?? [{}, {}])) {
    const cell = document.createElement("div"); row.appendChild(cell);
    const el = document.createElement("div"); cell.appendChild(el);
    try { F[id](el, { theme, finish, ...o }); } catch (e) { console.error(String((e && e.stack) || e)); }
  }
}`);
await build({ entryPoints: [join(dir, "entry.ts")], bundle: true, outfile: join(dir, "out.js"), format: "iife", logLevel: "error" });
writeFileSync(join(dir, "index.html"), `<!doctype html><meta charset=utf-8><style>
body{margin:0;font-family:system-ui}[data-knurl]{width:${process.env.W || 132}px!important}.row{display:flex;gap:28px;padding:28px;align-items:center;flex-wrap:wrap}.light{background:#fff}.dark{background:#09090b;color-scheme:dark}
</style><script src="out.js" defer></script>`);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 400 }, deviceScaleFactor: Number(zoom) });
p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
p.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text()));
await p.goto("file://" + join(dir, "index.html"));
await p.waitForTimeout(Number(process.env.WAIT || 1200));
await p.screenshot({ path: out, fullPage: true });
await b.close();
rmSync(dir, { recursive: true, force: true });
