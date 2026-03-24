import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  COPYRIGHT_ATTRIBUTION,
  COPYRIGHT_PRODUCT,
  SITE_HEADER_BRAND,
  SITE_HEADER_LOCKUP,
  SITE_URL,
} from "@/lib/site-config";

interface LegalDocShellProps {
  children: ReactNode;
  lastUpdated: string;
  title: string;
}

export function LegalDocShell({
  title,
  lastUpdated,
  children,
}: LegalDocShellProps) {
  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-12%] left-1/2 h-[min(55vh,480px)] w-[min(100vw,720px)] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.12_280/0.1),transparent_65%)] blur-3xl dark:bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.14_280/0.14),transparent_65%)]"
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10 md:py-8">
        <Link
          className="flex items-center gap-2.5 rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          href="/"
        >
          <span className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-card/50 shadow-sm backdrop-blur-sm dark:bg-card/30">
            <Image
              alt={SITE_HEADER_LOCKUP}
              className="size-[1.65rem] object-contain"
              height={40}
              src="/logo.png"
              width={40}
            />
          </span>
          <span className="font-semibold text-foreground text-sm tracking-tight">
            {SITE_HEADER_BRAND}
            <span className="font-medium text-muted-foreground">
              {" "}
              by {COPYRIGHT_ATTRIBUTION}
            </span>
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-1 flex flex-1 flex-col px-6 pb-16 md:px-10">
        <article className="mx-auto w-full max-w-2xl py-6 md:py-10">
          <p className="mb-4 font-medium text-[0.65rem] text-muted-foreground uppercase tracking-[0.18em]">
            Legal
          </p>
          <h1 className="mb-4 max-w-[20ch] text-balance font-semibold text-3xl text-foreground tracking-[-0.03em] md:text-4xl">
            {title}
          </h1>
          <p className="mb-10 text-muted-foreground text-sm">
            Last updated {lastUpdated}
          </p>
          <div className="space-y-6 text-muted-foreground text-sm leading-relaxed md:text-[0.9375rem] [&_h2]:scroll-mt-24 [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:text-lg [&_h2]:tracking-tight [&_li]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5">
            {children}
          </div>
        </article>
      </main>

      <footer className="relative z-1 mt-auto border-border/40 border-t px-6 py-10">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8125rem] text-muted-foreground leading-snug">
            © {new Date().getFullYear()} {COPYRIGHT_PRODUCT} by{" "}
            <span className="text-foreground/80">{COPYRIGHT_ATTRIBUTION}</span>.{" "}
            <span className="text-foreground/80">{new URL(SITE_URL).host}</span>
          </p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem]">
              <li>
                <Link
                  className="text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                  href="/terms"
                >
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                  href="/privacy"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <a
                  className="text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                  href={`${SITE_URL}/manifest.xml`}
                  rel="noopener noreferrer"
                >
                  Add-in manifest
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
