// Unified registry of every pixel map in the app.
//
// The Manhattan overworld and the new neighborhoods are produced by
// scripts/build-maps.mjs (lib/generated-maps.ts). The existing Columbia campus
// map is reused verbatim: its PNG and hit regions are untouched, they are only
// wrapped here so every map shares one rendering path.
import { campusBuildings } from "./campus-buildings";
import { generatedMaps, type MapRegion as GeneratedRegion } from "./generated-maps";

export type MapRegion = {
  name: string;
  points: string;
  key?: string;
  goto?: string;
  kind?: "district" | "place";
};

export type PixelMap = {
  id: string;
  label: string;
  width: number;
  height: number;
  image: string;
  regions: MapRegion[];
};

export const OVERWORLD_ID = "manhattan";

/** The map shown when the app or a picker opens without a known location. */
export const DEFAULT_MAP_ID = "columbia";

/** The Columbia map that already shipped, wrapped without modification. */
const columbia: PixelMap = {
  id: "columbia",
  label: "Morningside Heights",
  width: 1102,
  height: 1427,
  image: "/maps/morningside-pixel-v2.png",
  regions: campusBuildings.map(building => ({
    name: building.name,
    points: building.points,
    key: building.key,
    kind: "place",
  })),
};

function fromGenerated(map: (typeof generatedMaps)[number]): PixelMap {
  return {
    id: map.id,
    label: map.label,
    width: map.width,
    height: map.height,
    image: map.image,
    regions: map.regions as GeneratedRegion[],
  };
}

export const MAPS: PixelMap[] = [
  fromGenerated(generatedMaps.find(map => map.id === OVERWORLD_ID)!),
  ...generatedMaps.filter(map => map.id !== OVERWORLD_ID).map(fromGenerated),
  columbia,
];

const BY_ID = new Map(MAPS.map(map => [map.id, map]));

export function mapById(id: string): PixelMap {
  return BY_ID.get(id) ?? BY_ID.get(OVERWORLD_ID)!;
}

/** A post location is a leaf place on a local map. Overworld districts only
 *  navigate (or are decorative), they are not selectable locations. */
const isLocationRegion = (region: MapRegion) => !region.goto && region.kind !== "district";

export function isValidLocation(value: string): boolean {
  if (value === "") return true;
  return MAPS.some(map => map.regions.some(region => isLocationRegion(region) && region.name === value));
}

/** Every leaf location name across all maps (campus buildings included). */
export function locationNames(): string[] {
  return [...new Set(MAPS.flatMap(map => map.regions.filter(isLocationRegion).map(region => region.name)))]
    .sort((a, b) => a.localeCompare(b));
}

const LOCATION_MAP = new Map<string, string>();
for (const map of MAPS) {
  for (const region of map.regions) {
    if (isLocationRegion(region) && !LOCATION_MAP.has(region.name)) LOCATION_MAP.set(region.name, map.id);
  }
}

/** Which map a stored location name belongs to, so the picker can open in the
 *  right place even for posts created before the overworld existed. */
export function mapIdForLocation(name: string): string {
  return LOCATION_MAP.get(name) ?? DEFAULT_MAP_ID;
}
