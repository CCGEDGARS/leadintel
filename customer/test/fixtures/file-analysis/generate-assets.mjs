import { writeFile, readFile, mkdir, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureFile } from './fixtures.mjs';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const target = resolve(here, '../../../vendor/file-analysis');
await mkdir(target, { recursive: true });
for (const format of ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'pptx']) {
  await writeFile(resolve(here, `fixture.${format}`), new Uint8Array(await (await fixtureFile(`fixture.${format}`)).arrayBuffer()));
}
for (const [name, version] of [['jszip', '3.10.1'], ['xml-js', '1.6.11']]) {
  await build({ entryPoints: [require.resolve(name === 'jszip' ? 'jszip/dist/jszip.min.js' : name)], bundle: true, platform: 'browser', format: 'esm', minify: true,
    legalComments: 'eof', outfile: resolve(target, `${name}-${version}.mjs`) });
  await copyFile(require.resolve(`${name}/LICENSE${name === 'jszip' ? '.markdown' : ''}`), resolve(target, `${name}-LICENSE`));
}
const xlsxRoot = dirname(require.resolve('xlsx'));
await copyFile(resolve(xlsxRoot, 'xlsx.mjs'), resolve(target, 'xlsx-0.20.3.mjs'));
await copyFile(resolve(xlsxRoot, 'dist/cpexcel.full.mjs'), resolve(target, 'cpexcel-0.20.3.mjs'));
await copyFile(resolve(xlsxRoot, 'LICENSE'), resolve(target, 'xlsx-LICENSE'));
const pdfRoot = dirname(require.resolve('pdfjs-dist/package.json'));
await copyFile(resolve(pdfRoot, 'build/pdf.min.mjs'), resolve(target, 'pdf-4.8.69.mjs'));
await copyFile(resolve(pdfRoot, 'build/pdf.worker.min.mjs'), resolve(target, 'pdf.worker-4.8.69.mjs'));
await copyFile(resolve(pdfRoot, 'LICENSE'), resolve(target, 'pdfjs-LICENSE'));
const { createHash } = await import('node:crypto');
const { readdir } = await import('node:fs/promises');
const checksums = {};
for (const name of (await readdir(target)).filter(name => /\.mjs$|-LICENSE$/.test(name)).sort()) {
  checksums[name] = createHash('sha256').update(await readFile(resolve(target, name))).digest('hex');
}
await writeFile(resolve(target, 'sha256.json'), JSON.stringify(checksums, null, 2) + '\n');
