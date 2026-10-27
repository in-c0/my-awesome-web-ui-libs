// Builds the shadcn registry: site/public/r/<name>.json and site/public/r/registry.json.
//   npx shadcn@latest add https://<site>/r/toggle.json
// Each control item depends on `knurl-core` by URL, so the CLI pulls the core in once.
// SITE_URL sets the base the items point at (default: the GitHub Pages URL).

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTROLS } from "./controls.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = (process.env.SITE_URL || "https://in-c0.github.io/knurl").replace(/\/$/, "");
const out = join(root, "site/public/r");
mkdirSync(out, { recursive: true });
const SCHEMA = "https://ui.shadcn.com/schema/registry-item.json";
const read = (p) => readFileSync(join(root, p), "utf8");

const coreFiles = [
  ...readdirSync(join(root, "src/core")).filter((f) => f.endsWith(".ts")).sort().map((f) => ({ path: `src/core/${f}`, target: `components/knurl/core/${f}` })),
  { path: "src/react/make.tsx", target: "components/knurl/react/make.tsx" },
];

/** The React file the CLI writes for a control: one line over the shared wrapper. */
export const wrapper = (c) => `"use client";
import { make } from "./react/make";
import { ${c.id}, type ${c.name}Options } from "./controls/${c.id}";

/** ${c.summary} */
export const ${c.name} = make<${c.name}Options>("${c.name}", ${c.id});
`;

const items = [];
const core = {
  $schema: SCHEMA,
  name: "knurl-core",
  type: "registry:lib",
  title: "Knurl core",
  description: "The drawing maths, frame loop, stylesheet and React wrapper every Knurl control shares.",
  dependencies: [],
  files: coreFiles.map((f) => ({ path: f.path, type: "registry:lib", target: f.target, content: read(f.path) })),
};
items.push(core);

for (const c of CONTROLS) {
  items.push({
    $schema: SCHEMA,
    name: c.id,
    type: "registry:component",
    title: c.name,
    description: c.summary,
    registryDependencies: [`${SITE}/r/knurl-core.json`],
    files: [
      { path: `src/controls/${c.id}.ts`, type: "registry:component", target: `components/knurl/controls/${c.id}.ts`, content: read(`src/controls/${c.id}.ts`) },
      { path: `components/knurl/${c.id}.tsx`, type: "registry:component", target: `components/knurl/${c.id}.tsx`, content: wrapper(c) },
    ],
  });
}

items.push({
  $schema: SCHEMA,
  name: "knurl",
  type: "registry:component",
  title: "Knurl (every control)",
  description: `All ${CONTROLS.length} Knurl controls and their core.`,
  registryDependencies: CONTROLS.map((c) => `${SITE}/r/${c.id}.json`),
  files: [],
});

for (const it of items) writeFileSync(join(out, `${it.name}.json`), JSON.stringify(it, null, 2) + "\n");
writeFileSync(join(out, "registry.json"), JSON.stringify({
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "knurl",
  homepage: SITE,
  items: items.map(({ $schema, ...it }) => ({ ...it, files: it.files.map(({ content, ...f }) => f) })),
}, null, 2) + "\n");
console.log(`registry: ${items.length} items → ${out} (base ${SITE})`);
