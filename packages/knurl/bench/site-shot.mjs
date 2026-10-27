// usage: node bench/site-shot.mjs <hash> <out> [width] [theme] [fullPage]
import { chromium } from "/home/claude/tools/node_modules/playwright/index.mjs";
const [hash = "", out, w = "1440", theme = "light", full = "1"] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(w), height: 900 }, deviceScaleFactor: 1, colorScheme: theme });
p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
p.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text()));
await p.goto("http://localhost:4173/" + (hash ? "#" + hash : ""));
await p.waitForTimeout(1500);
const sw = await p.evaluate(() => document.documentElement.scrollWidth);
if (sw > Number(w)) console.log("OVERFLOW", sw);
await p.screenshot({ path: out, fullPage: full === "1" });
await b.close();
