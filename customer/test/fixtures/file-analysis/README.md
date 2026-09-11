# General file analysis fixtures

Install the exact offline-test dependencies once from the repository root:

```sh
npm ci --prefix customer/test/fixtures/file-analysis --ignore-scripts
node --test customer/test/copilot-file-extractors.test.mjs
node --test customer/test/*.test.mjs
```

`fixtures.mjs` constructs all six fixtures deterministically in memory. PDF uses a real two-page PDF object tree and cross-reference table. DOCX and PPTX are OOXML ZIP packages with document relationships. XLSX and legacy OLE/BIFF8 XLS are written by SheetJS. CSV contains RFC-style quoted-text records. Each fixture has its own format-specific marker and source location.

The tests inject actual pinned PDF.js, JSZip, xml-js and SheetJS libraries; no test calls a CDN. Keeping constructors as text makes fixture contents auditable without committing opaque binaries. `fixtureFile('fixture.pdf')` (and the other five extensions) returns a genuine `File` containing format bytes.

Production loads the same library versions lazily. SheetJS uses the authoritative 0.20.3 release rather than the older npm registry build; the customer-list importer is unchanged. Word is parsed directly from OOXML to preserve paragraph, heading and table locations without rendering generated HTML.

CSV treats the first non-empty record as the header (not a data row). Source row locators refer to physical lines, including quoted multiline fields. CSV accepts UTF-8, BOM-marked UTF-16, or a disclosed Windows-1252 fallback. Formula-like CSV fields are replaced with an omission marker; spreadsheet formula source is never emitted or evaluated, only cached displayed values.

Large contiguous spreadsheet/CSV ranges are grouped after their first 100 rows. Adapter coverage reports the contract's 1,000-block/1,000-column bounds, the product's 50,000-cell/20,000-data-row/250,000-character bounds, image-only PDF pages, and removed objects. Evidence labels are intentionally empty because the stable locator itself is the source label. OCR and embedded-object rendering are not provided.
