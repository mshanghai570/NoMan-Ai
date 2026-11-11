import React from 'react';
import type { User } from '../types';
import { Sparkles, Download, User as UserIcon, ShieldAlert } from 'lucide-react';
import { haptic } from '../utils/haptics';

interface TopBarProps {
  user: User;
  onOpenAuth: () => void;
  onOpenPwaInstall: () => void;
  onQuickGenerate: () => void;
  nsfwMode: 'safe' | 'warn' | 'unrestricted';
}

export const TopBar: React.FC<TopBarProps> = ({
  user,
  onOpenAuth,
  onOpenPwaInstall,
  onQuickGenerate,
  nsfwMode,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full pt-safe glass-panel border-b border-slate-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Zone 1: Single element wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-slate-900 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <img
              src="/src/assets/images/noman_app_icon_1794392784917.jpg"
              alt="NoMan AI"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent whitespace-nowrap">
            NoMan AI
          </span>
        </div>

        {/* Zone 2: Informational / Status Indicators */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400 font-medium">
          <span>Free AI Studio</span>
          <span aria-hidden="true" className="text-slate-700">·</span>
          <span>FLUX & HF Models</span>
          <span aria-hidden="true" className="text-slate-700">·</span>
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${nsfwMode === 'safe' ? 'bg-emerald-400' : nsfwMode === 'warn' ? 'bg-amber-400' : 'bg-rose-400'}`} />
            <span className="capitalize">{nsfwMode} Mode</span>
          </span>
        </div>

        {/* Zone 3: Quick Action & User Profile */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              haptic.trigger('selection');
              onOpenPwaInstall();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800/90 text-slate-200 border border-slate-700/80 hover:bg-slate-750 active:scale-95 transition-all min-h-[36px]"
            title="Install on iOS Home Screen"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden xs:inline">iOS App</span>
          </button>

          <button
            onClick={() => {
              haptic.trigger('impactLight');
              onOpenAuth();
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-slate-900 border border-slate-700/60 hover:border-cyan-500/50 active:scale-95 transition-all min-h-[36px]"
            title="Account & Saved Library"
          >
            <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center">
              {user.avatar ? (
                <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-3 h-3 text-slate-300" />
              )}
            </div>
            <span className="text-xs font-medium text-slate-200 max-w-[90px] truncate hidden sm:inline">
              {user.displayName}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
