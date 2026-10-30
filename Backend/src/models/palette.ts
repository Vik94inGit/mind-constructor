// The calm palette users pick soft colours from: a zone's colour
// (Node.zoneColor), a drawn picture's fill (Node.picture.color) and the map's
// background tint (Map.backgroundColor). Its own module so the Map model can
// use it without loading the Node model.
export const ZONE_PALETTE = ["sand", "sage", "sky", "lavender", "rose", "slate"] as const;
export type ZonePaletteColor = (typeof ZONE_PALETTE)[number];
