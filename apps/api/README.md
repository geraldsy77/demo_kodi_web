# API

Available endpoints:

- `GET /api/health`
- `GET /api/library/summary`
- `GET /api/movies?page=1&pageSize=24` (`pageSize` maximum: 100)
- `GET /api/movies/:id`
- `GET /api/tvshows?page=1&pageSize=24` (`pageSize` maximum: 100)
- `GET /api/tvshows/:id`
- `GET /api/search?q=term&page=1&pageSize=24` (`q` maximum: 100 characters;
  `pageSize` maximum: 100)

Movie and TV-show responses include a nullable `artworkUrl`. The API returns
only credential-free HTTPS poster URLs; unsupported Kodi artwork formats and
unsafe URLs are represented as `null`.

Run the read-only repository integration tests against the configured database:

```powershell
$env:KODI_INTEGRATION_TEST='true'
npm run test --workspace @kodi/api
```
