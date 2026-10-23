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
3. Confirm npm scope ownership (`@in-c0`), npm 2FA, and a stage-only token in GitHub Secrets (never commit credentials).
4. Follow the [first alpha staged-release procedure](NPM_ALPHA_STAGING.md). It is a manually dispatched GitHub Actions workflow, **not** an automatic public publish. Approve with npm 2FA only after inspecting the staged artifact.
5. Confirm the public `alpha` dist-tag and installability, then create the git prerelease tag. Configure GitHub OIDC Trusted Publishing for later releases.
6. Enable `latest` only when the separate production readiness checklist passes.

There is no automatic publishing workflow or embedded credential. A gated manual **staging-only** workflow is available; publication still requires the npm scope owner to authenticate and approve.

## Stylesheet distribution

Consumer applications must import `@in-c0/paper-ui/styles.css` explicitly once. The clean consumer test checks that compiled CSS contains actual `.pui-button` rules. A successful JavaScript build without CSS is **not** a successful UI release.
