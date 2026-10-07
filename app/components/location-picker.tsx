"use client";

import { useState } from "react";
import { campusBuildings as buildings } from "@/lib/campus-buildings";
import styles from "../page.module.css";

/** The pixel campus map, narrowed to picking a single building. Hovering a
 *  building shows its name and a white contour, matching the compose map. */
export default function LocationPicker({ value, onSelect }: { value: string; onSelect: (location: string) => void }) {
  const [hovered, setHovered] = useState("");
  return <div className={styles.locationPickerMap}>
    <svg viewBox="0 0 1102 1427" className={styles.mapArtwork} aria-label="Columbia campus buildings">
      <image href="/maps/morningside-pixel-v2.png" width="1102" height="1427" />
      {buildings.map(building => <polygon key={building.key ?? building.name} points={building.points} className={styles.buildingOutline} tabIndex={0} role="button" aria-label={`Choose ${building.name}`} aria-pressed={value === building.name}
        onPointerEnter={() => setHovered(building.name)} onPointerLeave={() => setHovered("")}
        onFocus={() => setHovered(building.name)} onBlur={() => setHovered("")}
        onClick={() => onSelect(building.name)}
        onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(building.name); } }}><title>{building.name}</title></polygon>)}
    </svg>
    <div className={styles.locationPickerHint} role="status">{hovered || value || "Tap a building"}</div>
  </div>;
}
