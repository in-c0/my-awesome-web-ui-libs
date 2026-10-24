'use client';

import { useEffect, useRef, useState } from 'react';

// One capability probe per loaded document avoids allocating a temporary WebGL
// context for each React surface. Context loss of a real canvas is tracked separately.
let cachedWebglSupport: boolean | undefined;

export const SHADER_PIXEL_BUDGET = {
  compact: 480_000,
  standard: 1_200_000,
} as const;

/**
 * Material effects are decorative: backgrounded/offscreen work is suspended and
 * the normal DOM/CSS fallback remains usable during WebGL context loss.
 */
export function useShaderRuntime(requested: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [compactGpu, setCompactGpu] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState(0);

  useEffect(() => {
    if (!requested) {
      setWebglSupported(false);
      return;
    }
    if (cachedWebglSupport !== undefined) {
      setWebglSupported(cachedWebglSupport);
      return;
    }
    let context: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    try {
      const probe = document.createElement('canvas');
      context = probe.getContext('webgl2') || probe.getContext('webgl');
    } catch {
      // Sandbox or privacy policy disallows WebGL; the CSS fallback is sufficient.
    }
    cachedWebglSupport = Boolean(context);
    setWebglSupported(cachedWebglSupport);
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  }, [requested]);

  useEffect(() => {
    if (!requested || typeof IntersectionObserver === 'undefined' || !containerRef.current) {
      setOnScreen(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry?.isIntersecting ?? true),
      { rootMargin: '100px' },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [requested]);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    // On mobile/coarse-pointer devices the default quality is capped rather
    // than allowing retina DPR to produce multi-million-pixel shader buffers.
    const compact = window.matchMedia('(max-width: 860px), (pointer: coarse)');
    const update = () => setCompactGpu(compact.matches);
    update();
    compact.addEventListener('change', update);
    return () => compact.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!requested) return;
    const root = containerRef.current;
    if (!root) return;

    // WebGL loss/restoration events do not bubble. Listen in *capture* phase
    // on the stable semantic container, not on the replaceable shader canvas.
    const lost = (event: Event) => {
      if (!(event.target instanceof HTMLCanvasElement)) return;
      // Required for browsers to attempt restoring the lost WebGL context.
      event.preventDefault();
      setContextLost(true);
    };
    const restored = (event: Event) => {
      if (!(event.target instanceof HTMLCanvasElement)) return;
      setRecoveryKey((key) => key + 1);
      setContextLost(false);
    };
    root.addEventListener('webglcontextlost', lost, true);
    root.addEventListener('webglcontextrestored', restored, true);
    return () => {
      root.removeEventListener('webglcontextlost', lost, true);
      root.removeEventListener('webglcontextrestored', restored, true);
    };
  }, [requested]);

  const active = requested && webglSupported && onScreen && pageVisible;
  const status = !requested || !webglSupported
    ? 'fallback'
    : contextLost
      ? 'context-lost'
      : active
        ? 'webgl'
        : 'suspended';

  return {
    containerRef,
    active,
    reducedMotion,
    recoveryKey,
    maxPixelCount: compactGpu ? SHADER_PIXEL_BUDGET.compact : SHADER_PIXEL_BUDGET.standard,
    status,
  } as const;
}
