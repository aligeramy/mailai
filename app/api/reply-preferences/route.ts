import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { OpenAIService } from "@/lib/services/ai-service";
import type { EmailChain } from "@/lib/types";

async function handleResolveReplyPreferencesBody(
  body: Record<string, unknown>
): Promise<NextResponse> {
  const { additionalContext, apiKey, emailChain } = body;

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

  const parsedChain: EmailChain = {
    subject: ec.subject ?? "No Subject",
    currentUserEmail: ec.currentUserEmail ?? "",
    messages: ec.messages.map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp as string),
    })) as EmailChain["messages"],
  };

  const fastModel = process.env.OPENAI_FAST_MODEL ?? "gpt-5.4-mini";
  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;
  const service = new OpenAIService(resolvedApiKey, fastModel, {
    baseURL,
    reasoningEffort: "low",
  });

  const resolved = await service.recommendReplyPreferences({
    emailChain: parsedChain,
    additionalContext:
      typeof additionalContext === "string" && additionalContext.trim()
        ? additionalContext.trim()
        : undefined,
  });

  return NextResponse.json(resolved);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    return await handleResolveReplyPreferencesBody(body);
  } catch (error) {
    console.error("[mailai/api] reply-preferences error", error);
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status && error.status >= 400 ? error.status : 502 }
      );
    }

    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
