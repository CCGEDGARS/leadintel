// Compatibility entry point when Vercel uses the repository root.
export {default,proxyRequest} from '../customer/api/backend.mjs';

// Every dossier HTTP request checkpoints one bounded provider pass.
export const config={supportsResponseStreaming:true,maxDuration:300};
