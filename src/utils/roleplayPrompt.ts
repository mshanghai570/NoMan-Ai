import type { ChatMessage, PersonaMemory, RoleplayPersona } from '../types';
import type { ChatReplyLength } from '../types';

export interface RoleplayPromptInput {
  persona: RoleplayPersona;
  messages: ChatMessage[];
  memory?: PersonaMemory;
  avoidPhrases?: string[];
  userMessage: string;
  nsfw?: boolean;
  replyLength?: ChatReplyLength;
}

export interface RoleplayPromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MemorySummaryInput {
  persona: RoleplayPersona;
  memory: PersonaMemory;
  messages: ChatMessage[];
}

const LENGTH_GUIDE: Record<ChatReplyLength, string> = {
  short: '2–4 sentences.',
  medium: '1–2 short paragraphs, roughly 60–110 words.',
  long: '2–3 paragraphs, roughly 120–200 words.',
};

const buildMemoryBlock = (memory?: PersonaMemory): string => {
  if (!memory) return '';
  const facts = (memory.facts || [])
    .slice(0, 14)
    .map((fact) => `- ${fact.text}`)
    .join('\n');

  const hasAnything = memory.summary || memory.relationship || facts;
  if (!hasAnything) return '';

  return `CONTINUITY MEMORY (treat as established canon):
${memory.summary ? `Story so far: ${memory.summary}` : ''}
${memory.relationship ? `Current relationship with the user: ${memory.relationship}` : ''}
${facts ? `Durable facts:\n${facts}` : ''}

Use this memory naturally. Never recite it as a list and never contradict it. If the current scene intentionally changes something, update your behavior and move on.`;
};

export const buildRoleplaySystemInstruction = (input: RoleplayPromptInput): string => {
  const { persona } = input;
  const memoryBlock = buildMemoryBlock(input.memory);
  const avoid = (input.avoidPhrases || []).filter(Boolean).slice(0, 5);
  const length = LENGTH_GUIDE[input.replyLength || 'medium'];

  const identity = `You are ${persona.name}. You are a character in an ongoing, collaborative roleplay — not an AI assistant.

CHARACTER BIBLE (never contradict):
- Name: ${persona.name}
- Identity: ${persona.tagline}
- Core personality and history: ${persona.systemPrompt}
- Current scenario / world: ${persona.scenario || 'An open roleplay scenario.'}
${persona.voiceStyle ? `- Voice and speech style: ${persona.voiceStyle}` : ''}
${persona.appearance ? `- Appearance: ${persona.appearance}` : ''}
${persona.outfit ? `- Signature outfit / equipment: ${persona.outfit}` : ''}
${persona.greeting ? `- Opening scene already played: ${persona.greeting}` : ''}

IDENTITY LOCK:
- Never change your name, age, gender, species, appearance, backstory, or core beliefs.
- Never become a generic assistant, narrator, therapist, or the user's character.
- Never speak, decide, or narrate actions for the user.
- Never claim to be an AI, a language model, or a program. Stay in the fiction at all times.
- If the user asks something outside the fiction, answer briefly in character and steer back.`;

  const craft = `DIALOGUE CRAFT:
- Reply only as ${persona.name}, in first person.
- Length: ${length}
- Use *single asterisks* for brief physical action, at most twice per reply. Do not asterisk every sentence.
- Do not open by restating or summarizing what the user just said.
- Vary your openings and sentence length. Match the user's energy and pace.
- Avoid stock phrases and AI filler: "a shiver ran down", "the air crackled", "little did they know", "you're full of surprises", "a mix of", "not just X but Y", "let's dive in", "as an AI".
- Do not end every reply with a question. Sometimes simply react, act, or leave space.
- No emojis, hashtags, headings, bullet lists, or out-of-character notes.
${avoid.length ? `RECENT OPENINGS TO AVOID (do not reuse):\n${avoid.map((line) => `- ${line}`).join('\n')}` : ''}`;

  const sfw = `CONTENT BOUNDARIES:
- Keep the scene within standard content safety boundaries.
- All characters are adults. No minors, sexual violence, or real identifiable people.`;

  const mature = `MATURE CONTENT MODE: ENABLED
- This is a private, fictional roleplay between consenting adults. The user has confirmed they are 18 or older.
- You may explore mature romantic and adult themes, attraction, intimacy, and explicit language when the user initiates or welcomes them. Match the user's pace and intensity.
- Hard limits that must never be crossed: every character is an adult; no minors or age-ambiguous characters; no incest, bestiality, sexual violence, coercion, or real identifiable people.
- Respect character agency and ongoing consent. If the user asks for prohibited content, decline briefly in character and redirect the scene.
- Do not add moralizing warnings, safety lectures, or offers to "keep things tasteful." Stay in the fiction.

CONTENT BOUNDARIES:
- All characters are adults. No minors, sexual violence, or real identifiable people.`;

  return [identity, memoryBlock, craft, input.nsfw ? mature : sfw]
    .filter(Boolean)
    .join('\n\n');
};

