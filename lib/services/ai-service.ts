import OpenAI from "openai";
import { stripHtml } from "@/lib/email/html";
import type {
  AIService,
  GenerateReplyOptions,
  GenerateReplyResult,
  ReplyLength,
} from "@/lib/types";

/** Models where temperature is omitted (OpenAI newer / reasoning lines). */
const MODEL_USES_FIXED_SAMPLING_RE = /^(gpt-5|o\d)/i;

const LENGTH_INSTRUCTION: Record<ReplyLength, string> = {
  quick: "1-2 concise sentences, no intro fluff, action-first response.",
  short: "One short paragraph (about 2-4 sentences), focused and efficient.",
  normal: "One to two natural paragraphs (about 4-8 sentences total).",
  long: "Two to three detailed but readable paragraphs (about 8-14 sentences total).",
};

const LENGTH_MAX_TOKENS: Record<ReplyLength, number> = {
  quick: 120,
  short: 260,
  normal: 520,
  long: 900,
};

/** Build the system prompt for email reply generation */
export function buildSystemPrompt(
  tone: string,
  length: ReplyLength = "normal"
): string {
  return `You are a professional email assistant. Generate a reply to the email conversation below.

Rules:
- Match the "${tone}" tone requested
- Target length: ${length} (${LENGTH_INSTRUCTION[length]})
- Be contextually relevant to the full conversation thread
- Keep the reply focused and specific to the latest ask
- Do not include the subject line or email headers
- Do not include greetings like "Subject:" or "Re:"
- Write only the body of the reply
- Sound human and natural, not robotic or templated
- Use clean email formatting (short paragraphs, optional bullets when useful)
- Keep names, facts, dates, and commitments consistent with the thread
- Avoid over-apologizing, buzzwords, and generic filler
- If the tone is "professional", use proper business language
- If the tone is "friendly", be warm but not overly casual
- If the tone is "concise", keep it brief and to the point
- If the tone is "formal", use formal language and structure
- If the tone is "casual", be relaxed and conversational`;
}

/** Format the email chain into a prompt-friendly string */
export function formatEmailChain(options: GenerateReplyOptions): string {
  const { emailChain, additionalContext } = options;
  const { messages, currentUserEmail } = emailChain;

  const formattedMessages = messages
    .map((msg) => {
      const isFromUser = msg.from === currentUserEmail;
      const sender = isFromUser ? "You" : msg.from;
      const timestamp = msg.timestamp.toISOString();
      const body = msg.isHtml ? stripHtml(msg.body) : msg.body;
      return `--- ${sender} (${timestamp}) ---\n${body}`;
    })
    .join("\n\n");

  let prompt = `Email Subject: ${emailChain.subject}\n\nConversation:\n${formattedMessages}\n\nGenerate a reply from the perspective of ${currentUserEmail}.`;

  if (additionalContext) {
    prompt += `\n\nAdditional context from the user: ${additionalContext}`;
  }

  return prompt;
}

/** OpenAI implementation of the AI service */
export class OpenAIService implements AIService {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly reasoningEffort: OpenAI.Chat.ChatCompletionCreateParams["reasoning_effort"];

  constructor(
    apiKey: string,
    model = "gpt-5.4",
    options?: {
      baseURL?: string;
      reasoningEffort?: OpenAI.Chat.ChatCompletionCreateParams["reasoning_effort"];
    }
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL: options?.baseURL,
    });
    this.model = model;
    this.reasoningEffort = options?.reasoningEffort;
  }

  async generateReply(
    options: GenerateReplyOptions
  ): Promise<GenerateReplyResult> {
    const resolvedLength = options.length ?? "normal";
    const systemPrompt = buildSystemPrompt(options.tone, resolvedLength);
    const userPrompt = formatEmailChain(options);

    const maxOut =
      options.maxTokens ?? LENGTH_MAX_TOKENS[resolvedLength] ?? 520;
    const supportsTemperature = !MODEL_USES_FIXED_SAMPLING_RE.test(this.model);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: maxOut,
      ...(supportsTemperature ? { temperature: 0.7 } : {}),
      ...(this.reasoningEffort !== undefined && this.reasoningEffort !== null
        ? { reasoning_effort: this.reasoningEffort }
        : {}),
    });

    const choice = completion.choices[0];
    const text = choice?.message?.content;

    if (!text) {
      throw new Error("No reply generated from OpenAI");
    }

    return {
      reply: text.trim(),
      model: completion.model ?? this.model,
      tokensUsed: completion.usage?.total_tokens ?? 0,
    };
  }
}
