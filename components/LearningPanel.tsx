// Canonical "Learning the sky" panel — three variants of the same
// content. Used wherever forecast data is still being collected. Single
// component so the copy + day counter never disagree across surfaces.
//
// Voice rules baked in (design/BRAND.md §3):
//  - No emoji, no exclamation marks.
//  - Mono on every numeric (day count, events seen, days remaining).
//  - "Channel 19" garnish appears at most once across the page.
//  - Copy is "you'll wait days," never "loading."

import { LEARNING_THRESHOLD_DAYS, type LearningState } from "@/lib/learning";
import { SS_TOKENS } from "@/lib/tokens";

type Variant = "card" | "banner" | "overlay";

type Props = {
  state: LearningState;
  /** Prediction card / forecast: total takeoff events seen. */
  eventsSeen?: number;
  /** Hot zone learning callers may pass learned-zone counts for their own context. */
  zonesLearned?: number;
  variant?: Variant;
  className?: string;
  style?: React.CSSProperties;
};

export function LearningPanel({
  state,
  eventsSeen,
  variant = "card",
  className,
  style,
}: Props) {
  const headline = computeHeadline(state);
  const body = computeBody(state, eventsSeen);
  const day = state.daysElapsed;
  const cap = LEARNING_THRESHOLD_DAYS;
  const eyebrow = state.stillLearning
    ? `LEARNING THE SKY · DAY ${day} OF ${cap}`
    : `LEARNING THE SKY · ${cap}+ DAYS IN`;

  if (variant === "banner") {
    return (
      <div
        className={className}
        style={{
          background: SS_TOKENS.bg1,
          border: `.5px solid ${SS_TOKENS.hairline}`,
          borderRadius: 12,
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          ...style,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <span
            className="ss-mono"
            style={{ fontSize: 9.5, letterSpacing: ".1em", color: SS_TOKENS.fg2 }}
          >
            {eyebrow}
          </span>
          <span
            className="ss-mono"
            style={{ fontSize: 10.5, color: SS_TOKENS.fg1 }}
          >
            {progressLabel(state)}
          </span>
        </div>
        <ProgressBar progress={state.progress} />
        <p style={{ fontSize: 12, color: SS_TOKENS.fg1, margin: 0, lineHeight: 1.45 }}>
          {body}
        </p>
      </div>
    );
  }

  const cardInner = (
    <>
      <div
        className="ss-mono"
        style={{
          fontSize: 9.5,
          letterSpacing: ".1em",
          color: SS_TOKENS.fg2,
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: SS_TOKENS.fg0,
          letterSpacing: "-.01em",
          margin: 0,
          marginBottom: 8,
        }}
      >
        {headline}
      </h3>
      <ProgressBar progress={state.progress} />
      <p
        style={{
          fontSize: 13,
          color: SS_TOKENS.fg1,
          margin: 0,
          marginTop: 10,
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
    </>
  );

  if (variant === "overlay") {
    return (
      <div
        className={className}
        style={{
          background: "rgba(255,255,255,0.9)",
          border: `.5px solid ${SS_TOKENS.hairline2}`,
          borderRadius: 22,
          boxShadow: SS_TOKENS.shadowMd,
          padding: "14px 16px",
          backdropFilter: "blur(24px) saturate(1.1)",
          WebkitBackdropFilter: "blur(24px) saturate(1.1)",
          ...style,
        }}
      >
        {cardInner}
      </div>
    );
  }

  // card (default)
  return (
    <section
      className={className}
      style={{
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 20,
        boxShadow: SS_TOKENS.shadowSm,
        padding: "14px 16px",
        ...style,
      }}
    >
      {cardInner}
    </section>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  const clamped = Math.max(0, Math.min(1, progress));
  const day = Math.round(clamped * LEARNING_THRESHOLD_DAYS);
  return (
    <div
      role="progressbar"
      aria-label={`Learning progress: day ${day} of ${LEARNING_THRESHOLD_DAYS}`}
      aria-valuemin={0}
      aria-valuemax={LEARNING_THRESHOLD_DAYS}
      aria-valuenow={day}
      style={{
        width: "100%",
        height: 2,
        background: SS_TOKENS.hairline,
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${(clamped * 100).toFixed(2)}%`,
          height: "100%",
          background: SS_TOKENS.alert,
        }}
      />
    </div>
  );
}

function computeHeadline(state: LearningState): string {
  if (state.stillLearning) return "Channel 19's tuning in.";
  return "Sky's quiet enough to count.";
}

function computeBody(
  state: LearningState,
  eventsSeen?: number,
): string {
  const events = eventsSeen ?? 0;
  if (state.daysElapsed < 7) {
    return `We just got our ears on. Forecasts come online once we've watched the sky for ${LEARNING_THRESHOLD_DAYS} days.`;
  }
  if (state.stillLearning) {
    const d = state.daysRemaining;
    const dayWord = d === 1 ? "day" : "days";
    return `${d} ${dayWord} of listening to go before forecasts get sharp.`;
  }
  // past threshold but data sparse
  return `${events} takeoffs logged. Sky's been quieter than expected — give it another week and the patterns surface.`;
}

function progressLabel(state: LearningState): string {
  if (state.stillLearning) {
    return `${state.daysElapsed}/${LEARNING_THRESHOLD_DAYS} days`;
  }
  return `${LEARNING_THRESHOLD_DAYS}+ days`;
}
