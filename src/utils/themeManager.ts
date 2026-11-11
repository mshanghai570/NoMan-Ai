import type { CustomTheme, UserSettings } from '../types';
import { BUILTIN_THEMES } from '../constants/themes';

const loadedFonts = new Set<string>();

/**
 * Dynamically loads a Google Font by family name into the document <head>.
 */
export const loadGoogleFont = (fontFamily: string): void => {
  if (typeof document === 'undefined' || !fontFamily) return;

  const cleanFamily = fontFamily.trim();
  // Standard system fonts don't need loading
  if (
    cleanFamily === 'system-ui' ||
    cleanFamily === '-apple-system' ||
    cleanFamily === 'sans-serif' ||
    cleanFamily === 'monospace' ||
    cleanFamily === 'serif'
  ) {
    return;
  }

  const fontId = `gf-${cleanFamily.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  if (loadedFonts.has(fontId) || document.getElementById(fontId)) {
    loadedFonts.add(fontId);
    return;
  }

  try {
    const formattedFamily = cleanFamily.replace(/\s+/g, '+');
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${formattedFamily}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap`;
    document.head.appendChild(link);
    loadedFonts.add(fontId);
  } catch (err) {
    console.warn(`Could not dynamically load Google Font "${cleanFamily}":`, err);
  }
};

/**
 * Finds the active theme object given user settings.
 */
export const resolveActiveTheme = (settings: UserSettings): CustomTheme => {
  // 1. Check if an active custom theme object is provided
  if (settings.theme === 'custom' && settings.activeCustomTheme) {
    return settings.activeCustomTheme;
  }

  // 2. Check if a saved custom theme matches by ID
  if (settings.customThemes && settings.customThemes.length > 0) {
    const found = settings.customThemes.find((t) => t.id === settings.theme);
    if (found) return found;
  }

  // 3. Check built-in themes
  const builtin = BUILTIN_THEMES.find((t) => t.id === settings.theme);
  if (builtin) return builtin;

  // Default to OLED Pitch Black
  return BUILTIN_THEMES[0];
};

/**
 * Applies CSS custom variables and loads typography into the DOM.
 */
export const applyThemeToDocument = (settings: UserSettings): void => {
  if (typeof document === 'undefined') return;

  const theme = resolveActiveTheme(settings);
  const root = document.documentElement;

  // 1. Resolve typography
  const bodyFont = settings.fontFamily || theme.typography.fontFamily || 'Plus Jakarta Sans';
  const headingFont = settings.fontHeading || theme.typography.headingFont || bodyFont;
  const monoFont = settings.fontMono || theme.typography.monoFont || 'JetBrains Mono';

  // Load Google Fonts
  loadGoogleFont(bodyFont);
  if (headingFont !== bodyFont) loadGoogleFont(headingFont);
  if (monoFont && monoFont !== 'JetBrains Mono') loadGoogleFont(monoFont);

  // If theme has explicit googleFontFamilies
  if (theme.typography.googleFontFamilies) {
    theme.typography.googleFontFamilies.forEach(loadGoogleFont);
  }

  // 2. Resolve font scale
  let fontScale = '1';
  if (settings.fontSizeScale === 'compact') fontScale = '0.93';
  if (settings.fontSizeScale === 'relaxed') fontScale = '1.08';

  // 3. Set CSS custom properties on :root
  root.style.setProperty('--font-sans', `'${bodyFont}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`);
  root.style.setProperty('--font-heading', `'${headingFont}', '${bodyFont}', sans-serif`);
  root.style.setProperty('--font-mono', `'${monoFont}', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`);
  root.style.setProperty('--theme-font-scale', fontScale);

  // Colors
  root.style.setProperty('--theme-bg', theme.colors.background);
  root.style.setProperty('--theme-surface', theme.colors.surface);
  root.style.setProperty('--theme-card', theme.colors.card);
  root.style.setProperty('--theme-border', theme.colors.border);
  root.style.setProperty('--theme-primary', theme.colors.primaryAccent);
  root.style.setProperty('--theme-secondary', theme.colors.secondaryAccent);
  root.style.setProperty('--theme-glow', theme.colors.glow);
  root.style.setProperty('--theme-text', theme.colors.textPrimary);
  root.style.setProperty('--theme-text-muted', theme.colors.textMuted);

  // Update document body style directly for instantaneous transition
  document.body.style.backgroundColor = theme.colors.background;
  document.body.style.color = theme.colors.textPrimary;
  document.body.style.fontFamily = `'${bodyFont}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
};
