# NOW_WHAT?

A local-first personal daily command system. No account, server-side data store, or required cloud sync - app records live in your browser's IndexedDB via [Dexie](https://dexie.org/).

**v1.2 beta** - Tasks · Habits · Goals · Daily Plan · Calendar · Review · Reminders · Timeline · rule-based recommendation deck · PWA-ready

---

## Quick Start

### Requirements

- **Node.js** 22.14.0 (pinned in `.nvmrc`) — https://nodejs.org
- **npm** 10+ (comes with Node), or **pnpm** 9+, or **yarn** 4+

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

The app opens at **http://localhost:5173**

First launch creates a stable local profile with empty user-data stores. Demo data is available only through the explicit **Data → Danger Zone → Reset demo data** action.

---

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server at http://localhost:5173 |
| `npm run build` | Build for production → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | TypeScript check (no emit) |
| `npm run qa:v1.2` | Run deterministic engine and data-layer regression checks |

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `T` | New task |
| `H` | New habit |
| `G` | New goal |
| `L` | Quick log (water, exercise, mood…) |
| `N` | Regenerate NOW_WHAT? suggestion |
| `Shift+N` | Toggle engine debug panel |

---

## Data & Privacy

- **All app records are stored locally** in your browser's IndexedDB. They are not uploaded to the static host.
- **Export** your data any time: Data → Export (downloads a JSON file).
- **Import** a backup: Data → Import.
- If you clear browser storage or switch browsers, your data will be gone — export first.

---

## Beta Deployment

- [Cloudflare beta deployment runbook](docs/CLOUDFLARE_BETA_DEPLOYMENT.md)
- [Beta tester guide](docs/BETA_TESTER_GUIDE.md)
- [Beta feedback template](docs/BETA_FEEDBACK_TEMPLATE.md)

---

## Project Structure

```
src/
├── App.tsx                    # Root component, routing, modal orchestration
├── main.tsx                   # Entry point
├── index.css                  # Global styles + CSS variables
├── types/index.ts             # All shared TypeScript types
│
├── data/
│   ├── db.ts                  # Dexie database schema (IndexedDB)
│   ├── seed.ts                # Demo data seeder
│   ├── reminders.ts           # Reminder scheduler
│   ├── review.ts              # Daily review helpers
│   ├── exportImport.ts        # JSON backup/restore
│   └── integrity.ts           # Cross-store integrity checks
│
├── engine/
│   ├── nowWhat.ts             # NOW_WHAT? decision engine (context → suggestion)
│   └── dailyPlan.ts           # Daily plan context builder
│
├── components/
│   ├── layout/                # AppShell, Topbar, Sidebar
│   ├── dashboard/             # Dashboard, NowWhatCard, strips
│   ├── tasks/                 # TasksPage, TaskRow, TaskModal
│   ├── habits/                # HabitsPage, HabitRow, HabitModal
│   ├── goals/                 # GoalsPage, GoalRow, GoalModal
│   ├── calendar/              # CalendarPage, CalendarBlockModal
│   ├── planning/              # DailyPlanPanel
│   ├── review/                # DailyReviewPage, DailyReviewPanel
│   ├── reminders/             # RemindersPage, InAppReminderTray, settings
│   ├── timeline/              # Timeline activity feed
│   ├── quicklog/              # QuickLogModal (water, exercise, mood…)
│   ├── data/                  # DataPage (export, import, schema, integrity)
│   ├── debug/                 # EngineDebugPanel
│   └── ui/                    # Headless UI primitives (Radix-based)
│
└── utils/
    └── dateUtils.ts           # Date helpers (localDateStr, getTodayStr…)

public/
├── favicon.svg
├── icon-192.svg               # PWA icon
├── icon-512.svg               # PWA icon
├── manifest.webmanifest       # PWA manifest
└── service-worker.js          # Offline shell caching
```

---

## PWA / Install

The app ships as a PWA. In a browser that supports installation (Chrome, Edge):

1. Build and serve: `npm run build && npm run preview`
2. Visit http://localhost:4173
3. Use the browser's install control when it is offered

The service worker caches the app shell so it works offline after the first visit.

---

## No Replit Dependencies

This export has been stripped of all Replit-specific packages and configuration:

| Removed | Reason |
|---|---|
| `@replit/vite-plugin-runtime-error-modal` | Replit dev overlay |
| `@replit/vite-plugin-cartographer` | Replit-only project mapper |
| `@replit/vite-plugin-dev-banner` | Replit-only banner |
| `PORT` / `BASE_PATH` env vars in vite.config | Replaced with localhost:5173 / base `/` |
| `@workspace/api-client-react` | Monorepo scaffold remnant, not used |
| `tsconfig.base.json` reference | Inlined into standalone `tsconfig.json` |

No Replit auth, no Replit DB, no Replit secrets manager — the app never used any of them.

---

## Extending

Since there's no backend, adding persistence beyond the browser means wiring in a sync layer yourself:

- **PostgreSQL / SQLite**: replace Dexie calls in `src/data/db.ts` with a backend API
- **Sync**: CRDTs (e.g. Yjs, Automerge) or a simple REST/WebSocket server
- **Auth**: any standard OpenID Connect provider

The engine (`src/engine/`) and all UI components are pure TypeScript/React with no vendor lock-in.
