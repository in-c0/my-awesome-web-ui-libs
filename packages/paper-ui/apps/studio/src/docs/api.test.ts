import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { API, TUNING } from './api.ts';

const SRC = join(import.meta.dir, '../../../../packages/paper-ui/src');

/** Prop names declared directly in `export interface <Name> ... { ... }`. */
function declaredProps(file: string, name: string): string[] {
  const source = readFileSync(join(SRC, file), 'utf8');
  const start = source.indexOf(`export interface ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const body = source.slice(source.indexOf('{', start) + 1, source.indexOf('\n}', start));
  return [...body.matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
}

test('every documented component documents every prop its interface declares', () => {
  for (const entry of API) {
    const documented = entry.props.map((p) => p.name);
    for (const prop of declaredProps(entry.file, entry.interface)) {
      expect(documented).toContain(prop);
    }
  }
});

test('documented defaults match the destructuring defaults in source', () => {
  for (const entry of API) {
    const source = readFileSync(join(SRC, entry.file), 'utf8');
    for (const prop of entry.props) {
      if (!prop.def || !/^['\d(tf]/.test(prop.def)) continue; // skip prose defaults such as "Caveat bundle"
      const match = source.match(new RegExp(`\\b${prop.name} = ([^,\\n}]+)`));
      if (match) expect(match[1].trim()).toBe(prop.def);
    }
  }
});

test('tuning ranges match the clamps in MaterialShaderRenderer', () => {
  const source = readFileSync(join(SRC, 'MaterialShaderRenderer.tsx'), 'utf8');
  for (const family of TUNING) {
    for (const { key, range } of family.keys) {
      const [min, max] = range.split(' – ');
      expect(source).toContain(`clampTuning(tuning.${key} ?? `);
      expect(source).toMatch(new RegExp(`tuning\\.${key} \\?\\? [^,]+, ${min.replace('.', '\\.')}, ${max.replace('.', '\\.')}\\)`));
    }
  }
});
