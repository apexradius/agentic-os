---
name: imagen
description: "Generate images via Google Imagen 4.0 API directly. Low-level generation tool. Use when calling Imagen API directly; prefer /ai-image for most image tasks."
argument-hint: "[prompt] [output-path] [aspect-ratio]"
---

# Imagen 4.0 Image Generator

Generate high-quality images via Google's Imagen 4.0 API.

## API Details
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict`
- **Auth**: `?key=$GEMINI_API_KEY` (from environment or `.zshrc`)
- **Method**: POST with JSON body

## Request Format
```json
{
  "instances": [{"prompt": "your prompt here"}],
  "parameters": {"sampleCount": 1, "aspectRatio": "3:4"}
}
```

## Aspect Ratios
- `1:1` — Square (profile pics, social)
- `3:4` — Portrait (product photos, cards)
- `4:3` — Landscape (thumbnails)
- `16:9` — Widescreen (heroes, banners)
- `9:16` — Story/reel format

## Response Handling
```python
import json, base64
data = json.loads(response)
img = base64.b64decode(data["predictions"][0]["bytesBase64Encoded"])
with open("output.jpg", "wb") as f:
    f.write(img)
```

## Prompt Best Practices
- Be specific about style: "editorial", "product photography", "lifestyle"
- Include lighting: "studio lighting", "golden hour", "soft natural light"
- Include context: demographics, setting, mood
- Include quality: "4k", "high-end", "magazine quality"
- Avoid: generic descriptions, wrong demographics for brand

## Available Models
- `imagen-4.0-generate-001` — Standard (recommended)
- `imagen-4.0-ultra-generate-001` — Ultra quality
- `imagen-4.0-fast-generate-001` — Fast generation

## Batch Generation
Use parallel curl calls with `&` and `wait` for multiple images.
