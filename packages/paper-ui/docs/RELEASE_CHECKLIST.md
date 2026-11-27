# Release gates

**Current status:** public npm alpha `0.1.0-alpha.1`, tagged `v0.1.0-alpha.1` with GitHub prerelease. Experimental and not production-certified.

- [x] Separate source tree with first-party Paper UI components, no Tegaki repo files
- [x] Runtime imports from external Tegaki and Paper Shaders npm packages
- [x] Compile JS, type declarations and CSS in a publishable ESM package
- [x] Package dry-run in standalone source without publishing
- [x] Clean packed-package consumer smoke test: npm tarball installed in a fresh React project; TypeScript, Vite build and emitted CSS checked
- [x] Chromium interaction/mobile checks in independent repository CI
- [x] Original MIT license and third-party notices provided
- [x] Migrate into a NEW, non-fork GitHub repository with fresh history
- [x] Manual npm alpha staging workflow and owner setup guide prepared (inactive without npm secret)
- [x] Verify npm `@in-c0` scope ownership and owner 2FA; stage token configured in GitHub Secrets
- [x] Stage alpha and approve with npm 2FA; verified `alpha` dist-tag, registry integrity, clean React install, TypeScript, Vite and CSS
- [ ] Configure OIDC Trusted Publishing for subsequent releases
- [x] Test installation from `npm pack` tarball in a clean consumer project
- [ ] Visual review at 390, 768, 1280 and 1920px against reference storyboard
- [ ] Keyboard/screen-reader audit, color-contrast audit, canvas context-loss behavior
- [ ] GPU performance and fallback test on real low-end Android and iOS Safari
- [ ] Decide versioning / changelog / support policy / issue templates
- [x] Release alpha, create GitHub prerelease matching staged source SHA, and verify import from public npm registry

Future npm publication is still manual and gated. The original Tegaki upstream remains independent.
