import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { OpenAIService } from "@/lib/services/ai-service";
import type {
  EmailChain,
  GenerateReplyOptions,
  ReplyLength,
  ReplyTone,
} from "@/lib/types";

const VALID_TONES: ReplyTone[] = [
  "professional",
  "friendly",
  "concise",
  "formal",
  "casual",
];
const VALID_LENGTHS: ReplyLength[] = ["quick", "short", "normal", "long"];

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

async function handleGenerateReplyBody(
  body: Record<string, unknown>
): Promise<NextResponse> {
  const {
    emailChain,
    tone,
    length,
    additionalContext,
    correspondentHistoryRaw,
    apiKey,
  } = body;

  const chainForLog = emailChain as { messages?: unknown[] } | undefined;
  console.info("[mailai/api] generate-reply request", {
    hasClientApiKey: Boolean(apiKey),
    messageCount: chainForLog?.messages?.length ?? 0,
    tone,
    length,
    hasAdditionalContext: Boolean(additionalContext),
    hasCorrespondentHistory: Boolean(
      typeof correspondentHistoryRaw === "string" &&
        correspondentHistoryRaw.trim().length > 0
    ),
  });

  const resolvedApiKey =
    (apiKey as string | undefined) ?? process.env.OPENAI_API_KEY;

  if (!resolvedApiKey) {
    return NextResponse.json(
      {
        error:
          "OpenAI API key is required. Add OPENAI_API_KEY to .env.local or paste a key in the add-in settings.",
      },
      { status: 401 }
    );
  }

  if (
    !emailChain ||
    typeof emailChain !== "object" ||
    !Array.isArray((emailChain as { messages?: unknown }).messages) ||
    (emailChain as { messages: unknown[] }).messages.length === 0
  ) {
    return NextResponse.json(
      { error: "Email chain is required with at least one message." },
      { status: 400 }
    );
  }

  const ec = emailChain as {
    messages: Record<string, unknown>[];
    subject?: string;
    currentUserEmail?: string;
  };

  const resolvedTone: ReplyTone = VALID_TONES.includes(tone as ReplyTone)
    ? (tone as ReplyTone)
    : "professional";
  const resolvedLength: ReplyLength = VALID_LENGTHS.includes(
    length as ReplyLength
  )
    ? (length as ReplyLength)
    : "normal";

  const parsedChain: EmailChain = {
    subject: ec.subject ?? "No Subject",
    currentUserEmail: ec.currentUserEmail ?? "",
    messages: ec.messages.map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp as string),
    })) as EmailChain["messages"],
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

  const rawHistory =
    typeof correspondentHistoryRaw === "string" &&
    correspondentHistoryRaw.trim().length > 0
      ? correspondentHistoryRaw.trim()
      : undefined;

  const options: GenerateReplyOptions = {
    emailChain: parsedChain,
    tone: resolvedTone,
    length: resolvedLength,
    additionalContext:
      typeof additionalContext === "string" && additionalContext.trim()
        ? additionalContext.trim()
        : undefined,
    correspondentHistoryRaw: rawHistory,
  };

  const result = await service.generateReply(options);
  console.info("[mailai/api] generate-reply success", {
    model: result.model,
    tokensUsed: result.tokensUsed,
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    return await handleGenerateReplyBody(body);
  } catch (error) {
    console.error("[mailai/api] generate-reply error", error);
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
