import { extractCopilotFile } from './copilot-file-extractors.js';

self.onmessage = async event => {
  try {
    const { name, type, bytes } = event.data;
    const result = await extractCopilotFile(new File([bytes], name, { type }));
    self.postMessage({ ok: true, result });
  } catch (error) {
    self.postMessage({ ok: false, error: String(error?.message || 'File extraction failed.').slice(0, 500) });
  }
};
