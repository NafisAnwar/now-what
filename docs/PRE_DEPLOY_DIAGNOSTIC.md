# NOW_WHAT? Pre-Deployment Diagnostic

## Release Status

- Date: 2026-07-20
- Branch: `feature/needs-profile-data-model`
- Result: Ready for controlled public beta
- Deployment blockers: None found after targeted fixes
- Issues found: 32 grouped findings
- Issues fixed: 26
- Deferred non-blocking findings: 6
- Dexie schema changes: None
- App version changes: None
- Dependencies added or updated: None

## Release Gate

| Check | Result | Detail |
|---|---|---|
| `npm run qa:v1.2` | Pass | 103 deterministic assertions |
| `npm run typecheck` | Pass | TypeScript no-emit check |
| `npm run build` | Pass | Vite production build |
| Service worker syntax | Pass | `node --check public/service-worker.js` |
| Production browser smoke | Pass | Desktop 1366x768 and mobile 390x844 |
| Browser console | Pass | No warning or error entries during smoke test |
| Lint | Not available | No lint script is defined |
| General unit test | Not available | No general test script is defined; `qa:v1.2` is the repository QA gate |

The build emits one non-blocking warning: the main JavaScript chunk is approximately 576 kB minified and 161 kB gzip, above Vite's 500 kB warning threshold. This is acceptable for beta, but route/debug code splitting should be considered later.

## Fixed Findings

1. Centralized task and habit completion writes in atomic Dexie transactions.
2. Prevented duplicate daily habit completion logs and repeated task completion writes.
3. Cancelled related scheduled reminders immediately when a task or habit is completed.
4. Prevented non-boolean habits from being falsely completed with an implicit value of `1` from recommendations or reminders.
5. Rejected blank, zero, negative, fractional, or otherwise invalid Quick Log durations and disabled empty note submission.
6. Added single-flight guards and error feedback to task, habit, goal, calendar, reminder, and Quick Log saves.
7. Enforced positive whole-number task estimates and accurate recurrence copy.
8. Enforced completion-type-specific habit targets and values.
9. Corrected manual reminder defaults when one hour later crosses local midnight; rejected invalid and past reminder times.
10. Corrected scheduled reminder ordering and delayed yesterday-review selection until after navigation mounts the Review page.
11. Prevented automatic hydration and movement reminders from appearing on a completely blank profile.
12. Added strict manual calendar date/time validation and locked the ICS control while an import is running.
13. Classified multi-day calendar blocks by date overlap, handled all-day labels, and corrected active-block end boundaries.
14. Hardened ICS date parsing, invalid-event rejection, and exclusive all-day `DTEND` normalization.
15. Made calendar-block-to-task conversion transactional so repeated conversion cannot race into duplicate tasks.
16. Replaced dead NOW_WHAT? empty-state Accept/Dismiss actions with working Add Task/Add Habit actions.
17. Changed active calendar-block acceptance from a no-op regeneration to opening Calendar.
18. Throttled focus/visibility recommendation refreshes so tab switching does not churn the deck or cooldown state.
19. Preserved and focused a recommendation's target task after navigation to Tasks.
20. Stopped suppressing the browser's native PWA install flow when no custom install button is rendered.
21. Prevented the service worker from unregistering itself on localhost preview, deleting unrelated origin caches, or reading from other cache namespaces.
22. Added a Cloudflare static-host SPA fallback through `public/_redirects`.
23. Strengthened backup structure validation before destructive restore and expanded integrity checks for invalid timestamps and durations.
24. Added route-level render recovery and improved shared modal dialog semantics, viewport bounds, backdrop close, and visible focus behavior.
25. Added mobile wrapping for task, habit, reminder, Quick Log, and form-grid layouts; date-sensitive views now roll over at local midnight.
26. Corrected stale README, Guide, and micro-action copy that described auto-seeding, a hidden install button, automatic task recurrence, timers, or unsupported action wiring.

## Interaction Mapping

