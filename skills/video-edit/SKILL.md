---
name: video-edit
description: "Edit existing video and audio end to end with FFmpeg: inspect footage, make cuts, reframe, clean and mix audio, create captions, add overlays, assemble timelines, export platform variants, and verify the rendered media. Use when the user asks Codex to edit, cut, trim, caption, resize, remix, clean up, or assemble a video."
user-invocable: true
disable-model-invocation: false
argument-hint: "[input media or folder] [editing brief] [output path]"
---

# Video Edit

Act as a non-linear video editor driven by an explicit edit decision list. Use FFmpeg and
FFprobe for media operations; use `video-compose` when the edit needs precise motion graphics,
animated typography, or reusable branded templates. Never modify source footage.

## Outcome

Deliver a playable final export whose content, timing, framing, captions, audio, duration,
resolution, frame rate, and codecs have been checked against the brief.

## Workflow

1. **Inventory before editing.** Resolve every input path and inspect each asset with FFprobe.
   Record duration, streams, codecs, dimensions, frame rate, rotation, sample rate, channels,
   and subtitle tracks. Generate a contact sheet when shot selection is not obvious.
2. **Translate the brief into an edit decision list.** State source in/out points, ordering,
   transitions, crop/reframe decisions, text, captions, audio treatment, and target deliverables.
   Keep timecodes exact. If the user gives only an outcome, infer the most conservative coherent
   cut from the footage and preserve a reversible intermediate.
3. **Choose the least destructive path.** Use stream-copy for clean keyframe-aligned cuts and
   remuxes. Re-encode only when filters, exact cuts, normalization, compositing, or codec changes
   require it. Use one filter graph for connected transformations to avoid generation loss.
4. **Build the timeline.** Trim and order clips, normalize orientation and pixel format, then add
   reframing, transitions, overlays, captions, B-roll, and audio. Escape user text through files
   or subtitle tracks rather than interpolating it unsafely into a shell filter.
5. **Treat audio as load-bearing.** Measure with `loudnorm`; remove rumble or noise conservatively;
   preserve speech intelligibility; add fades at hard cuts; duck music beneath speech. Default
   delivery targets: about -14 LUFS for web/social and -16 LUFS for spoken-word unless the brief
   or platform specifies otherwise. Prevent true-peak clipping.
6. **Handle captions as data.** Prefer a reviewed SRT or WebVTT sidecar. Preserve wording and
   timing separately from style. Burn captions only when the platform or brief requires it; also
   deliver the sidecar when useful. Never claim auto-transcribed captions are accurate without
   reviewing them against the audio.
7. **Export intentionally.** Default web master: MP4, H.264 High profile, `yuv420p`, AAC 48 kHz,
   `+faststart`, constant frame rate matching the source or brief. Create platform variants from
   the master or shared mezzanine, not from already compressed social exports.
8. **Verify the artifact.** FFprobe the final file; decode it end to end with FFmpeg's null muxer;
   check expected duration, resolution, frame rate, codecs, audio presence, and subtitle state;
   inspect the first, middle, and last frames. A zero exit code alone is not proof of a good edit.

## Editing primitives

```bash
# Inspect machine-readable media metadata
ffprobe -v error -print_format json -show_format -show_streams input.mp4

# Exact trim (re-encodes around the requested timestamps)
ffmpeg -ss 00:00:03.250 -to 00:00:11.800 -i input.mp4 \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart output.mp4

# Vertical reframe with a safe centered crop
ffmpeg -i input.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" \
  -c:v libx264 -crf 18 -c:a aac -movflags +faststart vertical.mp4

# Burn reviewed captions; keep the source subtitle file beside the export
ffmpeg -i input.mp4 -vf "subtitles=captions.srt" \
  -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart captioned.mp4

# Decode verification: any corrupt packet or broken stream fails loudly
ffmpeg -v error -xerror -i final.mp4 -f null -
```

## Safety and quality invariants

- Source media is immutable; outputs go to a separate `renders/` or user-selected directory.
- Never overwrite an existing output unless the user explicitly requests replacement; use
  versioned names by default.
- Never download or reuse copyrighted media merely because a URL is available. Confirm the user
  supplied it or has the right to use it.
- Never invent missing footage, spoken words, brand claims, or caption text.
- Preserve aspect ratio unless a deliberate crop is part of the edit.
- Do not use `-c copy` across incompatible formats or for cuts that require frame accuracy.
- Keep temporary assets outside git and remove them only after the verified master exists.
- Report the exact output path and the checks that passed. If visual or transcript review remains
  human-dependent, name that boundary explicitly.

## Route related work

- Use `video-compose` for deterministic motion graphics and branded templates.
- Use `video-produce` or `ai-video` only when the brief requires newly generated footage.
- Use image generation for thumbnails or still assets, then import the result into this timeline.
