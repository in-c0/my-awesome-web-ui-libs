# What the fastest-growing component sites do (Oct 2026)

The research behind Knurl's site. Five copy-paste/registry libraries were picked by growth, their **site source code** was read (not screenshots), and the patterns at least three of five share were turned into the site's spec. Values are copied from each repo.

## The five

| # | Library | Stars | Growth evidence | Site stack |
|---|---|---|---|---|
| 1 | **React Bits** — reactbits.dev | 49.7k | +32.8k in 2025, #1 React project in JS Rising Stars 2025; +17k since Jan 2026 | Vite + React, plain CSS |
| 2 | **shadcn/ui** — ui.shadcn.com | 126.3k | +26.3k in 2025; the `shadcn` CLI went 0.95M → 40.4M npm downloads/month (Jun 2025 → Sep 2026) | Next.js + Fumadocs + Tailwind v4 |
| 3 | **Magic UI** — magicui.design | 22.1k | +13.2k in 2024, +6.6k in 2025 | Next.js, fork of the shadcn v4 docs |
| 4 | **coss ui / Origin UI** — coss.com/ui | 10.8k | from zero since late 2024; Cal.com's design system | Next.js + Base UI |
| 5 | **Animate UI** — animate-ui.com | 4.7k | from zero in 2025; trending 103 days since Apr 2026 | Next.js + Fumadocs |

Excluded: Aceternity (closed site source), 21st.dev (a marketplace), HeroUI (npm-only), tweakcn (theme editor), motion-primitives / Cult UI / Kibo (smaller).

## Patterns shared by ≥ 3 of 5 — and what Knurl's site does with each

| Pattern | Spec seen | Knurl |
|---|---|---|
| One deliberate sans + its mono, ligatures off in code | Geist + Geist Mono (3/5), Cal Sans, Outfit | Geist + Geist Mono, `liga 0` in code |
| Achromatic tokens, chroma 0 | shadcn neutral oklch: bg 1 / .145, border .922 / white 10% | Same scale; the only colour is the controls' own accent |
| Hairlines, not shadows | alpha borders, `shadow-none` chrome; shadow only on ⌘K | 1px tokens everywhere; one shadow, on the palette |
| One radius variable | `--radius: .625rem`, frames a step larger | `--radius: 10px`, frames 14px |
| Sticky header 56 / 64px as a CSS var | logo · nav · search · separator · GitHub · theme · CTA | Same order |
| Search trigger → ⌘K and `/` | 32px muted button, cmdk dialog | Same; palette lists every control |
| Three columns | sidebar 220–288, content 640–768, right TOC (xl+) | 240 / 760 / 200 |
| Component page order | title + actions → description → preview → install → usage → examples → API → prev/next | Same |
| Preview frame | 1px border, rounded-xl, `p-10`, 288–450px, plain background | Plain background, 360px, replay at top right |
| Replay control | 32px icon, remounts via `key++` | Same |
| Preview / Code switch in the same box | tabs or a sliding pill | Sliding pill, code overlays the frame |
| Code collapsed with a fade | 160–288px, gradient, "Expand" | 280px, "Expand" |
| Install = CLI \| Manual, pm tabs remembered | pnpm / npm / yarn / bun | Same, plus an `npm i` tab — Knurl is also a package |
| Copy button | 28–32px ghost icon, Copy → Check for 2s, no toast | Same |
| Code theme | github-light-default / github-dark, surface one step off the page | Same palette, hand-rolled highlighter |
| Props table | Prop · Type · Default · Description, mono chips | Same |
| AI affordances | Copy page as Markdown, `/llms.txt`, Open in ChatGPT / Claude | Copy as Markdown, `llms.txt`, Open in Claude / ChatGPT |
| Theme | class `.dark`, pre-paint script, `D` toggles | Same; `D` toggles |
| Hero | 5–9 words, tight tracking, one factual sub with a count, two buttons, then real components | "Controls you can feel turning." + eight live controls |
| Gallery | live components in hairline cells, 2/3/4 columns, actions on hover, code in a drawer | Collapsed-border grid, hover actions |
| Chrome motion is small | `cubic-bezier(.23,1,.32,1)`, 120–280ms, reduced motion honoured | Same tokens |
| Footer | one line, underlined links | One line |

## What they avoid (the "AI slop" tells)

1. Decorative colour in the chrome — no purple→pink gradients, no gradient-text headings.
2. Shadowed card stacks (`rounded-2xl shadow-lg`).
3. Glassmorphism beyond, at most, the header.
4. Patterned preview backgrounds (patterns live in the hero only).
5. Emoji, ✨, "stunning", "blazing-fast". Copy is factual and uses counts.
6. Default Inter at generic weights.
7. Marketing filler: three-column icon feature grids, "Why choose us".
8. A toast for every copy.
9. Mixed radii and borders.
10. Placeholder demos instead of real, interactive components.

## shadcn registry format used

`public/r/<name>.json` items with `$schema`, `name`, `type`, `title`, `description`, `dependencies`, `registryDependencies` (bare names, `@ns/item` or full URLs) and `files[{ path, type, target, content }]`; a flat `registry.json` index without `content`. `npx shadcn@latest add <url>` fetches the item, resolves `registryDependencies` recursively, installs npm deps, and writes each file to its `target` or the alias implied by its type.

## Sources

- risingstars.js.org/2025/en and github.com/bestofjs/javascript-risingstars (`data/2025.json`, `data/2024.json`)
- github.com/DavidHDev/react-bits · github.com/shadcn-ui/ui · github.com/magicuidesign/magicui · github.com/cosscom/ui · github.com/imskyleen/animate-ui
- gittrend.io/repo/imskyleen/animate-ui · api.npmjs.org/downloads/range/2024-10-01:2026-10-26/shadcn
- ui.shadcn.com/docs/registry (registry-json, registry-item-json, namespace, registry-index)
