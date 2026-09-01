---
name: Roadmap and Changelog Tracking Rule
description: Ensures ROADMAP.md and CHANGELOG.md are dynamically synchronized with GitHub version tags and grouped by releases.
---

# Updating ROADMAP.md and CHANGELOG.md

Whenever you implement any new feature, fix, or functionality in this project, you MUST perform the following synchronization steps:

---

## 1. Catch Version Tags from Git / GitHub & Group by Versions

1. **Fetch & List Existing Version Tags**:
   - Run `git fetch --tags` to ensure all remote tags are known locally.
   - Run `git tag --list --sort=v:refname` or check remote tags via `git ls-remote --tags origin` to discover all published version tags (e.g. `v0.0.1`, `v0.1.0`, `v0.2.0`, `v0.3.0`).
2. **Group Changes by Versions**:
   - All historical changes in `CHANGELOG.md` MUST be grouped under their corresponding version headers (e.g. `## [0.3.0] - 2026-09-01`).
   - Groupings must reflect the commit history between tags.

---

## 2. Dynamic `[future_tag_version]` Changelog Management

When updating [CHANGELOG.md](file:///c:/Users/rokhl/.gemini/antigravity/scratch/media_cataloger_web/CHANGELOG.md):

1. **Identify the Active `[future_tag_version]`**:
   - Inspect `CHANGELOG.md` to find the current `## [<future_tag_version>] - Unreleased` section (e.g. `## [0.4.0] - Unreleased`).
   - If no unreleased version section exists, compute the next semantic version tag based on the highest published tag (e.g., if highest tag is `v0.3.0`, next minor is `[0.4.0]`).

2. **Validate against GitHub / Git Tags**:
   - Check if that `[future_tag_version]` has already been published/tagged on GitHub (`git tag -l "v<future_tag_version>" "v<future_tag_version>*"` or `git ls-remote --tags origin`).
   - **If the tag is ALREADY published on GitHub**:
     - Seal that version block by replacing `- Unreleased` with the release date: `## [<tag_version>] - YYYY-MM-DD`.
     - Increment `[future_tag_version]` to the next planned semver version (e.g., `0.4.0` -> `0.5.0` or patch `0.4.1`).
     - Create a new `## [<future_tag_version>] - Unreleased` header for current work.
   - **If the tag is NOT yet published**:
     - Keep the section header as `## [<future_tag_version>] - Unreleased`.

3. **Categorize New Changes**:
   - Place new entries under the appropriate category under `## [<future_tag_version>] - Unreleased`:
     - `### Added` for new features or endpoints.
     - `### Changed` for changes in existing functionality.
     - `### Deprecated` for soon-to-be-removed features.
     - `### Removed` for removed features.
     - `### Fixed` for bug fixes.
     - `### Security` for vulnerability fixes.
   - Keep descriptions concise, past-tense, and formatted with bold feature names and file references.

---

## 3. Update `ROADMAP.md`

1. Open [ROADMAP.md](file:///c:/Users/rokhl/.gemini/antigravity/scratch/media_cataloger_web/ROADMAP.md).
2. **If the feature exists in the roadmap**: Mark its checkbox as completed (`- [x]`).
3. **If the feature does NOT exist in the roadmap**: Add it under the most appropriate section/category and mark it as completed (`- [x]`).
4. Update the "Completed Features" summary section when cutting or preparing a milestone release.
