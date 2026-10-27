/**
 * The documented public API, written from packages/paper-ui/src/*.tsx.
 * Pure data (no React imports) so api.test.ts can check it against the TypeScript source.
 */

export type PropRow = {
  name: string;
  type: string;
  def?: string;
  desc: string;
  required?: boolean;
  /** In this repository's source, not in the published 0.1.0-alpha.1 tarball. */
  unreleased?: boolean;
};

export type ComponentId = 'paper-surface' | 'material-effect' | 'pencil-text' | 'paper-card' | 'paper-button';

export type ApiEntry = {
  id: ComponentId;
  name: string;
  file: string;
  interface: string;
  /** What the component renders and what it inherits, said once above the table. */
  renders: string;
  props: PropRow[];
};

export const PUBLISHED_VERSION = '0.1.0-alpha.1';
export const INSTALL = 'npm install @in-c0/paper-ui@alpha react';
export const REPO = 'https://github.com/in-c0/paper-ui';
export const NPM = 'https://www.npmjs.com/package/@in-c0/paper-ui';

export const API: ApiEntry[] = [
  {
    id: 'paper-surface',
    name: 'PaperSurface',
    file: 'PaperSurface.tsx',
    interface: 'PaperSurfaceProps',
    renders: 'Renders a `<div>` and forwards every other `HTMLAttributes<HTMLDivElement>` prop (id, role, aria-*, handlers) to it.',
    props: [
      { name: 'children', type: 'ReactNode', desc: 'Content, rendered as normal DOM above the material and light layers.' },
      {
        name: 'texture',
        type: 'boolean',
        def: 'true',
        desc: 'Mounts the Paper Shaders PaperTexture behind the content when WebGL is available. Use it on one large surface; pass false for repeated surfaces.',
      },
      {
        name: 'material',
        type: 'Partial<PaperTextureSettings>',
        desc: 'Overrides spread over WHISPERS_PAPER_PRESET for this surface. The preset itself is never modified.',
      },
      {
        name: 'light',
        type: "'desk' | 'diffuse' | 'none'",
        def: "'desk'",
        desc: 'A fixed CSS overlay: a warm radial wash from the top left, a soft diagonal, or nothing. Not a lamp simulation.',
      },
      {
        name: 'tone',
        type: "'paper' | 'charcoal'",
        def: "'paper'",
        desc: "'charcoal' is a dark surface with light ink. It never mounts the shader.",
      },
      { name: 'className', type: 'string', def: "''", desc: 'Added after pui-surface, pui-surface--{tone} and pui-light--{light}.' },
      { name: 'style', type: 'CSSProperties', desc: 'Inline style for the root, e.g. minHeight.' },
    ],
  },
  {
    id: 'material-effect',
    name: 'MaterialEffect',
    file: 'MaterialEffect.tsx',
    interface: 'MaterialEffectProps',
    renders: 'Renders a `<div>` with `data-material-kind`. It takes only the props below; it does not forward other attributes.',
    props: [
      {
        name: 'kind',
        type: 'MaterialKind',
        required: true,
        desc: "One of the six presets: 'paper-texture', 'grain-sphere', 'grain-blob', 'grain-wave', 'dithering', 'halftone'.",
      },
      {
        name: 'tuning',
        type: 'MaterialTuning',
        desc: 'Numeric overrides. Which keys apply depends on kind (see Tuning); each value is clamped to its range.',
      },
      {
        name: 'image',
        type: 'string',
        desc: "Image URL for 'halftone'. Without it the halftone shader renders nothing and only the CSS background shows. Also shown as a decorative fallback image.",
      },
      {
        name: 'paused',
        type: 'boolean',
        def: 'false',
        desc: 'Sets animated speed to 0. Forced on when the visitor prefers reduced motion.',
      },
      {
        name: 'renderMode',
        type: "'auto' | 'fallback'",
        def: "'auto'",
        desc: "'fallback' never requests a GPU context and shows the CSS / image fallback.",
        unreleased: true,
      },
      { name: 'className', type: 'string', def: "''", desc: 'Added after pui-material-effect and pui-material-effect--{kind}.' },
      { name: 'style', type: 'CSSProperties', desc: 'Inline style for the root. Give it a height: the material fills the box.' },
      { name: 'children', type: 'ReactNode', desc: 'Content, rendered as normal DOM above the material.' },
    ],
  },
  {
    id: 'pencil-text',
    name: 'PencilText',
    file: 'PencilText.tsx',
    interface: 'PencilTextProps',
    renders: "Renders Tegaki's `TegakiRenderer` as a `<span>`: a canvas for the ink plus a transparent text overlay that stays selectable and readable. Other props are not forwarded.",
    props: [
      { name: 'children', type: 'string', required: true, desc: 'The text to write. A plain string, not elements.' },
      {
        name: 'font',
        type: "TegakiRendererProps['font']",
        def: 'Caveat bundle',
        desc: "A Tegaki font bundle (TegakiBundle) or a registered bundle name. Pass e.g. tegaki/fonts/nanum-pen-script for Korean. Paper UI does not substitute fonts for you.",
      },
      { name: 'animate', type: 'boolean', def: 'true', desc: 'false draws the text complete, with no animation.' },
      { name: 'size', type: 'number | string', def: "'2.2rem'", desc: 'CSS font-size. A number is pixels.' },
      { name: 'color', type: 'string', def: "'var(--paper-ui-ink)'", desc: 'Ink colour, any CSS colour.' },
      {
        name: 'pressure',
        type: 'number',
        def: '0.8',
        desc: "0 to 1: how far stroke width follows the pen pressure recorded in the bundle. 0 draws even strokes.",
      },
      { name: 'seed', type: 'number', def: '893', desc: "Seed for Tegaki's per-glyph variation, so the same text is drawn the same way each time." },
      { name: 'className', type: 'string', desc: 'Class for the renderer root.' },
      { name: 'style', type: 'CSSProperties', desc: 'Merged after the size and colour styles.' },
    ],
  },
  {
    id: 'paper-card',
    name: 'PaperCard',
    file: 'PaperCard.tsx',
    interface: 'PaperCardProps',
    renders: 'Renders an `<article>` and forwards every other `HTMLAttributes<HTMLElement>` prop to it.',
    props: [
      { name: 'children', type: 'ReactNode', required: true, desc: 'Card content.' },
      {
        name: 'interactive',
        type: 'boolean',
        def: 'false',
        desc: 'Lifts the card a little on hover (and, unreleased, while something inside it has focus). It does not make the card focusable or clickable.',
      },
      { name: 'raised', type: 'boolean', def: 'false', desc: 'A deeper resting shadow.' },
      { name: 'className', type: 'string', def: "''", desc: 'Added after pui-card and the modifier classes.' },
    ],
  },
  {
    id: 'paper-button',
    name: 'PaperButton',
    file: 'PaperButton.tsx',
    interface: 'PaperButtonProps',
    renders: 'Renders a native `<button>`, forwards its ref, and passes every other `ButtonHTMLAttributes` prop through (disabled, onClick, aria-pressed and the rest).',
    props: [
      {
        name: 'variant',
        type: "'ink' | 'quiet' | 'outline'",
        def: "'quiet'",
        desc: 'ink: filled with the ink colour. quiet: no fill until hover. outline: a stone-coloured border.',
      },
      {
        name: 'type',
        type: "'button' | 'submit' | 'reset'",
        def: "'button'",
        desc: "Defaults to 'button', so it never submits a form by accident. Pass 'submit' inside forms.",
      },
      { name: 'className', type: 'string', def: "''", desc: 'Added after pui-button and pui-button--{variant}.' },
      { name: 'ref', type: 'Ref<HTMLButtonElement>', desc: 'Forwarded to the <button>.' },
    ],
  },
];

