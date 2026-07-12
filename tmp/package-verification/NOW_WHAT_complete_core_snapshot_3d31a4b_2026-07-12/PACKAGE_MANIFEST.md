# NOW_WHAT? Core Snapshot Package Manifest

## Snapshot Identity

- App: NOW_WHAT?
- Package version: 1.1.0
- Engine reference: v1.2 foundation
- Branch: feature/needs-profile-data-model
- Commit: 3d31a4b1f6f5c3bdcd892504db71c7dd58976178
- Short commit: 3d31a4b
- Generated: 2026-07-12 (Asia/Dhaka)

## Included

- All 144 committed core project files from git ls-files, excluding historical generated output and preview logs.
- Complete src/ application source.
- public/ PWA assets, manifest, favicon/icon sources, and service worker.
- Engine QA script, project configuration, README, package manifest, and lockfile.
- The complete 45-page source-grounded architecture and engine report.
- LLM navigation guidance, source tree, and SHA-256 checksums.

## Intentionally Excluded

- .git/ repository metadata.
- node_modules/ installed dependencies.
- dist/ generated production output.
- tmp/ report and package build intermediates.
- Historical output/ ZIP/PDF artifacts and preview logs.
- Browser IndexedDB user data, because this package is source architecture rather than a user backup.

## Verification

- npm run qa:v1.2: PASS, 77 assertions.
- npm run typecheck: PASS.
- npm run build: PASS, 109 modules transformed.
- PDF: PASS, 45 pages; every documented section and all 54 micro-action IDs extracted successfully; no blank pages or replacement characters; all pages rendered and visually inspected.
- ZIP: generated from committed files, expanded into a temporary verification directory, and checked against SHA256SUMS.txt.

## Source-of-Truth Policy

The PDF explains the architecture and behavior at this commit. The TypeScript, TSX, service worker, manifest, and package files remain authoritative for exact execution semantics. Use SHA256SUMS.txt to detect any package drift.
