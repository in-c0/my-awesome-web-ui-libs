import { MATERIAL_KINDS, MATERIAL_PRESETS, MaterialEffect, type MaterialKind, PaperButton, PaperCard, PaperSurface, PencilText } from '@in-c0/paper-ui';
import { type CSSProperties, type FormEvent, type ReactNode, useState } from 'react';
import korean from 'tegaki/fonts/nanum-pen-script';
import { API, type ApiEntry, type ComponentId, REPO } from './api.ts';

/** The halftone study ships in public/, so it resolves under any deploy base (/, /paper-ui/, ./). */
export const SKETCH = `${import.meta.env.BASE_URL}halftone-study.svg`;

export type DemoProps = { live: boolean; opt: string };

export type Example = {
  id: string;
  title: string;
  /** Markdown-ish: `code` spans only. */
  text: string;
  /** True when the example can hold the page's single WebGL shader. */
  shader?: boolean;
  /** The stage stretches its child to the frame width instead of centring it. */
  fill?: boolean;
  options?: { label: string; values: { v: string; label: string }[]; initial: string };
  code: (opt: string) => string;
  Demo: (props: DemoProps) => ReactNode;
};

export type Doc = {
  id: ComponentId;
  name: string;
  /** One line under the title. */
  summary: string;
  role: string;
  installNotes: string[];
  usage: string;
  usageNotes: string[];
  main: Example;
  examples: Example[];
  keys: [string, string][];
  a11y: string[];
  api: ApiEntry;
  /** Extra reference sections after the API table. */
  extra?: { id: string; title: string; md: () => string; node: ReactNode }[];
};

const IMPORT_CSS = "import '@in-c0/paper-ui/styles.css';";
const api = (id: ComponentId) => API.find((entry) => entry.id === id) as ApiEntry;

/* Shared demo typography: the package's own CSS variables, so snippets carry nothing site-specific. */
const editorial: CSSProperties = { fontFamily: 'var(--paper-ui-editorial)', fontWeight: 400, margin: 0, color: 'var(--paper-ui-ink)' };
const eyebrow: CSSProperties = { margin: 0, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--paper-ui-graphite)' };
const body: CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--paper-ui-graphite)' };

/* ───────────────────────────── PaperSurface ───────────────────────────── */

