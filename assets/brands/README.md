# Bundled identification marks

164 SVGs, used for name-based visual identification only. No endorsement,
affiliation, issuer/network confirmation or guarantee of current brand identity.
Unknown companies use category icons. Never send transaction names to a logo API.

`SOURCES.json` is the per-file attribution/provenance manifest: pinned upstream
revision/version, original URL, collection, license information and SHA-256.
Files retain upstream SVG artwork; Simple Icons paths receive their published
brand hex as `fill`. Filenames are local catalogue IDs. Payment files with `si-`
IDs may originate in the payment collection after a full-colour replacement;
the manifest, not the prefix, is authoritative.

- Russian Brand Logos, revision 8beb626617ea1a596a57d471440b4482ca97e3e6:
  `RUSSIAN-NOTICE.md`, `RUSSIAN-CODE-LICENSE.txt`. Its MIT code license does NOT
  license the logos/trademarks. Marks are retained for reference identification.
- Simple Icons 16.38.1: `SIMPLE-ICONS-LICENSE.md` (CC0 collection).
- SVG Credit Card & Payment Icons by Aaron Fagan, revision
  6dd023ae32415ed7b01bf809f15a25613a52098c: `PAYMENT-ICONS-LICENSE.txt`
  (Apache-2.0). Artwork is unchanged, except final newline/local filename.

Trademark rights remain with their respective owners. Inclusion in an upstream
collection does not independently establish permission from the trademark owner.
Review those rights and upstream provenance before distributing or extending this
catalogue; do not describe these assets as universally permission-cleared.

To add a brand: bundle a reviewed SVG (no scripts, events, text substitutes or
external resources), add its immutable provenance/hash and license notice, add a
catalogue entry/aliases, then run `npm run build`, `npm test` and the brand UI suite.
Do not infer card network from a bank or use this display matcher to edit finances.
