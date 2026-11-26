// Keep explicit roles when resolving Automatic, including when the active
// workspace engine is already assigned to the independent second pass.
export function researchProviderPair(connected,primary,secondary,active){
 const main=primary||[active,...connected].find(provider=>provider!==secondary&&connected.includes(provider));
 const second=secondary||connected.find(provider=>provider!==main);
 return {main,second};
}
