import { SS_TOKENS } from "@/lib/tokens";

const LOGO_SRC = "/icons/washington-eye-logo.svg";

type LogoProps = {
  /** Pixel height of the rendered mark. Wordmark scales accordingly. */
  size?: number;
  /** Pixel size of the mark when it should differ from the wordmark scale. */
  markSize?: number;
  /** Retained for older call sites; the new mark is already compact-safe. */
  compact?: boolean;
  /** Retained for older call sites; the new mark keeps its brand colors. */
  mono?: boolean;
  /** Render the wordmark "Out Of Sight" alongside the mark. */
  wordmark?: boolean;
  className?: string;
  /** Retained for compatibility with older call sites. */
  color?: string;
  /** Override the wordmark text color (defaults to current text color). */
  textColor?: string;
};

export function Logo({
  size = 24,
  markSize,
  wordmark = false,
  className,
  textColor,
}: LogoProps) {
  const renderedMarkSize = markSize ?? size;
  const mark = (
    <img
      src={LOGO_SRC}
      width={renderedMarkSize}
      height={renderedMarkSize}
      alt=""
      aria-hidden="true"
      style={{
        display: "block",
        width: renderedMarkSize,
        height: renderedMarkSize,
        objectFit: "contain",
        flexShrink: 0,
      }}
    />
  );

  if (!wordmark) {
    return (
      <span
        className={className}
        aria-label="Out Of Sight"
        role="img"
        style={{ display: "inline-flex", lineHeight: 0 }}
      >
        {mark}
      </span>
    );
  }

  return (
    <span
      className={className}
      aria-label="Out Of Sight"
      role="img"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.max(8, Math.round(size * 0.24)),
        lineHeight: 1,
        color: textColor ?? SS_TOKENS.fg0,
        whiteSpace: "nowrap",
      }}
    >
      {mark}
      <span
        style={{
          fontFamily: "var(--font-brand)",
          fontSize: Math.max(18, Math.round(size * 0.68)),
          fontWeight: 800,
          letterSpacing: 0,
        }}
      >
        Out Of Sight
      </span>
    </span>
  );
}
