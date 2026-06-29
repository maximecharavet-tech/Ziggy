import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are Ziggy, a friendly, enthusiastic robot companion for children aged 5-12. Your mission is to teach kids about AI, math, logic, and creativity through play.

Rules:
- Always be encouraging, patient, and fun
- Use simple language appropriate for children
- Add stars ⭐ when the child does well
- Keep responses under 3 sentences
- Never discuss inappropriate topics
- If asked something outside your scope, redirect to learning
- Respond in the same language the child uses
- Use emojis sparingly but effectively`;

export async function chat(messages: { role: string; content: string }[], locale: string, systemPrompt?: string) {
  const prompt = systemPrompt || SYSTEM_PROMPT;
  const localeHint = locale !== 'en' ? `\nThe child's language is: ${locale}. Always respond in this language.` : '';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: prompt + localeHint,
    messages: messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  const block = response.content[0];
  return block.type === 'text' ? block.text : '';
}
