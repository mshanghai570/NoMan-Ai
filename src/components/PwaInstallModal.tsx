import React from 'react';
import { Smartphone, Share, PlusSquare, Check, X, Sparkles } from 'lucide-react';
import { haptic } from '../utils/haptics';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Install NoMan AI on iOS</h2>
          </div>
          <button
            onClick={() => {
              haptic.trigger('selection');
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* App Icon & Blurb */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-cyan-500/30 shrink-0">
            <img
              src="/src/assets/images/noman_app_icon_1794392784917.jpg"
              alt="NoMan AI Icon"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-white">NoMan AI Web App</h3>
            <p className="text-[11px] text-slate-400">Run fullscreen like a native iOS app with zero browser URL bar distractions.</p>
          </div>
        </div>

        {/* 3 Step Visual Guide */}
        <div className="space-y-3 pt-1 text-xs">
          <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
            <div className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono flex items-center justify-center shrink-0 text-xs font-bold">
              1
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span>Tap the</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-medium text-[11px]">
                  <Share className="w-3 h-3 text-cyan-400" /> Share
                </span>
                <span>button</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Located at the bottom of the Safari toolbar on iPhone, or top bar on iPad.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
            <div className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono flex items-center justify-center shrink-0 text-xs font-bold">
              2
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span>Scroll down & tap</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-medium text-[11px]">
                  <PlusSquare className="w-3 h-3 text-cyan-400" /> Add to Home Screen
                </span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">This saves the app shortcut directly to your iOS springboard.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80">
            <div className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono flex items-center justify-center shrink-0 text-xs font-bold">
              3
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-200">Tap "Add" in the top-right corner</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Launch directly from your home screen with instant loading and offline caching.</p>
            </div>
          </div>
        </div>

        {/* Done / Dismiss Button */}
        <button
          onClick={() => {
            haptic.trigger('selection');
            onClose();
          }}
          className="w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-semibold text-xs active:scale-95 transition-all"
        >
          Got It
        </button>
      </div>
    </div>
  );
};
