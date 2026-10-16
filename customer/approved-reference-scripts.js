(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelApprovedReferences=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Source of truth: four owner-approved email DOCX documents uploaded 2026-10-15.
 // Examples contain unverified factual placeholders that must NOT become asserted facts.
 const records={
  "brutal": {
    "subject": "",
    "paragraphs": [
      "Hi Joakim,",
      "I should say this first: I’m LeadIntel, an AI-powered system. Edgars Untals at ERCON asked me to find projects where their work could be genuinely useful, and to write to the people behind them.",
      "Malmberget’s new sorting plant came up. Foundation work is under way, the plant is due to run in 2028, and a lot of steel has to arrive on time and fit before then.",
      "ERCON is a Latvian steel fabrication and installation company with more than 30 years in steel, specialising in the Scandinavian market.",
      "[Real reference: “Most recently, X for Y in Norway.”]",
      "I don’t know whether you need them. You may be fully covered. If not, here are three values ERCON stands for: reliable partnership, consistent quality and controlled costs.",
      "If it makes sense, let’s schedule 20 minutes on Zoom with Edgars.",
      "He’ll bring production data and lessons from comparable projects, and you can share your requirements. [Calendly link]",
      "I wrote the introduction. The conversation would be with a real human.",
      "LeadIntel, on behalf of Edgars Untals\nERCON\nwww.ercon.lv | linkedin.com/in/edgarsuntals",
      "P.S. If steelwork isn’t on your desk, a pointer to the right person would be much appreciated. Edgars will follow up personally."
    ],
    "subjects": [
      "LeadIntel. On behalf of Edgars"
    ]
  },
  "friendly": {
    "subject": "",
    "paragraphs": [
      "Hi Joakim,",
      "Congratulations on getting the foundation work started in Malmberget. One of the largest buildings in LKAB’s history, north of the Arctic Circle, ready by 2028: impressive job.",
      "I’m Edgars from ERCON, a Latvian steel company. For more than 30 years we’ve worked on the less glamorous part of projects like yours: turning drawings into steel that arrives on time and fits.",
      "[Real reference: “Most recently, X for Y in Norway.”]",
      "I don’t know whether you need us. You may be fully covered, and if so, good. But if an extra pair of reliable hands for fabrication or installation would make your next two years a little calmer, we would be happy to assist.",
      "Would you be open to a 20-minute chat on Zoom?",
      "I’ll bring real numbers and a few lessons we learned the hard way, and you can share what your team needs. No slides. [Calendly link]",
      "Warm regards,\nEdgars Untals\nERCON\nwww.ercon.lv | linkedin.com/in/edgarsuntals",
      "P.S. If steelwork sits with someone else, I’d be grateful for a pointer in the right direction."
    ],
    "subjects": [
      "A friendly hello about {{verifiedProject}}",
      "{{company}}. A long-term partnership?",
      "{{sender}}. {{company}}",
      "What could we build together?",
      "Congratulations on {{verifiedMilestone}}"
    ]
  },
  "professional": {
    "subject": "",
    "paragraphs": [
      "Hi Joakim,",
      "I’m Edgars Untals from ERCON, a Latvian steel fabrication and installation company specialising in the Scandinavian market. [Real reference: “Recently we delivered X for Y in Norway.”]",
      "We would like to be considered as a bidder for steel structures, platforms or installation work on the Malmberget sorting plant, either with LKAB directly or through NCC.",
      "You may already be fully covered. If not, here is why we could be useful:",
      "Reliable: [all X Scandinavian projects delivered on schedule]\nQuality: [certified to EN 1090 EXC3 / ISO 3834]\nCost: [Baltic production rates with our own installation crews]",
      "If this is relevant, I’d be glad to discuss your requirements and where we could fit on a short 20-minute Zoom call [Calendly link].",
      "Best regards,\nEdgars Untals\nERCON\nwww.ercon.lv | linkedin.com/in/edgarsuntals",
      "P.S. If this isn’t on your desk, I’d be grateful if you could point me to the right person."
    ],
    "subjects": [
      "Steel and installation for Malmberget",
      "Edgars Untals. Ercon",
      "Room for one more steel supplier?",
      "Malmberget steel – who should I ask?",
      "Malmberget: EXC2 or EXC3?"
    ]
  },
  "curiosity": {
    "subject": "",
    "paragraphs": [
      "Hi Joakim,",
      "Foundation work in Malmberget is under way. The new sorting plant is due to run in 2028. And somewhere between those two dates, every steel structure has to arrive on time, fit the first time and stay within budget.",
      "This is what we stand for. I’m Edgars Untals from ERCON, a Latvian steel fabrication and installation company with more than 30 years in steel, specialising in the Scandinavian market.",
      "[Real reference: “Recently we delivered X for Y in Norway.”]",
      "You may already be fully covered, and I’m not suggesting you change anything that works. Many project teams simply like to have one more qualified option ready before the steel packages go out, and that is what we would like to be.",
      "If it makes sense, let’s take 20 minutes on Zoom.",
      "You bring your requirements, I bring our production data and lessons from comparable projects, and you can judge for yourself whether there is a fit. [Calendly link]",
      "Best regards,\nEdgars Untals\nERCON\nwww.ercon.lv | linkedin.com/in/edgarsuntals",
      "P.S. If this isn’t on your desk, I’d be grateful if you could point me to the right person."
    ],
    "subjects": [
      "{{projectMilestone}}: {{deliveryAngle}}",
      "Keep what works. Compare what’s possible.",
      "{{sender}}. {{company}}",
      "If everything is on track, why talk?",
      "{{projectMilestone}}: another success story?"
    ]
  }
};
 for(const item of Object.values(records)){Object.freeze(item.paragraphs);Object.freeze(item.subjects);Object.freeze(item);}
 // Professional wording has one source; only these factual slots may vary.
 function approvedPattern(style){const record=records[style];if(!record)return '';let body=record.paragraphs.join('\n\n');for(const [from,to] of Object.entries(patternSlots[style]||{}).sort((a,b)=>b[0].length-a[0].length)){if(!body.includes(from))throw Error('Approved factual span is missing: '+style);body=body.split(from).join(to);}return body;}
 const patternSlots={
  "professional": {
    "a Latvian steel fabrication and installation company specialising in the Scandinavian market": "{{sellerDescription}}",
    "[Real reference: “Recently we delivered X for Y in Norway.”]": "{{proof}}",
    "steel structures, platforms or installation work": "{{offer}}",
    "the Malmberget sorting plant": "{{projectDescription}}",
    ", either with LKAB directly or through NCC": "{{deliveryRoute}}",
    "[all X Scandinavian projects delivered on schedule]": "{{reliabilityProof}}",
    "[certified to EN 1090 EXC3 / ISO 3834]": "{{qualityProof}}",
    "[Baltic production rates with our own installation crews]": "{{costProof}}",
    "Hi Joakim,": "Hi {{firstName}},",
    "Edgars Untals": "{{sender}}",
    "ERCON": "{{company}}",
    "[Calendly link]": "{{calendly}}",
    "www.ercon.lv": "{{sellerWebsite}}",
    "linkedin.com/in/edgarsuntals": "{{senderLinkedInUrl}}"
  },
  "curiosity": {
    "Foundation work in Malmberget is under way. The new sorting plant is due to run in 2028. And somewhere between those two dates, every steel structure has to arrive on time, fit the first time and stay within budget.": "{{development}}",
    "a Latvian steel fabrication and installation company with more than 30 years in steel, specialising in the Scandinavian market": "{{sellerDescription}}",
    "[Real reference: “Recently we delivered X for Y in Norway.”]": "{{proof}}",
    "steel packages": "{{workPackages}}",
    "our production data and lessons from comparable projects": "{{meetingValue}}",
    "Hi Joakim,": "Hi {{firstName}},",
    "Edgars Untals": "{{sender}}",
    "ERCON": "{{company}}",
    "[Calendly link]": "{{calendly}}",
    "www.ercon.lv": "{{sellerWebsite}}",
    "linkedin.com/in/edgarsuntals": "{{senderLinkedInUrl}}"
  },
  "friendly": {
    "Congratulations on getting the foundation work started in Malmberget. One of the largest buildings in LKAB’s history, north of the Arctic Circle, ready by 2028: impressive job.": "{{friendlyOpening}}",
    "a Latvian steel company": "{{sellerDescription}}",
    "For more than 30 years we’ve worked on the less glamorous part of projects like yours: turning drawings into steel that arrives on time and fits.": "{{coreExperience}}",
    "I’m Edgars from": "I’m {{senderFirstName}} from",
    "[Real reference: “Most recently, X for Y in Norway.”]": "{{proof}}",
    "fabrication or installation": "{{offer}}",
    "your next two years": "{{projectPeriod}}",
    "real numbers and a few lessons we learned the hard way": "{{meetingValue}}",
    "steelwork": "{{referralFocus}}",
    "Hi Joakim,": "Hi {{firstName}},",
    "Edgars Untals": "{{sender}}",
    "ERCON": "{{company}}",
    "[Calendly link]": "{{calendly}}",
    "www.ercon.lv": "{{sellerWebsite}}",
    "linkedin.com/in/edgarsuntals": "{{senderLinkedInUrl}}"
  },
  "brutal": {
    "Malmberget’s new sorting plant came up. Foundation work is under way, the plant is due to run in 2028, and a lot of steel has to arrive on time and fit before then.": "{{development}}",
    "a Latvian steel fabrication and installation company with more than 30 years in steel, specialising in the Scandinavian market": "{{sellerDescription}}",
    "[Real reference: “Most recently, X for Y in Norway.”]": "{{proof}}",
    "reliable partnership, consistent quality and controlled costs": "{{servicePriorities}}",
    "production data and lessons from comparable projects": "{{meetingValue}}",
    "Edgars": "{{senderFirstName}}",
    "steelwork": "{{referralFocus}}",
    "Hi Joakim,": "Hi {{firstName}},",
    "Edgars Untals": "{{sender}}",
    "ERCON": "{{company}}",
    "[Calendly link]": "{{calendly}}",
    "www.ercon.lv": "{{sellerWebsite}}",
    "linkedin.com/in/edgarsuntals": "{{senderLinkedInUrl}}"
  }
};
 function professionalPattern(){return approvedPattern('professional');}
 function originalText(style){const item=records[style];return item?(item.subject?'Subject: '+item.subject+'\n':'')+item.paragraphs.join('\n\n'):'';}
 // Policy metadata is separate from the verbatim source. Never edit source wording to fit policy.
 const paragraphRoles={"brutal":["source paragraph 1","source paragraph 2","source paragraph 3","source paragraph 4","source paragraph 5","source paragraph 6","source paragraph 7","source paragraph 8","source paragraph 9","source paragraph 10","source paragraph 11"],"friendly":["source paragraph 1","source paragraph 2","source paragraph 3","source paragraph 4","source paragraph 5","source paragraph 6","source paragraph 7","source paragraph 8","source paragraph 9"],"professional":["source paragraph 1","source paragraph 2","source paragraph 3","source paragraph 4","source paragraph 5","source paragraph 6","source paragraph 7","source paragraph 8"],"curiosity":["source paragraph 1","source paragraph 2","source paragraph 3","source paragraph 4","source paragraph 5","source paragraph 6","source paragraph 7","source paragraph 8","source paragraph 9"]};
 const coreContracts=Object.freeze(Object.fromEntries(Object.entries(records).map(([style,record])=>[style,Object.freeze({
  version:'email-master-20261015-v3',style,channel:'email',aiAuthority:'designated-fields-only',
  paragraphRoles:Object.freeze(paragraphRoles[style]),paragraphSeparator:'\n\n',signatureSeparator:'\n',
  maximumMessageWords:record.paragraphs.join(' ').trim().split(/\s+/).length,meetingMinutes:20,
  literalWording:'verbatim outside declared slots',unsupportedFacts:'declared omission or fallback only; never guess',
  aiFields:Object.freeze(['triggerSummary','offer','value','difference','approach','meetingValue']),
  sourcePolicy:'current workspace approved seller facts and reviewed/source-verified buyer evidence only',
  rewritePolicy:'explicit alternative preview; never modify the master or first tailored original'
 })])));
 function coreContract(style){return coreContracts[style]||null;}
 return Object.freeze({records:Object.freeze(records),originalText,approvedPattern,professionalPattern,coreContract});
});
