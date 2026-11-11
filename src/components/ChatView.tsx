import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage, RoleplayPersona, UserSettings } from '../types';
import { DEFAULT_PERSONAS } from '../constants/personas';
import {
  getStoredConversationForPersona,
  saveStoredConversation,
  clearStoredConversation,
  getStoredCustomPersonas,
  saveStoredCustomPersonas,
} from '../services/storage';
import {
  MessageSquare,
  Sparkles,
  Send,
  RotateCcw,
  Plus,
  Users,
  Palette,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Check,
  Trash2,
  X,
  Bot,
  User,
  ArrowRight,
} from 'lucide-react';
import { haptic } from '../utils/haptics';

interface ChatViewProps {
  settings: UserSettings;
  onSendToStudio: (prompt: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ settings, onSendToStudio }) => {
  // Personas state (default + custom)
  const [customPersonas, setCustomPersonas] = useState<RoleplayPersona[]>(() =>
    getStoredCustomPersonas()
  );
  const allPersonas = [...DEFAULT_PERSONAS, ...customPersonas];

  const [activePersonaId, setActivePersonaId] = useState<string>(
    () => allPersonas[0]?.id || 'persona_kira'
  );
  const activePersona =
    allPersonas.find((p) => p.id === activePersonaId) || allPersonas[0] || DEFAULT_PERSONAS[0];

  // Conversation history state loaded from localStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    getStoredConversationForPersona(activePersona.id, activePersona.greeting)
  );

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showPersonaDrawer, setShowPersonaDrawer] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScenarioInfo, setShowScenarioInfo] = useState(false);

  // New custom persona form
  const [newName, setNewName] = useState('');
  const [newTagline, setNewTagline] = useState('');
  const [newCategory, setNewCategory] = useState<RoleplayPersona['category']>('Custom');
  const [newGreeting, setNewGreeting] = useState('');
  const [newSystemPrompt, setNewSystemPrompt] = useState('');
  const [newScenario, setNewScenario] = useState('');
  const [newAvatar, setNewAvatar] = useState('/src/assets/images/sample_cyber_portrait_1794392786213.jpg');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // When active persona changes, load its conversation from localStorage
  useEffect(() => {
    const loaded = getStoredConversationForPersona(activePersona.id, activePersona.greeting);
    setMessages(loaded);
  }, [activePersona.id]);

  // Scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || isTyping) return;

    haptic.trigger('selection');

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const updatedWithUser = [...messages, userMsg];
    setMessages(updatedWithUser);
    saveStoredConversation(activePersona.id, updatedWithUser);
    setInputText('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setIsTyping(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: activePersona,
          messages: updatedWithUser,
          userMessage: content,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat error ${response.status}`);
      }

      const data = await response.json();
      const replyContent = data.reply || `*${activePersona.name} nods thoughtfully.*`;

      const botMsg: ChatMessage = {
        id: `msg_a_${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        timestamp: Date.now(),
      };

      const finalMessages = [...updatedWithUser, botMsg];
      setMessages(finalMessages);
      saveStoredConversation(activePersona.id, finalMessages);
      haptic.trigger('success');
    } catch (err) {
      console.error('Chat error:', err);
      // Fallback response so roleplay never gets stuck
      const fallbackMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `*${activePersona.name} pauses, listening closely to your words* "The static in the comms is heavy right now, but I hear you. Let us press forward."`,
        timestamp: Date.now(),
      };
      const finalFallback = [...updatedWithUser, fallbackMsg];
      setMessages(finalFallback);
      saveStoredConversation(activePersona.id, finalFallback);
      haptic.trigger('warning');
    } finally {
      setIsTyping(false);
    }
  };

  const handleResetChat = () => {
    haptic.trigger('warning');
    const fresh = clearStoredConversation(activePersona.id, activePersona.greeting);
    setMessages(fresh);
  };

  const handleCreatePersona = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    haptic.trigger('success');
    const created: RoleplayPersona = {
      id: `persona_custom_${Date.now()}`,
      name: newName.trim(),
      tagline: newTagline.trim() || 'Custom Roleplay Persona',
      avatar: newAvatar,
      category: newCategory,
      greeting: newGreeting.trim() || `*looks up as you approach* Hello there. How can I help you today?`,
      systemPrompt: newSystemPrompt.trim() || `You are ${newName.trim()}. Roleplay with the user in rich descriptive prose.`,
      scenario: newScenario.trim() || 'An open roleplay scenario.',
      suggestedVisualPrompt: `Cinematic portrait of ${newName.trim()}, ${newTagline.trim()}, ultra realistic, 8k resolution`,
      isCustom: true,
    };

    const nextCustom = [...customPersonas, created];
    setCustomPersonas(nextCustom);
    saveStoredCustomPersonas(nextCustom);
    setActivePersonaId(created.id);
    setShowCreateModal(false);

    // Reset inputs
    setNewName('');
    setNewTagline('');
    setNewGreeting('');
    setNewSystemPrompt('');
    setNewScenario('');
  };

  const handleDeleteCustomPersona = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.trigger('warning');
    const updated = customPersonas.filter((p) => p.id !== id);
    setCustomPersonas(updated);
    saveStoredCustomPersonas(updated);
    if (activePersonaId === id) {
      setActivePersonaId(DEFAULT_PERSONAS[0].id);
    }
  };

  // Helper to render roleplay text: format actions wrapped in *asterisks* with distinctive atmospheric styling
  const renderRoleplayFormattedText = (text: string) => {
    const parts = text.split(/(\*[^*]+\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <span
            key={index}
            className="text-cyan-300/90 italic font-medium tracking-wide"
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Quick action suggestions based on persona category
  const quickActions =
    activePersona.category === 'Cyberpunk'
      ? ['*slides the encrypted datapad across the counter*', '*looks around cautiously for megacorp drones*', 'What is the target for our next mission?']
      : activePersona.category === 'Sci-Fi'
      ? ['*runs diagnostic on warp drive coordinates*', '*gazes out at the stellar planetary rings*', 'What do the long-range sensors report?']
      : activePersona.category === 'Fantasy'
      ? ['*raises my hand and channels a protective ward*', '*inquires about the ancient prophecy*', 'Tell me about the mysteries of this sanctuary.']
      : ['*offers a warm smile and takes a seat*', 'Let us begin building our next creative chapter.', '*describes the scene around us*'];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 flex flex-col h-[calc(100dvh-7.5rem)] min-h-[520px]">
      {/* 1. Character Header Bar */}
      <div className="glass-panel rounded-2xl p-3 sm:p-3.5 mb-3 flex items-center justify-between gap-3 border border-slate-800/90 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-11 h-11 rounded-full overflow-hidden bg-slate-900 border-2 border-cyan-500/40 shrink-0 shadow-md">
            <img
              src={activePersona.avatar}
              alt={activePersona.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white truncate">{activePersona.name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 font-mono font-medium border border-cyan-500/20">
                {activePersona.category}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">{activePersona.tagline}</p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Visualize Scene in Studio */}
          <button
            type="button"
            onClick={() => {
              haptic.trigger('impactMedium');
              const promptToUse =
                activePersona.suggestedVisualPrompt ||
                `Cinematic scene with ${activePersona.name}, ${activePersona.scenario || 'cinematic lighting, ultra detailed'}`;
              onSendToStudio(promptToUse);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 active:scale-95 transition-all min-h-[36px]"
            title="Generate this character and scene in Image Studio"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Visualize</span>
          </button>

          {/* Switch Personas Drawer Trigger */}
          <button
            type="button"
            onClick={() => {
              haptic.trigger('selection');
              setShowPersonaDrawer(!showPersonaDrawer);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all min-h-[36px] ${
              showPersonaDrawer
                ? 'bg-slate-800 text-white border-slate-700'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Characters</span>
            {showPersonaDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Reset Conversation */}
          <button
            type="button"
            onClick={handleResetChat}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 min-h-[36px]"
            title="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Collapsible Persona Selection Drawer */}
      {showPersonaDrawer && (
        <div className="glass-panel rounded-2xl p-3.5 mb-3 border border-cyan-500/30 animate-fade-in shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Select Character Persona
            </span>
            <button
              type="button"
              onClick={() => {
                haptic.trigger('selection');
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 px-2 py-1 rounded-md border border-cyan-500/30"
            >
              <Plus className="w-3 h-3" />
              <span>Create New Character</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {allPersonas.map((persona) => {
              const isSelected = persona.id === activePersona.id;
              return (
                <div
                  key={persona.id}
                  onClick={() => {
                    haptic.trigger('selection');
                    setActivePersonaId(persona.id);
                    setShowPersonaDrawer(false);
                  }}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2.5 relative group ${
                    isSelected
                      ? 'bg-cyan-950/70 border-cyan-400 shadow-sm ring-1 ring-cyan-500/30'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-950 shrink-0 border border-slate-700">
                    <img
                      src={persona.avatar}
                      alt={persona.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate">{persona.name}</span>
                      {isSelected && <Check className="w-3 h-3 text-cyan-400 shrink-0" />}
                    </div>
                    <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                      {persona.category}
                    </span>
                  </div>

                  {persona.isCustom && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCustomPersona(persona.id, e)}
                      className="p-1 rounded bg-slate-800 text-slate-400 hover:text-rose-400 absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete character"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Persona Scenario Info Box */}
          {activePersona.scenario && (
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
              <span className="text-cyan-400 font-bold shrink-0">Current Scenario:</span>
              <span className="text-slate-300 italic">{activePersona.scenario}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Messages Chat Feed */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-2 rounded-xl">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full overflow-hidden shrink-0 border flex items-center justify-center ${
                  isUser
                    ? 'bg-cyan-600 border-cyan-400 text-white'
                    : 'bg-slate-900 border-cyan-500/40 text-slate-300'
                }`}
              >
                {isUser ? (
                  <User className="w-4 h-4" />
                ) : (
                  <img
                    src={activePersona.avatar}
                    alt={activePersona.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-md text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-tr-sm'
                    : 'bg-slate-900/90 text-slate-200 border border-slate-800/90 rounded-tl-sm'
                }`}
              >
                {!isUser && (
                  <div className="flex items-center justify-between text-[11px] font-bold text-cyan-400 mb-1 border-b border-slate-800/80 pb-1">
                    <span>{activePersona.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        haptic.trigger('selection');
                        // Extract scene context for generation
                        onSendToStudio(
                          `Cinematic representation: ${msg.content.replace(/\*/g, '')}, award winning photorealistic 8k commercial quality`
                        );
                      }}
                      className="text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 font-normal"
                      title="Render this scene in the Studio"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                      <span>Render Scene</span>
                    </button>
                  </div>
                )}
                <div className="whitespace-pre-wrap">
                  {renderRoleplayFormattedText(msg.content)}
                </div>
                <div
                  className={`text-[9px] mt-1.5 font-mono ${
                    isUser ? 'text-cyan-200/70 text-right' : 'text-slate-500 text-right'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-center gap-2.5 text-slate-400 text-xs pl-1">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-900 border border-cyan-500/40 shrink-0">
              <img
                src={activePersona.avatar}
                alt={activePersona.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-3.5 py-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse [animation-delay:0.4s]" />
              <span className="text-[11px] text-slate-400 ml-1.5 font-mono">
                {activePersona.name} is writing...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Quick Action Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-2 shrink-0 no-scrollbar">
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(action)}
            disabled={isTyping}
            className="px-2.5 py-1 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 text-[11px] whitespace-nowrap transition-all active:scale-95 shrink-0"
          >
            {action}
          </button>
        ))}
      </div>

      {/* 5. Message Input Bar */}
      <div className="glass-panel rounded-2xl p-2 border border-slate-800/90 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`Reply to ${activePersona.name}... (use *actions* for roleplay)`}
            rows={1}
            className="flex-1 bg-slate-900/90 text-slate-100 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm border border-slate-800 focus:border-cyan-400 focus:outline-none resize-none max-h-32 transition-all"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
              !inputText.trim() || isTyping
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 active:scale-95'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 6. Custom Persona Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Create Custom Roleplay Character</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePersona} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Character Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Victor Stone"
                    className="w-full bg-slate-950 text-slate-200 rounded-lg p-2.5 border border-slate-800 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Genre / Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full bg-slate-950 text-slate-200 rounded-lg p-2.5 border border-slate-800 focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="Cyberpunk">Cyberpunk</option>
                    <option value="Sci-Fi">Sci-Fi</option>
                    <option value="Fantasy">Fantasy</option>
                    <option value="Anime">Anime</option>
                    <option value="Creative">Creative / Story</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Tagline / Identity
                </label>
                <input
                  type="text"
                  value={newTagline}
                  onChange={(e) => setNewTagline(e.target.value)}
                  placeholder="e.g. Cybernetic investigator with a penchant for whiskey"
                  className="w-full bg-slate-950 text-slate-200 rounded-lg p-2.5 border border-slate-800 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  First Message / Greeting
                </label>
                <textarea
                  value={newGreeting}
                  onChange={(e) => setNewGreeting(e.target.value)}
                  placeholder="*adjusts my trench coat as neon rain drips from the brim* What brings you to my office?"
                  rows={2}
                  className="w-full bg-slate-950 text-slate-200 rounded-lg p-2.5 border border-slate-800 focus:border-cyan-400 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Scenario Setting
                </label>
                <input
                  type="text"
                  value={newScenario}
                  onChange={(e) => setNewScenario(e.target.value)}
                  placeholder="e.g. A smoky detective office in 2085 Old Chicago"
                  className="w-full bg-slate-950 text-slate-200 rounded-lg p-2.5 border border-slate-800 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Personality & Roleplay System Instructions
                </label>
                <textarea
                  value={newSystemPrompt}
                  onChange={(e) => setNewSystemPrompt(e.target.value)}
                  placeholder="Describe your character's manner of speech, knowledge, weaknesses, and temperament..."
                  rows={3}
                  className="w-full bg-slate-950 text-slate-200 rounded-lg p-2.5 border border-slate-800 focus:border-cyan-400 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold"
                >
                  Create & Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
