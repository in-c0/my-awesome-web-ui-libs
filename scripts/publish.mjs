// Publishes every workspace package whose version is not on npm yet.
//
// npm accepts two kinds of publishing token:
//  - direct-capable: the version goes live at once;
//  - stage-only: the version is uploaded to npm's staging area and goes live when the
//    owner approves it on npmjs.com (Staged Packages, with 2FA).
// This script tries a direct publish and, when npm answers that the token may only stage,
// stages the same tarball instead. A brand-new unscoped package cannot be staged: npm wants
// it created once with a direct-capable token.
//
//   node scripts/publish.mjs [pnpm filter]      (NODE_AUTH_TOKEN from the environment)

import { execSync, spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const filter = process.argv[2] || "./packages/**";
const list = JSON.parse(execSync(`pnpm -r --filter "${filter}" ls --json --depth -1`, { encoding: "utf8" }));
const summary = [];
const note = (line) => { console.log(line); summary.push(line); };
let failed = false;

const exists = (name) => spawnSync("npm", ["view", name, "name"], { stdio: "pipe" }).status === 0;
const published = (name, v) => spawnSync("npm", ["view", `${name}@${v}`, "version"], { stdio: "pipe" }).status === 0;

for (const p of list) {
  if (p.private || !p.name || !p.version) continue;
  if (published(p.name, p.version)) continue;
  const out = mkdtempSync(join(tmpdir(), "pack-"));
  execSync(`pnpm pack --pack-destination "${out}"`, { cwd: p.path, stdio: "inherit" });
  const tgz = join(out, readdirSync(out).find((f) => f.endsWith(".tgz")));
  const tag = JSON.parse(execSync(`node -p "JSON.stringify(require('./package.json').publishConfig ?? {})"`, { cwd: p.path, encoding: "utf8" })).tag;
  const tagArgs = tag ? ["--tag", tag] : [];

  const direct = spawnSync("npm", ["publish", tgz, "--access", "public", "--provenance", ...tagArgs], { encoding: "utf8" });
  process.stdout.write(direct.stdout); process.stderr.write(direct.stderr);
  if (direct.status === 0) { note(`✅ ${p.name}@${p.version} published${tag ? ` under ${tag}` : ""}.`); continue; }

  const text = direct.stdout + direct.stderr;
  // a stage-only token is refused a direct publish with a staging hint, an OTP demand, or (for a scoped package) a bare 403/404
  const stageOnly = /E_STAGE_REQUIRED|staging area|EOTP|one-time password|code E40[34]/i.test(text);
  if (!stageOnly) { note(`❌ ${p.name}@${p.version}: publish failed (see the log).`); failed = true; continue; }

  if (!exists(p.name) && !p.name.startsWith("@")) {
    note(`⏸ ${p.name}@${p.version}: the token can only stage, and npm will not stage a new unscoped package. Publish it once with a direct-capable token (or \`npm publish\` locally), or give it a scope you own.`);
    failed = true;
    continue;
  }
  const staged = spawnSync("npm", ["stage", "publish", tgz, "--access", "public", "--provenance", ...tagArgs], { encoding: "utf8" });
  process.stdout.write(staged.stdout); process.stderr.write(staged.stderr);
  if (staged.status === 0) note(`🕓 ${p.name}@${p.version} staged${tag ? ` under ${tag}` : ""}. Approve it on npmjs.com → Staged Packages to make it live.`);
  else if (/already (been )?staged|already exists|EPUBLISHCONFLICT|cannot publish over|E409/i.test(staged.stdout + staged.stderr)) {
    note(`🕓 ${p.name}@${p.version} is already staged and waiting for approval on npmjs.com → Staged Packages.`);
  } else {
    const why = /E404|not found|Scope not found/i.test(staged.stdout + staged.stderr)
      ? " npm could not find the scope or the token cannot write to it: check that the npm account owns the scope and that the token has write (or stage) access to it."
      : " See the log.";
    note(`❌ ${p.name}@${p.version}: direct publish and staging both failed.${why}`);
    failed = true;
  }
}

if (!summary.length) note("Nothing to publish: every package's version is already on npm.");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## npm\n\n${summary.map((s) => `- ${s}`).join("\n")}\n`);
process.exit(failed ? 1 : 0);
