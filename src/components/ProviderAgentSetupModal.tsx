import React, { useState } from 'react';
import type {
  UserSettings,
  ExecutionMethod,
  ImageCloudProvider,
  ImageLocalProvider,
  VideoCloudProvider,
  VideoLocalProvider,
} from '../types';
import {
  X,
  Server,
  Cloud,
  Cpu,
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
  Layers,
  Film,
  Zap,
  RefreshCw,
  ExternalLink,
  Shield,
  Sliders,
} from 'lucide-react';
import { haptic } from '../utils/haptics';

interface ProviderAgentSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  initialTab?: 'image' | 'video';
}

export const ProviderAgentSetupModal: React.FC<ProviderAgentSetupModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  initialTab = 'image',
}) => {
  const [activeTab, setActiveTab] = useState<'image' | 'video'>(initialTab);

  // Draft state for immediate responsive editing
  const [imageMethod, setImageMethod] = useState<ExecutionMethod>(settings.imageExecutionMethod || 'cloud');
  const [imageCloud, setImageCloud] = useState<ImageCloudProvider>(settings.imageCloudProvider || 'pollinations');
  const [imageLocal, setImageLocal] = useState<ImageLocalProvider>(settings.imageLocalProvider || 'comfyui');
  const [imageLocalEndpoint, setImageLocalEndpoint] = useState<string>(
    settings.imageLocalEndpoint || 'http://127.0.0.1:8188'
  );

  const [videoMethod, setVideoMethod] = useState<ExecutionMethod>(settings.videoExecutionMethod || 'cloud');
  const [videoCloud, setVideoCloud] = useState<VideoCloudProvider>(settings.videoCloudProvider || 'pollinations');
  const [videoLocal, setVideoLocal] = useState<VideoLocalProvider>(settings.videoLocalProvider || 'webgpu');
  const [videoLocalEndpoint, setVideoLocalEndpoint] = useState<string>(
    settings.videoLocalEndpoint || 'http://127.0.0.1:8188'
  );

  const [hfTokenDraft, setHfTokenDraft] = useState<string>(settings.hfToken || '');
  const [cloudKeyDraft, setCloudKeyDraft] = useState<string>(settings.cloudApiKey || '');
  const [realismBoostDraft, setRealismBoostDraft] = useState<boolean>(settings.realismBoost !== false);

  // Ping test states
  const [isTestingEndpoint, setIsTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    reachable: boolean;
    latencyMs?: number;
    error?: string;
    endpoint?: string;
  } | null>(null);

  const [savedBanner, setSavedBanner] = useState(false);

  if (!isOpen) return null;

  const handleTestEndpoint = async (endpoint: string) => {
    if (!endpoint.trim()) return;
    haptic.trigger('selection');
    setIsTestingEndpoint(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/check-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: endpoint.trim() }),
      });
      const data = await res.json();
      setTestResult({
        tested: true,
        reachable: data.reachable === true,
        latencyMs: data.latencyMs,
        error: data.error,
        endpoint,
      });
      if (data.reachable) {
        haptic.trigger('success');
      } else {
        haptic.trigger('warning');
      }
    } catch (e: any) {
      setTestResult({
        tested: true,
        reachable: false,
        error: e.message || 'Network error reaching test endpoint',
        endpoint,
      });
      haptic.trigger('warning');
    } finally {
      setIsTestingEndpoint(false);
    }
  };

  const handleSaveAll = () => {
    haptic.trigger('success');
    onUpdateSettings({
      imageExecutionMethod: imageMethod,
      imageCloudProvider: imageCloud,
      imageLocalProvider: imageLocal,
      imageLocalEndpoint: imageLocalEndpoint.trim(),
      videoExecutionMethod: videoMethod,
      videoCloudProvider: videoCloud,
      videoLocalProvider: videoLocal,
      videoLocalEndpoint: videoLocalEndpoint.trim(),
      hfToken: hfTokenDraft.trim(),
      cloudApiKey: cloudKeyDraft.trim(),
      realismBoost: realismBoostDraft,
      // Map to defaultModel based on selection
      defaultProvider: imageMethod === 'local' ? 'local' : imageCloud,
      defaultModel:
        imageMethod === 'local'
          ? imageLocal === 'comfyui'
            ? 'local-comfyui'
            : imageLocal === 'ollama'
            ? 'local-ollama'
            : 'local-sd'
          : imageCloud === 'gemini'
          ? 'gemini-imagen-realism'
          : imageCloud === 'huggingface'
          ? 'black-forest-labs/FLUX.1-schnell'
          : 'flux-realism',
    });

    setSavedBanner(true);
    setTimeout(() => {
      setSavedBanner(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col glass-panel rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Provider & Agent Setup</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  Local vs Cloud
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Choose between Cloud APIs (with keys) or your Local Workstation / WebGPU
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              haptic.trigger('selection');
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Domain Switcher Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-5 pt-2">
          <button
            onClick={() => {
              haptic.trigger('selection');
              setActiveTab('image');
              setTestResult(null);
            }}
            className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'image'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Image Generation Agent</span>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                imageMethod === 'cloud' ? 'bg-cyan-950 text-cyan-300' : 'bg-violet-950 text-violet-300'
              }`}
            >
              {imageMethod === 'cloud' ? 'Cloud' : 'Local'}
            </span>
          </button>

          <button
            onClick={() => {
              haptic.trigger('selection');
              setActiveTab('video');
              setTestResult(null);
            }}
            className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'video'
                ? 'border-violet-400 text-violet-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Video Generation Agent</span>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                videoMethod === 'cloud' ? 'bg-cyan-950 text-cyan-300' : 'bg-violet-950 text-violet-300'
              }`}
            >
              {videoMethod === 'cloud' ? 'Cloud' : 'Local'}
            </span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: IMAGE GENERATION SETUP */}
          {activeTab === 'image' && (
            <div className="space-y-5">
              {/* Execution Method Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Execution Method for Image Generation
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      haptic.trigger('selection');
                      setImageMethod('cloud');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      imageMethod === 'cloud'
                        ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-sm'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold text-white">Cloud Provider</span>
                      </div>
                      {imageMethod === 'cloud' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      High-end hosted GPU clusters. Ultra-photorealistic models (Gemini, FLUX Realism, HF).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      haptic.trigger('selection');
                      setImageMethod('local');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      imageMethod === 'local'
                        ? 'bg-violet-950/60 border-violet-400 text-white shadow-sm'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-violet-400" />
                        <span className="text-xs font-bold text-white">Local Workstation</span>
                      </div>
                      {imageMethod === 'local' && <CheckCircle2 className="w-4 h-4 text-violet-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Connect to your own local GPU via ComfyUI, Automatic1111 / SD-WebUI, or Ollama.
                    </p>
                  </button>
                </div>
              </div>

              {/* Sub-Option 1: If Cloud selected */}
              {imageMethod === 'cloud' && (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-2">
                      Select Cloud Image Engine
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          id: 'gemini' as ImageCloudProvider,
                          name: 'Gemini Cloud',
                          sub: 'Flagship Google Photorealism',
                          desc: 'Ultra-sharp, authentic lighting & micro-details.',
                        },
                        {
                          id: 'pollinations' as ImageCloudProvider,
                          name: 'FLUX Realism Studio',
                          sub: 'Free Pollinations Cloud',
                          desc: 'No-key required raw photography & FLUX Schnell.',
                        },
                        {
                          id: 'huggingface' as ImageCloudProvider,
                          name: 'Hugging Face Cloud',
                          sub: 'Inference API & Open Weights',
                          desc: 'SDXL, Realistic Vision, Animagine XL with user token.',
                        },
                      ].map((prov) => {
                        const isSel = imageCloud === prov.id;
                        return (
                          <button
                            key={prov.id}
                            type="button"
                            onClick={() => {
                              haptic.trigger('selection');
                              setImageCloud(prov.id);
                            }}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              isSel
                                ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-sm'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span className="text-xs font-bold block text-white">{prov.name}</span>
                            <span className="text-[10px] text-cyan-400 font-mono block mt-0.5">{prov.sub}</span>
                            <span className="text-[10px] text-slate-400 block mt-1">{prov.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hugging Face Token input if HF selected */}
                  {imageCloud === 'huggingface' && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-amber-400" />
                          <span>Hugging Face Access Token</span>
                        </label>
                        <a
                          href="https://huggingface.co/settings/tokens"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                        >
                          <span>Get Free HF Token</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <input
                        type="password"
                        value={hfTokenDraft}
                        onChange={(e) => setHfTokenDraft(e.target.value)}
                        placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full bg-slate-950 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:border-cyan-400 focus:outline-none font-mono"
                      />
                      <p className="text-[10px] text-slate-400">
                        A free token grants direct access to heavy weights (FLUX.1-dev, Realistic Vision) without queue timeouts.
                      </p>
                    </div>
                  )}

                  {/* Gemini Key notice or custom key */}
                  {imageCloud === 'gemini' && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Google GenAI Integration</span>
                        </label>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                          Built-In Server Capability
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Uses Google GenAI server integration for state-of-the-art photorealism. Optional custom Gemini API key:
                      </p>
                      <input
                        type="password"
                        value={cloudKeyDraft}
                        onChange={(e) => setCloudKeyDraft(e.target.value)}
                        placeholder="AIzaSy... (leave blank to use system server environment)"
                        className="w-full bg-slate-950 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:border-cyan-400 focus:outline-none font-mono"
                      />
                    </div>
                  )}

                  {/* Realism Boost Toggle */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Ultra-Realism & Anti-Faded Tone Shield</span>
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Automatically enriches prompt with optical camera physics (Hasselblad 85mm f/1.4, natural light) and filters out washed-out tones.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={realismBoostDraft}
                      onClick={() => {
                        haptic.trigger('selection');
                        setRealismBoostDraft(!realismBoostDraft);
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                        realismBoostDraft ? 'bg-cyan-500' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          realismBoostDraft ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-Option 2: If Local selected */}
              {imageMethod === 'local' && (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-violet-500/30 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-2">
                      Local Inference Server
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          id: 'comfyui' as ImageLocalProvider,
                          name: 'ComfyUI',
                          port: 'http://127.0.0.1:8188',
                          desc: 'Node-based workstation',
                        },
                        {
                          id: 'sd-webui' as ImageLocalProvider,
                          name: 'Automatic1111 / SD',
                          port: 'http://127.0.0.1:7860',
                          desc: 'Standard WebUI /sdapi',
                        },
                        {
                          id: 'ollama' as ImageLocalProvider,
                          name: 'Ollama Vision',
                          port: 'http://localhost:11434',
                          desc: 'Local Ollama endpoint',
                        },
                      ].map((local) => {
                        const isSel = imageLocal === local.id;
                        return (
                          <button
                            key={local.id}
                            type="button"
                            onClick={() => {
                              haptic.trigger('selection');
                              setImageLocal(local.id);
                              setImageLocalEndpoint(local.port);
                              setTestResult(null);
                            }}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              isSel
                                ? 'bg-violet-950/70 border-violet-400 text-white shadow-sm'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span className="text-xs font-bold block text-white">{local.name}</span>
                            <span className="text-[10px] text-violet-300 font-mono block mt-0.5">{local.port}</span>
                            <span className="text-[10px] text-slate-400 block mt-1">{local.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Local Endpoint Input & Ping Tester */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-300">
                      Workstation Endpoint URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={imageLocalEndpoint}
                        onChange={(e) => setImageLocalEndpoint(e.target.value)}
                        placeholder="http://127.0.0.1:8188"
                        className="flex-1 bg-slate-950 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:border-violet-400 focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleTestEndpoint(imageLocalEndpoint)}
                        disabled={isTestingEndpoint || !imageLocalEndpoint.trim()}
                        className="px-3.5 py-2 rounded-xl bg-violet-900 hover:bg-violet-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTestingEndpoint ? 'animate-spin' : ''}`} />
                        <span>{isTestingEndpoint ? 'Testing...' : 'Test Connection'}</span>
                      </button>
                    </div>

                    {/* Test Result Indicator */}
                    {testResult && testResult.endpoint === imageLocalEndpoint && (
                      <div
                        className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                          testResult.reachable
                            ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                            : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                        }`}
                      >
                        {testResult.reachable ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                        )}
                        <span className="font-medium">
                          {testResult.reachable
                            ? `Connected successfully! Latency: ${testResult.latencyMs}ms`
                            : `Unreachable: ${testResult.error || 'Connection refused. Ensure server is running.'}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VIDEO GENERATION SETUP */}
          {activeTab === 'video' && (
            <div className="space-y-5">
              {/* Execution Method Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Execution Method for Video Generation
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      haptic.trigger('selection');
                      setVideoMethod('cloud');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      videoMethod === 'cloud'
                        ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-sm'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold text-white">Cloud Video Agent</span>
                      </div>
                      {videoMethod === 'cloud' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      High-fps cloud rendering, Hugging Face SVD, and NoMan Cinematic Motion Cloud.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      haptic.trigger('selection');
                      setVideoMethod('local');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      videoMethod === 'local'
                        ? 'bg-violet-950/60 border-violet-400 text-white shadow-sm'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-violet-400" />
                        <span className="text-xs font-bold text-white">Local / On-Device Agent</span>
                      </div>
                      {videoMethod === 'local' && <CheckCircle2 className="w-4 h-4 text-violet-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      100% in-browser WebGPU Neural Motion or local ComfyUI AnimateDiff.
                    </p>
                  </button>
                </div>
              </div>

              {/* Sub-Option 1: If Cloud Video selected */}
              {videoMethod === 'cloud' && (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-2">
                      Select Cloud Video Engine
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          id: 'pollinations' as VideoCloudProvider,
                          name: 'NoMan Motion 60 FPS',
                          sub: 'Flagship Cinematic Cloud',
                          desc: 'Dynamic pan, zoom, orbit & seamless multi-scene extensions.',
                        },
                        {
                          id: 'huggingface' as VideoCloudProvider,
                          name: 'HF · Stable Video Diff',
                          sub: 'SVD-XT Cloud Endpoint',
                          desc: 'Image-to-video diffusion with your Hugging Face token.',
                        },
                        {
                          id: 'gemini' as VideoCloudProvider,
                          name: 'Gemini Omni Video',
                          sub: 'Interactions Video Lab',
                          desc: 'Next-gen video generation and extension engine.',
                        },
                      ].map((prov) => {
                        const isSel = videoCloud === prov.id;
                        return (
                          <button
                            key={prov.id}
                            type="button"
                            onClick={() => {
                              haptic.trigger('selection');
                              setVideoCloud(prov.id);
                            }}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              isSel
                                ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-sm'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span className="text-xs font-bold block text-white">{prov.name}</span>
                            <span className="text-[10px] text-cyan-400 font-mono block mt-0.5">{prov.sub}</span>
                            <span className="text-[10px] text-slate-400 block mt-1">{prov.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Option 2: If Local Video selected */}
              {videoMethod === 'local' && (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-violet-500/30 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-2">
                      Select Local Video Engine
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          id: 'webgpu' as VideoLocalProvider,
                          name: 'WebGPU On-Device Engine',
                          port: 'Direct GPU Browser',
                          desc: 'Zero server required. Runs 100% on local client hardware.',
                        },
                        {
                          id: 'comfyui' as VideoLocalProvider,
                          name: 'Local ComfyUI AnimateDiff',
                          port: 'http://127.0.0.1:8188',
                          desc: 'Connect to local AnimateDiff workflow.',
                        },
                        {
                          id: 'sd-webui' as VideoLocalProvider,
                          name: 'Local Deforum / SD-WebUI',
                          port: 'http://127.0.0.1:7860',
                          desc: 'Frame-by-frame 3D camera synthesis.',
                        },
                      ].map((loc) => {
                        const isSel = videoLocal === loc.id;
                        return (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => {
                              haptic.trigger('selection');
                              setVideoLocal(loc.id);
                              if (loc.id !== 'webgpu') {
                                setVideoLocalEndpoint(loc.port);
                              }
                              setTestResult(null);
                            }}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              isSel
                                ? 'bg-violet-950/70 border-violet-400 text-white shadow-sm'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span className="text-xs font-bold block text-white">{loc.name}</span>
                            <span className="text-[10px] text-violet-300 font-mono block mt-0.5">{loc.port}</span>
                            <span className="text-[10px] text-slate-400 block mt-1">{loc.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {videoLocal !== 'webgpu' && (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <label className="block text-xs font-semibold text-slate-300">
                        Local Video Server Endpoint
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={videoLocalEndpoint}
                          onChange={(e) => setVideoLocalEndpoint(e.target.value)}
                          placeholder="http://127.0.0.1:8188"
                          className="flex-1 bg-slate-950 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:border-violet-400 focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleTestEndpoint(videoLocalEndpoint)}
                          disabled={isTestingEndpoint || !videoLocalEndpoint.trim()}
                          className="px-3.5 py-2 rounded-xl bg-violet-900 hover:bg-violet-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isTestingEndpoint ? 'animate-spin' : ''}`} />
                          <span>{isTestingEndpoint ? 'Testing...' : 'Test Connection'}</span>
                        </button>
                      </div>

                      {testResult && testResult.endpoint === videoLocalEndpoint && (
                        <div
                          className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                            testResult.reachable
                              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                              : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          {testResult.reachable ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                          ) : (
                            <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                          )}
                          <span className="font-medium">
                            {testResult.reachable
                              ? `Connected successfully! Latency: ${testResult.latencyMs}ms`
                              : `Unreachable: ${testResult.error || 'Connection refused.'}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Save CTA */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            {savedBanner ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Configuration saved successfully!</span>
              </span>
            ) : (
              <span>Preferences saved locally to device</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition-all"
            >
              Apply & Save Setup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
