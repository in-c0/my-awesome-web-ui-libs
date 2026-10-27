import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../src", import.meta.url));

// `vite build` → site/dist for GitHub Pages (with /r registry files);
// `vite build --mode single` → one self-contained HTML file (site/single) for hosted previews.
export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [react(), ...(mode === "single" ? [viteSingleFile()] : [])],
  resolve: {
    alias: [
      { find: /^knurl-ui\/react$/, replacement: src + "/react.tsx" },
      { find: /^knurl-ui$/, replacement: src + "/index.ts" },
      { find: /^@src\//, replacement: src + "/" },
    ],
  },
  build: {
    outDir: mode === "single" ? "single" : "dist",
    emptyOutDir: true,
    copyPublicDir: mode !== "single",
  },
}));
