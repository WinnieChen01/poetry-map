"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "../page.module.css";

type Point = { x: number; y: number };
export default function PhotoCropper({ source, onApply, onCancel }: {
  source: string; onApply: (file: File) => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const points = useRef(new Map<number, Point>());
  const crop = useRef({ zoom: 1, x: 0, y: 0 });
  const locked = useRef(false);
  const mounted = useRef(false);
  const outsidePress = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const draw = useCallback(() => {
    const img = image.current;
    const context = canvas.current?.getContext("2d");
    if (!img || !context) return;
    const side = Math.min(img.naturalWidth, img.naturalHeight) / crop.current.zoom;
    crop.current.x = Math.max(0, Math.min(img.naturalWidth - side, crop.current.x));
    crop.current.y = Math.max(0, Math.min(img.naturalHeight - side, crop.current.y));
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 512, 512);
    const scale = 384 / side;
    context.drawImage(img, 64 - crop.current.x * scale, 64 - crop.current.y * scale, img.naturalWidth * scale, img.naturalHeight * scale);
    context.beginPath();
    context.rect(0, 0, 512, 512);
    context.arc(256, 256, 192, 0, Math.PI * 2);
    context.fillStyle = "rgba(10, 15, 10, .4)";
    context.fill("evenodd");
    context.beginPath();
    context.arc(256, 256, 192, 0, Math.PI * 2);
    context.strokeStyle = "rgba(255,255,255,.9)";
    context.lineWidth = 2;
    context.stroke();
  }, []);

  const transform = useCallback((from: Point, to: Point, factor: number) => {
    const img = image.current;
    const bounds = canvas.current?.getBoundingClientRect();
    if (!img || !bounds || !bounds.width || locked.current || !Number.isFinite(factor)) return;
    const oldSide = Math.min(img.naturalWidth, img.naturalHeight) / crop.current.zoom;
    const zoom = Math.max(1, Math.min(5, crop.current.zoom * factor));
    const side = Math.min(img.naturalWidth, img.naturalHeight) / zoom;
    crop.current = {
      zoom,
      x: crop.current.x + ((from.x - bounds.left) / bounds.width - .125) / .75 * oldSide - ((to.x - bounds.left) / bounds.width - .125) / .75 * side,
      y: crop.current.y + ((from.y - bounds.top) / bounds.height - .125) / .75 * oldSide - ((to.y - bounds.top) / bounds.height - .125) / .75 * side,
    };
    draw();
  }, [draw]);

  useEffect(() => {
    mounted.current = true;
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      image.current = img;
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      crop.current = { zoom: 1, x: (img.naturalWidth - side) / 2, y: (img.naturalHeight - side) / 2 };
      draw(); setReady(true);
    };
    img.onerror = () => setError("This photo couldn’t be opened. Choose another image.");
    img.src = source;
    return () => {
      mounted.current = false;
      img.onload = null; img.onerror = null; image.current = null;
      element.close(); document.body.style.overflow = overflow; previous?.focus();
    };
  }, [source, draw]);

  useEffect(() => {
    const element = canvas.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = { x: event.clientX, y: event.clientY };
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1);
      transform(point, point, Math.exp(-delta * .005));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [transform]);

  function applyCrop() {
    const img = image.current;
    if (!ready || !img || locked.current) return;
    locked.current = true; setBusy(true);
    const fail = () => {
      if (!mounted.current) return;
      setError("Couldn’t crop this photo. Please try again.");
      locked.current = false; setBusy(false);
    };
    try {
      const output = document.createElement("canvas");
      output.width = output.height = 512;
      const context = output.getContext("2d");
      if (!context) { fail(); return; }
      const side = Math.min(img.naturalWidth, img.naturalHeight) / crop.current.zoom;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, 512, 512);
      context.drawImage(img, crop.current.x, crop.current.y, side, side, 0, 0, 512, 512);
      output.toBlob(blob => {
        if (!mounted.current) return;
        if (!blob) { fail(); return; }
        onApply(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", .9);
    } catch { fail(); }
  }
  function endPointer(id: number) { points.current.delete(id); }
  function isOutside(x: number, y: number) {
    const bounds = dialog.current!.getBoundingClientRect();
    return x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom;
  }
  return <dialog ref={dialog} className={styles.cropDialog} aria-label="Adjust profile photo"
    onPointerDown={event => { outsidePress.current = event.target === event.currentTarget && isOutside(event.clientX, event.clientY); }}
    onPointerUp={event => {
      if (outsidePress.current && event.target === event.currentTarget && isOutside(event.clientX, event.clientY)) applyCrop();
      outsidePress.current = false;
    }}
    onPointerCancel={() => { outsidePress.current = false; }}
    onCancel={event => { event.preventDefault(); if (!locked.current) onCancel(); }}>
    <div className={styles.cropToolbar}>
      <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
      <button type="button" disabled={!ready || busy} onClick={applyCrop}>{busy ? "Saving…" : "Done"}</button>
    </div>
    <div className={styles.cropStage}>
      <canvas ref={canvas} width={512} height={512} className={styles.cropCanvas} tabIndex={0}
        aria-label="Crop preview. Pinch or scroll to zoom, drag to move. Keyboard: plus and minus to zoom, arrow keys to move."
        onKeyDown={event => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
          const moves: Record<string, Point> = { ArrowLeft: { x: -12, y: 0 }, ArrowRight: { x: 12, y: 0 }, ArrowUp: { x: 0, y: -12 }, ArrowDown: { x: 0, y: 12 } };
          const move = moves[event.key];
          if (move || ["+", "=", "-"].includes(event.key)) {
            event.preventDefault();
            transform(center, move ? { x: center.x + move.x, y: center.y + move.y } : center, move ? 1 : event.key === "-" ? 1 / 1.1 : 1.1);
          }
        }}
        onPointerDown={event => {
          if (!ready || busy) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }}
        onPointerMove={event => {
          if (!points.current.has(event.pointerId)) return;
          const before = [...points.current.values()].slice(0, 2);
          points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          const after = [...points.current.values()].slice(0, 2);
          const middle = (p: Point[]) => p.length === 1 ? p[0] : { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
          const distance = (p: Point[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
          const factor = before.length === 2 ? distance(after) / Math.max(1, distance(before)) : 1;
          transform(middle(before), middle(after), factor);
        }}
        onPointerUp={event => endPointer(event.pointerId)}
        onPointerCancel={event => endPointer(event.pointerId)}
        onLostPointerCapture={event => endPointer(event.pointerId)} />
    </div>
    {error && <p role="alert" className={styles.cropError}>{error}</p>}
  </dialog>;
}
