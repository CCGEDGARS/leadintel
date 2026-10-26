LeadIntel: Storyselling Style

Template library and generation rules

Version 1.0 · 26 Oct 2026 · CCGroup / Edgars Untals

Built on Paul Smith, Sell with a Story (AMACOM, 2016), adapted for written B2B outreach. Also uses the Sales Hero's Journey and the NLP rules from the CCGroup method.

Language: English master. Latvian and Russian versions are generated from this file and need native review before release.



0. How this file is used in LeadIntel

Part | Who uses it | Purpose

1. Core rules | Generator (system prompt) | What counts as a story, the 7-step structure, the hook rules, the truth rules

2. Story card | Customer, in setup | Fills the story bank. No card means no Storyselling style

3. Story types | Generator | 14 story types, each with channel templates

4. Sequence map | Generator / Delivery stage | Which story type goes in which touch

5. Critic checklist | Second AI pass | Scores every draft before it reaches the approval queue

6. Story interview | Edgars / partner on the €700 setup call | Collects 3–5 real stories per customer



1. Core rules

1.1 What counts as a story (the 6-point test)

A message is in Storyselling style only if the story contains all six:

A time: "Last March", "In 2024"

A place: "at a metal fabricator in Liepāja", "on a site in Malmberget"

A main character: a person with a role, such as "the production manager"

A goal: what that person wanted

An obstacle: what stood in the way

Events: something happens

If nothing happens, it is not a story. "Our clients love our service" is a testimonial. "We are the leading supplier" is a claim. Neither qualifies.

1.2 The 7-step structure (Hook → Context → Challenge → Conflict → Resolution → Lesson → Action)

Step | Question it answers for the buyer | Story spine (fill-in sentence) | Share of the story

1. Hook | Why should I read this? | "The clearest example I've seen was…" | 1 sentence

2. Context | When, where, who, and what did they want? | "In ___, at ___, the ___ was trying to ___." | ~15%

3. Challenge | What went wrong, or what opportunity appeared? | "Then ___ happened." | 1 sentence

4. Conflict | What did they do about it? | "So they ___, then ___." | ~50% (the heart)

5. Resolution | How did it end, and how should I feel about it? | "In the end ___." | ~15%

6. Lesson | What does it mean? | "What I took from that was…" | 1 sentence

7. Action | What should I do? | "That's why I'd suggest…" | 1 question or ask

Option for step 7: just listen. In live calls, stop after the lesson and let the buyer respond. In writing, end with a question, not a pitch.

1.3 Hook rules (mandatory)

Never apologise ("Sorry, quick story…").

Never ask permission ("Can I tell you a story?").

Never use the word "story" in the message. It triggers "here comes a pitch."

Never give away the ending in the hook or the subject line.

The hook must come from the reason for contact: the buyer's signal, question or objection.

Correction to the 26 Oct draft: the earlier call opener ("Can I tell you a 20-second story?") broke two of these rules. Use the call template in 3.3 instead.

1.4 Craft rules

Rule | Why | How the generator applies it

The hero is a person in the buyer's role, never the product and never the sender | People ask "what would someone like me do?" | Pick the story card whose hero role matches the prospect's role and industry most closely

Keep the context short, make the conflict the longest part | The struggle carries the interest | Context ≤ 2 sentences; conflict 2–3 sentences

Arrive late, leave early | Skip anything before the problem and after the result | Start at the challenge, end at the result

The resolution says how to feel | A story isn't finished until the reader knows how to feel about it | Add one feeling or consequence line: "…and he hasn't missed a Nordic deadline since"

One emotion, shown rather than named | "Show me" beats "tell me" | One behavioural detail ("he forwarded it to his CEO at 11pm"), not "he was thrilled"

One number | Two numbers read like a brochure | Use the strongest single figure from the card

Write the way you'd speak at your best | Memo language kills stories | ~12 words per sentence, active voice, verb early, no words like "leverage", "solutions", "synergy"

Optional surprise | Surprise makes it stick | Either open on the most unexpected moment and then backtrack, or hold back one key detail until the last line

1.5 Truth rules (mandatory, enforced in code)

Every story card carries a truth class. The class decides the framing words the generator must use.

Truth class | What it is | Mandatory framing | Allowed in

REAL-OWN | Happened to the sender or their customer | Concrete when/where: "Last March, at…" | All templates

