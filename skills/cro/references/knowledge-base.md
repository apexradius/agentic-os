# CRO Knowledge Base

> Source-cited from the NotebookLM notebook "Analytics & CRO" (159 sources). Every claim carries `(src: CRO <id>)` where `<id>` is an 8-char prefix of the underlying source. Numbers are source-reported benchmarks — they drift by industry/date; treat as directional, re-verify against the target's own baseline. General/platform-agnostic CRO: platform-specific checkout mechanics and deep A/B statistics live in sibling skills.

## Conversion principles & heuristics

- Conversion rate = (conversions ÷ visitors) × 100; establish it first, then compare to a category benchmark before judging good/bad (src: CRO 14d3558d). CRO only pays off when traffic has buying intent (product-market fit / right targeting) — a perfect page can't sell an unwanted product (src: CRO 14d3558d).
- Balance the conversion forces: raise **motivation**, lower **friction**, reduce **anxiety**, apply **incentive** (src: CRO a5fc5aa5).
- Buying decisions are emotional first, justified with logic second — lead copy with how the customer will *feel* and the outcome/transformation, not the process or feature list (src: CRO a5fc5aa5). Benefits sell better than features; pick the top 3 benefits and give each a one-line description + icon (src: CRO a5fc5aa5).
- Above-the-fold hero must pass the 10-second test by answering three things: what you do, how it improves the visitor's life (value prop), and the next action (CTA) (src: CRO a5fc5aa5). 40–60% of homepage visitors bounce after one page, so hero clarity is the highest-leverage fix (src: CRO a5fc5aa5).
- H1: state plainly what you do with the target keyword; kill vague/clever headlines ("Unlock your potential") (src: CRO 3c17d971, src: CRO 14d3558d).
- CTA is the site's GPS — eye-catching, impossible to miss, action-worded ("Get free trial", "Start quiz"), placed above the fold (src: CRO 14d3558d). Match CTA commitment to funnel stage: high-ticket/cold traffic gets a soft entry ("Book a free call", "Download") not "Pay now" (src: CRO a5fc5aa5).
- Cognitive levers: social proof / authority ("people trust people"), color psychology (blue=trust, green=growth, red=urgency), and urgency/scarcity via time-bounded offers (src: CRO a5fc5aa5, src: CRO 3c17d971, src: CRO fd84bec9).
- Write conversationally; keep the page about the customer's problem and outcome, not a company brag (src: CRO a5fc5aa5).

## Funnel & journey analysis

- A funnel maps the ordered steps to a conversion; standard e-comm milestones = view_item → add_to_cart → begin_checkout → purchase; lead path = offer/opt-in → opt-in thank-you → cart → purchase thank-you (src: CRO 4ca7148c, src: CRO fa69be1f).
- **Macro-conversions** = revenue actions (purchase, close_convert_lead); **micro-conversions** = predictive intent steps (view_item, add_to_cart, scroll-depth 50/75%, newsletter signup) — track micros as early-warning signals (src: CRO dac70d11, src: CRO 85e29d40).
- Closed funnel counts only users who enter at step 1 (strict linear flows like checkout); open funnel counts entries at any step (general navigation / direct product-page landings) — pick to match the journey (src: CRO 4ca7148c).
- Diagnose leaks against benchmarks, not in a vacuum: warm-traffic opt-in ≈ 30–40%; cart-to-purchase ≈ 40–50% (i.e. 50–60% cart abandonment). Below-range steps are the leak to fix (src: CRO fa69be1f).
- Isolate hidden leaks with breakdown dimensions: device (mobile vs desktop — low mobile completion flags responsive/layout bugs), browser (version breaking checkout), traffic source (channel-specific ad↔page mismatch) (src: CRO 4ca7148c, src: CRO 37fafc70, src: CRO fa69be1f).
- On a big drop-off, apply a "next action" breakdown (page_path) to see where users detour instead of converting — repeated loops back to login/shipping signal a confusing flow (src: CRO 4ca7148c, src: CRO 37fafc70).
- Optimize per intent: **landing pages** → clarity + value prop (limit nav to ≤5 links, soft CTA); **product/detail pages** → build desire + kill objections (USP bullets, outcome imagery, specific UGC testimonials, objection-busting FAQ on price/shipping/returns); **checkout** → strip friction + anxiety (fewer fields, guest checkout, secure, fast) (src: CRO a5fc5aa5, src: CRO 14d3558d).

## Analytics & measurement

