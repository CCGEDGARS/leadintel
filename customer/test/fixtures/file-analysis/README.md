# General file analysis fixtures

Install the exact offline-test dependencies once from the repository root:

```sh
npm ci --prefix customer/test/fixtures/file-analysis --ignore-scripts
node --test customer/test/copilot-file-extractors.test.mjs
node --test customer/test/*.test.mjs
```

`fixtures.mjs` constructs all six fixtures deterministically in memory. PDF uses a real two-page PDF object tree and cross-reference table. DOCX and PPTX are OOXML ZIP packages with document relationships. XLSX and legacy OLE/BIFF8 XLS are written by SheetJS. CSV contains RFC-style quoted-text records. Each fixture has its own format-specific marker and source location.

The tests inject actual pinned PDF.js, JSZip, xml-js and SheetJS libraries; no test calls a CDN. The six named binary/text fixture files are committed alongside auditable constructors. `generate-assets.mjs` reproducibly writes these fixtures and the repository-hosted parser bundles. `fixtureFile('fixture.pdf')` (and the other five extensions) returns equivalent genuine format bytes.

Production loads the same library versions lazily from `customer/vendor/file-analysis/`; there are no runtime CDN imports. The default-loader smoke tests use those actual vendored modules. SheetJS uses the authoritative 0.20.3 release rather than the older npm registry build; the customer-list importer is unchanged. The documented xml-js deviation from Mammoth preserves paragraph, heading and table locations by parsing inert OOXML without rendering generated HTML.

CSV treats the first non-empty record as the header (not a data row). Source row locators refer to physical lines, including quoted multiline fields. CSV accepts UTF-8, BOM-marked UTF-16, or a disclosed Windows-1252 fallback. Formula-like CSV fields are replaced with an omission marker; spreadsheet formula source is never emitted or evaluated, only cached displayed values.

Large spreadsheet/CSV inputs select deterministic early, middle and late populated ranges at the 50,000-cell / 20,000-data-row ceilings, then group contiguous ranges after the first 100 rows. Word selection prioritizes source headings, summaries and populated tables, with reserved representative document windows. PDF outlines prioritize up to 24 heading/summary destinations; representative page windows fill the remaining 120-page parser budget. PowerPoint uses the same 120-slide representative budget. Character budgeting trims large lower-priority blocks first, retaining small summary/table evidence. Coverage records disjoint omitted ranges separately, rather than reporting an entire span that contains retained material.

Parser resource ceilings are separate from output limits: 4,096 ZIP entries, 20 MiB per declared expanded entry and 60 MiB aggregate declared expansion; ZIP64/multi-volume archives fail safely. XML streams enforce actual expansion limits even when archive metadata understates sizes: 4,000,000 characters per part and 8,000,000 characters across consumed parts. Before recursive parsing, XML is checked for 250,000 nodes and depth 64. CSV scans at most 300,000 records with 1,000,000-character fields and 10,000 parsed columns; delimiter detection stops after 20 sample records, then only selected record metadata is decoded into retained rows. Spreadsheet parsing accepts at most 200,000 discovered cells and formats only selected representatives. Browser parsing runs in a module worker with a 15-second hard termination deadline, protecting the UI even inside a synchronous third-party parser; browsers without worker support fail safely rather than parse on the UI thread.

Adapter coverage also reports the contract's 1,000-block/1,000-column bounds, the aggregate 250,000-character bound, image-only PDF pages, and removed objects. Evidence labels are intentionally empty because the stable locator itself is the source label. OCR and embedded-object rendering are not provided.
