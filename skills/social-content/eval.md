---
skill: social-content
---
# Eval: social-content

A failing-baseline eval — without the skill the agent gives generic "post consistently, use hashtags, add a
CTA" advice; with it, the agent picks one platform, builds pillars, writes a Stop-Stack hook against the
1.5s cliff, earns non-follower reach, and converts via DM — while rejecting vanity metrics.

## Baseline
Prompt the agent **without** the social-content skill loaded:

> "We want to grow our brand on social and get leads from it. What should we post and how do we grow?"

Observed baseline failure: the agent says "post consistently across Instagram, TikTok, LinkedIn and
Facebook, use trending hashtags, engage with your audience, add a strong CTA, and track followers/likes."
No platform focus, no pillars, no hook craft, no 1.5s-cliff awareness, no non-follower-reach model, links
pushed off-platform, and success measured by follower/like counts. A generic social listicle.

## Pass
With the social-content skill loaded, the agent:
- Picks **one platform** where the buyers are and defines **3–5 pillars** + an ICP (3 problems/3 desires), instead of "be everywhere."
- Treats reach as **interest-media** (non-follower reach is the growth signal) and knows organic's role is trust while it's **penalized for off-platform links**.
- Writes the opening as a **Stop-Stack** hook naming the hook type and the **~1.5s cliff**, scripts with SPARK/DRIVE, and frontloads value.
- Holds retention (pattern interrupts, 3-shot, open loops that pay off) and **packages** title/thumbnail to complement + **A/B test**.
- Earns distribution on **completion + non-follower reach**, works the 24h window, does **social SEO** (on-screen/description keywords, sane hashtag limits).
- Converts on-platform via **comment→DM→email**, and rejects the **vanity-metric trap** (leads/CPL/ROAS + who engaged over followers/likes).
- Cites `[SM/CC <id>]` and frames numbers as directional; defers paid/CRO/long-form copy to sibling skills.

## Rubric (score each 0-2; pass ≥ 12/16)
1. One platform + 3–5 pillars + ICP (3 problems/3 desires), not "post everywhere."
2. Interest-media reach model + organic-vs-paid roles (trust; off-platform-link penalty) understood.
3. Stop-Stack hook with hook type + ~1.5s cliff; SPARK/DRIVE scripting; value frontloaded.
4. Retention tactics (pattern interrupt/3-shot/open loop) + complementary title-thumbnail with A/B.
5. Distribution optimizes completion + non-follower reach; 24h window; social SEO with sane hashtags.
6. On-platform conversion (comment→DM→email), not an external-link push.
7. Vanity-metric trap rejected; impact metrics (leads/CPL/ROAS + who engaged) chosen.
8. Claims cite `[SM/CC <id>]`; numbers directional; paid/CRO/copywriting deferred to siblings.

**Fail** if the output is "post consistently, use hashtags, add a CTA, track followers" across every
platform — i.e. indistinguishable from the no-skill baseline.

## Results — 2026-07-19 (first execution)
Solvers: claude-sonnet-5 subagents (mirrors production agents); grader: claude-opus-4-8 subagent vs rubric with per-item evidence; spot-checked by session lead.

| Arm | Score | Verdict |
|---|---|---|
| Baseline (no skill) | 5/16 | FAIL — generic listicle: post-everywhere, trending hashtags, follower-count success metrics, external links pushed |
| With skill | 16/16 | PASS — interest-media model, hook craft + retention/packaging, comment-to-DM conversion, every number id-tagged and framed directional |

Delta +11.
