import React, { useState } from 'react';
import type { GenerationItem, UpscaleResult } from '../types';
import { UpscalerService } from '../services/upscaler';
import {
  Maximize2,
  Sparkles,
  Download,
  Bookmark,
  Check,
  X,
  AlertCircle,
  Sliders,
  ZoomIn,
  ArrowRight,
  SplitSquareVertical,
} from 'lucide-react';
import { haptic } from '../utils/haptics';

interface UpscaleModalProps {
  item: GenerationItem;
  hfToken?: string;
  isOpen: boolean;
  onClose: () => void;
  onSaveUpscaled: (newItem: GenerationItem) => void;
}

export const UpscaleModal: React.FC<UpscaleModalProps> = ({
  item,
  hfToken,
  isOpen,
  onClose,
  onSaveUpscaled,
}) => {
  const [scale, setScale] = useState<2 | 4>(2);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [upscaleResult, setUpscaleResult] = useState<UpscaleResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [splitPos, setSplitPos] = useState(50); // percentage for split comparison slider
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const originalW = item.width || 1024;
  const originalH = item.height || 1024;
  const targetW = originalW * scale;
  const targetH = originalH * scale;

  const handleApplyUpscale = async () => {
    haptic.trigger('impactHeavy');
    setIsUpscaling(true);
    setErrorMessage(null);
    setUpscaleResult(null);
    setIsSaved(false);
    setProgressPercent(10);
    setProgressStatus('Initializing super-resolution neural model...');

    try {
      const result = await UpscalerService.upscaleImage(
        {
          imageUrl: item.mediaUrl,
          scale,
          prompt: item.prompt,
          seed: item.seed,
          width: originalW,
          height: originalH,
          hfToken,
        },
        (p, status) => {
          setProgressPercent(p);
          setProgressStatus(status);
        }
      );

      setUpscaleResult(result);
      haptic.trigger('success');
    } catch (err: any) {
      console.error('Upscale error:', err);
      setErrorMessage(err.message || 'Upscaling failed. Please check network or try 2x mode.');
      haptic.trigger('warning');
    } finally {
      setIsUpscaling(false);
    }
  };

  const handleSaveToLibrary = () => {
    if (!upscaleResult) return;
    haptic.trigger('selection');

    const newItem: GenerationItem = {
      id: `gen_upscale_${Date.now()}`,
      userId: item.userId,
      type: 'image',
      prompt: `${item.prompt} [${upscaleResult.scale}x Super-Resolution]`,
      negativePrompt: item.negativePrompt,
      model: `${item.model}-upscale-${upscaleResult.scale}x`,
      modelLabel: `${item.modelLabel} (${upscaleResult.scale}x Super-Res)`,
      provider: item.provider,
      aspectRatio: item.aspectRatio,
      width: upscaleResult.width,
      height: upscaleResult.height,
      mediaUrl: upscaleResult.upscaledUrl,
      thumbnailUrl: upscaleResult.upscaledUrl,
      seed: item.seed,
      steps: item.steps,
      cfgScale: item.cfgScale,
      createdAt: Date.now(),
      isFavorite: false,
      tags: [...item.tags, `${upscaleResult.scale}x-Upscale`, 'Ultra-HD'],
      isNsfw: item.isNsfw,
      isUpscaled: true,
      upscaleFactor: upscaleResult.scale,
      originalMediaId: item.id,
    };

    onSaveUpscaled(newItem);
    setIsSaved(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center">
              <Maximize2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>AI Super-Resolution Upscaler</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono">
                  External API
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Enhance sub-pixel details and increase image resolution by 2x or 4x.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              haptic.trigger('selection');
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center min-h-[260px] max-h-[420px]">
          {upscaleResult ? (
            /* Interactive Split Comparison Slider */
            <div
              className="relative w-full h-[360px] select-none cursor-ew-resize overflow-hidden"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
                setSplitPos((x / rect.width) * 100);
              }}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                const rect = e.currentTarget.getBoundingClientRect();
                const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
                setSplitPos((x / rect.width) * 100);
              }}
            >
              {/* After (Upscaled) Layer */}
              <img
                src={upscaleResult.upscaledUrl}
                alt="Upscaled"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-contain"
              />

              {/* Before (Original) Layer clipped */}
              <div
                className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                style={{ width: `${splitPos}%` }}
              >
                <img
                  src={item.mediaUrl}
                  alt="Original"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-contain max-w-none"
                  style={{ width: '100%', height: '100%' }}
                />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono font-bold text-slate-300">
                  Original (1x)
                </span>
              </div>

              {/* After label */}
              <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-300">
                Super-Res ({upscaleResult.scale}x)
              </span>

              {/* Center Drag Handle indicator */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-cyan-400 text-slate-950 shadow-lg flex items-center justify-center pointer-events-none"
                style={{ left: `${splitPos}%` }}
              >
                <SplitSquareVertical className="w-4 h-4 rotate-90" />
              </div>
            </div>
          ) : (
            <div className="relative w-full h-[320px] flex items-center justify-center">
              <img
                src={item.mediaUrl}
                alt={item.prompt}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />

              {/* Floating current dimension badge */}
              <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[11px] font-mono text-slate-300 border border-slate-700">
                Current: {originalW} × {originalH}px
              </span>
            </div>
          )}

          {/* Upscaling in-progress overlay */}
          {isUpscaling && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-white">Applying {scale}x Neural Super-Resolution</h3>
                <p className="text-[11px] text-cyan-300 font-mono">{progressStatus}</p>
              </div>
              <div className="w-48 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-cyan-400 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Resolution Scale Factor Selector (2x vs 4x) */}
        {!upscaleResult && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Target Resolution Scale
            </span>
            <div className="grid grid-cols-2 gap-3">
              {/* 2x Option */}
              <button
                type="button"
                onClick={() => {
                  haptic.trigger('selection');
                  setScale(2);
                }}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  scale === 2
                    ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-sm'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">2x Ultra-HD</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300 font-mono">
                    Fast
                  </span>
                </div>
                <div className="text-[11px] text-cyan-300 font-mono mt-1">
                  {originalW * 2} × {originalH * 2}px
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Doubles pixel density. Crisp clarity for printing and high-res displays.
                </p>
              </button>

              {/* 4x Option */}
              <button
                type="button"
                onClick={() => {
                  haptic.trigger('selection');
                  setScale(4);
                }}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  scale === 4
                    ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-sm'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">4x Cinema-Res</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-900/60 text-violet-300 font-mono">
                    Max Quality
                  </span>
                </div>
                <div className="text-[11px] text-violet-300 font-mono mt-1">
                  {originalW * 4} × {originalH * 4}px
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Extreme 4x super-sampling up to 4096px. Micro-texture enhancement.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-800">
          {upscaleResult ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="font-mono text-cyan-400 font-bold">
                  ✓ {upscaleResult.width} × {upscaleResult.height}px ({upscaleResult.scale}x)
                </span>
                <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                  Engine: {upscaleResult.engine}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveToLibrary}
                  disabled={isSaved}
                  className={`h-11 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    isSaved
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 active:scale-95'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  <span>{isSaved ? 'Saved to Collection' : 'Save Upscaled Image'}</span>
                </button>

                <a
                  href={upscaleResult.upscaledUrl}
                  download={`noman_super_res_${upscaleResult.scale}x_${item.id}.png`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => haptic.trigger('selection')}
                  className="h-11 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700/80 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Ultra-HD PNG</span>
                </a>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleApplyUpscale}
              disabled={isUpscaling}
              className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg min-h-[48px] transition-all ${
                isUpscaling
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/20 active:scale-[0.98]'
              }`}
            >
              <Maximize2 className="w-4 h-4" />
              <span>Upscale to {scale}x ({targetW} × {targetH}px)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