REAL-BORROWED | A well-known public case the sender wasn't part of | Attribution: "You may remember when…", "There's a well-known case from…" plus a source link in the card | Problem, success, discovery journey

HYPOTHETICAL | Invented to explain | Must open with "Suppose…" or "Imagine…" | Only "What I do, simply" and "Two roads"

Hard points (never changed by the generator): what happened, the obstacle, the approach used, the result, the lesson, the number. Soft points (the generator may adjust): names (anonymise freely), exact dates (can round), sequence of minor events, quote wording when it's marked "paraphrase allowed".

Acid test for every card: if the person in the story read this message, would they be offended, or would the sender be embarrassed? If yes, the card is rejected.

Never: invent a client, a quote, a number, or a company. A hypothetical told as if it were real is an automatic fail.

1.6 Length limits per channel

Channel | Story length | Whole message

Cold email | 50–80 words (the "70-word story") | ≤ 130 words

LinkedIn connection note | 1 sentence (story teaser) | ≤ 300 characters

LinkedIn DM | 40–60 words | ≤ 90 words

Call | 20–30 seconds (~60 words) | Opener ≤ 15 seconds before the story

Meeting / demo | 1–3 minutes (150–450 words) | Short, medium and long versions on the card



2. The story card (input, filled once per story)

Based on the book's story structure template, extended for automated use. The examples below are illustrative only, not a real case.

Field | Required | Example

title | ✓ | "Backup bidder, Swedish mine"

story_type | ✓ | One of the 14 types in Part 3

truth_class | ✓ | REAL-OWN / REAL-BORROWED / HYPOTHETICAL

objective | ✓ | What the buyer should believe after reading: "A smaller Baltic supplier can get on a Nordic bid list"

when | ✓ | "Spring 2025"

where | ✓ | "Latvian metal fabricator, 60 people"

hero_role | ✓ | "Sales director" (a role, not the company)

hero_wanted | ✓ | "Get onto Nordic EPC bid lists"

challenge | ✓ | "Lost three tenders in a row, all on delivery-time doubts, not price"

conflict_beats | ✓ (2–3) | "Stopped bidding cold" / "Offered to be the backup bidder on one package" / "Delivered the first test batch 4 days early"

resolution | ✓ | "Moved onto the main bid list within 7 months"

feeling_line | ✓ | "He says it's the first time a Swedish buyer called him first"

key_number | ✓ | "7 months"

lesson | ✓ | "Nordic buyers buy proof of reliability before price"

action | ✓ | The next step this story leads to

fits_segments | ✓ | Industry / role / country tags

answers_objection | optional | "We already have suppliers"

source_or_permission | ✓ | Client OK to share anonymised / public link / "own experience"

quote | optional | Exact words only, plus a flag: verbatim or paraphrase allowed

versions | auto | Short (70 words), medium (150), long (300), generated from the fields and then approved

approved | ✓ | Only approved cards are used

Unlock rule: Storyselling is available once the bank has ≥ 1 approved card. The full sequence needs ≥ 3 cards (a problem, a success and an objection story).

Cold-start rule (new customer with an empty bank): offer the REAL-BORROWED and HYPOTHETICAL types (types 1, 6 and 5) so the customer can start on day one, and prompt them to add real cards after the first replies come in.



3. The 14 story types and their templates

{placeholders} come from the story card (card.*), the prospect profile (prospect.*) or the signal (signal.*). {reason} is the verified reason for contact. With no verified reason, the message is not sent.

Overview

# | Story type | Main job | Best touch | Truth classes allowed

1 | What I do, simply | Explain the offer without jargon | Touch 1 (unknown buyer) | HYPOTHETICAL

2 | Whom I've helped and how | Earn the first meeting | Touch 1 | REAL-OWN

3 | Problem story | Make a hidden problem visible | Touch 1 | REAL-OWN, REAL-BORROWED

4 | Customer success | Social proof, "someone like me" | Touch 2 | REAL-OWN

5 | Two roads | Show the cost of no change | Touch 2–3, calls | HYPOTHETICAL, REAL-OWN

6 | Borrowed success | Proof before you have your own | Touch 1–2, cold start | REAL-BORROWED

7 | Objection answer | Beat the buyer's "anti-story" | Reply handling | REAL-OWN

8 | Pre-emptive objection | Kill the #1 objection before it's raised | Touch 2 | REAL-OWN

9 | Price story | Show why the price protects the buyer | Reply / meeting | REAL-OWN

