import React, { useState } from 'react';
import type { CustomModel, NsfwMode, UserSettings } from '../types';
import {
  Sliders,
  Shield,
  ShieldAlert,
  ShieldOff,
  Cpu,
  Key,
  Plus,
  Trash2,
  Check,
  Smartphone,
  Palette,
  Sparkles,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { haptic } from '../utils/haptics';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [hfToken, setHfToken] = useState(settings.hfToken || '');
  const [tokenSaved, setTokenSaved] = useState(false);

  // New custom model form state
  const [showAddModel, setShowAddModel] = useState(false);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelDesc, setNewModelDesc] = useState('');
  const [newModelProvider, setNewModelProvider] = useState<'huggingface' | 'pollinations' | 'local'>('huggingface');

  const handleNsfwChange = (mode: NsfwMode) => {
    haptic.trigger('selection');
    onUpdateSettings({ nsfwMode: mode });
  };

  const handleSaveHfToken = () => {
    haptic.trigger('success');
    onUpdateSettings({ hfToken: hfToken.trim() });
    setTokenSaved(true);
    setTimeout(() => setTokenSaved(false), 2000);
  };

  const handleAddCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelId.trim() || !newModelName.trim()) return;

    haptic.trigger('success');
    const newModel: CustomModel = {
      id: newModelId.trim(),
      name: newModelName.trim(),
      description: newModelDesc.trim() || 'Custom user model',
      provider: newModelProvider,
      type: 'image',
      isCustom: true,
    };

    onUpdateSettings({
      customModels: [...settings.customModels, newModel],
    });

    setNewModelId('');
    setNewModelName('');
    setNewModelDesc('');
    setShowAddModel(false);
  };

  const handleDeleteCustomModel = (modelId: string) => {
    haptic.trigger('warning');
    onUpdateSettings({
      customModels: settings.customModels.filter((m) => m.id !== modelId),
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800/80 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>Studio Settings & Customization</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
            Preferences
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure content filters, manage custom Hugging Face model endpoints, and tune generation defaults.
        </p>
      </div>

      {/* 1. NSFW Content Filter Toggle (Explicit user requirement) */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5 border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">NSFW & Content Sensitivity Filter</h2>
          </div>
          <span className="text-xs font-mono capitalize text-slate-400">
            Current: <strong className="text-white">{settings.nsfwMode}</strong>
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Control how mature, sensitive, or flagged content is processed across all image and video models:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Safe Mode */}
          <button
            onClick={() => handleNsfwChange('safe')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              settings.nsfwMode === 'safe'
                ? 'bg-emerald-950/50 border-emerald-400 text-white shadow-sm'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Shield className={`w-4 h-4 ${settings.nsfwMode === 'safe' ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="text-xs font-bold text-slate-100">Safe Mode</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Standard content safety filters enabled.
            </p>
          </button>

          {/* Warn Mode */}
          <button
            onClick={() => handleNsfwChange('warn')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              settings.nsfwMode === 'warn'
                ? 'bg-amber-950/50 border-amber-400 text-white shadow-sm'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className={`w-4 h-4 ${settings.nsfwMode === 'warn' ? 'text-amber-400' : 'text-slate-500'}`} />
              <span className="text-xs font-bold text-slate-100">Warning Mode</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Generates normally, but blurs flagged imagery behind a 1-tap confirmation overlay.
            </p>
          </button>

          {/* Unrestricted Mode */}
          <button
            onClick={() => handleNsfwChange('unrestricted')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              settings.nsfwMode === 'unrestricted'
                ? 'bg-rose-950/50 border-rose-400 text-white shadow-sm'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldOff className={`w-4 h-4 ${settings.nsfwMode === 'unrestricted' ? 'text-rose-400' : 'text-slate-500'}`} />
              <span className="text-xs font-bold text-slate-100">Unrestricted</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Raw generation without blurring or local prompt blocking (standard model boundaries apply).
            </p>
          </button>
        </div>
      </div>

      {/* 2. Custom AI Models & Hugging Face Manager */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-bold text-white">Custom Hugging Face & Open Models</h2>
          </div>
          <button
            onClick={() => {
              haptic.trigger('selection');
              setShowAddModel(!showAddModel);
            }}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Model</span>
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Configure any open model repository on Hugging Face (e.g. <code className="text-violet-300 font-mono">cagliostrolab/animagine-xl-3.1</code>) or your private inference endpoint.
        </p>

        {/* Hugging Face User Access Token (Optional) */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Hugging Face Access Token (Optional for higher rate limits)</span>
            </span>
            <a
              href="https://huggingface.co/settings/tokens"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>Get Token</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={hfToken}
              onChange={(e) => setHfToken(e.target.value)}
              placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="flex-1 bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-cyan-400 focus:outline-none font-mono"
            />
            <button
              onClick={handleSaveHfToken}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center gap-1"
            >
              {tokenSaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
              <span>{tokenSaved ? 'Saved' : 'Save Key'}</span>
            </button>
          </div>
        </div>

        {/* Add Model Form */}
        {showAddModel && (
          <form onSubmit={handleAddCustomModel} className="p-4 rounded-xl bg-slate-950/80 border border-violet-500/40 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Register Custom AI Model</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Model Repository ID / Name
                </label>
                <input
                  type="text"
                  required
                  value={newModelId}
                  onChange={(e) => setNewModelId(e.target.value)}
                  placeholder="e.g. prompthero/openjourney"
                  className="w-full bg-slate-900 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-cyan-400 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Display Label in Studio
                </label>
                <input
                  type="text"
                  required
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="e.g. OpenJourney v4"
                  className="w-full bg-slate-900 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Description / Specialization (Optional)
              </label>
              <input
                type="text"
                value={newModelDesc}
                onChange={(e) => setNewModelDesc(e.target.value)}
                placeholder="Midjourney-like artistic aesthetics and portraits"
                className="w-full bg-slate-900 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Provider:</span>
                <select
                  value={newModelProvider}
                  onChange={(e) => setNewModelProvider(e.target.value as any)}
                  className="bg-slate-900 text-slate-200 text-xs rounded px-2 py-1 border border-slate-800"
                >
                  <option value="huggingface">Hugging Face</option>
                  <option value="pollinations">Pollinations</option>
                  <option value="local">Local</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModel(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs"
                >
                  Save Model
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Model List */}
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {settings.customModels.map((m) => (
            <div
              key={m.id}
              className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200 truncate">{m.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                    {m.provider}
                  </span>
                  {m.isCustom && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-950 text-violet-300 font-mono">
                      Custom
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{m.description}</p>
              </div>

              {m.isCustom && (
                <button
                  onClick={() => handleDeleteCustomModel(m.id)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 transition-colors"
                  title="Remove Model"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. iOS Appearance & Tactile Haptics */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 border border-slate-800">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">iOS & Touch Customization</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Haptic Feedback Toggle */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Tactile Haptics</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Physical vibration and click sounds</span>
            </div>
            <button
              onClick={() => {
                const next = !settings.hapticFeedback;
                haptic.setEnabled(next);
                if (next) haptic.trigger('success');
                onUpdateSettings({ hapticFeedback: next });
              }}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                settings.hapticFeedback ? 'bg-cyan-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.hapticFeedback ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Auto-Save Toggle */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Auto-Save Creations</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Persist new images & videos to Library</span>
            </div>
            <button
              onClick={() => {
                haptic.trigger('selection');
                onUpdateSettings({ autoSave: !settings.autoSave });
              }}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                settings.autoSave ? 'bg-cyan-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.autoSave ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Theme Palette */}
        <div className="pt-2 border-t border-slate-800">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
            iOS Studio Theme
          </span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'oled', label: 'OLED Pitch Black', bg: 'bg-black' },
              { id: 'slate', label: 'Obsidian Slate', bg: 'bg-slate-950' },
              { id: 'navy', label: 'Midnight Navy', bg: 'bg-slate-900' },
            ].map((th) => (
              <button
                key={th.id}
                onClick={() => {
                  haptic.trigger('selection');
                  onUpdateSettings({ theme: th.id as any });
                }}
                className={`p-3 rounded-xl border text-center transition-all ${
                  settings.theme === th.id
                    ? 'border-cyan-400 text-cyan-300 bg-slate-900/90'
                    : 'border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`w-6 h-6 rounded-full mx-auto mb-1.5 border border-slate-700 ${th.bg}`} />
                <span className="text-xs font-semibold block">{th.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
