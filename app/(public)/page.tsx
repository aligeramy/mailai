import type { Metadata } from "next";
import Image from "next/image";
import { LandingReplyDemo } from "@/components/landing-reply-demo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} — Free AI reply generator for email`,
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE_NAME} — Free AI reply generator for email`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: [{ url: "/logo.png", width: 300, height: 300, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Free AI reply generator`,
    description: SITE_DESCRIPTION,
    images: ["/logo.png"],
  },
  robots: { index: true, follow: true },
  keywords: [
    "AI reply generator",
    "email reply",
    "AI response generator",
    "Outlook add-in",
    "smart reply",
    "free AI writing",
  ],
};

export default function Home() {
  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-15%] left-1/2 h-[min(65vh,520px)] w-[min(100vw,780px)] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.12_280/0.12),transparent_65%)] blur-3xl dark:bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.14_280/0.18),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,oklch(0.99_0.01_280/0.4)_0%,transparent_45%,transparent_100%)] dark:bg-[linear-gradient(180deg,oklch(0.2_0.02_280/0.25)_0%,transparent_50%,transparent_100%)]"
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10 md:py-8">
        <div className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-card/50 shadow-sm backdrop-blur-sm dark:bg-card/30">
            <Image
              alt={SITE_NAME}
              className="size-[1.65rem] object-contain"
              height={40}
              priority
              src="/logo.png"
              width={40}
            />
          </span>
          <span className="font-semibold text-foreground text-sm tracking-tight">
            {SITE_NAME}
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="relative z-1 flex flex-1 flex-col items-center px-6 pt-4 pb-16 md:px-10">
        <div className="flex w-full max-w-3xl flex-col items-center text-center">
          <p className="mb-4 font-medium text-[0.65rem] text-muted-foreground uppercase tracking-[0.22em]">
            Paste · generate · send
          </p>
          <h1 className="mb-4 max-w-[18ch] text-balance font-semibold text-[1.875rem] text-foreground leading-[1.12] tracking-[-0.03em] sm:max-w-none sm:text-4xl md:text-[2.5rem]">
            Free AI response generator
          </h1>
          <p className="mb-10 max-w-lg text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base">
            Paste any paragraph—no setup. Get a clear, professional reply you
            can edit and use anywhere.
          </p>

          <LandingReplyDemo />
        </div>
      </main>

      <footer className="relative z-1 mt-auto border-border/40 border-t px-6 py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-[0.8125rem] text-muted-foreground leading-snug">
            © {new Date().getFullYear()} {SITE_NAME}. Built for{" "}
            <span className="text-foreground/80">smartreply.space</span>.
          </p>
          <p className="text-[0.75rem] text-muted-foreground/80">
            <a
              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
              href={`${SITE_URL}/manifest.xml`}
              rel="noopener noreferrer"
            >
              Add-in manifest
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
