# NOW_WHAT? Cloudflare Workers Beta Deployment

This runbook deploys the static v1.2 beta PWA as an asset-only Cloudflare Worker. It does not add Worker code, a backend, cloud data storage, analytics, or paid Cloudflare products.

## Project configuration

| Setting | Value |
|---|---|
| Repository | `NafisAnwar/now-what` |
| Worker name | `now-what-app` |
| Production branch | `beta` |
| Root directory | Repository root |
| Build command | `npm run qa:v1.2 && npm run typecheck && npm run build` |
| Deploy command | `npx wrangler deploy` |
| Static asset directory | `dist` (configured in `wrangler.jsonc`) |
| Environment variables | None |

Use `now-what-app` exactly as the permanent Worker name. The dashboard name must match the `name` in `wrangler.jsonc`. The resulting `workers.dev` hostname is the IndexedDB origin for tester data, so keep that hostname stable throughout the beta.

## Account-side setup

1. In Cloudflare, open **Workers & Pages**, select **Create application**, and then select **Continue with GitHub**.
2. Authorize the Cloudflare Workers and Pages GitHub App for only the `now-what` repository.
3. Select `NafisAnwar/now-what` and enter `now-what-app` as the project name.
4. Select `beta` as the production branch, leave the root directory blank, and enter the build and deploy commands above.
5. Add no environment variables.
6. Keep automatic production deployments enabled. Non-production branch builds may remain enabled for preview URLs.
7. Leave Access, Web Analytics, Worker scripts, KV, D1, R2, bindings, secrets, custom domains, and paid add-ons disabled.
8. Deploy and retain the build log if any command fails.

The repository pins Node in `.nvmrc` and Wrangler in `package.json`. `wrangler.jsonc` deploys `dist` as static assets and enables SPA fallback without a Worker script. The existing `public/_redirects` supplies an additional SPA rewrite, while `public/_headers` supplies security, cache, and beta no-index rules.

## Release gate

Before pushing a beta release, run:

```bash
npm run qa:v1.2
npm run typecheck
npm run build
npx wrangler deploy --dry-run
git diff --check
```

After deployment, verify the assigned `workers.dev` URL, direct-route reloads, IndexedDB persistence, export/import, the service worker, offline reload, installability, security headers, and browser console output. A successful Cloudflare production deployment can be rolled back from the Worker's Deployments page.

## Data boundary

Cloudflare serves static application files. User records remain in IndexedDB on each browser and device. Moving to another hostname, clearing site data, or using another browser creates a separate storage boundary. Export/import is the supported transfer path.
