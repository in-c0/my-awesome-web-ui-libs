# Browser regression design

- **Functional tests** (material selection, URL hydration, buttons, keyboard): use an explicit no-WebGL environment where shader operation is irrelevant. This avoids false timeouts when SwiftShader software GPU buffers are repeatedly created/destroyed.
- **GPU smoke test**: mounts a single actual Paper Shaders canvas in Chromium when supported; validates that a visible canvas exists.
- **Fallback test**: disables WebGL *before* navigation to verify image and semantic DOM stay usable.
- **Offscreen lifecycle**: checks shader suspension and restoration without hiding controls.
- Browser screenshots remain available as GitHub Actions artifacts. Chromium software rasterization is **not** evidence of real Android GPU or iOS Safari performance.

A prior run timed out after 30 seconds because a test switched through six shader modes and reloaded the page in the same scenario. A Playwright trace showed functional clicks working; repeated GPU setup and the final navigation dominated runtime. This suite deliberately separates app behavior from GPU performance testing rather than inflating the timeout. Real hardware stress measurements remain an open QA gate.
