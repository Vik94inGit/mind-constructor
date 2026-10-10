// Pictures on a node (NodeDoc.images): screenshots pasted from the clipboard,
// or picked/dropped files. Each one is shrunk and re-encoded here before it is
// sent, so it fits the backend's per-image cap (nodeAbl.ts MAX_IMAGE_CHARS)
// and a node with a few of them still loads quickly.

/** Mirrors the backend's MAX_NODE_IMAGES. */
export const MAX_NODE_IMAGES = 6;
/** Stays under the backend's MAX_IMAGE_CHARS (400 000) with room to spare. */
export const MAX_IMAGE_CHARS = 380_000;
/** The longest side a picture is scaled down to. */
const MAX_SIDE = 1600;

/** The image files among a paste's or a drop's items. */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (files.length === 0) {
    for (const file of Array.from(data.files ?? [])) if (file.type.startsWith("image/")) files.push(file);
  }
  return files;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("not an image"));
    };
    img.src = url;
  });
}

/** The scale that brings (w, h) down to fit `side` on its longest edge — never up. */
export function fitScale(w: number, h: number, side: number): number {
  const longest = Math.max(w, h);
  return longest > side ? side / longest : 1;
}

/**
 * `file` as a data URL small enough to store on a node: scaled to fit
 * MAX_SIDE, then encoded as WebP (JPEG where the browser can't), stepping the
 * quality — and then the size — down until it fits MAX_IMAGE_CHARS.
 * Rejects when the file isn't a readable image or can't be made small enough.
 */
export async function shrinkImage(file: Blob): Promise<string> {
  const img = await loadImage(file);
  let side = MAX_SIDE;
  for (let round = 0; round < 4; round++) {
    const k = fitScale(img.naturalWidth, img.naturalHeight, side);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    // A white backdrop, so a transparent screenshot doesn't turn black as JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55]) {
      let url = canvas.toDataURL("image/webp", quality);
      if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
      if (url.length <= MAX_IMAGE_CHARS) return url;
    }
    side = Math.round(side * 0.7);
  }
  throw new Error("image too large");
}

/** Mirrors the backend's MAX_ICON_IMAGE_CHARS. */
export const MAX_ICON_IMAGE_CHARS = 40_000;
const ICON_SIDE = 112;

/**
 * A node's picture icon (NodeDoc.iconImage): the middle square of `src` (one
 * of the node's pictures, a data URL), scaled down to ICON_SIDE and encoded
 * small enough for the map's node list.
 */
export async function makeIconImage(src: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("not an image"));
    el.src = src;
  });
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new Error("not an image");
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIDE;
  canvas.height = ICON_SIDE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, ICON_SIDE, ICON_SIDE);
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, ICON_SIDE, ICON_SIDE);
  for (const quality of [0.8, 0.6, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= MAX_ICON_IMAGE_CHARS) return url;
  }
  throw new Error("image too large");
}
