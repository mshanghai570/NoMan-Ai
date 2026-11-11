import React, { useEffect, useState } from 'react';
import { Flame, ShieldAlert, Check, X, Lock } from 'lucide-react';
import { haptic } from '../utils/haptics';

interface AgeGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  personaName?: string;
}

/**
 * One-time 18+ consent gate for mature roleplay chat.
 * Mirrors the age-verification step SpicyChat-style apps require before
 * unlocking NSFW content. The confirmation is persisted by the caller.
 */
export const AgeGateModal: React.FC<AgeGateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  personaName,
}) => {
  const [confirmed, setConfirmed] = useState(false);

  // Reset the checkbox every time the modal is reopened
  useEffect(() => {
    if (isOpen) setConfirmed(false);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-rose-500/40 shadow-2xl shadow-rose-950/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-800 bg-gradient-to-br from-rose-950/60 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 id="age-gate-title" className="text-sm font-bold text-white">
                Mature Roleplay Mode
              </h3>
              <p className="text-[11px] text-rose-300/90 font-mono">18+ CONTENT WARNING</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close age verification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5 text-xs text-slate-300">
          <p>
            You are about to unlock mature, fictional roleplay
            {personaName ? (
              <>
                {' '}with <strong className="text-white">{personaName}</strong>
              </>
            ) : null}
            . This chat may include adult themes, suggestive dialogue, and explicit
            language.
          </p>

          <ul className="space-y-2">
            {[
              'All characters and scenarios are fictional. Every character is an adult.',
              'No minors, non-consensual sexual violence, bestiality, or real people.',
              'Mature mode is stored locally on this device and can be disabled anytime.',
              'AI-generated content may be inaccurate or offensive. Use your judgment.',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span className="text-slate-400 leading-snug">{line}</span>
              </li>
            ))}
          </ul>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => {
                setConfirmed(e.target.checked);
                if (e.target.checked) haptic.trigger('selection');
              }}
              className="mt-0.5 w-4 h-4 accent-rose-500 shrink-0"
            />
            <span className="text-[11px] text-slate-300 leading-snug">
              I confirm I am at least <strong className="text-white">18 years old</strong> and
              consent to viewing mature fictional content.
            </span>
          </label>

          <p className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
            <Lock className="w-3 h-3" />
            Verification stays on this device. No ID or data is uploaded.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
          >
            Keep it SFW
          </button>
          <button
            type="button"
            disabled={!confirmed}
            onClick={() => {
              haptic.trigger('success');
              onConfirm();
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              confirmed
                ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/20 active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Enable Mature Mode</span>
          </button>
        </div>
      </div>
    </div>
  );
};
