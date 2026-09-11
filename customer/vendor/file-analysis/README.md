# Repository-hosted browser parsers

These immutable, version-named assets eliminate runtime CDN imports. The default extractor loads only these same-origin ES modules. PDF.js loads its matching same-origin worker. SheetJS loads its matching codepage table for legacy XLS encodings.

Pinned sources: JSZip 3.10.1, xml-js 1.6.11, SheetJS 0.20.3 (authoritative vendor distribution), PDF.js 4.8.69. License files and SHA-256 checksums are included. JSZip's browser distribution and xml-js are bundled as ESM using esbuild 0.25.12; SheetJS and PDF.js modules are copied unchanged.

Regenerate after installing the fixture package lock:

```sh
npm ci --prefix customer/test/fixtures/file-analysis --ignore-scripts
node customer/test/fixtures/file-analysis/generate-assets.mjs
```

The XML parser is a deliberate deviation from the proposed Mammoth implementation. Direct inert OOXML traversal preserves exact source headings, paragraph groups, tables and slide relationships without generating or rendering HTML. External entities and active-content relationships are rejected; embedded object subtrees are excluded.

To exercise the actual browser loader, serve the repository over HTTP and open `customer/test/copilot-file-browser-smoke.html`. Select **Run all six formats**. This smoke page uses the committed binary fixtures, no injected dependencies, no network mocks, and a same-origin-only Content Security Policy. All six formats must pass with zero CSP violations.