const paperSurface: Doc = {
  id: 'paper-surface',
  name: 'PaperSurface',
  role: 'container',
  summary: 'A semantic container with one optional paper shader, a fixed light wash and a CSS fibre fallback.',
  installNotes: [],
  usage: `${IMPORT_CSS}
import { PaperSurface } from '@in-c0/paper-ui';

export function Page() {
  return (
    <PaperSurface light="desk" style={{ minHeight: 320, padding: 40 }}>
      <h1>Notes from the print room</h1>
    </PaperSurface>
  );
}`,
  usageNotes: [
    'The shader, the light wash and your content are three stacked layers. The first two are `aria-hidden` and ignore the pointer; your children are ordinary DOM on top.',
    'Use `texture` on one large surface per view. The shader is decorative: without WebGL it is not mounted and the CSS fallback shows instead.',
    'Unreleased: the shader also unmounts offscreen and in background tabs, and render errors inside it are contained.',
  ],
  main: {
    id: 'journal',
    title: 'Journal page',
    text: '',
    shader: true,
    fill: true,
    options: {
      label: 'light',
      initial: 'desk',
      values: [
        { v: 'desk', label: "light='desk'" },
        { v: 'diffuse', label: "light='diffuse'" },
        { v: 'none', label: "light='none'" },
      ],
    },
    code: (light) => `${IMPORT_CSS}
import { PaperButton, PaperSurface } from '@in-c0/paper-ui';

export function Journal() {
  return (
    <PaperSurface light="${light}" style={{ minHeight: 300, padding: 36 }}>
      <p style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        Tuesday, 14 October
      </p>
      <h2 style={{ fontFamily: 'var(--paper-ui-editorial)', fontSize: 32, fontWeight: 400 }}>
        Notes from the print room
      </h2>
      <p style={{ maxWidth: 420, lineHeight: 1.6 }}>
        The proofs came back warmer than the screen. Keep the margins wide and let the paper do the work.
      </p>
      <PaperButton variant="ink">Save entry</PaperButton>
    </PaperSurface>
  );
}`,
    Demo: ({ live, opt }) => (
      <PaperSurface texture={live} light={opt as 'desk' | 'diffuse' | 'none'} style={{ minHeight: 300, padding: 36 }}>
        <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
          <p style={eyebrow}>Tuesday, 14 October</p>
          <p style={{ ...editorial, fontSize: 32, lineHeight: 1.15 }}>Notes from the print room</p>
          <p style={{ ...body, maxWidth: 420 }}>
            The proofs came back warmer than the screen. Keep the margins wide and let the paper do the work.
          </p>
          <PaperButton variant="ink" style={{ marginTop: 6 }}>
            Save entry
          </PaperButton>
        </div>
      </PaperSurface>
    ),
  },
  examples: [
    {
      id: 'repeated',
      title: 'Repeated surfaces, no shader',
      text: 'Anything that repeats takes `texture={false}`. The CSS fibre layer and the light wash stay; no WebGL context is created. These three cost nothing on the GPU.',
      fill: true,
      code: () => `${IMPORT_CSS}
import { PaperSurface } from '@in-c0/paper-ui';

const lights = ['desk', 'diffuse', 'none'] as const;

export function Swatches() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
      {lights.map((light) => (
        <PaperSurface key={light} texture={false} light={light} style={{ minHeight: 140, padding: 18 }}>
          <code>light="{light}"</code>
        </PaperSurface>
      ))}
    </div>
  );
}`,
      Demo: () => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {(['desk', 'diffuse', 'none'] as const).map((light) => (
            <PaperSurface key={light} texture={false} light={light} style={{ minHeight: 140, padding: 18, border: '1px solid rgba(71, 66, 55, 0.12)' }}>
              <code style={{ fontSize: 12.5 }}>light="{light}"</code>
            </PaperSurface>
          ))}
        </div>
      ),
    },
    {
      id: 'charcoal',
      title: 'Charcoal tone',
      text: '`tone="charcoal"` switches the ink and paper variables to a dark surface with light text. It never mounts the shader.',
      fill: true,
      code: () => `${IMPORT_CSS}
import { PaperButton, PaperSurface } from '@in-c0/paper-ui';

export function Evening() {
  return (
    <PaperSurface tone="charcoal" light="diffuse" style={{ minHeight: 220, padding: 32 }}>
      <h2 style={{ fontFamily: 'var(--paper-ui-editorial)', fontWeight: 400 }}>After hours</h2>
      <p style={{ maxWidth: 380, lineHeight: 1.6 }}>Graphite on dark stock, for the reading lamp.</p>
      <PaperButton variant="outline">Keep reading</PaperButton>
    </PaperSurface>
  );
}`,
      Demo: () => (
        <PaperSurface tone="charcoal" light="diffuse" style={{ minHeight: 220, padding: 32 }}>
          <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
            <p style={{ ...editorial, fontSize: 28 }}>After hours</p>
            <p style={{ ...body, color: 'var(--paper-ui-stone)', maxWidth: 380 }}>Graphite on dark stock, for the reading lamp.</p>
            <PaperButton variant="outline">Keep reading</PaperButton>
          </div>
        </PaperSurface>
      ),
    },
    {
      id: 'material',
      title: 'Adjusting the material',
      text: '`material` is spread over `WHISPERS_PAPER_PRESET` for this surface only. The preset object is never modified.',
      shader: true,
      fill: true,
      code: () => `${IMPORT_CSS}
import { PaperSurface } from '@in-c0/paper-ui';

export function SmoothStock() {
  return (
    <PaperSurface material={{ roughness: 0.3, wrinkles: 0.35, angle: 140 }} style={{ minHeight: 240, padding: 32 }}>
      <p>Smoother stock, light from the right.</p>
    </PaperSurface>
  );
}`,
      Demo: ({ live }) => (
        <PaperSurface texture={live} material={{ roughness: 0.3, wrinkles: 0.35, angle: 140 }} style={{ minHeight: 240, padding: 32 }}>
          <p style={{ ...editorial, fontSize: 24 }}>Smoother stock, light from the right.</p>
        </PaperSurface>
      ),
    },
  ],
  keys: [
    ['Tab', 'Moves through the controls inside. The surface itself is not focusable.'],
    ['Pointer', 'Passes straight to your content: the shader and light layers have `pointer-events: none`.'],
  ],
  a11y: [
    'Renders a plain `<div>`. Give it a landmark role or put headings inside, as you would any container.',
    'The shader and light layers are `aria-hidden`; screen readers only meet your content.',
    'Unreleased: `data-shader-status` (`fallback`, `webgl`, `suspended`, `context-lost`) is a diagnostic, not a performance guarantee.',
    'Unreleased: on a lost WebGL context the shader layer hides, the CSS fallback shows, and the renderer remounts when the browser restores the context.',
  ],
  api: api('paper-surface'),
};

