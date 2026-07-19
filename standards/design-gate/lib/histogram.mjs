// lib/histogram.mjs — palette analysis over a set of colors.
//
// design.md bans one-hue palettes and beige/brown monotones, and calls out purple/blue
// gradient domination. Those are statements about the *distribution* of hue across a
// surface, so they need a histogram, not a per-declaration check.

import { isNeutral, rgbToHsl } from './color.mjs';

/**
 * Classify a palette from a list of {r,g,b,a} colors.
 * Neutrals (near b/w/gray) are excluded — every palette has them; they say nothing about hue.
 * @returns {{
 *   chromaticCount:number,
 *   dominantHue:number|null,
 *   spreadDegrees:number|null,
 *   oneHue:boolean,
 *   beigeBrown:boolean
 * }}
 */
export function classifyPalette(colors) {
  const hues = [];
  let beigeBrownCount = 0;
  for (const c of colors) {
    if (isNeutral(c)) continue;
    const { h, s, l } = rgbToHsl(c);
    hues.push(h);
    // beige/brown: warm hue band (20–50°), muted, mid-to-light — the "AI cream" monotone
    if (h >= 20 && h <= 50 && s < 55 && l > 25) beigeBrownCount++;
  }
  const chromaticCount = hues.length;
  if (chromaticCount === 0) {
    return {
      chromaticCount: 0,
      dominantHue: null,
      spreadDegrees: null,
      oneHue: false,
      beigeBrown: false,
    };
  }

  // Circular spread: smallest arc that contains all hues.
  const sorted = [...hues].sort((a, b) => a - b);
  let maxGap = 0,
    gapStart = 0;
  for (let i = 0; i < sorted.length; i++) {
    const next = i === sorted.length - 1 ? sorted[0] + 360 : sorted[i + 1];
    const gap = next - sorted[i];
    if (gap > maxGap) {
      maxGap = gap;
      gapStart = i;
    }
  }
  const spreadDegrees = 360 - maxGap;
  const dominantHue = Math.round(sorted[(gapStart + 1) % sorted.length]);

  // one-hue: enough distinct chromatic colors, all packed into a narrow arc.
  const oneHue = chromaticCount >= 4 && spreadDegrees <= 35;
  // beige/brown monotone: the warm muted band dominates the chromatic colors.
  const beigeBrown = chromaticCount >= 3 && beigeBrownCount / chromaticCount >= 0.75;

  return { chromaticCount, dominantHue, spreadDegrees, oneHue, beigeBrown };
}

/** Are the chromatic stops of a gradient predominantly in the blue→purple band (215–290°)? */
export function isPurpleBlueDominated(colors) {
  let chromatic = 0,
    band = 0;
  for (const c of colors) {
    if (isNeutral(c)) continue;
    chromatic++;
    const { h } = rgbToHsl(c);
    if (h >= 215 && h <= 290) band++;
  }
  return chromatic >= 2 && band / chromatic >= 0.6;
}
