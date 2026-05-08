"use client";

import { useRouter } from "next/navigation";
import { SS_TOKENS } from "@/lib/tokens";

export function BackLink() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="ss-mono"
      style={{
        background: "transparent",
        border: 0,
        // Vertical padding pushes hit area to ≥44 px (WCAG AA) without
        // changing the visual layout — the link's text-only footprint
        // sat at ~17 px tall before. Negative left margin pulls the
        // text back to the original visual edge despite the padding.
        padding: "13px 12px",
        margin: "-13px -12px",
        minHeight: 44,
        color: SS_TOKENS.fg1,
        fontSize: 13,
        cursor: "pointer",
        alignSelf: "flex-start",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      ‹ Back
    </button>
  );
}
