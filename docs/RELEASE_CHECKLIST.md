# Release gates

**Current status:** independent candidate / not on npm.

- [x] Separate source tree with first-party Paper UI components, no Tegaki repo files
- [x] Runtime imports from external Tegaki and Paper Shaders npm packages
- [x] Compile JS, type declarations and CSS in a publishable ESM package
- [x] Package dry-run on CI without publishing
- [x] Chromium interaction/mobile checks
- [x] Original MIT license and third-party notices provided
- [ ] Migrate into a NEW, non-fork GitHub repository with fresh history
- [ ] Verify actual npm scope ownership; configure trusted publishing (OIDC)
- [ ] Test installation from `npm pack` tarball in a clean consumer project
- [ ] Visual review at 390, 768, 1280 and 1920px against reference storyboard
- [ ] Keyboard/screen-reader audit, color-contrast audit, canvas context-loss behavior
- [ ] GPU performance and fallback test on real low-end Android and iOS Safari
- [ ] Decide versioning / changelog / support policy / issue templates
- [ ] Release alpha and verify import from public npm registry

No npm, original Tegaki upstream, or canonical domain publication is automatic.
