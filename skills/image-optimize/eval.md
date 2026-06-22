---
skill: image-optimize
---
# Eval: image-optimize

A failing-baseline eval — without the skill the agent ships heavy raster images as-is; with the
skill it converts to modern formats and serves responsive sources for Core Web Vitals.

## Baseline
Prompt the agent **without** the image-optimize skill loaded:

> "The site's images are slow — sort it out." (page ships full-size PNG/JPG hero + gallery)

Observed baseline failure: the agent maybe shrinks one file by hand or says "compress them,"
leaving multi-MB PNG/JPGs served at full resolution to every device with no modern format. LCP
stays poor.

## Pass
With the image-optimize skill loaded, the agent converts images to WebP/AVIF, adds responsive
`<picture>`/`srcset` sources, and sizes them to actual display dimensions for CWV.

Pass criterion: images are emitted in a modern format with responsive sources and correct
dimensions, with a measurable page-weight/LCP reduction. **Fail** if it leaves full-size legacy
formats or only vaguely advises "compress the images."
