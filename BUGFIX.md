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

---

## 🖼️ UI / UX & Visual Features

*(No known issues)*

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
