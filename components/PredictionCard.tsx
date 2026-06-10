"use client";

// Reads /api/predict on mount and renders the top likely-sweep window
// derived from accumulated activity events. Home stays quiet while the
// predictor is still learning; /forecast owns the detailed learning copy.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "./Card";
import { SS_TOKENS } from "@/lib/tokens";
import type { PredictorOutput, PredictionWindow } from "@/lib/predictor";
import type { LearningState } from "@/lib/learning";
import { formatTs, formatTsBare } from "@/lib/time";

const MIN_TOTAL_EVENTS_FOR_PREDICTION = 10;

export function PredictionCard({
  learning,
  hour12 = false,
}: {
  learning?: LearningState;
  hour12?: boolean;
}) {
  const [data, setData] = useState<PredictorOutput | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/predict", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as PredictorOutput;
        if (!cancelled) setData(d);
      } catch {
        /* transient — render placeholder */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // While loading, render nothing — avoids a flash of the "still learning"
  // copy when the prediction is actually about to appear.
  if (data === null) return null;

  const tooFew = data.total_events < MIN_TOTAL_EVENTS_FOR_PREDICTION;
  const top = data.windows[0];
  if (learning?.stillLearning || tooFew || !top) return null;

  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="ss-eyebrow" style={{ marginBottom: 6 }}>
            Next likely sweep
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: SS_TOKENS.fg0,
              lineHeight: 1.3,
            }}
          >
            {fmtPredictionDayLabel(top.window_start)}
          </div>
          <div
            className="ss-mono"
            style={{ fontSize: 12, color: SS_TOKENS.fg1, marginTop: 4 }}
          >
            {fmtPredictionTimeRange(top.window_start, top.window_end, hour12)}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            className="ss-mono"
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: SS_TOKENS.alert,
              lineHeight: 1,
            }}
          >
            {Math.round(top.probability * 100)}%
          </div>
          <div
            className="ss-mono"
            style={{
              fontSize: 9,
              color: SS_TOKENS.fg2,
              letterSpacing: ".08em",
              marginTop: 4,
            }}
          >
            {confidenceLabel(top.confidence_level)}
          </div>
        </div>
      </div>
      {top.common_tails.length > 0 && (
        <div
          className="ss-mono"
          style={{
            fontSize: 10.5,
            color: SS_TOKENS.fg2,
            marginTop: 10,
            letterSpacing: ".04em",
          }}
        >
          {top.common_tails
            .map((t) => t.nickname ?? t.tail)
            .join(" · ")}
        </div>
      )}
      <div
        style={{
          fontSize: 11,
          color: SS_TOKENS.fg2,
          marginTop: 12,
          lineHeight: 1.45,
        }}
      >
        From {top.sample_count} historical sweep
        {top.sample_count === 1 ? "" : "s"} in this hour-of-week.{" "}
        <Link
          href="/forecast"
          style={{ color: SS_TOKENS.fg1, textDecoration: "underline" }}
        >
          View weekly forecast →
        </Link>
      </div>
    </Card>
  );
}

function ptDayKey(tsMs: number): string {
  return formatTs(tsMs, "date");
}

function fmtPredictionDayLabel(iso: string): string {
  const ts = new Date(iso).getTime();
  const target = ptDayKey(ts);
  const today = ptDayKey(Date.now());
  const tomorrow = ptDayKey(Date.now() + 86_400_000);
  if (target === today) return "Today";
  if (target === tomorrow) return "Tomorrow";
  return formatTs(ts, "date-weekday");
}

function fmtPredictionTimeRange(
  startIso: string,
  endIso: string,
  hour12: boolean,
): string {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return `${formatTsBare(start, "hour-min", { hour12 })} – ${formatTs(end, "hour-min", { hour12 })}`;
}

function confidenceLabel(c: PredictionWindow["confidence_level"]): string {
  if (c === "high") return "HIGH CONFIDENCE";
  if (c === "medium") return "MEDIUM";
  return "EARLY SIGNAL";
}

