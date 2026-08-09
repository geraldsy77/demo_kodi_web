# Product Scope

## Product goal

Provide a fast, responsive web interface for browsing an existing KODI library without changing normal KODI operation.

## Stage 1 MVP

In scope:
- Health/status page.
- Library summary counts.
- Movie list.
- Movie details.
- TV show list.
- TV show details.
- Search across supported library entities.
- Poster/fanart rendering where KODI paths can be safely resolved or mapped.
- Pagination.
- Responsive desktop/tablet/mobile layout.
- Graceful handling when MariaDB/KODI is unavailable.

Out of scope for initial MVP:
- Editing KODI metadata.
- Deleting media.
- Marking watched/unwatched.
- User authentication exposed to the public Internet.
- Direct video streaming.
- Remote playback control.
- KODI add-on management.
- Replacing KODI's database.

These can become later epics after the read-only browser is stable.

## User experience direction

The app should feel like a clean media-library dashboard, not a database admin panel.

Primary navigation:
- Home
- Movies
- TV Shows
- Search

Home:
- Library summary.
- Recently added movies.
- Recently added TV episodes/shows if schema support is verified.

Movie cards:
- Poster
- Title
- Year
- Rating when available
- Watched indicator only after the schema and desired behavior are confirmed

Movie detail:
- Poster/fanart
- Title/year
- Plot
- Runtime
- Genres
- Rating
- File/path metadata only in an optional technical section

## Non-functional requirements

- Read-only DB access for MVP.
- No public MariaDB exposure.
- API list endpoints paginated.
- Reasonable query limits.
- Parameterized SQL.
- Mobile responsive.
- Accessible keyboard focus and semantic controls.
- Useful empty/error/loading states.
