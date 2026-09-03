# Bug Fixes & Known Issues

This document tracks all known bugs, regressions, and issues in `media_cataloger_web`.
Each bug is categorized by component and marked with its current status.

**Severity levels**: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low  
**Status**: `[ ]` Open · `[x]` Fixed · `[~]` In Progress · `[?]` Needs Reproduction

---

## 🏗️ Architecture & Core Infrastructure

*(No known issues)*

---

## 🗃️ Metadata, Processing & AI Pipeline

*(No known issues)*

---

## 🌳 Family Tree

- [x] 🟠 **Child node delete button not rendering**: The delete/remove button on child person nodes was missing from the canvas toolbar in specific tree configurations. Affected `CanvasToolbar.tsx` and `FamilyTreeTab.tsx`. Fixed by correcting conditional render logic and ensuring the button is always injected into the toolbar when a child node is selected.
  - **Affected version**: v0.3.x
  - **Fixed in**: v0.4.0 (Unreleased)
  - **References**: Conversation `3710b459` – *Troubleshooting Child Delete Button*
- [ ] 🟠 **Filter facts on Family Tree** - The filter facts on the Family Tree showing in a list that should scroll horizontally. this is not a good user experience. fit in width of screen, add multiline support. And show only filter for facts existing for this person. 
---

## 🖼️ UI / UX & Visual Features

- [x] 🔴 **Duplicates Manager checkbox/image click closing window**: Clicking on a duplicate file checkbox or image card immediately closed the Duplicates Manager window and redirected to the Media gallery tab. Caused by missing `e.stopPropagation()` on the checkbox `onClick` event which bubbled to the preview wrapper's `onOpenViewer` handler, coupled with a disruptive `setActiveTab('main')` redirect in `App.tsx`. Fixed by stopping click event bubbling on checkboxes, toggling selection directly on card/image clicks, removing the tab redirect in `App.tsx`, and adding an in-place lightbox preview modal with zoom button (`dup-item-zoom-btn`).
  - **Affected version**: v0.3.x, v0.4.0
  - **Fixed in**: v0.4.0 (Unreleased)
  - **References**: Issue *Duplicates Manager - unable to mark duplicate file for further deletion*

- [x] 🔴 **Video file preview not working**: Previewing video files (`.mp4`, `.mov`, etc.) failed in both the main gallery lightbox (`MediaViewerModal`) and Duplicates Manager (`DuplicatesManagerTab`). Caused by two critical issues:
  1. Backend `streamFileSafely` in `server/media/media.controller.ts` lacked HTTP Range request support (`Range: bytes=start-end`), always returning `200 OK` with full Content-Length instead of `206 Partial Content` with `Content-Range` and `Accept-Ranges: bytes`. Modern browsers require HTTP byte ranges to buffer, seek, and parse metadata atoms (`moov`). Furthermore, `.mov` MIME type was served as `video/quicktime` instead of web-demuxer-compatible `video/mp4`.
  2. Frontend Duplicates Manager preview lightbox modal and side-by-side comparator unconditionally rendered `<img>` tags for all items, breaking preview for video files. `MediaViewerModal` lacked video `poster` frame extraction, `playsInline`, `preload="metadata"`, and had no error recovery fallback when browsers could not decode specific codecs (e.g. Apple QuickTime HEVC in `.mov`).
  - Fixed by implementing full HTTP 206 Range request streaming in `media.controller.ts`, serving `.mov` as `video/mp4`, adding `<video>` player support to Duplicates Manager preview modal and comparator, adding first-frame extracted WebP posters, and adding a friendly fallback overlay with direct video download button for unsupported codecs.
  - **Affected version**: v0.3.x, v0.4.0
  - **Fixed in**: v0.4.0 (Unreleased)
  - **References**: User issue *Preview for video files is not working*

---

## 🔒 Security, Access Control & Admin

*(No known issues)*

---

## 📱 Clients & Platforms

*(No known issues)*

---

## 🗄️ Database & Caching

*(No known issues)*

---

## 🌐 Internationalization (i18n)

*(No known issues)*

---

> **How to add a new bug**
>
> 1. Choose the appropriate section above.
> 2. Add a bullet in the format:
>    ```
>    - [ ] 🟠 **Short description**: Detailed explanation. Affected files: `ComponentName.tsx`.
>      - **Affected version**: vX.Y.Z
>      - **Fixed in**: vA.B.C (Unreleased) — or "Not yet fixed"
>      - **References**: Link / conversation / issue
>    ```
> 3. Mark it `[x]` once a fix is merged and update **Fixed in** with the target release version.
> 4. Mirror the fix entry in `CHANGELOG.md` under `### Fixed` for the corresponding release.
