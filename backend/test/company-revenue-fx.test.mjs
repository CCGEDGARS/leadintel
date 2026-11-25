import test from 'node:test';
import assert from 'node:assert/strict';
import {annualEuroRate} from '../src/company-revenue-fx.js';

test('ECB conversion requires the exact annual DKK-per-EUR series and year',async()=>{
 const fetcher=async url=>{
  assert.equal(url.hostname,'data-api.ecb.europa.eu');
  return new Response('KEY,TIME_PERIOD,OBS_VALUE\nEXR.A.DKK.EUR.SP00.A,2024,7.46\nEXR.A.SEK.EUR.SP00.A,2025,11');
 };
 assert.equal((await annualEuroRate(2024,{fetcher})).rate,7.46);
 assert.equal(await annualEuroRate(2025,{fetcher}),null);
 assert.equal(await annualEuroRate(2025,{fetcher:async()=>new Response('',{status:502})}),null);
});
