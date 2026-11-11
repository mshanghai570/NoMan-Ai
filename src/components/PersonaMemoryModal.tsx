import React from 'react';
import type { PersonaMemory } from '../types';
import { Brain, X, Trash2, Heart, BookOpen } from 'lucide-react';
import { haptic } from '../utils/haptics';

interface PersonaMemoryModalProps {
  isOpen: boolean;
  personaName: string;
  memory: PersonaMemory;
  onClose: () => void;
  onClear: () => void;
  onDeleteFact: (factId: string) => void;
}

const importanceStyle: Record<string, string> = {
  high: 'bg-rose-950/70 text-rose-300 border-rose-500/40',
  normal: 'bg-slate-800 text-slate-300 border-slate-700',
  low: 'bg-slate-900 text-slate-500 border-slate-800',
};

export const PersonaMemoryModal: React.FC<PersonaMemoryModalProps> = ({
  isOpen,
  personaName,
  memory,
  onClose,
  onClear,
  onDeleteFact,
}) => {
  if (!isOpen) return null;

  const hasMemory = Boolean(memory.summary || memory.relationship || memory.facts.length);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="memory-modal-title"
    >
      <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-800 bg-gradient-to-br from-cyan-950/50 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 id="memory-modal-title" className="text-sm font-bold text-white">
                Long-term Memory
              </h3>
              <p className="text-[11px] text-slate-400">
                What {personaName} remembers about your story
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close memory"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {!hasMemory && (
            <div className="py-8 text-center space-y-2">
              <Brain className="w-8 h-8 text-slate-700 mx-auto" />
              <p className="text-slate-400">
                Nothing stored yet. As the story grows, {personaName} will remember key events,
                promises, and relationship beats here.
              </p>
            </div>
          )}

          {memory.summary && (
            <section className="space-y-1.5">
              <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                <BookOpen className="w-3.5 h-3.5" />
                Story So Far
              </h4>
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                {memory.summary}
              </p>
            </section>
          )}

          {memory.relationship && (
            <section className="space-y-1.5">
              <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-400">
                <Heart className="w-3.5 h-3.5" />
                Relationship
              </h4>
              <p className="text-slate-300 leading-relaxed">{memory.relationship}</p>
            </section>
          )}

          {memory.facts.length > 0 && (
            <section className="space-y-1.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Durable Facts ({memory.facts.length})
              </h4>
              <ul className="space-y-1.5">
                {memory.facts.map((fact) => (
                  <li
                    key={fact.id}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 group"
                  >
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded border font-mono uppercase shrink-0 mt-0.5 ${
                        importanceStyle[fact.importance] || importanceStyle.normal
                      }`}
                    >
                      {fact.importance}
                    </span>
                    <span className="flex-1 text-slate-300 leading-snug">{fact.text}</span>
                    <button
                      type="button"
                      onClick={() => {
                        haptic.trigger('warning');
                        onDeleteFact(fact.id);
                      }}
                      className="p-1 rounded text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Forget this fact"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            disabled={!hasMemory}
            onClick={() => {
              haptic.trigger('warning');
              onClear();
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${
              hasMemory
                ? 'text-rose-300 hover:bg-rose-950/60 border border-rose-500/30'
                : 'text-slate-600 border border-slate-800 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Forget everything
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