/* ───────────────────────────── MaterialEffect ───────────────────────────── */

const materialLine = (kind: string) =>
  kind === 'halftone'
    ? `    <MaterialEffect kind="halftone" image="/drawing.svg" style={{ height: 300 }} />`
    : `    <MaterialEffect kind="${kind}" style={{ height: 300 }}>
      <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 32 }}>
        <p style={{ fontFamily: 'var(--paper-ui-editorial)', fontSize: 40, textAlign: 'center' }}>
          A little, over time.
        </p>
      </div>
    </MaterialEffect>`;

const materialEffect: Doc = {
  id: 'material-effect',
  name: 'MaterialEffect',
  role: 'GPU material',
  summary: 'One decorative GPU material, picked from six owner-approved presets, behind ordinary DOM content.',
  installNotes: [],
  usage: `${IMPORT_CSS}
import { MaterialEffect } from '@in-c0/paper-ui';

export function Hero() {
  return (
    <MaterialEffect kind="grain-blob" style={{ height: 360 }}>
      <h1>A little, over time.</h1>
    </MaterialEffect>
  );
}`,
  usageNotes: [
    'Give the effect a height: the material fills its box and the children sit on top of it.',
    'One per view. The renderer is lazy-loaded the first time a material mounts.',
    'The presets keep the owner’s exact source values, alpha-bearing hex colours included. `tuning` adjusts a few numbers within clamped ranges.',
  ],
  main: {
    id: 'kinds',
    title: 'Six presets',
    text: '',
    shader: true,
    fill: true,
    options: {
      label: 'kind',
      initial: 'grain-blob',
      values: MATERIAL_KINDS.map((kind) => ({ v: kind, label: `${kind} · ${MATERIAL_PRESETS[kind].label}` })),
    },
    code: (kind) => `${IMPORT_CSS}
import { MaterialEffect } from '@in-c0/paper-ui';

export function Hero() {
  return (
${materialLine(kind)}
  );
}`,
    Demo: ({ live, opt }) => {
      const kind = opt as MaterialKind;
      if (kind === 'halftone') return <MaterialEffect kind="halftone" image={SKETCH} renderMode={live ? 'auto' : 'fallback'} style={{ height: 300 }} />;
      return (
        <MaterialEffect kind={kind} renderMode={live ? 'auto' : 'fallback'} style={{ height: 300 }}>
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 32 }}>
            <p style={{ ...editorial, fontSize: 'clamp(28px, 6vw, 40px)', textAlign: 'center', lineHeight: 1.1 }}>A little, over time.</p>
          </div>
        </MaterialEffect>
      );
    },
  },
  examples: [
    {
      id: 'halftone',
      title: 'Your drawing, in halftone',
      text: '`halftone` needs `image`. The image is also drawn as a plain `<img>` under the shader, so without WebGL the drawing is still there.',
      shader: true,
      fill: true,
      code: () => `${IMPORT_CSS}
import { MaterialEffect } from '@in-c0/paper-ui';

export function Sketch() {
  return <MaterialEffect kind="halftone" image="/drawing.svg" tuning={{ size: 0.4, contrast: 0.6 }} style={{ height: 280 }} />;
}`,
      Demo: ({ live }) => (
        <MaterialEffect kind="halftone" image={SKETCH} tuning={{ size: 0.4, contrast: 0.6 }} renderMode={live ? 'auto' : 'fallback'} style={{ height: 280 }} />
      ),
    },
    {
      id: 'tuning',
      title: 'Tuning a preset',
      text: 'Slower and grainier than the source preset. Keys a family does not read are ignored, and every value is clamped (see Tuning below).',
      shader: true,
      fill: true,
      code: () => `${IMPORT_CSS}
import { MaterialEffect } from '@in-c0/paper-ui';

export function SlowWave() {
  return (
    <MaterialEffect kind="grain-wave" tuning={{ speed: 0.3, noise: 0.45, scale: 1.6 }} style={{ height: 240 }}>
      <p style={{ padding: 28 }}>Warm light, taking its time.</p>
    </MaterialEffect>
  );
}`,
      Demo: ({ live }) => (
        <MaterialEffect kind="grain-wave" tuning={{ speed: 0.3, noise: 0.45, scale: 1.6 }} renderMode={live ? 'auto' : 'fallback'} style={{ height: 240 }}>
          <p style={{ ...editorial, fontSize: 24, padding: 28 }}>Warm light, taking its time.</p>
        </MaterialEffect>
      ),
    },
    {
      id: 'fallback',
      title: 'The fallback, on purpose',
      text: '`renderMode="fallback"` draws only the CSS layer, which is what visitors without WebGL see. Not in 0.1.0-alpha.1 yet.',
      fill: true,
      code: () => `${IMPORT_CSS}
import { MaterialEffect } from '@in-c0/paper-ui';

export function QuietHeader() {
  return (
    <MaterialEffect kind="grain-sphere" renderMode="fallback" style={{ height: 200 }}>
      <p style={{ padding: 28 }}>No GPU context requested.</p>
    </MaterialEffect>
  );
}`,
      Demo: () => (
        <MaterialEffect kind="grain-sphere" renderMode="fallback" style={{ height: 200 }}>
          <p style={{ ...editorial, fontSize: 24, padding: 28 }}>No GPU context requested.</p>
        </MaterialEffect>
      ),
    },
  ],
  keys: [
    ['Tab', 'Moves through the controls inside. The effect itself is not focusable.'],
    ['Reduced motion', 'With `prefers-reduced-motion: reduce`, animated presets render with speed 0, whatever `paused` says.'],
  ],
  a11y: [
    'The shader layer is `aria-hidden` and ignores the pointer. Text you put on a material needs its own contrast check against the lightest frame of the animation.',
    'Unreleased: offscreen (with a 100 px margin) and in hidden tabs the renderer unmounts; the DOM content stays.',
    'Unreleased: on phones and coarse pointers the shader buffer is capped at 480,000 pixels, and at 1,200,000 elsewhere. These are design limits, not measurements.',
  ],
  api: api('material-effect'),
};

