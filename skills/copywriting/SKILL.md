---
name: copywriting
description: Write or audit persuasive marketing copy — landing/sales pages, hero sections, headlines, ad hooks, offers, CTAs — against source-cited copywriting frameworks (BAB, PAS, AIDA-hook, BLUF, Thesis-Antithesis-Synthesis) and a section-by-section page anatomy. Use when writing/reviewing a landing page, sales page, headline, subject line, ad, offer, or VSL; when copy "shows a product" but doesn't sell it; when copy reads AI-flat or generic; or /copywriting. Not for long-form docs (doc-writer), content briefs (content-brief), or email sequences (email-draft).
user-invocable: true
context: fork
argument-hint: [copy to write or audit]
---

## What this skill is

A persuasive-copy partner built from the "Content Strategy & Copywriting" corpus (130 sources,
every rule cited). It turns proven frameworks into an executable workflow so a model producing
marketing copy pulls the right framework and *actions* it — grounding language in the customer's
actual words, structuring the page so attention pulls forward, and finishing with the proof,
objection-handling, and single CTA that turn a page that *shows* a product into one that *sells* it.

Load the depth file — don't guess: `references/knowledge-base.md` (frameworks, page anatomy,
headline formulas, VOC research, offer/proof/objection/CTA rules, each cited to its source).

## When to load
- Writing a landing/sales page, hero, headline, subject line, ad hook, offer, or CTA.
- Auditing existing copy that converts poorly or reads generic/AI-flat.
- Any model generating marketing copy where "doesn't sound vibe-written" is a requirement.

## The workflow

Run in order — each step feeds the next. Every choice cites a rule from the KB (§ + `src`).

### 1 — RESEARCH the voice of the customer (§V)
Copy is *mined*, not guessed. Pull the customer's exact words for pains, desires, objections:
top-5 customer calls, sales-call transcripts (extract 7 pains / triggers / outcomes / objections /
15 verbatim quotes), or — if no customer base — competitor reviews, Reddit, groups. If none is
available, state that the copy is running on assumed VOC and flag it for validation. Never invent
a customer quote.

### 2 — CHOOSE the framework by asset (§II)
- **Landing/sales page** → the 8-section page anatomy (§III), usually closing on **BAB**.
- **Ad / hero hook** → AIDA-style hook (hook · open loop · qualify who it's for).
- **Sales page / promo email** → **PAS** (Problem-Agitate-Solve) for a firm yes/no.
- **Nurture / warm lead** → **BAB** (Before-After-Bridge).
- **Thought-leadership** → **Thesis-Antithesis-Synthesis**.
- **AEO / web answer content** → **BLUF** (answer in the first 50 words).
Name the framework before drafting — decision-complete, no mid-draft switching.

### 3 — DRAFT (§III, §IV)
Headline first — it decides whether anything else is read. It must hook, open a curiosity loop,
and qualify the audience, and pass the **5-Second Test** (a stranger knows what you do + who it's
for in 5s). Use a named formula from §IV, not a vibe. Then draft the body against the page anatomy
or the chosen framework. **Clarity beats cleverness** — "the answer to confusion is always No."
Sell the outcome/identity, not features; translate every feature → benefit.

### 4 — LAYER offer, proof, objections, CTA (§VI–IX)
- **Offer** = the transformation (Problem · Promise · Proof · Price), not the product; one hero offer.
- **Proof** = raw, real-time, specific (screenshots, current metrics, the "before" not just the after).
- **Objections** = surfaced early and dissolved; admit a real flaw to earn trust.
- **CTA** = one per asset; embedded opt-in above the fold + a second CTA at the bottom of long pages;
  ethical urgency only (a real deadline/cap), never a fake one.

### 5 — EDIT for the human tell (§I)
Kill redundancy (every line: necessary or redundant?). Strip AI-tells — patterns-of-three
("no fluff, no filler…"), adjective-stacked nouns, clinical polish. **Personality over perfection**;
perfect copy reads fake and trips the reader's "something's off" alarm.

## Output contract
Return, in order:
1. **VOC basis** — the customer words/pains used (or an explicit "assumed VOC" flag).
2. **Framework** — named, with why it fits the asset.
3. **Copy** — headline + body, structured to the anatomy/framework; benefits not features.
4. **Grade** — score against the checklist below; name the single highest-leverage fix.

## Constraints (what NOT to do)
- **Never invent a customer quote, testimonial, metric, or proof.** Real or flagged as placeholder.
- **Never clickbait** — an ethical open loop teases a real payoff; a false promise you don't deliver breaks trust.
- **Never ship clever-but-unclear.** If a reader could be confused for one second, rewrite for clarity.
- **Never stack multiple CTAs** in one asset — decision fatigue kills action.
- **Never fake urgency** — urgency needs a believable reason-why and a real limit.
- **Never list features without translating each to a benefit** tied to the promised transformation.

## Verify (executable acceptance)
- [ ] Headline passes the 5-Second Test and uses a named §IV formula.
- [ ] A framework is named and the copy follows its structure.
- [ ] Customer's actual language appears (or assumed-VOC is flagged).
- [ ] Exactly one CTA per asset (plus the bottom repeat on long pages).
- [ ] At least one objection is surfaced and dissolved; proof is real-time/specific.
- [ ] Close has risk reversal + ethical urgency.
- [ ] No AI-tells (patterns-of-three, adjective stacks, clinical polish); every feature → benefit.
