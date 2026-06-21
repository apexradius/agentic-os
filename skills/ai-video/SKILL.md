---
name: ai-video
description: "Generate AI videos via Veo 3.x API — product demos, social content, ads, brand videos. Human Edge Framework, 10-80-10 rule. Use when creating video content, AI video generation, or /ai-video."
user-invocable: true
argument-hint: "[prompt] [output-path]"
---

# AI Video Generator (Veo 3.x)

Generate high-quality AI videos via Google's Veo API.

## Available Models
| Model | Speed | Quality | Use Case |
|-------|-------|---------|----------|
| `veo-3.1-generate-preview` | Slow | Highest | Hero ads, brand films |
| `veo-3.1-fast-generate-preview` | Medium | High | Product demos, social |
| `veo-3.1-lite-generate-preview` | Fast | Good | Quick iterations, stories |
| `veo-3.0-generate-001` | Slow | High | Stable production use |
| `veo-3.0-fast-generate-001` | Medium | Good | Batch generation |
| `veo-2.0-generate-001` | Medium | Good | Legacy/fallback |

## API Details
- **Method**: `predictLongRunning` (async — returns operation ID, poll for result)
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:predictLongRunning?key=$GEMINI_API_KEY`

## Request Format
```json
{
  "instances": [{"prompt": "your video prompt"}],
  "parameters": {
    "sampleCount": 1,
    "durationSeconds": 5,
    "aspectRatio": "16:9",
    "personGeneration": "allow_adult"
  }
}
```

## Async Flow
1. **Submit**: POST to predictLongRunning → returns `{"name": "operations/xxx"}`
2. **Poll**: GET `https://generativelanguage.googleapis.com/v1beta/{operation_name}?key=$GEMINI_API_KEY`
3. **Check**: `response.done == true` means complete
4. **Extract**: `response.response.predictions[0].bytesBase64Encoded` → decode to MP4

## Poll Script
```python
import time, json, urllib.request, base64

op_name = "operations/xxx"
while True:
    url = f"https://generativelanguage.googleapis.com/v1beta/{op_name}?key={API_KEY}"
    resp = json.loads(urllib.request.urlopen(url).read())
    if resp.get("done"):
        video = base64.b64decode(resp["response"]["predictions"][0]["bytesBase64Encoded"])
        with open("output.mp4", "wb") as f: f.write(video)
        break
    time.sleep(10)
```

## Prompt Best Practices
- **Be cinematic**: "slow dolly shot", "tracking shot", "aerial view", "close-up"
- **Specify motion**: "camera pans left", "zoom in slowly", "static tripod shot"
- **Include mood**: "warm golden hour lighting", "dramatic shadows", "soft focus background"
- **Duration**: 5-8 seconds typical. Keep prompts focused on one scene.

## Video Ad Formats
- **Product hero** (5s): Slow zoom on product, dramatic lighting, logo reveal
- **Social reel** (8s): Lifestyle moment, fast cuts implied via prompt
- **Before/after** (6s): Transition from problem to solution
- **Testimonial backdrop** (5s): Ambient lifestyle loop for overlaying text

## AI Video Production Principles

### Human Edge Framework
AI generates the frames; humans provide three irreplaceable elements:
- **Taste** — knowing which output is actually good
- **Craft** — storytelling, pacing, narrative structure
- **Judgment** — knowing what to publish, cut, or rework

### 10-80-10 Rule (for AI-assisted production)
- Human does first **10%**: concept direction, creative brief, shot list
- AI does middle **80%**: drafting, generating, iterating
- Human does final **10%**: quality gate, taste check, final cut decision

### Content Mix Strategy
- **30%** Short-form (Shorts/Reels): discovery and reach
- **70%** Long-form: loyalty, trust, and authority

### Stop-Stack Formula (Short-form)
Interrupt the scroll within 1.5 seconds:
1. **Stop**: Visual or audio pattern interrupt (unusual opening, movement)
2. **Stack**: Bold text claims or tension-building copy layered on top

### Niche Bending
Take a proven format (tier list, 100-day challenge, "I tried X for 30 days") and apply it to a market/niche where that format hasn't been used yet.

## Anti-Patterns
- **Inauthentic AI Trap**: 100% AI-generated (script + voice + visuals) with no human fingerprint → demonetization risk and audience distrust
- **Optimization Blindness**: Filling in all metadata boxes but ignoring whether title/thumbnail actually attracts human interest
