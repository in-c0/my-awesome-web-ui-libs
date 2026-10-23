# Public release process

Paper UI is developed in its own original GitHub repository: https://github.com/in-c0/paper-ui.

## Ownership and scope
- Project code: in-c0 (MIT).
- Handwriting engine: [Gokhan Kurt's Tegaki](https://github.com/gkurt/tegaki), installed as an MIT-licensed external package.
- Shader engine: [Paper Shaders](https://github.com/paper-design/shaders), installed as an Apache-2.0 dependency.
- Nothing should be sent upstream to Tegaki unless the change benefits Tegaki itself, independently of Paper UI.

## Alpha publishing gates
1. Pass CI build, unit tests, Chromium, and **packed tarball installed into a clean React project**.
2. Manually inspect desktop/mobile shaders, no-GPU fallbacks, Korean handwriting, focus rings, motion preferences, and long-running GPU behavior.
3. Confirm npm scope ownership (`@in-c0`), add Trusted Publishing if desired, and create a prerelease tag `v0.1.0-alpha.1`.
4. Publish with prerelease dist-tag `alpha`, not `latest`; verify installed package from the real registry in a new React app.
5. Enable `latest` only when the separate production readiness checklist passes.

There is no automatic publishing workflow or credential in this repository.
