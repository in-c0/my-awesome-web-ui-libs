'use client';

import type { CSSProperties } from 'react';
import caveat from 'tegaki/fonts/caveat';
import type { TegakiRendererProps } from 'tegaki/react';
import { TegakiRenderer } from 'tegaki/react';

export interface PencilTextProps {
  children: string;
  /** Supply a different Tegaki bundle for Korean or other scripts; no font substitution is invented. */
  font?: TegakiRendererProps['font'];
  animate?: boolean;
  size?: number | string;
  color?: string;
  pressure?: number;
  seed?: number;
  className?: string;
  style?: CSSProperties;
}

/** Genuine stroke-order handwriting from the existing fork's Tegaki renderer.
 * Not a physically simulated graphite deposition shader.
 */
export function PencilText({
  children,
  font = caveat,
  animate = true,
  size = '2.2rem',
  color = 'var(--paper-ui-ink)',
  pressure = 0.8,
  seed = 893,
  className,
  style,
}: PencilTextProps) {
  return (
    <TegakiRenderer
      as="span"
      font={font}
      time={animate ? undefined : { mode: 'controlled', value: 1, unit: 'progress' }}
      reducedMotion="user"
      pressure={pressure}
      seed={seed}
      className={className}
      style={{ display: 'inline-block', fontSize: size, color, ...style }}
    >
      {children}
    </TegakiRenderer>
  );
}
