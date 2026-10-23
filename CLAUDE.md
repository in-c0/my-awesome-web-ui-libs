# Paper UI contributor and coding-agent contract

- This is an independent React component library, not a Tegaki fork. Do not rename or claim ownership of Tegaki or Paper Shaders.
- Keep material rendering and controls separate: semantic DOM + one optional shader layer, with CSS fallback.
- Never render one WebGL canvas per list item.
- A gradient is not a physically accurate 3D lamp; handwriting stroke animation is not graphite physics.
- Preserve all six owner-approved shader presets, including alpha-bearing hex values, numeric zeros, and seed 893.
- Use original source files under packages/paper-ui; do not vendor or copy Tegaki or Paper Shaders code.
- Keep any UI component accessible, keyboard usable, and reduced-motion aware.
- Do not claim "production-ready" until tests cover mobile layout, WebGL compatibility, keyboard, screen readers, visual regressions, and low-powered devices.
- New dependencies need explicit maintenance/license audits.
- No registry, npm publishing, source release, or domain change without documented ownership and QA.
- Keep public README succinct, honest, and specific to Paper UI, not the original Tegaki repository.
