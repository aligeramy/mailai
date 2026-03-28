"use client";

import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/** URIs that may hand off to the installed Outlook desktop app (OS-dependent). */
const OUTLOOK_DESKTOP_SCHEMES = [
  "ms-outlook:",
  "microsoft-outlook:",
  "outlook:",
] as const;

function tryOpenOutlookDesktop(): void {
  for (let i = 0; i < OUTLOOK_DESKTOP_SCHEMES.length; i++) {
    window.setTimeout(() => {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("title", "Outlook app handoff");
      iframe.setAttribute("aria-hidden", "true");
      iframe.setAttribute(
        "style",
        "position:absolute;width:0;height:0;border:0;clip:rect(0,0,0,0)"
      );
      iframe.src = OUTLOOK_DESKTOP_SCHEMES[i];
      document.body.appendChild(iframe);
      window.setTimeout(() => iframe.remove(), 1200);
    }, i * 400);
  }
}

export function OpenOutlookAfterSignIn({ webMailUrl }: { webMailUrl: string }) {
  useEffect(() => {
    tryOpenOutlookDesktop();
  }, []);

  const handleTryDesktopAgain = useCallback(() => {
    tryOpenOutlookDesktop();
  }, []);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 text-center">
      <p className="text-muted-foreground text-sm leading-relaxed">
        SmartReply runs inside Outlook. We tried to open the Outlook app on your
        computer. If nothing happened, use Outlook on the web or open Outlook
        yourself and launch the add-in from the ribbon.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <a
          className={cn(
            buttonVariants({ variant: "default", size: "default" }),
            "inline-flex w-full items-center justify-center sm:w-auto"
          )}
          href={webMailUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open Outlook on the web
        </a>
        <Button
          className="w-full sm:w-auto"
          onClick={handleTryDesktopAgain}
          type="button"
          variant="outline"
        >
          Try Outlook desktop again
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        On the web, install or pin the SmartReply add-in from Apps if prompted.
      </p>
    </div>
  );
}