10 | Cost of waiting (urgency) | Answer "not now" | Touch 3–4 | REAL-OWN

11 | Arm the sponsor | Give your contact a story to retell upstairs | Reply: "I'll pass it on" | REAL-OWN

12 | Coaching the breakup | Make switching from the current supplier or tool feel safe | Reply: "We already have…" | REAL-OWN

13 | I'll tell you when I can't help you | Trust through honesty; the last touch | Final touch | REAL-OWN

14 | Discovery journey | Challenge the buyer's belief without a fight | Touch 2–3 (Challenger-style) | REAL-OWN, REAL-BORROWED

All 14 come from the book's 25 sales stories, filtered to the ones that work in written outreach; type 6 is the book's "success stories that aren't even yours". The book's rapport stories ("Why I do what I do", "founding story", "I made a mistake") live in the founder profile and are used in LinkedIn and meetings (3.15).



3.1 Type 1: What I do, simply (HYPOTHETICAL)

Use when: the buyer doesn't know the sender, and the offer is hard to explain in one line. Build: invent a hero in the prospect's industry → a plausible chain of events → the problem → one sentence on what you do.

Email

Subject: {prospect.industry_noun} and {problem_area_short}

{FirstName},

Suppose you run {hero_role} at a {prospect.company_type} like {ProspectCompany}.
{plausible_situation}. Then {trigger_event}, and {consequence_chain}.
By the time anyone notices, {visible_cost}.

What we do is simple: {one_sentence_what_we_do}.

I'm writing because {reason}. Is {problem_area_short} on your list this year,
or already handled?

{Signature}

LinkedIn DM

{FirstName}, suppose a {prospect.company_type} {trigger_event}. Usually
{consequence_chain}, and nobody sees it until {visible_cost}.
That's the gap we close: {one_sentence_what_we_do}.
Saw {reason}. Is that a live topic at {ProspectCompany}?



3.2 Type 2: Whom I've helped and how (REAL-OWN)

Use when: first touch with a buyer who matches an existing client's profile. Goal: "a glimpse of what they'll miss if they don't talk to you."

Email

Subject: {card.challenge_short}

{FirstName},

{card.when}, the {card.hero_role} at {card.where} wanted {card.hero_wanted}.
The problem: {card.challenge}.

{card.conflict_beat_1}. {card.conflict_beat_2}.
{card.resolution}, and {card.feeling_line}.

I'm writing because {reason}, which looks a lot like where they started.
Worth comparing notes for 15 minutes?

{Signature}



3.3 Type 3: Problem story (REAL-OWN or REAL-BORROWED)

Use when: the buyer may not know they have the problem. The story makes it felt rather than claimed. Key: end on the problem's sting, then one question. No pitch in the same message.

Email

Subject: {card.challenge_short}

{FirstName},

{card.when}, a {card.hero_role} at {card.where} {card.challenge}.
{card.conflict_beat_1}. {card.conflict_beat_2}.
{card.sting_line}

What I took from it: {card.lesson}.

I'm asking because {reason}. Could the same thing be happening at {ProspectCompany},
or have you already closed that gap?

{Signature}

Call (≤ 30 s of story, no permission-asking, no word "story")

"{FirstName}, {MyName} from {MyCompany}. I'm calling because {reason}.
The clearest example I've seen of this was {card.when} at {card.where}."

[Tell the 60-word version: challenge → 2 conflict beats → sting]

"What I took from it was {card.lesson}.
How does that compare with what you're seeing?"
→ Then stay silent and listen.

If they're busy: "Fair enough. Is it a 'not now' or a 'not relevant'?"



3.4 Type 4: Customer success (REAL-OWN)

Use when: the buyer showed interest or opened without replying. Rule: the hero is the client's person, not your product. Pick the card with the closest match of role, industry and country.

Email (follow-up)

Subject: Re: {original_subject}

{FirstName}, one example closer to home.

{card.when}, {card.hero_role} at {card.where} {card.challenge}.
They {card.conflict_beat_1}, then {card.conflict_beat_2}.
{card.resolution}: {card.key_number}.
{card.feeling_line}

If {ProspectCompany} is facing {problem_area_short}, I can walk you through
exactly what they changed. Would that be useful?

LinkedIn DM

{FirstName}, thought of you after {reason}.
{card.when}, a {card.hero_role} at {card.where} had the same issue: {card.challenge_short}.
They {card.conflict_beat_1} and within {card.key_number}, {card.resolution_short}.
Curious whether that's on your radar too?



