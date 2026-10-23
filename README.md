# Paper UI

**Material-aware, quietly interactive React components.**

A small independent, experimental library for surfaces that feel like paper and handwriting that appears stroke by stroke. Built with normal accessible DOM controls, Paper Shaders for optional GPU materials, and Tegaki for handwriting.

**Status:** pre-release source; not published to npm. The source is prepared for extraction to a standalone GitHub repository. The public interactive demo is an experimental preview, not production certification.

## Components

| Component | Purpose |
| --- | --- |
| `PaperSurface` | A semantic DOM container with optional paper shader, warm light treatment, and CSS fallback |
| `MaterialEffect` | A single GPU material layer selected from six presets |
| `PencilText` | Stroke-order animated handwriting using Tegaki |
| `PaperCard` | Tactile-but-subtle card with reduced-motion-friendly interaction |
| `PaperButton` | Native accessible button with ink / quiet / outline treatments |

Six material modes: **Paper Texture**, **Grain Gradient Sphere**, **Blob**, **Wave**, **Dithering**, and **Halftone Dots**. Presets preserve the creator-selected source values and expose optional tuning.

## Install after the first npm release

```bash
npm install @in-c0/paper-ui react
```

> **Not yet available on npm.** The proposed `@in-c0` npm organization/scope must be owned and verified before publishing. Do not use the installation command until a release is confirmed.

## Usage (React)

```tsx
import { PaperSurface, PaperCard, PaperButton, PencilText, MaterialEffect } from '@in-c0/paper-ui';
import korean from 'tegaki/fonts/nanum-pen-script';

function Journal() {
  return (
    <PaperSurface light="desk">
      <PaperCard>
        <PencilText font={korean}>조금씩, 꾸준히.</PencilText>
        <PaperButton onClick={() => alert('Saved')}>Save note</PaperButton>
      </PaperCard>
      <MaterialEffect kind="grain-blob" paused={false}>
        <p>Ambient material study</p>
      </MaterialEffect>
    </PaperSurface>
  );
}
```

**Rendering rule:** Do not mount a separate shader per thumbnail. Keep keyboard focus and interactive controls in the DOM, and use a single optional shader behind selected content.

## Run the standalone source

```bash
bun install
bun run build
bun run test
bun run dev
```

Open the Vite URL to explore materials and handwriting in the same live studio. For browser quality checks:

```bash
bunx playwright install chromium
bun run test:browser
```

## Packaging

The package emits JS, `.d.ts` declarations, and its CSS into `packages/paper-ui/dist`. Check actual tarball contents before publishing:

```bash
cd packages/paper-ui
npm pack --dry-run
```

There are no automatic npm releases. Add trusted publishing, ownership verification, package installation smoke tests, and license validation before enabling a release workflow.

## Scope and limitations

- **React-first**, not an official shadcn/ui or Tegaki extension.
- The paper shader is visually shaded; it does **not** perform realistic 3D lighting, tactile simulation, or paper folding physics.
- Handwriting draws glyph strokes using Tegaki; this does **not** simulate graphite-particle deposition.
- WebGL is optional; no-WebGL content remains readable.
- The included demo should not be presented as fully production-hardened until actual mobile GPU, accessibility, security, and contrast audits are complete.

## Upstream projects

- [Tegaki](https://github.com/gkurt/tegaki): animated handwriting under MIT
- [Paper Shaders](https://github.com/paper-design/shaders): shaders under Apache-2.0

See [third-party notices](./THIRD_PARTY_NOTICES.md).

## Licensing

Paper UI original source: **MIT**. External packages retain their independent licenses.
