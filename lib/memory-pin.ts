export type MemoryPin = { mapId: "columbia"; x: number; y: number; location: string };
// Coordinates use the map's original SVG viewBox, independent of zoom or screen size.
export function validMemoryPin(value: unknown): value is MemoryPin {
  if (!value || typeof value !== "object") return false;
  const pin = value as MemoryPin;
  return pin.mapId === "columbia" && Number.isFinite(pin.x) && Number.isFinite(pin.y)
    && pin.x >= 0 && pin.x <= 1102 && pin.y >= 0 && pin.y <= 1427
    && typeof pin.location === "string" && pin.location.length <= 100;
}
