// Builds every library's site into _site/<folder>/ and a hub page at _site/index.html.
//
// A library opts in with a "webUiSite" field in the package.json at the root of its folder
// (packages/<folder>/package.json):
//   "webUiSite": {
//     "title": "Knurl",                       // the name on the hub
//     "tagline": "Form controls, machined.",  // one line under it
//     "build": "vite build site",             // run in the folder; may be omitted for a static site
//     "dir": "site/dist",                     // what to publish, relative to the folder
//     "copy": ["demo", "src"],                // or: these folders, copied as they are
//     "index": "demo/index.html",             // with "copy": the page the folder's URL opens
//     "preview": ".github/assets/x.png",      // an image for the hub card
//     "npm": "@in-c0/knurl"                       // the published package, if not this package.json's name
//   }
// Each build gets SITE_URL and VITE_SITE_URL set to its own public URL.
//
//   node scripts/build-sites.mjs               (BASE_URL defaults to the GitHub Pages URL)

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve, basename, extname } from "node:path";

const root = resolve(import.meta.dirname, "..");
const BASE = (process.env.BASE_URL || "https://in-c0.github.io/my-awesome-web-ui-libs").replace(/\/$/, "");
const REPO = process.env.REPO_URL || "https://github.com/in-c0/my-awesome-web-ui-libs";
const out = join(root, "_site");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const libs = [];
for (const folder of readdirSync(join(root, "packages")).sort()) {
  const dir = join(root, "packages", folder);
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const site = pkg.webUiSite;
  if (!site) { console.log(`· ${folder}: no webUiSite, skipped`); continue; }
  const url = `${BASE}/${folder}/`;
  const env = { ...process.env, SITE_URL: url.replace(/\/$/, ""), VITE_SITE_URL: url.replace(/\/$/, "") };
  const dest = join(out, folder);
  if (site.build) {
    console.log(`▸ ${folder}: ${site.build}`);
    execSync(site.build, { cwd: dir, stdio: "inherit", env });
  }
  if (site.copy) {
    mkdirSync(dest, { recursive: true });
    for (const c of site.copy) if (existsSync(join(dir, c))) cpSync(join(dir, c), join(dest, c), { recursive: true });
    if (site.index) writeFileSync(join(dest, "index.html"), `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${site.index}"><link rel="canonical" href="${site.index}"><title>${site.title ?? folder}</title><a href="${site.index}">${site.title ?? folder}</a>`);
  } else {
    cpSync(join(dir, site.dir), dest, { recursive: true });
  }
  let preview = "";
  if (site.preview && existsSync(join(dir, site.preview))) {
    const name = `preview-${folder}${extname(site.preview)}`;
    cpSync(join(dir, site.preview), join(out, name));
    preview = name;
  }
  const npmName = site.npm ?? pkg.name;
  let version = pkg.version;
  if (site.npm && site.npmPackageJson) {
    try { version = JSON.parse(readFileSync(join(dir, site.npmPackageJson), "utf8")).version; } catch { /* keep */ }
  }
  libs.push({ folder, title: site.title ?? folder, tagline: site.tagline ?? pkg.description ?? "", description: pkg.description ?? "", npm: npmName, version, url, preview, source: `${REPO}/tree/main/packages/${folder}` });
}

writeFileSync(join(out, "index.html"), hub(libs));
writeFileSync(join(out, ".nojekyll"), "");
writeFileSync(join(out, "libraries.json"), JSON.stringify(libs, null, 2));
console.log(`✓ ${libs.length} sites and the hub → ${out}`);

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function hub(list) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Web UI libraries · in-c0</title>
<meta name="description" content="${esc(list.length)} open-source web UI libraries, each with a live site and an npm package.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">
<style>
:root{--bg:oklch(.995 .002 70);--fg:oklch(.18 .004 60);--muted:oklch(.965 .003 70);--muted-fg:oklch(.52 .008 60);--border:oklch(.915 .004 70);--surface:oklch(.982 .003 70);--sans:"Geist",ui-sans-serif,system-ui,sans-serif;--mono:"Geist Mono",ui-monospace,Menlo,monospace;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:oklch(.155 .003 60);--fg:oklch(.96 .003 70);--muted:oklch(.225 .004 60);--muted-fg:oklch(.68 .006 70);--border:oklch(1 0 0/.085);--surface:oklch(.19 .004 60);color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 var(--sans);-webkit-font-smoothing:antialiased}
.wrap{max-width:1200px;margin:0 auto;padding:56px max(16px,env(safe-area-inset-right,0px)) 40px max(16px,env(safe-area-inset-left,0px))}
h1{margin:0;font-size:clamp(30px,4.4vw,48px);font-weight:600;letter-spacing:-.035em;line-height:1.08;text-wrap:balance}
.lede{margin:14px 0 0;color:var(--muted-fg);max-width:60ch;font-size:16.5px}
.grid{margin-top:40px;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));border-top:1px solid var(--border);border-left:1px solid var(--border)}
.card{display:flex;flex-direction:column;border-right:1px solid var(--border);border-bottom:1px solid var(--border);text-decoration:none;color:inherit;min-width:0}
.shot{aspect-ratio:16/10;background:var(--surface);border-bottom:1px solid var(--border);display:grid;place-items:center;overflow:hidden}
.shot img{width:100%;height:100%;object-fit:cover;object-position:top}
.shot span{font:500 13px var(--mono);color:var(--muted-fg)}
.body{padding:16px 18px 18px;display:flex;flex-direction:column;gap:6px}
.name{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.name b{font-weight:600;font-size:17px;letter-spacing:-.01em}
.name code{font:12px var(--mono);color:var(--muted-fg)}
.body p{margin:0;color:var(--muted-fg);font-size:14px}
.links{margin-top:6px;display:flex;gap:14px;font-size:13px}
.links a{color:var(--fg);text-underline-offset:4px}
.card:hover .shot img{transform:scale(1.015)}.shot img{transition:transform .28s cubic-bezier(.23,1,.32,1)}
footer{margin-top:40px;font-size:13px;color:var(--muted-fg)}footer a{color:var(--fg);text-underline-offset:4px}
@media (prefers-reduced-motion:reduce){.shot img{transition:none}}
</style>
</head>
<body>
<div class="wrap">
<h1>Web UI libraries</h1>
<p class="lede">${esc(list.length)} open-source libraries in one workspace. Each has a live site with every component, and publishes to npm on its own.</p>
<div class="grid">
${list.map((l) => `<article class="card">
<a class="shot" href="${esc(l.url)}" aria-hidden="true" tabindex="-1">${l.preview ? `<img src="${esc(l.preview)}" alt="" loading="lazy">` : `<span>${esc(l.title)}</span>`}</a>
<div class="body">
<div class="name"><b>${esc(l.title)}</b><code>${esc(l.npm)}@${esc(l.version)}</code></div>
<p>${esc(l.tagline)}</p>
<div class="links"><a href="${esc(l.url)}">Site</a><a href="https://www.npmjs.com/package/${esc(l.npm)}">npm</a><a href="${esc(l.source)}">Source</a></div>
</div>
</article>`).join("\n")}
</div>
<footer>Source: <a href="${esc(REPO)}">${esc(REPO.replace("https://", ""))}</a></footer>
</div>
</body>
</html>
`;
}