/** Tuning keys MaterialShaderRenderer reads for each family, with the clamp it applies. */
export const TUNING: { family: string; kinds: string[]; keys: { key: string; range: string }[]; note?: string }[] = [
  {
    family: 'paper',
    kinds: ['paper-texture'],
    keys: [
      { key: 'angle', range: '0 – 360' },
      { key: 'roughness', range: '0 – 1' },
      { key: 'wrinkles', range: '0 – 1' },
      { key: 'blending', range: '0 – 1' },
      { key: 'distortion', range: '0 – 1' },
    ],
    note: 'blending and distortion act on a supplied image. MaterialEffect passes none to PaperTexture, so they have no visible effect here.',
  },
  {
    family: 'gradient',
    kinds: ['grain-sphere', 'grain-blob', 'grain-wave'],
    keys: [
      { key: 'speed', range: '0 – 2' },
      { key: 'intensity', range: '0 – 1' },
      { key: 'noise', range: '0 – 1' },
      { key: 'scale', range: '0.2 – 3' },
    ],
  },
  {
    family: 'dithering',
    kinds: ['dithering'],
    keys: [
      { key: 'speed', range: '0 – 2' },
      { key: 'size', range: '1 – 20' },
      { key: 'scale', range: '0.2 – 3' },
    ],
  },
  {
    family: 'halftone',
    kinds: ['halftone'],
    keys: [
      { key: 'size', range: '0 – 1' },
      { key: 'contrast', range: '0 – 1' },
      { key: 'scale', range: '0.2 – 3' },
    ],
  },
];
