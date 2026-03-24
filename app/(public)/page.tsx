import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-20%] left-1/2 h-[min(70vh,560px)] w-[min(100vw,720px)] -translate-x-1/2 rounded-[100%] bg-primary/4.5 blur-3xl dark:bg-primary/9"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-muted/35 via-transparent to-transparent dark:from-muted/20"
      />

      <div className="absolute top-5 right-5 z-10 md:top-8 md:right-8">
        <ThemeToggle />
      </div>

      <main className="relative z-1 flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-104 flex-col items-center text-center sm:max-w-md">
          <div className="mb-12 flex flex-col items-center gap-6">
            <span className="flex size-13 items-center justify-center rounded-2xl border border-border/70 bg-card/40 shadow-[0_1px_0_0_oklch(1_0_0/0.06)_inset] backdrop-blur-sm dark:border-border/50 dark:bg-card/25 dark:shadow-[0_1px_0_0_oklch(1_0_0/0.04)_inset]">
              <Image
                alt="MailAI"
                className="size-[2.15rem] object-contain"
                height={52}
                priority
                src="/logo.png"
                width={52}
              />
            </span>
            <p className="font-medium text-[0.6875rem] text-muted-foreground uppercase tracking-[0.28em]">
              Smart email assistant
            </p>
          </div>

          <h1 className="mb-7 text-balance font-medium text-[2rem] text-foreground leading-[1.15] tracking-[-0.02em] sm:text-4xl sm:leading-[1.12] md:text-[2.625rem]">
            Replies that sound like you, in seconds.
          </h1>

          <p className="mb-14 max-w-[22ch] text-pretty text-[0.9375rem] text-muted-foreground leading-relaxed sm:max-w-none sm:text-base">
            One quiet place to draft clear email—where you already work.
          </p>

          <div className="flex w-full max-w-xs flex-col gap-2.5 sm:max-w-none sm:flex-row sm:justify-center sm:gap-3">
            <Link
              className={cn(
                buttonVariants({ size: "lg", variant: "default" }),
                "h-11 justify-center rounded-full px-8 shadow-sm"
              )}
              href="/login"
            >
              Sign in
            </Link>
            <Link
              className={cn(
                buttonVariants({ size: "lg", variant: "ghost" }),
                "h-11 justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
              href="/taskpane"
            >
              Open task pane
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-1 shrink-0 pb-10 text-center">
        <p className="text-[0.6875rem] text-muted-foreground/60 uppercase tracking-[0.2em]">
          MailAI
        </p>
      </footer>
    </div>
  );
}
