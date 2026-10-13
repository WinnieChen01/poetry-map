"use client";

import { useState } from "react";
import { DEFAULT_MAP_ID, mapById, type MapRegion } from "@/lib/maps";
import PixelMapSvg from "./pixel-map-svg";
import styles from "../page.module.css";

/** Reuse the Columbia artwork for editing existing location labels. */
export default function LocationPicker({ value, onSelect }: { value: string; onSelect: (location: string) => void }) {
  const [hovered, setHovered] = useState("");
  const map = mapById(DEFAULT_MAP_ID);
  function activate(region: MapRegion) {
    onSelect(region.name);
  }
  return <div className={styles.locationPickerMap}>
    <PixelMapSvg map={map} selected={value} ariaLabel="Location picker map"
      onHover={setHovered} onLeave={() => setHovered("")} onActivate={activate} />
    <div className={styles.locationPickerHint} role="status">{hovered || value || "Tap a place"}</div>
  </div>;
}
