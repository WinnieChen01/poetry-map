// Browser-side preparation keeps phone photos within the existing storage limit.
export async function preparePhoto(file: File): Promise<File> {
  if (!file.size) throw new Error("This file is empty. Choose another photo.");
  if (file.size > 20 * 1024 * 1024) throw new Error("This photo is over 20 MB. Choose a smaller version.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const webp = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if (!jpeg && !png && !webp) {
    throw new Error(/\.heic$|\.heif$/i.test(file.name) || /heic|heif/.test(file.type)
      ? "HEIC photos aren’t supported yet. Export this photo as JPG or PNG, then select it again."
      : "Choose a JPG, PNG, or WebP photo.");
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("This photo couldn’t be opened. Export it as JPG or PNG and try again."); }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser couldn’t prepare this photo. Please try another browser.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.75, 0.55]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 2 * 1024 * 1024) {
        return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
      }
    }
    throw new Error("This photo couldn’t be reduced enough. Choose a smaller version.");
  } finally { bitmap.close(); }
}