- Everything is an event; name events/params in strict lowercase snake_case (GA4 is case-sensitive — mixed casing fragments data) (src: CRO d0a98e7f). Prefer Google's recommended event names (view_item, add_to_cart, begin_checkout, purchase, generate_lead) — they auto-unlock standard reports (src: CRO 4ca7148c, src: CRO 173a9a06).
- Deactivate Enhanced-Measurement "Form interactions" — it fires false positives; build explicit custom form triggers instead (src: CRO 37fafc70).
- Custom parameters are invisible in reports until registered as Custom Definitions; registration back-populates in ~24–48h; cap = 50 custom dimensions; GA4 truncates param values to 100 chars (keep dynamic values short) (src: CRO 5cd125e1, src: CRO d0a98e7f).
- Mark critical actions as **Key Events**; set counting method deliberately — purchases count "every" event; lead forms count "once per session" to avoid double-submit inflation. Standard quota = 30 key events (src: CRO 173a9a06, src: CRO 4f708256).
- Attribution: GA4 default = Data-Driven Attribution; not every report uses the same model, so compare Last-Click vs DDA in the Key-Event Attribution report to find over/under-valued channels. First-Click, Linear, Time-Decay, Position-Based are deprecated — don't build on them (src: CRO 81f33e8c, src: CRO 4f708256, src: CRO eb273631).
- Cohort/retention: group users by acquisition date and track return rate over intervals; a good redesign lifts newer cohorts' retention curves. Raw data retention defaults to 2 months — change to 14 months immediately or long-range explorations silently fail (src: CRO eb273631, src: CRO 44ad5202).
- Pair quantitative (funnel/GA4 = *where* users drop) with qualitative (session recordings + heatmaps = *why*) (src: CRO fa69be1f, src: CRO 678f24a1). If recording tools load without a valid consent signal, each pageview spawns a new user/session — breaking multi-page funnels and fragmenting recordings; fire the consent command on cookie-accept (src: CRO dca7d6e2).

## Experimentation strategy

- CRO is a continuous-experimentation discipline — adopt a systematic test-what-works mindset; nothing is ever "done", keep iterating and double down on winners (src: CRO 65983b7d, src: CRO 14d3558d).
- Run true A/B / split-URL redirect tests via a dedicated testing platform (VWO, Crazy Egg, Zoho PageSense, Mida) or analytics-native experiment tools (Matomo add-on, Amplitude on custom segments) (src: CRO 9a810c9a, src: CRO 678f24a1).
- On automated ad platforms (e.g. PMax) you can only duplicate an asset group and swap the final URL — keep audience signals identical, but note this is NOT a true A/B test (the platform's AI reallocates traffic to the predicted winner), so watch impressions/clicks and confirm results are statistically significant before calling it (src: CRO 9a810c9a).
- Isolate one variable per test; even micro-changes move the needle — e.g. one emoji added to a meta title lifted clicks 11% (src: CRO 369ba9ff).
- Note: this notebook does not cover ICE/PIE prioritization, hypothesis templates, or sample-size/duration/peeking math — defer those to the dedicated A/B-test skill; do not fabricate them here.

## Page & element optimization

- **Forms**: remove long forms from early-stage UX; keep only necessary fields; pre-select sensible defaults ("shipping = billing") so the form looks smaller and less intimidating; offer an email-link alternative for complex inquiries (src: CRO 3c17d971, src: CRO 14d3558d).
- **Navigation**: streamline to ≤5 primary links; push blog/privacy/terms to the footer to avoid choice overload (src: CRO 3c17d971, src: CRO 14d3558d).
- **Pop-ups**: high friction and an SEO/mobile ranking risk — use only for high-value actions, delay a few seconds or trigger on scroll-depth, and make the close "X" obvious and easy to tap (src: CRO 3c17d971, src: CRO d2c8b345).
- **Social proof**: reject vague reviews ("friendly service"); feature specific testimonials naming the exact product/variant + authentic UGC video; maintain a steady review flow (recency signals matter); respond to every review calmly, never lash back at critics (src: CRO a5fc5aa5, src: CRO fd84bec9, src: CRO 4471b47d, src: CRO 14fac9d6).
- **Color**: neutral base + only 1–2 accent colors reserved to draw the eye to CTAs; clashing/overused colors read unprofessional (src: CRO 3c17d971).
- **Urgency (ethical)**: time-bounded offers and post-conversion incentives — don't leave thank-you pages as dead ends; add a discount code (~10%) or related-product link to sustain momentum and retention (src: CRO 3c17d971).
- **Mobile**: expect lower mobile completion — audit it separately; convert static PDFs to responsive HTML (PDFs don't adapt to mobile or track behavior); avoid content-blocking pop-ups on mobile (a Google negative ranking factor) (src: CRO 3c17d971, src: CRO d2c8b345, src: CRO 4ca7148c).
- **Speed**: a 1-second load delay can cut conversion by up to 7% — compress/optimize images, remove unused JavaScript/CSS, and clean redirect chains (src: CRO 14d3558d, src: CRO 3c17d971).
- **Outreach channel** (for review/feedback capture): email open ≈ 20% vs SMS ≈ 98% — use SMS with a direct link to drive response volume (src: CRO 4471b47d).
- Category benchmark example: home accessories/giftware e-comm converts ≈ 1.55–2.34%; a site at ~1% is below average with headroom (benchmarks vary widely by sector — pull your own category) (src: CRO 14d3558d).
