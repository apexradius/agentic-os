import type { Page, Locator } from "playwright";

/**
 * Adds human-like delay between actions
 */
export async function sleep(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates a Bezier curve path between two points for natural mouse movement
 */
function generateBezierPath(startX: number, startY: number, endX: number, endY: number, steps: number) {
  // Random control points to create human-like arc
  const cp1X = startX + (endX - startX) * Math.random();
  const cp1Y = startY + (endY - startY) * Math.random();
  const cp2X = startX + (endX - startX) * Math.random();
  const cp2Y = startY + (endY - startY) * Math.random();

  const path = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.pow(1 - t, 3) * startX +
              3 * Math.pow(1 - t, 2) * t * cp1X +
              3 * (1 - t) * Math.pow(t, 2) * cp2X +
              Math.pow(t, 3) * endX;
    const y = Math.pow(1 - t, 3) * startY +
              3 * Math.pow(1 - t, 2) * t * cp1Y +
              3 * (1 - t) * Math.pow(t, 2) * cp2Y +
              Math.pow(t, 3) * endY;
    path.push({ x, y });
  }
  return path;
}

/**
 * Moves mouse to a target using a Bezier path with variable speed
 */
async function ghostMove(page: Page, targetX: number, targetY: number) {
  const startX = await page.evaluate(() => window.screenX + (window.innerWidth / 2), null);
  const startY = await page.evaluate(() => window.screenY + (window.innerHeight / 2), null);
  
  const steps = 15 + Math.floor(Math.random() * 20);
  const path = generateBezierPath(startX, startY, targetX, targetY, steps);

  for (const point of path) {
    await page.mouse.move(point.x, point.y);
    // Variable speed: slower at start/end, faster in middle (human-like)
    const delay = Math.random() * 5 + 2; 
    await new Promise(r => setTimeout(r, delay));
  }
}

/**
 * Moves mouse to a random point within the element's bounding box with human-like jitter
 */
export async function humanClick(page: Page, selector: string | Locator): Promise<void> {
  const locator = typeof selector === "string" ? page.locator(selector) : selector;
  const box = await locator.boundingBox();
  
  if (!box) {
    await locator.click();
    return;
  }

  const padding = 5;
  const targetX = box.x + padding + Math.random() * (box.width - padding * 2);
  const targetY = box.y + padding + Math.random() * (box.height - padding * 2);

  await ghostMove(page, targetX, targetY);
  
  await sleep(200, 600);
  
  await page.mouse.down();
  await sleep(80, 220);
  await page.mouse.up();
}

/**
 * Types text with randomized delays and occasional backspaces to mimic human errors
 */
export async function humanType(page: Page, selector: string | Locator, text: string): Promise<void> {
  const locator = typeof selector === "string" ? page.locator(selector) : selector;
  await locator.focus();
  await sleep(400, 900);

  for (const char of text) {
    // 3% chance of typing a wrong character and correcting it
    if (Math.random() < 0.03 && text.length > 5) {
      const chars = "abcdefghijklmnopqrstuvwxyz";
      const wrongChar = chars.charAt(Math.floor(Math.random() * chars.length));
      await page.keyboard.type(wrongChar); 
      await sleep(150, 450);
      await page.keyboard.press("Backspace");
      await sleep(250, 550);
    }

    await page.keyboard.type(char);
    // Mimic varying typing speed (bursts of speed)
    const delay = Math.random() > 0.85 ? 400 + Math.random() * 500 : 30 + Math.random() * 100;
    await sleep(delay, delay);
  }
}

/**
 * Modern 2026 User-Agents
 */
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.6312.122 Safari/537.36"
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}
