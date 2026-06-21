---
name: video-produce
description: "Produce complete video content — AI generation via Veo 3.x, editing, assembly. Product demos, social reels, brand films, ads. Use when user needs video content, product video, social reel, or /video-produce."
user-invocable: true
argument-hint: "[brief-description] [format: reel|demo|ad|hero]"
---

# Video Production Pipeline

End-to-end video production using AI generation and assembly.

## Available Models (via Gemini API)
| Model | Quality | Speed | Use |
|-------|---------|-------|-----|
| `veo-3.1-generate-preview` | Highest | ~2min | Hero/brand films |
| `veo-3.1-fast-generate-preview` | High | ~45s | Product demos, social |
| `veo-3.1-lite-generate-preview` | Good | ~20s | Quick iterations |

## Video Formats

### Product Demo (5-8s)
- Slow dolly/orbit around product
- Clean background, studio lighting
- Prompt: "Cinematic slow orbit around [product] on [surface], [lighting], studio product video"

### Social Reel (8-15s, 9:16)
- Lifestyle moment, energetic
- Prompt: "Vertical video of [person/scene], [action], [mood], social media content, trending aesthetic"

### Brand Hero (5-10s, 16:9)
- Cinematic, aspirational
- Prompt: "Cinematic [scene description], [camera movement], [lighting], brand campaign film quality"

### Ad Spot (5-15s)
- Hook → value → CTA structure
- Generate 3 clips, assemble with text overlays

## Generation
Use `/ai-video` for Veo 3.x API generation (submit, poll, extract workflow).

## Assembly (ffmpeg)
```bash
ffmpeg -f concat -i filelist.txt -c copy output.mp4          # Concatenate clips
ffmpeg -i input.mp4 -vf "drawtext=text='SHOP NOW':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h-100" output.mp4  # Text overlay
ffmpeg -i input.mp4 -vf "crop=ih*9/16:ih" vertical.mp4      # Convert to vertical
```

## Output Structure
```
video/
  raw/          # AI-generated clips
  final/        # Assembled/edited output
  thumbnails/   # Auto-generated from first frame
```

## Content Creation Workflow

### Batch Filming Strategy
- Limit high-output work (filming/editing) to 2-4 hours per day to maintain quality
- Batch film during high-energy phases -- group similar setups together
- Use cycle syncing or personal energy tracking to schedule filming on peak-energy days
- Record voice memo brain dumps between sessions to capture ideas without stopping flow

### Pre-Upload Checklist
1. Wait ~2 hours post-upload for YouTube to process 4K and complete copyright/ad checks before going public
2. Test thumbnail + title in a real feed using vidIQ to check mobile readability -- text often becomes unreadable at small sizes
3. While still unlisted: pin a comment with a specific question to stimulate engagement in first 24 hours
4. Use YT Open App smart links for social promotion -- opens video in YouTube app, not browser (higher session credit)
5. Schedule a Community Tab post for 15 minutes after going live with a blurb and related GIF

### Automated Cleanup (Descript)
1. Drop footage -- automatic transcription and text-based editing
2. Remove retakes with one click using AI repeat detection
3. Set gap threshold (0.1s) to strip all awkward silences and breaths
4. Auto-remove filler words (um, ah, like)
5. Use Studio Sound to fix bad audio; Underlord to generate B-roll automatically

## Hook Optimization (First 5-15 Seconds)
Use the SPARK framework for all hooks:
- **S** -- Specific Audience Call-out: Who is this for?
- **P** -- Problem: What pain are they feeling right now?
- **A** -- Audacious Promise: How will you transform them?
- **R** -- Results Preview: Tease the outcome visually or verbally
- **K** -- Keep Curiosity Alive: Do NOT reveal everything in the first 15 seconds

Also use PSPP for shorter-form: Problem + Solution + Proof + Promise in the first 30 seconds.

Stop Stack for scroll interruption: Visual disruptor (shocking prop, unexpected frame) first, then layer meaning with text or bold claim.

## Thumbnail Psychology
- Use the DRIVE Title Framework for both title and thumbnail copy:
  - **D** Desire (health, wealth, relationships angle)
  - **R** Relatability (make clear who it is for)
  - **I** Intrigue (secret, counterintuitive idea, vulnerable BTS)
  - **V** Value Promise (save time, cut effort in half)
  - **E** Emotion (fear, FOMO, urgency)
- Aim for "believable fiction": engineered images that look like perfectly captured candid moments
- Preview thumbnail in vidIQ against real competitor thumbnails before publishing
- Mobile-first: ensure all text is readable at 120px width

## Algorithm Signals to Optimize
- **CTR (Click-Through Rate)**: Below average after 3-4 days = test thumbnail or title (change one variable at a time)
- **Watch Time / AVD (Average View Duration)**: More important than views -- keep viewers until a natural exit point
- **Session Initiation**: YouTube rewards videos that start a watch session, even if viewer moves to other channels after
- **Engagement**: Comments, likes, shares -- pin a question in comments immediately to seed discussion
- **Re-uploads**: Adding video to a curated playlist earns visibility for older content and extends session time

## Content Mix Strategy
- **30% Shorts / Vertical**: Reach strangers, algorithm arms
- **70% Long-form / Horizontal**: Build loyalty, watch time, session depth
- Niche Bending: apply a proven viral format (tier list, rate my X, myth vs. fact) to a market where it has not been used yet
- One for You (algorithm/income), One for Me (creative joy), One for Life (legacy/purpose) -- rotate content intent

## Anti-Patterns
- Never assume cinematic shots or expensive gear equals more views -- simple "eat a hot dog and talk" often outperforms travel vlogs
- Never upload without previewing thumbnail on mobile -- text becomes unreadable at small sizes
- Never produce repetitive thumbnails or recycled title structures -- YouTube 2026 AI targets interchangeable content
- Never use "lifetime access" for courses without an exit strategy -- retiring a Kajabi program is costly
- Never blame shadowbanning -- most reduced reach is low CTR or retention feedback; fix the creative

## Tools
- **vidIQ**: Feed browser tool for outlier identification, title remixing, optimization score
- **Poppy AI**: Mind-map content collaborator -- synthesizes expert advice into scripts using your brand voice
- **Descript / Underlord**: Text-based editor, Studio Sound audio fix, AI B-roll generation
- **Epidemic Sound**: Restriction-free music with AI Adapt feature to reshape tracks per video mood
- **frame.io**: B-roll library organization and frame-specific editor feedback
- **Obsbot Tiny 2**: 4K webcam with AI tracking and gesture control for frictionless recording
- **DJI Mic Mini**: Versatile wireless mic for camera, iPhone, and computer
