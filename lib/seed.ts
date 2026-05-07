import type { FleetEntry } from "./types";
import { nNumberToIcao } from "./icao";

// FAA-verified registry. Hexes are baked in where confirmed; entries with
// `hex: null` (or omitted) are resolved at module load via the FAA N-number
// algorithm. lib/icao.test.ts asserts that every seeded hex matches what
// the algorithm produces — typos surface as test failures.
//
// `role` drives the home + radar status pill via lib/status.ts. All three
// alert-tier roles surface as SMOKEY UP under the rider-facing umbrella;
// the granular role taxonomy still drives body copy and badge tooltips.
//   smokey    → SMOKEY UP                  (alert / amber)
//   patrol    → SMOKEY UP                  (alert / amber)
//   unknown   → SMOKEY UP                  (alert / amber, conservative)
//   sar       → ALL CLEAR + footnote       (clear / green)
//   transport → ALL CLEAR + footnote       (clear / green)
// `roleConfidence` ('confirmed' | 'tentative' | 'unknown') is surfaced in
// the admin editor and as a small badge suffix on /plane/[tail] when not
// confirmed. `roleNote` is operator-facing free text.
//
// The free-text `roleDescription` field (formerly `role`) is the human-
// readable mission summary shown on /about and /plane/[tail].
export const FLEET: FleetEntry[] = [
  // Washington State Patrol — Olympia (all WSP fixed-wing are smokey)
  { tail: "N305DK", hex: "A3323A", operator: "WSP",          model: "Cessna 206H Stationair (FLIR)", nickname: "Smokey 4",          roleDescription: "Speed enforcement",            base: "KOLM Olympia",                          role: "smokey",    roleConfidence: "confirmed", roleNote: "Smokey 4 — WSP fixed-wing FLIR" },
  { tail: "N305RC", hex: "A3335F", operator: "WSP",          model: "Cessna 182T Skylane",            nickname: null,                roleDescription: "Speed enforcement",            base: "KOLM Olympia",                          role: "smokey",    roleConfidence: "confirmed", roleNote: "WSP fixed-wing speed enforcement" },
  { tail: "N2446X", hex: null,     operator: "WSP",          model: "Cessna 206H Stationair (FLIR)", nickname: "Smokey 3",          roleDescription: "Speed enforcement",            base: "KOLM Olympia",                          role: "smokey",    roleConfidence: "confirmed", roleNote: "Smokey 3 — WSP fixed-wing FLIR" },
  { tail: "N102LP", hex: "A00D2A", operator: "WSP",          model: "Cessna 182T Skylane",            nickname: null,                roleDescription: "Speed enforcement",            base: "KOLM Olympia",                          role: "smokey",    roleConfidence: "confirmed", roleNote: "WSP fixed-wing speed enforcement" },
  { tail: "N3532K", hex: null,     operator: "WSP",          model: "Cessna 182T Skylane",            nickname: null,                roleDescription: "Speed enforcement",            base: "KOLM Olympia",                          role: "smokey",    roleConfidence: "confirmed", roleNote: "WSP fixed-wing speed enforcement" },

  // State of Washington (multi-mission, shared with WSP/WSDOT)
  { tail: "N207HB", hex: "A1ACB5", operator: "State of WA",  model: "Beechcraft B200 Super King Air", nickname: null,                roleDescription: "Transport / multi-mission",    base: "KOLM Olympia (shared WSP/WSDOT)",       role: "transport", roleConfidence: "tentative", roleNote: "WA State King Air, multi-mission" },

  // King County Sheriff — Renton
  { tail: "N422CT", hex: "A50351", operator: "KCSO",         model: "Bell 407GXi",                    nickname: "Guardian One",       roleDescription: "Patrol / pursuit / SAR",       base: "KRNT Renton",                           role: "patrol",    roleConfidence: "confirmed", roleNote: "Guardian One — multi-role" },
  { tail: "N407KS", hex: "A4C794", operator: "KCSO",         model: "Bell 407",                        nickname: "Guardian One (legacy)", roleDescription: "Patrol / pursuit (backup)", base: "KRNT Renton",                       role: "patrol",    roleConfidence: "tentative", roleNote: "Guardian One legacy airframe" },
  { tail: "N790RJ", hex: "AAB985", operator: "KCSO",         model: "Bell UH-1H Iroquois",            nickname: "Guardian Two",       roleDescription: "SAR / SWAT insertion",         base: "KRNT Renton",                           role: "sar",       roleConfidence: "tentative", roleNote: "Guardian Two — likely SAR/SWAT" },
  { tail: "N71KP",  hex: "A97AA3", operator: "KCSO",         model: "Bell UH-1H Iroquois",            nickname: null,                roleDescription: "SAR / SWAT (reserve)",         base: "KRNT Renton",                           role: "sar",       roleConfidence: "tentative", roleNote: "KCSO reserve Huey" },
  { tail: "N67817", hex: null,     operator: "KCSO",         model: "Bell 206B / TH-67A Creek",       nickname: null,                roleDescription: "Patrol / training",            base: "KRNT Renton",                           role: "patrol",    roleConfidence: "tentative", roleNote: "KCSO Bell 206/TH-67" },
  { tail: "N67880", hex: "A8FCF9", operator: "KCSO",         model: "Bell 206B / TH-67A Creek",       nickname: null,                roleDescription: "Patrol / training",            base: "KRNT Renton",                           role: "patrol",    roleConfidence: "tentative", roleNote: "KCSO Bell 206/TH-67" },
  { tail: "N78906", hex: "AAB46C", operator: "KCSO",         model: "Bell 206B / TH-67A Creek",       nickname: null,                roleDescription: "Patrol / training",            base: "KRNT Renton",                           role: "patrol",    roleConfidence: "tentative", roleNote: "KCSO Bell 206/TH-67" },

  // Pierce County Sheriff — Puyallup
  { tail: "N9446P", hex: null,     operator: "Pierce SO",    model: "Cessna T206H Stationair (FLIR)", nickname: "Pierce One",        roleDescription: "Patrol / SAR / port security", base: "KPLU Thun Field, Puyallup",             role: "smokey",    roleConfidence: "tentative", roleNote: "Pierce One — Cessna FLIR" },

  // Snohomish County Sheriff
  { tail: "N815SC", hex: "AB1D82", operator: "Snohomish SO", model: "Bell UH-1H Iroquois Plus",       nickname: "SnoHawk 10",        roleDescription: "Mountain SAR / hoist / SWAT",  base: "Taylor's Landing",                      role: "sar",       roleConfidence: "tentative", roleNote: "SnoHawk 10 — likely SAR" },

  // Spokane County Sheriff — Felts Field
  { tail: "N509DV", hex: "A65BBE", operator: "Spokane SO",   model: "Bell 505 Jet Ranger X",          nickname: "Air 1",             roleDescription: "Patrol / SAR / fugitive apprehension", base: "KSFF Felts Field, Spokane",     role: "patrol",    roleConfidence: "tentative", roleNote: "Spokane SO — out-of-region" },
];

/**
 * Bump when seed shape changes — read by the admin migration route to
 * decide whether to re-merge seed values into the KV-stored registry.
 */
export const SEED_VERSION = 2;

export const SMOKY_TAIL = "N305DK";

/** Resolve a fleet entry's effective ICAO24 hex (lowercase). */
export function fleetHex(entry: FleetEntry): string {
  const seeded = entry.hex?.toLowerCase();
  if (seeded) return seeded;
  return (nNumberToIcao(entry.tail) ?? "").toLowerCase();
}
