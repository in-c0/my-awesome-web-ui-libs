# npm alpha staging — owner procedure

**Package:** `@in-c0/paper-ui@0.1.0-alpha.1`  
**Tag:** `alpha` (never `latest`)  
**Source:** [in-c0/paper-ui](https://github.com/in-c0/paper-ui)  
**Workflow:** [Stage npm alpha](../.github/workflows/npm-alpha-stage.yml)

This workflow does NOT run on ordinary pushes or tags. It performs a fresh build, tests the packed artifact in an external React consumer, validates npm packaging, and **stages** the version on npm only when explicitly triggered.

## Previous failure: Scope not found (2026-10-24)

A GitHub Actions run completed **verify** successfully and failed at `npm stage publish` with:

```
npm error code E404
404 Not Found ... Scope not found
```

This is **not** a Vite/TypeScript/packaging error, and the workflow's `NODE_AUTH_TOKEN` input was populated. npm requires an actual npm account or organization named `in-c0` with publishing rights; GitHub user `in-c0` is a different identity. The npm registry may return 404 for lack of scope access, so this does not prove whether the scope is absent or the token's permissions are inadequate.

**Corrective owner action:**

1. Sign in to npmjs.com and check whether **npm username is `in-c0`**, or whether you own/join an **npm organization `in-c0`**.
2. If neither is true, choose a scope you own or create the free public-packages npm organization `in-c0` (if available). For the latter: profile menu → **Add an Organization** → name `in-c0` → **Unlimited public packages**. If unavailable, do not attempt to use someone else's scope; use an owned scope and rename the package consistently before retrying.
3. Check the **granular stage-only token** has **read/write-stage-only** permissions covering that npm scope, and that it has not expired. Existing tokens may not automatically gain permission when a new organization is created; regenerate if necessary, then update the GitHub Actions `NPM` or `NPM_STAGE_TOKEN` secret privately.
4. Rerun the manual workflow only after scope access is verified. **Do not approve or publish** until the staged artifact has been reviewed.

The release workflow now prints an explicit GitHub error annotation when the registry responds with `Scope not found`, rather than leaving only an opaque E404.

## One-time npm account setup (must be done by the owner)

1. On [npmjs.com](https://www.npmjs.com/), sign in or create an account. Confirm you administer the **npm** user or organization named `in-c0`. Your GitHub username does **not** grant npm scope ownership.
2. Enable two-factor authentication (2FA) on the npm account. Ensure `@in-c0/paper-ui` is within the scope you administer. If that namespace is owned by someone else, **stop** — select a scope you genuinely own and update the package and pipeline first.
3. Generate a **granular stage-only access token**, limited to the package/scope and the minimum necessary publish permission. The staging token still grants registry-changing capabilities: protect it.
4. In GitHub repository **Settings → Secrets and variables → Actions**, create the repository secret `NPM_STAGE_TOKEN` (preferred). If you already named it `NPM`, that is also supported; do not duplicate the token unnecessarily. Never paste it into a chat, issue, README, workflow file, commit, or log.
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
