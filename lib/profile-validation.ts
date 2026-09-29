export function validateNames(first: unknown, last: unknown) {
  if (typeof first !== "string" || typeof last !== "string" || !first.trim() || !last.trim()) return null;
  if (first.trim().length > 80 || last.trim().length > 80) return null;
  return { first_name: first.trim(), last_name: last.trim() };
}

export function imageType(bytes: Uint8Array): { ext: string; mime: string } | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { ext: "jpg", mime: "image/jpeg" };
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return { ext: "png", mime: "image/png" };
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start,end));
  if (ascii(0,4) === "RIFF" && ascii(8,12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}
