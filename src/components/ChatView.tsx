import React, { useEffect, useRef, useState } from 'react';
import type {
  ChatMessage,
  PersonaMemory,
  RoleplayEngineConfig,
  RoleplayPersona,
  UserSettings,
} from '../types';
import { DEFAULT_PERSONAS } from '../constants/personas';
import { CHAT_PROVIDER_PRESETS, REPLY_LENGTHS } from '../constants/chat';
import {
  getStoredConversationForPersona,
  saveStoredConversation,
  clearStoredConversation,
  getStoredCustomPersonas,
  saveStoredCustomPersonas,
  getStoredPersonaNsfwOverrides,
  saveStoredPersonaNsfwOverride,
  getStoredMemoryForPersona,
  saveStoredMemoryForPersona,
  clearStoredMemoryForPersona,
  EMPTY_MEMORY,
} from '../services/storage';
import {
  buildEngineConfig,
  requestScenePrompt,
  shouldSummarizeMemory,
  streamRoleplayReply,
  summarizeMemory,
} from '../services/chatEngine';
import { buildCharacterPortraitPrompt } from '../utils/roleplayPrompt';
import {
  Sparkles,
  Send,
  RotateCcw,
  Plus,
  Users,
  ChevronDown,
  ChevronUp,
  Check,
  Trash2,
  X,
  User,
  Flame,
  Brain,
  Square,
  Loader2,
  Image as ImageIcon,
  Cpu,
  AlertTriangle,
} from 'lucide-react';
import { haptic } from '../utils/haptics';
import { AgeGateModal } from './AgeGateModal';
import { PersonaMemoryModal } from './PersonaMemoryModal';

