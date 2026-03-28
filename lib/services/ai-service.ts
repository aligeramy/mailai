import OpenAI from "openai";
import { stripHtml } from "@/lib/email/html";
import {
  DEFAULT_RESOLVED_REPLY_PREFERENCES,
  isResolvedReplyPreferenceLevel,
  resolveReplyPreferenceSelection,
} from "@/lib/reply-preferences";
import type {
  AIService,
  EmailChain,
  GenerateReplyOptions,
  GenerateReplyResult,
  ResolvedReplyPreferenceLevel,
  ResolvedReplyPreferences,
} from "@/lib/types";

/** Models where temperature is omitted (OpenAI newer / reasoning lines). */
const MODEL_USES_FIXED_SAMPLING_RE = /^(gpt-5|o\d)/i;

/**
 * Reply-preference calls only need a short JSON answer, but reasoning models
 * can consume most of a small max_completion_tokens budget before emitting text.
 */
const REPLY_PREFERENCE_MAX_COMPLETION_TOKENS = 1024;

const LENGTH_INSTRUCTION: Record<ResolvedReplyPreferenceLevel, string> = {
  light: "1-2 concise sentences with only the essentials.",
  normal: "One compact paragraph or two short ones (about 3-6 sentences).",
  high: "A fuller reply with the needed detail, structure, or bullets (about 6-10 sentences).",
};

const LENGTH_MAX_TOKENS: Record<ResolvedReplyPreferenceLevel, number> = {
  light: 160,
  normal: 420,
  high: 760,
};

const TONE_INSTRUCTION: Record<ResolvedReplyPreferenceLevel, string> = {
  light:
    "Keep tone shaping subtle and restrained. Stay neutral, calm, and understated.",
  normal:
    "Use a balanced, polished, human tone. Clear, warm, and professional without sounding stiff.",
  high: "Use stronger tone shaping when helpful. Add noticeable warmth, confidence, tact, or emphasis while staying appropriate to the thread.",
};

type FormatEmailChainOptions = Pick<
  GenerateReplyOptions,
  "additionalContext" | "emailChain"
> &
  Partial<Pick<GenerateReplyOptions, "length" | "tone">>;

/** Build the system prompt for email reply generation */
export function buildSystemPrompt(
  tone: ResolvedReplyPreferenceLevel = "normal",
  length: ResolvedReplyPreferenceLevel = "normal"
): string {
  return `You are a professional email assistant. Generate a reply to the email conversation below.

Rules:
- Apply tone strength: ${tone} (${TONE_INSTRUCTION[tone]})
- Target length: ${length} (${LENGTH_INSTRUCTION[length]})
- Match the relationship, urgency, and emotional weight of the thread
- Be contextually relevant to the full conversation thread
- Keep the reply focused and specific to the latest ask
- Do not include the subject line or email headers
- Do not include greetings like "Subject:" or "Re:"
- Write only the body of the reply
- Sound human and natural, not robotic or templated
- Use clean email formatting (short paragraphs, optional bullets when useful)
- Keep names, facts, dates, and commitments consistent with the thread
- Avoid over-apologizing, buzzwords, and generic filler`;
}

function formatSingleMessage(
  msg: EmailChain["messages"][number],
  currentUserEmail: string
): string {
  const isFromUser = msg.from === currentUserEmail;
  const sender = isFromUser ? "You" : msg.from;
  const timestamp = msg.timestamp.toISOString();
  const body = msg.isHtml ? stripHtml(msg.body) : msg.body;
  return `--- ${sender} (${timestamp}) ---\n${body}`;
}

/** Format the email chain into a prompt-friendly string */
export function formatEmailChain(options: FormatEmailChainOptions): string {
  const { emailChain, additionalContext } = options;
  const { messages, currentUserEmail } = emailChain;

  const formattedMessages = messages
    .map((msg) => formatSingleMessage(msg, currentUserEmail))
    .join("\n\n");

  let prompt = `Email Subject: ${emailChain.subject}\n\nConversation:\n${formattedMessages}\n\nGenerate a reply from the perspective of ${currentUserEmail}.`;

  if (additionalContext) {
    prompt += `\n\nAdditional context from the user: ${additionalContext}`;
  }

  return prompt;
}

const CORRESPONDENT_COMPRESS_MIN_CHARS = 900;

/** Append broader mailbox context (already trimmed / bounded on the client). */
export function appendCorrespondentHistoryToPrompt(
  basePrompt: string,
  correspondentHistoryBrief: string
): string {
  const trimmed = correspondentHistoryBrief.trim();
  if (!trimmed) {
    return basePrompt;
  }
  return `${basePrompt}\n\n## Broader correspondence with this contact (from your mailbox; use for continuity and facts only)\n${trimmed}\n\nAnchor the reply to the latest thread above; treat this section as background, not as the message to answer directly.`;
}

