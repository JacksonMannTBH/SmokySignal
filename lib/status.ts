// Single source of truth for "what's the fleet doing right now," driven by
// FleetMember.role (not specific tail nicknames). Both the home hero
// (Glanceable), the radar status pill, the PWA app-icon badge, and the
// embeddable /api/badge.svg all derive their copy from computeStatus().
//
// Alert classes (amber pill, all read SMOKEY UP): smokey, patrol, unknown
// Clear classes (green pill, ALL CLEAR): sar, transport, nothing
//
// Smokey-as-umbrella: every law-enforcement aircraft surfaces as SMOKEY UP
// on the rider-facing pill. The granular role taxonomy still drives body
// copy (a fixed-wing smokey vs a patrol helicopter read differently
// underneath the pill), but the headline is uniform.
//
// When something clear-class is up alone, we still show ALL CLEAR but
// surface a small footnote ("SnoHawk 10 on a rescue run.") so riders
// have context without alarm.

import type { Aircraft, Snapshot, FleetEntry, FleetRole } from "./types";

export type StatusKind = "alert" | "clear";

export type StatusState = {
  kind: StatusKind;
  /** Top-line label inside the pill: SMOKEY UP / ALL CLEAR. */
  pill: string;
  /** Optional sub-label inside the pill (e.g. "2 watching"). */
  pillSub?: string;
  /** Big home-page hero h1. */
  headline: string;
  /** Home-page subtitle paragraph. */
  body: string;
  /** Small footnote line under body when only clear-class aircraft are up. */
  footnote?: string;
  /** Lead aircraft + fleet entry, for callers that need raw context. */
  lead: { aircraft: Aircraft; entry: FleetEntry } | null;
  /**
   * Count of alert-class aircraft (smokey + patrol + unknown). Drives the
   * "X up" suffix on the embeddable badge and the PWA app-icon badge.
   * SAR + transport are excluded — they're up but they don't count.
   */
  alertCount: number;
  /** Total airborne across all roles. */
  totalAirborne: number;
};

const ALERT_ROLES: ReadonlySet<FleetRole> = new Set([
  "smokey",
  "patrol",
  "unknown",
]);

function describeClearMission(role: FleetRole): string {
  if (role === "sar") return "rescue run";
  if (role === "transport") return "transport";
  return "watch"; // unreachable for clear classes; defensive
}

export function computeStatus(
  snapshot: Snapshot,
  fleet: Map<string, FleetEntry>,
): StatusState {
  const airborne = snapshot.aircraft.filter((a) => a.airborne);
  const upByRole: Record<FleetRole, Array<{ aircraft: Aircraft; entry: FleetEntry }>> = {
    smokey: [],
    patrol: [],
    sar: [],
    transport: [],
    unknown: [],
  };
  for (const a of airborne) {
    const entry = fleet.get(a.tail);
    if (!entry) continue;
    upByRole[entry.role].push({ aircraft: a, entry });
  }
  const alertCount =
    upByRole.smokey.length + upByRole.patrol.length + upByRole.unknown.length;

  // Alert tier 1 — any smokey-class up. SMOKEY UP, amber.
  if (upByRole.smokey.length > 0) {
    const lead = upByRole.smokey[0]!;
    const otherSmokey = upByRole.smokey.length - 1;
    return {
      kind: "alert",
      pill: "SMOKEY UP",
      pillSub: alertCount > 1 ? `${alertCount} up` : undefined,
      headline: "Smokey's up.",
      body: lead.entry.nickname
        ? `${lead.entry.nickname} watching. Mind the throttle.`
        : "Speed enforcement plane in the air. Mind the throttle.",
      footnote:
        otherSmokey > 0 || upByRole.patrol.length > 0
          ? buildAlertFootnote(upByRole, lead)
          : undefined,
      lead,
      alertCount,
      totalAirborne: airborne.length,
    };
  }

  // Alert tier 2 — patrol or unknown up (no smokey). Per the Smokey
  // umbrella, the pill reads SMOKEY UP just like tier 1 — body copy
  // still distinguishes a patrol helicopter from a fixed-wing smokey
  // for context, but the headline is uniform.
  if (upByRole.patrol.length > 0 || upByRole.unknown.length > 0) {
    const lead = upByRole.patrol[0] ?? upByRole.unknown[0]!;
    return {
      kind: "alert",
      pill: "SMOKEY UP",
      pillSub: alertCount > 1 ? `${alertCount} up` : undefined,
      headline: "Smokey's up.",
      body: lead.entry.nickname
        ? `${lead.entry.nickname} in the air. Could be patrol.`
        : "Patrol helicopter in the air. Mind the throttle.",
      lead,
      alertCount,
      totalAirborne: airborne.length,
    };
  }

  // Clear with footnote — only SAR / transport up. ALL CLEAR, green.
  if (upByRole.sar.length > 0 || upByRole.transport.length > 0) {
    const lead = upByRole.sar[0] ?? upByRole.transport[0]!;
    const mission = describeClearMission(lead.entry.role);
    const name = lead.entry.nickname ?? lead.aircraft.tail;
    return {
      kind: "clear",
      pill: "ALL CLEAR",
      headline: "Smokey's down.",
      body: "No bird up over Washington. Send it.",
      footnote: `${name} on a ${mission}.`,
      lead,
      alertCount: 0,
      totalAirborne: airborne.length,
    };
  }

  // Nothing airborne. ALL CLEAR, green.
  return {
    kind: "clear",
    pill: "ALL CLEAR",
    headline: "Smokey's down.",
    body: "No bird up over Washington. Send it.",
    lead: null,
    alertCount: 0,
    totalAirborne: 0,
  };
}

function buildAlertFootnote(
  upByRole: Record<FleetRole, Array<{ aircraft: Aircraft; entry: FleetEntry }>>,
  lead: { aircraft: Aircraft; entry: FleetEntry },
): string | undefined {
  const others: string[] = [];
  for (const r of upByRole.smokey) {
    if (r.aircraft.tail !== lead.aircraft.tail) {
      others.push(r.entry.nickname ?? r.aircraft.tail);
    }
  }
  for (const r of upByRole.patrol) {
    if (r.aircraft.tail !== lead.aircraft.tail) {
      others.push(r.entry.nickname ?? r.aircraft.tail);
    }
  }
  if (others.length === 0) return undefined;
  if (others.length === 1) return `${others[0]} also up.`;
  return `${others.length} other watchers up.`;
}

/** Convenience for callers that only have an array, not a Map. */
export function makeFleetMap(fleet: FleetEntry[]): Map<string, FleetEntry> {
  return new Map(fleet.map((f) => [f.tail, f]));
}

export function isAlertRole(role: FleetRole): boolean {
  return ALERT_ROLES.has(role);
}
