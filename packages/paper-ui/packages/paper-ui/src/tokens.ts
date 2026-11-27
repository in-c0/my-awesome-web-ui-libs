/** Exact values copied from the owner's Paper Shaders paper-texture URL (2026-10-23).
 * Keep this immutable source preset; tune derived themes rather than silently changing it.
 * PaperTexture's blending and distortion affect a supplied image; without an image,
 * they do not create a physical surface deformation.
 */
export const WHISPERS_PAPER_PRESET = {
  colorBack: '#d3d2ab',
  colorPaper: '#ffffff',
  colorShadow: '#cccccc',
  blending: 0.53,
  distortion: 0.35,
  clip: false,
  angle: 80,
  seed: 893,
  roughness: 0.66,
  roughnessSize: 0.3,
  roughnessRows: 0,
  fiber: 0,
  fiberSize: 0,
  folds: 0,
  foldSizeX: 0,
  foldSizeY: 0,
  foldOffsetX: 0,
  foldOffsetY: 0.39,
  wrinkles: 0.87,
  wrinkleSize: 0.65,
  crumples: 0,
  crumpleCount: 8,
  drops: 0,
  scale: 0.9,
  fit: 'contain' as const,
};

export type PaperTextureSettings = typeof WHISPERS_PAPER_PRESET;

export const QUIET_TOKENS = {
  paper: '#f6f4ef',
  mist: '#e3dfd6',
  stone: '#a8a49c',
  graphite: '#5f5d59',
  ink: '#252525',
  focus: '#68645d',
} as const;

/** Stable CSS custom-property names for consumers and agent-generated UI. */
export const PAPER_CSS_VARS = {
  paper: '--paper-ui-paper',
  ink: '--paper-ui-ink',
  stone: '--paper-ui-stone',
  accent: '--paper-ui-accent',
} as const;
