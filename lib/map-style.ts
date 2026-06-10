export const OPENFREEMAP_DEFAULT_STYLE_URL =
  "https://tiles.openfreemap.org/styles/positron";

export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || OPENFREEMAP_DEFAULT_STYLE_URL;

export const MAP_LABEL_FONT = ["Noto Sans Regular"];
