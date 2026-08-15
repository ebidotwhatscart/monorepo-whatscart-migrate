export type BrandPaletteMode = "light" | "dark";

export type GeneratedBrandPalette = {
  id: string;
  seedColor: string;
  mode: BrandPaletteMode;
  colors: [string, string, string];
  primaryColor: string;
};

const DEFAULT_PRIMARY = "#046664";
const STOREFRONT_NEUTRAL = "#f9f9f9";
const LIGHT = "#ffffff";
const DARK = "#111827";
const HUEMINT_API_URL = "https://api.huemint.com/color";
export const BRAND_PALETTE_PAGE_SIZE = 3;
const HUEMINT_RESULTS_PER_REQUEST = 9;
const HUEMINT_ADJACENCY = [
  "0",
  "65",
  "45",
  "35",
  "65",
  "0",
  "35",
  "65",
  "45",
  "35",
  "0",
  "35",
  "35",
  "65",
  "35",
  "0",
];

export function buildFallbackPalette(seedColor: string): GeneratedBrandPalette {
  const primaryColor = normalizeRequiredHexColor(seedColor, "primary color");
  const accentColor = deriveAccentColor(primaryColor);
  const colors: [string, string, string] = [
    primaryColor,
    accentColor,
    STOREFRONT_NEUTRAL,
  ];

  return {
    id: createPaletteId("light", primaryColor, colors),
    seedColor: primaryColor,
    mode: "light",
    colors,
    primaryColor,
  };
}

export async function getGeneratedBrandPalettes(
  seedColor: string,
): Promise<GeneratedBrandPalette[]> {
  const primaryColor = normalizeRequiredHexColor(seedColor, "primary color");
  const response = await fetch(HUEMINT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "transformer",
      num_colors: 4,
      temperature: 1.2,
      num_results: HUEMINT_RESULTS_PER_REQUEST,
      adjacency: HUEMINT_ADJACENCY,
      palette: [LIGHT, primaryColor, "-", STOREFRONT_NEUTRAL],
    }),
  });

  if (!response.ok) {
    throw new Error(`Huemint palette request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as { results?: unknown[] };
  const palettes = createPalettesFromHuemintResults(primaryColor, payload.results);

  if (palettes.length === 0) {
    throw new Error("Huemint palette response did not include a valid accent color.");
  }

  return palettes;
}

export function deriveAccentColor(primaryColor: string): string {
  const normalizedPrimary = normalizeRequiredHexColor(primaryColor, "primary color");

  return isDark(normalizedPrimary)
    ? mix(normalizedPrimary, LIGHT, 0.24)
    : mix(normalizedPrimary, DARK, 0.18);
}

function createPaletteId(
  mode: BrandPaletteMode,
  seedColor: string,
  colors: [string, string, string],
): string {
  const base = [mode, seedColor, ...colors].join("|");
  let hash = 0;

  for (const character of base) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return `palette-${mode}-${hash.toString(36)}`;
}

function createPalettesFromHuemintResults(
  primaryColor: string,
  results: unknown[] | undefined,
): GeneratedBrandPalette[] {
  if (!Array.isArray(results)) {
    return [];
  }

  const seenPaletteIds = new Set<string>();
  const palettes: GeneratedBrandPalette[] = [];

  for (const result of results) {
    const accentColor = extractAccentColor(result, primaryColor);
    if (!accentColor) {
      continue;
    }

    const colors: [string, string, string] = [
      primaryColor,
      accentColor,
      STOREFRONT_NEUTRAL,
    ];
    const id = createPaletteId("light", primaryColor, colors);

    if (seenPaletteIds.has(id)) {
      continue;
    }

    seenPaletteIds.add(id);
    palettes.push({
      id,
      seedColor: primaryColor,
      mode: "light",
      colors,
      primaryColor,
    });
  }

  return palettes;
}

function extractAccentColor(result: unknown, primaryColor: string): string | null {
  const palette = normalizePaletteResult(result);

  if (palette.length >= 3) {
    const indexedAccent = palette[2];
    if (indexedAccent && isAccentCandidate(indexedAccent, primaryColor)) {
      return indexedAccent;
    }
  }

  for (const color of palette) {
    if (isAccentCandidate(color, primaryColor)) {
      return color;
    }
  }

  return null;
}

function normalizePaletteResult(result: unknown): string[] {
  if (Array.isArray(result)) {
    return result
      .map((color) => normalizeOptionalHexColor(color))
      .filter((color): color is string => Boolean(color));
  }

  if (!result || typeof result !== "object") {
    return [];
  }

  const paletteCandidate = (result as { palette?: unknown }).palette;
  if (Array.isArray(paletteCandidate)) {
    return paletteCandidate
      .map((color) => normalizeOptionalHexColor(color))
      .filter((color): color is string => Boolean(color));
  }

  return [];
}

function isAccentCandidate(color: string, primaryColor: string): boolean {
  return (
    color !== primaryColor &&
    color !== LIGHT &&
    color !== STOREFRONT_NEUTRAL
  );
}

function normalizeOptionalHexColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (/^#[0-9a-fA-F]{3}$/.test(trimmedValue)) {
    return expandShortHex(trimmedValue.toLowerCase());
  }

  if (/^#[0-9a-fA-F]{6}$/.test(trimmedValue)) {
    return trimmedValue.toLowerCase();
  }

  if (/^[0-9a-fA-F]{3}$/.test(trimmedValue)) {
    return expandShortHex(`#${trimmedValue.toLowerCase()}`);
  }

  if (/^[0-9a-fA-F]{6}$/.test(trimmedValue)) {
    return `#${trimmedValue.toLowerCase()}`;
  }

  return null;
}

function normalizeRequiredHexColor(value: unknown, label: string): string {
  const normalizedColor = normalizeOptionalHexColor(value);

  if (!normalizedColor) {
    throw new Error(`Invalid ${label}: expected a hex color.`);
  }

  return normalizedColor;
}

function expandShortHex(shortHex: string): string {
  return `#${shortHex
    .replace("#", "")
    .split("")
    .map((char) => `${char}${char}`)
    .join("")}`;
}

function mix(first: string, second: string, amountSecond: number): string {
  const firstRgb = hexToRgb(first);
  const secondRgb = hexToRgb(second);
  const clampedAmount = Math.min(1, Math.max(0, amountSecond));

  return rgbToHex({
    r: Math.round(firstRgb.r * (1 - clampedAmount) + secondRgb.r * clampedAmount),
    g: Math.round(firstRgb.g * (1 - clampedAmount) + secondRgb.g * clampedAmount),
    b: Math.round(firstRgb.b * (1 - clampedAmount) + secondRgb.b * clampedAmount),
  });
}

function isDark(hex: string): boolean {
  return relativeLuminance(hex) < 0.35;
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function hexToRgb(hex: string) {
  const normalized = normalizeRequiredHexColor(hex, "hex color");
  const value = normalized.slice(1);

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

export const STOREFRONT_PALETTE_NEUTRAL = STOREFRONT_NEUTRAL;
export const STOREFRONT_NAV_SURFACE = LIGHT;
export const STOREFRONT_TEXT_NEUTRAL = DARK;
export const DEFAULT_STOREFRONT_PRIMARY = DEFAULT_PRIMARY;
