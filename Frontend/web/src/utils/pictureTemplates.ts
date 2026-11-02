import { PICTURES, TYPE_PICTURE_KINDS, pictureForType } from "./pictures";
import type { PictureKind } from "./pictures";
import type { NodeType } from "../types";

// Ready-made pictures for a node, one per node type (a bulb for an Idea, a
// stop sign for a Problem…): the same drawings as "Draw a picture"
// (utils/pictures.ts), finished and inked in, on a soft square of their own
// colour. Picking one in a node's pictures (map/nodePanel/ImagesSection.tsx)
// adds it like any other picture, so it can then be the node's icon or card.

/** The template pictures to offer on a node of `type`: its own type's first, then the rest in order. */
export function templateKindsFor(type?: NodeType): PictureKind[] {
  const first = type ? pictureForType(type) : undefined;
  const rest = TYPE_PICTURE_KINDS.filter((k) => k !== first);
  return first ? [first, ...rest] : [...rest];
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** Template `kind` as an SVG drawing `size` pixels square, with no text in it, so it reads the same in every language. */
export function pictureTemplateSvg(kind: PictureKind, size = 480): string {
  const def = PICTURES[kind];
  const xs = def.dots.map((d) => d.x);
  const ys = def.dots.map((d) => d.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = size * 0.18;
  const scale = (size - 2 * pad) / Math.max(maxX - minX, maxY - minY, 0.001);
  const at = (i: number) => ({
    x: size / 2 + (def.dots[i].x - (minX + maxX) / 2) * scale,
    y: size / 2 + (def.dots[i].y - (minY + maxY) / 2) * scale,
  });
  const stroke = size * 0.022;
  const dot = size * 0.026;
  const shapes = def.paths
    .map((path) => {
      const pts = path.map((i) => `${fmt(at(i).x)},${fmt(at(i).y)}`).join(" ");
      const closed = path.length > 2 && path[0] === path[path.length - 1];
      return closed
        ? `<polygon points="${pts}" fill="${def.color}" fill-opacity="0.22" stroke="${def.color}" stroke-width="${fmt(stroke)}" stroke-linejoin="round"/>`
        : `<polyline points="${pts}" fill="none" stroke="${def.color}" stroke-width="${fmt(stroke)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");
  const dots = def.dots.map((_, i) => `<circle cx="${fmt(at(i).x)}" cy="${fmt(at(i).y)}" r="${fmt(dot)}" fill="${def.color}"/>`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
    `<rect x="${fmt(size * 0.04)}" y="${fmt(size * 0.04)}" width="${fmt(size * 0.92)}" height="${fmt(size * 0.92)}" rx="${fmt(size * 0.12)}" fill="${def.color}" fill-opacity="0.12"/>` +
    shapes +
    dots +
    `</svg>`
  );
}

/** Template `kind` as an <img> src, for its thumbnail. */
export function pictureTemplateSrc(kind: PictureKind, size = 96): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pictureTemplateSvg(kind, size))}`;
}

/** Template `kind` as a file, to add to a node like a picked one (useNodeImages' add shrinks it to a stored picture). */
export function pictureTemplateFile(kind: PictureKind): File {
  return new File([pictureTemplateSvg(kind)], `${kind}.svg`, { type: "image/svg+xml" });
}
