import { defineConfig, type Options } from "tsup";

const shared = { format: ["esm"], target: "es2020", dts: true, sourcemap: true } satisfies Options;

/** The React entry imports "./index" in source; in the bundle it becomes the package itself, so both entries share one core and one frame loop. */
const self: NonNullable<Options["esbuildPlugins"]>[number] = {
  name: "core-by-package-name",
  setup(build) {
    build.onResolve({ filter: /^\.\/index$/ }, () => ({ path: "knurl-ui", external: true }));
  },
};

export default defineConfig([
  { ...shared, entry: ["src/index.ts"] },
  { ...shared, entry: ["src/react.tsx"], external: ["react"], esbuildPlugins: [self], banner: { js: '"use client";' } },
]);
