import {readFile,mkdir,writeFile,access} from 'node:fs/promises';
import {parseArgs} from 'node:util';import {resolve,extname,join} from 'node:path';
import {extractServer} from '../src/writing-reference-validation.js';
import {bookAnalysisWork} from '../src/book-method-analysis.js';
import {BOOK_METHODS_VERSION} from '../src/workspace-skill-plan.js';
import {defaultAiModel} from '../src/ai-provider.js';
import {compareBookProviders} from '../src/book-provider-benchmark.js';
try{
 const {values}=parseArgs({options:{book:{type:'string'},out:{type:'string'},'confirm-cost':{type:'boolean'}}});
 if(!values['confirm-cost']||!values.book||!values.out)throw Error('Usage: node scripts/compare-book-providers.mjs --book /path/book.pdf --out /private/report-directory --confirm-cost. This sends representative book sections to all three providers and can incur API charges.');
 const keys={openai:'OPENAI_API_KEY',anthropic:'ANTHROPIC_API_KEY',gemini:'GEMINI_API_KEY'};
 const credentials=Object.entries(keys).map(([provider,key])=>({provider,model:process.env[provider.toUpperCase()+'_BOOK_MODEL']||defaultAiModel(provider),apiKey:process.env[key]}));
 if(credentials.some(c=>!c.apiKey))throw Error('All three API credentials must be available in the process environment; no requests were started.');
 const filename=resolve(values.book),mime={'.pdf':'application/pdf','.txt':'text/plain','.md':'text/markdown','.markdown':'text/markdown'}[extname(filename).toLowerCase()];if(!mime)throw Error('Choose a PDF, TXT or Markdown book.');
 const output=resolve(values.out);await mkdir(output,{recursive:true,mode:0o700});
 const target=join(output,'book-provider-comparison-'+Date.now()+'.json');try{await access(target);throw Error('Report already exists.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const extracted=await extractServer(new Uint8Array(await readFile(filename)),mime);extracted.coverage.methodPlan=BOOK_METHODS_VERSION;
 const report=await compareBookProviders({workItems:bookAnalysisWork(extracted),credentials});
 await writeFile(target,JSON.stringify({...report,createdAt:new Date().toISOString(),coverage:extracted.coverage},null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({report:target,requests:report.results.length,valid:report.results.filter(r=>r.status==='valid').length,semanticReview:'required'}));
}catch(error){console.error(error.message?.startsWith('Usage:')||/API credentials|Choose a|Readable book|Report already exists/.test(error.message||'')?error.message:'Comparison failed. Check the local file, output directory and provider connections. No private error details were printed.');process.exitCode=1;}
