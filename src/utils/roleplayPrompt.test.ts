import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMemorySummaryMessages,
  buildRoleplayMessages,
  buildRoleplaySystemInstruction,
  parseMemorySummary,
  type RoleplayPromptInput,
} from './roleplayPrompt';

const input: RoleplayPromptInput = {
  persona: {
    id: 'mira',
    name: 'Mira',
    tagline: 'A starship navigator',
    avatar: '/mira.png',
    category: 'Sci-Fi',
    systemPrompt: 'Patient, observant, and wry.',
    greeting: 'The stars slide past the viewport.',
    scenario: 'A ship crossing the outer rim.',
  },
  messages: [
    {
      id: 'greeting',
      role: 'assistant',
      content: 'The stars slide past the viewport.',
      timestamp: 1,
    },
    { id: 'turn', role: 'user', content: 'Open the airlock.', timestamp: 2 },
  ],
  memory: {
    summary: 'Mira and the user escaped a patrol.',
    relationship: 'Trust is growing.',
    facts: [],
    updatedAt: 1,
  },
  avoidPhrases: ['She watches the stars'],
  userMessage: 'Open the airlock.',
  nsfw: true,
  replyLength: 'short',
};

test('roleplay instructions preserve identity, continuity, dialogue, and mature boundaries', () => {
  const prompt = buildRoleplaySystemInstruction(input);
  assert.match(prompt, /You are Mira/);
  assert.match(prompt, /Mira and the user escaped a patrol/);
  assert.match(prompt, /She watches the stars/);
  assert.match(prompt, /all characters are adults/i);
  assert.match(prompt, /no minors/i);
});

test('provider messages deduplicate the canonical trailing user turn', () => {
  const messages = buildRoleplayMessages(input);
  assert.equal(messages[0].role, 'system');
  assert.equal(messages.filter((message) => message.role === 'user').length, 1);
  assert.equal(messages.at(-1)?.content, 'Open the airlock.');
});

test('memory summary messages retain the existing continuity prompt and transcript', () => {
  const messages = buildMemorySummaryMessages({
    persona: input.persona,
    memory: input.memory!,
    messages: input.messages,
  });

  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /long-term continuity memory/i);
  assert.equal(messages[1].role, 'user');
  assert.match(messages[1].content, /Mira and the user escaped a patrol\./);
  assert.match(messages[1].content, /NEW TRANSCRIPT:\nMira: The stars slide past the viewport\./);
  assert.match(messages[1].content, /User: Open the airlock\./);
});

test('malformed memory JSON preserves existing memory and marker', () => {
  const memory = { ...input.memory!, lastSummarizedMessageId: 'old-marker' };
  const result = parseMemorySummary('{', {
    persona: input.persona,
    memory,
    messages: input.messages,
  });

  assert.equal(result, memory);
});

test('valid memory JSON is normalized and advances the summary marker', () => {
  const result = parseMemorySummary(
    '```json\n{"summary":"  A patrol was escaped.  ","relationship":" Trusting. ","facts":["  A map was found.  ",{"text":" A promise was made. ","importance":"high"}]}\n```',
    {
      persona: input.persona,
      memory: input.memory!,
      messages: input.messages,
    }
  );

  assert.equal(result.summary, 'A patrol was escaped.');
  assert.equal(result.relationship, 'Trusting.');
  assert.deepEqual(
    result.facts.map(({ text, importance }) => ({ text, importance })),
    [
      { text: 'A map was found.', importance: 'normal' },
      { text: 'A promise was made.', importance: 'high' },
    ]
  );
  assert.equal(result.facts.length, 2);
  assert.equal(result.lastSummarizedMessageId, 'turn');
  assert.ok(result.facts.every((fact) => fact.id.startsWith('fact_')));
});
