# MyVideos121 schema verification

**Ticket:** KODI-003  
**Inspection date:** 2026-08-09  
**Selected database:** `MyVideos121`  
**Connection:** dedicated read-only MariaDB account on the private LAN

No credentials, raw media paths, titles, plots, or artwork URLs are recorded in
this document.

## Version evidence

The selected database's `version` table contains `idVersion = 121` and
`iCompressCount = 0`. The official Kodi database-version table maps video
schema 121 to Kodi 20 "Nexus". This identifies the major Kodi generation; the
installed Kodi patch release is not available from this database evidence.

Reference: <https://kodi.wiki/view/Databases>

## Candidate movie source

`movie_view` exists as a MariaDB `VIEW` and has a valid stored definition. It is
the safest initial movie source because it combines the base movie record with
file/path, watch-state, resume, rating, and unique-ID data. Using the view keeps
future repository code isolated from those joins.

Verified columns, in database order:

```text
idMovie, idFile,
c00, c01, c02, c03, c04, c05, c06, c07, c08, c09, c10, c11,
c12, c13, c14, c15, c16, c17, c18, c19, c20, c21, c22, c23,
idSet, userrating, premiered,
strSet, strSetOverview, strFileName, strPath,
playCount, lastPlayed, dateAdded,
resumeTimeInSeconds, totalTimeInSeconds, playerState,
rating, votes, rating_type, uniqueid_value, uniqueid_type
```

Safe explicit candidates for early API work are `idMovie`, `idFile`,
`premiered`, `userrating`, `playCount`, `lastPlayed`, `dateAdded`, `rating`, and
the resume fields. The `c00`–`c23` columns are real but semantically opaque in
the database schema. Redacted value-shape checks are consistent with `c00`
being a short display value and `c01` being longer descriptive text, but that
observation alone is not authorization to assign production DTO meanings.

Before a movie list/detail repository uses any `cNN` field, its semantic mapping
must be corroborated against the Kodi 20 source/schema contract and covered by
an integration test against this database.

KODI-102 corroboration: Kodi 20 Nexus's official `VideoDatabase.h` defines
`VIDEODB_ID_TITLE = 0` and `VIDEODB_ID_PLOT = 1`. Therefore `movie_view.c00`
is verified as the movie title and `movie_view.c01` as plot for schema 121.
KODI-102 uses only `c00` from these opaque fields.

Reference:
<https://github.com/xbmc/xbmc/blob/Nexus/xbmc/video/VideoDatabase.h>

## Candidate TV-show source

`tvshow_view` exists as a MariaDB `VIEW` and has a valid stored definition. It
is the safest initial TV-show source because it combines the base show record
with one representative path, added/played state, episode/season counts,
rating, and unique-ID data.

Verified columns, in database order:

```text
idShow,
c00, c01, c02, c03, c04, c05, c06, c07, c08, c09, c10, c11,
c12, c13, c14, c15, c16, c17, c18, c19, c20, c21, c22, c23,
userrating, duration,
idParentPath, strPath, dateAdded, lastPlayed,
totalCount, watchedcount, totalSeasons,
rating, votes, rating_type, uniqueid_value, uniqueid_type
```

Safe explicit candidates for early API work are `idShow`, `userrating`,
`duration`, `dateAdded`, `lastPlayed`, `totalCount`, `watchedcount`,
`totalSeasons`, and `rating`. As with movies, the `c00`–`c23` semantic mapping
must be corroborated before production use. The representative `strPath` must
not be treated as the only TV-show path because a show can have multiple paths.

KODI-104 corroboration: Kodi 20 Nexus's official `VideoDatabase.h` defines
`VIDEODB_ID_TV_TITLE = 0`, `VIDEODB_ID_TV_PLOT = 1`, and
`VIDEODB_ID_TV_PREMIERED = 5`. Therefore `tvshow_view.c00`, `c01`, and `c05`
are verified as title, plot, and premiere date respectively for schema 121.
KODI-104 uses only `c00` and `c05` from these opaque fields.

Reference:
<https://github.com/xbmc/xbmc/blob/Nexus/xbmc/video/VideoDatabase.h>

## Artwork source and redacted samples

`art` exists as a MariaDB `BASE TABLE` with these verified columns:

```text
art_id, media_id, media_type, type, url
```

The relationship is `media_id` plus `media_type`; observed relevant media types
are `movie` and `tvshow`. Grouped inspection without returning raw URLs found:

| Media type | Artwork types observed | URL form observed |
| --- | --- | --- |
| movie | banner, clearart, clearlogo, discart, fanart, icon, keyart, landscape, poster, thumb | `https:[redacted]`, `image:[redacted]`, and one local/other value with no scheme |
| tvshow | banner, clearart, clearlogo, fanart, keyart, landscape, poster | `https:[redacted]` |

Artwork URLs require a separate mapping/proxy decision. In particular, Kodi's
`image:` form is not directly browser-safe, and even HTTPS values should be
returned only through an intentional API contract.

KODI-207 live verification found all 38 movie posters and all 26 TV-show
posters use HTTPS URLs. Movie `thumb` values use Kodi's unsupported `image:`
form, and one movie `icon` uses an unsupported local/other form. The API maps
only `type = 'poster'` values that parse as credential-free HTTPS URLs; all
other forms map to `null`. Direct HTTPS mapping is used instead of an outbound
binary proxy to avoid introducing an unnecessary SSRF surface.

## Guardrails for follow-up tickets

- Use explicit column lists; never use `SELECT *`.
- Keep KODI SQL in API repository modules.
- Parameterize every user-controlled value.
- Paginate or limit all list queries.
- Do not expose `strPath`, `strFileName`, unique IDs, or raw artwork URLs unless
  the relevant API contract explicitly requires and sanitizes them.
- Do not modify the KODI-owned schema or data.
- KODI-003 adds no production query; later tickets must implement and test the
  smallest query needed for their own acceptance criteria.
