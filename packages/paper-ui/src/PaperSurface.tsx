'use client';

import { type CSSProperties, type HTMLAttributes, lazy, type ReactNode, Suspense, useEffect, useState } from 'react';
import { type PaperTextureSettings, WHISPERS_PAPER_PRESET } from './tokens.ts';

/** Lazy, browser-only shader: the semantic DOM and CSS fallback render without WebGL. */
const LazyPaperTexture = lazy(async () => {
  const mod = await import('@paper-design/shaders-react');
  return { default: mod.PaperTexture };
});

export interface PaperSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** True only for selected large surfaces; do not mount one WebGL canvas per gallery card. */
  texture?: boolean;
  /** Override the exact owner preset without modifying its original token values. */
  material?: Partial<PaperTextureSettings>;
  /** Warm, extremely subtle desktop light; fixed lighting rather than a physical lamp simulation. */
  light?: 'desk' | 'diffuse' | 'none';
  /** Render dark graphite surface with readable text and without a white paper shader. */
  tone?: 'paper' | 'charcoal';
}

/** Accessible DOM surface with optional Paper Shaders material and a graceful CSS fallback. */
export function PaperSurface({
  children,
  texture = true,
  material,
  light = 'desk',
  tone = 'paper',
  className = '',
  style,
  ...props
}: PaperSurfaceProps) {
  const [canRenderShader, setCanRenderShader] = useState(false);

  useEffect(() => {
    if (!texture || tone === 'charcoal') {
      setCanRenderShader(false);
      return;
    }
    const canvas = document.createElement('canvas');
    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    } catch {
      gl = null;
    }
    setCanRenderShader(Boolean(gl));
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }, [texture, tone]);

  const combinedStyle = { ...style } as CSSProperties;

  return (
    <div
      {...props}
      className={['pui-surface', 'pui-surface--' + tone, 'pui-light--' + light, className].filter(Boolean).join(' ')}
      style={combinedStyle}
      data-paper-surface=""
    >
      {texture && tone === 'paper' && canRenderShader && (
        <div className="pui-surface__shader" aria-hidden="true">
          <Suspense fallback={null}>
            <LazyPaperTexture
              {...WHISPERS_PAPER_PRESET}
              {...material}
              width="100%"
              height="100%"
              maxPixelCount={2_000_000}
              style={{ width: '100%', height: '100%' }}
            />
          </Suspense>
        </div>
      )}
      <div className="pui-surface__light" aria-hidden="true" />
      <div className="pui-surface__content">{children}</div>
    </div>
  );
}
