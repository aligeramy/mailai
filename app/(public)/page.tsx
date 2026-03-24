import { Mail } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between border-border border-b px-6 py-4">
        <Link
          className="flex items-center gap-2 font-medium text-foreground"
          href="/"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Mail aria-hidden className="size-5" />
          </span>
          MailAI
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
        <p className="mb-4 text-muted-foreground text-sm">
          Smart email assistant
        </p>
        <h1 className="mb-4 font-semibold text-4xl tracking-tight sm:text-5xl">
          Draft replies faster with AI
        </h1>
        <p className="mb-10 max-w-lg text-lg text-muted-foreground leading-relaxed">
          MailAI helps you write clear replies in Outlook and Gmail—right where
          you work.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            className={cn(
              buttonVariants({ size: "lg", variant: "default" }),
              "justify-center"
            )}
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "justify-center"
            )}
            href="/taskpane"
          >
            Open task pane
          </Link>
        </div>
      </main>
      <footer className="border-border border-t px-6 py-6 text-center text-muted-foreground text-sm">
        MailAI · AI-powered email for busy inboxes
      </footer>
    </div>
  );
}
