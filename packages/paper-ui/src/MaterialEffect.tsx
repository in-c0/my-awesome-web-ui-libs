'use client';

import { type CSSProperties, lazy, type ReactNode, Suspense } from 'react';
import type { MaterialKind, MaterialTuning } from './material-presets.ts';
import { ShaderErrorBoundary } from './ShaderErrorBoundary.tsx';
import { useShaderRuntime } from './useShaderRuntime.ts';

const MaterialShader = lazy(async () => {
  const { MaterialShaderRenderer } = await import('./MaterialShaderRenderer.tsx');
  return { default: MaterialShaderRenderer };
});

export interface MaterialEffectProps {
  kind: MaterialKind;
  tuning?: MaterialTuning;
  image?: string;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Render semantic DOM content above a single decorative GPU material.
 * A CSS fallback survives no-WebGL browsers, background tabs, and shader errors.
 */
export function MaterialEffect({ kind, tuning, image, paused = false, className = '', style, children }: MaterialEffectProps) {
  const { containerRef, active, reducedMotion, status } = useShaderRuntime(true);

  return (
    <div
      ref={containerRef}
      className={['pui-material-effect', `pui-material-effect--${kind}`, className].filter(Boolean).join(' ')}
      style={style}
      data-material-kind={kind}
      data-shader-status={status}
    >
      {kind === 'halftone' && image && (
        <img className="pui-material-effect__fallback-image" src={image} alt="" aria-hidden="true" />
      )}
      {active && (
        <div className="pui-material-effect__shader" aria-hidden="true">
          <ShaderErrorBoundary>
            <Suspense fallback={null}>
              <MaterialShader kind={kind} tuning={tuning} image={image} paused={paused || reducedMotion} />
            </Suspense>
          </ShaderErrorBoundary>
        </div>
      )}
      <div className="pui-material-effect__content">{children}</div>
    </div>
  );
}
