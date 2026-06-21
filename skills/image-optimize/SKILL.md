---
name: image-optimize
description: "Convert site images to WebP, add picture elements, optimize for Core Web Vitals. Use when optimizing image performance, reducing page weight, or /image-optimize."
user-invocable: true
argument-hint: "[optional-path-scope]"
---

# Image Optimize

Convert all JPG/PNG images to WebP and update HTML to use `<picture>` elements with fallbacks.

## Steps

1. **Inventory** — Count images and total size:
   ```bash
   find public/images -name "*.jpg" -o -name "*.png" | wc -l
   du -sh public/images/
   ```

2. **Convert all images to WebP** (quality 82, keep originals as fallback):
   ```bash
   find public/images -name "*.jpg" -o -name "*.png" | while read img; do
     out="${img%.*}.webp"
     [ ! -f "$out" ] && cwebp -q 82 -mt "$img" -o "$out" -quiet
   done
   ```

3. **Update hero/LCP images** — Wrap in `<picture>` elements:
   ```html
   <picture>
     <source srcset="/images/hero/hero-1.webp" type="image/webp" />
     <img src="/images/hero/hero-1.jpg" alt="..." width="1920" height="1080" loading="eager" fetchpriority="high" />
   </picture>
   ```

4. **Update page hero components** — If a component accepts `backgroundImage` prop, derive WebP path internally:
   ```astro
   const webpSrc = backgroundImage?.replace(/\.(jpg|jpeg|png)$/i, '.webp');
   ```

5. **Update preload hint** in BaseLayout:
   ```html
   <link rel="preload" as="image" href="/images/hero/hero-1.webp" type="image/webp" fetchpriority="high" />
   ```

6. **Keep og:image as JPG** — Social platforms have inconsistent WebP support. Do NOT change `ogImage` prop references.

7. **Verify**:
   ```bash
   find public/images -name "*.webp" | wc -l
   grep -r "\.jpg\|\.png" src --include="*.astro" | wc -l
   ```

## Rules
- Always keep JPG/PNG originals as fallback (97% browser support for WebP, not 100%)
- LCP image: `loading="eager"` + `fetchpriority="high"`
- Below-fold images: `loading="lazy"`
- All `<img>` tags must have `width` and `height` attributes (prevents CLS)
