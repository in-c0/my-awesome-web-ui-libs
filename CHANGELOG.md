# Changelog

## Unreleased — physical-device field testing readiness

- Added opt-in, no-backend Device Lab with live WebGL material, RAF cadence/interval diagnostics, optional Long Task observation and JSON export.
- Added clearly separate *human-only* VoiceOver/TalkBack, rotation, zoom and tab-resumption check outcomes, defaulting to Not tested.
- Added narrow/touch Chromium browser checks for 320/390px layout and local JSON export; does not claim actual iOS/Android measurements.


## Unreleased — responsive GPU and accessibility hardening

- Cap compact/touch-device shader buffers at 480,000 pixels (desktop budget 1,200,000); avoid unbounded retina DPR overhead.
- Detect WebGL context loss without unmounting semantic content, expose a CSS fallback and remount the renderer after restoration.
- Add a keyboard-first skip link and stronger native Windows forced-colors focus styling.
- Give the no-WebGL paper mode an inexpensive layered matte-fibre fallback.
- Add Chromium regressions for narrow/touch pixel budget, keyboard skip link, forced colors and simulated WebGL loss/restoration.
- **Not verified on physical iOS/Android hardware**; GPU budgets are conservative design limits, not performance measurements.


## Unreleased — material comparison and legibility

- Studio can switch between live WebGL and CSS/original-artwork fallback without losing content.
- Corrected copied Korean lettering JSX to use actual line breaks.
- Refined matte paper and card shading; strengthened button and focus treatments.
- Raised text contrast for explanatory content with a contrast regression test.
- Replaced the visible native file-picker control with an accessible, keyboard-focusable paper-style upload surface and local filename feedback.
- Added comparison, clipboard, picker, and fallback browser coverage.


## Unreleased — quality hardening for the next alpha

- Suspend decorative WebGL effects in background tabs and outside the viewport while preserving DOM content.
- Keep source artwork and CSS visible when Halftone shader rendering is unavailable.
- Isolate React render errors from external shaders, and expose `data-shader-status` for diagnostics.
- Generate usable Studio snippets with required stylesheet and font imports.
- Add browser coverage for no-WebGL devices, offscreen behavior, keyboard selection and published CSS.
- No change to the already-published `0.1.0-alpha.1` tarball.

## [0.1.0-alpha.1](https://github.com/in-c0/paper-ui/releases/tag/v0.1.0-alpha.1) — 2026-10-24 (public npm alpha)

- Initial extraction of Paper UI into a standalone React-first workspace.
- Six Paper Shaders presets; preserving source parameters and exact color alpha.
- Tegaki-based Korean and Latin handwriting components.
- Responsive material studio; reduced-motion-aware shader adapter.
- Native DOM controls and CSS fallback.
- Published as `@in-c0/paper-ui@alpha`; confirmed installable from the public npm registry with ESM, declarations, and styles.
