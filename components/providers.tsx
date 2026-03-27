"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

// Only instantiate the Convex client when the URL is actually configured.
// During local dev before `npx convex dev` is run, this will be falsy and
// the ConvexProvider is simply skipped (the rest of the app still works).
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function Providers({ children }: { children: ReactNode }) {
  const inner = convex ? (
    <ConvexProvider client={convex}>{children}</ConvexProvider>
  ) : (
    children
  );

  return <SessionProvider>{inner}</SessionProvider>;
}
