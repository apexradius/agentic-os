---
name: convert
description: "Convert between file formats — documents, images, video, data. Tool selection, quality validation, batch support. Use when converting files, changing formats, /convert."
user-invocable: true
argument-hint: "[input-file] [output-format]"
---

# File Converter

## Step 1: Identify Conversion and Select Tool

### Document Conversions
| From → To | Tool | Command |
|-----------|------|---------|
| Markdown → HTML | pandoc | `pandoc input.md -o output.html --standalone` |
| HTML → Markdown | pandoc | `pandoc input.html -o output.md` |
| Markdown → PDF | pandoc | `pandoc input.md -o output.pdf --pdf-engine=wkhtmltopdf` |
| HTML → PDF | wkhtmltopdf | `wkhtmltopdf input.html output.pdf` |
| DOCX → PDF | pandoc | `pandoc input.docx -o output.pdf` |
| DOCX → Markdown | pandoc | `pandoc input.docx -o output.md` |
| PDF → Text | pdftotext | `pdftotext input.pdf output.txt` |

### Data Conversions
| From → To | Tool | Command |
|-----------|------|---------|
| JSON → CSV | python3 | `python3 -c "import json,csv,sys; ..."` |
| CSV → JSON | python3 | `python3 -c "import json,csv,sys; ..."` |
| YAML → JSON | python3 | `python3 -c "import yaml,json,sys; ..."` |
| JSON → YAML | python3 | `python3 -c "import yaml,json,sys; ..."` |
| XLSX → CSV | python3 | `python3 -c "import openpyxl; ..."` |
| XML → JSON | python3 | `python3 -c "import xmltodict,json; ..."` |

### Image Conversions
| From → To | Tool | Command |
|-----------|------|---------|
| PNG/JPG → WebP | cwebp | `cwebp -q 80 input.png -o output.webp` |
| WebP → PNG | dwebp | `dwebp input.webp -o output.png` |
| SVG → PNG | rsvg-convert | `rsvg-convert -w 1024 input.svg -o output.png` |
| Image resize | sips (macOS) | `sips -Z 1024 input.jpg --out output.jpg` |
| HEIC → JPG | sips (macOS) | `sips -s format jpeg input.heic --out output.jpg` |
| Batch optimize | ImageMagick | `mogrify -quality 85 -resize 1920x *.jpg` |

### Video/Audio Conversions
| From → To | Tool | Command |
|-----------|------|---------|
| Any → MP4 (H.264) | ffmpeg | `ffmpeg -i input.mov -c:v libx264 -crf 23 output.mp4` |
| Any → MP3 | ffmpeg | `ffmpeg -i input.mp4 -vn -acodec libmp3lame -q:a 2 output.mp3` |
| Video → GIF | ffmpeg | `ffmpeg -i input.mp4 -vf "fps=10,scale=480:-1" output.gif` |
| Vertical crop | ffmpeg | `ffmpeg -i input.mp4 -vf "crop=ih*9/16:ih" output.mp4` |
| Extract frames | ffmpeg | `ffmpeg -i input.mp4 -vf "fps=1" frame_%04d.png` |

## Step 2: Pre-Conversion Checks

Before converting:
1. Verify input file exists and is readable
2. Check required tool is installed: `which pandoc ffmpeg cwebp` etc.
3. If tool is missing, install it: `brew install pandoc` / `brew install ffmpeg` / etc.
4. For large files, estimate output size and check disk space

## Step 3: Quality Validation After Conversion

After every conversion, verify the output:

| Check | How |
|-------|-----|
| File exists and non-zero | `test -s output.file` |
| Document renders correctly | Open with appropriate viewer or spot-check content |
| Image dimensions correct | `sips -g pixelHeight -g pixelWidth output.img` (macOS) |
| Video playable | `ffprobe output.mp4` — check duration, codec, resolution |
| Data integrity | Compare row/record count between input and output |
| File size reasonable | Output should not be 10x larger or empty |

## Step 4: Batch Conversion

For converting multiple files:

```bash
# Convert all markdown files to HTML
for f in *.md; do pandoc "$f" -o "${f%.md}.html" --standalone; done

# Convert all images to WebP
for f in *.{png,jpg,jpeg}; do cwebp -q 80 "$f" -o "${f%.*}.webp"; done

# Convert all MOV to MP4
for f in *.mov; do ffmpeg -i "$f" -c:v libx264 -crf 23 "${f%.mov}.mp4"; done
```

Report: total files, successful, failed (with error messages for failures).

## Decision Criteria

| Situation | Recommendation |
|-----------|---------------|
| Web deployment | Convert images to WebP (30-50% smaller than JPEG) |
| Email attachment | PDF for documents, JPEG for images (universal support) |
| Data exchange | JSON for APIs, CSV for spreadsheets, YAML for config |
| Archival | PNG for lossless images, original format for video |
| Performance | Lower quality settings (-q 60, -crf 28) for drafts; higher for production |

## Anti-Patterns

- **Converting without checking tool availability** — fails with cryptic errors; verify tools first
- **No quality validation** — corrupted output goes unnoticed; always verify after conversion
- **Lossy round-trips** — JPEG → PNG → JPEG degrades quality each time; keep originals
- **Ignoring metadata** — EXIF data, PDF metadata, and video chapters may be stripped; preserve when needed
- **Hardcoded quality settings** — different content needs different settings; photos need higher quality than screenshots