/* ───────────────────────────── PencilText ───────────────────────────── */

const pencilText: Doc = {
  id: 'pencil-text',
  name: 'PencilText',
  role: 'handwriting',
  summary: 'Handwriting drawn stroke by stroke with Tegaki, over text that stays real, selectable text.',
  installNotes: [
    'To import a font bundle such as `tegaki/fonts/nanum-pen-script`, add `tegaki@1.0.3` to your own dependencies too. Strict installers such as pnpm do not expose Paper UI’s copy to your code.',
  ],
  usage: `${IMPORT_CSS}
import { PencilText } from '@in-c0/paper-ui';

export function Note() {
  return <PencilText>A little, over time.</PencilText>;
}`,
  usageNotes: [
    '`children` must be a plain string. Tegaki shapes and draws it; Paper UI adds the defaults below and the reduced-motion setting.',
    'The default Caveat bundle (about 340 KB of font files) is imported by PencilText itself, so it is in your build even if you pass another `font`. Nanum Pen Script adds about 3.6 MB.',
    'This draws glyph strokes in order. It does not simulate graphite.',
  ],
  main: {
    id: 'write',
    title: 'A line, written',
    text: '',
    options: {
      label: 'font',
      initial: 'caveat',
      values: [
        { v: 'caveat', label: 'Caveat (default)' },
        { v: 'nanum', label: 'Nanum Pen Script (Korean)' },
      ],
    },
    code: (font) =>
      font === 'nanum'
        ? `${IMPORT_CSS}
import { PencilText } from '@in-c0/paper-ui';
import korean from 'tegaki/fonts/nanum-pen-script';

export function Note() {
  return (
    <PencilText font={korean} size="3.4rem">
      조금씩, 꾸준히.
    </PencilText>
  );
}`
        : `${IMPORT_CSS}
import { PencilText } from '@in-c0/paper-ui';

export function Note() {
  return <PencilText size="3rem">A little, over time.</PencilText>;
}`,
    Demo: ({ opt }) =>
      opt === 'nanum' ? (
        <PencilText font={korean} size="clamp(2.4rem, 9vw, 3.4rem)">
          조금씩, 꾸준히.
        </PencilText>
      ) : (
        <PencilText size="clamp(2.1rem, 8vw, 3rem)">A little, over time.</PencilText>
      ),
  },
  examples: [
    {
      id: 'static',
      title: 'Drawn complete',
      text: '`animate={false}` draws the final frame at once. Right for anything already read, like a sign-off.',
      code: () => `${IMPORT_CSS}
import { PencilText } from '@in-c0/paper-ui';

export function SignOff() {
  return (
    <div style={{ maxWidth: 360 }}>
      <p>Thank you for the proofs. The cotton stock was the right call.</p>
      <p>Yours,</p>
      <PencilText animate={false} size="2.2rem">Jun</PencilText>
    </div>
  );
}`,
      Demo: () => (
        <div style={{ maxWidth: 360, display: 'grid', gap: 8 }}>
          <p style={body}>Thank you for the proofs. The cotton stock was the right call.</p>
          <p style={body}>Yours,</p>
          <PencilText animate={false} size="2.2rem">
            Jun
          </PencilText>
        </div>
      ),
    },
    {
      id: 'pressure',
      title: 'Pressure',
      text: '`pressure` sets how far stroke width follows the pressure recorded in the font bundle: `0` draws even strokes, `1` the full variation.',
      code: () => `${IMPORT_CSS}
import { PencilText } from '@in-c0/paper-ui';

export function Pressure() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <PencilText pressure={0} size="2.4rem">Even line</PencilText>
      <PencilText pressure={1} size="2.4rem">Pressed line</PencilText>
    </div>
  );
}`,
      Demo: () => (
        <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
          <PencilText pressure={0} size="2.4rem">
            Even line
          </PencilText>
          <PencilText pressure={1} size="2.4rem">
            Pressed line
          </PencilText>
        </div>
      ),
    },
    {
      id: 'card',
      title: 'A note on a card',
      text: 'Ink takes any CSS colour. Here it uses the package’s graphite variable.',
      code: () => `${IMPORT_CSS}
import { PaperCard, PencilText } from '@in-c0/paper-ui';

export function Reminder() {
  return (
    <PaperCard style={{ padding: 24, maxWidth: 340 }}>
      <p style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Thursday</p>
      <PencilText size="2rem" color="var(--paper-ui-graphite)">Call the printer before noon.</PencilText>
    </PaperCard>
  );
}`,
      Demo: () => (
        <PaperCard style={{ padding: 24, maxWidth: 340, display: 'grid', gap: 10 }}>
          <p style={eyebrow}>Thursday</p>
          <PencilText size="2rem" color="var(--paper-ui-graphite)">
            Call the printer before noon.
          </PencilText>
        </PaperCard>
      ),
    },
  ],
  keys: [
    ['Selection', 'The text can be selected, copied and found with find-in-page, like any text.'],
    ['Reduced motion', 'With `prefers-reduced-motion: reduce` the text appears complete, with no stroke animation.'],
  ],
  a11y: [
    'The ink is a 2D `<canvas>` marked `aria-hidden`. The same string sits in a transparent text layer above it, so screen readers read the text once.',
    'Each PencilText is its own small 2D canvas. Fine for headings and notes; not meant for paragraphs.',
  ],
  api: api('pencil-text'),
};

