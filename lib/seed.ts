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
  // Owner of record per FAA registry is State of Washington / Olympia, but
  // WSP operates this airframe — it's the all-weather IFR plane the WSP
  // aviation team flies on missions a Cessna 182/206 can't handle.
  { tail: "N207HB", hex: "A1ACB5", operator: "State of WA",  model: "Beechcraft B200 Super King Air", nickname: null,                roleDescription: "Transport / multi-mission (all-weather)", base: "KOLM Olympia (WSP-operated)",          role: "transport", roleConfidence: "tentative", roleNote: "WSP-flown all-weather King Air; owned by State of WA" },

  // King County Sheriff — Renton
  { tail: "N422CT", hex: "A50351", operator: "KCSO",         model: "Bell 407GXi",                    nickname: "Guardian One",       roleDescription: "Patrol / pursuit / SAR",       base: "KRNT Renton",                           role: "patrol",    roleConfidence: "confirmed", roleNote: "Guardian One — multi-role" },
  { tail: "N407KS", hex: "A4C794", operator: "KCSO",         model: "Bell 407",                        nickname: "Guardian One (legacy)", roleDescription: "Patrol / pursuit (backup)", base: "KRNT Renton",                       role: "patrol",    roleConfidence: "tentative", roleNote: "Guardian One legacy airframe" },
  { tail: "N790RJ", hex: "AAB985", operator: "KCSO",         model: "Bell UH-1H Iroquois",            nickname: "Guardian Two",       roleDescription: "SAR / SWAT insertion",         base: "KRNT Renton",                           role: "sar",       roleConfidence: "tentative", roleNote: "Guardian Two — likely SAR/SWAT" },
  { tail: "N71KP",  hex: "A97AA3", operator: "KCSO",         model: "Bell UH-1H Iroquois",            nickname: null,                roleDescription: "SAR / SWAT (reserve)",         base: "KRNT Renton",                           role: "sar",       roleConfidence: "tentative", roleNote: "KCSO reserve Huey" },
  { tail: "N67817", hex: null,     operator: "KCSO",         model: "Bell 206B / TH-67A Creek",       nickname: null,                roleDescription: "Patrol / training",            base: "KRNT Renton",                           role: "patrol",    roleConfidence: "tentative", roleNote: "KCSO Bell 206/TH-67" },
  { tail: "N67880", hex: "A8FCF9", operator: "KCSO",         model: "Bell 206B / TH-67A Creek",       nickname: null,                roleDescription: "Patrol / training",            base: "KRNT Renton",                           role: "patrol",    roleConfidence: "tentative", roleNote: "KCSO Bell 206/TH-67" },
  { tail: "N78906", hex: "AAB46C", operator: "KCSO",         model: "Bell 206B / TH-67A Creek",       nickname: null,                roleDescription: "Patrol / training",            base: "KRNT Renton",                           role: "patrol",    roleConfidence: "tentative", roleNote: "KCSO Bell 206/TH-67" },

  // Pierce County Sheriff — Puyallup
  // Pierce One is a 2012 Cessna T206H, FAA-registered to Pierce County
  // Sheriff's Department, equipped with FLIR + downlink. Acquired via DHS
  // grant in cooperation with the Port of Tacoma. Pierce Two (older
  // Cessna 206 from 1980s drug seizure) operates as backup but no
  // confirmed tail number publicly — omitted here.
  { tail: "N9446P", hex: null,     operator: "Pierce SO",    model: "Cessna T206H Stationair (FLIR)", nickname: "Pierce One",        roleDescription: "Patrol / SAR / port security", base: "KPLU Thun Field, Puyallup",             role: "smokey",    roleConfidence: "confirmed", roleNote: "Pierce One — Cessna T206H FLIR (2012)" },

  // Snohomish County Sheriff
  { tail: "N815SC", hex: "AB1D82", operator: "Snohomish SO", model: "Bell UH-1H Iroquois Plus",       nickname: "SnoHawk 10",        roleDescription: "Mountain SAR / hoist / SWAT",  base: "Taylor's Landing",                      role: "sar",       roleConfidence: "tentative", roleNote: "SnoHawk 10 — likely SAR" },

  // Spokane County Sheriff — Felts Field
  // SRASU historical fleet: two Bell OH-58s (Air 1 / Air 2, ex-Army
  // surplus 2005) + one Bell UH-1H Super Huey (Rescue 3). N509DV is the
  // Bell 505 added in 2024 (BJA grant 15PBJA-23-GG-00183-BRND); likely
  // assumed the Air 1 designation. OH-58 / UH-1H tails not publicly
  // confirmed — omitted to avoid mis-labeling.
  { tail: "N509DV", hex: "A65BBE", operator: "Spokane SO",   model: "Bell 505 Jet Ranger X",          nickname: "Air 1",             roleDescription: "Patrol / SAR / fugitive apprehension", base: "KSFF Felts Field, Spokane",     role: "patrol",    roleConfidence: "tentative", roleNote: "Spokane SO Bell 505 — likely Air 1 since 2024" },

  // CBP Air and Marine Operations — Bellingham Air and Marine Branch
  // (BAMB), KBLI. Tails + TROY callsigns from RadioReference Wiki. AS350
  // helicopters do interagency support with WCSO + state agencies; the
  // B300C MEA is a fixed-wing Multi-Enforcement Aircraft for surveillance.
  // All four classified as patrol — federal LE under the Smokey umbrella.
  { tail: "N1977G", hex: null,     operator: "CBP",          model: "Airbus AS350 / H125",            nickname: "TROY 188",          roleDescription: "Federal patrol / interdiction (helicopter)", base: "KBLI Bellingham AMB",            role: "patrol",    roleConfidence: "confirmed", roleNote: "CBP AMO Bellingham AS350 (TROY 188)" },
  { tail: "N2108J", hex: null,     operator: "CBP",          model: "Airbus AS350 / H125",            nickname: "TROY 169",          roleDescription: "Federal patrol / interdiction (helicopter)", base: "KBLI Bellingham AMB",            role: "patrol",    roleConfidence: "confirmed", roleNote: "CBP AMO Bellingham AS350 (TROY 169)" },
  { tail: "N741C",  hex: null,     operator: "CBP",          model: "Airbus AS350 / H125",            nickname: "TROY 170",          roleDescription: "Federal patrol / interdiction (helicopter)", base: "KBLI Bellingham AMB",            role: "patrol",    roleConfidence: "confirmed", roleNote: "CBP AMO Bellingham AS350 (TROY 170)" },
  { tail: "N128J",  hex: null,     operator: "CBP",          model: "Beechcraft B300C MEA",           nickname: "TROY 301",          roleDescription: "Federal multi-enforcement aircraft (fixed-wing)", base: "KBLI Bellingham AMB",        role: "patrol",    roleConfidence: "confirmed", roleNote: "CBP AMO Bellingham B300C surveillance (TROY 301)" },

  // US Coast Guard — Air Station Port Angeles, KCLM
  // Non-FAA registered (military serial); hex is authoritative. Air Station
  // Port Angeles operates three MH-65E Dolphins per the 2021 transition
  // delivery; CGNR 6594 is the only one with a publicly documented
  // mode-S hex. Other airframes intentionally omitted until confirmed.
  // Role = sar (clear-tier) — USCG missions are search & rescue, not
  // enforcement against motorists.
  { tail: "CGNR6594", hex: "AE26B4", operator: "USCG",       model: "Eurocopter MH-65E Dolphin",      nickname: "Dolphin 6594",      roleDescription: "Maritime search and rescue",   base: "KCLM Port Angeles",                     role: "sar",       roleConfidence: "confirmed", roleNote: "CGAS Port Angeles MH-65E (Jan 2021 delivery)" },
];

/**
 * Bump when seed shape changes — read by the admin migration route to
 * decide whether to re-merge seed values into the KV-stored registry.
 *
 * v3 (2026-05-07): Statewide expansion — adds 4 CBP/AMO Bellingham
 * entries (N1977G, N2108J, N741C, N128J) and 1 USCG Air Station Port
 * Angeles entry (CGNR6594, MH-65E). Pierce One confidence promoted to
 * confirmed. WSP King Air operator note clarified.
 */
export const SEED_VERSION = 3;

export const SMOKY_TAIL = "N305DK";

/** Resolve a fleet entry's effective ICAO24 hex (lowercase). */
export function fleetHex(entry: FleetEntry): string {
  const seeded = entry.hex?.toLowerCase();
  if (seeded) return seeded;
  return (nNumberToIcao(entry.tail) ?? "").toLowerCase();
}
