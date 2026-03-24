import { describe, expect, it } from "vitest";
import { stripHtml } from "@/lib/email/html";

describe("stripHtml", () => {
  it("converts br and strips tags", () => {
    expect(stripHtml("<p>Hi</p><br/>there")).toBe("Hi\n\nthere");
  });

  it("decodes common entities", () => {
    expect(stripHtml("a &amp; b &lt; c")).toBe("a & b < c");
  });
});
