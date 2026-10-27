/**
 * A small TS/TSX/shell highlighter for the docs code blocks, with no runtime dependency.
 * Adapted from the same author's MIT highlighter in packages/knurl/site/src/highlight.ts.
 */

const KW = new Set(
  'import export from const let var function return if else for while of in new type interface as default extends typeof void await async true false null undefined this class switch case break continue try catch throw readonly keyof'.split(
    ' ',
  ),
);

const RE =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(`(?:\\.|\$\{[^}]*\}|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(<\/?)([A-Za-z][\w.]*)|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*=(?!=|>))|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/g;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type Lang = 'tsx' | 'sh' | 'css';

export function highlight(code: string, lang: Lang = 'tsx'): string {
  if (lang === 'sh') {
    return code
      .split('\n')
      .map((line) => {
        if (/^\s*#/.test(line)) return `<span class="t-c">${esc(line)}</span>`;
        const m = line.match(/^(\s*)(\S+)(.*)$/);
        return m ? `${m[1]}<span class="t-f">${esc(m[2])}</span>${esc(m[3])}` : esc(line);
      })
      .join('\n');
  }
  let out = '';
  let last = 0;
  let inTag = false;
  for (const m of code.matchAll(RE)) {
    const i = m.index ?? 0;
    const between = code.slice(last, i);
    out += esc(between);
    if (between.includes('>')) inTag = false;
    last = i + m[0].length;
    if (m[1]) out += `<span class="t-c">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="t-s">${esc(m[2])}</span>`;
    else if (m[3]) {
      out += esc(m[3]) + `<span class="${/^[A-Z]/.test(m[4]) ? 't-t' : 't-k'}">${esc(m[4])}</span>`;
      inTag = true;
    } else if (m[5]) out += `<span class="t-n">${m[5]}</span>`;
    else if (m[6]) out += inTag ? `<span class="t-a">${esc(m[6])}</span>` : KW.has(m[6]) ? `<span class="t-k">${m[6]}</span>` : esc(m[6]);
    else if (m[7]) out += KW.has(m[7]) ? `<span class="t-k">${m[7]}</span>` : `<span class="t-f">${esc(m[7])}</span>`;
    else if (m[8])
      out += KW.has(m[8])
        ? `<span class="t-k">${m[8]}</span>`
        : /^[A-Z]/.test(m[8])
          ? `<span class="t-t">${m[8]}</span>`
          : inTag
            ? `<span class="t-a">${m[8]}</span>`
            : esc(m[8]);
  }
  out += esc(code.slice(last));
  return out;
}