/* ───────────────────────────── PaperCard ───────────────────────────── */

function cardProps(opt: string) {
  return { interactive: opt === 'interactive', raised: opt === 'raised' };
}

const paperCard: Doc = {
  id: 'paper-card',
  name: 'PaperCard',
  role: 'card',
  summary: 'An `<article>` with a hairline edge, a soft shadow and an optional lift. CSS only, no GPU.',
  installNotes: [],
  usage: `${IMPORT_CSS}
import { PaperCard } from '@in-c0/paper-ui';

export function Entry() {
  return (
    <PaperCard aria-labelledby="entry-title" style={{ padding: 24 }}>
      <h3 id="entry-title">Proofs, second round</h3>
    </PaperCard>
  );
}`,
  usageNotes: [
    'PaperCard sets no padding, so the layout is yours.',
    'Cards never get their own shader. For a material behind a group of cards, put one PaperSurface or MaterialEffect behind all of them.',
  ],
  main: {
    id: 'proofs',
    title: 'Proof card',
    text: '',
    options: {
      label: 'variant',
      initial: 'interactive',
      values: [
        { v: 'plain', label: 'default' },
        { v: 'interactive', label: 'interactive' },
        { v: 'raised', label: 'raised' },
      ],
    },
    code: (opt) => `${IMPORT_CSS}
import { PaperButton, PaperCard } from '@in-c0/paper-ui';

export function ProofCard() {
  return (
    <PaperCard${opt === 'plain' ? '' : ` ${opt}`} aria-labelledby="proof-title" style={{ maxWidth: 360, padding: 24 }}>
      <p style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Field notes · 03</p>
      <h3 id="proof-title" style={{ fontFamily: 'var(--paper-ui-editorial)', fontSize: 26, fontWeight: 400 }}>
        Proofs, second round
      </h3>
      <p style={{ lineHeight: 1.6 }}>Cotton, 300 gsm, uncoated. Warm white holds graphite better than bright white.</p>
      <PaperButton variant="outline">Open proofs</PaperButton>
    </PaperCard>
  );
}`,
    Demo: ({ opt }) => (
      <PaperCard {...cardProps(opt)} aria-labelledby="proof-title" style={{ maxWidth: 360, padding: 24, display: 'grid', gap: 10, justifyItems: 'start' }}>
        <p style={eyebrow}>Field notes · 03</p>
        <h3 id="proof-title" style={{ ...editorial, fontSize: 26 }}>
          Proofs, second round
        </h3>
        <p style={body}>Cotton, 300 gsm, uncoated. Warm white holds graphite better than bright white.</p>
        <PaperButton variant="outline" style={{ marginTop: 4 }}>
          Open proofs
        </PaperButton>
      </PaperCard>
    ),
  },
  examples: [
    {
      id: 'shared-surface',
      title: 'Cards on one shared surface',
      text: 'One PaperSurface behind the group holds the only shader. The cards stay CSS: one WebGL context for the set, never one per card.',
      shader: true,
      fill: true,
      code: () => `${IMPORT_CSS}
import { PaperCard, PaperSurface } from '@in-c0/paper-ui';

const stock = [
  { name: 'Cotton', note: '300 gsm, uncoated' },
  { name: 'Kraft', note: '250 gsm, recycled' },
  { name: 'Vellum', note: '90 gsm, translucent' },
];

export function Stock() {
  return (
    <PaperSurface style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {stock.map((paper) => (
          <PaperCard key={paper.name} style={{ padding: 18 }}>
            <h3>{paper.name}</h3>
            <p>{paper.note}</p>
          </PaperCard>
        ))}
      </div>
    </PaperSurface>
  );
}`,
      Demo: ({ live }) => (
        <PaperSurface texture={live} style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {[
              { name: 'Cotton', note: '300 gsm, uncoated' },
              { name: 'Kraft', note: '250 gsm, recycled' },
              { name: 'Vellum', note: '90 gsm, translucent' },
            ].map((paper) => (
              <PaperCard key={paper.name} style={{ padding: 18, display: 'grid', gap: 4 }}>
                <h3 style={{ ...editorial, fontSize: 20 }}>{paper.name}</h3>
                <p style={{ ...body, fontSize: 13 }}>{paper.note}</p>
              </PaperCard>
            ))}
          </div>
        </PaperSurface>
      ),
    },
    {
      id: 'link',
      title: 'A card that leads somewhere',
      text: '`interactive` is visual only. Put a real link inside; the card lifts on hover (and, unreleased, while the link has focus).',
      code: () => `${IMPORT_CSS}
import { PaperCard } from '@in-c0/paper-ui';

export function ChecklistCard() {
  return (
    <PaperCard interactive style={{ maxWidth: 340, padding: 22 }}>
      <h3>
        <a href="https://github.com/in-c0/paper-ui/blob/main/docs/RELEASE_CHECKLIST.md">Release checklist</a>
      </h3>
      <p>Which audits are done, and which are still open before a stable release.</p>
    </PaperCard>
  );
}`,
      Demo: () => (
        <PaperCard interactive style={{ maxWidth: 340, padding: 22, display: 'grid', gap: 8 }}>
          <h3 style={{ ...editorial, fontSize: 22 }}>
            <a className="docs-demo-link" href={`${REPO}/blob/main/docs/RELEASE_CHECKLIST.md`} target="_blank" rel="noreferrer">
              Release checklist
            </a>
          </h3>
          <p style={body}>Which audits are done, and which are still open before a stable release.</p>
        </PaperCard>
      ),
    },
    {
      id: 'raised-charcoal',
      title: 'Raised, on charcoal',
      text: 'Inside a charcoal PaperSurface the card picks up a translucent fill and a light hairline.',
      fill: true,
      code: () => `${IMPORT_CSS}
import { PaperCard, PaperSurface } from '@in-c0/paper-ui';

export function NightNote() {
  return (
    <PaperSurface tone="charcoal" style={{ padding: 28 }}>
      <PaperCard raised style={{ maxWidth: 320, padding: 22 }}>
        <h3>Night shift</h3>
        <p>Press check at 22:00. Bring the loupe.</p>
      </PaperCard>
    </PaperSurface>
  );
}`,
      Demo: () => (
        <PaperSurface tone="charcoal" style={{ padding: 28 }}>
          <PaperCard raised style={{ maxWidth: 320, padding: 22, display: 'grid', gap: 6 }}>
            <h3 style={{ ...editorial, fontSize: 22 }}>Night shift</h3>
            <p style={{ ...body, color: 'var(--paper-ui-stone)' }}>Press check at 22:00. Bring the loupe.</p>
          </PaperCard>
        </PaperSurface>
      ),
    },
  ],
  keys: [
    ['Tab', 'Reaches the links and buttons inside. The card itself is not focusable.'],
    ['Focus inside', 'Unreleased: an `interactive` card lifts while anything inside it has focus, so keyboard users get the same cue as hover.'],
  ],
  a11y: [
    'Renders an `<article>`. Name it with `aria-labelledby` pointing at its heading.',
    '`interactive` adds no role, `tabIndex` or click handler. A whole-card click target is up to you, and it must still be a real link or button.',
    'Under reduced motion the lift is removed.',
    'Unreleased: under forced colours the card gets a system border.',
  ],
  api: api('paper-card'),
};

