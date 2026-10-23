'use client';

import { type CSSProperties, lazy, type ReactNode, Suspense, useEffect, useState } from 'react';
import type { MaterialKind, MaterialTuning } from './material-presets.ts';

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

/** One shader instance, never a grid of canvases.
 * Controls and text remain in a normal accessible DOM above the shader.
 */
export function MaterialEffect({ kind, tuning, image, paused = false, className = '', style, children }: MaterialEffectProps) {
  const [enabled, setEnabled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let context: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    try {
      const canvas = document.createElement('canvas');
      context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    } catch {
      // Canvas remains a readable CSS approximation on unsupported devices.
    }
    setEnabled(Boolean(context));
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handle = () => setReducedMotion(media.matches);
    handle();
    media.addEventListener('change', handle);
    return () => media.removeEventListener('change', handle);
  }, []);

  return (
    <div
      className={['pui-material-effect', `pui-material-effect--${kind}`, className].filter(Boolean).join(' ')}
      style={style}
      data-material-kind={kind}
    >
      {enabled ? (
        <div className="pui-material-effect__shader" aria-hidden="true">
          <Suspense fallback={null}>
            <MaterialShader kind={kind} tuning={tuning} image={image} paused={paused || reducedMotion} />
          </Suspense>
        </div>
      ) : kind === 'halftone' && image ? (
        <img className="pui-material-effect__fallback-image" src={image} alt="" aria-hidden="true" />
      ) : null}
      <div className="pui-material-effect__content">{children}</div>
    </div>
  );
}
