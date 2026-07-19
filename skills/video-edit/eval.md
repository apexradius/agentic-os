---
eval-type: baseline
---

# Video Edit Evaluation

## Baseline

Given a folder containing mixed-orientation clips, dialogue audio, and a reviewed caption file,
ask the model to produce a vertical social edit. Without this skill, the response fails if it
starts transforming media before inventorying streams, overwrites source footage, interpolates
untrusted caption text into a shell filter, omits audio treatment, or calls the export complete
without decoding and probing the rendered file.

## Pass

The response must produce an explicit edit decision list, keep source media immutable, choose
stream-copy versus re-encoding deliberately, preserve aspect ratio through an intentional crop,
handle captions as a reviewed sidecar, measure and normalize audio without clipping, export a
versioned H.264/AAC web master, and verify the result with FFprobe, a full decode, and frame checks.
