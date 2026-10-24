import {
  MATERIAL_KINDS,
  MATERIAL_PRESETS,
  MaterialEffect,
  type MaterialKind,
  type MaterialTuning,
  PaperButton,
  PaperCard,
  PencilText,
  WHISPERS_PAPER_PRESET,
} from '@in-c0/paper-ui';
import { useEffect, useState } from 'react';
import koreanFont from 'tegaki/fonts/nanum-pen-script';
import './studio.css';

type Mode = 'material' | 'handwriting';
type Param = {
  key: keyof MaterialTuning;
  label: string;
  min: number;
  max: number;
  step: number;
  description?: string;
};

const labels: Record<MaterialKind, { category: string; title: string; subtitle: string }> = {
  'paper-texture': { category: '01 / MATERIAL', title: 'Paper, in the light.', subtitle: 'A fine surface that catches the afternoon.' },
  'grain-sphere': { category: '02 / LIGHT', title: 'The afternoon arrives.', subtitle: 'A quiet pool of warmth and shadow.' },
  'grain-blob': { category: '03 / LIGHT', title: 'Something, softly moving.', subtitle: 'A low, gentle drift behind the work.' },
  'grain-wave': { category: '04 / LIGHT', title: 'A slow passing moment.', subtitle: 'Warm light finding its way across the page.' },
  dithering: { category: '05 / PRINT', title: 'Light becomes pixels.', subtitle: 'A fine dialogue between grain and digital ink.' },
  halftone: { category: '06 / PRINT', title: 'Collected impressions.', subtitle: 'A simple drawing through the language of print.' },
};

const params: Record<MaterialKind, Param[]> = {
  'paper-texture': [
    { key: 'angle', label: 'Light direction', min: 0, max: 360, step: 1, description: 'Direction of the shading.' },
    { key: 'roughness', label: 'Paper roughness', min: 0, max: 1, step: 0.01 },
    { key: 'wrinkles', label: 'Surface wrinkles', min: 0, max: 1, step: 0.01 },
  ],
  'grain-sphere': [
    { key: 'speed', label: 'Movement', min: 0, max: 2, step: 0.01 },
    { key: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01 },
    { key: 'noise', label: 'Grain', min: 0, max: 1, step: 0.01 },
    { key: 'scale', label: 'Scale', min: 0.2, max: 3, step: 0.01 },
  ],
  'grain-blob': [
    { key: 'speed', label: 'Movement', min: 0, max: 2, step: 0.01 },
    { key: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01 },
    { key: 'noise', label: 'Grain', min: 0, max: 1, step: 0.01 },
    { key: 'scale', label: 'Scale', min: 0.2, max: 3, step: 0.01 },
  ],
  'grain-wave': [
    { key: 'speed', label: 'Movement', min: 0, max: 2, step: 0.01 },
    { key: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01 },
    { key: 'noise', label: 'Grain', min: 0, max: 1, step: 0.01 },
    { key: 'scale', label: 'Scale', min: 0.2, max: 3, step: 0.01 },
  ],
  dithering: [
    { key: 'speed', label: 'Movement', min: 0, max: 2, step: 0.01 },
    { key: 'size', label: 'Pixel scale', min: 1, max: 12, step: 0.25 },
    { key: 'scale', label: 'Scale', min: 0.2, max: 3, step: 0.01 },
  ],
  halftone: [
    { key: 'size', label: 'Dot size', min: 0, max: 1, step: 0.01 },
    { key: 'contrast', label: 'Contrast', min: 0, max: 1, step: 0.01 },
    { key: 'scale', label: 'Scale', min: 0.2, max: 3, step: 0.01 },
  ],
};

function isKind(value: string | null): value is MaterialKind {
  return MATERIAL_KINDS.some((item) => item === value);
}

function startState(): { kind: MaterialKind; tuning: MaterialTuning } {
  if (typeof window === 'undefined') return { kind: 'paper-texture', tuning: {} };
  const search = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const kind = isKind(search.get('effect')) ? (search.get('effect') as MaterialKind) : 'paper-texture';
  const tuning: MaterialTuning = {};
  for (const { key, min, max } of params[kind]) {
    const raw = search.get(key);
    if (raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw))) {
      tuning[key] = Math.max(min, Math.min(max, Number(raw)));
    }
  }
  return { kind, tuning };
}

