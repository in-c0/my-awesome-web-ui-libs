# Changelog

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
