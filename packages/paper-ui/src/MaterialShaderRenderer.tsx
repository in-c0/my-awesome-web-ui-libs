'use client';

import { Dithering, GrainGradient, HalftoneDots, PaperTexture } from '@paper-design/shaders-react';
import { clampTuning, MATERIAL_PRESETS, type MaterialKind, type MaterialTuning } from './material-presets.ts';
import { WHISPERS_PAPER_PRESET } from './tokens.ts';

export interface MaterialShaderRendererProps {
  kind: MaterialKind;
  tuning?: MaterialTuning;
  image?: string;
  paused?: boolean;
}

/** One replaceable integration with Paper Shaders.
 * The vendor's shader lighting is artistic rather than a physically accurate desk lamp.
 */
export function MaterialShaderRenderer({ kind, tuning = {}, image, paused = false }: MaterialShaderRendererProps) {
  const preset = MATERIAL_PRESETS[kind];
  const base = {
    width: '100%',
    height: '100%',
    maxPixelCount: 1_200_000,
    style: { width: '100%', height: '100%' },
  } as const;

  if (preset.family === 'paper') {
    return (
      <PaperTexture
        {...base}
        {...WHISPERS_PAPER_PRESET}
        angle={clampTuning(tuning.angle ?? WHISPERS_PAPER_PRESET.angle, 0, 360)}
        roughness={clampTuning(tuning.roughness ?? WHISPERS_PAPER_PRESET.roughness, 0, 1)}
        wrinkles={clampTuning(tuning.wrinkles ?? WHISPERS_PAPER_PRESET.wrinkles, 0, 1)}
        blending={clampTuning(tuning.blending ?? WHISPERS_PAPER_PRESET.blending, 0, 1)}
        distortion={clampTuning(tuning.distortion ?? WHISPERS_PAPER_PRESET.distortion, 0, 1)}
      />
    );
  }

  if (preset.family === 'gradient') {
    return (
      <GrainGradient
        {...base}
        colors={[...preset.colors]}
        colorBack={preset.colorBack}
        softness={preset.softness}
        intensity={clampTuning(tuning.intensity ?? preset.intensity, 0, 1)}
        noise={clampTuning(tuning.noise ?? preset.noise, 0, 1)}
        shape={preset.shape}
        speed={paused ? 0 : clampTuning(tuning.speed ?? preset.speed, 0, 2)}
        scale={clampTuning(tuning.scale ?? preset.scale, 0.2, 3)}
        rotation={preset.rotation}
        offsetX={preset.offsetX}
        offsetY={preset.offsetY}
      />
    );
  }

  if (preset.family === 'dithering') {
    return (
      <Dithering
        {...base}
        colorBack={preset.colorBack}
        colorFront={preset.colorFront}
        shape={preset.shape}
        type={preset.type}
        size={clampTuning(tuning.size ?? preset.size, 1, 20)}
        speed={paused ? 0 : clampTuning(tuning.speed ?? preset.speed, 0, 2)}
        scale={clampTuning(tuning.scale ?? preset.scale, 0.2, 3)}
        rotation={preset.rotation}
        offsetX={preset.offsetX}
        offsetY={preset.offsetY}
      />
    );
  }

  if (!image) {
    return null; // A halftone image is a caller-owned asset, never a demo-specific hardcoded URL.
  }

  return (
    <HalftoneDots
      {...base}
      image={image}
      colorBack={preset.colorBack}
      colorFront={preset.colorFront}
      originalColors={preset.originalColors}
      type={preset.type}
      grid={preset.grid}
      inverted={preset.inverted}
      size={clampTuning(tuning.size ?? preset.size, 0, 1)}
      radius={preset.radius}
      contrast={clampTuning(tuning.contrast ?? preset.contrast, 0, 1)}
      grainMixer={preset.grainMixer}
      grainOverlay={preset.grainOverlay}
      grainSize={preset.grainSize}
      scale={clampTuning(tuning.scale ?? preset.scale, 0.2, 3)}
      fit={preset.fit}
    />
  );
}
