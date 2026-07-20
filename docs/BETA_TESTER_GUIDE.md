# NOW_WHAT? v1.2 Beta Tester Guide

Thank you for testing NOW_WHAT?. This beta is a local-first PWA: it has no account and does not synchronize records between browsers or devices.

## Before testing

- Use the provided `pages.dev` address in a normal browser window.
- Continue using the same browser, device, and hostname during the test.
- Do not use private or incognito mode for ongoing testing.
- Do not enter information you would be uncomfortable storing on that device.
- Export a backup from **Data** before clearing browser data, changing devices, or testing a destructive import/reset path.
- Do not send an exported backup with a bug report; it may contain personal information.

## Core test route

1. Open the app for the first time and confirm the dashboard starts without demo tasks.
2. Complete the Guide and recommendation-profile prompts.
3. Add tasks with different priority, energy, duration, due date, category, and goal settings.
4. Add boolean and measured habits, then record valid completion values.
5. Add a goal and link a task or habit where available.
6. Add calendar blocks and import a small `.ics` file containing non-sensitive sample events.
7. Create a Daily Plan and inspect the NOW_WHAT? recommendation deck and explanation.
8. Log mood, energy, focus, rest, movement, distraction, water, and a note through Quick Log.
9. Dismiss and regenerate recommendations, then confirm critical overdue work and active calendar blocks still take precedence.
10. Create, dismiss, open, and complete reminders. Browser notifications are evaluated while the app is running; they are not remote push notifications.
11. Complete a daily review and inspect Timeline activity.
12. Export a backup, add a temporary record, import the backup, and confirm the earlier state is restored.
13. Refresh and close/reopen the browser to confirm records persist.
14. Install the PWA where supported, launch it, go offline after one successful online load, and verify the cached shell opens.

## What to report

Use `BETA_FEEDBACK_TEMPLATE.md` for every issue. Include exact steps, expected and observed behavior, device/browser details, and a screenshot when useful. Never include passwords, private calendar files, or exported NOW_WHAT? backups.
