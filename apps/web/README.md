# Web

The KODI-201 application shell provides React Router routes for Home, Movies,
TV Shows, and Search. Navigation uses a sidebar on desktop and a bottom bar on
mobile. Route loading, error, and not-found states provide the shared pattern
for later feature pages.

KODI-202 adds a Home dashboard backed by `GET /api/library/summary`, including
responsive movie/TV-show count cards and loading, error/retry, and empty states.

KODI-203 adds the paginated Movies route with a responsive poster grid,
loading skeleton, empty/error states, and links to `/movies/:id`.

KODI-204 replaces that handoff with a responsive movie detail page backed by
`GET /api/movies/:id`, including loading, not-found, error/retry, metadata, and
resume-progress states.

KODI-205 adds paginated TV-show browsing and detail routes with responsive
cards, episode progress, metadata, and loading/empty/not-found/error states.

KODI-206 adds URL-backed, paginated library search with typed movie/TV-show
results, client validation, and initial/loading/empty/error states.

KODI-207 maps verified HTTPS poster artwork into movie and TV-show cards and
movie details, with lazy loading and safe title-letter fallback behavior.

## Cloudflare Pages

KODI-405 deploys the existing production Vite output to the `kodi-web` Pages
project. Browser API calls remain same-origin (`/api/...`). The Pages Function
forwards only the public read routes to the `kodi-cloudflare-api` Worker through
the `API` service binding; the private snapshot ingestion route is excluded.

The Wrangler configuration defines explicit preview and production environments.
Hashed assets are cached immutably, application routes use Pages' default ETag
revalidation, and the native SPA fallback serves `index.html` for React Router
deep links.

```powershell
npm run build --workspace @kodi/web
npm run pages:deploy:preview --workspace @kodi/web
npm run pages:deploy:production --workspace @kodi/web
```

Use preview deployment URLs to validate browse, detail, search, loading, empty,
and error behavior before running the production deployment command. Stage 1's
Docker/nginx build remains available for rollback.
