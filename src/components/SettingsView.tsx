import React, { useState } from 'react';
import type {
  AgentMode,
  AIProvider,
  ChatProvider,
  ChatReplyLength,
  CustomModel,
  CustomProviderConfig,
  NsfwMode,
  UserSettings,
} from '../types';
import {
  AGENT_MODES,
  CHAT_PROVIDERS,
  CHAT_PROVIDER_PRESETS,
  KILO_FREE_MODELS,
  REPLY_LENGTHS,
} from '../constants/chat';
import { MEDIA_PROVIDERS, providerKeySlot } from '../providers/catalog';
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
  Flame,
  Gauge,
  Server,
  BookOpen,
  User,
  Compass,
  FileCode,
  Cloud,
  Video,
  Image as ImageIcon,
  Settings2,
  ChevronDown,
} from 'lucide-react';
import { haptic } from '../utils/haptics';
import { AgeGateModal } from './AgeGateModal';
import { DEFAULT_CUSTOM_PROVIDER, clearStoredPersonaNsfwOverrides } from '../services/storage';
import { BUILTIN_THEMES } from '../constants/themes';
import { CURATED_FONTS } from '../constants/fonts';
import { loadGoogleFont } from '../utils/themeManager';
import type { FontSizeScale } from '../types';
import { ProviderAgentSetupModal } from './ProviderAgentSetupModal';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onOpenThemeStudio?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onOpenThemeStudio,
}) => {
  const [hfToken, setHfToken] = useState(settings.hfToken || '');
  const [tokenSaved, setTokenSaved] = useState(false);
  const [showChatAgeGate, setShowChatAgeGate] = useState(false);
  const [chatKeyDraft, setChatKeyDraft] = useState(settings.chatApiKey || '');
  const [chatKeySaved, setChatKeySaved] = useState(false);

  // Provider Studio modal & draft settings
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [cloudKeyDraft, setCloudKeyDraft] = useState(settings.cloudApiKey || '');
  const [cloudKeySaved, setCloudKeySaved] = useState(false);
  const [imageEndpointDraft, setImageEndpointDraft] = useState(settings.imageLocalEndpoint || 'http://localhost:8188');
  const [videoEndpointDraft, setVideoEndpointDraft] = useState(settings.videoLocalEndpoint || 'http://localhost:8188');
  const [isTestingImage, setIsTestingImage] = useState(false);
  const [imageTestMessage, setImageTestMessage] = useState<string | null>(null);
  const [imageTestSuccess, setImageTestSuccess] = useState<boolean | null>(null);
  const [isTestingVideo, setIsTestingVideo] = useState(false);
  const [videoTestMessage, setVideoTestMessage] = useState<string | null>(null);
  const [videoTestSuccess, setVideoTestSuccess] = useState<boolean | null>(null);

  const handleTestEndpoint = async (type: 'image' | 'video', url: string) => {
    if (type === 'image') {
      setIsTestingImage(true);
      setImageTestMessage(null);
    } else {
      setIsTestingVideo(true);
      setVideoTestMessage(null);
    }
    try {
      const res = await fetch('/api/check-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (type === 'image') {
        setImageTestSuccess(data.ok);
        setImageTestMessage(data.ok ? `Connected! Latency: ${data.latencyMs}ms` : `Offline: ${data.message}`);
        if (data.ok) {
          onUpdateSettings({ imageLocalEndpoint: url.trim() });
        }
      } else {
        setVideoTestSuccess(data.ok);
        setVideoTestMessage(data.ok ? `Connected! Latency: ${data.latencyMs}ms` : `Offline: ${data.message}`);
        if (data.ok) {
          onUpdateSettings({ videoLocalEndpoint: url.trim() });
        }
      }
    } catch (e: any) {
      if (type === 'image') {
        setImageTestSuccess(false);
        setImageTestMessage(`Connection failed: ${e.message}`);
      } else {
        setVideoTestSuccess(false);
        setVideoTestMessage(`Connection failed: ${e.message}`);
      }
    } finally {
      if (type === 'image') setIsTestingImage(false);
      else setIsTestingVideo(false);
    }
  };

  // Kilo AI Gateway draft state
  const [kiloKeyDraft, setKiloKeyDraft] = useState(settings.kiloApiKey || '');
  const [kiloKeySaved, setKiloKeySaved] = useState(false);

  // Custom agent prompt draft state
  const [customAgentPromptDraft, setCustomAgentPromptDraft] = useState(
    settings.customAgentPrompt || ''
  );
  const [customPromptSaved, setCustomPromptSaved] = useState(false);

  // New custom model form state
  const [showAddModel, setShowAddModel] = useState(false);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelDesc, setNewModelDesc] = useState('');
  const [newModelProvider, setNewModelProvider] = useState<AIProvider>('huggingface');

  // Generation provider keys / endpoints (Image & Video Studio)
  const [providerDrafts, setProviderDrafts] = useState<Record<string, string>>(() => ({
    ...(settings.providerKeys || {}),
  }));
  const [providerSaved, setProviderSaved] = useState<string | null>(null);
  const [showCustomProvider, setShowCustomProvider] = useState(false);
  const [customDraft, setCustomDraft] = useState<CustomProviderConfig>(
    settings.customProvider || DEFAULT_CUSTOM_PROVIDER
  );

  const handleNsfwChange = (mode: NsfwMode) => {
    haptic.trigger('selection');
    onUpdateSettings({ nsfwMode: mode });
  };

  const handleToggleMatureChat = () => {
    haptic.trigger('selection');

    // Turning the master switch off also resets every per-character chat to SFW.
    if (settings.chatNsfwMode === 'nsfw') {
      clearStoredPersonaNsfwOverrides();
      onUpdateSettings({ chatNsfwMode: 'sfw' });
      return;
    }

    if (!settings.chatAgeVerified) {
      setShowChatAgeGate(true);
      return;
    }

    onUpdateSettings({ chatNsfwMode: 'nsfw' });
  };

  const handleConfirmChatAge = () => {
    onUpdateSettings({ chatAgeVerified: true, chatNsfwMode: 'nsfw' });
    setShowChatAgeGate(false);
  };

  const handleChatProviderChange = (provider: ChatProvider) => {
    haptic.trigger('selection');
    const preset = CHAT_PROVIDER_PRESETS[provider];
    onUpdateSettings({
      chatProvider: provider,
      chatModel: preset.model,
      chatEndpoint: preset.endpoint,
      chatApiKey: provider === 'kilo' ? (settings.kiloApiKey || '') : '',
    });
    setChatKeyDraft(provider === 'kilo' ? (settings.kiloApiKey || '') : '');
  };

  const handleSaveChatKey = () => {
    haptic.trigger('success');
    onUpdateSettings({ chatApiKey: chatKeyDraft.trim() });
    setChatKeySaved(true);
    setTimeout(() => setChatKeySaved(false), 2000);
  };

  const handleSaveKiloKey = () => {
    haptic.trigger('success');
    onUpdateSettings({ kiloApiKey: kiloKeyDraft.trim() });
    setKiloKeySaved(true);
    setTimeout(() => setKiloKeySaved(false), 2000);
  };

  const handleAgentModeChange = (mode: AgentMode) => {
    haptic.trigger('selection');
    onUpdateSettings({ agentMode: mode });
  };

  const handleSaveCustomAgentPrompt = () => {
    haptic.trigger('success');
    onUpdateSettings({ customAgentPrompt: customAgentPromptDraft.trim() });
    setCustomPromptSaved(true);
    setTimeout(() => setCustomPromptSaved(false), 2000);
  };

  const handleReplyLengthChange = (length: ChatReplyLength) => {
    haptic.trigger('selection');
    onUpdateSettings({ chatReplyLength: length });
  };

  const handleSaveProviderKey = (slot: string) => {
    haptic.trigger('success');
    onUpdateSettings({
      providerKeys: { ...(settings.providerKeys || {}), [slot]: (providerDrafts[slot] || '').trim() },
    });
    setProviderSaved(slot);
    setTimeout(() => setProviderSaved(null), 1800);
  };

  const handleSaveProviderBaseUrl = (providerId: string, value: string) => {
    onUpdateSettings({
      providerBaseUrls: { ...(settings.providerBaseUrls || {}), [providerId]: value.trim() },
    });
  };

  const handleSaveCustomProvider = () => {
    haptic.trigger('success');
    onUpdateSettings({ customProvider: { ...customDraft, enabled: true } });
    setProviderSaved('custom');
    setTimeout(() => setProviderSaved(null), 1800);
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

      {/* 0. Generation Providers & Execution Agents (Local vs Cloud) */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 border border-cyan-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Generation Providers & Execution Agents</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  Local vs Cloud
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Choose between running generations locally (ComfyUI / SD-WebUI / Ollama / WebGPU) or high-speed Cloud APIs with ultra-realism.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              haptic.trigger('selection');
              setIsProviderModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-all active:scale-95 shadow-sm self-start sm:self-auto shrink-0"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Open Provider Studio</span>
          </button>
        </div>

        {/* Realism Booster Feature Switch */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-950/40 via-violet-950/30 to-slate-900 border border-cyan-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>Ultra-Photorealism Engine Boost</span>
                <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/60">
                  Fixes Blurry & Faded Output
                </span>
              </span>
              <p className="text-[10px] text-slate-400">
                Applies raw camera optics (8k uhd, 35mm lens, sharp focus) and filters out washed-out, plastic, or blurry generation artifacts.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.realismBoost !== false}
            onClick={() => {
              haptic.trigger('selection');
              onUpdateSettings({ realismBoost: settings.realismBoost === false });
            }}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ml-3 ${
              settings.realismBoost !== false ? 'bg-cyan-500' : 'bg-slate-800'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.realismBoost !== false ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Image & Video Tabs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Image Generation Provider Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                Image Generation Agent
              </span>
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    haptic.trigger('selection');
                    onUpdateSettings({ imageExecutionMethod: 'cloud' });
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 ${
                    (settings.imageExecutionMethod || 'cloud') === 'cloud'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Cloud className="w-3 h-3" />
                  Cloud
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptic.trigger('selection');
                    onUpdateSettings({ imageExecutionMethod: 'local' });
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 ${
                    settings.imageExecutionMethod === 'local'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Server className="w-3 h-3" />
                  Local
                </button>
              </div>
            </div>

            {(settings.imageExecutionMethod || 'cloud') === 'cloud' ? (
              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-slate-400">Cloud Image Provider</label>
                <select
                  value={settings.imageCloudProvider || 'gemini'}
                  onChange={(e) => {
                    haptic.trigger('selection');
                    onUpdateSettings({ imageCloudProvider: e.target.value as any });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="gemini">Gemini 3.1 Cloud (Ultra-Photorealism & Crisp Focus)</option>
                  <option value="pollinations">FLUX Ultra-Realism (Enhanced Raw Photography)</option>
                  <option value="huggingface">Hugging Face Inference Router (Open Weights)</option>
                </select>

                <div className="pt-1">
                  <label className="block text-[10px] font-medium text-slate-400 mb-1">
                    Cloud API Key (Optional / Overrides Server Key)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="password"
                      value={cloudKeyDraft}
                      onChange={(e) => setCloudKeyDraft(e.target.value)}
                      placeholder="AIzaSy... or custom key"
                      className="flex-1 bg-slate-950 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 border border-slate-800 focus:border-cyan-400 focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        haptic.trigger('success');
                        onUpdateSettings({ cloudApiKey: cloudKeyDraft.trim() });
                        setCloudKeySaved(true);
                        setTimeout(() => setCloudKeySaved(false), 2000);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold shrink-0"
                    >
                      {cloudKeySaved ? <Check className="w-3 h-3 text-emerald-400" /> : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-slate-400">Local Workstation Provider</label>
                <select
                  value={settings.imageLocalProvider || 'comfyui'}
                  onChange={(e) => {
                    haptic.trigger('selection');
                    onUpdateSettings({ imageLocalProvider: e.target.value as any });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="comfyui">ComfyUI Local Server (Workflow Port 8188)</option>
                  <option value="sd-webui">Stable Diffusion WebUI / Forge (Port 7860)</option>
                  <option value="ollama">Ollama Local Vision Engine (Port 11434)</option>
                  <option value="webgpu">In-Browser Local WebGPU Engine</option>
                </select>

                {settings.imageLocalProvider !== 'webgpu' && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-medium text-slate-400">Local Endpoint URL</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={imageEndpointDraft}
                        onChange={(e) => setImageEndpointDraft(e.target.value)}
                        placeholder="http://localhost:8188"
                        className="flex-1 bg-slate-950 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 border border-slate-800 focus:border-cyan-400 focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleTestEndpoint('image', imageEndpointDraft)}
                        disabled={isTestingImage}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 text-xs font-semibold shrink-0"
                      >
                        {isTestingImage ? 'Pinging...' : 'Test'}
                      </button>
                    </div>
                    {imageTestMessage && (
                      <p className={`text-[10px] mt-1 ${imageTestSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {imageTestMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Video Generation Provider Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-violet-400" />
                Video Generation Agent
              </span>
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    haptic.trigger('selection');
                    onUpdateSettings({ videoExecutionMethod: 'cloud' });
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 ${
                    (settings.videoExecutionMethod || 'cloud') === 'cloud'
                      ? 'bg-violet-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Cloud className="w-3 h-3" />
                  Cloud
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptic.trigger('selection');
                    onUpdateSettings({ videoExecutionMethod: 'local' });
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 ${
                    settings.videoExecutionMethod === 'local'
                      ? 'bg-violet-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Server className="w-3 h-3" />
                  Local
                </button>
              </div>
            </div>

            {(settings.videoExecutionMethod || 'cloud') === 'cloud' ? (
              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-slate-400">Cloud Video Provider</label>
                <select
                  value={settings.videoCloudProvider || 'pollinations'}
                  onChange={(e) => {
                    haptic.trigger('selection');
                    onUpdateSettings({ videoCloudProvider: e.target.value as any });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="pollinations">NoMan 60fps Dynamic Motion Engine</option>
                  <option value="gemini">Gemini Cinematic Video Synthesis</option>
                  <option value="huggingface">Hugging Face Stable Video Diffusion (SVD)</option>
                </select>

                <p className="text-[10px] text-slate-500 pt-1">
                  Processes smooth 30-60 FPS camera motion paths, extensions, and temporal frame interpolation in high fidelity.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-slate-400">Local Workstation Video Provider</label>
                <select
                  value={settings.videoLocalProvider || 'comfyui'}
                  onChange={(e) => {
                    haptic.trigger('selection');
                    onUpdateSettings({ videoLocalProvider: e.target.value as any });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="comfyui">ComfyUI AnimateDiff Video Pipeline</option>
                  <option value="sd-webui">SD-WebUI AnimateDiff Extension</option>
                  <option value="webgpu">In-Browser Local WebGPU Video Shader</option>
                </select>

                {settings.videoLocalProvider !== 'webgpu' && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-medium text-slate-400">Local Endpoint URL</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={videoEndpointDraft}
                        onChange={(e) => setVideoEndpointDraft(e.target.value)}
                        placeholder="http://localhost:8188"
                        className="flex-1 bg-slate-950 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 border border-slate-800 focus:border-violet-400 focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleTestEndpoint('video', videoEndpointDraft)}
                        disabled={isTestingVideo}
                        className="px-2.5 py-1.5 rounded-lg bg-violet-950 border border-violet-800 text-violet-300 hover:bg-violet-900 text-xs font-semibold shrink-0"
                      >
                        {isTestingVideo ? 'Pinging...' : 'Test'}
                      </button>
                    </div>
                    {videoTestMessage && (
                      <p className={`text-[10px] mt-1 ${videoTestSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {videoTestMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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

      {/* 1b. Roleplay Chat Maturity (per-chat toggle default) */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5 border border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Roleplay Chat Maturity</h2>
              <p className="text-[11px] text-slate-400">Default for character chats</p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.chatNsfwMode === 'nsfw'}
            aria-label="Enable mature roleplay by default"
            onClick={handleToggleMatureChat}
            disabled={settings.nsfwMode === 'safe'}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 mt-1 ${
              settings.chatNsfwMode === 'nsfw' ? 'bg-rose-500' : 'bg-slate-800'
            } ${settings.nsfwMode === 'safe' ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.chatNsfwMode === 'nsfw' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Mature mode lets your characters engage in adult romantic and narrative themes. Each
          character also has its own flame toggle in the chat header, so you can keep one chat
          SFW and another mature.
        </p>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span
            className={`px-2 py-0.5 rounded-full font-mono font-bold border ${
              settings.chatAgeVerified
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            {settings.chatAgeVerified ? '18+ VERIFIED' : '18+ VERIFICATION REQUIRED'}
          </span>
          <span className="text-slate-500">Confirmation stays on this device only</span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 leading-snug">
          Mature chat is for fictional adults only. Hard limits are enforced in the prompt: no
          minors, incest, bestiality, sexual violence, coercion, or real people. The underlying
          model may still refuse some requests.
        </div>

        {settings.nsfwMode === 'safe' && (
          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-300">
            Content Filter is set to <strong>Safe Mode</strong>. Switch it to Warning or
            Unrestricted above to unlock mature chat.
          </div>
        )}
      </div>

      {/* 1c. Roleplay Engine (provider / model / endpoint) */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 border border-slate-800">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-violet-400" />
          <div>
            <h2 className="text-sm font-bold text-white">Roleplay Engine</h2>
            <p className="text-[11px] text-slate-400">
              Provider, model, and response style for character chat
            </p>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
            Provider
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {CHAT_PROVIDERS.map((preset) => {
              const selected = settings.chatProvider === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleChatProviderChange(preset.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selected
                      ? 'bg-violet-950/40 border-violet-400 text-white shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Server
                      className={`w-3.5 h-3.5 ${selected ? 'text-violet-400' : 'text-slate-500'}`}
                    />
                    <span className="text-xs font-bold">{preset.shortLabel}</span>
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-1 leading-snug">
                    {preset.id === 'kilo'
                      ? 'Free models & Agent Modes'
                      : preset.id === 'gemini'
                      ? 'Server key, strongest prose'
                      : preset.id === 'ollama'
                      ? 'Local & uncensored'
                      : preset.id === 'openai'
                      ? 'OpenRouter / LM Studio'
                      : 'On-device WebGPU inference'}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {CHAT_PROVIDER_PRESETS[settings.chatProvider]?.hint}
          </p>
        </div>

        {/* Kilo Gateway Free Models Catalog & Key */}
        {settings.chatProvider === 'kilo' && (
          <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span>Kilo Free Models Catalog</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                100% Free Tier
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Select one of Kilo Gateway's completely free, uncensored models optimized for character roleplay and dialogue:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {KILO_FREE_MODELS.map((model) => {
                const isSelected = settings.chatModel === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      haptic.trigger('selection');
                      onUpdateSettings({ chatModel: model.id });
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-violet-900/50 border-violet-400 text-white shadow-sm'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold truncate text-slate-200">
                        {model.name}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2">
                      {model.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-violet-500/20 space-y-1.5">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-violet-400" />
                <span>Kilo API Key (Optional)</span>
              </span>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={kiloKeyDraft}
                  onChange={(e) => setKiloKeyDraft(e.target.value)}
                  placeholder="kilo_... (leave empty to use standard free gateway routing)"
                  className="flex-1 bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-violet-400 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveKiloKey}
                  className="px-3.5 py-2 rounded-lg bg-violet-900 hover:bg-violet-800 text-white text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  {kiloKeySaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                  <span>{kiloKeySaved ? 'Saved' : 'Save Key'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Kilo auto-free models require no key. If you have an account or custom quota token from Kilo Code, paste it here.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              {settings.chatProvider === 'webllm' ? 'Model (read-only)' : 'Model ID'}
            </label>
            <input
              type="text"
              value={settings.chatModel}
              onChange={
                settings.chatProvider === 'webllm'
                  ? undefined
                  : (e) => onUpdateSettings({ chatModel: e.target.value })
              }
              readOnly={settings.chatProvider === 'webllm'}
              placeholder={CHAT_PROVIDER_PRESETS[settings.chatProvider]?.model}
              className={`w-full bg-slate-950 text-xs rounded-lg px-3 py-2 border border-slate-800 font-mono ${
                settings.chatProvider === 'webllm'
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-slate-200 focus:border-violet-400 focus:outline-none'
              }`}
            />
            {settings.chatProvider === 'webllm' && (
              <p className="text-[10px] text-slate-500 mt-1">
                Choose the WebLLM model in Local Models.
              </p>
            )}
          </div>

          {settings.chatProvider !== 'gemini' && settings.chatProvider !== 'webllm' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Endpoint
              </label>
              <input
                type="text"
                value={settings.chatEndpoint}
                onChange={(e) => onUpdateSettings({ chatEndpoint: e.target.value })}
                placeholder={CHAT_PROVIDER_PRESETS[settings.chatProvider]?.endpoint}
                className="w-full bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-violet-400 focus:outline-none font-mono"
              />
            </div>
          )}
        </div>

        {/* Agent Modes Configuration */}
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Roleplay Agent Mode</span>
            </label>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
              {AGENT_MODES.find((m) => m.id === (settings.agentMode || 'character'))?.name || 'Character Mode'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Just like Kilo custom agent modes, adjust how the model acts — as a direct character, omniscient world narrator, dual storyteller, or interactive Game Master (DM):
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {AGENT_MODES.map((mode) => {
              const isSelected = (settings.agentMode || 'character') === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleAgentModeChange(mode.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200">{mode.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400 block mb-1">
                    {mode.tagline}
                  </span>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    {mode.description}
                  </p>
                </button>
              );
            })}
          </div>

          {settings.agentMode === 'custom' && (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Custom Agent Directives & Prompt Template</span>
                </span>
                <button
                  type="button"
                  onClick={handleSaveCustomAgentPrompt}
                  className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all"
                >
                  {customPromptSaved ? <Check className="w-3 h-3 text-slate-950" /> : null}
                  <span>{customPromptSaved ? 'Saved' : 'Save Directives'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Write tailored guidelines for this agent (narrative perspective, dialect, pacing rules, world facts):
              </p>
              <textarea
                value={customAgentPromptDraft}
                onChange={(e) => setCustomAgentPromptDraft(e.target.value)}
                placeholder="e.g. Always respond in second-person perspective ('You see...', 'You feel...'). Describe environmental lighting and background music. Keep dialogue witty and sarcastic..."
                rows={4}
                className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl p-3 border border-slate-800 focus:border-cyan-400 focus:outline-none font-mono"
              />
            </div>
          )}
        </div>

        {settings.chatProvider === 'openai' && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              Provider API key (stored in this browser only)
            </span>
            <div className="flex gap-2">
              <input
                type="password"
                value={chatKeyDraft}
                onChange={(e) => setChatKeyDraft(e.target.value)}
                placeholder="sk-or-v1-..."
                className="flex-1 bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-violet-400 focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleSaveChatKey}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
              >
                {chatKeySaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                <span>{chatKeySaved ? 'Saved' : 'Save Key'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              The key is sent with each chat request from your own app server. Never commit it to
              the repo.
            </p>
          </div>
        )}

        {settings.chatProvider === 'ollama' && (
          <p className="text-[10px] text-slate-500 font-mono">
            Tip: `ollama pull llama3.2` then keep `ollama serve` running. Use an uncensored model
            for unrestricted mature roleplay.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                Temperature
              </span>
              <span className="font-mono text-slate-300">
                {settings.chatTemperature.toFixed(2)}
              </span>
            </label>
            <input
              type="range"
              min={0.5}
              max={1.2}
              step={0.05}
              value={settings.chatTemperature}
              onChange={(e) =>
                onUpdateSettings({ chatTemperature: parseFloat(e.target.value) })
              }
              className="w-full accent-violet-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Higher is more varied; lower is more consistent.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
              Reply length
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {REPLY_LENGTHS.map((option) => {
                const selected = settings.chatReplyLength === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleReplyLengthChange(option.id)}
                    className={`px-2 py-2 rounded-lg border text-center transition-all ${
                      selected
                        ? 'bg-violet-950/50 border-violet-400 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="block text-[11px] font-bold">{option.label}</span>
                    <span className="block text-[9px] text-slate-500 mt-0.5">{option.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Local fallback: keeps chat alive on a free model when the paid
            provider has no credits, no key, or is rate limited. */}
        <div className="pt-3 border-t border-slate-800 space-y-2.5">
          <label className="flex items-start justify-between gap-3 cursor-pointer">
            <span>
              <span className="block text-xs font-semibold text-slate-200">
                Fall back to a local model
              </span>
              <span className="block text-[10px] text-slate-500 mt-0.5">
                If the provider fails before replying (no credits, bad key, rate limit), retry
                once on Ollama. Requires Ollama running where this app is served.
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.chatFallbackEnabled === true}
              onChange={(e) => {
                haptic.trigger('selection');
                onUpdateSettings({ chatFallbackEnabled: e.target.checked });
              }}
              className="mt-0.5 w-4 h-4 accent-violet-500 shrink-0"
            />
          </label>

          {settings.chatFallbackEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Local endpoint
                </label>
                <input
                  type="text"
                  value={settings.chatFallbackEndpoint}
                  onChange={(e) => onUpdateSettings({ chatFallbackEndpoint: e.target.value })}
                  placeholder="http://localhost:11434"
                  className="w-full bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-violet-400 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Local model
                </label>
                <input
                  type="text"
                  value={settings.chatFallbackModel}
                  onChange={(e) => onUpdateSettings({ chatFallbackModel: e.target.value })}
                  placeholder="llama3.2"
                  className="w-full bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-violet-400 focus:outline-none font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1g. Generation providers: keys, endpoints and a custom JSON workflow */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 border border-slate-800">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">API Provider Keys</h2>
        </div>
        <p className="text-xs text-slate-400">
          Paste a key for any provider whose models you want in Image Studio. Keys stay in this
          browser; set the matching env var on the server instead if you would rather keep them
          there. The model list updates automatically.
        </p>

        <div className="space-y-2">
          {MEDIA_PROVIDERS.filter(
            (provider) =>
              !provider.keyless && provider.id !== 'huggingface' && provider.id !== 'custom'
          ).map((provider) => {
            const keySlot = providerKeySlot(provider.id);
            return (
              <div
                key={provider.id}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-200">{provider.label}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">{provider.blurb}</p>
                  </div>
                  {provider.docsUrl && (
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 shrink-0"
                    >
                      <span>Docs</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={providerDrafts[keySlot] || ''}
                    onChange={(e) =>
                      setProviderDrafts({ ...providerDrafts, [keySlot]: e.target.value })
                    }
                    placeholder={provider.keyLabel || 'API key'}
                    className="flex-1 min-w-0 bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-emerald-400 focus:outline-none font-mono"
                  />
                  <button
                    onClick={() => handleSaveProviderKey(keySlot)}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 shrink-0"
                  >
                    {providerSaved === keySlot ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : null}
                    <span>{providerSaved === keySlot ? 'Saved' : 'Save Key'}</span>
                  </button>
                </div>

                {provider.credentialFields?.map((field) => {
                  const slot = providerKeySlot(provider.id, field.key);
                  return (
                    <div key={field.key} className="flex gap-2">
                      <input
                        type={field.secret === false ? 'text' : 'password'}
                        value={providerDrafts[slot] || ''}
                        onChange={(e) =>
                          setProviderDrafts({ ...providerDrafts, [slot]: e.target.value })
                        }
                        placeholder={field.placeholder}
                        aria-label={`${provider.label} ${field.label}`}
                        className="flex-1 min-w-0 bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-emerald-400 focus:outline-none font-mono"
                      />
                      <button
                        onClick={() => handleSaveProviderKey(slot)}
                        className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold shrink-0"
                      >
                        {providerSaved === slot ? 'Saved' : `Save ${field.label}`}
                      </button>
                    </div>
                  );
                })}

                {provider.editableBaseUrl && (
                  <input
                    type="text"
                    defaultValue={settings.providerBaseUrls?.[provider.id] || ''}
                    onBlur={(e) => handleSaveProviderBaseUrl(provider.id, e.target.value)}
                    placeholder={`Base URL (default ${provider.defaultBaseUrl})`}
                    aria-label={`${provider.label} base URL`}
                    className="w-full bg-slate-950 text-slate-300 text-[11px] rounded-lg px-3 py-1.5 border border-slate-800 focus:border-emerald-400 focus:outline-none font-mono"
                  />
                )}

                {provider.envVar && (
                  <p className="text-[10px] text-slate-500 font-mono">
                    Server env: {provider.envVar}
                    {provider.id === 'cloudflare' ? ' + CLOUDFLARE_ACCOUNT_ID' : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <button
            onClick={() => setShowCustomProvider(!showCustomProvider)}
            className="w-full flex items-start justify-between gap-2 text-left"
          >
            <div>
              <span className="text-xs font-semibold text-slate-200">Custom JSON endpoint</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Any API the app does not ship: a ComfyUI wrapper, a relay, your own Worker.
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                showCustomProvider ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showCustomProvider && (
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={customDraft.baseUrl}
                  onChange={(e) => setCustomDraft({ ...customDraft, baseUrl: e.target.value })}
                  placeholder="https://my-worker.example.com/generate"
                  aria-label="Custom endpoint URL"
                  className="bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-emerald-400 focus:outline-none font-mono"
                />
                <input
                  type="password"
                  value={customDraft.apiKey}
                  onChange={(e) => setCustomDraft({ ...customDraft, apiKey: e.target.value })}
                  placeholder="API key (optional)"
                  aria-label="Custom endpoint API key"
                  className="bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-emerald-400 focus:outline-none font-mono"
                />
                <input
                  type="text"
                  value={customDraft.model}
                  onChange={(e) => setCustomDraft({ ...customDraft, model: e.target.value })}
                  placeholder="Model id"
                  aria-label="Custom model id"
                  className="bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-emerald-400 focus:outline-none font-mono"
                />
                <input
                  type="text"
                  value={customDraft.resultPath}
                  onChange={(e) => setCustomDraft({ ...customDraft, resultPath: e.target.value })}
                  placeholder="Result path, e.g. data.0.url"
                  aria-label="Custom result path"
                  className="bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-emerald-400 focus:outline-none font-mono"
                />
              </div>

              <label className="block text-[11px] text-slate-400">
                Body template (JSON). Placeholders: {"'{{prompt}} {{negative}} {{width}} {{height}} {{seed}} {{model}} {{aspect_ratio}}'"}
                <textarea
                  rows={5}
                  value={customDraft.bodyTemplate}
                  onChange={(e) =>
                    setCustomDraft({ ...customDraft, bodyTemplate: e.target.value })
                  }
                  className="mt-1 w-full bg-slate-950 text-slate-200 text-[11px] rounded-lg px-3 py-2 border border-slate-800 focus:border-emerald-400 focus:outline-none font-mono"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={customDraft.headers}
                  onChange={(e) => setCustomDraft({ ...customDraft, headers: e.target.value })}
                  placeholder='Extra headers JSON, e.g. {"X-Key":"abc"}'
                  aria-label="Custom headers"
                  className="bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-emerald-400 focus:outline-none font-mono"
                />
                <input
                  type="text"
                  value={customDraft.pollUrl || ''}
                  onChange={(e) => setCustomDraft({ ...customDraft, pollUrl: e.target.value })}
                  placeholder="Poll URL (optional, uses {{jobId}})"
                  aria-label="Custom poll URL"
                  className="bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-emerald-400 focus:outline-none font-mono"
                />
                <input
                  type="text"
                  value={customDraft.jobIdPath || ''}
                  onChange={(e) => setCustomDraft({ ...customDraft, jobIdPath: e.target.value })}
                  placeholder="Job id path, e.g. id"
                  aria-label="Custom job id path"
                  className="bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-emerald-400 focus:outline-none font-mono"
                />
                <input
                  type="text"
                  value={customDraft.doneValue || ''}
                  onChange={(e) => setCustomDraft({ ...customDraft, doneValue: e.target.value })}
                  placeholder="Done status value (default succeeded)"
                  aria-label="Custom done value"
                  className="bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-emerald-400 focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-500 font-mono">
                  Add models for it in Custom Models below using provider "custom".
                </span>
                <button
                  onClick={handleSaveCustomProvider}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 shrink-0"
                >
                  {providerSaved === 'custom' ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{providerSaved === 'custom' ? 'Saved' : 'Save Endpoint'}</span>
                </button>
              </div>
            </div>
          )}
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
                  {MEDIA_PROVIDERS.filter((provider) => provider.id !== 'custom').map(
                    (provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    )
                  )}
                  <option value="custom">Custom endpoint</option>
                  <option value="local">Local</option>
                  <option value="webgpu">WebGPU</option>
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

      {/* 3. Typography & Gemini AI Theme Studio */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Typography & Studio Theme</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  Gemini AI
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Customize fonts, scaling, and generate any aesthetic theme using Gemini AI
              </p>
            </div>
          </div>

          {onOpenThemeStudio && (
            <button
              onClick={() => {
                haptic.trigger('selection');
                onOpenThemeStudio();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition-all self-start sm:self-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Theme Studio & Gemini Alchemist</span>
            </button>
          )}
        </div>

        {/* Font Family Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Primary Body Font
            </label>
            <select
              value={settings.fontFamily || 'Plus Jakarta Sans'}
              onChange={(e) => {
                haptic.trigger('selection');
                loadGoogleFont(e.target.value);
                onUpdateSettings({ fontFamily: e.target.value });
              }}
              className="w-full bg-slate-950 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:border-cyan-400 focus:outline-none"
            >
              {CURATED_FONTS.map((f) => (
                <option key={f.family} value={f.family}>
                  {f.label} ({f.category})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Heading Display Font
            </label>
            <select
              value={settings.fontHeading || settings.fontFamily || 'Plus Jakarta Sans'}
              onChange={(e) => {
                haptic.trigger('selection');
                loadGoogleFont(e.target.value);
                onUpdateSettings({ fontHeading: e.target.value });
              }}
              className="w-full bg-slate-950 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:border-cyan-400 focus:outline-none"
            >
              {CURATED_FONTS.map((f) => (
                <option key={f.family} value={f.family}>
                  {f.label} ({f.category})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Font Scale Buttons */}
        <div>
          <label className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
            <span>Font Size Scale</span>
            <span className="font-mono text-cyan-400">
              {settings.fontSizeScale === 'compact' ? 'Compact 93%' : settings.fontSizeScale === 'relaxed' ? 'Relaxed 108%' : 'Balanced 100%'}
            </span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'compact', label: 'Compact' },
              { id: 'normal', label: 'Balanced' },
              { id: 'relaxed', label: 'Relaxed' },
            ].map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  haptic.trigger('selection');
                  onUpdateSettings({ fontSizeScale: sc.id as FontSizeScale });
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                  (settings.fontSizeScale || 'normal') === sc.id
                    ? 'bg-cyan-950/40 border-cyan-400 text-cyan-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Theme Presets */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Aesthetic Theme Presets
            </span>
            {onOpenThemeStudio && (
              <button
                onClick={onOpenThemeStudio}
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Browse All ({BUILTIN_THEMES.length})</span>
                <Sparkles className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BUILTIN_THEMES.slice(0, 8).map((th) => {
              const isSelected = settings.theme === th.id;
              return (
                <button
                  key={th.id}
                  onClick={() => {
                    haptic.trigger('selection');
                    onUpdateSettings({
                      theme: th.id,
                      activeCustomTheme: th,
                      fontFamily: th.typography.fontFamily || settings.fontFamily,
                      fontHeading: th.typography.headingFont || settings.fontHeading,
                      fontMono: th.typography.monoFont || settings.fontMono,
                    });
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                    isSelected
                      ? 'border-cyan-400 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-white/20"
                      style={{ backgroundColor: th.colors.primaryAccent }}
                    />
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-white/20"
                      style={{ backgroundColor: th.colors.background }}
                    />
                  </div>
                  <span className="text-xs font-bold block truncate text-slate-200">{th.name}</span>
                  <span className="text-[10px] text-slate-500 capitalize block truncate mt-0.5">{th.vibe}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. iOS Appearance & Tactile Haptics */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 border border-slate-800">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">iOS & Touch Ergonomics</h2>
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
      </div>

      <AgeGateModal
        isOpen={showChatAgeGate}
        onClose={() => setShowChatAgeGate(false)}
        onConfirm={handleConfirmChatAge}
      />

      {/* Provider & Execution Agent Setup Modal */}
      {isProviderModalOpen && (
        <ProviderAgentSetupModal
          isOpen={isProviderModalOpen}
          onClose={() => setIsProviderModalOpen(false)}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          initialTab="image"
        />
      )}
    </div>
  );
};