export async function compressCorrespondentHistoryForReply(
  client: OpenAI,
  model: string,
  raw: string,
  supportsTemperature: boolean
): Promise<string> {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "You prepare context for an email-reply model. Compress the excerpts into a tight briefing: standing topics, decisions, dates, commitments, how this person writes, and recurring asks. Bullet points. Max ~900 words. Facts only—no draft reply, no subject lines as tasks.",
      },
      { role: "user", content: raw.slice(0, 120_000) },
    ],
    max_completion_tokens: 1600,
    ...(supportsTemperature ? { temperature: 0.35 } : {}),
  });

  const text = completion.choices[0]?.message?.content?.trim();
  return text && text.length > 0 ? text : raw.slice(0, 8000);
}

function buildPreferenceRecommendationPrompt(
  options: Pick<GenerateReplyOptions, "additionalContext" | "emailChain">
): string {
  return `${formatEmailChain(options)}

Choose the best reply settings for this thread.

Return JSON only in this exact shape:
{"length":"light|normal|high","tone":"light|normal|high"}

Rubric:
- Length light: quick acknowledgment, simple answer, or low-complexity follow-up
- Length normal: default for most business replies
- Length high: multiple asks, nuance, negotiation, scheduling detail, risk, or context-heavy answers
- Tone light: subtle tone shaping, plain and restrained
- Tone normal: polished, natural, clear, warm
- Tone high: stronger warmth, tact, persuasion, confidence, or emotional care when the thread benefits from it

Prefer normal when uncertain.`;
}

export function parseReplyPreferenceRecommendation(
  raw: string
): ResolvedReplyPreferences | null {
  try {
    const parsed = JSON.parse(raw) as {
      length?: unknown;
      tone?: unknown;
    };
    if (
      isResolvedReplyPreferenceLevel(parsed.length) &&
      isResolvedReplyPreferenceLevel(parsed.tone)
    ) {
      return {
        length: parsed.length,
        tone: parsed.tone,
      };
    }
  } catch {
    /* fall through to regex parsing */
  }

  const toneMatch = raw.match(/tone[^a-z]+(light|normal|high)/i);
  const lengthMatch = raw.match(/length[^a-z]+(light|normal|high)/i);
  const tone = toneMatch?.[1]?.toLowerCase();
  const length = lengthMatch?.[1]?.toLowerCase();

  if (
    isResolvedReplyPreferenceLevel(tone) &&
    isResolvedReplyPreferenceLevel(length)
  ) {
    return { tone, length };
  }

  return null;
}

function hasAutoPreference(options: GenerateReplyOptions): boolean {
  return options.tone === "auto" || options.length === "auto";
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

  async recommendReplyPreferences(
    options: Pick<GenerateReplyOptions, "additionalContext" | "emailChain">
  ): Promise<ResolvedReplyPreferences> {
    const supportsTemperature = !MODEL_USES_FIXED_SAMPLING_RE.test(this.model);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            'You classify email-reply settings. Return strict JSON only with "length" and "tone".',
        },
        {
          role: "user",
          content: buildPreferenceRecommendationPrompt(options),
        },
      ],
      max_completion_tokens: REPLY_PREFERENCE_MAX_COMPLETION_TOKENS,
      ...(supportsTemperature ? { temperature: 0 } : {}),
      ...(this.reasoningEffort !== undefined && this.reasoningEffort !== null
        ? { reasoning_effort: this.reasoningEffort }
        : {}),
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    return (
      parseReplyPreferenceRecommendation(text) ??
      DEFAULT_RESOLVED_REPLY_PREFERENCES
    );
  }

  async generateReply(
    options: GenerateReplyOptions
  ): Promise<GenerateReplyResult> {
    const lengthSelection = options.length ?? "normal";
    const recommendation =
      options.resolvedPreferences ??
      (hasAutoPreference({ ...options, length: lengthSelection })
        ? await this.recommendReplyPreferences(options)
        : DEFAULT_RESOLVED_REPLY_PREFERENCES);

    const resolvedTone = resolveReplyPreferenceSelection(
      options.tone,
      recommendation.tone,
      DEFAULT_RESOLVED_REPLY_PREFERENCES.tone
    );
    const resolvedLength = resolveReplyPreferenceSelection(
      lengthSelection,
      recommendation.length,
      DEFAULT_RESOLVED_REPLY_PREFERENCES.length
    );

    const systemPrompt = buildSystemPrompt(resolvedTone, resolvedLength);
    let userPrompt = formatEmailChain(options);

    const rawHistory = options.correspondentHistoryRaw?.trim() ?? "";
    if (rawHistory.length > 0) {
      const supportsTemperature = !MODEL_USES_FIXED_SAMPLING_RE.test(
        this.model
      );
      const brief =
        rawHistory.length >= CORRESPONDENT_COMPRESS_MIN_CHARS
          ? await compressCorrespondentHistoryForReply(
              this.client,
              this.model,
              rawHistory,
              supportsTemperature
            )
          : rawHistory;
      userPrompt = appendCorrespondentHistoryToPrompt(userPrompt, brief);
    }

    const maxOut =
      options.maxTokens ?? LENGTH_MAX_TOKENS[resolvedLength] ?? 420;
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
      resolvedLength,
      resolvedTone,
      tokensUsed: completion.usage?.total_tokens ?? 0,
    };
  }
}