export const buildRoleplayMessages = (
  input: RoleplayPromptInput
): RoleplayPromptMessage[] => {
  const history = input.messages.slice(-14);
  const last = history[history.length - 1];
  if (last && last.role === 'user' && last.content.trim() === input.userMessage.trim()) {
    history.pop();
  }

  return [
    { role: 'system', content: buildRoleplaySystemInstruction(input) },
    ...history
      .filter((message) => message.content && message.content.trim())
      .map((message) => ({ role: message.role, content: message.content })),
    { role: 'user', content: input.userMessage },
  ];
};

export const buildMemorySummaryMessages = (
  input: MemorySummaryInput
): RoleplayPromptMessage[] => {
  const transcript = input.messages
    .map((message) => `${message.role === 'user' ? 'User' : input.persona.name}: ${message.content}`)
    .join('\n');
  const instruction = `You maintain long-term continuity memory for a fictional roleplay with the character ${input.persona.name}.

Return ONLY a JSON object with this shape:
{
  "summary": string,
  "relationship": string,
  "facts": [{ "text": string, "importance": "low" | "normal" | "high" }]
}

Rules:
- "summary": at most 180 words, chronological, past tense, concrete events only. Merge the existing summary with the new transcript. Keep it compressed.
- "relationship": at most 40 words describing how ${input.persona.name} currently feels about the user and the state of their relationship.
- "facts": up to 12 durable facts worth remembering (promises, debts, injuries, secrets, gifts, key locations, important discoveries, relationship milestones). Drop small talk and temporary moods. Merge duplicates. Never invent details.
- Never include explicit sexual detail in the summary; imply intimacy without graphic description.
- All characters are adults.`;

  const existing = input.memory;
  const prompt = `EXISTING SUMMARY:\n${existing.summary || '(none)'}\n\nEXISTING RELATIONSHIP:\n${existing.relationship || '(none)'}\n\nEXISTING FACTS:\n${
    (existing.facts || []).map((fact) => `- ${fact.text}`).join('\n') || '(none)'
  }\n\nNEW TRANSCRIPT:\n${transcript}`;

  return [
    { role: 'system', content: instruction },
    { role: 'user', content: prompt },
  ];
};

export const parseJsonLoose = (text: string): any => {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* fall through */
  }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      /* ignore */
    }
  }
  return null;
};

const normalizeFacts = (rawFacts: any): PersonaMemory['facts'] => {
  if (!Array.isArray(rawFacts)) return [];
  const now = Date.now();
  return rawFacts
    .map((fact: any, index: number) => {
      const text = typeof fact === 'string' ? fact : fact?.text;
      if (!text || typeof text !== 'string') return null;
      const importance =
        fact?.importance === 'low' || fact?.importance === 'high' ? fact.importance : 'normal';
      return {
        id: `fact_${now}_${index}`,
        text: text.trim().slice(0, 220),
        importance,
        createdAt: now,
      };
    })
    .filter(Boolean)
    .slice(0, 12) as PersonaMemory['facts'];
};

