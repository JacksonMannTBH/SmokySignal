import { SS_TOKENS } from "@/lib/tokens";
import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  padded?: boolean;
  raised?: boolean;
  style?: CSSProperties;
};

export function Card({ children, padded = true, raised = false, style }: Props) {
  return (
    <div
      style={{
        background: raised ? SS_TOKENS.bg2 : SS_TOKENS.surface,
        border: `1px solid ${raised ? SS_TOKENS.hairline2 : SS_TOKENS.hairline}`,
        borderRadius: raised ? 18 : 16,
        boxShadow: raised ? SS_TOKENS.shadowMd : "none",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        padding: padded ? 16 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