function baseValue(kind: MaterialKind, key: keyof MaterialTuning): number {
  const source = kind === 'paper-texture' ? WHISPERS_PAPER_PRESET : MATERIAL_PRESETS[kind];
  const entry = (source as unknown as Record<string, unknown>)[key];
  return typeof entry === 'number' ? entry : 0;
}

function display(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function sourceSnippet(kind: MaterialKind, tuning: MaterialTuning, image: string): string {
  const tuned = params[kind]
    .filter(({ key }) => tuning[key] !== undefined && tuning[key] !== baseValue(kind, key))
    .map(({ key }) => key + ': ' + display(tuning[key] as number));
  const tuneText = tuned.length ? ' tuning={{ ' + tuned.join(', ') + ' }}' : '';
  const imageText = kind === 'halftone' ? ' image="' + image + '"' : '';
  return [
    "import '@in-c0/paper-ui/styles.css';",
    "import { MaterialEffect } from '@in-c0/paper-ui';",
    '',
    '<MaterialEffect kind="' + kind + '"' + tuneText + imageText + ' style={{ minHeight: 360 }}>',
    '  <p style={{ padding: 40 }}>A little, over time.</p>',
    '</MaterialEffect>',
  ].join('\n');
}

function Icon({ name }: { name: 'paper' | 'sun' | 'wave' | 'print' | 'pen' | 'copy' | 'check' | 'pause' | 'play' | 'reset' }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.55,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  if (name === 'paper')
    return (
      <svg {...common}>
        <path d="M6 3.5h9l3 3V21H6z" />
        <path d="M15 3.5V7h3" />
        <path d="M9 12h6M9 16h5" />
      </svg>
    );
  if (name === 'sun')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2" />
      </svg>
    );
  if (name === 'wave')
    return (
      <svg {...common}>
        <path d="M2 12c3-6 7-6 10 0s7 6 10 0" />
      </svg>
    );
  if (name === 'print')
    return (
      <svg {...common}>
        <path d="M5 5h14v14H5zM9 9h.01M15 9h.01M9 15h.01M15 15h.01M12 12h.01" strokeWidth="2.5" />
      </svg>
    );
  if (name === 'pen')
    return (
      <svg {...common}>
        <path d="m4 20 5-.9L20 8a2 2 0 0 0-4-4L5 15zM13 7l4 4" />
      </svg>
    );
  if (name === 'copy')
    return (
      <svg {...common}>
        <rect x="8" y="8" width="12" height="12" rx="1" />
        <path d="M16 8V4H4v12h4" />
      </svg>
    );
  if (name === 'check')
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  if (name === 'pause')
    return (
      <svg {...common}>
        <path d="M9 5v14M15 5v14" strokeWidth="3" />
      </svg>
    );
  if (name === 'play')
    return (
      <svg {...common}>
        <path d="m8 5 11 7-11 7z" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M3 12a9 9 0 1 0 3-6M3 4v5h5" />
    </svg>
  );
}

function StudioSlider({ control, value, change }: { control: Param; value: number; change: (value: number) => void }) {
  const progress = ((value - control.min) / (control.max - control.min)) * 100;
  return (
    <div className="studio-control">
      <div className="studio-control__heading">
        <label htmlFor={'studio-' + control.key}>{control.label}</label>
        <output htmlFor={'studio-' + control.key}>
          {display(value)}
          {control.key === 'angle' ? '°' : ''}
        </output>
      </div>
      <input
        id={'studio-' + control.key}
        className="studio-range"
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        style={{ background: 'linear-gradient(to right, #55514b ' + progress + '%, #d6d0c5 ' + progress + '%)' }}
        onChange={(event) => change(Number(event.target.value))}
      />
      {control.description && <p className="studio-control__hint">{control.description}</p>}
    </div>
  );
}