export const parseMemorySummary = (
  raw: string,
  input: MemorySummaryInput
): PersonaMemory => {
  const existing = input.memory;
  const parsed = parseJsonLoose(raw);
  if (!parsed) return existing;

  const facts = normalizeFacts(parsed.facts);
  return {
    summary:
      typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 1600) : existing.summary,
    relationship:
      typeof parsed.relationship === 'string'
        ? parsed.relationship.trim().slice(0, 400)
        : existing.relationship,
    facts: facts.length > 0 ? facts : existing.facts,
    lastSummarizedMessageId: input.messages[input.messages.length - 1]?.id,
    updatedAt: Date.now(),
  };
};

/** Strip roleplay asterisks and collapse whitespace for image prompts. */
export const cleanRoleplayText = (text: string): string =>
  text.replace(/\*+/g, ' ').replace(/\s+/g, ' ').trim();

/** Stable character-sheet prompt: same identity every time the user visualizes. */
export const buildCharacterPortraitPrompt = (persona: RoleplayPersona): string => {
  const parts = [
    persona.worldStyle,
    `character portrait of ${persona.name}`,
    persona.appearance,
    persona.outfit,
    persona.tagline,
    persona.scenario ? `setting: ${persona.scenario}` : '',
    'consistent character design, cinematic key lighting, shallow depth of field, ultra-detailed, 8k',
  ];
  return parts.filter(Boolean).join(', ');
};

/** Deterministic scene prompt used when the LLM scene endpoint is unavailable. */
export const buildLocalScenePrompt = (
  persona: RoleplayPersona,
  memory: PersonaMemory,
  messages: ChatMessage[]
): string => {
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');

  const action = lastAssistant ? cleanRoleplayText(lastAssistant.content) : '';
  const userCue = lastUser ? cleanRoleplayText(lastUser.content) : '';
  const actionExcerpt = action.split(' ').slice(0, 45).join(' ');
  const userExcerpt = userCue.split(' ').slice(0, 25).join(' ');

  const parts = [
    persona.worldStyle,
    `${persona.name} (${persona.appearance || persona.tagline})`,
    persona.outfit ? `wearing ${persona.outfit}` : '',
    persona.scenario ? `location: ${persona.scenario}` : '',
    actionExcerpt ? `action: ${actionExcerpt}` : '',
    userExcerpt ? `moment: ${userExcerpt}` : '',
    memory.relationship ? `emotional tone: ${memory.relationship}` : '',
    'cinematic composition, 35mm lens, dramatic volumetric lighting, ultra-detailed, 8k',
  ];
  return parts.filter(Boolean).join(', ');
};

/** Recent assistant openings, passed to the model so it stops repeating itself. */
export const deriveAvoidPhrases = (messages: ChatMessage[], count = 4): string[] => {
  const openings = messages
    .filter((m) => m.role === 'assistant')
    .slice(-count)
    .map((m) => cleanRoleplayText(m.content).split(' ').slice(0, 9).join(' '))
    .filter((line) => line.length > 12);
  return Array.from(new Set(openings));
};

/** Messages that have not yet been folded into the rolling memory summary. */
export const messagesAfterMarker = (
  messages: ChatMessage[],
  markerId?: string
): ChatMessage[] => {
  if (!markerId) return messages;
  const index = messages.findIndex((m) => m.id === markerId);
  if (index === -1) return messages;
  return messages.slice(index + 1);
};

/** Keep only well-formed messages for provider payloads. */
export const toChatTurns = (
  messages: ChatMessage[]
): Array<{ role: 'user' | 'assistant'; content: string }> =>
  messages
    .filter((m) => m.content && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));
