---
name: create
description: "AI creative studio — generate images, videos, ads, social posts from one command. Auto-detects format needed. Use when user needs any visual content, creative assets, product shots, social content, video, or /create."
user-invocable: true
argument-hint: "[what-to-create] [optional: format]"
---

# Create — AI Creative Studio

One command for all creative output. Detects what's needed and routes to the right tool.

> **Absorbed alias:** `imagen` → use `/create` (image generation; `imagen` was the low-level Imagen API call).

## Auto-Detection

| User Says | Routes To | Output |
|-----------|-----------|--------|
| "product photo", "image of" | Image generation | JPG/PNG |
| "video", "reel", "demo" | Video generation | MP4 |
| "ad for Instagram/Facebook/TikTok" | Ad package | Images + video + copy |
| "social post", "caption" | Social content | Image + copy + hashtags |
| "thumbnail", "og image" | Sized image | Platform-specific dimensions |
| "banner", "hero" | Wide image | 16:9 |
| "logo", "icon" | Square image | 1:1 |

## Image Generation (Imagen 4.0)

**API**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:predict?key=$GEMINI_API_KEY`

| Model | Use |
|-------|-----|
| `imagen-4.0-generate-001` | Default — reliable, good quality |
| `imagen-4.0-ultra-generate-001` | Hero shots, brand campaigns |
| `imagen-4.0-fast-generate-001` | Batch generation, iterations |

**Aspect Ratios**: 1:1 (social), 3:4 (product), 4:3 (landscape), 16:9 (banner/hero), 9:16 (story/reel)

**Request**:
```json
{"instances":[{"prompt":"..."}],"parameters":{"sampleCount":1,"aspectRatio":"3:4"}}
```
**Response**: `predictions[0].bytesBase64Encoded` → base64 decode → write to file

## Video Generation (Veo 3.x)

**Models**: `veo-3.1-generate-preview` (best) | `veo-3.1-fast-generate-preview` (fast) | `veo-3.1-lite-generate-preview` (quick)

**Method**: `predictLongRunning` (async)
1. POST → returns `{"name": "operations/xxx"}`
2. Poll GET `operations/xxx` until `done: true`
3. Extract `response.predictions[0].bytesBase64Encoded` → MP4

**Parameters**: `durationSeconds` (5-8), `aspectRatio`, `personGeneration: "allow_adult"`

## Ad Package

Per platform, generate:
1. **Hero image** in platform aspect ratio
2. **Lifestyle variant** (product in context)
3. **Video** (5s product spotlight)
4. **Copy**: Hook + value + CTA, 3 variants for A/B testing
5. **Hashtags** (platform-appropriate count)

Platform specs:
| Platform | Image | Video | Copy Limit |
|----------|-------|-------|------------|
| Instagram Feed | 1:1 | 1:1 15s | 2,200 chars |
| Instagram Story | 9:16 | 9:16 15s | Overlay |
| Facebook | 1:1 or 4:5 | 1:1 15s | 125 chars primary |
| TikTok | 9:16 | 9:16 15-30s | 150 chars |
| Google Display | 1.91:1 | N/A | 30+90 chars |

## Social Post

Output per post:
- Caption with line breaks
- Hashtag set
- Image (auto-generated)
- Alt text
- Best posting time

## Prompt Best Practices
- Be specific: demographics, setting, lighting, mood
- Match brand context (don't use wrong demographics for brand)
- Include quality markers: "editorial", "studio lighting", "magazine quality"
- For products: "e-commerce product photography", "clean background"
- For lifestyle: "authentic", "natural lighting", "aspirational"

## Batch Mode
Generate multiple assets in parallel using `&` and `wait`:
```bash
generate "prompt1" "output1.jpg" &
generate "prompt2" "output2.jpg" &
wait
```

## Output Structure
```
creative/
  images/     # All generated images
  video/      # All generated video
  ads/        # Platform-organized ad packages
  social/     # Social media posts
```
