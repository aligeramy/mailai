import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSystemPrompt,
  formatEmailChain,
  OpenAIService,
  parseReplyPreferenceRecommendation,
} from "@/lib/services/ai-service";
import type { EmailChain } from "@/lib/types";

const createMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: "Thank you for your email. I will follow up shortly.",
        },
      },
    ],
    model: "gpt-5.4",
    usage: { total_tokens: 42 },
  })
);

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: createMock,
      },
    };
  },
}));

describe("buildSystemPrompt", () => {
  it("mentions tone", () => {
    expect(buildSystemPrompt("high")).toContain("high");
  });
});

describe("parseReplyPreferenceRecommendation", () => {
  it("parses strict JSON", () => {
    expect(
      parseReplyPreferenceRecommendation('{"length":"high","tone":"light"}')
    ).toEqual({
      length: "high",
      tone: "light",
    });
  });

  it("falls back to loose text parsing", () => {
    expect(
      parseReplyPreferenceRecommendation("tone: normal\nlength: light")
    ).toEqual({
      length: "light",
      tone: "normal",
    });
  });
});

describe("formatEmailChain", () => {
  const chain: EmailChain = {
    subject: "Hello",
    currentUserEmail: "me@test.com",
    messages: [
      {
        id: "1",
        from: "them@test.com",
        to: ["me@test.com"],
        subject: "Hello",
        body: "Please review.",
        timestamp: new Date("2025-01-01T12:00:00.000Z"),
      },
    ],
  };

  it("labels sender and includes subject", () => {
    const out = formatEmailChain({
      emailChain: chain,
      tone: "normal",
    });
    expect(out).toContain("Email Subject: Hello");
    expect(out).toContain("them@test.com");
  });
});

describe("OpenAIService", () => {
  beforeEach(() => {
    createMock.mockClear();
  });

  it("calls chat.completions.create and returns reply", async () => {
    const svc = new OpenAIService("sk-test", "gpt-5.4");
    const chain: EmailChain = {
      subject: "S",
      currentUserEmail: "me@test.com",
      messages: [
        {
          id: "1",
          from: "a@b.com",
          to: ["me@test.com"],
          subject: "S",
          body: "Hi",
          timestamp: new Date(),
        },
      ],
    };
    const r = await svc.generateReply({
      emailChain: chain,
      tone: "normal",
    });
    expect(r.reply).toContain("Thank you");
    expect(r.tokensUsed).toBe(42);
    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0]?.[0] as {
      model: string;
      max_completion_tokens?: number;
    };
    expect(arg.model).toBe("gpt-5.4");
    expect(arg.max_completion_tokens).toBe(420);
  });
});
