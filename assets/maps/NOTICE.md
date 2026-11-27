# Satellite map libraries and data (v94)

- `@maptiler/sdk` 5.0.0: BSD-3-Clause, MAPTILER-LICENSE.txt.
- Its MapLibre GL JS runtime/worker: BSD-3-Clause, MAPLIBRE-LICENSE.txt. Exact transitive versions are pinned in package-lock.json.
- Build `ui/map-sdk.js` using esbuild; retain bundled legal notices. SDK CSS and self-contained worker are copied from the pinned distribution by scripts/copy-map-assets.cjs. No remote worker/CDN code is executed.

Real Satellite Hybrid v4 is loaded from the project owner's MapTiler Cloud style URL in map-config.js, only after explicit page-session consent. SDK session accounting stays enabled; optional SDK telemetry and persistent SDK caching are disabled. MapTiler logo and provider/source attribution controls are retained. Satellite imagery is not current/live; resolution/date vary by provider/region. We do not redistribute, prefetch or offline-cache map imagery. Normal browser HTTP caching follows provider headers.

The public browser key must be restricted to the site's allowed origins in MapTiler Cloud. Never use a Telegram bot token, FINTEX ingest credential, MapTiler admin credential or private account token in map-config.js.

References checked while integrating:
- https://docs.maptiler.com/sdk-js/examples/how-to-use/
- https://docs.maptiler.com/sdk-js/api/map/
- https://www.maptiler.com/cloud/pricing/
- https://www.maptiler.com/copyright/

The real supplied style endpoint returned `Satellite Hybrid` with raster satellite and vector-label sources during integration. Browser automated tests intentionally use named synthetic styles, never present a mock background as a real satellite image, and do not test the live account's full tile coverage, quotas or domain restrictions.
