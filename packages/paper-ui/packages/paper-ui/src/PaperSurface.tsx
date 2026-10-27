'use client';

import { type CSSProperties, type HTMLAttributes, lazy, type ReactNode, Suspense } from 'react';
import { ShaderErrorBoundary } from './ShaderErrorBoundary.tsx';
import { type PaperTextureSettings, WHISPERS_PAPER_PRESET } from './tokens.ts';
import { useShaderRuntime } from './useShaderRuntime.ts';

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
  const { containerRef, active, status, maxPixelCount, recoveryKey } = useShaderRuntime(texture && tone === 'paper');
  const combinedStyle = { ...style } as CSSProperties;

  return (
    <div
      {...props}
      ref={containerRef}
      className={['pui-surface', 'pui-surface--' + tone, 'pui-light--' + light, className].filter(Boolean).join(' ')}
      style={combinedStyle}
      data-paper-surface=""
      data-shader-status={status}
      data-shader-pixel-budget={maxPixelCount}
    >
      {active && (
        <div className="pui-surface__shader" aria-hidden="true">
          <ShaderErrorBoundary>
            <Suspense fallback={null}>
              <LazyPaperTexture
                key={recoveryKey}
                {...WHISPERS_PAPER_PRESET}
                {...material}
                width="100%"
                height="100%"
                maxPixelCount={maxPixelCount}
                style={{ width: '100%', height: '100%' }}
              />
            </Suspense>
          </ShaderErrorBoundary>
        </div>
      )}
      <div className="pui-surface__light" aria-hidden="true" />
      <div className="pui-surface__content">{children}</div>
    </div>
  );
}
