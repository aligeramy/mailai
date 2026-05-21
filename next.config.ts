import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse / pdfjs-dist / mammoth / word-extractor pull in worker scripts,
  // native bindings, and dynamic requires that Turbopack/Webpack can't bundle
  // safely. Externalize them so they're resolved from node_modules at runtime
  // on the server.
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "mammoth",
    "word-extractor",
  ],
};

export default nextConfig;
