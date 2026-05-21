// word-extractor ships without a TypeScript declaration; this is a minimal
// shim for the only methods we use server-side in /api/parse-context-file.
declare module "word-extractor" {
  interface ExtractedDocument {
    getAnnotations(): string;
    getBody(): string;
    getEndnotes(): string;
    getFootnotes(): string;
    getHeaders(): string;
  }

  class WordExtractor {
    extract(input: string | Buffer): Promise<ExtractedDocument>;
  }

  export default WordExtractor;
}
