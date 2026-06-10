"use client";

// Sitewide tooltip primitive — wraps @radix-ui/react-tooltip with our
// design tokens. Handles desktop hover, touch long-press, keyboard
// focus, and Escape dismissal automatically. Use sparingly: only on
// elements whose purpose isn't self-evident from their label.

import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { SS_TOKENS } from "@/lib/tokens";

const DEFAULT_DELAY_MS = 350;

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

type Props = {
  content: ReactNode;
  children: ReactNode;
  side?: Side;
  align?: Align;
  delayMs?: number;
};

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider
      delayDuration={DEFAULT_DELAY_MS}
      // Skip the delay only when the user has already moved between
      // tooltipped elements — feels snappier than re-arming for each.
      skipDelayDuration={150}
      // Long-press surface for touch users; default behavior on mobile.
      disableHoverableContent={false}
    >
      {children}
    </RadixTooltip.Provider>
  );
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayMs,
}: Props) {
  if (!content) return <>{children}</>;
  return (
    <RadixTooltip.Root delayDuration={delayMs ?? DEFAULT_DELAY_MS}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          style={{
            zIndex: 1000,
            maxWidth: 240,
            padding: "8px 12px",
            borderRadius: 6,
            background: SS_TOKENS.bg1,
            color: SS_TOKENS.fg0,
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            boxShadow:
              "0 6px 20px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.30)",
            fontFamily: "var(--font-brand)",
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.4,
            // Match wake-lock + spotted button polish.
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {content}
          <RadixTooltip.Arrow
            width={10}
            height={5}
            style={{ fill: SS_TOKENS.bg1 }}
          />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
