"use client";

import {
  Content,
  Portal,
  Provider,
  Root,
  Trigger,
} from "@radix-ui/react-tooltip";
import type * as React from "react";
import { cn } from "@/lib/utils";

function TooltipProvider({
  delayDuration = 120,
  ...props
}: React.ComponentProps<typeof Provider>) {
  return <Provider delayDuration={delayDuration} {...props} />;
}

function Tooltip({ ...props }: React.ComponentProps<typeof Root>) {
  return <Root {...props} />;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof Trigger>) {
  return <Trigger {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof Content>) {
  return (
    <Portal>
      <Content
        className={cn(
          "z-50 overflow-hidden rounded-md border border-white/15 bg-popover px-2.5 py-1.5 text-popover-foreground text-xs shadow-md",
          className
        )}
        sideOffset={sideOffset}
        {...props}
      />
    </Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
