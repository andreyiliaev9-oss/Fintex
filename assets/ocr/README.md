# Local Capture engines

These runtime assets are intentionally shipped with the static Mini App: receipt images are processed in the browser, not sent to an OCR service. No paid API or key is required.

- Tesseract.js 5.1.1 (`npm tesseract.js`), worker, and non-SIMD LSTM core (`npm tesseract.js-core`, exact resolved version in package-lock.json). The `.wasm.js` core embeds WebAssembly and works without loading a separate binary.
- jsQR 1.4.0 (`npm jsqr`).
- PDF.js 5.4.449 (`npm pdfjs-dist` legacy browser modules), lazy-loaded by Capture. PDF JavaScript evaluation is disabled. Only single-page PDFs are accepted.
- Russian and English fast trained data from https://github.com/naptha/tessdata/tree/gh-pages/4.0.0_fast (retrieved through the GitHub contents API). Git blob IDs at retrieval: eng `1760dd17b82cb60eb574332001de306e2a0b4368`; rus `d3b19e9c0a6e4c948e45a11da1e4c4851effbf72`. These committed compressed language resources are needed at runtime, not generated test data.

Adjacent LICENSE files apply. `npm run build` reproduces the npm-based copies using `scripts/copy-capture-assets.cjs`; the language files and their license are preserved. No source maps are needed at runtime. Assets are approximately 9 MB, with language/core/PDF resources fetched on demand. There is no service-worker offline guarantee: first load and uncached assets need a network connection to the site.

The legacy scanner outside Capture still has its older PDF loading path; Capture imports its own version and explicitly sets local worker, core and language paths.
