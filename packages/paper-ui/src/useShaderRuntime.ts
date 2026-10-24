'use client';

import { useEffect, useRef, useState } from 'react';

// A page may mount several paper surfaces; probing GPU support per component
// would allocate a context for every surface even before any shader is shown.
let cachedWebglSupport: boolean | undefined;

/**
 * Keep decorative GPU work out of background tabs and offscreen components.
 * The semantic DOM and CSS layers must remain mounted at all times.
 */
export function useShaderRuntime(requested: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

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
      const canvas = document.createElement('canvas');
      context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    } catch {
      // Browser or privacy setting disallows WebGL. The CSS fallback is sufficient.
    }
    cachedWebglSupport = Boolean(context);
    setWebglSupported(cachedWebglSupport);
    // Release the temporary *probe* context; the actual shader owns its own canvas.
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
    const handleVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    handleVisibility();
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotion = () => setReducedMotion(media.matches);
    handleMotion();
    media.addEventListener('change', handleMotion);
    return () => media.removeEventListener('change', handleMotion);
  }, []);

  const active = requested && webglSupported && onScreen && pageVisible;

  return {
    containerRef,
    active,
    reducedMotion,
    status: !requested || !webglSupported ? 'fallback' : active ? 'webgl' : 'suspended',
  } as const;
}
