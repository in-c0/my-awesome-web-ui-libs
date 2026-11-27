import { expect, test } from 'bun:test';
import { QUIET_TOKENS, WHISPERS_PAPER_PRESET } from './tokens.ts';

test('preserves owner-supplied shader settings, including zeros', () => {
  expect(WHISPERS_PAPER_PRESET.seed).toBe(893);
  expect(WHISPERS_PAPER_PRESET.angle).toBe(80);
  expect(WHISPERS_PAPER_PRESET.roughness).toBe(0.66);
  expect(WHISPERS_PAPER_PRESET.wrinkles).toBe(0.87);
  expect(WHISPERS_PAPER_PRESET.folds).toBe(0);
  expect(WHISPERS_PAPER_PRESET.fiber).toBe(0);
  expect(WHISPERS_PAPER_PRESET.crumples).toBe(0);
  expect(WHISPERS_PAPER_PRESET.fit).toBe('contain');
});

test('palette uses quiet high-contrast ink and paper', () => {
  expect(QUIET_TOKENS.ink).toBe('#252525');
  expect(QUIET_TOKENS.paper).toBe('#f6f4ef');
});
