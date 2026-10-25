(function(root){
 'use strict';
 // Official provider destinations only; these links never carry workspace data or credentials.
 const tools={
  openai:{name:'OpenAI',links:[['Get API key','https://platform.openai.com/api-keys'],['Billing & credits','https://platform.openai.com/settings/organization/billing/overview']]},
  anthropic:{name:'Anthropic',links:[['Get API key','https://platform.claude.com/settings/keys'],['Billing & credits','https://platform.claude.com/settings/billing']]},
  gemini:{name:'Google Gemini',links:[['Get API key','https://aistudio.google.com/api-keys'],['Billing & credits','https://aistudio.google.com/billing']]},
  apollo:{name:'Apollo.io',links:[['Get API key','https://app.apollo.io/#/settings/integrations/api'],['Pricing','https://www.apollo.io/pricing']]},
  firecrawl:{name:'Firecrawl',links:[['Get API key','https://www.firecrawl.dev/app/api-keys'],['Pricing','https://www.firecrawl.dev/pricing']]},
  treg:{name:'Treg',links:[['Open Treg','https://treg.to/']]},
  hunter:{name:'Hunter',links:[['Get API key','https://hunter.io/api-keys'],['Pricing','https://hunter.io/pricing']]},
  google:{name:'Google Account',links:[['Create Google account','https://accounts.google.com/signup']]},
  'microsoft-account':{name:'Microsoft Account',links:[['Create Microsoft account','https://signup.live.com/']]},
  gmail:{name:'Gmail',links:[['Create account','https://accounts.google.com/signup'],['Open Gmail','https://mail.google.com/']]},
  'microsoft-mail':{name:'Microsoft 365 Mail',links:[['Create account / plans','https://www.microsoft.com/en-us/microsoft-365/business/microsoft-365-plans-and-pricing'],['Open Microsoft 365','https://www.microsoft365.com/']]},
  calendly:{name:'Calendly',links:[['Get access token','https://calendly.com/integrations/api_webhooks'],['Pricing','https://calendly.com/pricing']]},
  'personal-linkedin':{name:'LinkedIn',links:[['Create account','https://www.linkedin.com/signup'],['Open LinkedIn','https://www.linkedin.com/']]},
  zoom:{name:'Zoom',links:[['Create Zoom account','https://zoom.us/signup'],['Zoom plans','https://zoom.us/pricing']]},
  teams:{name:'Microsoft Teams',links:[['Get Microsoft Teams','https://www.microsoft.com/en-us/microsoft-teams/free'],['Microsoft 365 plans','https://www.microsoft.com/en-us/microsoft-365/business/microsoft-365-plans-and-pricing']]},
  google_meet:{name:'Google Meet',links:[['Open Google Meet','https://meet.google.com/'],['Create Google account','https://accounts.google.com/signup']]}
 };
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function html(id){const tool=Object.hasOwn(tools,id)?tools[id]:null;if(!tool)return '';return `<nav class="tool-account-links" data-tool-links="${esc(id)}" aria-label="${esc(tool.name)} account and setup">${tool.links.map(([label,url])=>`<a class="ai-settings-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(tool.name+': '+label+' (opens in a new tab)')}">${esc(label)} ↗</a>`).join('')}</nav>`;}
 const api=Object.freeze({html});if(typeof module==='object'&&module.exports)module.exports=api;root.LeadIntelToolAccountLinks=api;
})(typeof globalThis==='object'?globalThis:this);
