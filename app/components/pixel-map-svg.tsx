"use client";

import type { MemoryPin } from "@/lib/memory-pin";
import type { KeyboardEvent } from "react";
import type { MapRegion, PixelMap } from "@/lib/maps";
import styles from "../page.module.css";

/** The shared pixel-art SVG: a nearest-neighbour scaled image with one hit
 *  polygon per region. Used by both the main map and the location picker so
 *  every map renders with the same crisp pixel density. Regions the current
 *  map cannot act on are still hoverable but not focusable or clickable. */
export default function PixelMapSvg({ map, selected, ariaLabel, onHover, onLeave, onActivate, pin, onPin, regionActionable = () => true }: {
  pin?: MemoryPin | null;
  onPin?: (x: number, y: number, location: string) => void;
  map: PixelMap;
  selected: string;
  ariaLabel: string;
  onHover: (name: string) => void;
  onLeave: () => void;
  onActivate: (region: MapRegion) => void;
  regionActionable?: (region: MapRegion) => boolean;
}) {
  return (
    <svg viewBox={`0 0 ${map.width} ${map.height}`} width={map.width} height={map.height} className={styles.mapArtwork} aria-label={ariaLabel} onClick={event => {
      if (!onPin) return;
      const matrix = event.currentTarget.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      const target = event.target as SVGElement;
      onPin(point.x, point.y, target.closest("polygon")?.getAttribute("data-location") || "Campus grounds");
    }}>
      <image href={map.image} width={map.width} height={map.height} />
      {map.regions.map(region => {
        const actionable = regionActionable(region);
        return (
          <polygon
            key={region.key ?? region.name}
            data-location={region.name}
            points={region.points}
            className={`${styles.buildingOutline}${actionable ? "" : ` ${styles.buildingStatic}`}`}
            tabIndex={actionable ? 0 : undefined}
            role={actionable ? "button" : undefined}
            aria-label={actionable ? `Select ${region.name}` : undefined}
            aria-pressed={actionable ? selected === region.name : undefined}
            onPointerEnter={() => onHover(region.name)}
            onPointerLeave={onLeave}
            onFocus={actionable ? () => onHover(region.name) : undefined}
            onBlur={actionable ? onLeave : undefined}
            onClick={actionable ? () => { if (!onPin) onActivate(region); } : undefined}
            onKeyDown={actionable ? (event: KeyboardEvent<SVGPolygonElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActivate(region);
              }
            } : undefined}
          >
            <title>{region.name}</title>
          </polygon>
        );
      })}
      {pin && pin.mapId === map.id && <g transform={`translate(${pin.x} ${pin.y})`} pointerEvents="none" aria-label="Memory pin">
        <path d="M0 0 L-12 -20 L-12 -38 L12 -38 L12 -20 Z" fill="#bd493b" stroke="#fff8dc" strokeWidth="4" />
        <rect x="-4" y="-31" width="8" height="8" fill="#fff8dc" />
      </g>}
    </svg>
  );
}
