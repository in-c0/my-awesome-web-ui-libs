# Paper UI

**Material-aware, quietly interactive React components.**

A small independent, experimental library for surfaces that feel like paper and handwriting that appears stroke by stroke. Built with normal accessible DOM controls, Paper Shaders for optional GPU materials, and Tegaki for handwriting.

**Status:** experimental public npm alpha **0.1.0-alpha.1** (under the `alpha` dist-tag, not `latest`). Released on 2026-10-24. Mobile/browser interaction and real-registry React consumer tests pass; real-device GPU, accessibility, and visual-fidelity audits are still required.

**[Explore the interactive Studio →](https://paper-ui-react-lab.vercel.app/)** · [Source code](https://github.com/in-c0/paper-ui) · [Release readiness](docs/RELEASE_CHECKLIST.md) · [npm alpha staging](docs/NPM_ALPHA_STAGING.md)

## Components

| Component | Purpose |
| --- | --- |
| `PaperSurface` | A semantic DOM container with optional paper shader, warm light treatment, and CSS fallback |
| `MaterialEffect` | A single GPU material layer selected from six presets |
| `PencilText` | Stroke-order animated handwriting using Tegaki |
| `PaperCard` | Tactile-but-subtle card with reduced-motion-friendly interaction |
| `PaperButton` | Native accessible button with ink / quiet / outline treatments |

Six material modes: **Paper Texture**, **Grain Gradient Sphere**, **Blob**, **Wave**, **Dithering**, and **Halftone Dots**. Presets preserve the creator-selected source values and expose optional tuning.

## Install the public alpha

```bash
npm install @in-c0/paper-ui@alpha react
```

> Version `0.1.0-alpha.1` is published publicly and tested through the real npm registry. Use the explicit `@alpha` tag; production stability is not yet certified.

## Usage (React)

```tsx
import '@in-c0/paper-ui/styles.css';
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

**Stylesheet:** Import `@in-c0/paper-ui/styles.css` once in your application entry. This is required for predictable visual appearance across bundlers. The component code works without it but will look unstyled.

**Rendering rule:** Do not mount a separate shader per thumbnail. Keep keyboard focus and interactive controls in the DOM, and use a single optional shader behind selected content.

## Run the standalone source

```bash
bun install
bun run build
bun run test
bun run dev
```

Open the local Vite URL or try the [hosted interactive Studio](https://paper-ui-react-lab.vercel.app/) to explore materials and handwriting. For browser quality checks:

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

First alpha was staged and approved manually with npm 2FA. The published registry tarball passed TypeScript and Vite smoke tests in a clean React application. Future releases remain manually gated; OIDC trusted publishing is planned.

## Scope and limitations

- **React-first**, not an official shadcn/ui or Tegaki extension.
- The paper shader is visually shaded; it does **not** perform realistic 3D lighting, tactile simulation, or paper folding physics.
- Handwriting draws glyph strokes using Tegaki; this does **not** simulate graphite-particle deposition.
- WebGL is optional; no-WebGL content remains readable.
- The included demo should not be presented as fully production-hardened until actual mobile GPU, accessibility, security, and contrast audits are complete.

## Repository layout

- `packages/paper-ui` — React components, materials, design tokens and distributable ESM package
- `apps/studio` — interactive shader/handwriting laboratory and browser tests
- `docs/` — implementation architecture and pre-release QA gates

## Upstream projects

- [Tegaki](https://github.com/gkurt/tegaki): animated handwriting under MIT
- [Paper Shaders](https://github.com/paper-design/shaders): shaders under Apache-2.0

See [third-party notices](./THIRD_PARTY_NOTICES.md).

## Licensing

Paper UI original source: **MIT**. External packages retain their independent licenses.
