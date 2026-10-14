"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { MemoryPin } from "@/lib/memory-pin";
import LocationPosts from "./location-posts";
import PostComposer, { type MemeImage } from "./post-composer";
import PixelMapSvg from "./pixel-map-svg";
import styles from "../page.module.css";

import { DEFAULT_MAP_ID, OVERWORLD_ID, mapById, type MapRegion } from "@/lib/maps";

type Point = { x: number; y: number };

export default function CampusMap({ children, signedIn, images }: { children: ReactNode; signedIn: boolean; images: MemeImage[] }) {
  const [paper, setPaper] = useState(true);
  const [locationPanel, setLocationPanel] = useState("");
  const [composerVersion, setComposerVersion] = useState(0);
  const [selected, setSelected] = useState("");
  const [hovered, setHovered] = useState("");
  const [pickingLocation, setPickingLocation] = useState(false);
  const [mapId, setMapId] = useState<string>(DEFAULT_MAP_ID);
  const previousLocation = useRef("");
  const [pin, setPin] = useState<MemoryPin | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const viewport = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const moved = useRef(false);
  const origin = useRef<Point | null>(null);
  const composer = useRef<HTMLDialogElement>(null);

  const map = mapById(mapId);
  // Multiple lawn polygons share one location; list it only once in the picker.
  const names = [...new Set(map.regions.filter(region => !region.goto).map(region => region.name))];

  const resetMapView = useCallback(() => {
    const bounds = viewport.current?.getBoundingClientRect();
    if (!bounds) return;
    if (mapId === OVERWORLD_ID) {
      // Open the whole island centered: every district visible, zoom in to explore.
      setView({ x: 0, y: 0, scale: 1 });
      return;
    }
    const mapWidth = Math.min(bounds.width, bounds.height * (1102 / 1427));
    setView({ x: 0, y: mapWidth * (79 / 1102) * 1.8, scale: 1.8 });
  }, [mapId]);

  useEffect(() => {
    const frame = requestAnimationFrame(resetMapView);
    return () => cancelAnimationFrame(frame);
  }, [resetMapView]);

  const transform = useCallback((from: Point, to: Point, factor: number) => {
    const bounds = viewport.current?.getBoundingClientRect();
    if (!bounds) return;
    setView(current => {
      const scale = Math.max(1, Math.min(4, current.scale * factor));
      const ratio = scale / current.scale;
      const x = to.x - bounds.width / 2 - (from.x - bounds.width / 2 - current.x) * ratio;
      const y = to.y - bounds.height / 2 - (from.y - bounds.height / 2 - current.y) * ratio;
      if (scale === 1) return { scale, x: 0, y: 0 };
      return { scale, x: Math.max(-bounds.width * scale / 2, Math.min(bounds.width * scale / 2, x)), y: Math.max(-bounds.height * scale / 2, Math.min(bounds.height * scale / 2, y)) };
    });
  }, []);
  useEffect(() => {
    const element = viewport.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      transform(point, point, Math.exp(-event.deltaY * .003));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [transform]);

  function chooseLocation(name: string) {
    const region = map.regions.find(entry => entry.name === name);
    // Districts navigate to a local map; only leaf places can hold a pin.
    if (!region || region.goto) return;
    setSelected(name);
    if (pickingLocation) {
      const points = region.points.trim().split(/\s+/).map(pair => pair.split(",").map(Number));
      setPin({ mapId: "columbia", location: name, x: points.reduce((sum, p) => sum + p[0], 0) / points.length, y: points.reduce((sum, p) => sum + p[1], 0) / points.length });
      setPickingLocation(false); setHovered("");
      composer.current?.showModal();
    } else {
      setHovered(""); setLocationPanel(name); setPaper(true);
    }
  }
  function activateRegion(region: MapRegion) {
    if (moved.current) return;
    if (region.goto) {
      // Only Columbia has a detailed map so far; the island is an overview.
      if (region.goto === "columbia") { setMapId("columbia"); setSelected(""); setHovered(""); }
      return;
    }
    chooseLocation(region.name);
  }
  function cancelLocation() {
    setSelected(previousLocation.current);
    setPickingLocation(false);
    composer.current?.showModal();
  }
  function openComposer() {
    composer.current?.showModal();
  }
  return <>
    <div ref={viewport} className={styles.mapViewport}
      style={map.id === OVERWORLD_ID ? { background: "#458cd3 url('/maps/pixel-water.svg') repeat top left / 144px 144px" } : undefined}
      aria-label={`Interactive map of ${map.label}`}
      onKeyDown={event => { if (event.key === "Escape" && pickingLocation) { event.preventDefault(); cancelLocation(); } }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        setPaper(false);
        moved.current = false;
        origin.current = { x: event.clientX, y: event.clientY };
        pointers.current.set(event.pointerId, origin.current);
      }}
      onPointerMove={event => {
        if (!pointers.current.has(event.pointerId)) return;
        if (origin.current && Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 5) {
          moved.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        const before = [...pointers.current.values()].slice(0, 2);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const after = [...pointers.current.values()].slice(0, 2);
        const middle = (p: Point[]) => p.length === 1 ? p[0] : { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
        const distance = (p: Point[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        transform(middle(before), middle(after), before.length === 2 ? distance(after) / Math.max(1, distance(before)) : 1);
      }}
      onPointerLeave={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) pointers.current.delete(event.pointerId); }}
      onPointerUp={event => pointers.current.delete(event.pointerId)}
      onPointerCancel={event => pointers.current.delete(event.pointerId)}
      onLostPointerCapture={event => pointers.current.delete(event.pointerId)}>
      <div className={styles.mapPlane} style={{ width: `min(100vw, ${(map.width / map.height * 100).toFixed(3)}vh)`, transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        <PixelMapSvg map={map} selected={selected} ariaLabel={`${map.label} pixel map`}
          pin={pin} onPin={pickingLocation && map.id === "columbia" ? (x, y, location) => {
            if (moved.current || x < 0 || y < 0 || x > map.width || y > map.height) return;
            setPin({ mapId: "columbia", x, y, location });
            setSelected(location); setHovered(""); setPickingLocation(false); composer.current?.showModal();
          } : undefined}
          regionActionable={region => map.id !== OVERWORLD_ID || region.goto === "columbia"}
          onHover={setHovered} onLeave={() => setHovered("")} onActivate={activateRegion} />
      </div>
    </div>
    {!paper && (hovered || pickingLocation) && <div className={styles.locationHint} role="status">{hovered || (map.id === OVERWORLD_ID ? "Tap Columbia to open its detailed map" : `Tap the ${map.label} map to drop a pin`)}</div>}
    {pickingLocation && <div className={styles.locationPickerBar}>
      {map.id === OVERWORLD_ID
        ? <span>Tap the green Columbia area to open its detailed map, then drop the pin.</span>
        : <label>Or choose a building<select value="" onChange={event => { if (event.target.value) chooseLocation(event.target.value); }}>
            <option value="">{`Select a place in ${map.label}`}</option>
            {names.map(name => <option key={name}>{name}</option>)}
          </select></label>}
      <button type="button" onClick={cancelLocation}>Cancel</button>
    </div>}
    {paper && <div className={styles.paperOverlay}>
      <button type="button" className={styles.paperClose} aria-label={locationPanel ? "Close location posts" : "Close trending"} onClick={() => setPaper(false)}>×</button>
      {locationPanel ? <LocationPosts key={locationPanel} location={locationPanel} onCreate={() => {
        setPin(null); setComposerVersion(value => value + 1); composer.current?.showModal();
      }} /> : children}
    </div>}
    <div className={styles.mapControls} aria-label="Map controls">
      {map.id === OVERWORLD_ID
        ? <button type="button" onClick={() => setMapId(DEFAULT_MAP_ID)}>← columbia</button>
        : <button type="button" onClick={() => { setMapId(OVERWORLD_ID); setPaper(false); setLocationPanel(""); }}>island</button>}
      <button disabled={pickingLocation} onClick={() => { setLocationPanel(""); setPaper(value => locationPanel ? true : !value); }} aria-expanded={paper && !locationPanel}>trending</button>

    </div>
    <div className={styles.newPostDock} hidden={pickingLocation}>
      <button className={styles.newPostButton} onClick={openComposer} aria-label="Create a new post">
        <svg width="44" height="40" viewBox="0 0 44 40" aria-hidden="true" shapeRendering="crispEdges"><path fill="#c6c8a9" stroke="#303c2b" strokeWidth="3" d="M3 3h28v30H3z"/><path fill="#f5efdb" stroke="#303c2b" strokeWidth="3" d="M11 9h29v28H11z"/><path stroke="#303c2b" strokeWidth="3" d="M17 16h17M17 22h17M17 28h10"/></svg>
        <span>+new</span>
      </button>
    </div>
    <dialog ref={composer} className={styles.composeDialog}>
      <button type="button" className={styles.composeClose} aria-label="Close new post" onClick={() => composer.current?.close()}>×</button>
      <h2>new memory</h2>
      {!signedIn ? <Link href="/login" className={styles.authButton}>Sign in to create</Link> : <PostComposer key={composerVersion} images={images} pin={pin} onPickLocation={() => {
        previousLocation.current = selected;
        setPickingLocation(true); setPaper(false);
        composer.current?.close();
        requestAnimationFrame(() => { const first = viewport.current?.querySelector<SVGPolygonElement>("polygon"); first?.focus({ preventScroll: true }); });
      }} onPublished={() => { composer.current?.close(); setHovered(""); setSelected(""); setPin(null); setLocationPanel(""); setPaper(true); }} />}
    </dialog>
  </>;
}
