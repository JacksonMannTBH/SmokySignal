import {
  APP_REGIONS,
  APP_REGIONS_BY_ID,
  DEFAULT_APP_REGION_ID,
  type AppStateId,
  type AppRegionId,
} from "./app-regions";

export type RegionId = AppRegionId;

export type RegionBbox = {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
} | null;

export type Region = {
  id: RegionId;
  label: string;
  stateLabel: string;
  zip: string;
  city: string;
  centerLat: number;
  centerLon: number;
  zoomLevel: number;
  searchNm: number;
  bbox: RegionBbox;
};

export const DEFAULT_REGION: RegionId = DEFAULT_APP_REGION_ID;

export const REGIONS = Object.fromEntries(
  APP_REGIONS.map((region) => [
    region.id,
    {
      ...region,
      searchNm: 250,
      bbox: bboxAround(region.centerLat, region.centerLon),
    },
  ]),
) as unknown as Record<RegionId, Region>;

export function isRegionId(value: string | null | undefined): value is RegionId {
  return Boolean(value && value in APP_REGIONS_BY_ID);
}

export function stateIdForRegion(
  value: RegionId | string | null | undefined,
): AppStateId {
  if (isRegionId(value)) return APP_REGIONS_BY_ID[value].stateId;
  return APP_REGIONS_BY_ID[DEFAULT_REGION].stateId;
}

export function regionForPoint(lat: number, lon: number): RegionId | null {
  let nearest: { id: RegionId; d2: number } | null = null;
  for (const region of Object.values(REGIONS)) {
    const dlat = lat - region.centerLat;
    const dlon = lon - region.centerLon;
    const d2 = dlat * dlat + dlon * dlon;
    if (!nearest || d2 < nearest.d2) nearest = { id: region.id, d2 };
  }
  return nearest?.id ?? null;
}

function bboxAround(lat: number, lon: number): RegionBbox {
  return {
    latMin: lat - 1.35,
    latMax: lat + 1.35,
    lonMin: lon - 1.65,
    lonMax: lon + 1.65,
  };
}