interface ChatViewProps {
  settings: UserSettings;
  onSendToStudio: (prompt: string, options?: { nsfw?: boolean }) => void;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onOpenChatSettings?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  settings,
  onSendToStudio,
  onUpdateSettings,
  onOpenChatSettings,
}) => {
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

  const [memory, setMemory] = useState<PersonaMemory>(() =>
    getStoredMemoryForPersona(activePersona.id)
  );

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [sceneLoadingId, setSceneLoadingId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  const [showPersonaDrawer, setShowPersonaDrawer] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);

  // Mature roleplay mode: per-character override, falling back to the global default.
  // The image/video Safe filter acts as a hard block on mature chat as well.
  const chatNsfwBlocked = settings.nsfwMode === 'safe';
  const [isNsfwChat, setIsNsfwChat] = useState<boolean>(() => {
    if (settings.nsfwMode === 'safe') return false;
    const override = getStoredPersonaNsfwOverrides()[activePersonaId];
    if (typeof override === 'boolean') return override;
    return settings.chatNsfwMode === 'nsfw' && settings.chatAgeVerified;
  });
  const [showAgeGate, setShowAgeGate] = useState(false);

  // New custom persona form
  const [newName, setNewName] = useState('');
  const [newTagline, setNewTagline] = useState('');
  const [newCategory, setNewCategory] = useState<RoleplayPersona['category']>('Custom');
  const [newGreeting, setNewGreeting] = useState('');
  const [newSystemPrompt, setNewSystemPrompt] = useState('');
  const [newScenario, setNewScenario] = useState('');
  const [newAppearance, setNewAppearance] = useState('');
  const [newOutfit, setNewOutfit] = useState('');
  const [newVoiceStyle, setNewVoiceStyle] = useState('');
  const [newWorldStyle, setNewWorldStyle] = useState('');
  const [newAvatar, setNewAvatar] = useState(
    '/src/assets/images/sample_cyber_portrait_1794392786213.jpg'
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activePersonaRef = useRef(activePersona.id);
  const memoryRef = useRef<PersonaMemory>(memory);
  const pendingMemoryRef = useRef<Promise<void> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sceneRequestRef = useRef(0);

  const engineConfig = buildEngineConfig(settings);
  const providerPreset =
    CHAT_PROVIDER_PRESETS[settings.chatProvider] || CHAT_PROVIDER_PRESETS.gemini;
  const replyLength =
    REPLY_LENGTHS.find((r) => r.id === engineConfig.replyLength) || REPLY_LENGTHS[1];

  // When active persona changes, load its conversation + memory
  useEffect(() => {
    const loaded = getStoredConversationForPersona(activePersona.id, activePersona.greeting);
    const storedMemory = getStoredMemoryForPersona(activePersona.id);
    setMessages(loaded);
    setMemory(storedMemory);
    memoryRef.current = storedMemory;
    setChatError(null);
  }, [activePersona.id]);

  // Keep the per-chat maturity flag in sync with the character and global defaults
  useEffect(() => {
    if (settings.nsfwMode === 'safe') {
      setIsNsfwChat(false);
      return;
    }
    const override = getStoredPersonaNsfwOverrides()[activePersona.id];
    setIsNsfwChat(
      typeof override === 'boolean'
        ? override
        : settings.chatNsfwMode === 'nsfw' && settings.chatAgeVerified
    );
  }, [activePersona.id, settings.nsfwMode, settings.chatNsfwMode, settings.chatAgeVerified]);

  useEffect(() => {
    activePersonaRef.current = activePersona.id;
  }, [activePersona.id]);

  // Abort any in-flight stream or scene request when the view unmounts
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      sceneRequestRef.current += 1;
    };
  }, []);

  // Scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const persistMemory = (personaId: string, next: PersonaMemory) => {
    memoryRef.current = next;
    setMemory(next);
    saveStoredMemoryForPersona(personaId, next);
  };

  /**
   * Summarize older turns in the background, then await it before the next send.
   * Only the recent window is ever sent to the provider; memory carries the rest.
   */
  const runMemoryUpdate = (
    personaId: string,
    persona: RoleplayPersona,
    allMessages: ChatMessage[],
    baseMemory: PersonaMemory,
    config: RoleplayEngineConfig
  ) => {
    if (!shouldSummarizeMemory(allMessages, baseMemory)) return;

    const task = (async () => {
      try {
        const next = await summarizeMemory({
          persona,
          messages: allMessages,
          memory: baseMemory,
          config,
        });
        if (!next) return;

        if (activePersonaRef.current === personaId) {
          persistMemory(personaId, next);
        } else {
          saveStoredMemoryForPersona(personaId, next);
        }
      } catch (err) {
        console.warn('Memory update failed:', err);
      }
    })();

    pendingMemoryRef.current = task;
    task.finally(() => {
      if (pendingMemoryRef.current === task) pendingMemoryRef.current = null;
    });
  };

  const handleToggleNsfwChat = () => {
    if (chatNsfwBlocked) return;
    haptic.trigger('selection');

    if (isNsfwChat) {
      saveStoredPersonaNsfwOverride(activePersona.id, false);
      setIsNsfwChat(false);
      return;
    }

    if (!settings.chatAgeVerified) {
      setShowAgeGate(true);
      return;
    }

    saveStoredPersonaNsfwOverride(activePersona.id, true);
    setIsNsfwChat(true);
    haptic.trigger('success');
  };

  const handleConfirmAgeGate = () => {
    onUpdateSettings({ chatAgeVerified: true });
    saveStoredPersonaNsfwOverride(activePersona.id, true);
    setIsNsfwChat(true);
    setShowAgeGate(false);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || isTyping) return;

    const persona = activePersona;
    const personaId = persona.id;
    const nsfw = isNsfwChat && !chatNsfwBlocked;
    const config = buildEngineConfig(settings);
    haptic.trigger('selection');

    // Make sure a previous background memory pass has landed before building context.
    if (pendingMemoryRef.current) {
      setIsTyping(true);
      try {
        await pendingMemoryRef.current;
      } catch {
        /* already handled */
      }
    }

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const updatedWithUser = [...messages, userMsg];
    setMessages(updatedWithUser);
    saveStoredConversation(personaId, updatedWithUser);
    setInputText('');
    setChatError(null);
    setFallbackNotice(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setIsTyping(true);

    const botId = `msg_a_${Date.now()}`;
    const placeholder: ChatMessage = {
      id: botId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isNsfw: nsfw,
    };

    setStreamingMessageId(botId);
    const withPlaceholder = [...updatedWithUser, placeholder];
    setMessages(withPlaceholder);
    saveStoredConversation(personaId, withPlaceholder);

    const controller = new AbortController();
    abortRef.current = controller;
    let streamed = '';

    const paint = (text: string) => {
      if (activePersonaRef.current !== personaId) return;
      setMessages((prev) =>
        prev.map((msg) => (msg.id === botId ? { ...msg, content: text } : msg))
      );
    };

    const commit = (finalMessages: ChatMessage[]) => {
      saveStoredConversation(personaId, finalMessages);
      if (activePersonaRef.current === personaId) setMessages(finalMessages);
    };

    try {
      const full = await streamRoleplayReply({
        persona,
        messages: updatedWithUser,
        memory: memoryRef.current,
        config,
        nsfw,
        signal: controller.signal,
        onDelta: (text) => {
          streamed += text;
          paint(streamed);
        },
        onFallback: ({ model }) => {
          setFallbackNotice(
            `Primary provider unavailable — switched to the local model (${model}).`
          );
        },
      });

      const botMsg: ChatMessage = { ...placeholder, content: full };
      const finalMessages = [...updatedWithUser, botMsg];
      commit(finalMessages);
      runMemoryUpdate(personaId, persona, finalMessages, memoryRef.current, config);
      haptic.trigger('success');
    } catch (err: any) {
      const aborted = controller.signal.aborted;

      if (aborted) {
        // Keep whatever streamed so the user does not lose a partial reply.
        const partial = streamed.trim();
        const finalMessages = partial
          ? [...updatedWithUser, { ...placeholder, content: partial }]
          : updatedWithUser;
        commit(finalMessages);
        haptic.trigger('warning');
      } else {
        console.error('Chat error:', err);
        // If part of the reply already streamed in, keep it instead of throwing
        // it away for a canned line on network-backed providers.
        const partial = streamed.trim();
        const finalMessages = partial
          ? [...updatedWithUser, { ...placeholder, content: partial }]
          : config.provider === 'webllm'
            ? updatedWithUser
            : [
                ...updatedWithUser,
                {
                  ...placeholder,
                  content: `*${persona.name} pauses, listening closely* "The link is unstable right now, but I hear you. Say that again?"`,
                },
              ];
        commit(finalMessages);
        const errorMessage =
          err?.message ||
          'The roleplay engine could not reply. Check the provider, model, and endpoint in Settings.';
        setChatError(
          config.provider === 'webllm'
            ? `${errorMessage} Check or load the selected model in Local Models, then try again.`
            : errorMessage
        );
        haptic.trigger('warning');
      }
    } finally {
      setStreamingMessageId(null);
      setIsTyping(false);
      abortRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    haptic.trigger('impactMedium');
    abortRef.current?.abort();
  };

  const handleResetChat = () => {
    haptic.trigger('warning');
    abortRef.current?.abort();
    sceneRequestRef.current += 1;
    setSceneLoadingId(null);
    const fresh = clearStoredConversation(activePersona.id, activePersona.greeting);
    clearStoredMemoryForPersona(activePersona.id);
    const empty = { ...EMPTY_MEMORY };
    memoryRef.current = empty;
    setMemory(empty);
    setMessages(fresh);
  };

  const handleSelectPersona = (personaId: string) => {
    haptic.trigger('selection');
    abortRef.current?.abort();
    sceneRequestRef.current += 1;
    setSceneLoadingId(null);
    setActivePersonaId(personaId);
    setShowPersonaDrawer(false);
  };

  const handleVisualizeCharacter = () => {
    haptic.trigger('impactMedium');
    const prompt = activePersona.suggestedVisualPrompt
      ? `${buildCharacterPortraitPrompt(activePersona)}, ${activePersona.suggestedVisualPrompt}`
      : buildCharacterPortraitPrompt(activePersona);
    onSendToStudio(prompt, { nsfw: isNsfwChat && !chatNsfwBlocked });
  };

  const handleRenderScene = async (msg: ChatMessage) => {
    if (sceneLoadingId) return;
    haptic.trigger('selection');

    const persona = activePersona;
    const personaId = persona.id;
    const nsfw = isNsfwChat && !chatNsfwBlocked;

    // Reuse the cached prompt for this beat when we already have one.
    if (msg.scenePrompt) {
      onSendToStudio(msg.scenePrompt, { nsfw });
      return;
    }

    const index = messages.findIndex((m) => m.id === msg.id);
    const contextMessages = index >= 0 ? messages.slice(0, index + 1) : messages;
    const requestId = (sceneRequestRef.current += 1);
    setSceneLoadingId(msg.id);

    try {
      const result = await requestScenePrompt({
        persona,
        messages: contextMessages,
        memory: memoryRef.current,
        config: buildEngineConfig(settings),
        nsfw,
      });

      // The user may have switched characters or reset the chat while the
      // prompt was building. Drop the late result instead of pushing it.
      if (sceneRequestRef.current !== requestId) return;
      if (activePersonaRef.current !== personaId) return;

      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === msg.id ? { ...m, scenePrompt: result.imagePrompt } : m
        );
        saveStoredConversation(personaId, next);
        return next;
      });

      onSendToStudio(result.imagePrompt, { nsfw });
      haptic.trigger('success');
    } catch (err) {
      console.error('Scene prompt error:', err);
      haptic.trigger('warning');
    } finally {
      if (sceneRequestRef.current === requestId) setSceneLoadingId(null);
    }
  };

  const handleDeleteFact = (factId: string) => {
    const next: PersonaMemory = {
      ...memory,
      facts: memory.facts.filter((fact) => fact.id !== factId),
      updatedAt: Date.now(),
    };
    persistMemory(activePersona.id, next);
  };

  const handleClearMemory = () => {
    clearStoredMemoryForPersona(activePersona.id);
    const empty = { ...EMPTY_MEMORY };
    memoryRef.current = empty;
    setMemory(empty);
    setShowMemoryModal(false);
  };

  const handleCreatePersona = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    haptic.trigger('success');
    const appearance = newAppearance.trim();
    const outfit = newOutfit.trim();
    const worldStyle = newWorldStyle.trim();
    const created: RoleplayPersona = {
      id: `persona_custom_${Date.now()}`,
      name: newName.trim(),
      tagline: newTagline.trim() || 'Custom Roleplay Persona',
      avatar: newAvatar,
      category: newCategory,
      greeting:
        newGreeting.trim() || `*looks up as you approach* Hello there. How can I help you today?`,
      systemPrompt:
        newSystemPrompt.trim() ||
        `You are ${newName.trim()}. Roleplay with the user in rich descriptive prose.`,
      scenario: newScenario.trim() || 'An open roleplay scenario.',
      appearance: appearance || undefined,
      outfit: outfit || undefined,
      voiceStyle: newVoiceStyle.trim() || undefined,
      worldStyle: worldStyle || undefined,
      suggestedVisualPrompt: `Cinematic portrait of ${newName.trim()}, ${
        appearance || newTagline.trim()
      }, ${worldStyle || 'cinematic lighting'}, ultra realistic, 8k resolution`,
      isCustom: true,
    };

    const nextCustom = [...customPersonas, created];
    setCustomPersonas(nextCustom);
    saveStoredCustomPersonas(nextCustom);
    setActivePersonaId(created.id);
    setShowCreateModal(false);

    setNewName('');
    setNewTagline('');
    setNewGreeting('');
    setNewSystemPrompt('');
    setNewScenario('');
    setNewAppearance('');
    setNewOutfit('');
    setNewVoiceStyle('');
    setNewWorldStyle('');
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

  // Format actions wrapped in *asterisks* with distinctive atmospheric styling
  const renderRoleplayFormattedText = (text: string) => {
    const parts = text.split(/(\*[^*]+\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <span key={index} className="text-cyan-300/90 italic font-medium tracking-wide">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const quickActions =
    activePersona.category === 'Cyberpunk'
      ? [
          '*slides the encrypted datapad across the counter*',
          '*looks around cautiously for megacorp drones*',
          'What is the target for our next mission?',
        ]
      : activePersona.category === 'Sci-Fi'
      ? [
          '*runs diagnostic on warp drive coordinates*',
          '*gazes out at the stellar planetary rings*',
          'What do the long-range sensors report?',
        ]
      : activePersona.category === 'Fantasy'
      ? [
          '*raises my hand and channels a protective ward*',
          '*inquires about the ancient prophecy*',
          'Tell me about the mysteries of this sanctuary.',
        ]
      : [
          '*offers a warm smile and takes a seat*',
          'Let us begin building our next creative chapter.',
          '*describes the scene around us*',
        ];

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
              {isNsfwChat && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-950 text-rose-300 font-bold border border-rose-500/40 flex items-center gap-0.5"
                  title="Mature roleplay mode is active"
                >
                  <Flame className="w-2.5 h-2.5" />
                  18+
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">{activePersona.tagline}</p>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={onOpenChatSettings}
                className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-cyan-300 transition-colors"
                title="Configure roleplay provider and model"
              >
                <Cpu className="w-2.5 h-2.5" />
                {providerPreset.shortLabel} · {engineConfig.model}
              </button>
              <span className="text-slate-700">|</span>
              <button
                type="button"
                onClick={() => {
                  haptic.trigger('selection');
                  setShowMemoryModal(true);
                }}
                className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-cyan-300 transition-colors"
                title="Inspect long-term memory"
              >
                <Brain className="w-2.5 h-2.5" />
                {memory.facts.length > 0
                  ? `${memory.facts.length} mem${memory.facts.length === 1 ? 'ory' : 'ories'}`
                  : memory.summary || memory.relationship
                  ? 'Memory active'
                  : 'No memory yet'}
              </button>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleNsfwChat}
            disabled={chatNsfwBlocked}
            aria-pressed={isNsfwChat}
            title={
              chatNsfwBlocked
                ? 'Mature chat is disabled while Content Filter is set to Safe Mode in Settings'
                : isNsfwChat
                ? 'Turn off mature mode for this chat'
                : 'Unlock mature (18+) mode for this chat'
            }
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all min-h-[36px] ${
              isNsfwChat
                ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-500/50 shadow-sm shadow-rose-900/40'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800'
            } ${chatNsfwBlocked ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
          >
            <Flame
              className={`w-3.5 h-3.5 ${
                isNsfwChat ? 'text-rose-400' : chatNsfwBlocked ? 'text-slate-500' : 'text-slate-400'
              }`}
            />
            <span className="hidden sm:inline">{isNsfwChat ? 'NSFW On' : 'NSFW'}</span>
          </button>

          <button
            type="button"
            onClick={handleVisualizeCharacter}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 active:scale-95 transition-all min-h-[36px]"
            title="Generate a consistent portrait of this character in Image Studio"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Visualize</span>
          </button>

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
            {showPersonaDrawer ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          <button
            type="button"
            onClick={handleResetChat}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 min-h-[36px]"
            title="Reset conversation and memory"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mature mode notice */}
      {isNsfwChat && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2 shrink-0">
          <Flame className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-rose-200/90 leading-snug">
            <strong className="text-rose-300">Mature mode active.</strong> Fictional adults only.
            The AI may still decline extreme content. Tap the flame to switch back to SFW.
          </p>
        </div>
      )}

      {/* Stream / provider error */}
      {chatError && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-950/25 px-3 py-2 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
          <p className="flex-1 text-[11px] text-amber-200 leading-snug">{chatError}</p>
          {onOpenChatSettings && (
            <button
              type="button"
              onClick={onOpenChatSettings}
              className="text-[10px] font-bold text-amber-300 underline shrink-0"
            >
              Open settings
            </button>
          )}
          <button
            type="button"
            onClick={() => setChatError(null)}
            className="text-amber-400/70 hover:text-amber-200 shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Collapsible Persona Selection Drawer */}
      {showPersonaDrawer && (
        <div className="glass-panel rounded-2xl p-3.5 mb-3 border border-cyan-500/30 animate-fade-in shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Select Character Persona
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  haptic.trigger('selection');
                  setShowMemoryModal(true);
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-900 px-2 py-1 rounded-md border border-slate-700"
              >
                <Brain className="w-3 h-3 text-cyan-400" />
                <span>Memory</span>
              </button>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {allPersonas.map((persona) => {
              const isSelected = persona.id === activePersona.id;
              return (
                <div
                  key={persona.id}
                  onClick={() => handleSelectPersona(persona.id)}
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

          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px]">
            <span className="text-slate-400">
              Engine:{' '}
              <strong className="text-slate-200">{providerPreset.shortLabel}</strong>
              <span className="text-slate-600"> · </span>
              <span className="font-mono text-slate-300">{engineConfig.model}</span>
              <span className="text-slate-600"> · </span>
              {replyLength.label} replies
            </span>
            {onOpenChatSettings && (
              <button
                type="button"
                onClick={onOpenChatSettings}
                className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300"
              >
                Change engine
              </button>
            )}
          </div>

          {activePersona.scenario && (
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
              <span className="text-cyan-400 font-bold shrink-0">Current Scenario:</span>
              <span className="text-slate-300 italic">{activePersona.scenario}</span>
            </div>
          )}

          {memory.summary && (
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
              <Brain className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
              <span className="text-slate-300 line-clamp-2">{memory.summary}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Messages Chat Feed */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-2 rounded-xl">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isStreaming = msg.id === streamingMessageId;
          const isLoadingScene = sceneLoadingId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
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

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-md text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-tr-sm'
                    : 'bg-slate-900/90 text-slate-200 border border-slate-800/90 rounded-tl-sm'
                }`}
              >
                {!isUser && (
                  <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-cyan-400 mb-1 border-b border-slate-800/80 pb-1">
                    <span>{activePersona.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRenderScene(msg)}
                      disabled={isLoadingScene || isStreaming || !msg.content}
                      className="text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 font-normal disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Build a character-consistent image prompt for this scene"
                    >
                      {isLoadingScene ? (
                        <Loader2 className="w-2.5 h-2.5 text-cyan-400 animate-spin" />
                      ) : (
                        <ImageIcon className="w-2.5 h-2.5 text-cyan-400" />
                      )}
                      <span>
                        {isLoadingScene
                          ? 'Building prompt…'
                          : msg.scenePrompt
                          ? 'Render Again'
                          : 'Render Scene'}
                      </span>
                    </button>
                  </div>
                )}

                <div className="whitespace-pre-wrap">
                  {msg.content ? (
                    renderRoleplayFormattedText(msg.content)
                  ) : isStreaming ? (
                    <span className="inline-flex items-center gap-1 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse [animation-delay:0.4s]" />
                    </span>
                  ) : null}
                  {isStreaming && msg.content && (
                    <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-cyan-400 animate-pulse" />
                  )}
                </div>

                <div
                  className={`text-[9px] mt-1.5 font-mono ${
                    isUser ? 'text-cyan-200/70 text-right' : 'text-slate-500 text-right'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && !streamingMessageId && (
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
                {activePersona.name} is gathering the thread…
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
            className="px-2.5 py-1 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 text-[11px] whitespace-nowrap transition-all active:scale-95 shrink-0 disabled:opacity-50"
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

          {isTyping ? (
            <button
              type="button"
              onClick={handleStopStreaming}
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-rose-950 border border-rose-500/50 text-rose-300 active:scale-95 transition-all"
              title="Stop generating"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputText.trim()}
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                !inputText.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 active:scale-95'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      <AgeGateModal
        isOpen={showAgeGate}
        onClose={() => setShowAgeGate(false)}
        onConfirm={handleConfirmAgeGate}
        personaName={activePersona.name}
      />

      <PersonaMemoryModal
        isOpen={showMemoryModal}
        personaName={activePersona.name}
        memory={memory}
        onClose={() => setShowMemoryModal(false)}
        onClear={handleClearMemory}
        onDeleteFact={handleDeleteFact}
      />

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Appearance (for consistent images)
                  </label>
                  <textarea
                    value={newAppearance}
                    onChange={(e) => setNewAppearance(e.target.value)}
                    placeholder="e.g. tall, olive skin, scar over left brow, close-cropped black hair"
                    rows={2}
                    className="w-full bg-slate-950 text-slate-200 rounded-lg p-2.5 border border-slate-800 focus:border-cyan-400 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Signature Outfit
                  </label>
                  <textarea
                    value={newOutfit}
                    onChange={(e) => setNewOutfit(e.target.value)}
                    placeholder="e.g. grey trench coat, red tie, worn leather satchel"
                    rows={2}
                    className="w-full bg-slate-950 text-slate-200 rounded-lg p-2.5 border border-slate-800 focus:border-cyan-400 focus:outline-none resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Voice & Speech Style
                  </label>
                  <input
                    type="text"
                    value={newVoiceStyle}
                    onChange={(e) => setNewVoiceStyle(e.target.value)}
                    placeholder="e.g. dry, clipped, uses 1940s slang"
                    className="w-full bg-slate-950 text-slate-200 rounded-lg p-2.5 border border-slate-800 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Visual World Style
                  </label>
                  <input
                    type="text"
                    value={newWorldStyle}
                    onChange={(e) => setNewWorldStyle(e.target.value)}
                    placeholder="e.g. neo-noir rain, neon signage, cinematic"
                    className="w-full bg-slate-950 text-slate-200 rounded-lg p-2.5 border border-slate-800 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
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