| Control group | Primary files | Expected action | Status / fix |
|---|---|---|---|
| Topbar logo | `Topbar.tsx` | Navigate to Dashboard | Verified desktop/mobile and direct route return |
| Mobile menu and sidebar links | `AppShell.tsx`, `Sidebar.tsx` | Open menu, navigate, close after route change | Verified; no horizontal overflow |
| Dashboard add controls | `Dashboard.tsx`, `DailyPlanPanel.tsx`, `App.tsx` | Open task, habit, and calendar modals | Verified |
| NOW_WHAT? regenerate | `NowWhatCard.tsx` | Build a fresh deterministic deck | Verified; visibility refresh throttled |
| NOW_WHAT? accept | `NowWhatCard.tsx` | Complete/open/navigate according to action type | Fixed empty state, active block, and non-boolean habit handling |
| NOW_WHAT? dismiss | `NowWhatCard.tsx`, `nowWhat.ts` | Persist cooldown and select another eligible action | QA coverage retained; double-action guard added |
| Recommendation alternatives | `NowWhatCard.tsx` | Promote selected alternative to primary | QA coverage retained |
| Task create/complete | `TaskModal.tsx`, `TaskRow.tsx`, `completions.ts` | Validate, create, complete once, cancel reminders | Fixed and verified |
| Habit create/edit/delete/log | `HabitModal.tsx`, `HabitRow.tsx`, `completions.ts` | Preserve category, validate value, write once | Fixed; non-boolean values require explicit input |
| Goal create/edit/delete/link | `GoalModal.tsx` | Reconcile task/habit ownership transactionally | Verified statically; duplicate-submit guard added |
| Calendar add/edit/delete/convert | `CalendarPage.tsx`, `CalendarBlockModal.tsx`, `calendar.ts` | Validate block and convert at most once | Fixed; mobile modal and temporary create/delete smoke tested |
| ICS file control | `CalendarPage.tsx`, `ics.ts` | Select, parse, deduplicate, import | Visibly interactive; invalid/all-day parser QA added |
| Quick Log actions | `QuickLogModal.tsx` | Save valid factual logs only | Empty/invalid submissions disabled; mobile smoke tested |
| Manual reminders | `RemindersPage.tsx`, `reminders.ts` | Save future standalone reminder | Midnight, date, time, ordering, and submit guards fixed |
| Reminder tray | `InAppReminderTray.tsx` | Open target, complete boolean habit, log water, dismiss | Fixed semantic and non-boolean handling |
| Review actions | `DailyReviewPage.tsx`, `CarryOverReview.tsx` | Review meaningful activity and carry to correct date | Existing gating QA retained; navigation race fixed |
| Data export/import | `ExportPanel.tsx`, `ImportPanel.tsx`, `exportImport.ts` | Export/validate/replace active profile stores | Store coverage matches schema; validation hardened |
| Integrity fixes | `IntegrityPanel.tsx`, `integrity.ts` | Report and repair supported broken references | Timestamp/duration diagnostics expanded |
| Danger Zone | `DangerZone.tsx`, `seed.ts` | Clear/reset only after explicit action | No automatic seeding found; controls remain explicit |
| Guide/tutorial | `TutorialPage.tsx`, `TutorialPrompt.tsx` | One-time prompt and always-accessible guide | Bullet formatting and current copy verified on mobile |
| Keyboard shortcuts | `App.tsx` | T/H/G/L/N and Shift+N outside editable fields | Handler guard retained; Quick Log keyboard smoke tested |
| Modal cancel/Escape | Modal components | Close without saving | Verified for shared Task modal and Quick Log; viewport bounds verified |

## Engine Consistency

- Fresh profile returns only `NO CONTEXT AVAILABLE`; it does not invent hydration, movement, or review work.
- Critical overdue tasks and active calendar blocks retain hard precedence over soft profile/energy preferences.
- User Energy Level remains numeric 1-5; Task Energy Requirement remains low/medium/high.
- Needs Profile weights apply through normalized category groups, while unknown categories remain neutral.
- State, energy, and capacity explanations are emitted only from real logged context.
- Candidate selection remains deterministic; no random selection was found.
- Cooldown identities remain persisted in suggestions and survive rerenders/refreshes.
- No schema or core ranking rewrite was introduced.

## Persistence

The profile meta database selects a profile-specific Dexie database before app rendering. Export/import covers all 12 active stores: tasks, habits, goals, calendar blocks, activity logs, daily plans, suggestions, daily reviews, weekly reviews, settings, reminders, and Needs Profiles. Restore keeps the active local profile identity rather than importing another device's identity. Schema 1 and 2 compatibility paths remain intact; missing newer stores are normalized only where explicitly supported.

## PWA And Hosting

- Manifest, favicon, SVG 192/512 icons, and service-worker paths exist in the production build.
- HTML navigation is network-first with cached shell fallback.
- Static assets and fonts are cache-first with background refresh.
- Cache eviction is limited to old `nowwhat-shell-*` caches.
- Cloudflare Workers Static Assets rewrites nested routes to `index.html`.
- Native browser install behavior is no longer intercepted without a visible custom install action.

## Deferred Non-Blocking Findings

1. ICS recurrence expansion, `VTIMEZONE`, and complex timezone definitions remain unsupported; recurrence metadata is imported without generating instances.
2. Task repeat settings are metadata only; future task records are not materialized automatically.
3. The production bundle exceeds Vite's 500 kB warning threshold; safe lazy loading/code splitting is deferred.
4. The large PNG favicon and SVG-only install icons should receive a dedicated asset-optimization/iOS compatibility pass.
5. Imported calendar blocks can still be edited in the current UI; stricter read-only imported-event behavior requires a deliberate product decision.
6. Some legacy custom modal implementations do not provide a full Tab focus trap or guaranteed trigger-focus restoration, although they are bounded, labelled, keyboard-closeable, and focus-visible.

## Manual Tests Still Required

- Complete one full fresh-profile onboarding run after clearing site data.
- Create, edit where supported, complete, and delete representative task, habit, goal, block, and reminder records.
- Exercise every Quick Log type with valid values and confirm Timeline/Lifestyle updates.
- Verify NOW_WHAT? accept, dismiss, alternatives, cooldown persistence, critical deadline precedence, calendar precedence, and low/high energy fit with seeded manual scenarios.
- Verify Daily Review before and after meaningful activity, yesterday review, and carry-over.
- Export a populated profile, clear it, import the backup, and run Integrity Check.
- Import real-world ICS samples for floating time, UTC, all-day, duplicate, multi-day, recurrence, and timezone cases.
- Install from Chrome/Edge and mobile Add to Home Screen, then reopen offline after one online load.
- Restart the browser and confirm IndexedDB data, profile identity, reminders, and cooldowns persist.
