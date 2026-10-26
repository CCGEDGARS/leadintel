// Owner-supplied LinkedIn InMail sources, 15 October 2026. Originals are verbatim; patterns replace only declared factual slots.
(function(root){
'use strict';
const records=[
  {
    "id": "linkedin-inmail:professional",
    "channel": "linkedin",
    "mode": "inmail",
    "style": "professional",
    "name": "Professional",
    "subject": "{{offerLabel}} – {{projectShortName}}",
    "body": "Hi {{firstName}},\n\nI’m {{sender}} from {{company}}, {{sellerDescription}}. {{proof}}\n\nWe’d like to be considered as a bidder for {{offer}} on the {{project}}, with {{projectRoute}}.\n\nWhy us:– Reliable: {{reliabilityProof}}– Quality: {{qualityProof}}– Cost: {{costProof}}\n\nYou may be fully covered. If not, would a 20-minute Zoom make sense?\n\nIf {{serviceFocus}} isn’t on your desk, who should I ask?\n\n{{sender}}",
    "stages": [
      {
        "id": "initial",
        "title": "Initial InMail",
        "condition": "Day 0 · review profile and facts before copying",
        "subject": "{{offerLabel}} – {{projectShortName}}",
        "body": "Hi {{firstName}},\n\nI’m {{sender}} from {{company}}, {{sellerDescription}}. {{proof}}\n\nWe’d like to be considered as a bidder for {{offer}} on the {{project}}, with {{projectRoute}}.\n\nWhy us:– Reliable: {{reliabilityProof}}– Quality: {{qualityProof}}– Cost: {{costProof}}\n\nYou may be fully covered. If not, would a 20-minute Zoom make sense?\n\nIf {{serviceFocus}} isn’t on your desk, who should I ask?\n\n{{sender}}",
        "originalSubject": "Steel packages – Malmberget",
        "originalBody": "Hi Joakim,\n\nI’m Edgars from ERCON, a Latvian steel fabrication and installation company working across Scandinavia. [Reference: “Recently X for Y in Norway.”]\n\nWe’d like to be considered as a bidder for steel structures, platforms or installation on the Malmberget sorting plant, with LKAB or through NCC.\n\nWhy us:– Reliable: [on-time record]– Quality: [EN 1090 / ISO 3834]– Cost: [Baltic rates, own crews]\n\nYou may be fully covered. If not, would a 20-minute Zoom make sense?\n\nIf steel isn’t on your desk, who should I ask?\n\nEdgars"
      },
      {
        "id": "connection",
        "title": "Connection request",
        "condition": "Day 4–5 · only if there is no reply",
        "subject": "",
        "body": "Hi {{firstName}}, I sent you a short InMail about {{offerLabel}} for the {{project}}. Glad to connect either way. {{sender}}, {{company}}",
        "originalBody": "Hi Joakim, I sent you a short InMail about steel packages for the Malmberget sorting plant. Glad to connect either way. Edgars, ERCON"
      },
      {
        "id": "followup",
        "title": "After acceptance",
        "condition": "Only after the connection request is accepted",
        "subject": "",
        "body": "Hi {{firstName}}, a short follow-up on {{projectShortName}}. If {{offerLabel}} sit with someone else, {{projectRoute}}, a name is all I need. Thank you.",
        "originalBody": "Hi Joakim, a short follow-up on Malmberget. If the steel packages sit with someone else, at LKAB or NCC, a name is all I need. Thank you."
      },
      {
        "id": "calendar",
        "title": "After interest",
        "condition": "Only after the recipient says yes",
        "subject": "",
        "body": "Great. Here is my calendar, pick whatever suits you: {{calendly}}",
        "originalBody": "Great. Here is my calendar, pick whatever suits you: [Calendly link]"
      }
    ],
    "original": "PROFESSIONAL – LINKEDIN (PAID ACCOUNT)\nBefore sending: read his profile. If his title shows he owns steel packages, delete the routing line. Send manually, Tuesday to Thursday morning.\nSTEP 1 – InMail (day 0)\nSubject: Steel packages – Malmberget\nHi Joakim,\nI’m Edgars from ERCON, a Latvian steel fabrication and installation company working across Scandinavia. [Reference: “Recently X for Y in Norway.”]\nWe’d like to be considered as a bidder for steel structures, platforms or installation on the Malmberget sorting plant, with LKAB or through NCC.\nWhy us:– Reliable: [on-time record]– Quality: [EN 1090 / ISO 3834]– Cost: [Baltic rates, own crews]\nYou may be fully covered. If not, would a 20-minute Zoom make sense?\nIf steel isn’t on your desk, who should I ask?\nEdgars\n[90 words, 535 characters]\nWHEN HE SAYS YES – send the Calendly link\nGreat. Here is my calendar, pick whatever suits you: [Calendly link]\nSTEP 2 – Connection request, day 4–5, only if there is no reply\nHi Joakim, I sent you a short InMail about steel packages for the Malmberget sorting plant. Glad to connect either way. Edgars, ERCON\n[133 characters]\nSTEP 3 – Follow-up once he accepts (free, no credit)\nHi Joakim, a short follow-up on Malmberget. If the steel packages sit with someone else, at LKAB or NCC, a name is all I need. Thank you.",
    "sourceFile": "PROFESSIONAL_LINKEDIN.docx",
    "sourceSha256": "e67eccc020cea0d47ee43eec2ab27aa8a1274909e4604bda15fb123bbef1e80c",
    "revision": 0,
    "builtin": false,
    "masterVersion": "inmail-facts-20261016-v2",
    "previousBuiltinStages": [
      [
        {
          "id": "initial",
          "title": "Initial InMail",
          "condition": "Day 0 · review profile and facts before copying",
          "subject": "{{offerLabel}} – {{projectShortName}}",
          "body": "Hi {{firstName}},\n\nI’m {{sender}} from {{company}}, {{sellerDescription}}. {{proof}}\n\nWe’d like to be considered as a bidder for {{offer}} on the {{project}}, with {{projectRoute}}.\n\nWhy us:– Reliable: {{reliabilityProof}}– Quality: {{qualityProof}}– Cost: {{costProof}}\n\nYou may be fully covered. If not, would a 20-minute Zoom make sense?\n\nIf {{serviceFocus}} isn’t on your desk, who should I ask?\n\n{{sender}}",
          "originalSubject": "Steel packages – Malmberget",
          "originalBody": "Hi Joakim,\n\nI’m Edgars from ERCON, a Latvian steel fabrication and installation company working across Scandinavia. [Reference: “Recently X for Y in Norway.”]\n\nWe’d like to be considered as a bidder for steel structures, platforms or installation on the Malmberget sorting plant, with LKAB or through NCC.\n\nWhy us:– Reliable: [on-time record]– Quality: [EN 1090 / ISO 3834]– Cost: [Baltic rates, own crews]\n\nYou may be fully covered. If not, would a 20-minute Zoom make sense?\n\nIf steel isn’t on your desk, who should I ask?\n\nEdgars"
        },
        {
          "id": "connection",
          "title": "Connection request",
          "condition": "Day 4–5 · only if there is no reply",
          "subject": "",
          "body": "Hi {{firstName}}, I sent you a short InMail about {{offerLabel}} for the {{project}}. Glad to connect either way. {{sender}}, {{company}}",
          "originalBody": "Hi Joakim, I sent you a short InMail about steel packages for the Malmberget sorting plant. Glad to connect either way. Edgars, ERCON"
        },
        {
          "id": "followup",
          "title": "After acceptance",
          "condition": "Only after the connection request is accepted",
          "subject": "",
          "body": "Hi {{firstName}}, a short follow-up on {{projectShortName}}. If {{offerLabel}} sit with someone else, {{projectRoute}}, a name is all I need. Thank you.",
          "originalBody": "Hi Joakim, a short follow-up on Malmberget. If the steel packages sit with someone else, at LKAB or NCC, a name is all I need. Thank you."
        },
        {
          "id": "calendar",
          "title": "After interest",
          "condition": "Only after the recipient says yes",
          "subject": "",
          "body": "Great. Here is my calendar, pick whatever suits you: {{calendly}}",
          "originalBody": "Great. Here is my calendar, pick whatever suits you: [Calendly link]"
        }
      ]
    ]
  },
  {
    "id": "linkedin-inmail:curiosity",
    "channel": "linkedin",
    "mode": "inmail",
    "style": "curiosity",
    "name": "NLP",
    "subject": "{{projectShortName}} {{projectYear}}: {{serviceFocus}} behind the schedule",
    "body": "Hi {{firstName}},\n\n{{milestoneWork}} in {{projectShortName}} is under way. The {{projectType}} is due to run in {{projectYear}}. Between those dates, every {{deliveryItem}} has to arrive on time, fit the first time and stay within budget.\n\nThat’s what we stand for at {{company}}: {{experienceDuration}} in {{experienceIndustry}}, specialising in {{experienceMarket}}. {{proof}}\n\nI’m not suggesting you change anything that works. Many project teams just like one more qualified option ready before {{offerLabel}} go out.\n\nIf it makes sense, 20 minutes on Zoom? You bring your requirements, I bring {{meetingMaterial}}, and you judge the fit.\n\nIf {{serviceFocus}} isn’t on your desk, who should I ask?\n\n{{sender}}",
    "stages": [
      {
        "id": "initial",
        "title": "Initial InMail",
        "condition": "Day 0 · review profile and facts before copying",
        "subject": "{{projectShortName}} {{projectYear}}: {{serviceFocus}} behind the schedule",
        "body": "Hi {{firstName}},\n\n{{milestoneWork}} in {{projectShortName}} is under way. The {{projectType}} is due to run in {{projectYear}}. Between those dates, every {{deliveryItem}} has to arrive on time, fit the first time and stay within budget.\n\nThat’s what we stand for at {{company}}: {{experienceDuration}} in {{experienceIndustry}}, specialising in {{experienceMarket}}. {{proof}}\n\nI’m not suggesting you change anything that works. Many project teams just like one more qualified option ready before {{offerLabel}} go out.\n\nIf it makes sense, 20 minutes on Zoom? You bring your requirements, I bring {{meetingMaterial}}, and you judge the fit.\n\nIf {{serviceFocus}} isn’t on your desk, who should I ask?\n\n{{sender}}",
        "originalSubject": "Malmberget 2028: the steel behind the schedule",
        "originalBody": "Hi Joakim,\n\nFoundation work in Malmberget is under way. The plant is due to run in 2028. Between those dates, every steel structure has to arrive on time, fit the first time and stay within budget.\n\nThat’s what we stand for at ERCON: 30+ years in steel, specialising in Scandinavia. [Reference: “Recently X for Y in Norway.”]\n\nI’m not suggesting you change anything that works. Many project teams just like one more qualified option ready before the steel packages go out.\n\nIf it makes sense, 20 minutes on Zoom? You bring your requirements, I bring production data, and you judge the fit.\n\nIf steel isn’t on your desk, who should I ask?\n\nEdgars"
      },
      {
        "id": "connection",
        "title": "Connection request",
        "condition": "Day 4–5 · only if there is no reply",
        "subject": "",
        "body": "Hi {{firstName}}, I wrote to you earlier this week about {{projectShortName}} and {{serviceFocus}} behind the {{projectYear}} schedule. Glad to connect either way. {{sender}}, {{company}}",
        "originalBody": "Hi Joakim, I wrote to you earlier this week about Malmberget and the steel behind the 2028 schedule. Glad to connect either way. Edgars, ERCON"
      },
      {
        "id": "followup",
        "title": "After acceptance",
        "condition": "Only after the connection request is accepted",
        "subject": "",
        "body": "Hi {{firstName}}, I’ll keep this short. If one more {{qualifiedOption}} for {{projectShortName}} becomes useful at some point, I’m here. If the timing is wrong, just say so and I’ll check back later in the project.",
        "originalBody": "Hi Joakim, I’ll keep this short. If one more qualified steel option for Malmberget becomes useful at some point, I’m here. If the timing is wrong, just say so and I’ll check back later in the project."
      },
      {
        "id": "calendar",
        "title": "After interest",
        "condition": "Only after the recipient says yes",
        "subject": "",
        "body": "Great. Here is my calendar, pick whatever suits you: {{calendly}}",
        "originalBody": "Great. Here is my calendar, pick whatever suits you: [Calendly link]"
      }
    ],
    "original": "NLP – LINKEDIN (PAID ACCOUNT)\nBefore sending: read his profile. If his title shows he owns steel packages, delete the routing line. Send manually, Tuesday to Thursday morning.\nSTEP 1 – InMail (day 0)\nSubject: Malmberget 2028: the steel behind the schedule\nHi Joakim,\nFoundation work in Malmberget is under way. The plant is due to run in 2028. Between those dates, every steel structure has to arrive on time, fit the first time and stay within budget.\nThat’s what we stand for at ERCON: 30+ years in steel, specialising in Scandinavia. [Reference: “Recently X for Y in Norway.”]\nI’m not suggesting you change anything that works. Many project teams just like one more qualified option ready before the steel packages go out.\nIf it makes sense, 20 minutes on Zoom? You bring your requirements, I bring production data, and you judge the fit.\nIf steel isn’t on your desk, who should I ask?\nEdgars\n[113 words, 645 characters]\nWHEN HE SAYS YES – send the Calendly link\nGreat. Here is my calendar, pick whatever suits you: [Calendly link]\nSTEP 2 – Connection request, day 4–5, only if there is no reply\nHi Joakim, I wrote to you earlier this week about Malmberget and the steel behind the 2028 schedule. Glad to connect either way. Edgars, ERCON\n[142 characters]\nSTEP 3 – Follow-up once he accepts (free, no credit)\nHi Joakim, I’ll keep this short. If one more qualified steel option for Malmberget becomes useful at some point, I’m here. If the timing is wrong, just say so and I’ll check back later in the project.",
    "sourceFile": "NLP_LINKEDIN.docx",
    "sourceSha256": "cc4c8e79e7219812c49bebf0229ca1fd6d1bbbfa8fec1329625269317eb63bd5",
    "revision": 0,
    "builtin": false,
    "masterVersion": "inmail-facts-20261016-v2",
    "previousBuiltinStages": [
      [
        {
          "id": "initial",
          "title": "Initial InMail",
          "condition": "Day 0 · review profile and facts before copying",
          "subject": "{{projectShortName}} {{projectYear}}: {{serviceFocus}} behind the schedule",
          "body": "Hi {{firstName}},\n\n{{development}} Between those dates, {{deliveryRequirement}}.\n\nThat’s what we stand for at {{company}}: {{experience}}. {{proof}}\n\nI’m not suggesting you change anything that works. Many project teams just like one more qualified option ready before {{offerLabel}} go out.\n\nIf it makes sense, 20 minutes on Zoom? You bring your requirements, I bring {{meetingMaterial}}, and you judge the fit.\n\nIf {{serviceFocus}} isn’t on your desk, who should I ask?\n\n{{sender}}",
          "originalSubject": "Malmberget 2028: the steel behind the schedule",
          "originalBody": "Hi Joakim,\n\nFoundation work in Malmberget is under way. The plant is due to run in 2028. Between those dates, every steel structure has to arrive on time, fit the first time and stay within budget.\n\nThat’s what we stand for at ERCON: 30+ years in steel, specialising in Scandinavia. [Reference: “Recently X for Y in Norway.”]\n\nI’m not suggesting you change anything that works. Many project teams just like one more qualified option ready before the steel packages go out.\n\nIf it makes sense, 20 minutes on Zoom? You bring your requirements, I bring production data, and you judge the fit.\n\nIf steel isn’t on your desk, who should I ask?\n\nEdgars"
        },
        {
          "id": "connection",
          "title": "Connection request",
          "condition": "Day 4–5 · only if there is no reply",
          "subject": "",
          "body": "Hi {{firstName}}, I wrote to you earlier this week about {{projectShortName}} and {{serviceFocus}} behind the {{projectYear}} schedule. Glad to connect either way. {{sender}}, {{company}}",
          "originalBody": "Hi Joakim, I wrote to you earlier this week about Malmberget and the steel behind the 2028 schedule. Glad to connect either way. Edgars, ERCON"
        },
        {
          "id": "followup",
          "title": "After acceptance",
          "condition": "Only after the connection request is accepted",
          "subject": "",
          "body": "Hi {{firstName}}, I’ll keep this short. If one more {{qualifiedOption}} for {{projectShortName}} becomes useful at some point, I’m here. If the timing is wrong, just say so and I’ll check back later in the project.",
          "originalBody": "Hi Joakim, I’ll keep this short. If one more qualified steel option for Malmberget becomes useful at some point, I’m here. If the timing is wrong, just say so and I’ll check back later in the project."
        },
        {
          "id": "calendar",
          "title": "After interest",
          "condition": "Only after the recipient says yes",
          "subject": "",
          "body": "Great. Here is my calendar, pick whatever suits you: {{calendly}}",
          "originalBody": "Great. Here is my calendar, pick whatever suits you: [Calendly link]"
        }
      ]
    ]
  },
  {
    "id": "linkedin-inmail:friendly",
    "channel": "linkedin",
    "mode": "inmail",
    "style": "friendly",
    "name": "Friendly",
    "subject": "A hello from {{senderLocation}}",
    "body": "Hi {{firstName}},\n\nCongratulations on getting {{projectShortName}}’s {{milestoneActivity}} started. {{projectRegion}}, ready by {{projectYear}}: impressive job.\n\nI’m {{sender}} from {{company}}, {{sellerDescription}}. For {{experienceDuration}} we’ve done the less glamorous part of projects like yours: {{experienceOutcome}}. {{proof}}\n\nYou may be fully covered, and if so, good. If an extra pair of reliable hands would make {{benefit}}, would a 20-minute chat on Zoom make sense? No slides.\n\nAnd if {{serviceFocus}} sits with someone else, a pointer would be great.\n\n{{sender}}",
    "stages": [
      {
        "id": "initial",
        "title": "Initial InMail",
        "condition": "Day 0 · review profile and facts before copying",
        "subject": "A hello from {{senderLocation}}",
        "body": "Hi {{firstName}},\n\nCongratulations on getting {{projectShortName}}’s {{milestoneActivity}} started. {{projectRegion}}, ready by {{projectYear}}: impressive job.\n\nI’m {{sender}} from {{company}}, {{sellerDescription}}. For {{experienceDuration}} we’ve done the less glamorous part of projects like yours: {{experienceOutcome}}. {{proof}}\n\nYou may be fully covered, and if so, good. If an extra pair of reliable hands would make {{benefit}}, would a 20-minute chat on Zoom make sense? No slides.\n\nAnd if {{serviceFocus}} sits with someone else, a pointer would be great.\n\n{{sender}}",
        "originalSubject": "A hello from Riga",
        "originalBody": "Hi Joakim,\n\nCongratulations on getting Malmberget’s foundations started. North of the Arctic Circle, ready by 2028: impressive job.\n\nI’m Edgars from ERCON, a Latvian steel company. For 30+ years we’ve done the less glamorous part of projects like yours: steel that arrives on time and fits. [Reference: “Recently X for Y in Norway.”]\n\nYou may be fully covered, and if so, good. If an extra pair of reliable hands would make the next two years calmer, would a 20-minute chat on Zoom make sense? No slides.\n\nAnd if steelwork sits with someone else, a pointer would be great.\n\nEdgars"
      },
      {
        "id": "connection",
        "title": "Connection request",
        "condition": "Day 4–5 · only if there is no reply",
        "subject": "",
        "body": "Hi {{firstName}}, I sent you a hello from {{senderLocation}} about {{projectShortName}} earlier this week. Glad to connect either way. {{sender}}, {{company}}",
        "originalBody": "Hi Joakim, I sent you a hello from Riga about Malmberget earlier this week. Glad to connect either way. Edgars, ERCON"
      },
      {
        "id": "followup",
        "title": "After acceptance",
        "condition": "Only after the connection request is accepted",
        "subject": "",
        "body": "Hi {{firstName}}, just floating this back up in case it got buried. If the timing is wrong, no worries at all. A quick “not now” helps me too.",
        "originalBody": "Hi Joakim, just floating this back up in case it got buried. If the timing is wrong, no worries at all. A quick “not now” helps me too."
      },
      {
        "id": "calendar",
        "title": "After interest",
        "condition": "Only after the recipient says yes",
        "subject": "",
        "body": "Great. Here is my calendar, pick whatever suits you: {{calendly}}",
        "originalBody": "Great. Here is my calendar, pick whatever suits you: [Calendly link]"
      }
    ],
    "original": "FRIENDLY – LINKEDIN (PAID ACCOUNT)\nBefore sending: read his profile. If his title shows he owns steel packages, delete the routing line. Send manually, Tuesday to Thursday morning.\nSTEP 1 – InMail (day 0)\nSubject: A hello from Riga\nHi Joakim,\nCongratulations on getting Malmberget’s foundations started. North of the Arctic Circle, ready by 2028: impressive job.\nI’m Edgars from ERCON, a Latvian steel company. For 30+ years we’ve done the less glamorous part of projects like yours: steel that arrives on time and fits. [Reference: “Recently X for Y in Norway.”]\nYou may be fully covered, and if so, good. If an extra pair of reliable hands would make the next two years calmer, would a 20-minute chat on Zoom make sense? No slides.\nAnd if steelwork sits with someone else, a pointer would be great.\nEdgars\n[99 words, 580 characters]\nWHEN HE SAYS YES – send the Calendly link\nGreat. Here is my calendar, pick whatever suits you: [Calendly link]\nSTEP 2 – Connection request, day 4–5, only if there is no reply\nHi Joakim, I sent you a hello from Riga about Malmberget earlier this week. Glad to connect either way. Edgars, ERCON\n[117 characters]\nSTEP 3 – Follow-up once he accepts (free, no credit)\nHi Joakim, just floating this back up in case it got buried. If the timing is wrong, no worries at all. A quick “not now” helps me too.",
    "sourceFile": "FRIENDLY_LINKEDIN.docx",
    "sourceSha256": "d5a3d5df49716f75444cf955652abf95b9ea9fcdc6446e1c3e6074e8077c3c26",
    "revision": 0,
    "builtin": false,
    "masterVersion": "inmail-facts-20261016-v2",
    "previousBuiltinStages": [
      [
        {
          "id": "initial",
          "title": "Initial InMail",
          "condition": "Day 0 · review profile and facts before copying",
          "subject": "A hello from {{senderLocation}}",
          "body": "Hi {{firstName}},\n\n{{development}}\n\nI’m {{sender}} from {{company}}, {{sellerDescription}}. {{experienceSentence}} {{proof}}\n\nYou may be fully covered, and if so, good. If an extra pair of reliable hands would make {{benefit}}, would a 20-minute chat on Zoom make sense? No slides.\n\nAnd if {{serviceFocus}} sits with someone else, a pointer would be great.\n\n{{sender}}",
          "originalSubject": "A hello from Riga",
          "originalBody": "Hi Joakim,\n\nCongratulations on getting Malmberget’s foundations started. North of the Arctic Circle, ready by 2028: impressive job.\n\nI’m Edgars from ERCON, a Latvian steel company. For 30+ years we’ve done the less glamorous part of projects like yours: steel that arrives on time and fits. [Reference: “Recently X for Y in Norway.”]\n\nYou may be fully covered, and if so, good. If an extra pair of reliable hands would make the next two years calmer, would a 20-minute chat on Zoom make sense? No slides.\n\nAnd if steelwork sits with someone else, a pointer would be great.\n\nEdgars"
        },
        {
          "id": "connection",
          "title": "Connection request",
          "condition": "Day 4–5 · only if there is no reply",
          "subject": "",
          "body": "Hi {{firstName}}, I sent you a hello from {{senderLocation}} about {{projectShortName}} earlier this week. Glad to connect either way. {{sender}}, {{company}}",
          "originalBody": "Hi Joakim, I sent you a hello from Riga about Malmberget earlier this week. Glad to connect either way. Edgars, ERCON"
        },
        {
          "id": "followup",
          "title": "After acceptance",
          "condition": "Only after the connection request is accepted",
          "subject": "",
          "body": "Hi {{firstName}}, just floating this back up in case it got buried. If the timing is wrong, no worries at all. A quick “not now” helps me too.",
          "originalBody": "Hi Joakim, just floating this back up in case it got buried. If the timing is wrong, no worries at all. A quick “not now” helps me too."
        },
        {
          "id": "calendar",
          "title": "After interest",
          "condition": "Only after the recipient says yes",
          "subject": "",
          "body": "Great. Here is my calendar, pick whatever suits you: {{calendly}}",
          "originalBody": "Great. Here is my calendar, pick whatever suits you: [Calendly link]"
        }
      ]
    ]
  },
  {
    "id": "linkedin-inmail:brutal",
    "channel": "linkedin",
    "mode": "inmail",
    "style": "brutal",
    "name": "Brutal Honesty",
    "subject": "Found by my AI, sent by me",
    "body": "Hi {{firstName}},\n\nFull transparency: my AI research tool found the {{project}} and drafted this. I checked every word, and any conversation would be with me.\n\n{{company}} is {{sellerDescription}}. {{proof}}\n\nI don’t know whether you need us. If you do, we stand for {{value}}.\n\nWorth 20 minutes on Zoom? If {{serviceFocus}} isn’t on your desk, a name would help just as much.\n\n{{sender}}",
    "stages": [
      {
        "id": "initial",
        "title": "Initial InMail",
        "condition": "Day 0 · review profile and facts before copying",
        "subject": "Found by my AI, sent by me",
        "body": "Hi {{firstName}},\n\nFull transparency: my AI research tool found the {{project}} and drafted this. I checked every word, and any conversation would be with me.\n\n{{company}} is {{sellerDescription}}. {{proof}}\n\nI don’t know whether you need us. If you do, we stand for {{value}}.\n\nWorth 20 minutes on Zoom? If {{serviceFocus}} isn’t on your desk, a name would help just as much.\n\n{{sender}}",
        "originalSubject": "Found by my AI, sent by me",
        "originalBody": "Hi Joakim,\n\nFull transparency: my AI research tool found the Malmberget project and drafted this. I checked every word, and any conversation would be with me.\n\nERCON is a Latvian steel fabrication and installation company, 30+ years in steel, specialising in Scandinavia. [Reference: “Recently X for Y in Norway.”]\n\nI don’t know whether you need us. If you do, we stand for reliable partnership, consistent quality and controlled costs.\n\nWorth 20 minutes on Zoom? If steel isn’t on your desk, a name would help just as much.\n\nEdgars"
      },
      {
        "id": "connection",
        "title": "Connection request",
        "condition": "Day 4–5 · only if there is no reply",
        "subject": "",
        "body": "Hi {{firstName}}, my AI found {{projectShortName}} and I wrote to you about it earlier this week. Glad to connect either way, human to human. {{sender}}, {{company}}",
        "originalBody": "Hi Joakim, my AI found Malmberget and I wrote to you about it earlier this week. Glad to connect either way, human to human. Edgars, ERCON"
      },
      {
        "id": "followup",
        "title": "After acceptance",
        "condition": "Only after the connection request is accepted",
        "subject": "",
        "body": "Hi {{firstName}}, the AI did the research, but this follow-up is all me. If {{projectShortName}}’s {{serviceFocus}} isn’t on your desk, who should I talk to?",
        "originalBody": "Hi Joakim, the AI did the research, but this follow-up is all me. If Malmberget’s steel isn’t on your desk, who should I talk to?"
      },
      {
        "id": "calendar",
        "title": "After interest",
        "condition": "Only after the recipient says yes",
        "subject": "",
        "body": "Great. Here is my calendar, pick whatever suits you: {{calendly}}",
        "originalBody": "Great. Here is my calendar, pick whatever suits you: [Calendly link]"
      }
    ],
    "original": "BRUTAL HONESTY – LINKEDIN (PAID ACCOUNT)\nBefore sending: read his profile. If his title shows he owns steel packages, delete the routing line. Send manually, Tuesday to Thursday morning.\nSTEP 1 – InMail (day 0)\nSubject: Found by my AI, sent by me\nHi Joakim,\nFull transparency: my AI research tool found the Malmberget project and drafted this. I checked every word, and any conversation would be with me.\nERCON is a Latvian steel fabrication and installation company, 30+ years in steel, specialising in Scandinavia. [Reference: “Recently X for Y in Norway.”]\nI don’t know whether you need us. If you do, we stand for reliable partnership, consistent quality and controlled costs.\nWorth 20 minutes on Zoom? If steel isn’t on your desk, a name would help just as much.\nEdgars\n[88 words, 532 characters]\nWHEN HE SAYS YES – send the Calendly link\nGreat. Here is my calendar, pick whatever suits you: [Calendly link]\nSTEP 2 – Connection request, day 4–5, only if there is no reply\nHi Joakim, my AI found Malmberget and I wrote to you about it earlier this week. Glad to connect either way, human to human. Edgars, ERCON\n[138 characters]\nSTEP 3 – Follow-up once he accepts (free, no credit)\nHi Joakim, the AI did the research, but this follow-up is all me. If Malmberget’s steel isn’t on your desk, who should I talk to?",
    "sourceFile": "BRUTAL_HONESTY_LINKEDIN.docx",
    "sourceSha256": "de126f085354f8a998fd5f39be4f4d3a02ee089c5dfe6331bc8d75d9e69ddf77",
    "revision": 0,
    "builtin": false,
    "masterVersion": "inmail-facts-20261016-v2",
    "previousBuiltinStages": [
      [
        {
          "id": "initial",
          "title": "Initial InMail",
          "condition": "Day 0 · review profile and facts before copying",
          "subject": "Found by my AI, sent by me",
          "body": "Hi {{firstName}},\n\nFull transparency: my AI research tool found the {{project}} and drafted this. I checked every word, and any conversation would be with me.\n\n{{company}} is {{sellerDescription}}. {{proof}}\n\nI don’t know whether you need us. If you do, we stand for {{value}}.\n\nWorth 20 minutes on Zoom? If {{serviceFocus}} isn’t on your desk, a name would help just as much.\n\n{{sender}}",
          "originalSubject": "Found by my AI, sent by me",
          "originalBody": "Hi Joakim,\n\nFull transparency: my AI research tool found the Malmberget project and drafted this. I checked every word, and any conversation would be with me.\n\nERCON is a Latvian steel fabrication and installation company, 30+ years in steel, specialising in Scandinavia. [Reference: “Recently X for Y in Norway.”]\n\nI don’t know whether you need us. If you do, we stand for reliable partnership, consistent quality and controlled costs.\n\nWorth 20 minutes on Zoom? If steel isn’t on your desk, a name would help just as much.\n\nEdgars"
        },
        {
          "id": "connection",
          "title": "Connection request",
          "condition": "Day 4–5 · only if there is no reply",
          "subject": "",
          "body": "Hi {{firstName}}, my AI found {{projectShortName}} and I wrote to you about it earlier this week. Glad to connect either way, human to human. {{sender}}, {{company}}",
          "originalBody": "Hi Joakim, my AI found Malmberget and I wrote to you about it earlier this week. Glad to connect either way, human to human. Edgars, ERCON"
        },
        {
          "id": "followup",
          "title": "After acceptance",
          "condition": "Only after the connection request is accepted",
          "subject": "",
          "body": "Hi {{firstName}}, the AI did the research, but this follow-up is all me. If {{projectShortName}}’s {{serviceFocus}} isn’t on your desk, who should I talk to?",
          "originalBody": "Hi Joakim, the AI did the research, but this follow-up is all me. If Malmberget’s steel isn’t on your desk, who should I talk to?"
        },
        {
          "id": "calendar",
          "title": "After interest",
          "condition": "Only after the recipient says yes",
          "subject": "",
          "body": "Great. Here is my calendar, pick whatever suits you: {{calendly}}",
          "originalBody": "Great. Here is my calendar, pick whatever suits you: [Calendly link]"
        }
      ]
    ]
  }
];
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const Native=typeof module==='object'&&module.exports?require('./storyselling-native.js'):root.LeadIntelStorysellingNative;
const api=freeze({records:[...records,Native.inmail]});if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelApprovedInMail=api;
})(typeof window==='object'?window:globalThis);
