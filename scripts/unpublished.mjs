// Lists the workspace packages whose version is not on npm yet: what the Release workflow will publish.
//   node scripts/unpublished.mjs [--github-output]
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const list = JSON.parse(execSync('pnpm -r --filter "./packages/**" ls --json --depth -1', { encoding: "utf8" }));
const pending = [];
for (const p of list) {
  if (p.private || !p.name || !p.version) continue;
  let published = false;
  try { execSync(`npm view ${p.name}@${p.version} version`, { stdio: "pipe" }); published = true; } catch { /* not on npm */ }
  console.log(`${published ? "  published  " : "→ to publish "} ${p.name}@${p.version}`);
  if (!published) pending.push(`${p.name}@${p.version}`);
}
if (process.argv.includes("--github-output") && process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `count=${pending.length}\n`);
