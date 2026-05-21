import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You polish raw notes into compact, model-ready context blocks.

Rules:
- Preserve every fact, name, date, number, and quote from the input.
- Group related facts; use short bullets, not prose.
- Strip filler ("just wanted to say", "I think", etc.).
- Don't invent details. Don't generalize. Don't editorialize.
- Output plain markdown. Max ~300 words. No greeting, no sign-off.
- Lead with a one-line summary, then bullets.`;

interface PolishBody {
  apiKey?: unknown;
  content?: unknown;
  title?: unknown;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: linear validation + single OpenAI call + error mapping; splitting hurts traceability.
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as PolishBody;
    const raw = typeof body.content === "string" ? body.content.trim() : "";
    if (!raw) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }
    const userKey =
      typeof body.apiKey === "string" && body.apiKey.trim()
        ? body.apiKey.trim()
        : undefined;
    const apiKey = userKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 401 }
      );
    }

    const model = process.env.OPENAI_FAST_MODEL ?? "gpt-5.4-mini";
    const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;
    const client = new OpenAI({ apiKey, baseURL });

    const userTitle =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : undefined;
    const userPrompt = userTitle
      ? `Title: ${userTitle}\n\nNotes:\n${raw}`
      : raw;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 800,
    });
    const polished = completion.choices[0]?.message?.content?.trim();
    if (!polished) {
      return NextResponse.json(
        { error: "Polish returned empty output." },
        { status: 502 }
      );
    }
    return NextResponse.json({ polished, model: completion.model ?? model });
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status && err.status >= 400 ? err.status : 502 }
      );
    }
    const message =
      err instanceof Error ? err.message : "Polish request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
