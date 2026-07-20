# NOW_WHAT? Cloudflare Beta Deployment

This runbook deploys the static v1.2 beta PWA without adding a backend, cloud data store, analytics, or paid Cloudflare products.

## Project configuration

| Setting | Value |
|---|---|
| Repository | `NafisAnwar/now-what` |
| Production branch | `beta` |
| Framework preset | `Vite` |
| Root directory | Repository root |
| Build command | `npm run qa:v1.2 && npm run typecheck && npm run build` |
| Output directory | `dist` |
| Environment variables | None |

Try `now-what-app` as the permanent project name. If it is unavailable, use `now-what-nafis`. Do not include `beta` in the project name: the resulting `pages.dev` hostname is the IndexedDB origin for tester data.

## Account-side setup

1. In Cloudflare, open **Workers & Pages**, create a Pages application, and select **Connect to Git**.
2. Authorize the Cloudflare Workers and Pages GitHub App for only the `now-what` repository.
3. Select the `beta` production branch and enter the build settings above.
4. Keep automatic production deployments and non-production preview deployments enabled.
5. Leave Access, Web Analytics, Functions, Workers, KV, D1, R2, bindings, secrets, custom domains, and paid add-ons disabled.
6. Deploy and retain the build log if any command fails.

The repository pins Node in `.nvmrc`, supplies the SPA fallback in `public/_redirects`, and supplies security, cache, and beta no-index rules in `public/_headers`.

## Release gate

Before pushing a beta release, run:

```bash
npm run qa:v1.2
npm run typecheck
npm run build
git diff --check
```

After deployment, verify direct-route reloads, IndexedDB persistence, export/import, the service worker, offline reload, installability, security headers, and browser console output. A successful Cloudflare production deployment can be rolled back from the project's Deployments page.

## Data boundary

Cloudflare serves static application files. User records remain in IndexedDB on each browser and device. Moving to another hostname, clearing site data, or using another browser creates a separate storage boundary. Export/import is the supported transfer path.
