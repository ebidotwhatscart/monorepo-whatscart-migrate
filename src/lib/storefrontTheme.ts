import {
  buildFallbackPalette,
  deriveAccentColor,
  STOREFRONT_NAV_SURFACE,
  STOREFRONT_PALETTE_NEUTRAL,
  STOREFRONT_TEXT_NEUTRAL,
} from "./brandPalette";

type BusinessBrandPalette = {
  seedColor: string;
  mode: "light" | "dark";
  colors: string[];
  primaryColor: string;
};

export type StorefrontTheme = {
  background: string;
  surface: string;
  surfaceStrong: string;
  surfaceMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  support: string;
  supportSoft: string;
  heroOverlay: string;
  ctaBackground: string;
  ctaText: string;
  ctaSecondaryBackground: string;
  ctaSecondaryText: string;
  shippingBarBackground: string;
  shippingBarText: string;
  footerBackground: string;
  footerText: string;
  footerMutedText: string;
  chipBackground: string;
  chipText: string;
  cartBadgeBackground: string;
  cartBadgeText: string;
};

const DEFAULT_PRIMARY = "#046664";
const WHITE = STOREFRONT_NAV_SURFACE;
const DARK = STOREFRONT_TEXT_NEUTRAL;

export function createStorefrontTheme({
  themeColor,
  brandPalette,
}: {
  themeColor?: string;
  brandPalette?: BusinessBrandPalette;
}): StorefrontTheme {
  const primary = getPrimaryColor(themeColor, brandPalette);
  const accent = getAccentColor(primary, brandPalette);
  const neutral = getNeutralColor(brandPalette);
  const primaryText = pickReadableText(primary);
  const accentText = pickReadableText(accent);
  const bodyText = DARK;

  return {
    background: neutral,
    surface: WHITE,
    surfaceStrong: WHITE,
    surfaceMuted: mix(neutral, primary, 0.06),
    border: mix(neutral, DARK, 0.12),
    textPrimary: bodyText,
    textSecondary: mix(bodyText, WHITE, 0.42),
    accent: primary,
    accentStrong: primary,
    accentSoft: mix(neutral, primary, 0.16),
    support: accent,
    supportSoft: mix(neutral, accent, isDark(accent) ? 0.08 : 0.14),
    heroOverlay: `linear-gradient(180deg, ${withAlpha(
      neutral,
      0
    )} 0%, ${withAlpha('#000', 0.72)} 100%, ${withAlpha(DARK, 0.96)} 100%)`,
    ctaBackground: primary,
    ctaText: primaryText,
    ctaSecondaryBackground: accent,
    ctaSecondaryText: accentText,
    shippingBarBackground: primary,
    shippingBarText: primaryText,
    footerBackground: primary,
    footerText: primaryText,
    footerMutedText: mix(primaryText, primary, 0.28),
    chipBackground: mix(neutral, primary, 0.1),
    chipText: bodyText,
    cartBadgeBackground: accent,
    cartBadgeText: accentText,
  };
}

function getPrimaryColor(
  themeColor: string | undefined,
  brandPalette: BusinessBrandPalette | undefined,
): string {
  const fromPalette = normalizeHex(brandPalette?.primaryColor);
  if (fromPalette) return fromPalette;

  const fromTheme = normalizeHex(themeColor);
  if (fromTheme) return fromTheme;

  return buildFallbackPalette(DEFAULT_PRIMARY).primaryColor;
}

function getAccentColor(
  primary: string,
  brandPalette: BusinessBrandPalette | undefined,
): string {
  const storedPrimary = normalizeHex(brandPalette?.colors?.[0]);
  const storedAccent = normalizeHex(brandPalette?.colors?.[1]);

  if (storedPrimary === primary && storedAccent) {
    return storedAccent;
  }

  return deriveAccentColor(primary);
}

function getNeutralColor(
  brandPalette: BusinessBrandPalette | undefined,
): string {
  const storedNeutral = normalizeHex(brandPalette?.colors?.[2]);
  return storedNeutral ?? STOREFRONT_PALETTE_NEUTRAL;
}

function normalizeHex(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return expandShortHex(trimmed.toLowerCase());
  }

  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toLowerCase()}`;
  }

  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    return expandShortHex(`#${trimmed.toLowerCase()}`);
  }

  return null;
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

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex) ?? DEFAULT_PRIMARY;
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

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function pickReadableText(background: string): string {
  return contrastRatio(background, WHITE) >= contrastRatio(background, DARK)
    ? WHITE
    : DARK;
}

export function isDark(hex: string): boolean {
  return relativeLuminance(hex) < 0.35;
}
