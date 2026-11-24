# FINTEX Capture

A green floating in-app scan button on Home, above navigation. It is hidden on other tabs, onboarding and under existing modals. It is not an OS overlay and never reads notifications, other apps or the clipboard in the background.

## Inputs

- **Сфотографировать**: native image file picker with `capture="environment"`; the phone controls camera permissions and the exact picker UI.
- **Выбрать скриншот**: image from the gallery, receipt/bank recognition selected from its contents.
- **Загрузить чек**: image or one-page PDF.
- **Распознать операцию**: bank notification or operation screenshot, always reviewed.

Files: up to 15 MB, images up to 25 MP, downscaled before QR/OCR. Long/multi-operation images should be cropped. Only RUB is supported; known foreign-currency markers block saving. HEIC support depends on the browser; unsupported files show an error rather than creating a record. Multi-page PDFs are explicitly rejected rather than silently reading only page one.

## Recognition and confidence

Capture reuses the existing receipt and bank parsers, and runs local Tesseract.js (rus+eng), jsQR, and a local PDF.js reader. Files are not sent to an OCR server. Network is needed for initial/uncached site assets. OCR confidence is text quality, **not** a calibrated probability that a financial operation is correct. Missing bank names remain unknown, never copied from settings.

Optional auto-entry is enabled by default and can be disabled in the menu. It only applies to a single-fragment receipt with:

- full fiscal identity (FN/document number/fiscal sign), explicitly sale operation `n=1`;
- valid non-future date;
- identical amount in QR and an explicit OCR total;
- text confidence at least 92 and no uncertain/inferred fields;
- identified merchant, not the generic fallback;
- no duplicate or detected foreign currency.

This is corroboration of QR and printed text, **not a validation with the tax authority** and not a guarantee against OCR errors. Native PDF text is reviewed because no OCR confidence is invented. Bank screenshots, incomes, refunds and transfers always require confirmation. Review fields are editable: bank, purpose, amount, date, time, direction/type. Own-account transfers should not be recorded as income/expense of total capital; the form warns about this limitation of the current ledger.

## Saving and duplicates

One synchronous commit through `addOrMergeTransactions`, preserving cents, calendar, analytics and the existing sync queue. OCR account balances do not overwrite the actual balance. Full-file SHA-256 (not a prefix), fiscal identity, existing scanner archives and matching transaction fields prevent repeat entry. Ambiguous matching records are blocked conservatively; automatic recognition does not claim perfect deduplication across arbitrarily edited images. Fingerprint archive is capped at 1000 and only applies while the referenced local transaction exists. Financial ledger deduplication remains active after that limit.

Capture does not persist raw text or image files. It keeps minimal fingerprint/transaction metadata, bank, text-confidence and receipt archive fields. Existing financial records remain local/plaintext. Cloud sync uses the existing optional mechanism; this feature does not fix or replace server deployment. Existing cloud deletion/conflict limitations still apply.

Cancel/close increments the job generation and terminates an active OCR worker. Late OCR results cannot write records. Timeouts and load/parse errors return to a recoverable screen with no new record. A completed save cannot be undone by closing the already-completed screen.

## Verification

Pure policy tests cover matching QR, refunds/transfers, missing confidence, mismatched totals, invalid dates, currencies and duplicates. Browser tests cover the menu, actual file inputs, review/edit/save, cancellation, duplicates and auto-entry preferences. Real local engine tests read a generated Russian bank-notification PNG and a generated one-page PDF with external hosts blocked. Other boundary/UI tests use controlled OCR/QR responses. Physical iPhone camera permission UX and real-world crumpled/blurred receipts still require device testing.

Preview uses synthetic local data: `capture-menu-preview.png`.
