---
name: ai-image
description: "Generate AI images — product photos, social media, thumbnails, logos, mockups. Batch generation, design principles, functional color mapping. Use when generating images, product shots, banners, or /ai-image."
user-invocable: true
argument-hint: "[use-case] [description] [output-dir]"
---

# AI Image Generator

Comprehensive image generation for all business needs.

## Models
| Model | Best For | Speed |
|-------|----------|-------|
| `imagen-4.0-generate-001` | General purpose, reliable | Medium |
| `imagen-4.0-ultra-generate-001` | Maximum quality, hero shots | Slow |
| `imagen-4.0-fast-generate-001` | Quick iterations, batches | Fast |
| `gemini-2.5-flash-image` | Edit existing images, variations | Fast |
| `gemini-3-pro-image-preview` | Complex scenes, text in images | Medium |

## Use Cases & Prompts

### Product Photography
```
Professional e-commerce product photography of [product], placed on [surface],
[brand aesthetic] style, studio lighting, clean [color] background, 4k quality
```
Aspect: 3:4 | Model: imagen-4.0-generate-001

### Social Media Post
```
[Platform]-optimized visual of [subject], [mood] aesthetic, vibrant colors,
engaging composition, [brand] style, social media content
```
Aspect: 1:1 (feed) or 9:16 (story) | Model: imagen-4.0-fast-generate-001

### Hero/Banner
```
Editorial [industry] photography, [subject], [lighting description],
[mood] atmosphere, magazine campaign quality, widescreen cinematic
```
Aspect: 16:9 | Model: imagen-4.0-ultra-generate-001

### Lifestyle/Brand
```
Lifestyle photography of [person description] using [product], [setting],
natural lighting, authentic and aspirational, brand campaign aesthetic
```
Aspect: 4:3 or 16:9 | Model: imagen-4.0-generate-001

### Mockup
```
Professional mockup of [item] with [design] printed/displayed, [setting],
photorealistic, clean presentation, design portfolio quality
```
Aspect: varies | Model: imagen-4.0-generate-001

### Texture/Pattern
```
Seamless [material] texture, [color palette], [style] aesthetic,
tileable pattern, high resolution, design resource
```
Aspect: 1:1 | Model: imagen-4.0-fast-generate-001

## Batch Generation Script
```python
import json, base64, urllib.request
from concurrent.futures import ThreadPoolExecutor

API_KEY = os.environ.get("GEMINI_API_KEY")
URL = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key={API_KEY}"

def generate(prompt, output_path, ratio="3:4"):
    body = json.dumps({"instances":[{"prompt":prompt}],"parameters":{"sampleCount":1,"aspectRatio":ratio}}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type":"application/json"})
    resp = json.loads(urllib.request.urlopen(req, timeout=60).read())
    img = base64.b64decode(resp["predictions"][0]["bytesBase64Encoded"])
    with open(output_path, "wb") as f: f.write(img)

# Parallel generation
with ThreadPoolExecutor(max_workers=4) as pool:
    pool.submit(generate, "prompt1", "out1.jpg")
    pool.submit(generate, "prompt2", "out2.jpg")
```

## Image Editing (Gemini multimodal)
Gemini image models can edit existing images:
- Upload source image + text prompt describing the edit
- Use `gemini-2.5-flash-image` for fast edits
- Good for: color correction, background removal prompts, style transfer descriptions

## Design Principles for AI Image Prompts

### Why Before What
Every visual element must serve a purpose — aesthetic choices that don't serve communication are noise. Define the intent (emotional response, hierarchy, action) before defining the style.

### Temporal Flow (Impact → Linger → Release)
Design the viewing experience as a sequence:
1. **Impact**: Highest contrast/largest element draws first attention
2. **Linger**: Supporting visuals and proof hold the eye
3. **Release**: White space or low-density zone lets the brain reset

### Cognitive Relief Zones
Intentional low-density areas (soft tones, empty space) between high-information sections. Every "loud" moment needs a quiet zone before it to maximize impact.

### 4-8-16 Spacing Rule
- **4px**: Icon/text padding, micro gaps
- **8px**: Moderate element gaps
- **16px**: Section breathing room
Multiples of 4 keep layouts feeling intentional and organized.

### Ownability Gap
Before generating an image: pull 10-20 competitors in the niche and identify the repeated, predictable visual patterns. Then deliberately create something that occupies the visual space competitors haven't taken.

### Functional Color Mapping
Assign roles to colors, not taste preferences:
- **Action**: CTAs and buttons
- **Communicator**: Headings and key text
- **Anchor**: Icons, borders, structural elements
- **Neutral**: Breathing room

### 10-Second Test
After generating: show to a fresh viewer. If they can't identify the "one idea" within 10 seconds, cut elements until the hierarchy is clear.
