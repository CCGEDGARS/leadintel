// Generated email rows: node scripts/sync-email-core-masters.cjs
export const coreScriptSeeds = [
  {
    "id": "email:professional",
    "channel": "email",
    "style": "professional",
    "name": "Professional Template",
    "subject": "{{senderFullName}}. {{senderCompany}}",
    "body": "Hi {{firstName}},\n\nI’m {{sender}} from {{company}}, {{sellerDescription}}. {{referenceUrl}}\n\nWe would like to be considered as a bidder for {{offer}} on {{projectTarget}}.\n\nSure, you may already be fully covered. If not, here is why we could be useful:\n\nReliable: {{reliabilityProof}}\nQuality: {{qualityProof}}\nSafety: {{safetyProof}}\nCost: {{costProof}}\n\nIf this is relevant, I’d be glad to discuss your requirements and where we could contribute to the project.\n\nHow about a short 20-minute Zoom call?\n\n{{calendly}}.\n\nBest regards,\n{{sender}}. {{company}}\n{{senderLinkedInUrl}}\n\nP.S. If this isn’t on your desk, I’d be grateful if you could point me to the right person.",
    "original": "Hi Joakim,\n\nI’m Edgars Untals from ERCON, a Latvian steel fabrication and installation company. https://www.ercon.lv/projects-manufacturing\n\nWe would like to be considered as a bidder for steel structures, platforms or installation work on your new  Malmberget plant.\n\nSure, you may already be fully covered. If not, here is why we could be useful:\n\nReliable: [real proof, or delete this line]\nQuality: EN 1090-1 certified, execution class [EXC2/EXC3]\nSafety: ISO 45001:2018 certified\nCost: [your cost basis, e.g. Baltic production rates with our own installation crews]\n\nIf this is relevant, I’d be glad to discuss your requirements and where we could contribute to the project.\n\nHow about a short 20-minute Zoom call?\n\nhttps://calendly.com/edgars-7go/strategy-call.\n\nBest regards,\nEdgars Untals. ERCON\nhttps://www.linkedin.com/in/edgarsuntals\n\nP.S. If this isn’t on your desk, I’d be grateful if you could point me to the right person.",
    "builtin": true,
    "revision": 0,
    "masterVersion": "20261017-professional-v1",
    "previousBuiltinBodies": [
      "Hi {{firstName}},\n\nI’m {{sender}} from {{company}}, a Latvian steel fabrication and installation company specialising in the Scandinavian market. {{proof}}\n\nWe would like to be considered as a bidder for steel structures, platforms or installation work on the {{development}}, either with LKAB directly or through NCC.\n\nYou may already be fully covered. If not, here is why we could be useful:\n\nReliable: {{reliabilityProof}} Quality: {{qualityProof}} Cost: {{costProof}}\n\nIf this is relevant, I’d be glad to discuss your requirements and where we could fit on a short 20-minute Zoom call {{calendly}}.\n\nBest regards, {{sender}} {{company}} {{sellerWebsite}} | {{senderLinkedInUrl}}\n\nP.S. If this isn’t on your desk, I’d be grateful if you could point me to the right person.",
      "Hi {{firstName}},\n\nI’m {{sender}} from {{company}}, {{sellerDescription}}. {{proof}}\n\nWe would like to be considered as a bidder for {{offer}} on {{projectDescription}}{{deliveryRoute}}.\n\nYou may already be fully covered. If not, here is why we could be useful:\n\nReliable: {{reliabilityProof}}\nQuality: {{qualityProof}}\nCost: {{costProof}}\n\nIf this is relevant, I’d be glad to discuss your requirements and where we could fit on a short 20-minute Zoom call {{calendly}}.\n\nBest regards,\n{{sender}}\n{{company}}\n{{sellerWebsite}} | {{senderLinkedInUrl}}\n\nP.S. If this isn’t on your desk, I’d be grateful if you could point me to the right person."
    ]
  },
  {
    "id": "email:curiosity",
    "channel": "email",
    "style": "curiosity",
    "name": "NLP Template",
    "subject": "Keep what works. Compare what’s possible.",
    "body": "Hi {{firstName}},\n\n{{milestoneWork}} in {{subjectProject}} is under way. The {{projectType}} is due to run in {{openingYear}}. And somewhere between those two dates, every {{deliveryItem}} has to arrive on time, fit the first time and stay within budget.\n\nThis is what we stand for. I’m {{sender}} from {{company}}, {{sellerDescription}}.\n\n{{proof}}\n\nYou may already be fully covered, and I’m not suggesting you change anything that works. Many project teams simply like to have one more qualified option ready before the {{workPackages}} go out, and that is what we would like to be.\n\nIf it makes sense, let’s take 20 minutes on Zoom.\n\nYou bring your requirements, I bring {{meetingValue}}, and you can judge for yourself whether there is a fit. {{calendly}}\n\nBest regards,\n{{sender}}\n{{company}}\n{{sellerWebsite}} | {{senderLinkedInUrl}}\n\nP.S. If this isn’t on your desk, I’d be grateful if you could point me to the right person.",
    "original": "Hi Joakim,\n\nFoundation work in Malmberget is under way. The new sorting plant is due to run in 2028. And somewhere between those two dates, every steel structure has to arrive on time, fit the first time and stay within budget.\n\nThis is what we stand for. I’m Edgars Untals from ERCON, a Latvian steel fabrication and installation company with more than 30 years in steel, specialising in the Scandinavian market.\n\n[Real reference: “Recently we delivered X for Y in Norway.”]\n\nYou may already be fully covered, and I’m not suggesting you change anything that works. Many project teams simply like to have one more qualified option ready before the steel packages go out, and that is what we would like to be.\n\nIf it makes sense, let’s take 20 minutes on Zoom.\n\nYou bring your requirements, I bring our production data and lessons from comparable projects, and you can judge for yourself whether there is a fit. [Calendly link]\n\nBest regards,\nEdgars Untals\nERCON\nwww.ercon.lv | linkedin.com/in/edgarsuntals\n\nP.S. If this isn’t on your desk, I’d be grateful if you could point me to the right person.",
    "builtin": true,
    "revision": 0,
    "masterVersion": "20261015-v4",
    "previousBuiltinBodies": [
      "Hi {{firstName}},\n\nFoundation work in {{subjectProject}} is under way. The new sorting plant is due to run in 2028. And somewhere between those two dates, every steel structure has to arrive on time, fit the first time and stay within budget.\n\nThis is what we stand for. I’m {{sender}} from {{company}}, a Latvian steel fabrication and installation company with more than 30 years in steel, specialising in the Scandinavian market.\n\n{{proof}}\n\nYou may already be fully covered, and I’m not suggesting you change anything that works. Many project teams simply like to have one more qualified option ready before the steel packages go out, and that is what we would like to be.\n\nIf it makes sense, let’s take 20 minutes on Zoom.\n\nYou bring your requirements, I bring our production data and lessons from comparable projects, and you can judge for yourself whether there is a fit. {{calendly}}\n\nBest regards, {{sender}} {{company}} {{sellerWebsite}} | {{senderLinkedInUrl}}\n\nP.S. If this isn’t on your desk, I’d be grateful if you could point me to the right person.",
      "Hi {{firstName}},\n\n{{development}}\n\nThis is what we stand for. I’m {{sender}} from {{company}}, {{sellerDescription}}.\n\n{{proof}}\n\nYou may already be fully covered, and I’m not suggesting you change anything that works. Many project teams simply like to have one more qualified option ready before the {{workPackages}} go out, and that is what we would like to be.\n\nIf it makes sense, let’s take 20 minutes on Zoom.\n\nYou bring your requirements, I bring {{meetingValue}}, and you can judge for yourself whether there is a fit. {{calendly}}\n\nBest regards,\n{{sender}}\n{{company}}\n{{sellerWebsite}} | {{senderLinkedInUrl}}\n\nP.S. If this isn’t on your desk, I’d be grateful if you could point me to the right person."
    ]
  },
  {
    "id": "email:friendly",
    "channel": "email",
    "style": "friendly",
    "name": "Friendly Template",
    "subject": "What could we build together?",
    "body": "Hi {{firstName}},\n\nCongratulations on getting {{friendlyMilestoneWork}} started in {{subjectProject}}.{{friendlyScale}}\n\nI’m {{senderFirstName}} from {{company}}, {{sellerDescription}}. For {{experienceDuration}} we’ve worked on the less glamorous part of projects like yours: {{experienceOutcome}}.\n\n{{proof}}\n\nI don’t know whether you need us. You may be fully covered, and if so, good. But if an extra pair of reliable hands for {{offer}} would make {{projectPeriod}} a little calmer, we would be happy to assist.\n\nWould you be open to a 20-minute chat on Zoom?\n\nI’ll bring {{meetingValue}}, and you can share what your team needs. No slides. {{calendly}}\n\nWarm regards,\n{{sender}}\n{{company}}\n{{sellerWebsite}} | {{senderLinkedInUrl}}\n\nP.S. If {{referralFocus}} sits with someone else, I’d be grateful for a pointer in the right direction.",
    "original": "Hi Joakim,\n\nCongratulations on getting the foundation work started in Malmberget. One of the largest buildings in LKAB’s history, north of the Arctic Circle, ready by 2028: impressive job.\n\nI’m Edgars from ERCON, a Latvian steel company. For more than 30 years we’ve worked on the less glamorous part of projects like yours: turning drawings into steel that arrives on time and fits.\n\n[Real reference: “Most recently, X for Y in Norway.”]\n\nI don’t know whether you need us. You may be fully covered, and if so, good. But if an extra pair of reliable hands for fabrication or installation would make your next two years a little calmer, we would be happy to assist.\n\nWould you be open to a 20-minute chat on Zoom?\n\nI’ll bring real numbers and a few lessons we learned the hard way, and you can share what your team needs. No slides. [Calendly link]\n\nWarm regards,\nEdgars Untals\nERCON\nwww.ercon.lv | linkedin.com/in/edgarsuntals\n\nP.S. If steelwork sits with someone else, I’d be grateful for a pointer in the right direction.",
    "builtin": true,
    "revision": 0,
    "masterVersion": "20261015-v4",
    "previousBuiltinBodies": [
      "Hi {{firstName}},\n\nCongratulations on getting the foundation work started in {{subjectProject}}. One of the largest buildings in LKAB’s history, north of the Arctic Circle, ready by 2028: impressive job.\n\nI’m {{sender}} from {{company}}, a Latvian steel company. For more than 30 years we’ve worked on the less glamorous part of projects like yours: turning drawings into steel that arrives on time and fits.\n\n{{proof}}\n\nI don’t know whether you need us. You may be fully covered, and if so, good. But if an extra pair of reliable hands for fabrication or installation would make your next two years a little calmer, we would be happy to assist.\n\nWould you be open to a 20-minute chat on Zoom?\n\nI’ll bring real numbers and a few lessons we learned the hard way, and you can share what your team needs. No slides. {{calendly}}\n\nWarm regards, {{sender}} {{company}} {{sellerWebsite}} | {{senderLinkedInUrl}}\n\nP.S. If steelwork sits with someone else, I’d be grateful for a pointer in the right direction.",
      "Hi {{firstName}},\n\n{{friendlyOpening}}\n\nI’m {{senderFirstName}} from {{company}}, {{sellerDescription}}. {{coreExperience}}\n\n{{proof}}\n\nI don’t know whether you need us. You may be fully covered, and if so, good. But if an extra pair of reliable hands for {{offer}} would make {{projectPeriod}} a little calmer, we would be happy to assist.\n\nWould you be open to a 20-minute chat on Zoom?\n\nI’ll bring {{meetingValue}}, and you can share what your team needs. No slides. {{calendly}}\n\nWarm regards,\n{{sender}}\n{{company}}\n{{sellerWebsite}} | {{senderLinkedInUrl}}\n\nP.S. If {{referralFocus}} sits with someone else, I’d be grateful for a pointer in the right direction."
    ]
  },
  {
    "id": "email:brutal",
    "channel": "email",
    "style": "brutal",
    "name": "Brutal Honesty",
    "subject": "LeadIntel. On behalf of {{sender}}",
    "body": "Hi {{firstName}},\n\nI should say this first: I’m LeadIntel, an AI-powered system. {{sender}} at {{company}} asked me to find projects where their work could be genuinely useful, and to write to the people behind them.\n\n{{subjectProject}}’s {{projectType}} came up. {{milestoneWork}} is under way, the {{projectNoun}} is due to run in {{openingYear}}, and a lot of {{deliveryMaterial}} has to arrive on time and fit before then.\n\n{{company}} is {{sellerDescription}}.\n\n{{proof}}\n\nI don’t know whether you need them. You may be fully covered. If not, here are three values {{company}} stands for: {{servicePriorities}}.\n\nIf it makes sense, let’s schedule 20 minutes on Zoom with {{senderFirstName}}.\n\nHe’ll bring {{meetingValue}}, and you can share your requirements. {{calendly}}\n\nI wrote the introduction. The conversation would be with a real human.\n\nLeadIntel, on behalf of {{sender}}\n{{company}}\n{{sellerWebsite}} | {{senderLinkedInUrl}}\n\nP.S. If {{referralFocus}} isn’t on your desk, a pointer to the right person would be much appreciated. {{senderFirstName}} will follow up personally.",
    "original": "Hi Joakim,\n\nI should say this first: I’m LeadIntel, an AI-powered system. Edgars Untals at ERCON asked me to find projects where their work could be genuinely useful, and to write to the people behind them.\n\nMalmberget’s new sorting plant came up. Foundation work is under way, the plant is due to run in 2028, and a lot of steel has to arrive on time and fit before then.\n\nERCON is a Latvian steel fabrication and installation company with more than 30 years in steel, specialising in the Scandinavian market.\n\n[Real reference: “Most recently, X for Y in Norway.”]\n\nI don’t know whether you need them. You may be fully covered. If not, here are three values ERCON stands for: reliable partnership, consistent quality and controlled costs.\n\nIf it makes sense, let’s schedule 20 minutes on Zoom with Edgars.\n\nHe’ll bring production data and lessons from comparable projects, and you can share your requirements. [Calendly link]\n\nI wrote the introduction. The conversation would be with a real human.\n\nLeadIntel, on behalf of Edgars Untals\nERCON\nwww.ercon.lv | linkedin.com/in/edgarsuntals\n\nP.S. If steelwork isn’t on your desk, a pointer to the right person would be much appreciated. Edgars will follow up personally.",
    "builtin": true,
    "revision": 0,
    "masterVersion": "20261015-v4",
    "previousBuiltinBodies": [
      "I should say this first: I’m LeadIntel, an AI-powered system. {{sender}} at {{company}} asked me to find projects where their work could be genuinely useful, and to write to the people behind them.\n\n{{subjectProject}}’s new sorting plant came up. Foundation work is under way, the plant is due to run in 2028, and a lot of steel has to arrive on time and fit before then.\n\n{{company}} is a Latvian steel fabrication and installation company with more than 30 years in steel, specialising in the Scandinavian market.\n\n{{proof}}\n\nI don’t know whether you need them. You may be fully covered. If not, here are three values {{company}} stands for: reliable partnership, consistent quality and controlled costs.\n\nIf it makes sense, let’s schedule 20 minutes on Zoom with {{senderFirstName}}.\n\nHe’ll bring production data and lessons from comparable projects, and you can share your requirements. {{calendly}}\n\nI wrote the introduction. The conversation would be with a real human.\n\nLeadIntel, on behalf of {{sender}} {{company}} {{sellerWebsite}} | {{senderLinkedInUrl}}\n\nP.S. If steelwork isn’t on your desk, a pointer to the right person would be much appreciated. {{senderFirstName}} will follow up personally.",
      "Hi {{firstName}},\n\nI should say this first: I’m LeadIntel, an AI-powered system. {{sender}} at {{company}} asked me to find projects where their work could be genuinely useful, and to write to the people behind them.\n\n{{development}}\n\n{{company}} is {{sellerDescription}}.\n\n{{proof}}\n\nI don’t know whether you need them. You may be fully covered. If not, here are three values {{company}} stands for: {{servicePriorities}}.\n\nIf it makes sense, let’s schedule 20 minutes on Zoom with {{senderFirstName}}.\n\nHe’ll bring {{meetingValue}}, and you can share your requirements. {{calendly}}\n\nI wrote the introduction. The conversation would be with a real human.\n\nLeadIntel, on behalf of {{sender}}\n{{company}}\n{{sellerWebsite}} | {{senderLinkedInUrl}}\n\nP.S. If {{referralFocus}} isn’t on your desk, a pointer to the right person would be much appreciated. {{senderFirstName}} will follow up personally."
    ]
  },
  {
    "id": "linkedin:professional",
    "channel": "linkedin",
    "style": "professional",
    "name": "Professional Template",
    "subject": "",
    "body": "Hi {{firstName}},\n\n{{developmentContext}}\n\nI’m {{sender}} from {{company}}. {{offer}} {{value}}\n\n{{proof}}\n\nWould you be open to a 20-minute Zoom conversation? {{meetingValue}}\n{{calendly}}",
    "original": "Hi {{firstName}},\n\n{{developmentContext}}\n\nI’m {{sender}} from {{company}}. {{offer}} {{value}}\n\n{{proof}}\n\nWould you be open to a 20-minute Zoom conversation? {{meetingValue}}\n{{calendly}}",
    "builtin": true,
    "revision": 0
  },
  {
    "id": "linkedin:curiosity",
    "channel": "linkedin",
    "style": "curiosity",
    "name": "NLP Template",
    "subject": "",
    "body": "Hi {{firstName}},\n\n{{developmentContext}} {{roleQuestion}}\n\nI’m {{sender}} from {{company}}. {{offer}}\n\nWhat could {{value}} mean for your team?\n\nLet’s compare your requirements in a 20-minute Zoom conversation. {{meetingValue}}\n{{calendly}}",
    "original": "Hi {{firstName}},\n\n{{developmentContext}} {{roleQuestion}}\n\nI’m {{sender}} from {{company}}. {{offer}}\n\nWhat could {{value}} mean for your team?\n\nLet’s compare your requirements in a 20-minute Zoom conversation. {{meetingValue}}\n{{calendly}}",
    "builtin": true,
    "revision": 0
  },
  {
    "id": "linkedin:friendly",
    "channel": "linkedin",
    "style": "friendly",
    "name": "Friendly Template",
    "subject": "",
    "body": "Hi {{firstName}},\n\n{{friendlyOpening}}\n\nI’m {{sender}} from {{company}}. {{offer}}\n\nIf {{value}} would be helpful, I’d enjoy a conversation. {{proof}}\n\nWould you have 20 minutes for a Zoom conversation? {{meetingValue}}\n{{calendly}}",
    "original": "Hi {{firstName}},\n\n{{friendlyOpening}}\n\nI’m {{sender}} from {{company}}. {{offer}}\n\nIf {{value}} would be helpful, I’d enjoy a conversation. {{proof}}\n\nWould you have 20 minutes for a Zoom conversation? {{meetingValue}}\n{{calendly}}",
    "builtin": true,
    "revision": 0
  }
];
