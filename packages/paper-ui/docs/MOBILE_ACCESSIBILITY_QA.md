# Mobile GPU and assistive-technology validation

**Current evidence:** Automated Chromium/SwiftShader tests for 390px viewport, focus, forced-colors, reduced motion and WebGL context-loss events. These tests do not emulate an iOS graphics driver or VoiceOver/TalkBack.

## Mobile GPU policy
- Only one decorative shader should occupy the primary preview. All controls remain semantic HTML.
- Max shader buffer pixels: **480,000** on a compact viewport (≤860px) or coarse-pointer device; **1,200,000** otherwise.
- A small CSS paper-fibre fallback remains readable without WebGL.
- The offscreen/hidden-tab lifecycle suspends the GPU material; shader buffers are recreated as required when visible again.
- On `webglcontextlost`, the library prevents default to allow browser restoration and hides the shader layer, retaining HTML and CSS. On `webglcontextrestored`, it remounts the shader with a new React key because previous GPU textures/buffers are invalid.
- `data-shader-status` may be `fallback`, `suspended`, `webgl`, or `context-lost`. It reflects eligibility/last observed events, not proof of rendered pixels.

## Required real-device checks (not yet completed)
- iOS Safari: recent and older iPhone devices; low-power mode, orientation, tab background/foreground, context loss, prolonged session, zoom to 200%, VoiceOver.
- Android Chrome: midrange and low-memory hardware; TalkBack, reduced motion, GPU memory/CPU profiling, battery.
- macOS Safari and Windows high-contrast mode using actual devices/screen readers, not just Chromium emulation.
- Measure FPS distribution and long-task time during animation and rapid material changes, raster width/height and GPU context recreation. Record model, OS version, browser, capture method, conditions and evidence.
- A visual review should compare physical material, lighting and handwritten-stroke quality independently from unit/browser test success.

References:
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextrestored_event

## Self-service device-lab protocol (public, manual)

Open [Studio Device Lab](https://paper-ui-react-lab.vercel.app/?device-lab=1) **on the actual phone**. No remote instrumentation credentials or uploads are required.

1. Choose one shader (Gentle blob / Amber wave / Cotton paper). On the same physical device, run one **10-second** sample and one **30-second** sample while keeping the page visible. Do not touch the screen during measurement.
2. Repeat with low-power mode enabled or after another app has run, noting conditions in the report. For animation and energy comparisons also capture Safari Web Inspector / Android Chrome DevTools traces; this page **does not** measure GPU FPS, temperature, energy or GPU allocation.
3. Run the five manual checks and record **Pass**, **Issue** or **Not tested**. In particular, turn on VoiceOver/TalkBack and actively navigate the material selector, sample button, results and export. The app cannot infer screen-reader status.
4. Use **Download JSON report**. This is intentionally client-only; check its user-agent and display fields before sharing, as these may reveal device information.
5. Compare samples only with matching shader, OS/browser, duration, device conditions and display refresh settings. A 120Hz screen can yield more RAF callbacks than a 60Hz screen without meaning the WebGL shader is faster.

**Data semantics:** The output reports `requestAnimationFrame` callback cadence and inter-callback interval percentiles, Chrome-compatible Long Tasks if available, the current shader eligibility status and the observed canvas backing-buffer sizes. These are clues for responsiveness, **not a GPU performance certification**. Backgrounded captures are invalidated rather than silently included.

Current iOS/Android data: **none collected yet**. CI mobile emulation still runs on desktop Chromium.