3.5 Type 5: Two roads (HYPOTHETICAL or REAL-OWN)

Use when: the buyer understands the offer but sees no reason to change. Two short stories about the same person: one without the change, one with it. The benefits are the same facts, shown inside a life.

Email

Subject: Two ways {time_horizon} could look

{FirstName},

Imagine it's {time_horizon} from now. {Road_A: hero keeps current way →
trigger event → concrete loss}.

Now the same {time_horizon}, but {Road_B: hero made the change →
same trigger event → concrete outcome}.

Same team, same market. The only difference is {the_change}.

Given {reason}, which of those two is closer to where {ProspectCompany} is heading?

Call (use after discovery)

"Let me put it in two pictures. Say it's {time_horizon} from now and nothing changed…
[Road A, 3 sentences]. Now the other version… [Road B, 3 sentences].
Which of those would you rather explain to {their_boss}?"



3.6 Type 6: Borrowed success (REAL-BORROWED)

Use when: the customer has no own cases yet (cold start), or a famous case explains the mechanism better. Rule: attribute it, never imply involvement, and connect the dots in one sentence. The card must hold the public source link.

Email

Subject: What {famous_company} got wrong first

{FirstName},

You may remember {famous_case_hook}. What's less known is that
{famous_challenge}. {famous_conflict_beat}. Once they {famous_turn},
{famous_result}.

The lesson I see repeated: {card.lesson}.

That's exactly the gap we work on for {prospect.company_type}s, and I'm writing because
{reason}. Does that ring a bell at {ProspectCompany}?



3.7 Type 7: Objection answer (REAL-OWN)

Principle: objections are stories the buyer tells themselves. You can't beat a story with a fact, only with a better story, ideally about another prospect with the same objection.

Reply template

{FirstName}, completely understandable. {card.where} said almost exactly the same
{card.when}: "{objection_in_their_words}".

{card.conflict_beat_1}. Then {card.conflict_beat_2}, which changed the picture:
{card.resolution}.

I'm not saying it's the same for you. But would it be worth checking whether
{the_hidden_value} applies at {ProspectCompany} too?

Objection → card routing (set per customer)

Objection | Story type to answer with

"We already have a supplier / tool" | 12 Coaching the breakup (or 7)

"Too expensive" | 9 Price story

"Not now / next quarter" | 10 Cost of waiting

"Send me information" | 11 Arm the sponsor (short) or 4 Success

"I need to discuss internally" | 11 Arm the sponsor

"Not interested" | 13 Honest exit (no new story, just one line)

"Not sure it works for us" | 4 Success with the closest-match card



3.8 Type 8: Pre-emptive objection (REAL-OWN)

Use when: one objection comes up in almost every conversation. Raise it yourself, in a story, before the buyer does.

Email (touch 2)

Subject: The question everyone asks first

{FirstName},

The first thing most {prospect.role_plural} ask me is "{top_objection}?"
Honest answer: {honest_admission}.

{card.when}, {card.hero_role} at {card.where} worried about exactly that.
{card.conflict_beat_1}. {card.conflict_beat_2}. {card.resolution}.

So yes, {restate_risk}. But {how_you_absorb_it}.
Worth a short call to see if it applies at {ProspectCompany}?



3.9 Type 9: Price story (REAL-OWN)

Rule: the story must show how the price protects the buyer, not why you need the money. Ask: what bad thing happens to buyers who pay less for a cheaper version?

Reply template

{FirstName}, fair question on price.

{card.when}, a {card.hero_role} at {card.where} chose {cheaper_alternative}.
{card.challenge}. {card.conflict_beat_1}, and {card.conflict_beat_2}.
In the end {card.resolution}, which cost more than the difference in price.

That's why we include {price_component_that_protects_buyer}. If you'd like,
I'll show you exactly what's in the price and you decide what you don't need.



3.10 Type 10: Cost of waiting (REAL-OWN)

Use when: "Yes, but not now." Don't repeat the benefits; tell what happened to someone who waited.

Email (touch 3–4)

Subject: Re: {original_subject}

{FirstName}, one thing I've seen happen more than once.

{card.when}, a {card.hero_role} at {card.where} agreed this made sense but decided
to start after {their_reason_to_wait}. Then {card.challenge}.
{card.conflict_beat_1}. {card.conflict_beat_2}.
By the time they were ready, {card.resolution}.