export function StudioApp() {
  const [initial] = useState(startState);
  const [kind, setKind] = useState<MaterialKind>(initial.kind);
  const [tuning, setTuning] = useState<MaterialTuning>(initial.tuning);
  const [mode, setMode] = useState<Mode>('material');
  const [playing, setPlaying] = useState(true);
  const [showShader, setShowShader] = useState(true);
  const [sample, setSample] = useState('A little, over time.');
  const [writing, setWriting] = useState('조금씩, 꾸준히.');
  const [writingKey, setWritingKey] = useState(0);
  const [ink, setInk] = useState<'soft' | 'dark'>('soft');
  const [saved, setSaved] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [status, setStatus] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const search = new URLSearchParams();
    search.set('effect', kind);
    for (const { key } of params[kind]) {
      if (tuning[key] !== undefined) search.set(key, display(tuning[key] as number));
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#' + search.toString());
  }, [kind, tuning]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const active = labels[kind];
  const paused = !playing || reducedMotion;
  const isWriting = mode === 'handwriting';
  const chosenKind = isWriting ? 'paper-texture' : kind;
  const changeKind = (next: MaterialKind) => {
    setMode('material');
    setKind(next);
    setTuning({});
    setPlaying(true);
    setStatus('');
  };

  async function copy(value: string, success: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(success);
    } catch {
      setStatus('Clipboard unavailable in this browser.');
    }
  }

  const previewImage = imageUrl ?? '/halftone-study.svg';

  return (
    <div className="studio-app">
      <header className="studio-header">
        <div className="studio-brand">
          <span className="studio-brand__mark">w.</span>
          <div>
            <strong>paper / graphite</strong>
            <span>an interactive material study</span>
          </div>
        </div>
        <div className="studio-header__meta">
          <span className="studio-status-dot" />
          Whispers material library <span className="studio-header__division">/</span> 01
        </div>
        <a className="studio-header__source" href="https://github.com/in-c0/paper-ui" target="_blank" rel="noreferrer">
          Source <span aria-hidden="true">↗</span>
        </a>
      </header>

      <div className="studio-layout">
        <nav className="studio-nav" aria-label="Components and materials">
          <div className="studio-nav__eyebrow">THE COLLECTION</div>
          <p className="studio-nav__intro">
            Surfaces made
            <br />
            to feel a little closer.
          </p>
          <div className="studio-nav__group-title">
            MATERIALS <span>06</span>
          </div>
          <div className="studio-nav__items">
            {MATERIAL_KINDS.map((item) => (
              <button
                type="button"
                key={item}
                className={'studio-nav__item' + (!isWriting && kind === item ? ' is-active' : '')}
                aria-current={!isWriting && kind === item ? 'true' : undefined}
                onClick={() => changeKind(item)}
              >
                <span className={'studio-nav__glyph studio-nav__glyph--' + item}>
                  <Icon
                    name={
                      item === 'paper-texture'
                        ? 'paper'
                        : item === 'halftone' || item === 'dithering'
                          ? 'print'
                          : item === 'grain-wave'
                            ? 'wave'
                            : 'sun'
                    }
                  />
                </span>
                <span>{MATERIAL_PRESETS[item].label}</span>
                <span className="studio-nav__arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            ))}
          </div>
          <div className="studio-nav__group-title studio-nav__group-title--second">
            LETTERING <span>01</span>
          </div>
          <button
            type="button"
            className={'studio-nav__item' + (isWriting ? ' is-active' : '')}
            aria-current={isWriting ? 'true' : undefined}
            onClick={() => {
              setMode('handwriting');
              setStatus('');
            }}
          >
            <span className="studio-nav__glyph">
              <Icon name="pen" />
            </span>
            <span>Written in graphite</span>
            <span className="studio-nav__arrow" aria-hidden="true">
              ↗
            </span>
          </button>
          <div className="studio-nav__footer">
            <span className="studio-status-dot" /> experimental / open source
          </div>
        </nav>

        <main className="studio-workspace" id="main">
          <div className="studio-workspace__top">
            <div>
              <div className="studio-eyebrow">
                STUDY <span className="studio-workspace__slash">/</span> {isWriting ? '07 — LETTERING' : active.category}
              </div>
              <h1>{isWriting ? 'Words, made slowly.' : active.title}</h1>
              <p>{isWriting ? 'A handwritten note, traced one stroke at a time.' : active.subtitle}</p>
            </div>
            <div className="studio-workspace__flag">
              LIVE PREVIEW <span className="studio-status-dot" />
            </div>
          </div>
          <div className="studio-preview-wrap">
            <div className="studio-preview">
              <MaterialEffect
                key={chosenKind}
                kind={chosenKind}
                tuning={isWriting ? undefined : tuning}
                paused={paused}
                renderMode={showShader ? 'auto' : 'fallback'}
                image={previewImage}
                className="studio-preview__material"
              >
                {chosenKind !== 'halftone' && (
                  <div className="studio-preview__composition">
                    <div className="studio-preview__tiny">w h i s p e r s .</div>
                    <div className="studio-preview__center">
                      {isWriting ? (
                        <div key={writingKey} className="studio-preview__handwriting">
                          <PencilText font={koreanFont} size="clamp(30px, 5vw, 60px)" color={ink === 'dark' ? '#282723' : '#65615a'}>
                            {writing}
                          </PencilText>
                        </div>
                      ) : (
                        <div className="studio-preview__sample" lang="en">
                          {sample || ' '}
                        </div>
                      )}
                      <span className="studio-preview__quiet-mark">a little, over time.</span>
                    </div>
                    <span className="studio-preview__page">
                      01 <span aria-hidden="true">—</span> 06
                    </span>
                  </div>
                )}
              </MaterialEffect>
            </div>
            <div className="studio-preview__caption">
              <span>{isWriting ? 'Tegaki / letterforms' : MATERIAL_PRESETS[kind].label + ' / material'}</span>
              <div className="studio-preview__tools">
                <span className="studio-preview__mode">
                  {!showShader
                    ? 'CSS / ORIGINAL'
                    : chosenKind === 'halftone'
                      ? 'IMAGE / LIVE FILTER'
                      : chosenKind === 'paper-texture'
                        ? 'SURFACE / LIVE'
                        : paused
                          ? 'MOTION PAUSED'
                          : 'ANIMATED / LIVE'}
                </span>
                <button
                  type="button"
                  className="studio-compare"
                  aria-pressed={!showShader}
                  onClick={() => setShowShader((value) => !value)}
                >
                  {showShader ? 'Compare without shader' : 'Restore shader'}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          </div>
          <div className="studio-bottom">
            <PaperCard className="studio-bottom__card">
              <div className="studio-bottom__label">COMPONENT 01</div>
              <div className="studio-bottom__card-main">
                <span className="studio-bottom__script">A small beginning.</span>
                <PaperButton variant={saved ? 'ink' : 'outline'} onClick={() => setSaved((current) => !current)} aria-pressed={saved}>
                  <Icon name={saved ? 'check' : 'paper'} />
                  {saved ? 'Saved' : 'Save note'}
                </PaperButton>
              </div>
            </PaperCard>
            <p className="studio-bottom__description">
              A work in progress, with actual materials.
              <br />
              Accessible DOM controls; a single shader canvas.
            </p>
          </div>
        </main>

        <aside className="studio-inspector" aria-label="Material controls">
          <div className="studio-inspector__top">
            <div>
              <span>INSPECTOR</span>
              <h2>{isWriting ? 'Lettering' : 'Material'}</h2>
            </div>
            <button
              type="button"
              className="studio-icon-button"
              title="Reset parameters"
              aria-label="Reset parameters"
              onClick={() => {
                setTuning({});
                setPlaying(true);
                setInk('soft');
                setStatus('Settings restored.');
              }}
            >
              <Icon name="reset" />
            </button>
          </div>
          <div className="studio-inspector__body">
            <div className="studio-inspector__section">
              <div className="studio-inspector__section-title">
                <span>01</span> {isWriting ? 'THE WORDS' : 'SURFACE SETTINGS'}
              </div>
              {isWriting ? (
                <>
                  <label className="studio-field-label" htmlFor="writing-sample">
                    Handwritten text
                  </label>
                  <textarea
                    className="studio-textarea"
                    id="writing-sample"
                    value={writing}
                    maxLength={70}
                    onChange={(event) => setWriting(event.target.value)}
                    rows={2}
                  />
                  <div className="studio-inspector__hint">Uses Nanum Pen Script. Works with Korean and Latin.</div>
                  <button className="studio-secondary-action" type="button" onClick={() => setWritingKey((key) => key + 1)}>
                    <Icon name="play" />
                    Write it again
                  </button>
                  <div className="studio-field-label">Graphite tone</div>
                  <div className="studio-segment" role="group" aria-label="Graphite tone">
                    <button
                      type="button"
                      className={ink === 'soft' ? 'is-active' : ''}
                      aria-pressed={ink === 'soft'}
                      onClick={() => setInk('soft')}
                    >
                      Soft pencil
                    </button>
                    <button
                      type="button"
                      className={ink === 'dark' ? 'is-active' : ''}
                      aria-pressed={ink === 'dark'}
                      onClick={() => setInk('dark')}
                    >
                      Dark pencil
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {params[kind].map((control) => (
                    <StudioSlider
                      key={control.key}
                      control={control}
                      value={tuning[control.key] ?? baseValue(kind, control.key)}
                      change={(value) => setTuning((current) => ({ ...current, [control.key]: value }))}
                    />
                  ))}
                  {kind === 'halftone' && (
                    <div className="studio-upload">
                      <label htmlFor="halftone-upload" className="studio-upload__trigger">
                        <span className="studio-upload__title">Your drawing</span>
                        <span className="studio-upload__browse">
                          Select image <span aria-hidden="true">↗</span>
                        </span>
                      </label>
                      <input
                        id="halftone-upload"
                        className="studio-upload__input"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        aria-describedby="halftone-help"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (!file.type.startsWith('image/') || file.size > 8_000_000) {
                            setStatus('Choose an image smaller than 8 MB.');
                            return;
                          }
                          setImageUrl(URL.createObjectURL(file));
                          setImageName(file.name);
                          setStatus('Image preview updated locally. Nothing uploaded.');
                        }}
                      />
                      <p className="studio-upload__filename" aria-live="polite">
                        {imageName || 'SVG, PNG, JPG or WebP · up to 8 MB'}
                      </p>
                      <p id="halftone-help">Images stay in this browser; nothing is uploaded.</p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="studio-inspector__section studio-inspector__section--after">
              <div className="studio-inspector__section-title">
                <span>02</span> PREVIEW
              </div>
              {!isWriting && kind !== 'halftone' && (
                <>
                  <label className="studio-field-label" htmlFor="sample-text">
                    Sample text
                  </label>
                  <input
                    className="studio-text-input"
                    id="sample-text"
                    value={sample}
                    maxLength={60}
                    onChange={(event) => setSample(event.target.value)}
                  />
                </>
              )}
              {!isWriting && kind !== 'paper-texture' && kind !== 'halftone' && (
                <button
                  type="button"
                  className="studio-secondary-action"
                  aria-pressed={paused}
                  onClick={() => setPlaying((value) => !value)}
                  disabled={reducedMotion}
                >
                  <Icon name={paused ? 'play' : 'pause'} />
                  {reducedMotion ? 'Reduced motion enabled' : paused ? 'Resume animation' : 'Pause animation'}
                </button>
              )}
              <div className="studio-inspector__hint">
                The texture and lettering stay separate from the real, keyboard-accessible controls.
              </div>
            </div>
          </div>
          <div className="studio-inspector__footer">
            <div className="studio-inspector__section-title">
              <span>03</span> TAKE IT WITH YOU
            </div>
            <div className="studio-inspector__actions">
              <button
                type="button"
                className="studio-action--primary"
                onClick={() =>
                  copy(
                    isWriting
                      ? [
                          "import '@in-c0/paper-ui/styles.css';",
                          "import { PencilText } from '@in-c0/paper-ui';",
                          "import korean from 'tegaki/fonts/nanum-pen-script';",
                          '',
                          '<PencilText font={korean}>' + writing.replaceAll('<', '&lt;').replaceAll('>', '&gt;') + '</PencilText>',
                        ].join('\n')
                      : sourceSnippet(kind, tuning, '/my-artwork.png'),
                    'React component copied.',
                  )
                }
              >
                <Icon name="copy" /> Copy component
              </button>
              <button
                type="button"
                className="studio-action--secondary"
                onClick={() => copy(window.location.href, 'Shareable link copied.')}
              >
                <Icon name="copy" /> Copy link
              </button>
            </div>
            <p className="studio-live-status" role="status">
              {status}
            </p>
            <p className="studio-inspector__fineprint">
              Material studies using Paper Shaders and Tegaki. Experimental; not production-certified.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
