---
name: video-compose
description: "Deterministic, data-driven video from HTML/CSS via HyperFrames — product demos, explainers, ad A/B variant reels, store/theme preview videos, motion graphics. Use when the video must be reproducible and exact (precise text, data, timing, brand) rather than AI-generated; the deterministic sibling of ai-video. Triggers: product demo video, explainer, motion graphics, templated/repeatable video, ad variant reels, /video-compose."
user-invocable: true
argument-hint: "[brief] [output-path]"
---

# Video Compose (HyperFrames → MP4)

Write HTML/CSS, render a **deterministic** MP4 locally. No API key, no per-render fee
(Apache-2.0). Pipeline is headless Chrome (frame capture) → FFmpeg (encode). This is the
tool when the video must be *exact and repeatable* — captions, data, timing, brand — not
hallucinated.

## Route first: this vs `ai-video`

| Brief looks like… | Use | Why |
|---|---|---|
| Exact text/data, captions, UI/screen capture, templated ad variants, data-viz, motion graphics | **video-compose** | Output is specified, must be byte-stable across renders |
| Photoreal scenes, cinematic b-roll, "imagine a…", generative footage | **ai-video** (Veo/Higgsfield) | Output is generated, taste-graded |

They compose: generate clips with `ai-video`, then time/caption/brand them deterministically here.

## Prerequisites
- **Node 22+** and **FFmpeg** on PATH. If FFmpeg is missing: `brew install ffmpeg`. Verify both before scaffolding.

## Procedure
1. **Scaffold** — `npx hyperframes init <name>`, then work inside it. It writes `index.html`
   (the composition) and npm scripts (`dev` / `check` / `render`) — drive those, not the raw CLI.
2. **Author the composition** (`index.html`): a stage element + timed clips. The stage's own
   `data-duration` is the total video length; render output is `<name>_<timestamp>.mp4`.
   ```html
   <div id="root" data-composition-id="demo" data-start="0" data-duration="6"
        data-width="1920" data-height="1080">
     <video class="clip" data-start="0" data-duration="6" data-track-index="0"
            src="screen.mp4" muted playsinline></video>
     <h1 id="title" class="clip" data-start="1" data-duration="4" data-track-index="1">Your headline</h1>
     <audio data-start="0" data-duration="6" data-track-index="2" data-volume="0.5" src="music.wav"></audio>
   </div>
   <script>
     window.__timelines = window.__timelines || {};
     const tl = gsap.timeline({ paused: true });          // paused — the renderer drives the clock
     tl.from("#title", { opacity: 0, y: -50, duration: 1 }, 1);
     window.__timelines["demo"] = tl;                      // key == data-composition-id
   </script>
   ```

   | Attribute | Meaning |
   |---|---|
   | `data-composition-id` | stage identifier the renderer targets |
   | `data-width` / `data-height` | output resolution |
   | `data-start` | start offset (seconds) |
   | `data-duration` | element on-screen duration (seconds) |
   | `data-track-index` | layer / audio-video ordering |
   | `data-volume` | audio gain (0–1) |

3. **Animate (seekable only)** — GSAP, CSS, Lottie, Three.js, Anime.js, or WAAPI. Expose each
   timeline as `window.__timelines[id]` and **pause it at frame 0**. The renderer seeks the
   clock frame-by-frame; a real-time/unpaused animation renders nondeterministically.
4. **Brand it** — pull colors, type, spacing from the project's design tokens / design-system.
   Bundle fonts locally (a late webfont = a flash-of-unstyled first frame).
5. **Preview & check** — `npm run dev` (live reload in the browser) to eyeball motion + timing;
   then `npm run check` (lint + validate + inspect) to catch composition errors before rendering.
6. **Render** — `npm run render` → MP4 at `renders/<name>_<timestamp>.mp4`.
7. **Verify (don't stop at "rendered")** — file exists and is non-zero; `ffprobe` the duration
   and resolution against intent (`ffprobe -show_entries stream=width,height:format=duration`);
   spot-check a frame. For ad variants, render each and confirm only the intended element changed.

## Determinism rules — the reason this skill exists
- **No `Date.now()` / `Math.random()` / network calls** inside a composition. Same input must
  yield the same MP4 — that is the whole edge over generative video. Seed any variation explicitly.
- **Pause all timelines at 0**; let the engine drive the clock.
- **Assets local** — fonts, media, Lottie JSON bundled, not fetched at render time.

## Use cases
Product demo (screen-cap + captions), explainer (motion graphics over a script), **ad A/B
variants** (one template, swap only headline/CTA — deterministic, so the diff is exactly the
variable), store/theme preview reel, animated data-viz.

## Constraints (what NOT to do)
- **Don't** use for photoreal/generative footage — that's `ai-video`; compose the two instead.
- **Don't** commit rendered MP4s — gitignore outputs; commit the composition source.
- **Don't** hardcode secrets in compositions.
- **Don't** rely on real-time animation or network during render — both break determinism.
- **Don't** declare done on a zero exit — a render can emit a black/short file; probe it.