/* ───────────────────────────── PaperButton ───────────────────────────── */

function ButtonRow() {
  const [last, setLast] = useState('');
  return (
    <div style={{ display: 'grid', gap: 16, justifyItems: 'center' }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <PaperButton variant="ink" onClick={() => setLast('Save note')}>
          Save note
        </PaperButton>
        <PaperButton onClick={() => setLast('Cancel')}>Cancel</PaperButton>
        <PaperButton variant="outline" onClick={() => setLast('Export PDF')}>
          Export PDF
        </PaperButton>
      </div>
      <p role="status" style={{ ...body, fontSize: 13, minHeight: '1.6em' }}>
        {last && `Pressed: ${last}`}
      </p>
    </div>
  );
}

function SaveToggle() {
  const [saved, setSaved] = useState(false);
  return (
    <PaperButton variant={saved ? 'ink' : 'outline'} aria-pressed={saved} onClick={() => setSaved((s) => !s)}>
      {saved ? 'Saved' : 'Save note'}
    </PaperButton>
  );
}

function RenameForm() {
  const [name, setName] = useState('Cotton paper, morning');
  const [draft, setDraft] = useState(name);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setName(draft.trim() || name);
  };
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 10, width: 'min(100%, 340px)' }}>
      <p style={{ ...editorial, fontSize: 22 }}>{name}</p>
      <label htmlFor="study-name" style={{ ...body, fontSize: 13 }}>
        Study name
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input id="study-name" className="docs-demo-input" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <PaperButton type="submit" variant="ink">
          Rename
        </PaperButton>
      </div>
    </form>
  );
}

