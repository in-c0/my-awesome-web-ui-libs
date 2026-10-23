# npm alpha staging — owner procedure

**Package:** `@in-c0/paper-ui@0.1.0-alpha.1`  
**Tag:** `alpha` (never `latest`)  
**Source:** [in-c0/paper-ui](https://github.com/in-c0/paper-ui)  
**Workflow:** [Stage npm alpha](../.github/workflows/npm-alpha-stage.yml)

This workflow does NOT run on ordinary pushes or tags. It performs a fresh build, tests the packed artifact in an external React consumer, validates npm packaging, and **stages** the version on npm only when explicitly triggered.

## One-time npm account setup (must be done by the owner)

1. On [npmjs.com](https://www.npmjs.com/), sign in or create an account. Confirm you administer the **npm** user or organization named `in-c0`. Your GitHub username does **not** grant npm scope ownership.
2. Enable two-factor authentication (2FA) on the npm account. Ensure `@in-c0/paper-ui` is within the scope you administer. If that namespace is owned by someone else, **stop** — select a scope you genuinely own and update the package and pipeline first.
3. Generate a **granular stage-only access token**, limited to the package/scope and the minimum necessary publish permission. The staging token still grants registry-changing capabilities: protect it.
4. In GitHub repository **Settings → Secrets and variables → Actions**, create the repository secret `NPM_STAGE_TOKEN`. Never paste it into a chat, issue, README, workflow file, commit, or log.
5. Optional: create a GitHub Actions environment named `npm-alpha-staging` with required reviewers to add a separate explicit approval gate; otherwise the workflow's manual typed confirmation is the gate. The workflow references this environment.
6. Go to **Actions → Stage npm alpha (manual approval required) → Run workflow**, choose `main`, and type **`STAGE-0.1.0-alpha.1`**.
7. After checks and staging succeed, sign into npmjs.com and open **Staged Packages**. Inspect the staged tarball, verify its tag `alpha`, and **approve with 2FA**. Until approved, the real package version is not live. First-time staging may create a publicly visible placeholder `0.0.0-stage`.
8. Verify the public package and installability after approval:
   `npm view @in-c0/paper-ui@alpha version`
   `npm install @in-c0/paper-ui@alpha`
9. Then create git tag `v0.1.0-alpha.1` on the matching release commit and record checks and npm evidence in a GitHub release. Do not tag unverified / unapproved contents.

## Next versions: OIDC Trusted Publishing

After the first published version exists, configure a Trusted Publisher on npm for GitHub user `in-c0`, repo `paper-ui`, and the **exact** intended publishing workflow file. Prefer short-lived OIDC identity over long-lived npm tokens for future releases.

**Do not prematurely enable OIDC publishing through this staging-token workflow** as the registered workflow and publishing action must match npm's Trusted Publisher configuration. See [npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).

## Release gates still open

- Independent source and tarball install tests are automated.
- User experience and visual quality still need real-device mobile GPU, keyboard/AT, screen-reader and Safari audits. The package must remain labeled **experimental alpha** until these are assessed.
- No automated public approval or `latest` dist-tag promotion exists.
