module.exports=async function openCompanySearchHistory(page){
 for(const selector of ['#prior-company-search','#cl-previous-search']){
  const details=page.locator(selector);
  await details.locator(':scope > summary').waitFor();
  if(!await details.evaluate(element=>element.open))await details.locator(':scope > summary').click();
 }
};
