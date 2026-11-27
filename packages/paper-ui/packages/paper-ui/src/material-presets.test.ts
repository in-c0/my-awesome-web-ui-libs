import { expect, test } from 'bun:test';
import { clampTuning, MATERIAL_KINDS, MATERIAL_PRESETS } from './material-presets.ts';

test('all six material presets are available', () => {
  expect(MATERIAL_KINDS).toHaveLength(6);
  expect(Object.keys(MATERIAL_PRESETS)).toEqual([...MATERIAL_KINDS]);
});

test('alpha channels and precise source settings are preserved', () => {
  expect(MATERIAL_PRESETS['paper-texture'].family).toBe('paper');
  expect(MATERIAL_PRESETS['grain-blob'].colors[0]).toBe('#ffb65c47');
  expect(MATERIAL_PRESETS['grain-wave'].colors[1]).toBe('#cec4b1eb');
  expect(MATERIAL_PRESETS.dithering.type).toBe('4x4');
  expect(MATERIAL_PRESETS.halftone.radius).toBe(1.25);
  expect(MATERIAL_PRESETS.halftone.originalColors).toBe(false);
});

test('tuning values are bounded and non-finite numbers are rejected', () => {
  expect(clampTuning(4, 0, 1)).toBe(1);
  expect(clampTuning(-1, 0, 1)).toBe(0);
  expect(clampTuning(Number.NaN, 0.2, 1)).toBe(0.2);
});
