# Changelog

## Unreleased

First npm release as 0.1.0, with a documentation site.

### Added

- Documentation site in `docs/`: a page per element and module, live previews with Preview/Code and replay, npm/CDN/manual install, API tables, accessibility notes, a ⌘K / `/` palette, Copy page as Markdown, Open in Claude / ChatGPT, light and dark themes, and `docs/llms.txt`.
- `theme` attribute (`light`, `dark`, `auto`) on both elements; `<profile-atlas>` passes it to its timeline.
- Seventeen `--profile-atlas-*` custom properties for colour, read by every surface of both elements.
- `range` attribute and property on `<github-activity-timeline>`.
- `<profile-atlas>` works from a manifest alone, with no username and no GitHub request.
- Package `exports` for `timeline-math.js` and each stylesheet; `GithubActivityTimeline` is exported next to `ProfileAtlas`.
- Tests for the element lifecycle, using a small fake DOM in `tests/fake-dom.mjs`.

### Fixed

- An `events` array set before the element was defined was lost, and the element fetched from GitHub instead.
- Upgrading an element with several attributes started one load per attribute (21 GitHub requests for one atlas and one timeline instead of 6).
- Dark colour schemes: the old dark rules left the close button and other controls dark on dark. Dark is now an explicit `theme`, and the default stays light.
- Arrow keys pressed inside the nested timeline moved the gallery.
- Records dated with a `Date` object or a timestamp were dropped, and a month-only record with a `Date` crashed the bucketing.
- An `activityCount` of 0 counted as 1 in the monthly analysis.
- “Failed to fetch” was shown when GitHub was unreachable; the message now says what happened.
- Saved and Remixed tabs showed with nothing in them.
- The index and details dialogs did not keep Tab inside them; the details video autoplayed under reduced motion.
- On long ranges the month ticks overlapped and the year labels were cut off; the plot now opens scrolled to the latest period.
