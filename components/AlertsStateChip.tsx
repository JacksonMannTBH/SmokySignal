"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SS_TOKENS } from "@/lib/tokens";
import { readAircraftAlertStatus } from "@/lib/aircraft-alerts/client";

export function AlertsStateChip() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    readAircraftAlertStatus()
      .then((status) => setEnabled(status.enabled))
      .catch(() => setEnabled(false));
  }, []);

  return (
    <Link
      href="/settings/alerts"
      className="ss-mono"
      aria-label={`${enabled ? "Alerts on" : "Alerts off"}. Tap to view settings.`}
      style={{
        fontSize: 9.5,
        letterSpacing: ".08em",
        color: enabled ? SS_TOKENS.alert : SS_TOKENS.fg2,
        textDecoration: "none",
        padding: "2px 6px",
        border: `.5px solid ${enabled ? SS_TOKENS.alert : SS_TOKENS.hairline2}`,
        borderRadius: 4,
        whiteSpace: "nowrap",
      }}
    >
      {enabled ? "ALERTS ON" : "ALERTS OFF"}
    </Link>
  );
}
