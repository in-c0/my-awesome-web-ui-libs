# Architecture

Paper UI uses progressive enhancement rather than making the application a giant Canvas.

- **DOM:** semantic controls, content, typography, focus management, screen-reader support and keyboard navigation.
- **CSS:** gentle elevation and interaction, theme tokens, no-GPU fallback.
- **Paper Shaders:** one optional WebGL material for a visually important surface; no per-gallery-item canvas.
- **Tegaki:** one script-aware stroke animation engine for text, with font bundle imports left to the application.

Each component is independently importable; `MaterialEffect` lazy-loads its renderer and honours `prefers-reduced-motion`. Its runtime dependencies are installed from upstream npm packages; it does not contain copies of their engines.

This is not a FEM paper-simulation engine, a physically accurate dynamic PBR light implementation, or a graphite deposition model. Those should not be claimed.

Use the studio to tune presets, but verify the bundled library independently through real installs before release.

## GPU lifecycle and fallbacks

The library uses `IntersectionObserver` (with a small prewarm margin) and `document.visibilityState` to suspend GPU shaders when surfaces are offscreen or browser tabs are hidden. DOM children and CSS paper layers remain mounted. Native buttons, links and text are still usable without WebGL. `prefers-reduced-motion` forces animated shader speed to zero.

`MaterialEffect` and `PaperSurface` expose a **diagnostic-only** `data-shader-status` attribute: `fallback`, `webgl`, or `suspended`. This reports whether a shader was eligible to mount, not a performance or full-frame correctness guarantee; browser-level GPU context loss can still occur after detection. Vendor render exceptions are contained so the semantic application can survive.

Avoid setting `PaperSurface texture` to true for every list item. Prefer a single hero material and ordinary CSS for cards. Browser tests cover the no-WebGL fallback and offscreen DOM persistence; real GPU context-loss recovery and long-lived memory/performance tests remain outstanding.
