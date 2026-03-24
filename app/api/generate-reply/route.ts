import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { OpenAIService } from "@/lib/services/ai-service";
import type { GenerateReplyOptions, ReplyTone } from "@/lib/types";

const VALID_TONES: ReplyTone[] = [
  "professional",
  "friendly",
  "concise",
  "formal",
  "casual",
];

function parseReasoningEffort(
  raw: string | undefined
): "low" | "medium" | "high" | undefined {
  if (!raw) {
    return;
  }
  const v = raw.trim().toLowerCase();
  if (v === "low" || v === "medium" || v === "high") {
    return v;
  }
  return;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { emailChain, tone, additionalContext, apiKey } = body;

    // Phase 1: optional key from client; Phase 2: server-side auth + vault
    const resolvedApiKey = apiKey ?? process.env.OPENAI_API_KEY;

    if (!resolvedApiKey) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key is required. Add OPENAI_API_KEY to .env.local or paste a key in the add-in settings.",
        },
        { status: 401 }
      );
    }

    if (!emailChain?.messages?.length) {
      return NextResponse.json(
        { error: "Email chain is required with at least one message." },
        { status: 400 }
      );
    }

    const resolvedTone: ReplyTone = VALID_TONES.includes(tone)
      ? tone
      : "professional";

    const parsedChain = {
      ...emailChain,
      messages: emailChain.messages.map((msg: Record<string, unknown>) => ({
        ...msg,
        timestamp: new Date(msg.timestamp as string),
      })),
    };

    const model = process.env.OPENAI_MODEL ?? "gpt-5.4";
    const reasoningEffort = parseReasoningEffort(
      process.env.OPENAI_REASONING_EFFORT
    );
    const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;

    const service = new OpenAIService(resolvedApiKey, model, {
      baseURL,
      reasoningEffort,
    });

    const options: GenerateReplyOptions = {
      emailChain: parsedChain,
      tone: resolvedTone,
      additionalContext,
    };

    const result = await service.generateReply(options);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status && error.status >= 400 ? error.status : 502 }
      );
    }

    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    const isApiError =
      message.includes("OpenAI") ||
      message.includes("API") ||
      message.includes("401");
    const status = isApiError ? 502 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