If {ProspectCompany}'s timing is genuinely wrong, no problem. But if it's
"later" for the same reasons, is it worth 20 minutes now to plan the start?



3.11 Type 11: Arm the sponsor ("feeling story") (REAL-OWN)

Use when: the contact isn't the final decision-maker: "I'll pass it on", "the board decides". Rule: the story is about how the result felt for someone "just like you", not about the numbers. It must be short enough to retell in a meeting (≤ 120 words).

Reply template

Thanks, {FirstName}. Here's one example in case it helps when you raise it.

{card.hero_role} at {card.where} is in a very similar position to you.
{card.when}, {card.feeling_moment: e.g. "she forwarded me the first signed order
from Norway with one line: 'Finally.'"}. Before that, {card.challenge_short};
afterwards, {card.key_number}.

Would you like to be the one sending that kind of message {time_horizon} from now?
If it helps, I can send a one-page summary you can forward as-is.



3.12 Type 12: Coaching the breakup (REAL-OWN)

Use when: "We already have a supplier / tool / agency." The real barrier is often not the product but the discomfort of leaving the current provider. Strategic note for LeadIntel itself: this is the direct answer to the most common LeadIntel objection: "we already have such a tool and don't need another subscription."

Reply template

{FirstName}, that makes sense. Most of the {prospect.role_plural} I work with
already had {current_solution_type} when we met.

{card.when}, {card.hero_role} at {card.where} was in the same spot. They didn't
switch overnight. {card.conflict_beat_1: e.g. "they kept their existing tool and ran us
side by side on one market for 30 days"}. {card.conflict_beat_2: e.g. "then
compared meetings booked, not leads found"}. {card.resolution}.

If it helps, I can share exactly how they ran that comparison, so you can
decide with your own numbers.



3.13 Type 13: I'll tell you when I can't help you (REAL-OWN)

Use when: the final touch, or when the fit is weak. Honesty builds more trust than any proof.

Email (final touch)

Subject: Closing the loop

{FirstName}, I'll stop here.

{card.when}, I told a {card.hero_role} at {card.where} that we were
the wrong fit for {their_situation}, and pointed them to {alternative}.
{card.resolution: e.g. "A year later they came back when they expanded to Sweden."}

If {ProspectCompany} isn't the right fit right now, that's completely fine.
If that changes, you know where to find me.



3.14 Type 14: Discovery journey (REAL-OWN or REAL-BORROWED)

Use when: you need to challenge a belief the buyer holds (Challenger-style insight) without making them wrong. Start where they are: "I used to think the same."

Email

Subject: I used to believe {common_belief}

{FirstName},

For years I assumed {common_belief}. Most {prospect.role_plural} do.
Then {card.when}, working with a {card.hero_role} at {card.where},
we found {surprising_finding}. {card.conflict_beat_2}.

That changed how I look at {topic}: {card.lesson}.

Given {reason}, I'd be curious whether you're seeing the same thing at
{ProspectCompany}, or something different?



3.15 Rapport stories (founder profile, not the outreach queue)

Stored once in the sender's profile and used in LinkedIn "About", the first minutes of meetings, and the signature-line P.S. on touch 2:

Story | Example for Edgars (all facts already confirmed)

Why I do what I do | First week as an agent at a Swiss pharmaceutical company, a client threw him out and told him never to come back. That's where it all began.

Whom I've helped | 3 years as Toyota Baltic's outsourced trainer; implemented sales processes for a local Mercedes-Benz dealer

I'll tell you when I can't help you | [to collect: a time Edgars turned down a client or referred them elsewhere]

I made a mistake | [to collect]

Rule: the sender is never the hero of more than one story in a sequence. The customer's people are the heroes.



4. Sequence map (default Storyselling cadence)

Touch | Day | Channel | Story type | Fallback if no fitting card

1 | 0 | Email | 3 Problem, or 2 Whom I've helped | 1 What I do, simply, or 6 Borrowed

1b | 1 | LinkedIn note | Teaser of touch 1 (one sentence, no ending) | Non-story connect note

2 | 4 | Email | 4 Success, or 8 Pre-emptive objection | 6 Borrowed success

3 | 8 | LinkedIn DM / Call | 5 Two roads (call), or 14 Discovery journey | 5 Two roads (hypothetical)

4 | 14 | Email | 10 Cost of waiting | Non-story value follow-up

5 | 21 | Email | 13 I'll tell you when I can't help you | Plain honest exit

Sequence rules:

One story per message. Never two.

Never the same card twice to the same person.

Different story types across touches, so it doesn't read like a template.

Replies are routed by the objection table in 3.7.



5. Critic checklist (second AI pass, score 0–2 per line, send only at ≥ 16/20 and no zero on lines 1–4)

# | Check | 0 | 1 | 2

1 | Truth: the card is approved, no invented facts, and the truth class framing is present | Fail = block | — | Pass

2 | Reason for contact is specific and verifiable | Missing = block | Generic | Specific signal

3 | 6-point test: time, place, hero, goal, obstacle, events | < 4 | 4–5 | All 6

4 | Hook rules: no apology, no permission, no word "story", no spoiler | Broken = block | — | Clean

5 | Hero is a person in a role close to the prospect, not the product or the sender | Product or sender | Distant role | Close match

6 | Conflict is the longest part; context ≤ 2 sentences | Context dominates | Even | Conflict-led

7 | Resolution tells the reader how to feel (feeling line) | Missing | Implied | Explicit

8 | One number, one emotion, shown | 0 or 3+ numbers | 2 numbers | 1 number, shown emotion

9 | Spoken style: ~12 words per sentence, active voice, no jargon | Memo style | Mixed | Spoken

10 | Ending is a question or a low-friction next step, within the length limit | Hard pitch or over limit | Soft ask, over limit | Question within limit



6. Story interview (setup call: collecting the customer's story bank)

Rules (from the book): let them see the questions in advance; listen more than you talk; ask about specific moments; never use the word "story" with customers; if they stall, tell a short example of the kind of moment you mean.

Questions to the customer's team (salespeople and owner):

What's the best example you tell when a prospect asks "does this really work?"

Tell me about a deal you almost lost. What happened?

Tell me about a prospect who waited, and what it cost them.

What objection do you hear in almost every conversation? Tell me about one time you turned it around.

Tell me about a client who switched to you from someone else. How did they handle leaving?

Tell me about a time you told a client you couldn't help them.

Questions to their best clients (with permission):

When did you first know for sure that working with {customer} paid off? What exactly happened?

What was it like before? Tell me about a specific day.

What was the moment it started to feel like a success? Who did you tell?

What almost stopped you from starting?

What did your previous supplier do when you told them?

Output of the call: 3–5 story cards (minimum: one problem, one success, one objection), filled in bullet form, then the app drafts the 70/150/300-word versions for approval.



7. Generator system block (paste into the Storyselling style prompt)

STYLE: STORYSELLING
You write first-touch and follow-up messages that carry ONE short true story.
Use ONLY story cards provided in STORY_BANK where approved=true. Never invent a
client, company, person, quote, number, date or result.

Truth classes:
- REAL-OWN: open the story with its when/where.
- REAL-BORROWED: attribute it ("You may remember…"), never imply involvement.
- HYPOTHETICAL: must start with "Suppose" or "Imagine"; only for story types
  "what_i_do_simply" and "two_roads".
Hard points from the card (event, obstacle, approach, result, number, lesson) are
copied exactly. Soft points (names, rounding of dates, minor order) may be adjusted.

Structure: Hook (from REASON_FOR_CONTACT) → Context (≤2 sentences: when, where,
hero role, what they wanted) → Challenge (1 sentence) → Conflict (2–3 sentences,
the longest part) → Resolution (+ how it felt) → Lesson (1 sentence) → Action
(a question, not a pitch).

Hook rules: never apologise, never ask permission, never use the word "story",
never reveal the ending in the subject line or the first sentence.

Craft: hero = a person in a role closest to the prospect; arrive late, leave early;
one number; one emotion, shown through behaviour; ~12 words per sentence, active
voice, no jargon. Respect the channel length limits.

If no approved card fits the prospect (segment + objection) with confidence ≥ 0.6,
output FALLBACK and the reason, and do not force a story.
If REASON_FOR_CONTACT is empty, output BLOCKED.
Write in {output_language}. Natural native phrasing, never translated English.



8. Gaps before go-live

Story bank is empty. Edgars' own LeadIntel cards (Ercon, the 1→12 phone deals case, first exporter results) still have to be filled in with real when/where/number. The 1→12 case is confirmed as a result but its date, place and conflict beats are not yet on file.

LV and RU masters: generate from this file, then a native review (latvian-copy-standard / russian-copy-standard) before any customer sees them.

Measured performance: no reply-rate data yet. Track reply rate per card and per story type from the first send.