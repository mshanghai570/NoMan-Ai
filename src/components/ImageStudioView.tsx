import React, { useState } from 'react';
import type { AspectRatio, CustomModel, GenerationItem, UserSettings, KeywordCategory } from '../types';
import { ASPECT_RATIOS, STYLE_PRESETS } from '../constants/models';
import { ImageGeneratorService } from '../services/imageGenerator';
import {
  Sparkles,
  Wand2,
  Lightbulb,
  SlidersHorizontal,
  Video,
  Download,
  Bookmark,
  Shuffle,
  Eye,
  EyeOff,
  AlertTriangle,
  RotateCcw,
  Check,
  Copy,
  ChevronDown,
  Layers,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { haptic } from '../utils/haptics';

interface ImageStudioViewProps {
  settings: UserSettings;
  onSaveGeneration: (item: GenerationItem) => void;
  onSendToVideoLab: (imageUrl: string, prompt: string) => void;
  initialPrompt?: string;
}

export const ImageStudioView: React.FC<ImageStudioViewProps> = ({
  settings,
  onSaveGeneration,
  onSendToVideoLab,
  initialPrompt = '',
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedModelId, setSelectedModelId] = useState(settings.defaultModel || 'flux');
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>(settings.defaultAspectRatio || '1:1');
  const [selectedStyle, setSelectedStyle] = useState('none');
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 99999999));
  const [steps, setSteps] = useState<number>(settings.defaultSteps || 28);
  const [cfgScale, setCfgScale] = useState<number>(settings.defaultCfgScale || 7.5);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GenerationItem | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [nsfwRevealed, setNsfwRevealed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync incoming initial prompt if transferred from Roleplay Chat or other tabs
  React.useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // Prompt Assistant lightweight LLM state
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isLoadingAssistant, setIsLoadingAssistant] = useState(false);
  const [assistantCategories, setAssistantCategories] = useState<KeywordCategory[]>([]);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());

  // Available models (including user custom models)
  const availableModels = settings.customModels.filter(
    (m) => m.type === 'image' || m.type === 'both'
  );
  const activeModel = availableModels.find((m) => m.id === selectedModelId) || availableModels[0];

  const currentRatioConfig = ASPECT_RATIOS.find((r) => r.id === selectedRatio) || ASPECT_RATIOS[0];

  // Quick prompt inspirations
  const samplePrompts = [
    'Cyberpunk ronin with glowing crystalline katana on rain-soaked rooftop in Neo-Tokyo',
    'Bioluminescent enchanted forest with floating jade lotus flowers and moonlight mist',
    'Macro studio photography of iridescent cosmic nebula trapped inside a teardrop crystal',
    'Futuristic clean solar-punk airship docking at a hanging terrace garden in the clouds',
  ];

  // NSFW basic heuristic check
  const checkIsNsfwPrompt = (text: string) => {
    const flagged = ['nsfw', 'nude', 'explicit', 'naked', 'erotic', 'xxx', 'porn'];
    const lower = text.toLowerCase();
    return flagged.some((word) => lower.includes(word));
  };

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    haptic.trigger('selection');
    setIsEnhancing(true);
    try {
      const result = await ImageGeneratorService.enhancePrompt(prompt, 'image', selectedStyle);
      setPrompt(result.enhancedPrompt);
      if (result.negativePrompt && !negativePrompt) {
        setNegativePrompt(result.negativePrompt);
      }
      haptic.trigger('success');
    } catch (e) {
      console.error(e);
      haptic.trigger('warning');
    } finally {
      setIsEnhancing(false);
    }
  };

  // Prompt Assistant lightweight LLM methods
  const handleOpenPromptAssistant = async () => {
    haptic.trigger('selection');
    const willOpen = !isAssistantOpen;
    setIsAssistantOpen(willOpen);
    if (willOpen && assistantCategories.length === 0) {
      await fetchAssistantKeywords();
    }
  };

  const fetchAssistantKeywords = async () => {
    setIsLoadingAssistant(true);
    try {
      const res = await ImageGeneratorService.suggestKeywords(prompt, selectedStyle);
      if (res.categories && res.categories.length > 0) {
        setAssistantCategories(res.categories);
        haptic.trigger('success');
      }
    } catch (e) {
      console.error('Failed to fetch assistant keywords', e);
      haptic.trigger('warning');
    } finally {
      setIsLoadingAssistant(false);
    }
  };

  const handleToggleKeyword = (keyword: string) => {
    haptic.trigger('selection');
    const nextSet = new Set(addedKeywords);

    // Escape regex special chars
    const escaped = keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(,\\s*)?${escaped}(,\\s*)?`, 'gi');

    if (nextSet.has(keyword) || regex.test(prompt)) {
      nextSet.delete(keyword);
      // Remove from prompt
      let updated = prompt.replace(regex, (match, p1, p2) => (p1 && p2 ? ', ' : ''));
      setPrompt(updated.trim().replace(/^,\s*|,\s*$/g, ''));
    } else {
      nextSet.add(keyword);
      const trimmed = prompt.trim();
      if (!trimmed) {
        setPrompt(keyword);
      } else if (trimmed.endsWith(',')) {
        setPrompt(`${trimmed} ${keyword}`);
      } else {
        setPrompt(`${trimmed}, ${keyword}`);
      }
    }

    setAddedKeywords(nextSet);
  };

  const handleAddAllInCategory = (keywords: string[]) => {
    haptic.trigger('selection');
    const nextSet = new Set(addedKeywords);
    const toAdd: string[] = [];

    keywords.forEach((kw) => {
      const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      if (!nextSet.has(kw) && !regex.test(prompt)) {
        nextSet.add(kw);
        toAdd.push(kw);
      }
    });

    if (toAdd.length > 0) {
      const trimmed = prompt.trim();
      const addition = toAdd.join(', ');
      if (!trimmed) {
        setPrompt(addition);
      } else if (trimmed.endsWith(',')) {
        setPrompt(`${trimmed} ${addition}`);
      } else {
        setPrompt(`${trimmed}, ${addition}`);
      }
      setAddedKeywords(nextSet);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    haptic.trigger('impactHeavy');
    setIsGenerating(true);
    setErrorMessage(null);
    setIsSaved(false);
    setNsfwRevealed(false);

    // Apply style preset suffix
    let finalPrompt = prompt.trim();
    const styleObj = STYLE_PRESETS.find((s) => s.id === selectedStyle);
    if (styleObj && styleObj.promptSuffix) {
      finalPrompt = `${finalPrompt}, ${styleObj.promptSuffix}`;
    }

    const isNsfw = checkIsNsfwPrompt(finalPrompt);

    // Block if Safe Mode is active and NSFW detected
    if (settings.nsfwMode === 'safe' && isNsfw) {
      setErrorMessage('Generation blocked: NSFW filter is set to Safe Mode in Settings. Change to Warn or Unrestricted mode to generate.');
      setIsGenerating(false);
      haptic.trigger('warning');
      return;
    }

    try {
      const result = await ImageGeneratorService.generateImage({
        prompt: finalPrompt,
        negativePrompt: negativePrompt.trim() || undefined,
        model: activeModel.id,
        provider: activeModel.provider,
        aspectRatio: selectedRatio,
        width: currentRatioConfig.width,
        height: currentRatioConfig.height,
        seed,
        steps,
        cfgScale,
        hfToken: settings.hfToken,
        localEndpoint: settings.localEndpoint,
      });

      const newItem: GenerationItem = {
        id: `gen_img_${Date.now()}`,
        userId: 'current',
        type: 'image',
        prompt: finalPrompt,
        negativePrompt: negativePrompt.trim() || undefined,
        model: activeModel.id,
        modelLabel: activeModel.name,
        provider: activeModel.provider,
        aspectRatio: selectedRatio,
        width: currentRatioConfig.width,
        height: currentRatioConfig.height,
        mediaUrl: result.imageUrl,
        thumbnailUrl: result.imageUrl,
        seed: result.seed,
        steps,
        cfgScale,
        createdAt: Date.now(),
        isFavorite: false,
        tags: [activeModel.provider, selectedStyle !== 'none' ? selectedStyle : 'ai-art'],
        isNsfw,
      };

      setGeneratedResult(newItem);
      haptic.trigger('success');

      if (settings.autoSave) {
        onSaveGeneration(newItem);
        setIsSaved(true);
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      setErrorMessage(err.message || 'Image generation failed. Please try a different model or prompt.');
      haptic.trigger('warning');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualSave = () => {
    if (!generatedResult) return;
    haptic.trigger('selection');
    onSaveGeneration(generatedResult);
    setIsSaved(true);
  };

  const handleCopyPrompt = () => {
    if (!generatedResult) return;
    navigator.clipboard.writeText(generatedResult.prompt);
    haptic.trigger('selection');
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-6">
      {/* Title & Description banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Free AI Image Studio</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
              FLUX & HF
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Unlimited generations with state-of-the-art models, prompt magic, and 1-tap conversion to video.
          </p>
        </div>

        {/* Selected Model Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-xs text-slate-400 font-mono">Model:</div>
          <select
            value={selectedModelId}
            onChange={(e) => {
              haptic.trigger('selection');
              setSelectedModelId(e.target.value);
            }}
            className="text-xs bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.provider})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary Prompt Console Card */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        {/* Textarea */}
        <div className="relative">
          <label htmlFor="image-prompt" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Describe Your Vision
          </label>
          <div className="relative">
            <textarea
              id="image-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Cinematic portrait of a celestial warrior with incandescent neon eyes, flowing dark cape, floating in starry orbit..."
              rows={3}
              className="w-full bg-slate-900/90 text-slate-100 placeholder-slate-500 rounded-xl p-3.5 text-sm border border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:outline-none resize-none transition-all"
            />
            {prompt && (
              <button
                onClick={() => setPrompt('')}
                className="absolute top-2.5 right-2.5 text-slate-500 hover:text-slate-300 text-xs px-1.5 py-0.5 rounded"
              >
                Clear
              </button>
            )}
          </div>

          {/* Prompt Assistant & Prompt Magic Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Prompt Assistant (Lightweight LLM) */}
              <button
                type="button"
                onClick={handleOpenPromptAssistant}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[34px] ${
                  isAssistantOpen
                    ? 'bg-amber-950/70 text-amber-300 border border-amber-500/50 shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 hover:border-amber-400 active:scale-95'
                }`}
                title="Prompt Assistant: Suggest descriptive keywords and stylistic adjectives"
              >
                <Lightbulb className={`w-3.5 h-3.5 ${isLoadingAssistant ? 'animate-bounce text-amber-400' : 'text-amber-400'}`} />
                <span>Prompt Assistant</span>
                {assistantCategories.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>

              {/* Gemini Prompt Magic Enhancer CTA */}
              <button
                type="button"
                onClick={handleEnhancePrompt}
                disabled={!prompt.trim() || isEnhancing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[34px] ${
                  prompt.trim()
                    ? 'bg-gradient-to-r from-cyan-950 to-indigo-950 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 active:scale-95'
                    : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                }`}
              >
                <Wand2 className={`w-3.5 h-3.5 ${isEnhancing ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
                <span>{isEnhancing ? 'Directing Vision...' : 'Gemini Prompt Magic'}</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-500 font-mono">
              {prompt.length} chars
            </span>
          </div>

          {/* Prompt Assistant Interactive Drawer Panel */}
          {isAssistantOpen && (
            <div className="mt-3 p-3.5 rounded-xl bg-slate-950/90 border border-amber-500/30 shadow-xl space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-950/80 border border-amber-500/40 flex items-center justify-center">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Prompt Assistant</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/60 font-mono">
                        Lightweight LLM
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Tap keywords to instantly append or remove them from your prompt.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={fetchAssistantKeywords}
                    disabled={isLoadingAssistant}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 transition-all active:scale-95"
                    title="Generate fresh keyword recommendations"
                  >
                    <RefreshCw className={`w-3 h-3 text-amber-400 ${isLoadingAssistant ? 'animate-spin' : ''}`} />
                    <span className="hidden xs:inline">Re-roll</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      haptic.trigger('selection');
                      setIsAssistantOpen(false);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                    title="Close Assistant"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Category Tab Switcher */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  type="button"
                  onClick={() => {
                    haptic.trigger('selection');
                    setSelectedCategoryTab('all');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
                    selectedCategoryTab === 'all'
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
                  }`}
                >
                  All Suggestions
                </button>
                {assistantCategories.map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => {
                      haptic.trigger('selection');
                      setSelectedCategoryTab(cat.name);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
                      selectedCategoryTab === cat.name
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Keywords Content */}
              {isLoadingAssistant ? (
                <div className="py-6 flex flex-col items-center justify-center space-y-2 text-center">
                  <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">
                    Consulting lightweight LLM for descriptive keywords & adjectives...
                  </p>
                </div>
              ) : assistantCategories.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-slate-400">No suggestions yet.</p>
                  <button
                    type="button"
                    onClick={fetchAssistantKeywords}
                    className="mt-2 text-xs text-amber-400 hover:underline"
                  >
                    Generate suggestions for current prompt
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {assistantCategories
                    .filter((cat) => selectedCategoryTab === 'all' || selectedCategoryTab === cat.name)
                    .map((cat) => (
                      <div key={cat.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>{cat.name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddAllInCategory(cat.keywords)}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono"
                          >
                            + Add All
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {cat.keywords.map((kw) => {
                            // Check if keyword is already present in prompt or in addedKeywords set
                            const isAdded =
                              addedKeywords.has(kw) ||
                              new RegExp(kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i').test(prompt);

                            return (
                              <button
                                key={kw}
                                type="button"
                                onClick={() => handleToggleKeyword(kw)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all active:scale-95 ${
                                  isAdded
                                    ? 'bg-amber-950/80 border border-amber-400 text-amber-200 font-medium shadow-sm'
                                    : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                {isAdded ? (
                                  <Check className="w-3 h-3 text-amber-400 shrink-0" />
                                ) : (
                                  <Plus className="w-3 h-3 text-slate-500 shrink-0" />
                                )}
                                <span>{kw}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Sample Inspiration Chips */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-slate-400">Quick Inspirations:</span>
          <div className="flex flex-wrap gap-1.5">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  haptic.trigger('selection');
                  setPrompt(p);
                }}
                className="text-left text-[11px] text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1 transition-all truncate max-w-full"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Aspect Ratio
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {currentRatioConfig.width} × {currentRatioConfig.height}px
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {ASPECT_RATIOS.map((ratio) => {
              const isSelected = selectedRatio === ratio.id;
              return (
                <button
                  key={ratio.id}
                  onClick={() => {
                    haptic.trigger('selection');
                    setSelectedRatio(ratio.id);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all min-h-[52px] ${
                    isSelected
                      ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className="text-xs font-bold">{ratio.label}</span>
                  <span className="text-[9px] text-slate-500 mt-0.5 truncate max-w-[56px]">
                    {ratio.id === '1:1' ? 'Square' : ratio.id === '9:16' ? 'Reels' : ratio.id === '16:9' ? 'Cinema' : 'Photo'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Style Presets */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Style Aesthetic
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {STYLE_PRESETS.map((style) => {
              const isSelected = selectedStyle === style.id;
              return (
                <button
                  key={style.id}
                  onClick={() => {
                    haptic.trigger('selection');
                    setSelectedStyle(style.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                    isSelected
                      ? 'bg-slate-100 text-slate-950 font-semibold shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {style.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced Accordion Toggle */}
        <div className="pt-2 border-t border-slate-800/80">
          <button
            onClick={() => {
              haptic.trigger('selection');
              setShowAdvanced(!showAdvanced);
            }}
            className="flex items-center justify-between w-full text-xs font-medium text-slate-400 hover:text-slate-200 py-1"
          >
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Advanced Controls (Seed, Steps, Negative Prompt)
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3.5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              {/* Negative Prompt */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Negative Prompt (Elements to avoid)
                </label>
                <input
                  type="text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="e.g. blurry, distorted anatomy, low quality, artifacts"
                  className="w-full bg-slate-900 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              {/* Seed Control */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Seed (Reproduction ID)
                  </label>
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-cyan-400 focus:outline-none font-mono"
                  />
                </div>
                <button
                  onClick={() => {
                    haptic.trigger('selection');
                    setSeed(Math.floor(Math.random() * 99999999));
                  }}
                  className="mt-5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs flex items-center gap-1 border border-slate-700 shrink-0"
                  title="Randomize Seed"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Random</span>
                </button>
              </div>

              {/* Steps & CFG */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[11px] font-medium text-slate-400 mb-1">
                    <span>Inference Steps: {steps}</span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={50}
                    value={steps}
                    onChange={(e) => setSteps(parseInt(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-medium text-slate-400 mb-1">
                    <span>Guidance Scale: {cfgScale}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    step={0.5}
                    value={cfgScale}
                    onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Primary Generate Button */}
        <div className="pt-2">
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg min-h-[48px] ${
              !prompt.trim() || isGenerating
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
                : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/20 active:scale-[0.98]'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating High-Resolution Asset...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Free Image</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Notice</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Result Display Card */}
      {generatedResult && (
        <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 border border-slate-700/80">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <h2 className="text-sm font-bold text-white">Generated Masterpiece</h2>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-xs text-slate-400 font-mono">{generatedResult.modelLabel}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopyPrompt}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1"
                title="Copy Prompt"
              >
                {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Copy</span>
              </button>

              <button
                onClick={handleManualSave}
                disabled={isSaved}
                className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1 ${
                  isSaved
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-750'
                }`}
                title="Save to Library"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>

          {/* Media Viewport with NSFW Blur Protection */}
          <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
            <img
              src={generatedResult.mediaUrl}
              alt={generatedResult.prompt}
              referrerPolicy="no-referrer"
              className={`max-h-[640px] w-auto max-w-full object-contain transition-all duration-300 ${
                generatedResult.isNsfw && settings.nsfwMode === 'warn' && !nsfwRevealed
                  ? 'blur-2xl scale-105'
                  : ''
              }`}
            />

            {/* NSFW Warning Overlay if in Warn mode and not revealed */}
            {generatedResult.isNsfw && settings.nsfwMode === 'warn' && !nsfwRevealed && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Sensitive Content Warning</h3>
                <p className="text-xs text-slate-300 max-w-xs">
                  This image was flagged by the content sensitivity filter. You can toggle content filters in Settings.
                </p>
                <button
                  onClick={() => {
                    haptic.trigger('selection');
                    setNsfwRevealed(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Reveal Image</span>
                </button>
              </div>
            )}
          </div>

          {/* Prompt description summary */}
          <p className="text-xs text-slate-300 line-clamp-2 italic">
            "{generatedResult.prompt}"
          </p>

          {/* Result Actions Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
            {/* Convert to Video CTA */}
            <button
              onClick={() => {
                haptic.trigger('impactMedium');
                onSendToVideoLab(generatedResult.mediaUrl, generatedResult.prompt);
              }}
              className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/10 active:scale-95 transition-all"
            >
              <Video className="w-4 h-4 text-violet-200" />
              <span>Convert Image to Video in Lab</span>
            </button>

            {/* Direct Download */}
            <a
              href={generatedResult.mediaUrl}
              download={`noman_ai_${generatedResult.id}.jpg`}
              target="_blank"
              rel="noreferrer"
              onClick={() => haptic.trigger('selection')}
              className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/80 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>Download High-Res PNG</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
