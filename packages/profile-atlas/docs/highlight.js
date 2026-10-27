// A small, dependency-free highlighter for the snippets on this site: JS, HTML (with inline
// scripts), CSS, JSON and shell. Adapted from Knurl's site/src/highlight.ts (same author, MIT).

const KW = new Set('import export from const let var function return if else for while of in new typeof void await async true false null undefined this class switch case break continue try catch throw default extends'.split(' '));
const JS = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(`(?:\\.|\$\{[^}]*\}|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*:(?!:))|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/g;

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const span = (cls, text) => `<span class="t-${cls}">${esc(text)}</span>`;

function js(code) {
  let out = '', last = 0;
  for (const m of code.matchAll(JS)) {
    out += esc(code.slice(last, m.index)); last = m.index + m[0].length;
    if (m[1]) out += span('c', m[1]);
    else if (m[2]) out += span('s', m[2]);
    else if (m[3]) out += span('n', m[3]);
    else if (m[4]) out += KW.has(m[4]) ? span('k', m[4]) : span('a', m[4]);
    else if (m[5]) out += KW.has(m[5]) ? span('k', m[5]) : span('f', m[5]);
    else if (m[6]) out += KW.has(m[6]) ? span('k', m[6]) : /^[A-Z]/.test(m[6]) ? span('t', m[6]) : esc(m[6]);
  }
  return out + esc(code.slice(last));
}

function css(code) {
  return code.split('\n').map(line => {
    if (/^\s*\/\*/.test(line)) return span('c', line);
    const decl = line.match(/^(\s*)(--?[\w-]+)(\s*:\s*)([^;]*)(;?.*)$/);
    if (decl) return esc(decl[1]) + span('a', decl[2]) + esc(decl[3]) + span('s', decl[4]) + esc(decl[5]);
    const sel = line.match(/^(\s*)([^{]+)(\{.*)$/);
    if (sel) return esc(sel[1]) + span('t', sel[2]) + esc(sel[3]);
    return esc(line);
  }).join('\n');
}

function tag(src) {
  // src is one tag, from "<" to ">"
  const m = src.match(/^(<\/?)([\w-]+)([\s\S]*?)(\/?>)$/);
  if (!m) return esc(src);
  const attrs = m[3].replace(/([\w:-]+)(?:(=)("[^"]*"|'[^']*'|[^\s>]+))?|([^\w]+)/g, (all, name, eq, value, other) =>
    other !== undefined ? esc(other) : `<span class="t-a">${esc(name)}</span>${eq ? '=' + span('s', value) : ''}`);
  return esc(m[1]) + span('k', m[2]) + attrs + esc(m[4]);
}

function html(code) {
  let out = '', i = 0;
  const RE = /<!--[\s\S]*?-->|<script\b[^>]*>([\s\S]*?)<\/script>|<style\b[^>]*>([\s\S]*?)<\/style>|<\/?[\w-]+(?:"[^"]*"|'[^']*'|[^'">])*>/g;
  for (const m of code.matchAll(RE)) {
    out += esc(code.slice(i, m.index)); i = m.index + m[0].length;
    if (m[0].startsWith('<!--')) { out += span('c', m[0]); continue; }
    if (m[1] !== undefined || m[2] !== undefined) {
      const open = m[0].match(/^<[^>]*>/)[0], body = m[1] ?? m[2];
      out += tag(open) + (m[1] !== undefined ? js(body) : css(body)) + tag(m[1] !== undefined ? '</script>' : '</style>');
      continue;
    }
    out += tag(m[0]);
  }
  return out + esc(code.slice(i));
}

function sh(code) {
  return code.split('\n').map(line => {
    if (/^\s*#/.test(line)) return span('c', line);
    const m = line.match(/^(\s*)(\S+)(.*)$/);
    return m ? esc(m[1]) + span('f', m[2]) + esc(m[3]).replace(/(https?:\/\/\S+)/g, '<span class="t-s">$1</span>') : esc(line);
  }).join('\n');
}

function json(code) {
  return esc(code)
    .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)/g, '<span class="t-a">$1</span>$2')
    .replace(/:\s*(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, (all, v) => all.replace(v, `<span class="t-s">${v}</span>`))
    .replace(/\b(true|false|null)\b/g, '<span class="t-k">$1</span>')
    .replace(/([\[,:]\s*)(-?\d+(?:\.\d+)?)/g, '$1<span class="t-n">$2</span>');
}

export function highlight(code, lang = 'js') {
  if (lang === 'html') return html(code);
  if (lang === 'css') return css(code);
  if (lang === 'sh') return sh(code);
  if (lang === 'json') return json(code);
  if (lang === 'text') return esc(code);
  return js(code);
}
