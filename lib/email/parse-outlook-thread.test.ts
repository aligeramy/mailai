import { describe, expect, it } from "vitest";
import {
  buildMessagesFromSegments,
  extractEmailFromFromLine,
  parseOutlookHeaderBlock,
  parseOutlookThreadFromHtml,
  splitThreadSegments,
} from "@/lib/email/parse-outlook-thread";

describe("extractEmailFromFromLine", () => {
  it("reads angle-bracket form", () => {
    expect(extractEmailFromFromLine("Jane Doe <jane@example.com>")).toBe(
      "jane@example.com"
    );
  });

  it("reads bare email", () => {
    expect(extractEmailFromFromLine("bob@company.org")).toBe("bob@company.org");
  });
});

describe("parseOutlookHeaderBlock", () => {
  it("parses standard Outlook headers", () => {
    const block = `From: Sender <s@x.com>
Sent: Monday, March 1, 2025 9:00 AM
To: You <you@y.com>
Subject: Re: Hello

Previous message body here.`;
    const r = parseOutlookHeaderBlock(block);
    expect(r.from).toBe("s@x.com");
    expect(r.subject).toBe("Re: Hello");
    expect(r.body).toContain("Previous message body");
  });
});

describe("splitThreadSegments", () => {
  it("splits on Original Message delimiter", () => {
    const t = `My reply text

-----Original Message-----
From: a@b.com

Older stuff`;
    const s = splitThreadSegments(t);
    expect(s.length).toBeGreaterThanOrEqual(2);
    expect(s[0]).toContain("My reply text");
  });
});

describe("parseOutlookThreadFromHtml", () => {
  it("builds chronological messages from HTML body", () => {
    const html = `<div>Thanks for the update.</div>
-----Original Message-----
From: Other &lt;other@test.com&gt;
Sent: Mon, 1 Jan 2025
To: me@test.com
Subject: Re: Topic

Earlier note.`;
    const msgs = parseOutlookThreadFromHtml(
      html,
      "Topic",
      "me@test.com",
      "me@test.com"
    );
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs.at(-1)?.from).toBe("me@test.com");
  });
});

describe("buildMessagesFromSegments", () => {
  it("assigns newest fallback sender to last message", () => {
    const msgs = buildMessagesFromSegments(
      ["Top reply without headers", "From: x@y.com\nSent: a\nSubject: s\nBody"],
      "Subj",
      "current@user.com",
      "current@user.com"
    );
    expect(msgs.at(-1)?.from).toBe("current@user.com");
  });
});
