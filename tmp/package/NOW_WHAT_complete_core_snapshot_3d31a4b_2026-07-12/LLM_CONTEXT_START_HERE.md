# NOW_WHAT? LLM Context Start Here

This package is an exact committed core-source snapshot of NOW_WHAT? at commit 3d31a4b1f6f5c3bdcd892504db71c7dd58976178 (3d31a4b) on branch feature/needs-profile-data-model, plus generated architecture documentation.

## Read Order

1. DOCUMENTATION/NOW_WHAT_complete_engine_architecture_v1.2_2026-07-12.pdf
2. src/types/index.ts
3. src/db/index.ts, src/db/profile.ts, and src/db/defaults.ts
4. src/engine/nowWhat.ts, src/engine/scoringV12.ts, src/engine/microActions.ts, and src/engine/explain.ts
5. src/components/dashboard/NowWhatCard.tsx and src/components/debug/EngineDebugPanel.tsx
6. src/services/exportImport.ts, src/services/reminderScheduler.ts, src/services/reviews.ts, and src/services/calendarImport.ts
7. scripts/v12-engine-qa.mjs

## Interpretation Rules

- Source code is authoritative. README text may lag implementation details.
- Product/package version is 1.1.0; Engine v1.2 names the current Needs Profile, scoring, micro-action, recommendation deck, debug, category-normalization, and QA foundation.
- Task.energyRequired is a low/medium/high task-effort requirement. It is not the numeric user Energy Level.
- User Energy Level is the latest valid 1-5 ActivityLog record with type energy.
- Profile isolation is per IndexedDB database. Ordinary records therefore do not carry a profileId column.
- The engine is deterministic and rule-based. Do not infer AI, ML, cloud, account, social, or gamification behavior.
- The micro-action library and constants in source are the canonical implementation contracts.

## Validation Baseline

- npm run qa:v1.2: 77 assertions passed on 2026-07-12.
- npm run typecheck: passed on 2026-07-12.
- npm run build: passed on 2026-07-12; Vite reported only the existing chunk-size advisory.
