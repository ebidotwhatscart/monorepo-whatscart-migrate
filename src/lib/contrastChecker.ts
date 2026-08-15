/**
 * WCAG 2.x contrast checker utility.
 *
 * Two modes:
 *   1. Programmatic API — `contrastRatio(color1, color2)` returns numeric ratio
 *   2. DOM scanner — `scanPageContrast()` walks page, logs failures
 *
 * Bookmarklet snippet (paste in browser console):
 *   import('https://yourdomain.com/assets/contrast-checker.js')
 *
 * Or inline bookmarklet:
 *   javascript:(function(){ [minified scanPageContrast code] })()
 */

// ── WCAG relative luminance ──────────────────────────────────────────

export function sRGBtoLin(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return (
    0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b)
  );
}

// ── Contrast ratio ───────────────────────────────────────────────────

export function contrastRatio(color1: string, color2: string): number {
  const l1 = relativeLuminance(color1);
  const l2 = relativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── WCAG thresholds ───────────────────────────────────────────────────

export type WcagLevel = "AA" | "AAA";

/**
 * Returns required ratio for given WCAG level and text size.
 *   AA normal: 4.5  |  AA large: 3.0
 *   AAA normal: 7.0 |  AAA large: 4.5
 */
export function requiredRatio(
  level: WcagLevel,
  largeText: boolean,
): number {
  if (level === "AA") return largeText ? 3.0 : 4.5;
  return largeText ? 4.5 : 7.0;
}

// ── Helpers ───────────────────────────────────────────────────────────

export function isLargeText(el: Element): boolean {
  const style = window.getComputedStyle(el);
  const fontSize = parseFloat(style.fontSize);
  const fontWeight = parseInt(style.fontWeight, 10);
  // Bold text ≥ 14pt (18.66px) or text ≥ 18pt (24px)
  const isBold = fontWeight >= 700;
  if (isBold && fontSize >= 18.66) return true;
  if (fontSize >= 24) return true;
  return false;
}

/**
 * Walk up ancestor chain to find first non-transparent computed background.
 */
export function resolveBackground(el: Element): string | null {
  let current: Element | null = el;
  while (current) {
    const bg = window.getComputedStyle(current).backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
      // Convert rgb() to hex for consistent comparison
      return rgbToHex(bg);
    }
    current = current.parentElement;
  }
  return null; // no solid bg found (assume white?)
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return rgb; // return as-is if format unexpected
  const [_, r, g, b] = match;
  return `#${[r, g, b]
    .map((c) => Number(c).toString(16).padStart(2, "0"))
    .join("")}`;
}

// ── DOM scanner ───────────────────────────────────────────────────────

export type ContrastIssue = {
  tag: string;
  text: string;
  foreground: string;
  background: string;
  ratio: number;
  required: number;
  level: WcagLevel;
  largeText: boolean;
  selector: string;
};

/**
 * Scan all visible text nodes in document.body and return elements
 * that fail WCAG AA contrast.
 */
export function scanPageContrast(
  level: WcagLevel = "AA",
): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node: Node) => {
        const el = node as Element;
        const style = window.getComputedStyle(el);
        // Skip non-visible, empty, or non-text containers
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0" ||
          ["SCRIPT", "STYLE", "SVG", "PATH", "IMG", "CANVAS"].includes(
            el.tagName,
          )
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        // Only check elements that directly contain text
        const directText = Array.from(el.childNodes).some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim().length > 0,
        );
        if (!directText) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const textColorCache = new Map<Element, string>();

  while (walker.nextNode()) {
    const el = walker.currentNode as Element;

    // Get text color
    let textColor = textColorCache.get(el);
    if (!textColor) {
      const computedColor = window.getComputedStyle(el).color;
      textColor = rgbToHex(computedColor);
      textColorCache.set(el, textColor);
    }

    // Get background
    const bg = resolveBackground(el);
    if (!bg) continue; // cannot determine background
    if (bg === textColor) continue; // same color = invisible, skip

    const lrg = isLargeText(el);
    const ratio = contrastRatio(textColor, bg);
    const req = requiredRatio(level, lrg);

    if (ratio < req) {
      const text =
        el.textContent?.trim().slice(0, 60).replace(/\s+/g, " ") ?? "";
      issues.push({
        tag: el.tagName.toLowerCase(),
        text,
        foreground: textColor,
        background: bg,
        ratio: Math.round(ratio * 100) / 100,
        required: req,
        level,
        largeText: lrg,
        selector: buildSelector(el),
      });
    }
  }

  return issues;
}

function buildSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `#${el.id}`;
  if (el.className && typeof el.className === "string") {
    const cls = el.className
      .split(/\s+/)
      .slice(0, 2)
      .map((c) => `.${CSS.escape(c)}`)
      .join("");
    return `${tag}${cls}`;
  }
  return tag;
}

/**
 * Pretty-print contrast issues to console.
 */
export function printContrastIssues(issues: ContrastIssue[]): void {
  if (issues.length === 0) {
    console.log("✅ No WCAG AA contrast issues found.");
    return;
  }
  console.log(`❌ ${issues.length} WCAG AA contrast issue(s) found:\n`);
  issues.forEach((issue, i) => {
    console.log(
      `${i + 1}. <${issue.tag}> "${issue.text}"`,
    );
    console.log(
      `   Foreground: ${issue.foreground}  |  Background: ${issue.background}`,
    );
    console.log(
      `   Ratio: ${issue.ratio}:1  (required: ${issue.required}:1 for ${issue.level} ${issue.largeText ? "large" : "normal"} text)`,
    );
    console.log(`   Selector: ${issue.selector}\n`);
  });
}

export default {
  contrastRatio,
  relativeLuminance,
  scanPageContrast,
  printContrastIssues,
};
