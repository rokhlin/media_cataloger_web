---
name: react-developer
description: >-
  Stack-specific engineering skill for media_cataloger_web (React 19, TypeScript, Vite,
  Tailwind CSS, Lucide React, NestJS). Defines component composition, routing, virtualized
  gallery grids, accessibility (WCAG 2.1 AA), build/test commands, and quality standards (≥75% test coverage).
---

# React Developer — Media Cataloger Web (`react-developer`)

This skill defines the technical standards, architectural patterns, and development workflows for `media_cataloger_web` built with React 19, TypeScript, Vite, Tailwind CSS, and a NestJS backend.

---

## 1. Technology Stack & Framework Conventions

- **Language**: TypeScript 5.7+ (strict mode enabled).
- **Frontend Core**: React 19 with Functional Components and Hooks.
- **Routing**: React Router DOM v7 (`createBrowserRouter`, `RouterProvider`).
- **Styling**: Tailwind CSS v3 with CSS custom properties (`tokens.css`).
- **Icons**: Lucide React (`lucide-react`).
- **Virtualization**: TanStack React Virtual (`@tanstack/react-virtual`) for infinite scrolling justified photo grids.
- **Server Platform**: NestJS v11 (Express platform, TypeScript, better-sqlite3).
- **Build Tooling**: Vite 8+ for client, TSX for server.

---

## 2. Coding Standards & Component Architecture

1. **Component Design**:
   - Deconstruct complex UIs into atomic, single-responsibility components matching the shared component catalog.
   - Use typed props interfaces (`interface MediaThumbnailProps { ... }`).
   - Extract custom hooks (`useGalleryTimeline`, `useDuplicatesCluster`, `useMapBounds`) for non-trivial stateful logic.
2. **Hook Rules & Performance**:
   - Adhere strictly to the Rules of Hooks.
   - Use `useCallback` and `useMemo` for heavy calculations like timeline sorting, aspect ratio row justification, and cluster grouping.
3. **Accessibility & Responsive Scaling (WCAG 2.1 AA)**:
   - Use semantic HTML tags (`<nav>`, `<header>`, `<main>`, `<article>`, `<button>`).
   - Interactive elements must include appropriate ARIA attributes, labels, and visible high-contrast focus rings.
   - Layouts must adapt flexibly to 200% browser zoom without text clipping or broken containers.
4. **Theme Manager Integration**:
   - Bind dark theme toggling to document root class (`.dark`) and persist in local storage.

---

## 3. Build, Run & Test Procedures

Execute commands from `media_cataloger_web` root:
- **Run Client Dev Server**: `npm run dev`
- **Run Backend Dev Server**: `npm run server:dev`
- **Build Client Bundle**: `npm run build`
- **Build Server**: `npm run server:build`
- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint` (using `oxlint`)
- **Run Client Tests**: `npm run test:client`
- **Run Server Tests**: `npm run test:server`
- **Run E2E Tests**: `npm run test:e2e` (using Playwright)

---

## 4. Quality Gates & Test Coverage

- **Mandatory 75% Coverage Threshold**: All custom hooks, business utility functions, and domain state reducers must achieve $\ge 75\%$ test coverage.
- **Zero Type & Lint Errors**: Strict TypeScript checking (`npm run typecheck`) and oxlint must pass without errors.
