"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import LocationPosts from "./location-posts";
import PostComposer, { type MemeImage } from "./post-composer";
import styles from "../page.module.css";

import { campusBuildings as buildings } from "@/lib/campus-buildings";

type Point = { x: number; y: number };

export default function CampusMap({ children, signedIn, images }: { children: ReactNode; signedIn: boolean; images: MemeImage[] }) {
  const [paper, setPaper] = useState(true);
  const [locationPanel, setLocationPanel] = useState("");
  const [composerVersion, setComposerVersion] = useState(0);
  const [settings, setSettings] = useState(false);
  const [selected, setSelected] = useState("");
  const [hovered, setHovered] = useState("");
  const [pickingLocation, setPickingLocation] = useState(false);
  const previousLocation = useRef("");
  const [postLocation, setPostLocation] = useState("");
  const [view, setView] = useState({ x: 0, y: 0, scale: 1.8 });
  const viewport = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const moved = useRef(false);
  const origin = useRef<Point | null>(null);
  const composer = useRef<HTMLDialogElement>(null);
  const resetCampusView = useCallback(() => {
    const bounds = viewport.current?.getBoundingClientRect();
    if (!bounds) return;
    const mapWidth = Math.min(bounds.width, bounds.height * .7722);
    // Frame the central campus in the redrawn, upright-building map.
    setView({ x: 0, y: mapWidth * (79 / 1102) * 1.8, scale: 1.8 });
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(resetCampusView);
    return () => cancelAnimationFrame(frame);
  }, [resetCampusView]);

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
    setSelected(name);
    if (pickingLocation) {
      setPostLocation(name);
      setPickingLocation(false);
      composer.current?.showModal();
    } else {
      setHovered(""); setLocationPanel(name); setPaper(true);
    }
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
    <div ref={viewport} className={styles.mapViewport} aria-label="Interactive campus map"
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
      <div className={styles.mapPlane} style={{ transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        <svg viewBox="0 0 1102 1427" className={styles.mapArtwork} aria-label="Columbia campus buildings">
          <image href="/maps/morningside-pixel-v2.png" width="1102" height="1427" />
          {buildings.map(building => <polygon key={building.name} points={building.points} className={styles.buildingOutline} data-selected={selected === building.name} tabIndex={0} role="button" aria-label={`Select ${building.name}`} aria-pressed={selected === building.name}
            onPointerEnter={() => setHovered(building.name)} onPointerLeave={() => setHovered("")}
            onFocus={() => setHovered(building.name)} onBlur={() => setHovered("")}
            onClick={() => { if (!moved.current) chooseLocation(building.name); }}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setPaper(false); chooseLocation(building.name); } }}><title>{building.name}</title></polygon>)}
        </svg>
      </div>
    </div>
    {(hovered || pickingLocation) && <div className={styles.locationHint} role="status">{hovered || "Select a building"}</div>}
    {pickingLocation && <div className={styles.locationPickerBar}>
      <label>Drop to a location<select value="" onChange={event => { if (event.target.value) chooseLocation(event.target.value); }}>
        <option value="">Select on the map or choose a building</option>
        {[...buildings].sort((a,b) => a.name.localeCompare(b.name)).map(building => <option key={building.name}>{building.name}</option>)}
      </select></label>
      <button type="button" onClick={cancelLocation}>Cancel</button>
    </div>}
    {paper && <div className={styles.paperOverlay}>
      <button type="button" className={styles.paperClose} aria-label={locationPanel ? "Close location posts" : "Close trending"} onClick={() => setPaper(false)}>×</button>
      {locationPanel ? <LocationPosts key={locationPanel} location={locationPanel} onCreate={() => {
        setPostLocation(locationPanel); setComposerVersion(value => value + 1); composer.current?.showModal();
      }} /> : children}
    </div>}
    <div className={styles.mapControls} aria-label="Map controls">
      <button type="button" aria-label="Map settings" aria-expanded={settings} aria-controls="map-settings" onClick={() => setSettings(value => !value)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 2h6v3l2 1 3-1 2 5-3 2v2l2 2-3 5-3-2-2 1v2H9v-3l-2-1-3 1-2-5 3-2v-2L3 8l3-5 3 2z"/><path d="M9 9h6v6H9z"/></svg>
      </button>
      <button disabled={pickingLocation} onClick={() => { setLocationPanel(""); setPaper(value => locationPanel ? true : !value); }} aria-expanded={paper && !locationPanel}>trending</button>
      {settings && <div id="map-settings" className={styles.mapSettings} onKeyDown={event => { if (event.key === "Escape") setSettings(false); }}>
      <strong>Map settings</strong>
      <div className={styles.settingsActions}>
      <button aria-label="Zoom in" onClick={() => { const r = viewport.current!.getBoundingClientRect(); const p = { x: r.width / 2, y: r.height / 2 }; transform(p, p, 1.25); }}>+</button>
      <button aria-label="Zoom out" onClick={() => { const r = viewport.current!.getBoundingClientRect(); const p = { x: r.width / 2, y: r.height / 2 }; transform(p, p, .8); }}>−</button>
      <button onClick={resetCampusView}>Reset</button>
      </div>
      </div>}
    </div>
    <div className={styles.newPostDock} hidden={pickingLocation}>
      {selected && <span className={styles.placeLabel}>{selected}</span>}
      <button className={styles.newPostButton} onClick={openComposer} aria-label="Create a new post">
        <svg width="44" height="40" viewBox="0 0 44 40" aria-hidden="true" shapeRendering="crispEdges"><path fill="#c6c8a9" stroke="#303c2b" strokeWidth="3" d="M3 3h28v30H3z"/><path fill="#f5efdb" stroke="#303c2b" strokeWidth="3" d="M11 9h29v28H11z"/><path stroke="#303c2b" strokeWidth="3" d="M17 16h17M17 22h17M17 28h10"/></svg>
        <span>+new</span>
      </button>
    </div>
    <dialog ref={composer} className={styles.composeDialog}>
      <button type="button" className={styles.composeClose} aria-label="Close new post" onClick={() => composer.current?.close()}>×</button>
      <h2>new post</h2>
      {!signedIn ? <Link href="/login" className={styles.authButton}>Sign in to create</Link> : <PostComposer key={composerVersion} images={images} location={postLocation} onPickLocation={() => {
        previousLocation.current = selected;
        setPickingLocation(true); setPaper(false); setSettings(false);
        composer.current?.close();
        requestAnimationFrame(() => { const first = viewport.current?.querySelector<SVGPolygonElement>("polygon"); first?.focus({ preventScroll: true }); });
      }} onClearLocation={() => setPostLocation("")} onPublished={() => { composer.current?.close(); setPostLocation(""); setLocationPanel(""); setPaper(true); }} />}
    </dialog>
  </>;
}
