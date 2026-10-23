# Architecture

Paper UI uses progressive enhancement rather than making the application a giant Canvas.

- **DOM:** semantic controls, content, typography, focus management, screen-reader support and keyboard navigation.
- **CSS:** gentle elevation and interaction, theme tokens, no-GPU fallback.
- **Paper Shaders:** one optional WebGL material for a visually important surface; no per-gallery-item canvas.
- **Tegaki:** one script-aware stroke animation engine for text, with font bundle imports left to the application.

Each component is independently importable; `MaterialEffect` lazy-loads its renderer and honours `prefers-reduced-motion`. Its runtime dependencies are installed from upstream npm packages; it does not contain copies of their engines.

This is not a FEM paper-simulation engine, a physically accurate dynamic PBR light implementation, or a graphite deposition model. Those should not be claimed.

Use the studio to tune presets, but verify the bundled library independently through real installs before release.