const paperButton: Doc = {
  id: 'paper-button',
  name: 'PaperButton',
  role: 'button',
  summary: 'A native `<button>` in three treatments: ink, quiet and outline.',
  installNotes: [],
  usage: `${IMPORT_CSS}
import { PaperButton } from '@in-c0/paper-ui';

export function Save({ onSave }: { onSave: () => void }) {
  return (
    <PaperButton variant="ink" onClick={onSave}>
      Save note
    </PaperButton>
  );
}`,
  usageNotes: [
    'It is a `<button>` with classes. Every native attribute and handler passes through, and the ref reaches the element.',
    '`type` defaults to `"button"`, so a PaperButton inside a form only submits when you say `type="submit"`.',
  ],
  main: {
    id: 'variants',
    title: 'Three treatments',
    text: '',
    code: () => `${IMPORT_CSS}
import { PaperButton } from '@in-c0/paper-ui';
import { useState } from 'react';

export function Toolbar() {
  const [last, setLast] = useState('');
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <PaperButton variant="ink" onClick={() => setLast('Save note')}>Save note</PaperButton>
        <PaperButton onClick={() => setLast('Cancel')}>Cancel</PaperButton>
        <PaperButton variant="outline" onClick={() => setLast('Export PDF')}>Export PDF</PaperButton>
      </div>
      <p role="status">{last && \`Pressed: \${last}\`}</p>
    </>
  );
}`,
    Demo: () => <ButtonRow />,
  },
  examples: [
    {
      id: 'toggle',
      title: 'A toggle',
      text: 'With `aria-pressed` the button announces its state. Unreleased: the stylesheet also draws a border while it is pressed.',
      code: () => `${IMPORT_CSS}
import { PaperButton } from '@in-c0/paper-ui';
import { useState } from 'react';

export function SaveToggle() {
  const [saved, setSaved] = useState(false);
  return (
    <PaperButton variant={saved ? 'ink' : 'outline'} aria-pressed={saved} onClick={() => setSaved((s) => !s)}>
      {saved ? 'Saved' : 'Save note'}
    </PaperButton>
  );
}`,
      Demo: () => <SaveToggle />,
    },
    {
      id: 'form',
      title: 'Submitting a form',
      text: 'Pass `type="submit"` and Enter in the field submits. Nothing here leaves the page.',
      code: () => `${IMPORT_CSS}
import { PaperButton } from '@in-c0/paper-ui';
import { type FormEvent, useState } from 'react';

export function RenameForm() {
  const [name, setName] = useState('Cotton paper, morning');
  const [draft, setDraft] = useState(name);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setName(draft.trim() || name);
  };
  return (
    <form onSubmit={submit}>
      <h3>{name}</h3>
      <label htmlFor="study-name">Study name</label>
      <input id="study-name" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <PaperButton type="submit" variant="ink">Rename</PaperButton>
    </form>
  );
}`,
      Demo: () => <RenameForm />,
    },
    {
      id: 'disabled',
      title: 'Disabled',
      text: 'Disabled buttons drop to half opacity and leave the tab order. Say nearby why the action is unavailable.',
      code: () => `${IMPORT_CSS}
import { PaperButton } from '@in-c0/paper-ui';

export function Locked() {
  return (
    <div>
      <PaperButton variant="ink" disabled>Publish</PaperButton>
      <PaperButton variant="outline" disabled>Schedule</PaperButton>
      <p>Publishing opens after the accessibility audit.</p>
    </div>
  );
}`,
      Demo: () => (
        <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <PaperButton variant="ink" disabled>
              Publish
            </PaperButton>
            <PaperButton variant="outline" disabled>
              Schedule
            </PaperButton>
          </div>
          <p style={{ ...body, fontSize: 13 }}>Publishing opens after the accessibility audit.</p>
        </div>
      ),
    },
  ],
  keys: [
    ['Tab / Shift+Tab', 'Focus, with a 2 px ink outline offset by 3 px.'],
    ['Enter / Space', 'Activate. Native button behaviour, nothing re-implemented.'],
  ],
  a11y: [
    'The accessible name is the button’s text. An icon-only button needs `aria-label`.',
    'Press feedback is a 1 px nudge, removed under reduced motion.',
    'Unreleased: under forced colours the focus ring uses the system `Highlight` colour.',
  ],
  api: api('paper-button'),
};

export const DOCS: Doc[] = [paperSurface, materialEffect, pencilText, paperCard, paperButton];
