---
skill: video-content
---
# Eval: video-content

A failing-baseline eval — without the skill the agent gives generic "make a good video" advice (buy a decent
camera, write a script, add keywords to the title, post consistently); with it, the agent packages before
recording, scripts 80% story, wins on audio, cuts to the best 30%, packages for the click + session, and
confines AI to the routine middle.

## Baseline
Prompt the agent **without** the video-content skill loaded:

> "I want to start a YouTube channel for my business. How do I make videos that actually get views? What gear
> do I need and how should I structure them?"

Observed baseline failure: the agent recommends "invest in a good camera and mic, write a full script,
structure it intro-body-outro, put your main keywords in the title and description for SEO, make a clear
thumbnail, and post consistently (ideally daily)." Gear-first; camera over audio; keyword-SEO titles;
word-for-word script with no retention structure; packaging as an afterthought (not decided first, not tested);
daily-grind cadence; no hook/Cliff awareness; no short-vs-long strategy; AI either ignored or treated as a
full-script generator.

## Pass
With the video-content skill loaded, the agent:
- **Packages first** — thumbnail + title decided **before recording**; title <50char on **emotion/curiosity,
  not SEO**; thumbnail ≤3 colors, hero clear; **A/B / mock-feed test** before publish.
- Scripts **80% story / 20% how-to** with an **open loop / hook**, reading age 8-10, drafted in triplet bullets
  read aloud (not word-for-word).
- Puts **audio over camera** (phone + cheap mic beats a nice camera with hiss), one key light ~45°, low-f
  framing, a shot list.
- Edits **>70% cut to the best 30%**, **paces to the avatar not the trend**, captions high-in-frame, pattern
  interrupts, no dead air; frames retention as a human (question/emotion) problem.
- Handles platform: **1.5s Cliff / Stop-Stack** for short-form, **long-form as the watch-time base** (~30/70
  mix), drives **session time** to one next video, repurposes **one-to-many natively**, sustainable cadence
  (weekly banger > daily grind).
- Confines **AI to the routine middle (10-80-10)**, fact-checked, and warns of anti-slop demonetization.
- Cites `[VP <id>]`, frames numbers as directional creator claims, and defers generation to `ai-video`,
  assembly to `video-produce`, paid to `paid-ads`.

## Rubric (score each 0-2; pass ≥ 12/16)
1. Thumbnail + title decided before recording; emotional <50char title (not SEO-stuffed); package A/B-tested.
2. Retention script: 80/20 story split, hook/open loop, reading age 8-10, bullets-not-word-for-word.
3. Audio-over-camera; gear-is-not-the-bottleneck; key light + low-f + shot list.
4. Edit cuts >70%, paces to the avatar (not trend), captions high, pattern interrupts, no dead air.
5. Short-form 1.5s Cliff / Stop-Stack handled; long-form base + 30/70 mix; session-time next-step.
6. One-to-many native repurposing; sustainable cadence over daily grind.
7. AI confined to routine middle (10-80-10), fact-checked; anti-slop awareness.
8. Cites `[VP <id>]`; numbers directional; generation/assembly/paid/design/licensing deferred.

**Fail** if the output is "buy a good camera, full script, SEO keywords in the title, post daily" — i.e.
gear-first, camera-over-audio, SEO-title, no-retention-structure, packaging-as-afterthought, indistinguishable
from the no-skill baseline.

## Results — 2026-07-19 (first execution)
Solvers: claude-sonnet-5 subagents (mirrors production agents); grader: claude-opus-4-8 subagent vs rubric with per-item evidence; spot-checked by session lead.

| Arm | Score | Verdict |
|---|---|---|
| Baseline (no skill) | 7/16 | FAIL — SEO-keyword titles, no retention 80/20, no Cliff/Stop-Stack mechanics, AI absent, zero citations (gear-order instinct was right) |
| With skill | 16/16 | PASS — packaging-first, 70% cut, Cliff + Stop-Stack, 30/70 short-long mix, AI as tool not script-generator, numbers flagged directional |

Delta +9. Soft spot flagged for next revision: skill arm scopes out-of-KB topics rather than naming ai-video/video-produce/paid-ads as explicit handoffs.
