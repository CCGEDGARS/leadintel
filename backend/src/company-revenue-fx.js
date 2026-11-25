// ECB series EXR.A.DKK.EUR.SP00.A is the calendar-year average in kroner per euro.
export async function annualEuroRate(year,{signal,fetcher=fetch}={}){
 const url=new URL('https://data-api.ecb.europa.eu/service/data/EXR/A.DKK.EUR.SP00.A');
 url.search=new URLSearchParams({startPeriod:String(year),endPeriod:String(year),format:'csvdata'});
 try{
  const response=await fetcher(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(5000)]):AbortSignal.timeout(5000)});
  if(!response.ok)return null;
  const [header,...rows]=(await response.text()).trim().split(/\r?\n/);
  // The fields used here precede any quoted descriptive metadata in the ECB's CSV.
  const columns=header.replace(/^\uFEFF/,'').split(',').map(v=>v.replaceAll('"',''));
  const at=(row,key)=>row[columns.indexOf(key)]?.replaceAll('"','');
  for(const line of rows){
   const row=line.split(','),rate=Number(at(row,'OBS_VALUE'));
   if(at(row,'KEY')==='EXR.A.DKK.EUR.SP00.A'&&at(row,'TIME_PERIOD')===String(year)&&Number.isFinite(rate)&&rate>0)return {rate,url:url.href};
  }
 }catch(e){if(signal?.aborted)throw e;}
 return null;
}
