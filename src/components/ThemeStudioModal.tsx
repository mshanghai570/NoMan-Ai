import React, { useState } from 'react';
import type { CustomTheme, FontSizeScale, UserSettings } from '../types';
import { BUILTIN_THEMES, AI_THEME_PROMPT_INSPIRATIONS } from '../constants/themes';
import { CURATED_FONTS, FONT_PAIRING_PRESETS } from '../constants/fonts';
import {
  Sparkles,
  Type,
  Palette,
  X,
  Check,
  RotateCcw,
  Plus,
  Trash2,
  Key,
  Wand2,
  Layers,
  Sliders,
  ChevronRight,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { haptic } from '../utils/haptics';
import { loadGoogleFont } from '../utils/themeManager';

interface ThemeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onShowToast: (msg: string) => void;
}

export const ThemeStudioModal: React.FC<ThemeStudioModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'ai-generator' | 'typography' | 'presets'>('ai-generator');

  // AI Theme Generator State
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTheme, setGeneratedTheme] = useState<CustomTheme | null>(null);
  const [generationSource, setGenerationSource] = useState<string | null>(null);
  const [customApiKey, setCustomApiKey] = useState(settings.themeApiKey || '');
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Typography state
  const [customFontInput, setCustomFontInput] = useState('');
  const [fontSearch, setFontSearch] = useState('');
  const [selectedFontCategory, setSelectedFontCategory] = useState<'all' | 'sans' | 'serif' | 'mono' | 'display'>('all');

  if (!isOpen) return null;

  // Filter fonts
  const filteredFonts = CURATED_FONTS.filter((f) => {
    if (selectedFontCategory !== 'all' && f.category !== selectedFontCategory) return false;
    if (fontSearch.trim()) {
      return (
        f.family.toLowerCase().includes(fontSearch.toLowerCase()) ||
        f.label.toLowerCase().includes(fontSearch.toLowerCase())
      );
    }
    return true;
  });

  const handleGenerateTheme = async () => {
    if (!prompt.trim() || isGenerating) return;

    haptic.trigger('selection');
    setIsGenerating(true);

    try {
      const res = await fetch('/api/gemini/generate-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          apiKey: customApiKey.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.theme) {
        setGeneratedTheme(data.theme);
        setGenerationSource(data.source || 'gemini');
        haptic.trigger('success');

        // Dynamically preload fonts suggested by Gemini
        if (data.theme.typography?.fontFamily) {
          loadGoogleFont(data.theme.typography.fontFamily);
        }
        if (data.theme.typography?.headingFont) {
          loadGoogleFont(data.theme.typography.headingFont);
        }
        if (data.theme.typography?.googleFontFamilies) {
          data.theme.typography.googleFontFamilies.forEach(loadGoogleFont);
        }

        // Instantly apply and persist the theme to the entire studio
        handleSaveAndApplyTheme(data.theme);

        onShowToast(
          data.source === 'gemini'
            ? `Generated and applied "${data.theme.name}" with Gemini AI!`
            : `Created and applied "${data.theme.name}"!`
        );
      }
    } catch (err: any) {
      console.error('Failed to generate theme:', err);
      haptic.trigger('warning');
      onShowToast('Theme generation encountered an error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyTheme = (theme: CustomTheme) => {
    haptic.trigger('success');

    // Also update fonts to match theme if provided
    const newSettings: Partial<UserSettings> = {
      theme: theme.id,
      activeCustomTheme: theme,
    };

    if (theme.typography?.fontFamily) {
      newSettings.fontFamily = theme.typography.fontFamily;
    }
    if (theme.typography?.headingFont) {
      newSettings.fontHeading = theme.typography.headingFont;
    }
    if (theme.typography?.monoFont) {
      newSettings.fontMono = theme.typography.monoFont;
    }

    onUpdateSettings(newSettings);
    onShowToast(`Applied "${theme.name}" theme to studio`);
  };

  const handleSaveAndApplyTheme = (theme: CustomTheme) => {
    haptic.trigger('success');
    const existing = settings.customThemes || [];
    const withoutSameId = existing.filter((t) => t.id !== theme.id);
    const updatedThemes = [theme, ...withoutSameId];

    onUpdateSettings({
      theme: theme.id,
      activeCustomTheme: theme,
      customThemes: updatedThemes,
      fontFamily: theme.typography.fontFamily || settings.fontFamily,
      fontHeading: theme.typography.headingFont || settings.fontHeading,
      fontMono: theme.typography.monoFont || settings.fontMono,
    });

    onShowToast(`Saved and applied "${theme.name}"!`);
  };

  const handleDeleteSavedTheme = (themeId: string) => {
    haptic.trigger('warning');
    const existing = settings.customThemes || [];
    const filtered = existing.filter((t) => t.id !== themeId);
    onUpdateSettings({
      customThemes: filtered,
      // If deleting the active theme, revert to default
      theme: settings.theme === themeId ? 'oled' : settings.theme,
    });
    onShowToast('Theme removed from your saved list');
  };

  const handleApplyFontPairing = (preset: typeof FONT_PAIRING_PRESETS[0]) => {
    haptic.trigger('selection');
    loadGoogleFont(preset.heading);
    loadGoogleFont(preset.body);
    loadGoogleFont(preset.mono);

    onUpdateSettings({
      fontFamily: preset.body,
      fontHeading: preset.heading,
      fontMono: preset.mono,
    });
    onShowToast(`Applied typography pair: ${preset.name}`);
  };

  const handleApplyCustomFont = () => {
    if (!customFontInput.trim()) return;
    const fontName = customFontInput.trim();
    haptic.trigger('success');
    loadGoogleFont(fontName);

    onUpdateSettings({
      fontFamily: fontName,
      fontHeading: fontName,
    });
    setCustomFontInput('');
    onShowToast(`Loaded & applied Google Font: ${fontName}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-violet-600 text-white shadow-md shadow-cyan-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Theme & Font Studio</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  Gemini AI Powered
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Customize typography or prompt Gemini to generate any aesthetic theme possible.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              haptic.trigger('selection');
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 pt-2 gap-2 overflow-x-auto">
          {[
            { id: 'ai-generator', label: 'Gemini Theme Alchemist', icon: Wand2 },
            { id: 'typography', label: 'Typography & Fonts', icon: Type },
            { id: 'presets', label: 'Theme Library & Presets', icon: Palette },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  haptic.trigger('selection');
                  setActiveTab(tab.id as any);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 -mb-px shrink-0 ${
                  isSelected
                    ? 'border-cyan-400 text-cyan-300 bg-slate-900/90'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: Gemini AI Theme Generator */}
          {activeTab === 'ai-generator' && (
            <div className="space-y-6">
              {/* Prompt Input Box */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                    <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Describe Any Theme or Aesthetic Vibe</span>
                  </label>
                  <button
                    onClick={() => setShowKeyInput(!showKeyInput)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                  >
                    <Key className="w-3 h-3" />
                    <span>{showKeyInput ? 'Hide API Key' : 'Custom Gemini Key (Optional)'}</span>
                  </button>
                </div>

                {showKeyInput && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <span className="text-[11px] text-slate-300 font-semibold block">
                      Custom Gemini API Key
                    </span>
                    <p className="text-[10px] text-slate-400">
                      The server environment key is used automatically by default. You can optionally provide your own personal Gemini API key here.
                    </p>
                    <input
                      type="password"
                      value={customApiKey}
                      onChange={(e) => {
                        setCustomApiKey(e.target.value);
                        onUpdateSettings({ themeApiKey: e.target.value });
                      }}
                      placeholder="AIzaSy..."
                      className="w-full bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-cyan-400 focus:outline-none font-mono"
                    />
                  </div>
                )}

                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Cyberpunk 2077 Night City neon yellow and cyan with dark carbon texture and high tech font..."
                    rows={3}
                    className="w-full bg-slate-900 text-slate-100 placeholder-slate-500 rounded-xl p-3.5 text-xs sm:text-sm border border-slate-800 focus:border-cyan-400 focus:outline-none transition-colors"
                  />
                </div>

                {/* Inspiration chips */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Tap for Quick Inspiration:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_THEME_PROMPT_INSPIRATIONS.slice(0, 6).map((insp, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          haptic.trigger('selection');
                          setPrompt(insp);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-cyan-500/40 transition-colors text-left truncate max-w-xs"
                      >
                        {insp.split(' ')[0]} {insp.split(' ')[1]} {insp.split(' ')[2]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Button */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">
                    Theme colors and typography will automatically apply to NoMan AI in real-time.
                  </span>
                  <button
                    onClick={handleGenerateTheme}
                    disabled={isGenerating || !prompt.trim()}
                    className={`min-h-[44px] px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shrink-0 ${
                      isGenerating || !prompt.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 text-white hover:opacity-95 shadow-lg shadow-cyan-500/20 active:scale-95'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Synthesizing Theme...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Synthesize & Apply Instantly</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Generated Theme Live Preview Card */}
              {generatedTheme && (
                <div className="p-5 rounded-2xl border space-y-4 transition-all" style={{
                  backgroundColor: generatedTheme.colors.background,
                  borderColor: generatedTheme.colors.border,
                  boxShadow: `0 10px 30px -10px ${generatedTheme.colors.glow}`,
                }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono uppercase px-2 py-0.5 rounded" style={{
                          backgroundColor: generatedTheme.colors.surface,
                          color: generatedTheme.colors.primaryAccent,
                          border: `1px solid ${generatedTheme.colors.border}`,
                        }}>
                          {generatedTheme.vibe}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Applied to Studio</span>
                        </span>
                        <span className="text-xs text-slate-400">
                          via {generationSource === 'gemini' ? 'Gemini 3.8 Flash' : 'Synthesizer'}
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold mt-1" style={{
                        color: generatedTheme.colors.textPrimary,
                        fontFamily: generatedTheme.typography.headingFont || generatedTheme.typography.fontFamily,
                      }}>
                        {generatedTheme.name}
                      </h3>
                      <p className="text-xs mt-0.5 max-w-xl" style={{ color: generatedTheme.colors.textMuted }}>
                        {generatedTheme.description}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveAndApplyTheme(generatedTheme)}
                        className="px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all text-slate-950"
                        style={{ backgroundColor: generatedTheme.colors.primaryAccent }}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Re-Apply</span>
                      </button>
                    </div>
                  </div>

                  {/* Visual Color Palette Swatches */}
                  <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: generatedTheme.colors.border }}>
                    <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: generatedTheme.colors.textMuted }}>
                      Generated Color Palette:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] font-mono">
                      {[
                        { label: 'Primary Accent', color: generatedTheme.colors.primaryAccent },
                        { label: 'Secondary Accent', color: generatedTheme.colors.secondaryAccent },
                        { label: 'Background', color: generatedTheme.colors.background },
                        { label: 'Surface', color: generatedTheme.colors.surface },
                        { label: 'Card Surface', color: generatedTheme.colors.card },
                      ].map((item, idx) => (
                        <div key={idx} className="p-2 rounded-lg flex items-center gap-2" style={{
                          backgroundColor: generatedTheme.colors.surface,
                          border: `1px solid ${generatedTheme.colors.border}`,
                        }}>
                          <div className="w-4 h-4 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: item.color }} />
                          <div className="min-w-0">
                            <span className="block text-[9px] truncate" style={{ color: generatedTheme.colors.textMuted }}>{item.label}</span>
                            <span className="block font-bold text-[10px] truncate" style={{ color: generatedTheme.colors.textPrimary }}>{item.color}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Typography Pairing Info */}
                  <div className="p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3" style={{
                    backgroundColor: generatedTheme.colors.surface,
                    border: `1px solid ${generatedTheme.colors.border}`,
                  }}>
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="block text-[10px]" style={{ color: generatedTheme.colors.textMuted }}>Heading Font</span>
                        <span className="font-bold text-sm" style={{
                          color: generatedTheme.colors.textPrimary,
                          fontFamily: generatedTheme.typography.headingFont,
                        }}>
                          {generatedTheme.typography.headingFont || 'Default'}
                        </span>
                      </div>
                      <div className="h-6 w-px" style={{ backgroundColor: generatedTheme.colors.border }} />
                      <div>
                        <span className="block text-[10px]" style={{ color: generatedTheme.colors.textMuted }}>Body Font</span>
                        <span className="font-bold text-sm" style={{
                          color: generatedTheme.colors.textPrimary,
                          fontFamily: generatedTheme.typography.fontFamily,
                        }}>
                          {generatedTheme.typography.fontFamily || 'Default'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleApplyTheme(generatedTheme)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                      style={{
                        backgroundColor: generatedTheme.colors.secondaryAccent,
                        color: '#000000',
                      }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Live Apply</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Typography & Fonts */}
          {activeTab === 'typography' && (
            <div className="space-y-6">
              {/* Font Scale Control */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Studio Typography Scaling
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-cyan-400">
                    {settings.fontSizeScale === 'compact' ? 'Compact (93%)' : settings.fontSizeScale === 'relaxed' ? 'Relaxed (108%)' : 'Balanced (100%)'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'compact', label: 'Compact', sub: 'Max screen density' },
                    { id: 'normal', label: 'Balanced', sub: 'Standard iOS scale' },
                    { id: 'relaxed', label: 'Comfortable', sub: 'Large touch target' },
                  ].map((sc) => {
                    const isSelected = (settings.fontSizeScale || 'normal') === sc.id;
                    return (
                      <button
                        key={sc.id}
                        onClick={() => {
                          haptic.trigger('selection');
                          onUpdateSettings({ fontSizeScale: sc.id as FontSizeScale });
                        }}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-xs font-bold block">{sc.label}</span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{sc.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recommended Font Pairings */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-violet-400" />
                  <span>Curated Font Pairings (Heading + Body + Mono)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {FONT_PAIRING_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleApplyFontPairing(preset)}
                      className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-violet-500/50 text-left transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                          {preset.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Pair</span>
                      </div>
                      <div className="mt-2 text-xs text-slate-300 font-medium">
                        <span style={{ fontFamily: preset.heading }} className="text-sm font-bold text-cyan-300 block">
                          {preset.heading} (Headline)
                        </span>
                        <span style={{ fontFamily: preset.body }} className="text-xs text-slate-400 block mt-0.5">
                          {preset.body} (Body text & UI)
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Google Font Input */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Load Any Google Font</span>
                  </span>
                  <a
                    href="https://fonts.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>Browse Google Fonts</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-xs text-slate-400">
                  Type the exact name of any font from Google Fonts (e.g. <code className="text-cyan-300 font-mono">Bebas Neue</code>, <code className="text-cyan-300 font-mono">Montserrat</code>, <code className="text-cyan-300 font-mono">Pacifico</code>):
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customFontInput}
                    onChange={(e) => setCustomFontInput(e.target.value)}
                    placeholder="e.g. Montserrat, Bebas Neue, Cormorant..."
                    className="flex-1 bg-slate-900 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2 text-xs border border-slate-800 focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    onClick={handleApplyCustomFont}
                    disabled={!customFontInput.trim()}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs disabled:opacity-40 transition-all"
                  >
                    Load & Apply
                  </button>
                </div>
              </div>

              {/* Curated Font Library Selection */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Browse Typography Library ({filteredFonts.length})
                  </h3>

                  {/* Category filters */}
                  <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'sans', label: 'Sans-Serif' },
                      { id: 'serif', label: 'Serif' },
                      { id: 'mono', label: 'Monospace' },
                      { id: 'display', label: 'Display' },
                    ].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedFontCategory(c.id as any)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all shrink-0 ${
                          selectedFontCategory === c.id
                            ? 'bg-slate-800 text-white font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filteredFonts.map((f) => {
                    const isCurrent = settings.fontFamily === f.family;
                    return (
                      <button
                        key={f.family}
                        onClick={() => {
                          haptic.trigger('selection');
                          loadGoogleFont(f.family);
                          onUpdateSettings({ fontFamily: f.family });
                          onShowToast(`Active font: ${f.family}`);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isCurrent
                            ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-sm'
                            : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{f.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            {f.category}
                          </span>
                        </div>
                        <p
                          className="mt-2 text-base text-slate-200 truncate"
                          style={{ fontFamily: f.family }}
                        >
                          The quick brown fox jumps over the lazy dog.
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Theme Library & Presets */}
          {activeTab === 'presets' && (
            <div className="space-y-6">
              {/* Built-in Master Themes */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Built-in Studio Aesthetics ({BUILTIN_THEMES.length})
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {BUILTIN_THEMES.map((th) => {
                    const isSelected = settings.theme === th.id;
                    return (
                      <div
                        key={th.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-cyan-400 shadow-md shadow-cyan-500/10'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                        style={{ backgroundColor: th.colors.background }}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold" style={{ color: th.colors.textPrimary }}>
                              {th.name}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase" style={{
                              backgroundColor: th.colors.surface,
                              color: th.colors.primaryAccent,
                            }}>
                              {th.vibe}
                            </span>
                          </div>
                          <p className="text-[11px] line-clamp-2" style={{ color: th.colors.textMuted }}>
                            {th.description}
                          </p>

                          {/* Color bar */}
                          <div className="flex items-center gap-1.5 my-3">
                            <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: th.colors.primaryAccent }} />
                            <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: th.colors.secondaryAccent }} />
                            <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: th.colors.surface }} />
                            <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: th.colors.background }} />
                          </div>
                        </div>

                        <button
                          onClick={() => handleApplyTheme(th)}
                          className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                            isSelected
                              ? 'bg-cyan-500 text-slate-950 font-bold'
                              : 'bg-slate-800/80 hover:bg-slate-750 text-slate-200'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Current Active Theme</span>
                            </>
                          ) : (
                            <span>Apply Theme</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* My Saved AI Themes */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>My Saved AI Themes ({(settings.customThemes || []).length})</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('ai-generator')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New with AI</span>
                  </button>
                </div>

                {(!settings.customThemes || settings.customThemes.length === 0) ? (
                  <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400 font-medium">No custom AI themes created yet.</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Use the "Gemini Theme Alchemist" tab above to generate customized themes matching any aesthetic.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {settings.customThemes.map((th) => (
                      <div
                        key={th.id}
                        className="p-4 rounded-xl border flex flex-col justify-between"
                        style={{
                          backgroundColor: th.colors.background,
                          borderColor: th.colors.border,
                        }}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold" style={{ color: th.colors.textPrimary }}>
                              {th.name}
                            </span>
                            <button
                              onClick={() => handleDeleteSavedTheme(th.id)}
                              className="p-1 rounded text-rose-400 hover:bg-rose-950/60 transition-colors"
                              title="Delete theme"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[11px] line-clamp-2" style={{ color: th.colors.textMuted }}>
                            {th.description}
                          </p>

                          <div className="flex items-center gap-1.5 my-2.5">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: th.colors.primaryAccent }} />
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: th.colors.secondaryAccent }} />
                            <span className="text-[10px] font-mono ml-2" style={{ color: th.colors.textMuted }}>
                              Font: {th.typography.fontFamily}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleApplyTheme(th)}
                          className="w-full py-2 rounded-lg text-xs font-bold transition-all text-slate-950 mt-2"
                          style={{ backgroundColor: th.colors.primaryAccent }}
                        >
                          Apply This Theme
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
