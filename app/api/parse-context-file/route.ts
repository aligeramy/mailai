import { type NextRequest, NextResponse } from "next/server";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const WHITESPACE_RUN_RE = /[ \t]+/g;
const TRIPLE_NEWLINE_RE = /\n{3,}/g;

type ParsedKind = "pdf" | "docx" | "doc" | "txt" | "json" | "markdown";

function tidyExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(WHITESPACE_RUN_RE, " ")
    .replace(TRIPLE_NEWLINE_RE, "\n\n")
    .trim();
}

function detectKind(filename: string, mimeType: string): ParsedKind | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") {
    return "pdf";
  }
  if (
    lower.endsWith(".docx") ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (lower.endsWith(".doc") || mimeType === "application/msword") {
    return "doc";
  }
  if (lower.endsWith(".json") || mimeType === "application/json") {
    return "json";
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return "markdown";
  }
  if (lower.endsWith(".txt") || mimeType.startsWith("text/")) {
    return "txt";
  }
  return null;
}

async function parsePdf(buffer: Buffer): Promise<string> {
  // pdf-parse v2 exposes a PDFParse class (not a default-exported function as
  // in v1). Instantiate with { data } then call getText().
  const mod = (await import("pdf-parse")) as {
    PDFParse: new (opts: { data: Buffer }) => {
      getText: () => Promise<{ text?: string }>;
      destroy: () => void;
    };
  };
  const parser = new mod.PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    parser.destroy();
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")) as {
    extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

async function parseDoc(buffer: Buffer): Promise<string> {
  const WordExtractor = (await import("word-extractor")).default as new () => {
    extract: (
      input: Buffer
    ) => Promise<{ getBody: () => string; getFootnotes: () => string }>;
  };
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  return [doc.getBody(), doc.getFootnotes()].filter(Boolean).join("\n");
}

async function extractFromFile(args: {
  kind: ParsedKind;
  bytes: ArrayBuffer;
  filename: string;
  rawText: string;
}): Promise<string> {
  const { kind, bytes, filename, rawText } = args;
  switch (kind) {
    case "pdf": {
      const text = await parsePdf(Buffer.from(bytes));
      if (!text.trim()) {
        throw new Error(
          `PDF "${filename}" has no extractable text (image-only?). Run OCR first.`
        );
      }
      return text;
    }
    case "docx":
      return await parseDocx(Buffer.from(bytes));
    case "doc":
      return await parseDoc(Buffer.from(bytes));
    case "json": {
      try {
        const parsed = JSON.parse(rawText) as unknown;
        return JSON.stringify(parsed, null, 2);
      } catch {
        return rawText;
      }
    }
    case "txt":
    case "markdown":
      return rawText;
    default:
      throw new Error(`Unsupported file kind: ${kind as string}`);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided (expected form field "file").' },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB > 10 MB cap).`,
        },
        { status: 413 }
      );
    }
    const kind = detectKind(file.name, file.type);
    if (!kind) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type || "unknown"} (${file.name}). Try .pdf, .docx, .doc, .json, .md, or .txt.`,
        },
        { status: 415 }
      );
    }
    const bytes = await file.arrayBuffer();
    const rawText =
      kind === "txt" || kind === "markdown" || kind === "json"
        ? new TextDecoder("utf-8", { fatal: false }).decode(bytes)
        : "";
    const extracted = await extractFromFile({
      kind,
      bytes,
      filename: file.name,
      rawText,
    });
    const content = tidyExtractedText(extracted);
    if (!content) {
      return NextResponse.json(
        { error: `No text content found in ${file.name}.` },
        { status: 422 }
      );
    }
    return NextResponse.json({
      filename: file.name,
      kind,
      content,
      sizeBytes: file.size,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
