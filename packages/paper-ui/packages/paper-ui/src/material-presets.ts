/** Owner-selected Paper Shaders URLs, recorded 2026-10-23.
 * Hex alpha channels are retained exactly, rather than converted to opaque colours.
 */
export const MATERIAL_KINDS = ['paper-texture', 'grain-sphere', 'grain-blob', 'grain-wave', 'dithering', 'halftone'] as const;

export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const MATERIAL_PRESETS = {
  'paper-texture': {
    label: 'Cotton paper',
    description: 'A tactile paper surface with fine wrinkles and directional shading.',
    family: 'paper',
  },
  'grain-sphere': {
    label: 'Warm sphere',
    description: 'A small pool of soft desk light.',
    family: 'gradient',
    colors: ['#ffb65c47', '#a6a6a6eb', '#fffef5fa'],
    colorBack: '#fffef5fa',
    softness: 0.42,
    intensity: 0.87,
    noise: 0.13,
    shape: 'sphere',
    speed: 0.64,
    scale: 1.08,
    rotation: 84,
    offsetX: 0.02,
    offsetY: 0.04,
  },
  'grain-blob': {
    label: 'Gentle blob',
    description: 'An ambient gradient that slowly changes shape.',
    family: 'gradient',
    colors: ['#ffb65c47', '#a6a6a6eb', '#fffef5fa'],
    colorBack: '#fffef5fa',
    softness: 0.42,
    intensity: 0.87,
    noise: 0.13,
    shape: 'blob',
    speed: 0.64,
    scale: 1.08,
    rotation: 84,
    offsetX: 0.02,
    offsetY: 0.04,
  },
  'grain-wave': {
    label: 'Amber wave',
    description: 'A warm trace of movement along the paper.',
    family: 'gradient',
    colors: ['#ff8c002b', '#cec4b1eb', '#fffffffa'],
    colorBack: '#fffffffa',
    softness: 0.55,
    intensity: 1,
    noise: 0.25,
    shape: 'wave',
    speed: 0.94,
    scale: 1.2,
    rotation: 172,
    offsetX: -0.06,
    offsetY: 0.04,
  },
  dithering: {
    label: 'Dithered light',
    description: 'Dots and ink, between analogue print and pixels.',
    family: 'dithering',
    colorBack: '#ffdcbd42',
    colorFront: '#ffffff',
    shape: 'sphere',
    type: '4x4',
    size: 2,
    speed: 1,
    scale: 0.6,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
  },
  halftone: {
    label: 'Printed study',
    description: 'A sketch transformed into quiet printed halftone.',
    family: 'halftone',
    colorBack: '#f2f1e8',
    colorFront: '#2b2b2b',
    originalColors: false,
    type: 'gooey',
    grid: 'hex',
    inverted: false,
    size: 0.5,
    radius: 1.25,
    contrast: 0.4,
    grainMixer: 0.2,
    grainOverlay: 0.2,
    grainSize: 0.5,
    scale: 1,
    fit: 'cover',
  },
} as const;

export type MaterialTuning = Partial<{
  speed: number;
  scale: number;
  intensity: number;
  noise: number;
  size: number;
  contrast: number;
  angle: number;
  roughness: number;
  wrinkles: number;
  blending: number;
  distortion: number;
}>;

export function clampTuning(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}
