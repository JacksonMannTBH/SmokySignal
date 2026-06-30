export const APP_STATES = [
  {
    id: "washington",
    label: "Washington",
    regions: [
      ["wa_puget_sound", "Puget Sound", "98057", "Renton", 47.4829, -122.2171, 8],
      ["wa_olympic", "Olympic Peninsula", "98331", "Forks", 47.9504, -124.3855, 8],
      ["wa_sw", "Southwest WA", "98611", "Castle Rock", 46.2754, -122.9076, 8],
      ["wa_central", "Central WA", "98926", "Ellensburg", 46.9965, -120.5478, 7],
      ["wa_east", "Eastern WA", "99201", "Spokane", 47.6588, -117.426, 7],
    ],
  },
  {
    id: "california",
    label: "California",
    regions: [
      ["ca_north_bay_area", "Bay Area", "94545", "Hayward", 37.6328, -122.0808, 8],
      ["ca_north_sacramento_valley", "Sacramento Valley", "95814", "Sacramento", 38.5816, -121.4944, 8],
      ["ca_north_coast", "North Coast", "95482", "Ukiah", 39.1502, -123.2078, 8],
      ["ca_north_sierra_tahoe", "Sierra / Tahoe", "96150", "South Lake Tahoe", 38.9332, -119.9843, 8],
      ["ca_north_central_valley", "Central Valley North", "95340", "Merced", 37.3022, -120.4829, 8],
      ["ca_north_far_north", "Far Northern CA", "96001", "Redding", 40.5865, -122.3917, 8],
      ["ca_south_los_angeles", "Los Angeles", "90012", "Los Angeles", 34.0657, -118.2437, 8],
      ["ca_south_orange_county", "Orange County", "92701", "Santa Ana", 33.7455, -117.8677, 8],
      ["ca_south_inland_empire", "Inland Empire", "92501", "Riverside", 33.9806, -117.3755, 8],
      ["ca_south_san_diego", "San Diego", "92101", "San Diego", 32.7157, -117.1611, 8],
      ["ca_south_central_coast", "Central Coast", "93401", "San Luis Obispo", 35.2828, -120.6596, 8],
      ["ca_south_desert_imperial", "Desert / Imperial", "92201", "Indio", 33.7206, -116.2156, 8],
    ],
  },
  {
    id: "texas",
    label: "Texas",
    regions: [
      ["tx_dfw", "North Texas / DFW", "76010", "Arlington", 32.7357, -97.1081, 7],
      ["tx_east", "East Texas", "75702", "Tyler", 32.3513, -95.3011, 8],
      ["tx_austin", "Central Texas / Austin", "78701", "Austin", 30.2711, -97.7437, 8],
      ["tx_san_antonio", "San Antonio / Hill Country", "78205", "San Antonio", 29.4241, -98.4936, 8],
      ["tx_houston", "Houston / Gulf Coast", "77002", "Houston", 29.7604, -95.3698, 8],
      ["tx_rio_grande", "South Texas / Rio Grande Valley", "78501", "McAllen", 26.2034, -98.23, 8],
      ["tx_west", "West Texas", "79735", "Fort Stockton", 30.894, -102.8793, 7],
      ["tx_panhandle", "Panhandle", "79101", "Amarillo", 35.222, -101.8313, 7],
    ],
  },
  {
    id: "florida",
    label: "Florida",
    regions: [
      ["fl_panhandle", "Panhandle", "32401", "Panama City", 30.1588, -85.6602, 8],
      ["fl_north", "North Florida", "32601", "Gainesville", 29.6516, -82.3248, 8],
      ["fl_orlando", "Central Florida / Orlando", "32801", "Orlando", 28.5421, -81.379, 8],
      ["fl_tampa_bay", "Tampa Bay / Gulf Coast", "33602", "Tampa", 27.9506, -82.4572, 8],
      ["fl_miami", "South Florida / Miami", "33131", "Miami", 25.7617, -80.1918, 8],
      ["fl_southwest", "Southwest Florida", "33901", "Fort Myers", 26.6406, -81.8723, 8],
    ],
  },
  {
    id: "ohio",
    label: "Ohio",
    regions: [
      ["oh_northwest", "Northwest Ohio", "43604", "Toledo", 41.6528, -83.5379, 8],
      ["oh_cleveland", "Northeast Ohio / Cleveland", "44114", "Cleveland", 41.4993, -81.6944, 8],
      ["oh_columbus", "Central Ohio / Columbus", "43215", "Columbus", 39.9612, -82.9988, 8],
      ["oh_cincinnati", "Southwest Ohio / Cincinnati", "45202", "Cincinnati", 39.1031, -84.512, 8],
      ["oh_southeast", "Southeast Ohio / Appalachia", "45701", "Athens", 39.3292, -82.1013, 8],
    ],
  },
  {
    id: "colorado",
    label: "Colorado",
    regions: [
      ["co_front_range_north", "Front Range North", "80524", "Fort Collins", 40.5853, -105.0844, 8],
      ["co_denver", "Denver Metro", "80202", "Denver", 39.7392, -104.9903, 8],
      ["co_front_range_south", "Front Range South", "80903", "Colorado Springs", 38.8339, -104.8214, 8],
      ["co_western_slope", "Western Slope", "81501", "Grand Junction", 39.0639, -108.5506, 8],
      ["co_mountains", "Mountain / High Country", "80424", "Breckenridge", 39.4817, -106.0384, 8],
    ],
  },
] as const;

type StateTuple = (typeof APP_STATES)[number];
type RegionTuple = StateTuple["regions"][number];

export type AppStateId = StateTuple["id"];
export type AppRegionId = RegionTuple[0];

export type AppRegion = {
  id: AppRegionId;
  stateId: AppStateId;
  stateLabel: string;
  label: string;
  zip: string;
  city: string;
  centerLat: number;
  centerLon: number;
  zoomLevel: number;
};

export const APP_REGIONS = APP_STATES.flatMap((state) =>
  state.regions.map(
    (r): AppRegion => ({
      id: r[0],
      stateId: state.id,
      stateLabel: state.label,
      label: r[1],
      zip: r[2],
      city: r[3],
      centerLat: r[4],
      centerLon: r[5],
      zoomLevel: r[6],
    }),
  ),
);

export const APP_REGIONS_BY_ID = Object.fromEntries(
  APP_REGIONS.map((region) => [region.id, region]),
) as Record<AppRegionId, AppRegion>;

export const DEFAULT_APP_STATE_ID: AppStateId = "washington";
export const DEFAULT_APP_REGION_ID: AppRegionId = "wa_puget_sound";

export function getAppRegion(id: string | null | undefined): AppRegion {
  return id && id in APP_REGIONS_BY_ID
    ? APP_REGIONS_BY_ID[id as AppRegionId]
    : APP_REGIONS_BY_ID[DEFAULT_APP_REGION_ID];
}

export function getAppState(id: string | null | undefined): StateTuple {
  return (
    APP_STATES.find((state) => state.id === id) ??
    APP_STATES.find((state) => state.id === DEFAULT_APP_STATE_ID)!
  );
}

export function stateForRegion(id: string | null | undefined): StateTuple {
  return getAppState(getAppRegion(id).stateId);
}

export function firstRegionForState(stateId: AppStateId): AppRegion {
  const state = getAppState(stateId);
  return APP_REGIONS_BY_ID[state.regions[0][0]];
}
