// Bundled locally: no SDK/CDN execution before the user opens a map.
import * as sdk from '@maptiler/sdk';
sdk.config.telemetry = false;
sdk.config.caching = false;
sdk.config.session = true;
sdk.setWorkerUrl(new URL('./assets/maps/maplibre-gl-worker.mjs', document.baseURI).href);
window.FintexMapSDK = sdk;
